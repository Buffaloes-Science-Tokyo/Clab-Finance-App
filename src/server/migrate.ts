import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * 口座ごとのSQLiteファイルに prisma/migrations を適用する。
 * `prisma migrate deploy` と同じ形式で _prisma_migrations に記録するため、Prisma CLIとも互換がある。
 * アプリの更新でマイグレーションが増えた場合も、口座を開いたときに自動で適用される。
 */

const MIGRATIONS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "prisma", "migrations");

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

function listMigrations(): { name: string; sql: Buffer }[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`マイグレーションが見つかりません: ${MIGRATIONS_DIR}`);
  }
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(MIGRATIONS_DIR, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql")) }));
}

/** 未適用のマイグレーションを適用し、適用した件数を返す */
export function applyMigrations(dbFile: string): number {
  const db = new Database(dbFile);
  try {
    db.pragma("busy_timeout = 5000");
    db.exec(MIGRATIONS_TABLE_SQL);
    const applied = new Set(
      (
        db
          .prepare(
            `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
          )
          .all() as { migration_name: string }[]
      ).map((r) => r.migration_name)
    );

    let count = 0;
    for (const m of listMigrations()) {
      if (applied.has(m.name)) continue;
      const id = randomUUID();
      const checksum = createHash("sha256").update(m.sql).digest("hex");
      db.prepare(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at") VALUES (?, ?, ?, ?)`
      ).run(id, checksum, m.name, Date.now());
      try {
        db.exec(m.sql.toString("utf8"));
      } catch (e) {
        db.prepare(`UPDATE "_prisma_migrations" SET "logs" = ? WHERE "id" = ?`).run(
          e instanceof Error ? e.message : String(e),
          id
        );
        throw new Error(`マイグレーション ${m.name} の適用に失敗しました: ${e instanceof Error ? e.message : e}`);
      }
      db.prepare(
        `UPDATE "_prisma_migrations" SET "finished_at" = ?, "applied_steps_count" = 1 WHERE "id" = ?`
      ).run(Date.now(), id);
      count += 1;
    }
    return count;
  } finally {
    db.close();
  }
}
