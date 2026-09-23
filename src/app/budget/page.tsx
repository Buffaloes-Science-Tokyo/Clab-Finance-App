import {
  getClubSetting,
  updateClubSetting,
  listBudgets,
  upsertBudget,
  deleteBudget,
  calculateOptimalDues,
} from "@/server/actions/budget";
import { listCategories } from "@/server/actions/categories";
import type { BudgetPeriodType } from "@prisma/client";
import { currentYearMonth, currentQuarter, currentYear, periodLabel } from "@/lib/period";
import { BUDGET_PERIOD_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { yen } from "@/lib/format";
import {
  Card,
  PageHeader,
  StatTile,
  inputClass,
  buttonClass,
  secondaryButtonClass,
  dangerButtonClass,
} from "@/components/ui";

async function updateSettingAction(formData: FormData) {
  "use server";
  await updateClubSetting({
    poolFundTarget: Number(formData.get("poolFundTarget") || 0),
    roundTo: Number(formData.get("roundTo") || 100),
  });
}

async function upsertBudgetAction(formData: FormData) {
  "use server";
  await upsertBudget({
    periodType: formData.get("periodType") as BudgetPeriodType,
    period: String(formData.get("period")),
    categoryId: String(formData.get("categoryId")),
    plannedAmount: Number(formData.get("plannedAmount") || 0),
    note: String(formData.get("note") || ""),
  });
}

async function deleteBudgetAction(formData: FormData) {
  "use server";
  await deleteBudget(String(formData.get("budgetId")));
}

const PERIOD_PATTERNS: Record<BudgetPeriodType, RegExp> = {
  MONTH: /^\d{4}-(0[1-9]|1[0-2])$/,
  QUARTER: /^\d{4}-Q[1-4]$/,
  YEAR: /^\d{4}$/,
};

function defaultPeriod(periodType: BudgetPeriodType) {
  switch (periodType) {
    case "MONTH":
      return currentYearMonth();
    case "QUARTER":
      return currentQuarter();
    case "YEAR":
      return currentYear();
  }
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ periodType?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const periodType: BudgetPeriodType =
    sp.periodType && sp.periodType in PERIOD_PATTERNS
      ? (sp.periodType as BudgetPeriodType)
      : "MONTH";
  const period =
    sp.period && PERIOD_PATTERNS[periodType].test(sp.period)
      ? sp.period
      : defaultPeriod(periodType);

  const [setting, categories, budgets, optimal] = await Promise.all([
    getClubSetting(),
    listCategories(),
    listBudgets(periodType, period),
    calculateOptimalDues({ periodType, period }),
  ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

  return (
    <div>
      <PageHeader
        title="予算・部費計算"
        description="期間ごとの予算を設定し、プール金(目標準備金)を考慮した最適な部費を自動計算します。"
      />

      <Card title="プール金・丸め単位の設定" className="mb-6">
        <form action={updateSettingAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">プール金目標額(円)</label>
            <input
              name="poolFundTarget"
              type="number"
              min={0}
              defaultValue={setting.poolFundTarget}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">部費の丸め単位(円)</label>
            <input
              name="roundTo"
              type="number"
              min={1}
              defaultValue={setting.roundTo}
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            保存
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          プール金目標額は、いつでも維持しておきたいクラブの最低残高です。部費計算時に、現在残高がこの目標を下回っていれば不足分を上乗せして算出します。
        </p>
      </Card>

      <Card title="対象期間の選択" className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">期間の種類</label>
            <select name="periodType" defaultValue={periodType} className={inputClass}>
              {(Object.keys(BUDGET_PERIOD_TYPE_LABELS) as BudgetPeriodType[]).map((k) => (
                <option key={k} value={k}>
                  {BUDGET_PERIOD_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              期間 (月:YYYY-MM / 四半期:YYYY-Q1〜4 / 年:YYYY)
            </label>
            <input name="period" defaultValue={period} className={inputClass} />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            表示
          </button>
        </form>
      </Card>

      <Card title={`予算 - ${periodLabel(periodType, period)}`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">区分</th>
                <th className="py-2 pr-4">カテゴリ</th>
                <th className="py-2 pr-4">予算額</th>
                <th className="py-2 pr-4">備考</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const b = budgetByCategory.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-600">{TRANSACTION_TYPE_LABELS[c.type]}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.name}</td>
                    <td colSpan={3} className="py-2">
                      <form
                        action={upsertBudgetAction}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="periodType" value={periodType} />
                        <input type="hidden" name="period" value={period} />
                        <input type="hidden" name="categoryId" value={c.id} />
                        <input
                          name="plannedAmount"
                          type="number"
                          min={0}
                          defaultValue={b?.plannedAmount ?? 0}
                          className={`${inputClass} w-32`}
                        />
                        <input
                          name="note"
                          defaultValue={b?.note ?? ""}
                          placeholder="備考"
                          className={`${inputClass} w-48`}
                        />
                        <button type="submit" className={secondaryButtonClass}>
                          保存
                        </button>
                        {b && (
                          <>
                            <input type="hidden" name="budgetId" value={b.id} />
                            <button
                              type="submit"
                              formAction={deleteBudgetAction}
                              formNoValidate
                              className={dangerButtonClass}
                            >
                              削除
                            </button>
                          </>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    カテゴリが登録されていません。「カテゴリ設定」から追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="最適な部費の自動計算">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatTile label="支出予算合計" value={yen(optimal.plannedExpenseTotal)} />
          <StatTile label="部費以外の収入予算" value={yen(optimal.otherPlannedIncomeTotal)} />
          <StatTile label="期首時点のクラブ残高" value={yen(optimal.currentClubBalance)} />
          <StatTile
            label="プール金不足額"
            value={yen(Math.max(0, optimal.poolFundShortfall))}
            tone={optimal.poolFundShortfall > 0 ? "negative" : "positive"}
          />
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            対象部員数 {optimal.memberCount}名 ・ 部費で賄う必要がある金額 {yen(optimal.neededFromDues)}
          </p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            一人あたり {yen(optimal.perMemberDues)} / {BUDGET_PERIOD_TYPE_LABELS[periodType]}
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          計算式: (支出予算 − 部費以外の収入予算 + プール金目標との差額) ÷ 対象部員数 を、設定した丸め単位で切り上げ。
        </p>
      </Card>
    </div>
  );
}
