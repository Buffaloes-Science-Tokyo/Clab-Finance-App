import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "部活会計 | 部活動会計管理",
  description: "部費・ツケ・入出金・予算を一元管理する部活動向け会計アプリ",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 全ページがローカルDBを読むため、ビルド時に静的生成せずリクエストごとに描画する
  // (Neon同期で取り込んだデータもすぐ反映される)
  await connection();
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row bg-gray-50 text-gray-900">
        <Nav />
        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </body>
    </html>
  );
}
