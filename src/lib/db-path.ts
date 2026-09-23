import path from "node:path";

/** ローカルSQLiteファイルの絶対パス(DATABASE_URL="file:..." から解決) */
export function localDbFilePath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbFile = dbUrl.replace(/^file:/, "");
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), dbFile);
}
