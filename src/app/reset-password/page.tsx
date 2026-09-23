import Link from "next/link";
import { getBook, MIN_PASSWORD_LENGTH } from "@/server/books";
import { resetPasswordAction } from "@/server/actions/books";
import { Card, inputClass, buttonClass } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const book = sp.book ? getBook(sp.book) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← 口座の選択に戻る
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">パスワードの再設定</h1>

      {!book ? (
        <p className="text-sm text-gray-600">口座が見つかりません。</p>
      ) : (
        <>
          {book.hasRecoveryCode ? (
            <Card title={`口座: ${book.name}`} className="mb-6">
              <form action={resetPasswordAction} className="space-y-3">
                <input type="hidden" name="bookId" value={book.id} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">リカバリーコード</label>
                  <input
                    name="recoveryCode"
                    required
                    autoComplete="off"
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    className={`${inputClass} font-mono`}
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
                {sp.error && <p className="text-sm text-red-600">{sp.error}</p>}
                <button type="submit" className={buttonClass}>
                  再設定して開く
                </button>
              </form>
            </Card>
          ) : (
            <Card title={`口座: ${book.name}`} className="mb-6">
              <p className="text-sm text-gray-700">
                この口座にはリカバリーコードが発行されていません。下の「最終手段」で再設定してください。
              </p>
            </Card>
          )}

          <Card title="リカバリーコードも分からない場合(最終手段)">
            <p className="text-sm text-gray-700">
              このアプリを動かしているPCで、プロジェクトのフォルダを開いて次のコマンドを実行すると、パスワードを再設定できます(新しいリカバリーコードも表示されます)。
            </p>
            <pre className="mt-3 rounded-md bg-gray-900 px-4 py-3 text-sm text-gray-100 overflow-x-auto">
              npm run book:reset-password
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              口座名と新しいパスワードを順に入力します。PCを操作できる人だけが実行できます。
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
