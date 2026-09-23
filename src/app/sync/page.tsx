import { syncWithNeon, getSyncStatus } from "@/server/actions/sync";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader, StatTile, buttonClass } from "@/components/ui";

async function syncAction() {
  "use server";
  await syncWithNeon();
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP");
}

export default async function SyncPage() {
  const status = await getSyncStatus();
  const r = status.lastResult;

  return (
    <div>
      <PageHeader
        title="Neon同期"
        description="このアプリはオフラインでもローカルのデータベースで動作します。インターネットに接続できるときに同期すると、Neonを経由して他の端末と変更をやり取りします。"
      />

      {!status.configured && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Neonの接続先が設定されていません。<code>.env</code> に{" "}
          <code>NEON_DATABASE_URL=&quot;postgresql://...&quot;</code>{" "}
          を追加して、アプリを再起動してください。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatTile label="未送信の変更" value={`${status.pendingChanges}件`} />
        <StatTile
          label="最終同期"
          value={status.lastSyncAt ? formatDateTime(status.lastSyncAt) : "未実行"}
        />
        <StatTile
          label="前回の結果"
          value={r ? (r.ok ? "成功" : "失敗") : "-"}
          tone={r ? (r.ok ? "positive" : "negative") : "default"}
        />
      </div>

      <Card title="同期を実行" className="mb-6">
        <form action={syncAction}>
          <SubmitButton className={buttonClass} pendingLabel="同期中…">
            Neonと同期する
          </SubmitButton>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          ローカルの変更をNeonへ送り、他の端末の変更を取り込みます。同じ記録を複数の端末で編集していた場合は、後から編集した方が残ります(削除も同期されます)。
        </p>
      </Card>

      {r && (
        <Card title="前回の同期結果">
          {r.error ? (
            <p className="text-sm text-red-600">{r.error}</p>
          ) : (
            <ul className="text-sm text-gray-700 space-y-1">
              <li>送信した変更: {r.pushed}件</li>
              {r.pushRejected > 0 && (
                <li>Neon側の方が新しかったため送信しなかった変更: {r.pushRejected}件</li>
              )}
              <li>
                受信した変更: {r.pulled}件(反映 {r.applied}件)
              </li>
              {r.localWins > 0 && (
                <li>こちらの未送信の変更の方が新しかったため反映しなかった変更: {r.localWins}件</li>
              )}
            </ul>
          )}
          {r.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">
                取り込めなかった変更: {r.errors.length}件
              </p>
              <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                {r.errors.slice(0, 20).map((e) => (
                  <li key={`${e.model}-${e.id}`}>
                    {e.model} ({e.id}): {e.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-gray-500">
                「UNIQUE constraint failed」は、別々の端末で同じ名前のカテゴリや仮想口座などを作成した場合に起こります。どちらか一方を削除または名前変更してから再度同期すると、改めて取り込まれます。
              </p>
            </div>
          )}
          {r.foreignKeyIssues > 0 && (
            <p className="mt-3 text-xs text-amber-700">
              参照先が見つからない記録が {r.foreignKeyIssues}{" "}
              件あります。他の端末の同期が途中の可能性があります。しばらくしてから再度同期してください。
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            {formatDateTime(r.finishedAt)} ・ 端末ID {status.deviceId?.slice(0, 8)}
          </p>
        </Card>
      )}

      <Card title="注意事項" className="mt-6">
        <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
          <li>レシートの画像ファイルは同期されません(添付の記録のみ同期されます)。</li>
          <li>
            「後から編集した方」は各端末の時計で判定します。端末の時刻が正しく設定されていることを確認してください。
          </li>
          <li>新しい端末で使い始めるときは、データを入力する前に一度同期してください。</li>
          <li>
            アプリを更新してデータベースの構造が変わったときは、全端末で同じバージョンに揃えてから同期してください。
          </li>
        </ul>
      </Card>
    </div>
  );
}
