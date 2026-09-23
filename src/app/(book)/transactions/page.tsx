import Link from "next/link";
import {
  listTransactions,
  createTransaction,
  deleteTransaction,
} from "@/server/actions/transactions";
import { uploadReceipt } from "@/server/actions/receipts";
import { listCategories } from "@/server/actions/categories";
import { listMembers } from "@/server/actions/members";
import { listVirtualAccounts } from "@/server/actions/accounts";
import type { TransactionType } from "@prisma/client";
import { TRANSACTION_TYPE_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import { yen, formatDate } from "@/lib/format";
import {
  Card,
  PageHeader,
  inputClass,
  buttonClass,
  dangerButtonClass,
} from "@/components/ui";

async function createTransactionAction(formData: FormData) {
  "use server";
  const transaction = await createTransaction({
    date: new Date(String(formData.get("date"))),
    type: formData.get("type") as TransactionType,
    amount: Number(formData.get("amount") || 0),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    memberId: String(formData.get("memberId") || "") || undefined,
    description: String(formData.get("description") || ""),
    method: String(formData.get("method") || ""),
    virtualAccountId: String(formData.get("virtualAccountId") || "") || undefined,
    recordAsMemberPayment: formData.get("recordAsMemberPayment") === "on",
  });

  const file = formData.get("receipt") as File | null;
  if (file && file.size > 0) {
    await uploadReceipt({ file, transactionId: transaction.id });
  }
}

async function deleteTransactionAction(formData: FormData) {
  "use server";
  await deleteTransaction(String(formData.get("id")));
}

export default async function TransactionsPage() {
  const [transactions, categories, members, accounts] = await Promise.all([
    listTransactions(),
    listCategories(),
    listMembers(),
    listVirtualAccounts({ activeOnly: true }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="入出金記録"
        description="部の実際のお金の動きを記録します。入出金ごとに、どの仮想口座(部・寄付など)のお金かを選びます。部員への請求は「部員・未払い」ページで管理します。"
      />

      <Card title="記録を追加" className="mb-6">
        <form
          action={createTransactionAction}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付</label>
            <input
              type="date"
              name="date"
              defaultValue={today}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">区分</label>
            <select name="type" className={inputClass} defaultValue="EXPENSE">
              <option value="INCOME">{TRANSACTION_TYPE_LABELS.INCOME}</option>
              <option value="EXPENSE">{TRANSACTION_TYPE_LABELS.EXPENSE}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額(円)</label>
            <input name="amount" type="number" min={0} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">仮想口座</label>
            <select
              name="virtualAccountId"
              className={inputClass}
              defaultValue={accounts[0]?.id ?? ""}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">カテゴリ</label>
            <select name="categoryId" className={inputClass} defaultValue="">
              <option value="">未分類</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {TRANSACTION_TYPE_LABELS[c.type]} / {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">支払方法</label>
            <select name="method" className={inputClass} defaultValue="現金">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">関連する部員(任意)</label>
            <select name="memberId" className={inputClass} defaultValue="">
              <option value="">なし</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">説明</label>
            <input name="description" className={inputClass} placeholder="例: 練習試合 会場費" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">レシート添付</label>
            <input name="receipt" type="file" accept="image/*,application/pdf" className={inputClass} />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input type="checkbox" name="recordAsMemberPayment" id="recordAsMemberPayment" />
            <label htmlFor="recordAsMemberPayment" className="text-sm text-gray-600">
              この収入を、選択した部員の「支払い」として計上する(未払い残高を減らす)
            </label>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              追加
            </button>
          </div>
        </form>
      </Card>

      <Card title={`記録一覧 (${transactions.length}件)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">日付</th>
                <th className="py-2 pr-4">区分</th>
                <th className="py-2 pr-4">仮想口座</th>
                <th className="py-2 pr-4">カテゴリ</th>
                <th className="py-2 pr-4">部員</th>
                <th className="py-2 pr-4">説明</th>
                <th className="py-2 pr-4">レシート</th>
                <th className="py-2 pr-4 text-right">金額</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{formatDate(t.date)}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {TRANSACTION_TYPE_LABELS[t.type]}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {t.virtualAccount ? (
                      <Link
                        href={`/accounts/${t.virtualAccount.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {t.virtualAccount.name}
                      </Link>
                    ) : (
                      "未割当"
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{t.category?.name ?? "未分類"}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {t.member ? (
                      <Link href={`/members/${t.member.id}`} className="text-blue-600 hover:underline">
                        {t.member.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{t.description}</td>
                  <td className="py-2 pr-4">
                    {t.receipts.map((r) => (
                      <Link
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        className="text-blue-600 hover:underline text-xs block"
                      >
                        {r.fileName}
                      </Link>
                    ))}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      t.type === "INCOME" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "INCOME" ? "+" : "-"}
                    {yen(t.amount)}
                  </td>
                  <td className="py-2 pr-4">
                    <form action={deleteTransactionAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className={dangerButtonClass}>
                        削除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-400">
                    記録がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
