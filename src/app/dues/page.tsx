import {
  listDuesItems,
  createDuesItem,
  updateDuesItem,
  deleteDuesItem,
  listDuesRecords,
  generateMonthlyDues,
  deleteDuesRecord,
} from "@/server/actions/dues";
import { listCategories } from "@/server/actions/categories";
import { currentYearMonth } from "@/lib/period";
import { yen, formatDate } from "@/lib/format";
import {
  Card,
  PageHeader,
  inputClass,
  buttonClass,
  dangerButtonClass,
  secondaryButtonClass,
} from "@/components/ui";

async function createDuesItemAction(formData: FormData) {
  "use server";
  await createDuesItem({
    name: String(formData.get("name") || ""),
    amount: Number(formData.get("amount") || 0),
    categoryId: String(formData.get("categoryId") || "") || undefined,
  });
}

async function updateDuesItemAction(formData: FormData) {
  "use server";
  await updateDuesItem(String(formData.get("id")), {
    name: String(formData.get("name") || ""),
    amount: Number(formData.get("amount") || 0),
    categoryId: String(formData.get("categoryId") || "") || undefined,
    isActive: formData.get("isActive") === "on",
  });
}

async function deleteDuesItemAction(formData: FormData) {
  "use server";
  await deleteDuesItem(String(formData.get("id")));
}

async function generateMonthlyDuesAction(formData: FormData) {
  "use server";
  await generateMonthlyDues(String(formData.get("yearMonth")));
}

async function deleteDuesRecordAction(formData: FormData) {
  "use server";
  await deleteDuesRecord(String(formData.get("id")));
}

export default async function DuesPage() {
  const [items, incomeCategories, records] = await Promise.all([
    listDuesItems(),
    listCategories("INCOME"),
    listDuesRecords(),
  ]);

  const totalMonthly = items
    .filter((i) => i.isActive)
    .reduce((s, i) => s + i.amount, 0);

  const yearMonth = currentYearMonth();

  const recordsByMonth = records.reduce<Record<string, typeof records>>((acc, r) => {
    (acc[r.yearMonth] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="部費"
        description="部費の内訳項目を管理し、月ごとに全部員へ自動計上します。"
      />

      <Card title="内訳項目を追加" className="mb-6">
        <form action={createDuesItemAction} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">項目名</label>
            <input name="name" required className={inputClass} placeholder="例: 施設費" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額(円)</label>
            <input name="amount" type="number" min={0} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">カテゴリ</label>
            <select name="categoryId" className={inputClass} defaultValue="">
              <option value="">未分類</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              追加
            </button>
          </div>
        </form>
      </Card>

      <Card title={`内訳項目一覧(合計 ${yen(totalMonthly)} / 月・部員あたり)`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">項目名</th>
                <th className="py-2 pr-4">金額</th>
                <th className="py-2 pr-4">カテゴリ</th>
                <th className="py-2 pr-4">有効</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td colSpan={5} className="py-2">
                    <form
                      action={updateDuesItemAction}
                      className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <input name="name" defaultValue={item.name} className={inputClass} />
                      <input
                        name="amount"
                        type="number"
                        min={0}
                        defaultValue={item.amount}
                        className={inputClass}
                      />
                      <select name="categoryId" defaultValue={item.categoryId ?? ""} className={inputClass}>
                        <option value="">未分類</option>
                        {incomeCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={item.isActive}
                        />
                        有効
                      </label>
                      <button type="submit" className={secondaryButtonClass}>
                        更新
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    内訳項目がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <form key={item.id} action={deleteDuesItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className={dangerButtonClass}>
                {item.name} を削除
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="月次計上を実行" className="mb-6">
        <form action={generateMonthlyDuesAction} className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">対象月</label>
            <input
              type="month"
              name="yearMonth"
              defaultValue={yearMonth}
              required
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            有効な内訳項目で全部員に計上する
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          退部・?タイプの部員は自動で対象外になります。既に計上済みの部員はスキップされます。
        </p>
      </Card>

      <Card title="計上履歴">
        {Object.keys(recordsByMonth).length === 0 ? (
          <p className="text-sm text-gray-500">計上履歴がありません。</p>
        ) : (
          Object.entries(recordsByMonth).map(([ym, rs]) => (
            <div key={ym} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{ym}</h3>
              <table className="w-full text-sm mb-2">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-1 pr-4">部員</th>
                    <th className="py-1 pr-4">計上日</th>
                    <th className="py-1 pr-4 text-right">金額</th>
                    <th className="py-1 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-1 pr-4">{r.member.name}</td>
                      <td className="py-1 pr-4 text-gray-500">{formatDate(r.createdAt)}</td>
                      <td className="py-1 pr-4 text-right">{yen(r.totalAmount)}</td>
                      <td className="py-1 pr-4">
                        <form action={deleteDuesRecordAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className={dangerButtonClass}>
                            取消
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
