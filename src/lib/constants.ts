import type { MemberType, LedgerEntryType, TransactionType, BudgetPeriodType } from "@prisma/client";

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  PLAYER: "選手",
  STAFF: "スタッフ",
  STUDENT_COACH: "学生コーチ",
  WORKING_ADULT: "社会人",
  WITHDRAWN: "退部",
  OTHER: "?",
};

export const MEMBER_TYPE_OPTIONS = Object.entries(MEMBER_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as MemberType, label })
);

// 部費請求の対象からデフォルトで外すタイプ
export const DUES_EXCLUDED_TYPES: MemberType[] = ["WITHDRAWN", "OTHER"];

export const LEDGER_ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  DUES_CHARGE: "部費請求",
  TAB_CHARGE: "ツケ",
  PAYMENT: "入金・精算",
  ADJUSTMENT: "手動調整",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "収入",
  EXPENSE: "支出",
};

export const BUDGET_PERIOD_TYPE_LABELS: Record<BudgetPeriodType, string> = {
  MONTH: "月次",
  QUARTER: "四半期",
  YEAR: "年次",
};

export const PAYMENT_METHODS = ["現金", "銀行振込", "電子マネー", "その他"];
