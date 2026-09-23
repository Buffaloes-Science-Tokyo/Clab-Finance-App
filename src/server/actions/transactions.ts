"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TransactionType } from "@prisma/client";

export async function listTransactions(filters?: {
  from?: Date;
  to?: Date;
  type?: TransactionType;
  memberId?: string;
  categoryId?: string;
  virtualAccountId?: string;
}) {
  return prisma.transaction.findMany({
    where: {
      date:
        filters?.from || filters?.to
          ? { gte: filters?.from, lt: filters?.to }
          : undefined,
      type: filters?.type,
      memberId: filters?.memberId,
      categoryId: filters?.categoryId,
      virtualAccountId: filters?.virtualAccountId,
    },
    include: { category: true, member: true, receipts: true, virtualAccount: true },
    orderBy: { date: "desc" },
  });
}

export async function getTransaction(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: { category: true, member: true, receipts: true, virtualAccount: true },
  });
}

export async function createTransaction(input: {
  date: Date;
  type: TransactionType;
  amount: number;
  categoryId?: string;
  memberId?: string;
  description?: string;
  method?: string;
  virtualAccountId?: string;
  /** trueの場合、部員の個人台帳に「支払い」として反映し未払い残高を減らす */
  recordAsMemberPayment?: boolean;
}) {
  const transaction = await prisma.transaction.create({
    data: {
      date: input.date,
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId || null,
      memberId: input.memberId || null,
      description: input.description || null,
      method: input.method || null,
      virtualAccountId: input.virtualAccountId || null,
    },
  });

  if (input.recordAsMemberPayment && input.memberId) {
    await prisma.memberLedgerEntry.create({
      data: {
        memberId: input.memberId,
        type: "PAYMENT",
        amount: -Math.abs(input.amount),
        description: input.description || "入金",
        date: input.date,
        transactionId: transaction.id,
      },
    });
    revalidatePath(`/members/${input.memberId}`);
    revalidatePath("/members");
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts", "layout");
  revalidatePath("/");
  return transaction;
}

export async function updateTransaction(
  id: string,
  input: {
    date: Date;
    type: TransactionType;
    amount: number;
    categoryId?: string;
    memberId?: string;
    description?: string;
    method?: string;
    virtualAccountId?: string;
  }
) {
  await prisma.transaction.update({
    where: { id },
    data: {
      date: input.date,
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId || null,
      memberId: input.memberId || null,
      description: input.description || null,
      method: input.method || null,
      virtualAccountId: input.virtualAccountId || null,
    },
  });
  revalidatePath("/transactions");
  revalidatePath("/accounts", "layout");
  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  const linked = await prisma.memberLedgerEntry.findMany({
    where: { transactionId: id },
  });
  await prisma.memberLedgerEntry.deleteMany({ where: { transactionId: id } });
  await prisma.transaction.delete({ where: { id } });
  for (const entry of linked) {
    revalidatePath(`/members/${entry.memberId}`);
  }
  revalidatePath("/transactions");
  revalidatePath("/accounts", "layout");
  revalidatePath("/members");
  revalidatePath("/");
}

/** 部員のツケ(未払い)を記録する。実際の現金は動かない。 */
export async function recordTab(input: {
  memberId: string;
  amount: number;
  description?: string;
  date?: Date;
}) {
  await prisma.memberLedgerEntry.create({
    data: {
      memberId: input.memberId,
      type: "TAB_CHARGE",
      amount: Math.abs(input.amount),
      description: input.description || null,
      date: input.date ?? new Date(),
    },
  });
  revalidatePath(`/members/${input.memberId}`);
  revalidatePath("/members");
}
