import PptxGenJS from "pptxgenjs";
import type { PeriodReport } from "./reports";
import { BUDGET_PERIOD_TYPE_LABELS } from "@/lib/constants";

const YEN = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const cell = (text: string): PptxGenJS.TableCell => ({ text });

export async function buildReportPptx(report: PeriodReport): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4", width: 10, height: 5.63 });
  pptx.layout = "A4";

  const NAVY = "1F2937";
  const ACCENT = "2563EB";
  const LIGHT = "F3F4F6";

  // ── 表紙 ──────────────────────────────
  const title = pptx.addSlide();
  title.background = { color: "FFFFFF" };
  title.addText(`${BUDGET_PERIOD_TYPE_LABELS[report.periodType]}会計報告`, {
    x: 0.6,
    y: 1.8,
    w: 8.8,
    h: 1,
    fontSize: 32,
    bold: true,
    color: NAVY,
  });
  title.addText(report.label, {
    x: 0.6,
    y: 2.7,
    w: 8.8,
    h: 0.6,
    fontSize: 20,
    color: ACCENT,
  });
  title.addText(
    `作成日: ${new Date().toLocaleDateString("ja-JP")}`,
    { x: 0.6, y: 4.8, w: 8.8, h: 0.4, fontSize: 12, color: "6B7280" }
  );

  // ── サマリー ──────────────────────────
  const summary = pptx.addSlide();
  summary.addText("サマリー", {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });

  const summaryRows: PptxGenJS.TableRow[] = [
    [
      { text: "", options: { fill: { color: LIGHT } } },
      { text: "実際の入出金(現金ベース)", options: { bold: true, fill: { color: LIGHT } } },
      { text: "発生ベース(ツケ計上含む)", options: { bold: true, fill: { color: LIGHT } } },
    ],
    [cell("収入"), cell(YEN(report.cash.income)), cell(YEN(report.accrual.income))],
    [cell("支出"), cell(YEN(report.cash.expense)), cell(YEN(report.accrual.expense))],
    [cell("収支"), cell(YEN(report.cash.net)), cell(YEN(report.accrual.net))],
  ];
  summary.addTable(summaryRows, {
    x: 0.5,
    y: 1.1,
    w: 9,
    fontSize: 13,
    border: { type: "solid", color: "E5E7EB", pt: 1 },
    autoPage: false,
  });

  summary.addText(
    [
      { text: "部員の未収残高合計: ", options: { bold: true } },
      { text: YEN(report.outstandingBalanceEnd) },
    ],
    { x: 0.5, y: 3.2, w: 9, h: 0.4, fontSize: 14, color: NAVY }
  );
  summary.addText(
    [
      { text: "期間内の未収発生額(部費・ツケ): ", options: { bold: true } },
      { text: YEN(report.accrual.unbilledReceivables) },
    ],
    { x: 0.5, y: 3.65, w: 9, h: 0.4, fontSize: 14, color: NAVY }
  );

  // ── カテゴリ別内訳(現金ベース) ──────────
  const cat = pptx.addSlide();
  cat.addText("カテゴリ別内訳(実際の入出金)", {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });
  const catRows: PptxGenJS.TableRow[] = [
    [
      { text: "区分", options: { bold: true, fill: { color: LIGHT } } },
      { text: "カテゴリ", options: { bold: true, fill: { color: LIGHT } } },
      { text: "金額", options: { bold: true, fill: { color: LIGHT } } },
    ],
    ...report.cash.byCategory.map((c) => [
      cell(c.type === "INCOME" ? "収入" : "支出"),
      cell(c.name),
      cell(YEN(c.amount)),
    ]),
  ];
  if (report.cash.byCategory.length === 0) {
    catRows.push([cell("-"), cell("データなし"), cell("-")]);
  }
  cat.addTable(catRows, {
    x: 0.5,
    y: 1.1,
    w: 9,
    fontSize: 12,
    border: { type: "solid", color: "E5E7EB", pt: 1 },
    autoPage: false,
  });

  // ── 仮想口座別 残高 ────────────────────
  if (report.virtualAccounts.length > 0) {
    const va = pptx.addSlide();
    va.addText("仮想口座別 残高", {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 22,
      bold: true,
      color: NAVY,
    });
    const header = (text: string): PptxGenJS.TableCell => ({
      text,
      options: { bold: true, fill: { color: LIGHT } },
    });
    const vaRows: PptxGenJS.TableRow[] = [
      ["仮想口座", "期首残高", "収入", "支出", "振替", "期末残高"].map(header),
      ...report.virtualAccounts.map((a) => [
        cell(a.name),
        cell(YEN(a.openingBalance)),
        cell(YEN(a.income)),
        cell(YEN(a.expense)),
        cell(YEN(a.transferNet)),
        {
          text: YEN(a.closingBalance),
          options: { bold: true, color: a.closingBalance < 0 ? "DC2626" : NAVY },
        },
      ]),
    ];
    va.addTable(vaRows, {
      x: 0.5,
      y: 1.1,
      w: 9,
      fontSize: 12,
      border: { type: "solid", color: "E5E7EB", pt: 1 },
      autoPage: false,
    });
  }

  // ── 部員別未収残高 ────────────────────
  if (report.memberBalances.length > 0) {
    const bal = pptx.addSlide();
    bal.addText("部員別 未収残高", {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 22,
      bold: true,
      color: NAVY,
    });
    const balRows: PptxGenJS.TableRow[] = [
      [
        { text: "氏名", options: { bold: true, fill: { color: LIGHT } } },
        { text: "区分", options: { bold: true, fill: { color: LIGHT } } },
        { text: "残高(未払い)", options: { bold: true, fill: { color: LIGHT } } },
      ],
      ...report.memberBalances
        .slice(0, 18)
        .map((m) => [cell(m.name), cell(m.type), cell(YEN(m.balance))]),
    ];
    bal.addTable(balRows, {
      x: 0.5,
      y: 1.1,
      w: 9,
      fontSize: 11,
      border: { type: "solid", color: "E5E7EB", pt: 1 },
      autoPage: false,
    });
  }

  const data = await pptx.write({ outputType: "nodebuffer" });
  return data as Buffer;
}
