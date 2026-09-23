import { NextRequest, NextResponse } from "next/server";
import type { BudgetPeriodType } from "@prisma/client";
import { getPeriodReport } from "@/server/reports";
import { buildReportPptx } from "@/server/pptx";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodType = searchParams.get("periodType") as BudgetPeriodType | null;
  const period = searchParams.get("period");

  if (!periodType || !period || !["MONTH", "QUARTER", "YEAR"].includes(periodType)) {
    return NextResponse.json(
      { error: "periodType と period は必須です" },
      { status: 400 }
    );
  }

  const report = await getPeriodReport(periodType, period);
  const buffer = await buildReportPptx(report);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="report_${periodType}_${period}.pptx"`,
    },
  });
}
