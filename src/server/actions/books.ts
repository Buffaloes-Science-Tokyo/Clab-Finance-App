"use server";

import { redirect } from "next/navigation";
import {
  createBook,
  importLegacyData,
  verifyBookPassword,
  changeBookPassword,
  reissueRecoveryCode,
  resetPasswordWithRecoveryCode,
  MIN_PASSWORD_LENGTH,
} from "@/server/books";
import {
  startBookSession,
  endBookSession,
  requireCurrentBook,
  setRecoveryCodeFlash,
  clearRecoveryCodeFlash,
} from "@/server/session";

function backHome(params: Record<string, string>): never {
  redirect(`/?${new URLSearchParams(params).toString()}`);
}

function readNewBookForm(formData: FormData, form: string) {
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("passwordConfirm") || "");
  if (!name) backHome({ form, error: "口座名を入力してください。" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    backHome({ form, error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。` });
  }
  if (password !== confirm) backHome({ form, error: "確認用のパスワードが一致しません。" });
  return { name, password };
}

/** 口座を追加して開く */
export async function createBookAction(formData: FormData) {
  const input = readNewBookForm(formData, "create");
  let created: ReturnType<typeof createBook>;
  try {
    created = createBook(input);
  } catch (e) {
    backHome({ form: "create", error: e instanceof Error ? e.message : String(e) });
  }
  await startBookSession(created.book.id);
  await setRecoveryCodeFlash(created.recoveryCode);
  redirect("/recovery-code");
}

/** 口座導入前のデータを口座として取り込んで開く */
export async function importLegacyAction(formData: FormData) {
  const input = readNewBookForm(formData, "import");
  let created: ReturnType<typeof importLegacyData>;
  try {
    created = importLegacyData(input);
  } catch (e) {
    backHome({ form: "import", error: e instanceof Error ? e.message : String(e) });
  }
  await startBookSession(created.book.id);
  await setRecoveryCodeFlash(created.recoveryCode);
  redirect("/recovery-code");
}

/** パスワードを確認して口座を開く */
export async function openBookAction(formData: FormData) {
  const bookId = String(formData.get("bookId") || "");
  const password = String(formData.get("password") || "");
  if (!verifyBookPassword(bookId, password)) {
    backHome({ book: bookId, error: "パスワードが違います。" });
  }
  await startBookSession(bookId);
  redirect("/dashboard");
}

/** 口座を閉じてホーム(口座選択画面)に戻る */
export async function closeBookAction() {
  await endBookSession();
  redirect("/");
}

/** リカバリーコードを控えたことを確認して、口座のダッシュボードへ進む */
export async function confirmRecoveryCodeSavedAction() {
  await clearRecoveryCodeFlash();
  redirect("/dashboard");
}

/** リカバリーコードでパスワードを再設定して口座を開く */
export async function resetPasswordAction(formData: FormData) {
  const bookId = String(formData.get("bookId") || "");
  const code = String(formData.get("recoveryCode") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("passwordConfirm") || "");
  function back(error: string): never {
    redirect(`/reset-password?${new URLSearchParams({ book: bookId, error })}`);
  }

  if (password !== confirm) back("確認用のパスワードが一致しません。");
  let newCode: string;
  try {
    newCode = resetPasswordWithRecoveryCode(bookId, code, password);
  } catch (e) {
    back(e instanceof Error ? e.message : String(e));
  }
  await startBookSession(bookId);
  await setRecoveryCodeFlash(newCode);
  redirect("/recovery-code");
}

function backToBookSettings(params: Record<string, string>): never {
  redirect(`/settings/book?${new URLSearchParams(params)}`);
}

/** 開いている口座のパスワードを変更する */
export async function changePasswordAction(formData: FormData) {
  const book = await requireCurrentBook();
  const current = String(formData.get("currentPassword") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("passwordConfirm") || "");
  if (password !== confirm) {
    backToBookSettings({ form: "password", error: "確認用のパスワードが一致しません。" });
  }
  try {
    changeBookPassword(book.id, current, password);
  } catch (e) {
    backToBookSettings({ form: "password", error: e instanceof Error ? e.message : String(e) });
  }
  backToBookSettings({ form: "password", done: "パスワードを変更しました。" });
}

/** 開いている口座のリカバリーコードを発行し直す */
export async function reissueRecoveryCodeAction(formData: FormData) {
  const book = await requireCurrentBook();
  let code: string;
  try {
    code = reissueRecoveryCode(book.id, String(formData.get("currentPassword") || ""));
  } catch (e) {
    backToBookSettings({ form: "recovery", error: e instanceof Error ? e.message : String(e) });
  }
  await setRecoveryCodeFlash(code);
  redirect("/recovery-code");
}
