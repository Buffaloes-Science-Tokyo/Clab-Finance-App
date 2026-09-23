import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/**
 * Neon同期のローカル(SQLite)側。
 *
 * - 同期対象の各テーブルに INSERT/UPDATE/DELETE トリガーを張り、変更を SyncOutbox に記録する。
 *   Prismaのどのコード経路(ネストした作成・カスケード削除など)で変更されても漏れなく拾える。
 * - Neonから取り込んだ行は、外部キー制約を一時的に外した専用接続で反映する。
 */

type Db = Database.Database;

/** 同期しないテーブル */
const EXCLUDED_TABLES = new Set(["_prisma_migrations", "SyncOutbox", "SyncState"]);

/** 初回登録する既存データの変更日時。どのリモートの変更にも負ける(リモートに無ければ送られる) */
const EPOCH = "1970-01-01T00:00:00.000Z";

export type RemoteRow = {
  model: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  updated_at: string;
  device_id: string;
};

export type OutboxChange = {
  model: string;
  id: string;
  changedAt: string;
  data: Record<string, unknown> | null; // null = 削除済み
};

export type ApplyResult = {
  applied: number;
  skippedOwn: number;
  localWins: number;
  errors: { model: string; id: string; message: string }[];
};

export function openLocalDb(dbFile: string): Db {
  const db = new Database(dbFile, { fileMustExist: true });
  db.pragma("busy_timeout = 5000");
  return db;
}

function hasTable(db: Db, name: string) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

function tableColumns(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
    (c) => c.name
  );
}

/** id 列を持つ、同期対象のテーブル一覧 */
export function syncedTables(db: Db): string[] {
  const names = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
  return names.filter((n) => !EXCLUDED_TABLES.has(n) && tableColumns(db, n).includes("id"));
}

