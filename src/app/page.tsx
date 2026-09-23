import Link from "next/link";
import { listBooks, hasLegacyData, MIN_PASSWORD_LENGTH } from "@/server/books";
import { getCurrentBook } from "@/server/session";
import {
  createBookAction,
  importLegacyAction,
  openBookAction,
} from "@/server/actions/books";
import { Card, inputClass, buttonClass, secondaryButtonClass } from "@/components/ui";

function NewBookFields({ namePlaceholder }: { namePlaceholder: string }) {
  return (
    <>
      <div>
        <label className="block text-xs text-gray-500 mb-1">口座名</label>
        <input name="name" required className={inputClass} placeholder={namePlaceholder} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          パスワード({MIN_PASSWORD_LENGTH}文字以上)
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
        <label className="block text-xs text-gray-500 mb-1">パスワード(確認)</label>
        <input
          name="passwordConfirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; book?: string; form?: string }>;
}) {
  const sp = await searchParams;
  const [books, current] = [listBooks(), await getCurrentBook()];
  const showLegacyImport = hasLegacyData();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">部活会計</h1>
      <p className="text-sm text-gray-500 mt-1 mb-8">
        使用する口座を選んでください。口座ごとにデータは別々に保存されます。
      </p>

      <Card title="口座を選択" className="mb-6">
        {books.length === 0 ? (
          <p className="text-sm text-gray-500">口座がありません。下から追加してください。</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {books.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-40">
                    <p className="font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-400">
                      作成日 {new Date(b.createdAt).toLocaleDateString("ja-JP")}
                      {b.neonUrl ? " ・ Neon同期あり" : ""}
                    </p>
                  </div>
                  {current?.id === b.id ? (
                    <Link href="/dashboard" className={buttonClass}>
                      続ける
                    </Link>
                  ) : (
                    <form action={openBookAction} className="flex items-center gap-2">
                      <input type="hidden" name="bookId" value={b.id} />
                      <input
                        name="password"
                        type="password"
                        required
                        placeholder="パスワード"
                        autoComplete="current-password"
                        aria-label={`${b.name} のパスワード`}
                        className={`${inputClass} w-40`}
                      />
                      <button type="submit" className={buttonClass}>
                        開く
                      </button>
                    </form>
                  )}
                </div>
                {sp.error && sp.book === b.id && (
                  <p className="mt-1 text-sm text-red-600">{sp.error}</p>
                )}
                {current?.id !== b.id && (
                  <Link
                    href={`/reset-password?book=${b.id}`}
                    className="mt-1 inline-block text-xs text-gray-500 hover:text-blue-600 hover:underline"
                  >
                    パスワードを忘れた場合
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="口座を追加" className="mb-6">
        <form action={createBookAction} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <NewBookFields namePlaceholder="例: 〇〇部 2026年度" />
          <div className="md:col-span-3">
            <button type="submit" className={buttonClass}>
              追加して開く
            </button>
          </div>
        </form>
        {sp.error && sp.form === "create" && <p className="mt-2 text-sm text-red-600">{sp.error}</p>}
        <p className="text-xs text-gray-500 mt-3">
          口座を開くときにこのパスワードが必要です。追加するとパスワードを忘れたとき用のリカバリーコードが表示されるので、控えておいてください。
        </p>
      </Card>

      {showLegacyImport && (
        <Card title="既存のデータを口座として取り込む">
          <p className="text-sm text-gray-600 mb-3">
            口座機能の導入前に入力したデータがあります。名前とパスワードを付けて口座にできます(Neonの同期設定も引き継ぎます)。
          </p>
          <form action={importLegacyAction} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <NewBookFields namePlaceholder="例: 〇〇部" />
            <div className="md:col-span-3">
              <button type="submit" className={secondaryButtonClass}>
                取り込んで開く
              </button>
            </div>
          </form>
          {sp.error && sp.form === "import" && (
            <p className="mt-2 text-sm text-red-600">{sp.error}</p>
          )}
        </Card>
      )}
    </div>
  );
}
