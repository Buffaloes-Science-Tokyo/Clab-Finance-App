# 部活会計 (Bukatsu Kaikei)

部活動向けの会計管理Webアプリです。部員管理、部費の自動計上、ツケ・入出金の記録、予算調整、最適な部費の自動計算、月次/四半期/年次の会計報告(PPTX出力)を行えます。

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`)
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
- **会計報告**: 月次/四半期/年次で「実際の入出金(現金ベース)」と「ツケ計上を含む発生ベース」の両方と仮想口座別の残高を表示し、PPTXとしてダウンロードできます。

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
