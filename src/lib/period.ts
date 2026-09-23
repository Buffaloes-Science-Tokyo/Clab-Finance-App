import type { BudgetPeriodType } from "@prisma/client";

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYear(): string {
  return String(new Date().getFullYear());
}

export function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

/** "2026-09" の月初〜月末（翌月初の直前）の範囲を返す */
export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/** "2026-Q3" の範囲を返す */
export function quarterRange(quarter: string): { start: Date; end: Date } {
  const [yStr, qStr] = quarter.split("-Q");
  const y = Number(yStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + 3, 1);
  return { start, end };
}

/** "2026" の範囲を返す */
export function yearRange(year: string): { start: Date; end: Date } {
  const y = Number(year);
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);
  return { start, end };
}

export function periodRange(
  periodType: BudgetPeriodType,
  period: string
): { start: Date; end: Date } {
  switch (periodType) {
    case "MONTH":
      return monthRange(period);
    case "QUARTER":
      return quarterRange(period);
    case "YEAR":
      return yearRange(period);
  }
}

export function periodLabel(periodType: BudgetPeriodType, period: string): string {
  switch (periodType) {
    case "MONTH": {
      const [y, m] = period.split("-");
      return `${y}年${Number(m)}月`;
    }
    case "QUARTER": {
      const [y, q] = period.split("-Q");
      return `${y}年 第${q}四半期`;
    }
    case "YEAR":
      return `${period}年`;
  }
}

export function monthsInQuarter(quarter: string): string[] {
  const [yStr, qStr] = quarter.split("-Q");
  const y = Number(yStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  return [0, 1, 2].map(
    (i) => `${y}-${String(startMonth + i + 1).padStart(2, "0")}`
  );
}

export function monthsInYear(year: string): string[] {
  return Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );
}
