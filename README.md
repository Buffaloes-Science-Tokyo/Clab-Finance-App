# 部活会計 (Bukatsu Kaikei)

部活動向けの会計管理Webアプリです。部員管理、部費の自動計上、ツケ・入出金の記録、予算調整、最適な部費の自動計算、月次/四半期/年次の会計報告(PPTX出力)を行えます。

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`) — オフラインで動作するローカルDB
- Neon (PostgreSQL, `pg`) — 複数端末間の同期先(任意)
- pptxgenjs (会計報告のPPTX出力)

## セットアップ

```bash
npm install
npm run db:migrate   # 初回のみ: マイグレーション適用 + DB作成
npm run db:seed       # サンプルデータ投入(任意)
npm run dev
```

http://localhost:3000 を開いてください。

## 主な機能

- **仮想口座**: 実際のお金は一つの口座にあるまま、「部」「寄付」「イヤーブック」のように用途別にお金を分けて管理します。仮想口座ごとの残高(マイナスも可)・履歴を確認でき、仮想口座間の振替も記録できます。全仮想口座の残高合計が実際の残高になります。
- **入出金記録**: 部全体の実際のお金の動きを記録。仮想口座・カテゴリ・支払方法・レシート添付に対応。
- **部員・未払い**: 氏名・期・タイプ(選手/スタッフ/学生コーチ/社会人/退部/?)で部員を管理。部員ごとの未払い台帳(ツケ・部費請求・入金・手動調整)を記録し、レシート画像を添付できます。
- **部費**: 内訳項目(施設費・備品費など)を自由に追加・編集し、月ごとに対象部員全員へワンクリックで自動計上します。
- **予算・部費計算**: 月次/四半期/年次で予算を設定。プール金(目標準備金)を考慮し、不足分を加味した最適な一人あたり部費を自動計算します。
- **Neon同期**: オフラインでもローカルのSQLiteで動作し、「Neon同期」ページのボタンで Neon と双方向に同期します。複数の端末で編集した変更をやり取りでき、同じ記録を編集した場合は後から編集した方が残ります(削除も同期)。
- **会計報告**: 月次/四半期/年次で「実際の入出金(現金ベース)」と「ツケ計上を含む発生ベース」の両方と仮想口座別の残高を表示し、PPTXとしてダウンロードできます。

## Neon同期の設定(任意)

1. [Neon](https://neon.tech) でプロジェクトを作成し、接続文字列(`postgresql://...?sslmode=require`)をコピーします。
2. `.env` に `NEON_DATABASE_URL="postgresql://..."` を追加し、アプリを再起動します。
3. 「Neon同期」ページで「Neonと同期する」を押します。Neon側の同期用テーブル(`sync_rows` など)は初回同期時に自動で作成されます。

新しい端末で使う場合は、`npm run db:migrate` の後、データを入力する前に一度同期してください(`db:seed` は不要です)。

### 仕組み

- 各テーブルの変更は SQLite のトリガーで `SyncOutbox` に記録されます(`src/server/sync-local.ts`)。
- 同期時は「未送信の変更をNeonへ送信 → 他端末の変更を受信」の順に行います(`src/server/sync.ts`)。Neon側は行ごとの最新状態を JSON で保持する中継所です。
- 競合は各端末の時計による「後勝ち」で解決します。端末の時刻を正しく設定してください。
- 別々の端末で同じ名前のカテゴリ等を作ると一意制約で取り込めません。同期ページに表示されるので、片方を改名・削除して再同期すると取り込まれます。
- レシートの画像ファイル(`public/uploads`)は同期されません。
- スキーマを変更した場合は、全端末を同じバージョンに揃えてから同期してください。

## データベース関連コマンド

```bash
npm run db:migrate   # マイグレーションを作成・適用
npm run db:generate  # Prisma Clientの再生成
npm run db:seed       # シードデータ投入
npm run db:studio    # Prisma StudioでDBをGUI閲覧
npm run db:reset      # DBをリセットして再マイグレーション+シード
```

## デバッグ

- VS Code の「実行とデバッグ」パネルから以下の構成が使えます(`.vscode/launch.json`)。
  - **Next.js: debug server-side** — `npm run dev` を起動しつつサーバー側コードにブレークポイントを張れます。
  - **Next.js: debug client-side** — Chromeでフロントエンドをデバッグ。
  - **Next.js: debug full stack** — `--inspect` 付きでサーバーを起動し、フルスタックでデバッグ。
  - **Prisma: debug seed script** — `prisma/seed.ts` 単体をデバッグ実行。
- 推奨拡張機能は `.vscode/extensions.json` に記載しています(Prisma / ESLint / Tailwind CSS IntelliSense)。

## ディレクトリ構成(抜粋)

```
prisma/schema.prisma      DBスキーマ
prisma/seed.ts             シードスクリプト
src/lib/                   共通定数・フォーマッタ・期間計算
src/server/actions/        Server Actions(CRUD)
src/server/reports.ts      会計報告の集計ロジック
src/server/pptx.ts         PPTX生成
src/app/                   ページ(App Router)
```
