import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getClubBalanceAsOf } from "@/server/actions/budget";
import { getVirtualAccountBalances } from "@/server/actions/accounts";
import { getPeriodReport } from "@/server/reports";
import { currentYearMonth } from "@/lib/period";
import { yen, formatDate } from "@/lib/format";
import { Card, StatTile, PageHeader } from "@/components/ui";
import { MEMBER_TYPE_LABELS } from "@/lib/constants";

export default async function DashboardPage() {
  const yearMonth = currentYearMonth();
  const [clubBalance, report, recentTransactions, virtualAccounts] = await Promise.all([
    getClubBalanceAsOf(new Date()),
    getPeriodReport("MONTH", yearMonth),
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 8,
      include: { category: true, member: true, virtualAccount: true },
    }),
    getVirtualAccountBalances(),
  ]);

  const topDebtors = report.memberBalances.filter((m) => m.balance > 0).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        description={`${report.label}時点のサマリー`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="現在のクラブ残高(現金)" value={yen(clubBalance)} />
        <StatTile
          label="今月の収入(現金)"
          value={yen(report.cash.income)}
          tone="positive"
        />
        <StatTile
          label="今月の支出(現金)"
          value={yen(report.cash.expense)}
          tone="negative"
        />
        <StatTile
          label="部員の未収残高合計"
          value={yen(report.outstandingBalanceEnd)}
        />
      </div>

      <Card title="仮想口座別 残高" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {virtualAccounts.accounts
            .filter((a) => a.isActive || a.balance !== 0)
            .map((a) => (
              <Link
                key={a.id}
                href={`/accounts/${a.id}`}
                className="rounded-md border border-gray-100 px-3 py-2 hover:bg-gray-50"
              >
                <p className="text-xs text-gray-500">{a.name}</p>
                <p
                  className={`text-lg font-semibold ${
                    a.balance < 0 ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {yen(a.balance)}
                </p>
              </Link>
            ))}
          {virtualAccounts.unassigned !== 0 && (
            <div className="rounded-md border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">未割当</p>
              <p className="text-lg font-semibold text-gray-900">
                {yen(virtualAccounts.unassigned)}
              </p>
            </div>
          )}
        </div>
        <Link
          href="/accounts"
          className="text-sm text-blue-600 hover:underline mt-3 inline-block"
        >
          仮想口座を管理する →
        </Link>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="最近の入出金">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-500">記録がありません。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentTransactions.map((t) => (
                <li
                  key={t.id}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="text-gray-900">
                      {t.category?.name ?? "未分類"}
                      {t.virtualAccount && (
                        <span className="text-gray-400"> ・ {t.virtualAccount.name}</span>
                      )}
                      {t.member && (
                        <span className="text-gray-400"> ・ {t.member.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(t.date)} {t.description}
                    </p>
                  </div>
                  <span
                    className={
                      t.type === "INCOME"
                        ? "text-emerald-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {t.type === "INCOME" ? "+" : "-"}
                    {yen(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/transactions"
            className="text-sm text-blue-600 hover:underline mt-3 inline-block"
          >
            すべて見る →
          </Link>
        </Card>

        <Card title="未払いが多い部員">
          {topDebtors.length === 0 ? (
            <p className="text-sm text-gray-500">未払いの部員はいません。</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topDebtors.map((m) => (
                <li
                  key={m.id}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <Link
                    href={`/members/${m.id}`}
                    className="text-gray-900 hover:underline"
                  >
                    {m.name}
                    <span className="text-gray-400">
                      {" "}
                      ・ {MEMBER_TYPE_LABELS[m.type as keyof typeof MEMBER_TYPE_LABELS]}
                    </span>
                  </Link>
                  <span className="text-red-600 font-medium">{yen(m.balance)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/members"
            className="text-sm text-blue-600 hover:underline mt-3 inline-block"
          >
            部員一覧を見る →
          </Link>
        </Card>
      </div>
    </div>
  );
}
