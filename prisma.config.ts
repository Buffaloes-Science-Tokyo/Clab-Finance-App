import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const dbUrl = process.env["DATABASE_URL"] ?? "file:./prisma/dev.db";
const dbFile = dbUrl.replace(/^file:/, "");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: `file:${path.resolve(process.cwd(), dbFile)}`,
  },
});
