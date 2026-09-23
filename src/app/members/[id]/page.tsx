import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMember,
  updateMember,
  deleteMember,
  addLedgerEntry,
  deleteLedgerEntry,
} from "@/server/actions/members";
import { uploadReceipt, deleteReceipt } from "@/server/actions/receipts";
import type { LedgerEntryType, MemberType } from "@prisma/client";
import {
  MEMBER_TYPE_LABELS,
  MEMBER_TYPE_OPTIONS,
  LEDGER_ENTRY_TYPE_LABELS,
} from "@/lib/constants";
import { yen, formatDate } from "@/lib/format";
import {
  Card,
  PageHeader,
  StatTile,
  inputClass,
  buttonClass,
  dangerButtonClass,
} from "@/components/ui";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  const balance = member.ledgerEntries.reduce((s, e) => s + e.amount, 0);

  async function updateMemberAction(formData: FormData) {
    "use server";
    await updateMember(id, {
      name: String(formData.get("name") || ""),
      period: String(formData.get("period") || ""),
      type: (formData.get("type") as MemberType) || "PLAYER",
      note: String(formData.get("note") || ""),
    });
  }

  async function deleteMemberAction() {
    "use server";
    await deleteMember(id);
    const { redirect } = await import("next/navigation");
    redirect("/members");
  }

  async function addEntryAction(formData: FormData) {
    "use server";
    const type = formData.get("type") as LedgerEntryType;
    const rawAmount = Math.abs(Number(formData.get("amount") || 0));
    const sign = String(formData.get("sign") || "increase");
    let amount = rawAmount;
    if (type === "PAYMENT") {
      amount = -rawAmount;
    } else if (type === "ADJUSTMENT") {
      amount = sign === "decrease" ? -rawAmount : rawAmount;
    }

    const entry = await addLedgerEntry({
      memberId: id,
      type,
      amount,
      description: String(formData.get("description") || ""),
    });

    const file = formData.get("receipt") as File | null;
    if (file && file.size > 0) {
      await uploadReceipt({ file, ledgerEntryId: entry.id });
    }
  }

  async function deleteEntryAction(formData: FormData) {
    "use server";
    await deleteLedgerEntry(String(formData.get("entryId")));
  }

  async function deleteReceiptAction(formData: FormData) {
    "use server";
    await deleteReceipt(String(formData.get("receiptId")));
  }

  return (
    <div>
      <PageHeader title={member.name} description={`${member.period} ・ ${MEMBER_TYPE_LABELS[member.type]}`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatTile
          label="未払い残高"
          value={yen(balance)}
          tone={balance > 0 ? "negative" : balance < 0 ? "positive" : "default"}
        />
        <StatTile label="部費計上件数" value={`${member.duesRecords.length}件`} />
        <StatTile label="台帳履歴件数" value={`${member.ledgerEntries.length}件`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="プロフィール編集" className="lg:col-span-1">
          <form action={updateMemberAction} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">氏名</label>
              <input name="name" defaultValue={member.name} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">期</label>
              <input name="period" defaultValue={member.period} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">タイプ</label>
              <select name="type" defaultValue={member.type} className={inputClass}>
                {MEMBER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">備考</label>
              <input name="note" defaultValue={member.note ?? ""} className={inputClass} />
            </div>
            <button type="submit" className={buttonClass}>
              更新
            </button>
          </form>
          <form action={deleteMemberAction} className="mt-3">
            <button type="submit" className={dangerButtonClass}>
              この部員を削除
            </button>
          </form>
        </Card>

        <Card title="未払い台帳に記録を追加(ツケ・入金・調整)" className="lg:col-span-2">
          <form action={addEntryAction} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">種別</label>
              <select name="type" className={inputClass} defaultValue="TAB_CHARGE">
                <option value="TAB_CHARGE">ツケ(発生)</option>
                <option value="PAYMENT">入金・精算(支払い)</option>
                <option value="ADJUSTMENT">手動調整</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">金額(円)</label>
              <input name="amount" type="number" min={0} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                調整の向き(手動調整の場合のみ)
              </label>
              <select name="sign" className={inputClass} defaultValue="increase">
                <option value="increase">残高を増やす(負債+)</option>
                <option value="decrease">残高を減らす(負債-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">レシート添付</label>
              <input name="receipt" type="file" accept="image/*,application/pdf" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">説明</label>
              <input name="description" className={inputClass} placeholder="例: 部室で飲料購入" />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                記録を追加
              </button>
            </div>
          </form>
        </Card>
      </div>

      <Card title="未払い台帳 履歴">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">日付</th>
                <th className="py-2 pr-4">種別</th>
                <th className="py-2 pr-4">説明</th>
                <th className="py-2 pr-4">レシート</th>
                <th className="py-2 pr-4 text-right">金額</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {member.ledgerEntries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{formatDate(e.date)}</td>
                  <td className="py-2 pr-4 text-gray-600">{LEDGER_ENTRY_TYPE_LABELS[e.type]}</td>
                  <td className="py-2 pr-4 text-gray-600">{e.description}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col gap-1">
                      {e.receipts.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <Link
                            href={r.url}
                            target="_blank"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            {r.fileName}
                          </Link>
                          <form action={deleteReceiptAction}>
                            <input type="hidden" name="receiptId" value={r.id} />
                            <button type="submit" className="text-xs text-red-500 hover:underline">
                              削除
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      e.amount > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {e.amount > 0 ? "+" : ""}
                    {yen(e.amount)}
                  </td>
                  <td className="py-2 pr-4">
                    <form action={deleteEntryAction}>
                      <input type="hidden" name="entryId" value={e.id} />
                      <button type="submit" className={dangerButtonClass}>
                        削除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {member.ledgerEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    履歴がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
