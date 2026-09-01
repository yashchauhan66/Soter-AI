"use client";

import { ReactNode } from "react";

/**
 * Table container.
 *
 * The previous version wrapped a table in `overflow-x-auto` and stopped there,
 * which produces two real problems on a security console full of wide log tables:
 *
 * 1. **The scroll region was not keyboard reachable.** A scrollable div with no
 *    `tabindex` cannot be scrolled by keyboard alone, so a keyboard-only operator
 *    could not read the right-hand columns of the Logs table at all.
 * 2. **Nothing indicated more content existed.** A table clipped at the viewport
 *    edge looks like a complete table. The right-edge fade makes the cut visible.
 *
 * `role="region"` + `aria-label` announce it as a scrollable landmark; `tabIndex={0}`
 * makes it focusable so arrow keys scroll it.
 */
export function TableWrapper({
  children,
  className = "",
  label = "Data table",
}: {
  children: ReactNode;
  className?: string;
  /** Announced name for the scroll region. Name the data, e.g. "Guard events". */
  label?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="inline-block min-w-full align-middle">{children}</div>
      </div>

      {/* Right-edge fade, signalling horizontally clipped content. Decorative and
          pointer-events-none so it never blocks a click on the last column. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ink to-transparent sm:hidden"
      />
    </div>
  );
}

/**
 * Card layout that replaces a table below `sm`.
 *
 * A six-column table on a 375px screen is unreadable regardless of how well it
 * scrolls, so narrow viewports get label/value cards instead.
 */
export function MobileCardView<T>({
  items,
  keyExtractor,
  renderCard,
  emptyMessage = "No data available.",
}: {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <div className="surface p-8 text-center text-sm text-slate-400 sm:hidden">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3 sm:hidden">
      {items.map((item) => (
        <div key={keyExtractor(item)} className="card divide-y divide-slate-800 p-4 text-sm">
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}
