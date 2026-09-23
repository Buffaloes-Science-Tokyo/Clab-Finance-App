"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/server/sync";
import type { SyncResult } from "@/server/sync";
import { setBookNeonUrl } from "@/server/books";
import { requireCurrentBook } from "@/server/session";
import { openLocalDb, ensureSyncSetup, countPendingChanges } from "@/server/sync-local";

export async function syncWithNeon() {
  const book = await requireCurrentBook();
  const result = await runSync(book);
  // 取り込んだデータを全ページに反映する
  if (result.applied > 0) revalidatePath("/", "layout");
  else revalidatePath("/sync");
  return result;
}

export async function saveNeonUrl(neonUrl: string | null) {
  const book = await requireCurrentBook();
  const url = neonUrl?.trim() || null;
  if (url && !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("接続先は postgresql:// で始まるURLを指定してください。");
  }
  setBookNeonUrl(book.id, url);
  revalidatePath("/sync");
}

/** 接続先URLのパスワード部分を伏せて表示用にする */
function maskUrl(url: string) {
  return url.replace(/(:\/\/[^:/@]+:)[^@]+@/, "$1****@");
}

export async function getSyncStatus() {
  const book = await requireCurrentBook();
  ensureSyncSetup(book.dbFile);
  const db = openLocalDb(book.dbFile);
  try {
    const state = db
      .prepare(
        `SELECT "deviceId", "lastSyncAt", "lastResult" FROM "SyncState" WHERE "id" = 'singleton'`
      )
      .get() as
      | { deviceId: string; lastSyncAt: string | null; lastResult: string | null }
      | undefined;
    return {
      neonUrlMasked: book.neonUrl ? maskUrl(book.neonUrl) : null,
      deviceId: state?.deviceId ?? null,
      pendingChanges: state ? countPendingChanges(db) : 0,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastResult: state?.lastResult ? (JSON.parse(state.lastResult) as SyncResult) : null,
    };
  } finally {
    db.close();
  }
}
