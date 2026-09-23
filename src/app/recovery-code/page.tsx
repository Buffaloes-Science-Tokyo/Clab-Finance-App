import { redirect } from "next/navigation";
import { readRecoveryCodeFlash, requireCurrentBook } from "@/server/session";
import { confirmRecoveryCodeSavedAction } from "@/server/actions/books";
import { Card, buttonClass } from "@/components/ui";

/** 発行したリカバリーコードを一度だけ表示する */
export default async function RecoveryCodePage() {
  const book = await requireCurrentBook();
  const code = await readRecoveryCodeFlash();
  if (!code) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card title={`リカバリーコード(口座: ${book.name})`}>
        <p className="text-sm text-gray-700">
          パスワードを忘れたときは、このコードで新しいパスワードを設定できます。
          <strong>このコードは今しか表示されません。</strong>
          紙に書く、パスワード管理アプリに保存するなどして、安全な場所に控えてください。
        </p>
        <p className="my-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-4 text-center font-mono text-xl tracking-wider text-gray-900 select-all break-all">
          {code}
        </p>
        <ul className="list-disc pl-5 text-xs text-gray-500 space-y-1 mb-5">
          <li>コードを使ってパスワードを再設定すると、新しいコードが発行されます(使ったコードは無効になります)。</li>
          <li>コードは「口座設定」からいつでも発行し直せます(以前のコードは無効になります)。</li>
        </ul>
        <form action={confirmRecoveryCodeSavedAction}>
          <button type="submit" className={buttonClass}>
            控えました。口座を開く
          </button>
        </form>
      </Card>
    </div>
  );
}
