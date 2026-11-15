import type { LucideIcon } from "lucide-react";
import { ArrowRight, Inbox } from "lucide-react";

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
    <section className="docs-empty-state">
      <Icon size={20} aria-hidden="true" className="docs-empty-icon" />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
        {actionLabel && actionHref && (
          <a href={actionHref}>{actionLabel}<ArrowRight size={14} aria-hidden="true" /></a>
        )}
      </div>
    </section>
  );
}
