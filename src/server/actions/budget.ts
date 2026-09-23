"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { BudgetPeriodType } from "@prisma/client";
import { DUES_EXCLUDED_TYPES } from "@/lib/constants";
import { periodRange } from "@/lib/period";

export async function getClubSetting() {
  return prisma.clubSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function updateClubSetting(input: {
  poolFundTarget: number;
  roundTo: number;
}) {
  await prisma.clubSetting.upsert({
    where: { id: "singleton" },
    update: { poolFundTarget: input.poolFundTarget, roundTo: input.roundTo },
    create: {
      id: "singleton",
      poolFundTarget: input.poolFundTarget,
      roundTo: input.roundTo,
    },
  });
  revalidatePath("/budget");
}

export async function listBudgets(periodType: BudgetPeriodType, period: string) {
  return prisma.budget.findMany({
    where: { periodType, period },
    include: { category: true },
    orderBy: [{ category: { type: "asc" } }, { category: { name: "asc" } }],
  });
}

export async function upsertBudget(input: {
  periodType: BudgetPeriodType;
  period: string;
  categoryId: string;
  plannedAmount: number;
  note?: string;
}) {
  await prisma.budget.upsert({
    where: {
      periodType_period_categoryId: {
        periodType: input.periodType,
        period: input.period,
        categoryId: input.categoryId,
      },
    },
    update: { plannedAmount: input.plannedAmount, note: input.note || null },
    create: {
      periodType: input.periodType,
      period: input.period,
      categoryId: input.categoryId,
      plannedAmount: input.plannedAmount,
      note: input.note || null,
    },
  });
  revalidatePath("/budget");
}

export async function deleteBudget(id: string) {
  await prisma.budget.delete({ where: { id } });
  revalidatePath("/budget");
}

/** 実際のクラブ残高(指定日時点、指定日を含まない)を計算する */
export async function getClubBalanceAsOf(date: Date) {
  const [income, expense] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "INCOME", date: { lt: date } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "EXPENSE", date: { lt: date } },
      _sum: { amount: true },
    }),
  ]);
  return (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
}

export type OptimalDuesResult = {
  periodType: BudgetPeriodType;
  period: string;
  plannedExpenseTotal: number;
  otherPlannedIncomeTotal: number;
  currentClubBalance: number;
  poolFundTarget: number;
  poolFundShortfall: number;
  memberCount: number;
  neededFromDues: number;
  perMemberDues: number;
};

/**
 * プール金(目標準備金)を考慮した最適な部費を計算する。
 * neededFromDues = 支出予算 - その他収入予算 + (プール金目標 - 現在残高)
 * perMemberDues  = neededFromDues を対象部員数で割り、roundTo単位で切り上げ
 */
export async function calculateOptimalDues(input: {
  periodType: BudgetPeriodType;
  period: string;
  plannedExpenseOverride?: number;
  otherIncomeOverride?: number;
  memberCountOverride?: number;
}): Promise<OptimalDuesResult> {
  const { start } = periodRange(input.periodType, input.period);

  const [budgets, setting, memberCount, currentClubBalance] = await Promise.all([
    prisma.budget.findMany({
      where: { periodType: input.periodType, period: input.period },
      include: { category: true },
    }),
    getClubSetting(),
    prisma.member.count({
      where: { type: { notIn: DUES_EXCLUDED_TYPES as never[] } },
    }),
    getClubBalanceAsOf(start),
  ]);

  const plannedExpenseTotal =
    input.plannedExpenseOverride ??
    budgets
      .filter((b) => b.category.type === "EXPENSE")
      .reduce((sum, b) => sum + b.plannedAmount, 0);

  const otherPlannedIncomeTotal =
    input.otherIncomeOverride ??
    budgets
      .filter((b) => b.category.type === "INCOME" && b.category.name !== "部費")
      .reduce((sum, b) => sum + b.plannedAmount, 0);

  const effectiveMemberCount = Math.max(
    1,
    input.memberCountOverride ?? memberCount
  );

  const poolFundShortfall = setting.poolFundTarget - currentClubBalance;
  const neededFromDues = Math.max(
    0,
    plannedExpenseTotal - otherPlannedIncomeTotal + poolFundShortfall
  );

  const roundTo = Math.max(1, setting.roundTo);
  const perMemberDues =
    Math.ceil(neededFromDues / effectiveMemberCount / roundTo) * roundTo;

  return {
    periodType: input.periodType,
    period: input.period,
    plannedExpenseTotal,
    otherPlannedIncomeTotal,
    currentClubBalance,
    poolFundTarget: setting.poolFundTarget,
    poolFundShortfall,
    memberCount: effectiveMemberCount,
    neededFromDues,
    perMemberDues,
  };
}
