"use client";

import type { ReactNode } from "react";

type Props = {
  action: (formData: FormData) => void;
  getConfirmMessage: (decision?: string) => string;
  children: ReactNode;
  className?: string;
};

export function ConfirmableForm({ action, getConfirmMessage, children, className }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as any).submitter as HTMLButtonElement | null;
        const decision = submitter?.value;
        if (!confirm(getConfirmMessage(decision))) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </form>
  );
}
