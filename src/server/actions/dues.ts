"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/prisma";
import { DUES_EXCLUDED_TYPES } from "@/lib/constants";

export async function listDuesItems() {
  const prisma = await getDb();
  return prisma.duesItem.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });
}

export async function createDuesItem(input: {
  name: string;
  amount: number;
  categoryId?: string;
}) {
  const prisma = await getDb();
  await prisma.duesItem.create({
    data: {
      name: input.name,
      amount: input.amount,
      categoryId: input.categoryId || null,
    },
  });
  revalidatePath("/dues");
}

export async function updateDuesItem(
  id: string,
  input: {
    name: string;
    amount: number;
    categoryId?: string;
    isActive: boolean;
  }
) {
  const prisma = await getDb();
  await prisma.duesItem.update({
    where: { id },
    data: {
      name: input.name,
      amount: input.amount,
      categoryId: input.categoryId || null,
      isActive: input.isActive,
    },
  });
  revalidatePath("/dues");
}

export async function deleteDuesItem(id: string) {
  const prisma = await getDb();
  await prisma.duesItem.delete({ where: { id } });
  revalidatePath("/dues");
}

export async function listDuesRecords(yearMonth?: string) {
  const prisma = await getDb();
  return prisma.memberDuesRecord.findMany({
    where: yearMonth ? { yearMonth } : undefined,
    include: { member: true, items: true },
    orderBy: [{ yearMonth: "desc" }],
  });
}

/**
 * 指定月の部費を、有効な内訳項目に基づき対象部員全員に自動計上する。
 * 既にその月の計上がある部員はスキップする。
 */
export async function generateMonthlyDues(
  yearMonth: string,
  memberTypesExcluded: string[] = DUES_EXCLUDED_TYPES
) {
  const prisma = await getDb();
  const [duesItems, members, existing] = await Promise.all([
    prisma.duesItem.findMany({ where: { isActive: true } }),
    prisma.member.findMany({
      where: { type: { notIn: memberTypesExcluded as never[] } },
    }),
    prisma.memberDuesRecord.findMany({
      where: { yearMonth },
      select: { memberId: true },
    }),
  ]);

  const existingIds = new Set(existing.map((e) => e.memberId));
  const targetMembers = members.filter((m) => !existingIds.has(m.id));
  const totalAmount = duesItems.reduce((sum, item) => sum + item.amount, 0);

  let created = 0;
  for (const member of targetMembers) {
    const record = await prisma.memberDuesRecord.create({
      data: {
        memberId: member.id,
        yearMonth,
        totalAmount,
        items: {
          create: duesItems.map((item) => ({
            duesItemId: item.id,
            name: item.name,
            amount: item.amount,
          })),
        },
      },
    });
    await prisma.memberLedgerEntry.create({
      data: {
        memberId: member.id,
        type: "DUES_CHARGE",
        amount: totalAmount,
        description: `${yearMonth} 部費`,
        duesRecordId: record.id,
      },
    });
    created += 1;
  }

  revalidatePath("/dues");
  revalidatePath("/members");
  return { created, skipped: existingIds.size, totalAmount };
}

export async function deleteDuesRecord(id: string) {
  const prisma = await getDb();
  const record = await prisma.memberDuesRecord.findUnique({ where: { id } });
  if (!record) return;
  await prisma.memberLedgerEntry.deleteMany({ where: { duesRecordId: id } });
  await prisma.memberDuesRecord.delete({ where: { id } });
  revalidatePath("/dues");
  revalidatePath("/members");
}
