import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getVirtualAccountBalances,
  createVirtualAccount,
  updateVirtualAccount,
  createVirtualAccountTransfer,
  deleteVirtualAccountTransfer,
} from "@/server/actions/accounts";
import { prisma } from "@/lib/prisma";
import { yen, formatDate, toDateInputValue } from "@/lib/format";
import {
  Card,
  PageHeader,
  StatTile,
  inputClass,
  buttonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from "@/components/ui";

async function createAccountAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const exists = await prisma.virtualAccount.findUnique({ where: { name } });
  if (exists) {
    redirect(`/accounts?error=${encodeURIComponent(`「${name}」は既に存在します。`)}`);
  }
  await createVirtualAccount({
    name,
    note: String(formData.get("note") || ""),
  });
}

async function updateAccountAction(formData: FormData) {
  "use server";
  await updateVirtualAccount(String(formData.get("id")), {
    name: String(formData.get("name") || ""),
    note: String(formData.get("note") || ""),
    isActive: formData.get("isActive") === "on",
  });
}

async function createTransferAction(formData: FormData) {
  "use server";
  const fromAccountId = String(formData.get("fromAccountId") || "");
  const toAccountId = String(formData.get("toAccountId") || "");
  if (fromAccountId === toAccountId) {
    redirect(`/accounts?error=${encodeURIComponent("振替元と振替先には別の仮想口座を選んでください。")}`);
  }
  await createVirtualAccountTransfer({
    date: new Date(String(formData.get("date"))),
    amount: Number(formData.get("amount") || 0),
    fromAccountId,
    toAccountId,
    description: String(formData.get("description") || ""),
  });
}

async function deleteTransferAction(formData: FormData) {
  "use server";
  await deleteVirtualAccountTransfer(String(formData.get("id")));
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [{ accounts, unassigned }, transfers] = await Promise.all([
    getVirtualAccountBalances(),
    prisma.virtualAccountTransfer.findMany({
      include: { fromAccount: true, toAccount: true },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  const activeAccounts = accounts.filter((a) => a.isActive);
  const total = accounts.reduce((s, a) => s + a.balance, 0) + unassigned;
  const today = toDateInputValue(new Date());

  return (
    <div>
      <PageHeader
        title="仮想口座"
        description="実際のお金は一つの口座にありますが、「部」「寄付」「イヤーブック」のように用途ごとに分けて管理します。各仮想口座の残高はマイナスになることもあります。"
      />

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="実際の残高(全仮想口座の合計)"
          value={yen(total)}
          tone={total < 0 ? "negative" : "default"}
        />
        {accounts.map((a) => (
          <StatTile
            key={a.id}
            label={`${a.name}${a.isActive ? "" : "(無効)"}`}
            value={yen(a.balance)}
            tone={a.balance < 0 ? "negative" : "default"}
          />
        ))}
        {unassigned !== 0 && (
          <StatTile
            label="未割当の入出金"
            value={yen(unassigned)}
            tone={unassigned < 0 ? "negative" : "default"}
          />
        )}
      </div>

      <Card title="仮想口座一覧" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">名前</th>
                <th className="py-2 pr-4 text-right">収入</th>
                <th className="py-2 pr-4 text-right">支出</th>
                <th className="py-2 pr-4 text-right">振替(入 − 出)</th>
                <th className="py-2 pr-4 text-right">残高</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">
                    <Link href={`/accounts/${a.id}`} className="text-blue-600 hover:underline">
                      {a.name}
                    </Link>
                    {!a.isActive && <span className="ml-1 text-xs text-gray-400">(無効)</span>}
                  </td>
                  <td className="py-2 pr-4 text-right text-emerald-600">{yen(a.income)}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{yen(a.expense)}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">
                    {yen(a.transferIn - a.transferOut)}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-semibold ${
                      a.balance < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {yen(a.balance)}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    仮想口座がありません。下のフォームから追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="仮想口座を追加">
          <form action={createAccountAction} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">名前</label>
              <input name="name" required className={inputClass} placeholder="例: イヤーブック" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">メモ</label>
              <input name="note" className={inputClass} placeholder="任意" />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                追加
              </button>
            </div>
          </form>
        </Card>

        <Card title="仮想口座間の振替">
          {activeAccounts.length < 2 ? (
            <p className="text-sm text-gray-500">
              振替には有効な仮想口座が2つ以上必要です。
            </p>
          ) : (
            <form action={createTransferAction} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">振替元</label>
                <select name="fromAccountId" className={inputClass} defaultValue={activeAccounts[0].id}>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">振替先</label>
                <select name="toAccountId" className={inputClass} defaultValue={activeAccounts[1].id}>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">日付</label>
                <input type="date" name="date" defaultValue={today} required className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">金額(円)</label>
                <input name="amount" type="number" min={1} required className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">説明</label>
                <input name="description" className={inputClass} placeholder="例: 寄付金を遠征費に充当" />
              </div>
              <div>
                <button type="submit" className={buttonClass}>
                  振替を記録
                </button>
              </div>
            </form>
          )}
          <p className="text-xs text-gray-500 mt-2">
            振替は区分を移すだけで、実際の残高合計は変わりません。
          </p>
        </Card>
      </div>

      <Card title="仮想口座の編集" className="mb-6">
        <div className="space-y-2">
          {accounts.map((a) => (
            <form
              key={a.id}
              action={updateAccountAction}
              className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center"
            >
              <input type="hidden" name="id" value={a.id} />
              <input name="name" defaultValue={a.name} required className={inputClass} />
              <input
                name="note"
                defaultValue={a.note ?? ""}
                placeholder="メモ"
                className={`${inputClass} md:col-span-3`}
              />
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" name="isActive" defaultChecked={a.isActive} />
                有効
              </label>
              <button type="submit" className={secondaryButtonClass}>
                更新
              </button>
            </form>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          無効にした仮想口座は、入出金・振替の入力候補に表示されなくなります(残高と履歴は残ります)。記録のない仮想口座は詳細ページから削除できます。
        </p>
      </Card>

      <Card title="振替履歴(直近30件)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">日付</th>
                <th className="py-2 pr-4">振替元 → 振替先</th>
                <th className="py-2 pr-4">説明</th>
                <th className="py-2 pr-4 text-right">金額</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{formatDate(t.date)}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {t.fromAccount.name} → {t.toAccount.name}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{t.description}</td>
                  <td className="py-2 pr-4 text-right">{yen(t.amount)}</td>
                  <td className="py-2 pr-4">
                    <form action={deleteTransferAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className={dangerButtonClass}>
                        削除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    振替の記録はありません。
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
