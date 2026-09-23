"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function revalidateAccounts(id?: string) {
  revalidatePath("/accounts");
  if (id) revalidatePath(`/accounts/${id}`);
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/");
}

export async function listVirtualAccounts(options?: { activeOnly?: boolean }) {
  return prisma.virtualAccount.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    orderBy: { createdAt: "asc" },
  });
}

export type VirtualAccountBalance = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
};

/**
 * 仮想口座ごとの残高を計算する。
 * 残高 = 収入 − 支出 + 振替入 − 振替出 (マイナスもあり得る)
 * asOf を指定した場合、その日時より前(当日を含まない)の記録のみで計算する。
 */
export async function getVirtualAccountBalances(asOf?: Date): Promise<{
  accounts: VirtualAccountBalance[];
  unassigned: number;
}> {
  const dateFilter = asOf ? { date: { lt: asOf } } : {};
  const [accounts, txSums, transferOutSums, transferInSums] = await Promise.all([
    listVirtualAccounts(),
    prisma.transaction.groupBy({
      by: ["virtualAccountId", "type"],
      where: dateFilter,
      _sum: { amount: true },
    }),
    prisma.virtualAccountTransfer.groupBy({
      by: ["fromAccountId"],
      where: dateFilter,
      _sum: { amount: true },
    }),
    prisma.virtualAccountTransfer.groupBy({
      by: ["toAccountId"],
      where: dateFilter,
      _sum: { amount: true },
    }),
  ]);

  const sumTx = (accountId: string | null, type: "INCOME" | "EXPENSE") =>
    txSums.find((s) => s.virtualAccountId === accountId && s.type === type)?._sum
      .amount ?? 0;

  const balances = accounts.map((a) => {
    const income = sumTx(a.id, "INCOME");
    const expense = sumTx(a.id, "EXPENSE");
    const transferOut =
      transferOutSums.find((s) => s.fromAccountId === a.id)?._sum.amount ?? 0;
    const transferIn =
      transferInSums.find((s) => s.toAccountId === a.id)?._sum.amount ?? 0;
    return {
      ...a,
      income,
      expense,
      transferIn,
      transferOut,
      balance: income - expense + transferIn - transferOut,
    };
  });

  return {
    accounts: balances,
    unassigned: sumTx(null, "INCOME") - sumTx(null, "EXPENSE"),
  };
}

export async function getVirtualAccount(id: string) {
  return prisma.virtualAccount.findUnique({
    where: { id },
    include: {
      transactions: {
        include: { category: true, member: true },
        orderBy: { date: "desc" },
      },
      transfersOut: { include: { toAccount: true }, orderBy: { date: "desc" } },
      transfersIn: { include: { fromAccount: true }, orderBy: { date: "desc" } },
    },
  });
}

export async function createVirtualAccount(input: {
  name: string;
  note?: string;
}) {
  await prisma.virtualAccount.create({
    data: {
      name: input.name.trim(),
      note: input.note || null,
    },
  });
  revalidateAccounts();
}

export async function updateVirtualAccount(
  id: string,
  input: { name: string; note?: string; isActive: boolean }
) {
  await prisma.virtualAccount.update({
    where: { id },
    data: {
      name: input.name.trim(),
      note: input.note || null,
      isActive: input.isActive,
    },
  });
  revalidateAccounts(id);
}

/** 記録が一件もない仮想口座のみ削除できる。記録がある場合は無効化で対応する。 */
export async function deleteVirtualAccount(id: string) {
  const [txCount, transferCount] = await Promise.all([
    prisma.transaction.count({ where: { virtualAccountId: id } }),
    prisma.virtualAccountTransfer.count({
      where: { OR: [{ fromAccountId: id }, { toAccountId: id }] },
    }),
  ]);
  if (txCount > 0 || transferCount > 0) {
    throw new Error(
      "入出金または振替の記録がある仮想口座は削除できません。無効化してください。"
    );
  }
  await prisma.virtualAccount.delete({ where: { id } });
  revalidateAccounts();
}

/** 仮想口座間の振替。実際のお金は動かず、区分だけが移る。 */
export async function createVirtualAccountTransfer(input: {
  date: Date;
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  description?: string;
}) {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("振替元と振替先に同じ仮想口座は指定できません。");
  }
  await prisma.virtualAccountTransfer.create({
    data: {
      date: input.date,
      amount: Math.abs(input.amount),
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      description: input.description || null,
    },
  });
  revalidateAccounts(input.fromAccountId);
  revalidateAccounts(input.toAccountId);
}

export async function deleteVirtualAccountTransfer(id: string) {
  const transfer = await prisma.virtualAccountTransfer.delete({ where: { id } });
  revalidateAccounts(transfer.fromAccountId);
  revalidateAccounts(transfer.toAccountId);
}
