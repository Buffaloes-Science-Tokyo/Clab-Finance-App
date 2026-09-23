import { Client } from "pg";
import {
  openLocalDb,
  ensureSyncSetup,
  getLocalSyncState,
  readOutbox,
  clearOutbox,
  switchHub,
  applyRemoteRows,
  countForeignKeyIssues,
  isSyncReady,
  saveSyncResult,
  readRetryRows,
  saveRetryRows,
  type RemoteRow,
} from "@/server/sync-local";

/**
 * Neon(PostgreSQL)との双方向同期。
 *
 * Neon側は各端末の変更を集める「中継所」として、1つのテーブル sync_rows に
 * 行ごとの最新状態(JSON)・変更日時・通し番号(seq)を保存する。
 *   1. 送信: ローカルの未送信の変更を送る。Neon側の方が新しい行は上書きしない(後勝ち)。
 *   2. 受信: 前回取り込んだ seq より後の変更を取り込む。
 */

export const REMOTE_SCHEMA_SQL = `
  CREATE SEQUENCE IF NOT EXISTS sync_rows_seq;
  CREATE TABLE IF NOT EXISTS sync_rows (
    model      text    NOT NULL,
    id         text    NOT NULL,
    data       jsonb,
    deleted    boolean NOT NULL DEFAULT false,
    updated_at text    NOT NULL,
    device_id  text    NOT NULL,
    seq        bigint  NOT NULL,
    PRIMARY KEY (model, id)
  );
  CREATE INDEX IF NOT EXISTS sync_rows_seq_idx ON sync_rows (seq);
  CREATE TABLE IF NOT EXISTS sync_meta (key text PRIMARY KEY, value text NOT NULL);
  INSERT INTO sync_meta (key, value) VALUES ('hub_id', gen_random_uuid()::text)
    ON CONFLICT (key) DO NOTHING;
`;

/** 送信を端末間で直列化するためのアドバイザリロックのキー(seqの順番とコミット順を一致させる) */
const PUSH_LOCK_KEY = 83420177;
const PUSH_BATCH = 200;
const PULL_BATCH = 1000;

export type SyncResult = {
  ok: boolean;
  error?: string;
  pushed: number; // 送信した行
  pushRejected: number; // Neon側の方が新しかったため送信を見送った行
  pulled: number; // 受信した行
  applied: number; // ローカルに反映した行
  localWins: number; // ローカルの未送信の変更の方が新しかった行
  errors: { model: string; id: string; message: string }[];
  foreignKeyIssues: number;
  finishedAt: string;
};

export function isNeonConfigured() {
  return !!process.env.NEON_DATABASE_URL;
}

function emptyResult(): SyncResult {
  return {
    ok: false,
    pushed: 0,
    pushRejected: 0,
    pulled: 0,
    applied: 0,
    localWins: 0,
    errors: [],
    foreignKeyIssues: 0,
    finishedAt: "",
  };
}

function describeConnectionError(e: unknown): string {
  const code = (e as { code?: string }).code;
  if (code && ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH"].includes(code)) {
    return "Neonに接続できませんでした。インターネット接続を確認してください(オフライン中もアプリはそのまま使えます)。";
  }
  const message = e instanceof Error ? e.message : String(e);
  if (/timeout/i.test(message)) {
    return "Neonへの接続がタイムアウトしました。インターネット接続を確認してください。";
  }
  if (/password authentication failed/i.test(message)) {
    return "Neonの認証に失敗しました。NEON_DATABASE_URL のユーザー名・パスワードを確認してください。";
  }
  return `Neonとの通信でエラーが発生しました: ${message}`;
}

let running = false;

