import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { localDbFilePath } from "@/lib/db-path";
import { ensureSyncSetup } from "@/server/sync-local";

function createPrismaClient() {
  // 変更追跡トリガーを用意(マイグレーションでテーブルが作り直されると消えるため毎回確認)
  ensureSyncSetup();
  const adapter = new PrismaBetterSqlite3({ url: `file:${localDbFilePath()}` });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
