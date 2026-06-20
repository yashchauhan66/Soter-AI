import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title = "No data yet",
  message,
  actionLabel,
  actionHref,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <section className="card flex flex-col items-center justify-center gap-4 p-12 text-center">
      <span className="rounded-full bg-slate-800/50 p-4 text-slate-500">
        <Icon size={32} />
      </span>
      <div>
        <p className="font-semibold text-slate-300">{title}</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      </div>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="button-secondary gap-2 text-sm"
        >
          {actionLabel} →
        </a>
      )}
    </section>
  );
}
