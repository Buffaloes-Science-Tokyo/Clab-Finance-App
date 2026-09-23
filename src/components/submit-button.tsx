"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** 送信中は無効化してラベルを切り替えるボタン */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