export async function runSync(): Promise<SyncResult> {
  const result = emptyResult();
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    result.error = ".env に NEON_DATABASE_URL が設定されていません。";
    return result;
  }
  if (running) {
    result.error = "同期は既に実行中です。";
    return result;
  }
  running = true;

  ensureSyncSetup();
  let db: ReturnType<typeof openLocalDb>;
  try {
    db = openLocalDb();
  } catch (e) {
    running = false;
    result.error = `ローカルのデータベースを開けませんでした: ${e instanceof Error ? e.message : e}`;
    return result;
  }
  if (!isSyncReady(db)) {
    db.close();
    running = false;
    result.error =
      "同期用のテーブルがありません。npm run db:migrate を実行してからアプリを再起動してください。";
    return result;
  }
  const client = new Client({
    // Neonが発行するURLは sslmode=require。pg v8 では verify-full と同じ扱いなので明示して警告を抑える
    connectionString: url.replace(/sslmode=require\b/, "sslmode=verify-full"),
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,
  });

  try {
    try {
      await client.connect();
      await client.query(REMOTE_SCHEMA_SQL);
    } catch (e) {
      result.error = describeConnectionError(e);
      return result;
    }

    const { deviceId, hubId } = getLocalSyncState(db);
    const remoteHubId = (
      await client.query<{ value: string }>("SELECT value FROM sync_meta WHERE key = 'hub_id'")
    ).rows[0].value;
    if (hubId !== remoteHubId) switchHub(db, remoteHubId);

    // ── 1. 送信 ──────────────────────────
    const outbox = readOutbox(db);
    if (outbox.changes.length > 0) {
      await client.query("BEGIN");
      try {
        await client.query("SELECT pg_advisory_xact_lock($1)", [PUSH_LOCK_KEY]);
        for (let i = 0; i < outbox.changes.length; i += PUSH_BATCH) {
          const batch = outbox.changes.slice(i, i + PUSH_BATCH).map((c) => ({
            model: c.model,
            id: c.id,
            data: c.data,
            deleted: c.data === null,
            updated_at: c.changedAt,
          }));
          const res = await client.query(
            `INSERT INTO sync_rows (model, id, data, deleted, updated_at, device_id, seq)
             SELECT x.model, x.id, x.data, x.deleted, x.updated_at, $2, nextval('sync_rows_seq')
             FROM jsonb_to_recordset($1::jsonb)
               AS x(model text, id text, data jsonb, deleted boolean, updated_at text)
             ON CONFLICT (model, id) DO UPDATE SET
               data = EXCLUDED.data,
               deleted = EXCLUDED.deleted,
               updated_at = EXCLUDED.updated_at,
               device_id = EXCLUDED.device_id,
               seq = EXCLUDED.seq
             WHERE EXCLUDED.updated_at COLLATE "C" > sync_rows.updated_at COLLATE "C"`,
            [JSON.stringify(batch), deviceId]
          );
          result.pushed += res.rowCount ?? 0;
          result.pushRejected += batch.length - (res.rowCount ?? 0);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      }
      clearOutbox(db, outbox.maxSeq);
    }

    // ── 2. 受信 ──────────────────────────
    let lastSeq = getLocalSyncState(db).lastPulledSeq;
    const collect = (applied: ReturnType<typeof applyRemoteRows>, received: number) => {
      result.pulled += received - applied.skippedOwn;
      result.applied += applied.applied;
      result.localWins += applied.localWins;
      result.errors.push(...applied.errors);
    };

    // 前回取り込めなかった行を再試行(一意制約の衝突が解消されていれば取り込める)
    const retry = readRetryRows(db);
    if (retry.length > 0) {
      const res = await client.query<RemoteRow>(
        `SELECT s.model, s.id, s.data, s.deleted, s.updated_at, s.device_id
         FROM sync_rows s
         JOIN jsonb_to_recordset($1::jsonb) AS k(model text, id text)
           ON s.model = k.model AND s.id = k.id`,
        [JSON.stringify(retry)]
      );
      collect(applyRemoteRows(db, res.rows, deviceId, lastSeq), res.rows.length);
    }

    for (;;) {
      const res = await client.query<RemoteRow & { seq: string }>(
        `SELECT model, id, data, deleted, updated_at, device_id, seq
         FROM sync_rows WHERE seq > $1 ORDER BY seq LIMIT ${PULL_BATCH}`,
        [lastSeq]
      );
      if (res.rows.length === 0) break;
      lastSeq = Number(res.rows[res.rows.length - 1].seq);
      collect(applyRemoteRows(db, res.rows, deviceId, lastSeq), res.rows.length);
      if (res.rows.length < PULL_BATCH) break;
    }

    const failed = new Map(result.errors.map((e) => [`${e.model}:${e.id}`, { model: e.model, id: e.id }]));
    saveRetryRows(db, [...failed.values()]);

    result.foreignKeyIssues = countForeignKeyIssues(db);
    result.ok = true;
    return result;
  } catch (e) {
    result.error = describeConnectionError(e);
    return result;
  } finally {
    result.finishedAt = new Date().toISOString();
    try {
      saveSyncResult(db, result);
    } catch {
      // 結果の保存に失敗しても同期自体の結果は返す
    } finally {
      db.close();
      await client.end().catch(() => {});
      running = false;
    }
  }
}
