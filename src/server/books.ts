import Database from "better-sqlite3";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { applyMigrations } from "@/server/migrate";
import { ensureSyncSetup } from "@/server/sync-local";

/**
 * 「口座」(画面上の呼び名)ごとの帳簿の管理。コード上は Book と呼ぶ
 * (帳簿の中の「仮想口座」VirtualAccount と区別するため)。
 *
 * - data/registry.db … 口座の一覧・パスワードとリカバリーコードのハッシュ・Neonの接続先
 * - data/books/<id>.db … 口座ごとのデータベース(中身は prisma/schema.prisma のとおり)
 * (保存先のフォルダは環境変数 DATA_DIR で変更できる)
 */

const DATA_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATA_DIR || "data");
const BOOKS_DIR = path.join(DATA_DIR, "books");
const REGISTRY_FILE = path.join(DATA_DIR, "registry.db");

/** 口座を導入する前に使っていたデータベース(取り込み元) */
const LEGACY_DB_FILE = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "")
);

export type Book = {
  id: string;
  name: string;
  dbFile: string;
  neonUrl: string | null;
  neonHubId: string | null;
  createdAt: string;
  hasRecoveryCode: boolean;
};

type BookRow = Omit<Book, "dbFile" | "hasRecoveryCode"> & {
  passwordHash: string;
  recoveryHash: string | null;
};

function openRegistry() {
  mkdirSync(BOOKS_DIR, { recursive: true });
  const db = new Database(REGISTRY_FILE);
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      neonUrl      TEXT,
      neonHubId    TEXT,
      createdAt    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // 後から追加した列
  const columns = (db.prepare(`PRAGMA table_info(books)`).all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!columns.includes("recoveryHash")) db.exec(`ALTER TABLE books ADD COLUMN recoveryHash TEXT`);
  return db;
}

function withRegistry<T>(fn: (db: Database.Database) => T): T {
  const db = openRegistry();
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function toBook(row: BookRow): Book {
  const { passwordHash, recoveryHash, ...rest } = row;
  void passwordHash;
  return {
    ...rest,
    dbFile: path.join(BOOKS_DIR, `${row.id}.db`),
    hasRecoveryCode: !!recoveryHash,
  };
}

// ── パスワード ──────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function checkPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const MIN_PASSWORD_LENGTH = 4;

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`);
  }
}

// ── リカバリーコード(パスワードを忘れたときの再設定用) ──

// 読み間違えやすい I L O U を除いた32文字。20文字(100ビット)を5文字ずつ区切って表示する
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function generateRecoveryCode(): string {
  const bytes = randomBytes(20);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % 32]).join("");
  return chars.match(/.{5}/g)!.join("-");
}

/** 入力されたコードを正規化する(区切り・空白を除き、紛らわしい文字を読み替える) */
function normalizeRecoveryCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** 新しいリカバリーコードを発行する(以前のコードは無効になる)。平文のコードを返す */
function issueRecoveryCode(db: Database.Database, id: string): string {
  const code = generateRecoveryCode();
  db.prepare(`UPDATE books SET recoveryHash = ? WHERE id = ?`).run(
    hashPassword(normalizeRecoveryCode(code)),
    id
  );
  return code;
}

// ── 口座の一覧・取得 ────────────────────────

export function listBooks(): Book[] {
  return withRegistry((db) =>
    (db.prepare(`SELECT * FROM books ORDER BY createdAt`).all() as BookRow[]).map(toBook)
  );
}

export function getBook(id: string): Book | null {
  return withRegistry((db) => {
    const row = db.prepare(`SELECT * FROM books WHERE id = ?`).get(id) as BookRow | undefined;
    return row ? toBook(row) : null;
  });
}

export function verifyBookPassword(id: string, password: string): boolean {
  return withRegistry((db) => {
    const row = db.prepare(`SELECT passwordHash FROM books WHERE id = ?`).get(id) as
      | { passwordHash: string }
      | undefined;
    return !!row && checkPassword(password, row.passwordHash);
  });
}

// ── 口座の作成 ──────────────────────────────

/**
 * 口座を作成し、専用のデータベースを用意する。
 * sourceDbFile を指定した場合は、そのデータベースを複製して取り込む(元のファイルは残す)。
 */
export function createBook(input: {
  name: string;
  password: string;
  sourceDbFile?: string;
  neonUrl?: string | null;
}): { book: Book; recoveryCode: string } {
  const name = input.name.trim();
  if (!name) throw new Error("口座名を入力してください。");
  assertPassword(input.password);
  if (listBooks().some((b) => b.name === name)) {
    throw new Error(`「${name}」という口座は既にあります。`);
  }

  const id = randomUUID();
  const dbFile = path.join(BOOKS_DIR, `${id}.db`);
  mkdirSync(BOOKS_DIR, { recursive: true });
  try {
    if (input.sourceDbFile) copyFileSync(input.sourceDbFile, dbFile);
    applyMigrations(dbFile);
    ensureSyncSetup(dbFile);
  } catch (e) {
    if (existsSync(dbFile)) unlinkSync(dbFile);
    throw e;
  }

  const recoveryCode = withRegistry((db) => {
    db.prepare(
      `INSERT INTO books (id, name, passwordHash, neonUrl, createdAt) VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, hashPassword(input.password), input.neonUrl || null, new Date().toISOString());
    return issueRecoveryCode(db, id);
  });
  return { book: getBook(id)!, recoveryCode };
}

