import Link from "next/link";
import { closeBookAction } from "@/server/actions/books";

const links = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/accounts", label: "仮想口座" },
  { href: "/transactions", label: "入出金記録" },
  { href: "/members", label: "部員・未払い" },
  { href: "/dues", label: "部費" },
  { href: "/budget", label: "予算・部費計算" },
  { href: "/reports", label: "会計報告" },
  { href: "/settings/categories", label: "カテゴリ設定" },
  { href: "/sync", label: "Neon同期" },
  { href: "/settings/book", label: "口座設定" },
];

export function Nav({ bookName }: { bookName: string }) {
  return (
    <nav className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white">
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/dashboard" className="font-bold text-lg text-gray-900">
          部活会計
        </Link>
        <p className="mt-1 text-sm text-gray-600 truncate" title={bookName}>
          口座: <span className="font-medium text-gray-900">{bookName}</span>
        </p>
        <form action={closeBookAction} className="mt-2">
          <button type="submit" className="text-xs text-blue-600 hover:underline">
            口座を切り替える
          </button>
        </form>
      </div>
      <ul className="flex md:flex-col overflow-x-auto md:overflow-visible text-sm">
        {links.map((l) => (
          <li key={l.href} className="whitespace-nowrap md:whitespace-normal">
            <Link
              href={l.href}
              className="block px-4 py-2.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