function createTriggers(db: Db, table: string) {
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
  const insertOutbox = (ref: "NEW" | "OLD") =>
    `INSERT INTO "SyncOutbox" ("model", "rowId", "changedAt") VALUES ('${table}', ${ref}."id", ${now});`;
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS "_sync_${table}_insert" AFTER INSERT ON "${table}"
    BEGIN ${insertOutbox("NEW")} END;
    CREATE TRIGGER IF NOT EXISTS "_sync_${table}_update" AFTER UPDATE ON "${table}"
    BEGIN ${insertOutbox("NEW")} END;
    CREATE TRIGGER IF NOT EXISTS "_sync_${table}_delete" AFTER DELETE ON "${table}"
    BEGIN ${insertOutbox("OLD")} END;
  `);
}

type SyncStateRow = {
  deviceId: string;
  lastPulledSeq: number;
  initialized: number;
  hubId: string | null;
};

function readState(db: Db): SyncStateRow | undefined {
  return db
    .prepare(`SELECT "deviceId", "lastPulledSeq", "initialized", "hubId" FROM "SyncState" WHERE "id" = 'singleton'`)
    .get() as SyncStateRow | undefined;
}

/**
 * 変更追跡トリガーと同期状態を用意する(何度呼んでもよい)。
 * マイグレーションでテーブルが作り直されるとトリガーが消えるため、起動時と同期時に呼ぶ。
 * 同期用テーブルがまだ無い(マイグレーション未適用)場合は何もしない。
 */
export function ensureSyncSetup(dbFile: string): void {
  let db: Db;
  try {
    db = openLocalDb(dbFile);
  } catch {
    return;
  }
  try {
    if (!hasTable(db, "SyncOutbox") || !hasTable(db, "SyncState")) return;
    const tables = syncedTables(db);
    db.transaction(() => {
      for (const t of tables) createTriggers(db, t);

      let state = readState(db);
      if (!state) {
        db.prepare(`INSERT INTO "SyncState" ("id", "deviceId") VALUES ('singleton', ?)`).run(
          randomUUID()
        );
        state = readState(db)!;
      }
      // 同期機能の導入前からあるデータを、送信待ちとして一度だけ登録する
      if (!state.initialized) {
        for (const t of tables) {
          db.prepare(
            `INSERT INTO "SyncOutbox" ("model", "rowId", "changedAt") SELECT ?, "id", ? FROM "${t}"`
          ).run(t, EPOCH);
        }
        db.prepare(`UPDATE "SyncState" SET "initialized" = 1 WHERE "id" = 'singleton'`).run();
      }
    }).immediate();
  } finally {
    db.close();
  }
}

export function isSyncReady(db: Db) {
  return hasTable(db, "SyncOutbox") && hasTable(db, "SyncState") && !!readState(db);
}

export function getLocalSyncState(db: Db) {
  const state = readState(db);
  if (!state) throw new Error("同期の初期化が完了していません。アプリを再起動してください。");
  return { deviceId: state.deviceId, lastPulledSeq: state.lastPulledSeq, hubId: state.hubId };
}

/**
 * 同期先のNeonが前回と違う(接続先の変更・作り直し)場合、最初から同期し直す:
 * 受信位置を0に戻し、ローカルの全データを送信待ちに登録する。
 */
export function switchHub(db: Db, hubId: string) {
  db.transaction(() => {
    for (const t of syncedTables(db)) {
      db.prepare(
        `INSERT INTO "SyncOutbox" ("model", "rowId", "changedAt") SELECT ?, "id", ? FROM "${t}"`
      ).run(t, EPOCH);
    }
    db.prepare(
      `UPDATE "SyncState" SET "hubId" = ?, "lastPulledSeq" = 0 WHERE "id" = 'singleton'`
    ).run(hubId);
  }).immediate();
}

/** 送信待ちの変更(行ごとに最新の状態)を読み出す */
export function readOutbox(db: Db): { maxSeq: number; changes: OutboxChange[] } {
  return db.transaction(() => {
    const tables = new Set(syncedTables(db));
    const grouped = db
      .prepare(
        `SELECT "model", "rowId", MAX("changedAt") AS "changedAt", MAX("seq") AS "maxSeq"
         FROM "SyncOutbox" GROUP BY "model", "rowId"`
      )
      .all() as { model: string; rowId: string; changedAt: string; maxSeq: number }[];

    let maxSeq = 0;
    const changes: OutboxChange[] = [];
    for (const g of grouped) {
      maxSeq = Math.max(maxSeq, g.maxSeq);
      if (!tables.has(g.model)) continue; // 既に存在しないテーブル
      const row = db.prepare(`SELECT * FROM "${g.model}" WHERE "id" = ?`).get(g.rowId) as
        | Record<string, unknown>
        | undefined;
      changes.push({ model: g.model, id: g.rowId, changedAt: g.changedAt, data: row ?? null });
    }
    return { maxSeq, changes };
  })();
}

/** 送信済みの変更を送信待ちから外す(送信中に発生した新しい変更は残る) */
export function clearOutbox(db: Db, maxSeq: number) {
  db.prepare(`DELETE FROM "SyncOutbox" WHERE "seq" <= ?`).run(maxSeq);
}

export function countPendingChanges(db: Db): number {
  return (
    db.prepare(`SELECT COUNT(*) AS c FROM (SELECT 1 FROM "SyncOutbox" GROUP BY "model", "rowId")`).get() as {
      c: number;
    }
  ).c;
}

/**
 * Neonから取り込んだ行をローカルに反映する(後から更新された方を優先)。
 * 自端末が送った行は反映済みなのでスキップする。
 */
export function applyRemoteRows(
  db: Db,
  rows: RemoteRow[],
  deviceId: string,
  newLastPulledSeq: number
): ApplyResult {
  const result: ApplyResult = { applied: 0, skippedOwn: 0, localWins: 0, errors: [] };
  const tables = new Set(syncedTables(db));
  const columnsCache = new Map<string, Set<string>>();
  const columnsOf = (t: string) => {
    if (!columnsCache.has(t)) columnsCache.set(t, new Set(tableColumns(db, t)));
    return columnsCache.get(t)!;
  };

  // 取り込み順序によって親行がまだ無い場合があるため、この接続では外部キー制約を外す
  db.pragma("foreign_keys = OFF");

  const applyOne = db.transaction((r: RemoteRow) => {
    if (r.deleted || !r.data) {
      db.prepare(`DELETE FROM "${r.model}" WHERE "id" = ?`).run(r.id);
      return;
    }
    const cols = Object.keys(r.data).filter((c) => columnsOf(r.model).has(c));
    if (!cols.includes("id")) throw new Error("id がありません");
    const values = cols.map((c) => {
      const v = r.data![c];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : (v as unknown);
    });
    const quoted = cols.map((c) => `"${c}"`);
    const updates = cols.filter((c) => c !== "id").map((c) => `"${c}" = excluded."${c}"`);
    db.prepare(
      `INSERT INTO "${r.model}" (${quoted.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
       ON CONFLICT("id") DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"}`
    ).run(...values);
  });

  db.transaction(() => {
    const before =
      (db.prepare(`SELECT MAX("seq") AS s FROM "SyncOutbox"`).get() as { s: number | null }).s ?? 0;

    for (const r of rows) {
      if (r.device_id === deviceId) {
        result.skippedOwn += 1;
        continue;
      }
      if (!tables.has(r.model)) {
        result.errors.push({ model: r.model, id: r.id, message: "このアプリに存在しないテーブルです" });
        continue;
      }
      // まだ送信していないローカルの変更の方が新しければ、ローカルを優先する
      const pending = (
        db
          .prepare(
            `SELECT MAX("changedAt") AS c FROM "SyncOutbox" WHERE "model" = ? AND "rowId" = ? AND "seq" <= ?`
          )
          .get(r.model, r.id, before) as { c: string | null }
      ).c;
      if (pending && pending > r.updated_at) {
        result.localWins += 1;
        continue;
      }
      try {
        applyOne(r);
        // リモートの方が新しかったので、この行の古い送信待ちは破棄する
        db.prepare(`DELETE FROM "SyncOutbox" WHERE "model" = ? AND "rowId" = ? AND "seq" <= ?`).run(
          r.model,
          r.id,
          before
        );
        result.applied += 1;
      } catch (e) {
        result.errors.push({
          model: r.model,
          id: r.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 取り込みでトリガーが記録した分は、送り返す必要がないので消す
    db.prepare(`DELETE FROM "SyncOutbox" WHERE "seq" > ?`).run(before);
    db.prepare(`UPDATE "SyncState" SET "lastPulledSeq" = ? WHERE "id" = 'singleton'`).run(
      newLastPulledSeq
    );
  }).immediate();

  db.pragma("foreign_keys = ON");
  return result;
}

/** 外部キーの参照先が存在しない行の数(取り込み後の整合性チェック) */
export function countForeignKeyIssues(db: Db): number {
  return (db.pragma("foreign_key_check") as unknown[]).length;
}

export type RowKey = { model: string; id: string };

/** 前回取り込めなかった行(次回の同期で再試行する) */
export function readRetryRows(db: Db): RowKey[] {
  const row = db.prepare(`SELECT "retryRows" FROM "SyncState" WHERE "id" = 'singleton'`).get() as
    | { retryRows: string | null }
    | undefined;
  return row?.retryRows ? (JSON.parse(row.retryRows) as RowKey[]) : [];
}

export function saveRetryRows(db: Db, rows: RowKey[]) {
  db.prepare(`UPDATE "SyncState" SET "retryRows" = ? WHERE "id" = 'singleton'`).run(
    rows.length ? JSON.stringify(rows) : null
  );
}

export function saveSyncResult(db: Db, result: unknown) {
  db.prepare(
    `UPDATE "SyncState" SET "lastSyncAt" = ?, "lastResult" = ? WHERE "id" = 'singleton'`
  ).run(new Date().toISOString(), JSON.stringify(result));
}
