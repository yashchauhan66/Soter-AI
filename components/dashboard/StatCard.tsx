import type { LucideIcon } from "lucide-react";

/**
 * Compact metric tile with a leading icon.
 *
 * Distinct from `MetricCard` (which is label-above-value) in that the icon is the
 * primary visual anchor — used where a page shows four or fewer headline figures.
 *
 * The value is `data-numeric` so digits render tabular-width; without it a metric
 * row visibly reflows every time a count ticks over.
 *
 * The icon chip is neutral, not teal. It was `border-cyan/20 bg-cyan/10
 * text-cyan`, which meant every StatCard on a page carried a brand-coloured
 * badge next to a number that had nothing to do with the brand — four tiles in a
 * row produced four teal blocks and no visual hierarchy at all.
 */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  /** Short qualifier: the window covered, or the denominator. */
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{label}</p>
          <p data-numeric className="mt-2 text-2xl font-semibold text-slate-100">
            {value}
          </p>
          {detail && <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>}
        </div>
        <span className="shrink-0 rounded-md border border-slate-700/60 bg-slate-900/60 p-2 text-slate-400">
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

