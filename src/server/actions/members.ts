"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { MemberType, LedgerEntryType } from "@prisma/client";

export async function listMembers() {
  return prisma.member.findMany({
    orderBy: [{ type: "asc" }, { period: "desc" }, { name: "asc" }],
  });
}

export async function getMember(id: string) {
  return prisma.member.findUnique({
    where: { id },
    include: {
      ledgerEntries: {
        orderBy: { date: "desc" },
        include: { receipts: true },
      },
      duesRecords: { orderBy: { yearMonth: "desc" } },
    },
  });
}

export async function getMemberBalances() {
  const members = await prisma.member.findMany({
    include: { ledgerEntries: { select: { amount: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return members.map((m) => ({
    ...m,
    balance: m.ledgerEntries.reduce((sum, e) => sum + e.amount, 0),
  }));
}

export async function createMember(input: {
  name: string;
  period: string;
  type: MemberType;
  note?: string;
}) {
  await prisma.member.create({
    data: {
      name: input.name,
      period: input.period,
      type: input.type,
      note: input.note || null,
    },
  });
  revalidatePath("/members");
}

export async function updateMember(
  id: string,
  input: { name: string; period: string; type: MemberType; note?: string }
) {
  await prisma.member.update({
    where: { id },
    data: {
      name: input.name,
      period: input.period,
      type: input.type,
      note: input.note || null,
    },
  });
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
}

export async function deleteMember(id: string) {
  await prisma.member.delete({ where: { id } });
  revalidatePath("/members");
}

export async function addLedgerEntry(input: {
  memberId: string;
  type: LedgerEntryType;
  amount: number;
  description?: string;
  date?: Date;
}) {
  const entry = await prisma.memberLedgerEntry.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      amount: input.amount,
      description: input.description || null,
      date: input.date ?? new Date(),
    },
  });
  revalidatePath(`/members/${input.memberId}`);
  revalidatePath("/members");
  return entry;
}

export async function deleteLedgerEntry(id: string) {
  const entry = await prisma.memberLedgerEntry.delete({ where: { id } });
  revalidatePath(`/members/${entry.memberId}`);
  revalidatePath("/members");
}
