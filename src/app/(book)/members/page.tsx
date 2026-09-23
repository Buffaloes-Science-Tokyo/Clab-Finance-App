import Link from "next/link";
import { getMemberBalances } from "@/server/actions/members";
import { createMember } from "@/server/actions/members";
import type { MemberType } from "@prisma/client";
import { MEMBER_TYPE_LABELS, MEMBER_TYPE_OPTIONS } from "@/lib/constants";
import { yen } from "@/lib/format";
import { Card, PageHeader, inputClass, buttonClass } from "@/components/ui";

async function createMemberAction(formData: FormData) {
  "use server";
  await createMember({
    name: String(formData.get("name") || ""),
    period: String(formData.get("period") || ""),
    type: (formData.get("type") as MemberType) || "PLAYER",
    note: String(formData.get("note") || ""),
  });
}

export default async function MembersPage() {
  const members = await getMemberBalances();

  return (
    <div>
      <PageHeader
        title="部員・未払い"
        description="部員の登録と、部員ごとの未払い残高(部費請求・ツケ・入金)を確認できます。"
      />

      <Card title="部員を追加" className="mb-6">
        <form action={createMemberAction} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">氏名</label>
            <input name="name" required className={inputClass} placeholder="山田 太郎" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">期</label>
            <input name="period" required className={inputClass} placeholder="52期" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">タイプ</label>
            <select name="type" className={inputClass} defaultValue="PLAYER">
              {MEMBER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              追加
            </button>
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <input name="note" className={inputClass} placeholder="任意" />
          </div>
        </form>
      </Card>

      <Card title={`部員一覧 (${members.length}名)`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4">氏名</th>
                <th className="py-2 pr-4">期</th>
                <th className="py-2 pr-4">タイプ</th>
                <th className="py-2 pr-4 text-right">未払い残高</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <Link href={`/members/${m.id}`} className="text-blue-600 hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{m.period}</td>
                  <td className="py-2 pr-4 text-gray-600">{MEMBER_TYPE_LABELS[m.type]}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      m.balance > 0
                        ? "text-red-600"
                        : m.balance < 0
                          ? "text-emerald-600"
                          : "text-gray-400"
                    }`}
                  >
                    {yen(m.balance)}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    部員が登録されていません。
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
