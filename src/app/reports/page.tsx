import Link from "next/link";
import { getPeriodReport } from "@/server/reports";
import type { BudgetPeriodType } from "@prisma/client";
import { currentYearMonth, currentQuarter, currentYear } from "@/lib/period";
import { BUDGET_PERIOD_TYPE_LABELS, MEMBER_TYPE_LABELS } from "@/lib/constants";
import { yen } from "@/lib/format";
import { Card, PageHeader, StatTile, inputClass, secondaryButtonClass } from "@/components/ui";

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodType?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const periodType = (sp.periodType as BudgetPeriodType) || "MONTH";
  const period = sp.period || defaultPeriod(periodType);

  const report = await getPeriodReport(periodType, period);
  const pptxHref = `/api/reports/pptx?periodType=${periodType}&period=${encodeURIComponent(period)}`;

  return (
    <div>
      <PageHeader
        title="会計報告"
        description="月次・四半期・年次で報告を作成し、PowerPoint(PPTX)としてダウンロードできます。"
      />

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
          <Link
            href={pptxHref}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            PPTXでダウンロード
          </Link>
        </form>
      </Card>

      <PageHeader title={report.label} />

      <Card title="サマリー: 実際の入出金 と 発生ベース(ツケ計上含む)" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4">実際の入出金(現金ベース)</th>
                <th className="py-2 pr-4">発生ベース(ツケ計上含む)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 text-gray-600">収入</td>
                <td className="py-2 pr-4 text-emerald-600 font-medium">{yen(report.cash.income)}</td>
                <td className="py-2 pr-4 text-emerald-600 font-medium">{yen(report.accrual.income)}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 text-gray-600">支出</td>
                <td className="py-2 pr-4 text-red-600 font-medium">{yen(report.cash.expense)}</td>
                <td className="py-2 pr-4 text-red-600 font-medium">{yen(report.accrual.expense)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-gray-600 font-semibold">収支</td>
                <td className="py-2 pr-4 font-bold">{yen(report.cash.net)}</td>
                <td className="py-2 pr-4 font-bold">{yen(report.accrual.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatTile
            label="期間内の未収発生額(部費・ツケ)"
            value={yen(report.accrual.unbilledReceivables)}
          />
          <StatTile label="部員の未収残高合計" value={yen(report.outstandingBalanceEnd)} />
        </div>
      </Card>

      <Card title="仮想口座別 残高" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">仮想口座</th>
                <th className="py-2 pr-4 text-right">期首残高</th>
                <th className="py-2 pr-4 text-right">収入</th>
                <th className="py-2 pr-4 text-right">支出</th>
                <th className="py-2 pr-4 text-right">振替</th>
                <th className="py-2 pr-4 text-right">期末残高</th>
              </tr>
            </thead>
            <tbody>
              {report.virtualAccounts.map((a) => (
                <tr key={a.id ?? "unassigned"} className="border-b border-gray-50">
                  <td className="py-2 pr-4">
                    {a.id ? (
                      <Link href={`/accounts/${a.id}`} className="text-blue-600 hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="text-gray-600">{a.name}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">{yen(a.openingBalance)}</td>
                  <td className="py-2 pr-4 text-right text-emerald-600">{yen(a.income)}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{yen(a.expense)}</td>
                  <td className="py-2 pr-4 text-right text-gray-600">{yen(a.transferNet)}</td>
                  <td
                    className={`py-2 pr-4 text-right font-semibold ${
                      a.closingBalance < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {yen(a.closingBalance)}
                  </td>
                </tr>
              ))}
              {report.virtualAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    仮想口座の記録はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="カテゴリ別内訳(実際の入出金)" className="mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-4">区分</th>
              <th className="py-2 pr-4">カテゴリ</th>
              <th className="py-2 pr-4 text-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {report.cash.byCategory.map((c) => (
              <tr key={`${c.categoryId}-${c.type}`} className="border-b border-gray-50">
                <td className="py-2 pr-4 text-gray-600">
                  {c.type === "INCOME" ? "収入" : "支出"}
                </td>
                <td className="py-2 pr-4 text-gray-600">{c.name}</td>
                <td className="py-2 pr-4 text-right">{yen(c.amount)}</td>
              </tr>
            ))}
            {report.cash.byCategory.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-400">
                  この期間の記録はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="部員別 未収残高">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-4">氏名</th>
              <th className="py-2 pr-4">タイプ</th>
              <th className="py-2 pr-4 text-right">残高</th>
            </tr>
          </thead>
          <tbody>
            {report.memberBalances.map((m) => (
              <tr key={m.id} className="border-b border-gray-50">
                <td className="py-2 pr-4">
                  <Link href={`/members/${m.id}`} className="text-blue-600 hover:underline">
                    {m.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-gray-600">
                  {MEMBER_TYPE_LABELS[m.type as keyof typeof MEMBER_TYPE_LABELS]}
                </td>
                <td
                  className={`py-2 pr-4 text-right font-medium ${
                    m.balance > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {yen(m.balance)}
                </td>
              </tr>
            ))}
            {report.memberBalances.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-400">
                  未収残高のある部員はいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
