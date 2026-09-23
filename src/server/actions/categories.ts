"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { TransactionType } from "@prisma/client";

export async function listCategories(type?: TransactionType) {
  return prisma.category.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(input: {
  name: string;
  type: TransactionType;
}) {
  await prisma.category.create({
    data: { name: input.name, type: input.type },
  });
  revalidatePath("/settings/categories");
}

export async function updateCategory(
  id: string,
  input: { name: string; type: TransactionType; isActive: boolean }
) {
  await prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      isActive: input.isActive,
    },
  });
  revalidatePath("/settings/categories");
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath("/settings/categories");
}
