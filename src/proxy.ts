import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 外部公開用のサイト全体のBasic認証。SITE_PASSWORD が未設定なら何もしない(ローカル利用時)。
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const user = process.env.SITE_USER ?? "club";

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(":");
      if (i >= 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === password) {
        return NextResponse.next();
      }
    } catch {
      // 不正なヘッダーは認証失敗として扱う
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Bukatsu Kaikei", charset="UTF-8"' },
  });
}
