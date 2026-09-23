"use server";

import { revalidatePath } from "next/cache";
import { runSync, isNeonConfigured, type SyncResult } from "@/server/sync";
import { openLocalDb, ensureSyncSetup, countPendingChanges } from "@/server/sync-local";

export async function syncWithNeon() {
  const result = await runSync();
  // 取り込んだデータを全ページに反映する
  if (result.applied > 0) revalidatePath("/", "layout");
  else revalidatePath("/sync");
  return result;
}

export async function getSyncStatus() {
  ensureSyncSetup();
  const db = openLocalDb();
  try {
    const state = db
      .prepare(
        `SELECT "deviceId", "lastSyncAt", "lastResult" FROM "SyncState" WHERE "id" = 'singleton'`
      )
      .get() as
      | { deviceId: string; lastSyncAt: string | null; lastResult: string | null }
      | undefined;
    return {
      configured: isNeonConfigured(),
      deviceId: state?.deviceId ?? null,
      pendingChanges: state ? countPendingChanges(db) : 0,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastResult: state?.lastResult ? (JSON.parse(state.lastResult) as SyncResult) : null,
    };
  } finally {
    db.close();
  }
}
