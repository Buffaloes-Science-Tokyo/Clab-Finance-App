import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getVirtualAccount, deleteVirtualAccount } from "@/server/actions/accounts";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { yen, formatDate } from "@/lib/format";
import { Card, PageHeader, StatTile, dangerButtonClass } from "@/components/ui";

type HistoryRow = {
  key: string;
  date: Date;
  kind: string;
  detail: string;
  description: string | null;
  amount: number; // この仮想口座への影響(+ で増加、− で減少)
  balance: number;
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getVirtualAccount(id);
  if (!account) notFound();

  async function deleteAccountAction() {
    "use server";
    await deleteVirtualAccount(id);
    redirect("/accounts");
  }

  const rows: Omit<HistoryRow, "balance">[] = [
    ...account.transactions.map((t) => ({
      key: `tx-${t.id}`,
      date: t.date,
      kind: TRANSACTION_TYPE_LABELS[t.type],
      detail: [t.category?.name ?? "未分類", t.member?.name].filter(Boolean).join(" ・ "),
      description: t.description,
      amount: t.type === "INCOME" ? t.amount : -t.amount,
    })),
    ...account.transfersIn.map((t) => ({
      key: `in-${t.id}`,
      date: t.date,
      kind: "振替(入)",
      detail: `${t.fromAccount.name} から`,
      description: t.description,
      amount: t.amount,
    })),
    ...account.transfersOut.map((t) => ({
      key: `out-${t.id}`,
      date: t.date,
      kind: "振替(出)",
      detail: `${t.toAccount.name} へ`,
      description: t.description,
      amount: -t.amount,
    })),
  ];

  // 古い順に残高を積み上げ、表示は新しい順にする
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  const history: HistoryRow[] = rows.map((r) => {
    running += r.amount;
    return { ...r, balance: running };
  });
  history.reverse();

  const balance = running;
  const income = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const outflow = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const canDelete = rows.length === 0;

  return (
    <div>
      <Link href="/accounts" className="text-sm text-blue-600 hover:underline">
        ← 仮想口座一覧
      </Link>
      <div className="mt-2">
        <PageHeader
          title={`仮想口座: ${account.name}${account.isActive ? "" : "(無効)"}`}
          description={account.note ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatTile label="残高" value={yen(balance)} tone={balance < 0 ? "negative" : "default"} />
        <StatTile label="増加合計(収入・振替入)" value={yen(income)} tone="positive" />
        <StatTile label="減少合計(支出・振替出)" value={yen(outflow)} tone="negative" />
      </div>

      <Card title={`履歴 (${history.length}件)`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">日付</th>
                <th className="py-2 pr-4">種別</th>
                <th className="py-2 pr-4">内容</th>
                <th className="py-2 pr-4">説明</th>
                <th className="py-2 pr-4 text-right">金額</th>
                <th className="py-2 pr-4 text-right">残高</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.key} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{formatDate(r.date)}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.kind}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.detail}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.description}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      r.amount >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {r.amount >= 0 ? "+" : "-"}
                    {yen(Math.abs(r.amount))}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right ${
                      r.balance < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {yen(r.balance)}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    記録がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canDelete && (
        <form action={deleteAccountAction}>
          <button type="submit" className={dangerButtonClass}>
            この仮想口座を削除
          </button>
        </form>
      )}
    </div>
  );
}
