import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/server/actions/categories";
import type { TransactionType } from "@prisma/client";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import {
  Card,
  PageHeader,
  inputClass,
  buttonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from "@/components/ui";

async function createCategoryAction(formData: FormData) {
  "use server";
  await createCategory({
    name: String(formData.get("name") || ""),
    type: formData.get("type") as TransactionType,
  });
}

async function updateCategoryAction(formData: FormData) {
  "use server";
  await updateCategory(String(formData.get("id")), {
    name: String(formData.get("name") || ""),
    type: formData.get("type") as TransactionType,
    isActive: formData.get("isActive") === "on",
  });
}

async function deleteCategoryAction(formData: FormData) {
  "use server";
  await deleteCategory(String(formData.get("id")));
}

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div>
      <PageHeader
        title="カテゴリ設定"
        description="収入・支出のカテゴリを管理します。入出金記録・予算・部費内訳で共通して使用されます。"
      />

      <Card title="カテゴリを追加" className="mb-6">
        <form action={createCategoryAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">名称</label>
            <input name="name" required className={inputClass} placeholder="例: 部費" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">区分</label>
            <select name="type" className={inputClass} defaultValue="INCOME">
              <option value="INCOME">{TRANSACTION_TYPE_LABELS.INCOME}</option>
              <option value="EXPENSE">{TRANSACTION_TYPE_LABELS.EXPENSE}</option>
            </select>
          </div>
          <button type="submit" className={buttonClass}>
            追加
          </button>
        </form>
      </Card>

      <Card title="カテゴリ一覧">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-4">名称</th>
              <th className="py-2 pr-4">区分</th>
              <th className="py-2 pr-4">有効</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-50">
                <td colSpan={4} className="py-2">
                  <div className="flex items-center gap-2">
                    <form
                      action={updateCategoryAction}
                      className="flex flex-1 flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input name="name" defaultValue={c.name} className={`${inputClass} w-40`} />
                      <select name="type" defaultValue={c.type} className={inputClass}>
                        <option value="INCOME">{TRANSACTION_TYPE_LABELS.INCOME}</option>
                        <option value="EXPENSE">{TRANSACTION_TYPE_LABELS.EXPENSE}</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input type="checkbox" name="isActive" defaultChecked={c.isActive} />
                        有効
                      </label>
                      <button type="submit" className={secondaryButtonClass}>
                        更新
                      </button>
                    </form>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={dangerButtonClass}>
                        削除
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400">
                  カテゴリが登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
