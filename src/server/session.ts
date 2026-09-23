import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBook, getSessionSecret, type Book } from "@/server/books";

/**
 * 開いている口座をCookieで保持する。値は「口座ID.有効期限.署名」で、
 * 署名はサーバーだけが持つ秘密鍵で作るため、Cookieを書き換えても他の口座は開けない。
 */

const COOKIE_NAME = "book_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12時間

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const [bookId, expires, signature] = token.split(".");
  if (!bookId || !expires || !signature) return null;
  const expected = Buffer.from(sign(`${bookId}.${expires}`), "hex");
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (Number(expires) < Date.now()) return null;
  return bookId;
}

/** 口座を開く(パスワード確認後に Server Action から呼ぶ) */
export async function startBookSession(bookId: string) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${bookId}.${expires}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endBookSession() {
  (await cookies()).delete(COOKIE_NAME);
}

/** 開いている口座(未選択・期限切れなら null) */
export async function getCurrentBook(): Promise<Book | null> {
  const bookId = parseToken((await cookies()).get(COOKIE_NAME)?.value);
  return bookId ? getBook(bookId) : null;
}

/** 開いている口座。未選択ならホーム(口座選択画面)へ移動する */
export async function requireCurrentBook(): Promise<Book> {
  const book = await getCurrentBook();
  if (!book) redirect("/");
  return book;
}

// ── リカバリーコードの一度きりの表示 ──────────────
// 発行直後のコードを表示ページ(/recovery-code)へ渡すための短命なCookie

const RECOVERY_FLASH_COOKIE = "recovery_code_flash";

export async function setRecoveryCodeFlash(code: string) {
  (await cookies()).set(RECOVERY_FLASH_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/recovery-code",
    maxAge: 10 * 60,
  });
}

export async function readRecoveryCodeFlash(): Promise<string | null> {
  return (await cookies()).get(RECOVERY_FLASH_COOKIE)?.value ?? null;
}

export async function clearRecoveryCodeFlash() {
  (await cookies()).delete({ name: RECOVERY_FLASH_COOKIE, path: "/recovery-code" });
}
