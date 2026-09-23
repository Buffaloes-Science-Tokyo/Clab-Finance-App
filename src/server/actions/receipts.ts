"use server";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "receipts");

function safeExt(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

export async function uploadReceipt(input: {
  file: File;
  transactionId?: string;
  ledgerEntryId?: string;
}) {
  const prisma = await getDb();
  if (!input.file || input.file.size === 0) return null;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = safeExt(input.file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const receipt = await prisma.receipt.create({
    data: {
      url: `/uploads/receipts/${storedName}`,
      fileName: input.file.name,
      transactionId: input.transactionId || null,
      ledgerEntryId: input.ledgerEntryId || null,
    },
  });

  if (input.transactionId) revalidatePath("/transactions");
  if (input.ledgerEntryId) revalidatePath("/members");
  return receipt;
}

export async function deleteReceipt(id: string) {
  const prisma = await getDb();
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) return;
  await prisma.receipt.delete({ where: { id } });
  try {
    await unlink(path.join(process.cwd(), "public", receipt.url.replace(/^\//, "")));
  } catch {
    // ファイルが既に無くても無視
  }
  revalidatePath("/transactions");
  revalidatePath("/members");
}
