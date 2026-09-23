import { getDb } from "@/lib/prisma";
import type { BudgetPeriodType } from "@prisma/client";
import { periodRange, periodLabel } from "@/lib/period";
import { getVirtualAccountBalances } from "@/server/actions/accounts";

export type CategoryBreakdown = {
  categoryId: string | null;
  name: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
};

export type VirtualAccountSummary = {
  id: string | null;
  name: string;
  openingBalance: number;
  income: number;
  expense: number;
  transferNet: number;
  closingBalance: number;
};

export type PeriodReport = {
  periodType: BudgetPeriodType;
  period: string;
  label: string;
  start: Date;
  end: Date;
  cash: {
    income: number;
    expense: number;
    net: number;
    byCategory: CategoryBreakdown[];
  };
  accrual: {
    income: number;
    expense: number;
    net: number;
    unbilledReceivables: number;
  };
  outstandingBalanceEnd: number;
  memberBalances: { id: string; name: string; type: string; balance: number }[];
  virtualAccounts: VirtualAccountSummary[];
};

export async function getPeriodReport(
  periodType: BudgetPeriodType,
  period: string
): Promise<PeriodReport> {
  const prisma = await getDb();
  const { start, end } = periodRange(periodType, period);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    include: { category: true },
  });

  const cashIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const cashExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);

  const byCategoryMap = new Map<string, CategoryBreakdown>();
  for (const t of transactions) {
    const key = t.categoryId ?? `__none_${t.type}`;
    const existing = byCategoryMap.get(key);
    if (existing) {
      existing.amount += t.amount;
    } else {
      byCategoryMap.set(key, {
        categoryId: t.categoryId,
        name: t.category?.name ?? "未分類",
        type: t.type,
        amount: t.amount,
      });
    }
  }

  // 発生ベース: 現金取引に紐づかない部費請求・ツケ発生を「未収の収益」として計上
  const unbilledEntries = await prisma.memberLedgerEntry.findMany({
    where: {
      date: { gte: start, lt: end },
      transactionId: null,
      type: { in: ["DUES_CHARGE", "TAB_CHARGE"] },
    },
  });
  const unbilledReceivables = unbilledEntries.reduce(
    (s, e) => s + e.amount,
    0
  );

  const accrualIncome = cashIncome + unbilledReceivables;
  const accrualExpense = cashExpense;

  const membersWithLedger = await prisma.member.findMany({
    include: { ledgerEntries: { where: { date: { lt: end } }, select: { amount: true } } },
  });
  const memberBalances = membersWithLedger
    .map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type as string,
      balance: m.ledgerEntries.reduce((s, e) => s + e.amount, 0),
    }))
    .filter((m) => m.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  const outstandingBalanceEnd = memberBalances.reduce(
    (s, m) => s + m.balance,
    0
  );

  // 仮想口座ごとの期首残高・期間内の動き・期末残高
  const [opening, closing] = await Promise.all([
    getVirtualAccountBalances(start),
    getVirtualAccountBalances(end),
  ]);
  const virtualAccounts: VirtualAccountSummary[] = closing.accounts
    .map((c) => {
      const o = opening.accounts.find((a) => a.id === c.id);
      return {
        id: c.id,
        name: c.name,
        openingBalance: o?.balance ?? 0,
        income: c.income - (o?.income ?? 0),
        expense: c.expense - (o?.expense ?? 0),
        transferNet:
          c.transferIn - c.transferOut - ((o?.transferIn ?? 0) - (o?.transferOut ?? 0)),
        closingBalance: c.balance,
      };
    })
    .filter(
      (a) =>
        a.openingBalance !== 0 ||
        a.closingBalance !== 0 ||
        a.income !== 0 ||
        a.expense !== 0 ||
        a.transferNet !== 0
    );
  if (opening.unassigned !== 0 || closing.unassigned !== 0) {
    const unassignedTx = transactions.filter((t) => t.virtualAccountId === null);
    virtualAccounts.push({
      id: null,
      name: "未割当",
      openingBalance: opening.unassigned,
      income: unassignedTx
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amount, 0),
      expense: unassignedTx
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0),
      transferNet: 0,
      closingBalance: closing.unassigned,
    });
  }

  return {
    periodType,
    period,
    label: periodLabel(periodType, period),
    start,
    end,
    cash: {
      income: cashIncome,
      expense: cashExpense,
      net: cashIncome - cashExpense,
      byCategory: Array.from(byCategoryMap.values()).sort(
        (a, b) => b.amount - a.amount
      ),
    },
    accrual: {
      income: accrualIncome,
      expense: accrualExpense,
      net: accrualIncome - accrualExpense,
      unbilledReceivables,
    },
    outstandingBalanceEnd,
    memberBalances,
    virtualAccounts,
  };
}
