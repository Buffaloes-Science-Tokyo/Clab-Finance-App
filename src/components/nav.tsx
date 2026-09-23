import Link from "next/link";

const links = [
  { href: "/", label: "ダッシュボード" },
  { href: "/accounts", label: "仮想口座" },
  { href: "/transactions", label: "入出金記録" },
  { href: "/members", label: "部員・未払い" },
  { href: "/dues", label: "部費" },
  { href: "/budget", label: "予算・部費計算" },
  { href: "/reports", label: "会計報告" },
  { href: "/settings/categories", label: "カテゴリ設定" },
];

export function Nav() {
  return (
    <nav className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white">
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/" className="font-bold text-lg text-gray-900">
          部活会計
        </Link>
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
