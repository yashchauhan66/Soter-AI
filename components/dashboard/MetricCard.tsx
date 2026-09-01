/**
 * Shared dashboard primitives.
 *
 * `MetricCard` is used in 73 places, so the existing `{ label, value, tone }`
 * signature is preserved exactly. Everything added is optional.
 *
 * What changed and why:
 *
 * - **Metrics now carry meaning.** A bare number ("14") tells an operator
 *   nothing: 14 blocked requests is good news, 14 pending approvals is a
 *   backlog. The optional `hint` and `delta` props let a page say which — and
 *   `delta` requires an explicit `deltaIsGood` because "up" is not universally
 *   positive on a security console.
 * - **Tabular figures.** Values are `data-numeric`, so digits stay
 *   monospaced-width and a metric grid does not jitter as numbers change.
 * - **StatusBadge shows labels, not enums.** See `lib/dashboard/status.ts`.
 */

import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { getStatusClass, getStatusMeta, RISK_LEVEL } from "@/lib/dashboard/status";

// ── MetricCard ──────────────────────────────────────────────────────────

/** Legacy tone names, kept so all 73 existing call sites work unchanged. */
const VALUE_TONES: Record<string, string> = {
  yellow: "text-amber-300",
  red: "text-rose-300",
  gray: "text-slate-100",
  cyan: "text-cyan",
  blue: "text-sky-300",
  green: "text-emerald-300",
};

export function MetricCard({
  label,
  value,
  tone = "gray",
  hint,
  delta,
  deltaIsGood,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: "yellow" | "red" | "gray" | "cyan" | "blue" | "green";
  /** One line of context: what this number means, or the window it covers. */
  hint?: string;
  /** Change vs the previous period, pre-formatted (e.g. "+12%", "-3"). */
  delta?: string;
  /**
   * Whether an increase is good. Required alongside `delta` because direction
   * alone is meaningless here: more blocked attacks is good, more failed
   * deliveries is not. Omitting it renders the delta in neutral grey.
   */
  deltaIsGood?: boolean;
  icon?: LucideIcon;
}) {
  const trendUp = delta?.trim().startsWith("+");
  const trendFlat = !delta || /^[+-]?0(\.0+)?%?$/.test(delta.trim());

  const deltaTone =
    deltaIsGood === undefined || trendFlat
      ? "text-slate-400"
      : trendUp === deltaIsGood
        ? "text-emerald-300"
        : "text-rose-300";

  const TrendIcon = trendFlat ? Minus : trendUp ? TrendingUp : TrendingDown;

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        {Icon && (
          <span className="shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 p-1.5 text-slate-400">
            <Icon size={15} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2.5">
        <p data-numeric className={`text-2xl font-bold ${VALUE_TONES[tone] ?? VALUE_TONES.gray}`}>
          {value}
        </p>
        {delta && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${deltaTone}`}>
            <TrendIcon size={12} aria-hidden="true" />
            {delta}
          </span>
        )}
      </div>

      {hint && <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p>}
    </section>
  );
}

// ── StatusBadge ─────────────────────────────────────────────────────────

export function StatusBadge({ value }: { value: string }) {
  const { label } = getStatusMeta(value);
  return (
    // `title` keeps the raw enum reachable for support and debugging without
    // showing it to every operator.
    <span className={getStatusClass(value)} title={value}>
      {label}
    </span>
  );
}

// ── RiskLevel ───────────────────────────────────────────────────────────

export function RiskLevel({ level }: { level: string }) {
  const meta = RISK_LEVEL[level];
  return (
    <span className={`text-xs font-bold ${meta?.className ?? "text-slate-300"}`}>
      {meta?.label ?? level}
    </span>
  );
}

// ── PayloadViewer ───────────────────────────────────────────────────────

export function PayloadViewer({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-micro text-slate-400">{title}</p>
      <pre className="mt-1.5 max-h-36 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs leading-6 text-slate-300">
        {value ?? "No data supplied."}
      </pre>
    </div>
  );
}

// ── EmptyRow ────────────────────────────────────────────────────────────

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td className="py-10 text-center text-sm text-slate-400" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

// ── SafeJson helper ─────────────────────────────────────────────────────

export function safeJson(value: unknown, fallback = "No data."): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Data could not be formatted.";
  }
}
