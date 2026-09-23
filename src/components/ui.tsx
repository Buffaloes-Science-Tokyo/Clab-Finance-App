import type { ReactNode } from "react";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-5 shadow-sm ${className}`}
    >
      {title && (
        <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      )}
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-white border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

export const dangerButtonClass =
  "inline-flex items-center justify-center rounded-md bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}
