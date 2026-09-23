import { Nav } from "@/components/nav";
import { requireCurrentBook } from "@/server/session";

/** 口座を開いた後の画面。口座が未選択ならホーム(口座選択画面)へ移動する */
export default async function BookLayout({ children }: LayoutProps<"/">) {
  const book = await requireCurrentBook();
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Nav bookName={book.name} />
      <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}
