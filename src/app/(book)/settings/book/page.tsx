import { requireCurrentBook } from "@/server/session";
import { MIN_PASSWORD_LENGTH } from "@/server/books";
import { changePasswordAction, reissueRecoveryCodeAction } from "@/server/actions/books";
import { Card, PageHeader, inputClass, buttonClass, secondaryButtonClass } from "@/components/ui";

function Message({ sp, form }: { sp: { form?: string; error?: string; done?: string }; form: string }) {
  if (sp.form !== form) return null;
  if (sp.error) return <p className="text-sm text-red-600">{sp.error}</p>;
  if (sp.done) return <p className="text-sm text-emerald-600">{sp.done}</p>;
  return null;
}

export default async function BookSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; error?: string; done?: string }>;
}) {
  const [book, sp] = [await requireCurrentBook(), await searchParams];

  return (
    <div>
      <PageHeader title="口座設定" description={`口座「${book.name}」のパスワードとリカバリーコードを管理します。`} />

      <Card title="パスワードを変更" className="mb-6">
        <form action={changePasswordAction} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">現在のパスワード</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              新しいパスワード({MIN_PASSWORD_LENGTH}文字以上)
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">新しいパスワード(確認)</label>
            <input
              name="passwordConfirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-3">
            <button type="submit" className={buttonClass}>
              変更
            </button>
            <Message sp={sp} form="password" />
          </div>
        </form>
      </Card>

      <Card title="リカバリーコード">
        <p className="text-sm text-gray-700 mb-3">
          {book.hasRecoveryCode ? (
            "発行済みです。控えを無くした場合は発行し直してください(以前のコードは無効になります)。"
          ) : (
            <span className="text-amber-700">
              まだ発行されていません。パスワードを忘れたときに備えて発行してください。
            </span>
          )}
        </p>
        <form action={reissueRecoveryCodeAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">現在のパスワード</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <button type="submit" className={book.hasRecoveryCode ? secondaryButtonClass : buttonClass}>
            {book.hasRecoveryCode ? "発行し直す" : "発行する"}
          </button>
          <Message sp={sp} form="recovery" />
        </form>
      </Card>
    </div>
  );
}
