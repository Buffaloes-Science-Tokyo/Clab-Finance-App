import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { Book } from "@/server/books";
import { requireCurrentBook } from "@/server/session";
import { applyMigrations } from "@/server/migrate";
import { ensureSyncSetup } from "@/server/sync-local";

function createPrismaClient(dbFile: string) {
  // アプリ更新で増えたマイグレーションを適用し、変更追跡トリガーを用意する
  // (マイグレーションでテーブルが作り直されるとトリガーが消えるため毎回確認)
  applyMigrations(dbFile);
  ensureSyncSetup(dbFile);
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });
  return new PrismaClient({ adapter });
}

// 口座ごとのクライアントを使い回す(開発時のホットリロードでも作り直さない)
const globalForPrisma = globalThis as unknown as {
  prismaClients: Map<string, PrismaClient> | undefined;
};
const clients = (globalForPrisma.prismaClients ??= new Map());

export function prismaForBook(book: Book): PrismaClient {
  let client = clients.get(book.id);
  if (!client) {
    client = createPrismaClient(book.dbFile);
    clients.set(book.id, client);
  }
  return client;
}

/** 開いている口座のデータベース。口座が未選択ならホーム(口座選択画面)へ移動する */
export async function getDb(): Promise<PrismaClient> {
  return prismaForBook(await requireCurrentBook());
}