// ── パスワードの変更・再設定 ─────────────────

/** 現在のパスワードを確認して変更する */
export function changeBookPassword(id: string, currentPassword: string, newPassword: string) {
  assertPassword(newPassword);
  if (!verifyBookPassword(id, currentPassword)) throw new Error("現在のパスワードが違います。");
  withRegistry((db) =>
    db.prepare(`UPDATE books SET passwordHash = ? WHERE id = ?`).run(hashPassword(newPassword), id)
  );
}

/** 現在のパスワードを確認して、リカバリーコードを発行し直す */
export function reissueRecoveryCode(id: string, currentPassword: string): string {
  if (!verifyBookPassword(id, currentPassword)) throw new Error("パスワードが違います。");
  return withRegistry((db) => issueRecoveryCode(db, id));
}

/**
 * リカバリーコードでパスワードを再設定する。
 * 使ったコードは無効になり、新しいリカバリーコードを返す。
 */
export function resetPasswordWithRecoveryCode(
  id: string,
  code: string,
  newPassword: string
): string {
  assertPassword(newPassword);
  return withRegistry((db) => {
    const row = db.prepare(`SELECT recoveryHash FROM books WHERE id = ?`).get(id) as
      | { recoveryHash: string | null }
      | undefined;
    if (!row?.recoveryHash) {
      throw new Error("この口座にはリカバリーコードが発行されていません。");
    }
    if (!checkPassword(normalizeRecoveryCode(code), row.recoveryHash)) {
      throw new Error("リカバリーコードが違います。");
    }
    db.prepare(`UPDATE books SET passwordHash = ? WHERE id = ?`).run(hashPassword(newPassword), id);
    return issueRecoveryCode(db, id);
  });
}

/**
 * 最終手段: PCを操作できる人がコマンドからパスワードを再設定する(scripts/reset-book-password.ts)。
 * 新しいリカバリーコードも発行して返す。
 */
export function forceResetBookPassword(name: string, newPassword: string) {
  assertPassword(newPassword);
  const book = listBooks().find((b) => b.name === name);
  if (!book) throw new Error(`「${name}」という口座はありません。`);
  const recoveryCode = withRegistry((db) => {
    db.prepare(`UPDATE books SET passwordHash = ? WHERE id = ?`).run(
      hashPassword(newPassword),
      book.id
    );
    return issueRecoveryCode(db, book.id);
  });
  return { book, recoveryCode };
}

// ── Neonの接続先 ────────────────────────────

export function setBookNeonUrl(id: string, neonUrl: string | null) {
  withRegistry((db) =>
    db
      .prepare(`UPDATE books SET neonUrl = ?, neonHubId = NULL WHERE id = ?`)
      .run(neonUrl?.trim() || null, id)
  );
}

/** 同期先NeonのIDを記録する。別の口座が同じNeonを使っていれば、その口座名を返す */
export function claimNeonHub(id: string, hubId: string): string | null {
  return withRegistry((db) => {
    const other = db
      .prepare(`SELECT name FROM books WHERE neonHubId = ? AND id <> ?`)
      .get(hubId, id) as { name: string } | undefined;
    if (other) return other.name;
    db.prepare(`UPDATE books SET neonHubId = ? WHERE id = ?`).run(hubId, id);
    return null;
  });
}

// ── セッション署名用の秘密鍵 ─────────────────

export function getSessionSecret(): string {
  return withRegistry((db) => {
    const row = db.prepare(`SELECT value FROM meta WHERE key = 'sessionSecret'`).get() as
      | { value: string }
      | undefined;
    if (row) return row.value;
    const secret = randomBytes(32).toString("hex");
    db.prepare(`INSERT INTO meta (key, value) VALUES ('sessionSecret', ?)`).run(secret);
    return secret;
  });
}

// ── 口座導入前のデータの取り込み ──────────────

/** 取り込めるデータ(口座導入前のデータベース)があるか */
export function hasLegacyData(): boolean {
  if (!existsSync(LEGACY_DB_FILE)) return false;
  const imported = withRegistry(
    (db) => !!db.prepare(`SELECT 1 FROM meta WHERE key = 'legacyImported'`).get()
  );
  if (imported) return false;
  const db = new Database(LEGACY_DB_FILE, { readonly: true, fileMustExist: true });
  try {
    const hasTx = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'Transaction'`)
      .get();
    return !!hasTx;
  } finally {
    db.close();
  }
}

/** 口座導入前のデータベースを複製して口座にする(同期先のNeonも引き継ぐ) */
export function importLegacyData(input: { name: string; password: string }) {
  const created = createBook({
    ...input,
    sourceDbFile: LEGACY_DB_FILE,
    neonUrl: process.env.NEON_DATABASE_URL || null,
  });
  withRegistry((db) =>
    db
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('legacyImported', ?)`)
      .run(created.book.id)
  );
  return created;
}
