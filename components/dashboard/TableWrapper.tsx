"use client";

import { ReactNode } from "react";

/**
 * Responsive table wrapper that adds horizontal scroll on mobile
 * and shows a scroll hint on first load.
 * Wrap any <table> element with this component.
 */
export function TableWrapper({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="inline-block min-w-full align-middle">{children}</div>
    </div>
  );
}

/**
 * Mobile-friendly card grid that replaces table layout on small screens.
 * Shows a label-value pair layout instead of columns.
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
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:hidden">
      {items.map((item) => (
        <div
          key={keyExtractor(item)}
          className="card divide-y divide-slate-800 p-4 text-sm"
        >
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}
