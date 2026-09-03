import { cn } from "@/lib/utils";
import { BRAND, INK, SEVERITY } from "@/lib/brand";

/**
 * Chart primitives — dependency-free SVG.
 *
 * ## Why not Recharts / Chart.js
 *
 * The console has exactly two chart shapes: a ranked bar list (`RiskChart`) and a
 * volume-over-time trend. Recharts costs ~95 kB gzipped, forces every chart into a
 * client component (it measures the DOM), and renders its own tooltip/legend
 * chrome that would then have to be restyled to match this design system —
 * reintroducing the visual drift Phase 1 removed.
 *
 * These render as static SVG in a **server component**: no client JS, no
 * hydration, no layout measurement, and they inherit the palette directly.
 *
 * ## Accessibility approach
 *
 * An SVG chart is meaningless to a screen reader no matter how it is labelled, so
 * each chart pairs a `role="img"` graphic with a `<figcaption>`-style summary and,
 * for `TrendChart`, a visually-hidden `<table>` carrying the actual figures. That
 * is the accessible route to the same information, not a substitute label.
 */

// ── Sparkline / trend ───────────────────────────────────────────────────

export interface TrendPoint {
  /** Short axis label, e.g. "12 Aug" or "Mon". */
  label: string;
  value: number;
}

/**
 * Area + line trend over an ordered series.
 *
 * Renders in a normalised 0–100 × 0–100 viewBox with
 * `preserveAspectRatio="none"`, so the same path stretches to any container size
 * without recomputation. The stroke uses `vector-effect="non-scaling-stroke"`,
 * which is what keeps the line 1.5px thick instead of being smeared horizontally
 * by that non-uniform scale — the single most common defect in hand-rolled SVG
 * charts.
 */
export function TrendChart({
  data,
  label,
  height = 120,
  tone = "brand",
  className,
}: {
  data: TrendPoint[];
  /** What the series measures, e.g. "Blocked requests per day". */
  label: string;
  height?: number;
  tone?: "brand" | "danger" | "neutral";
  className?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className={cn("surface flex items-center justify-center text-xs text-slate-500", className)}
        style={{ height }}
      >
        Not enough data to plot a trend yet.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = 100 / (data.length - 1);

  // y is inverted: SVG grows downward, a chart grows upward.
  const points = data.map((d, i) => ({ x: i * stepX, y: 100 - (d.value / max) * 100 }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;

  const stroke = TREND_STROKE[tone];
  const fillFrom = TREND_FILL[tone];
  const gradientId = `trend-${tone}`;

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillFrom} stopOpacity="0.28" />
            <stop offset="100%" stopColor={fillFrom} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Endpoint labels only. A label under every point overlaps below ~8 points
          and is unreadable above it; the range is what a reader needs. */}
      <figcaption className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </figcaption>

      {/* The figures themselves, for assistive tech and for copy/paste. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * SVG series colours.
 *
 * `stroke` and `fill` on an inline SVG cannot read a utility class, so these come
 * from `lib/brand.ts` — the same literals the email templates and the embeddable
 * badge use, which keeps every non-CSS surface on one palette.
 *
 * The brand step is `BRAND` (#c2410c), not the logo's #f96403: a chart line is a
 * 1.5px graphic on white, and the lighter step disappears at that weight.
 */
const TREND_STROKE = {
  brand: BRAND,
  danger: SEVERITY.critical,
  neutral: INK.faint,
} as const;

const TREND_FILL = TREND_STROKE;

// ── Ranked bar list ─────────────────────────────────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  /**
   * Overrides the rank-derived tone. Use when the series has real severity
   * semantics rather than "biggest first" — e.g. a status breakdown where
   * `Blocked` should read as danger regardless of its position.
   */
  tone?: BarTone;
}

type BarTone = "danger" | "warning" | "neutral" | "brand";

const BAR_FILL: Record<BarTone, string> = {
  danger: "bg-rose-400/80",
  warning: "bg-amber-400/80",
  neutral: "bg-slate-500",
  brand: "bg-cyan/70",
};

/**
 * Horizontal ranked bars.
 *
 * Bars are proportional to the **maximum**, not the total. For a "top N risk
 * types" list the reader's question is "how does #2 compare to #1", and scaling
 * to the total makes every bar tiny as soon as the tail is long.
 *
 * Tone defaults to rank (1st = danger, 2nd = warning, rest = neutral) because
 * these lists are almost always severity-ordered. `showShare` adds the percentage
 * for cases where absolute counts are not self-explanatory.
 */
export function BarList({
  data,
  emptyMessage = "No data recorded for this period.",
  showShare = false,
  className,
}: {
  data: BarDatum[];
  emptyMessage?: string;
  showShare?: boolean;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className={cn("text-sm text-slate-400", className)}>{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <ol className={cn("space-y-3.5", className)}>
      {data.map((item, index) => {
        const tone: BarTone = item.tone ?? (index === 0 ? "danger" : index === 1 ? "warning" : "neutral");
        const width = (item.value / max) * 100;

        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-slate-300">{item.label}</span>
              <span data-numeric className="shrink-0 font-medium text-slate-400">
                {item.value}
                {showShare && (
                  <span className="ml-1.5 text-slate-600">{Math.round((item.value / total) * 100)}%</span>
                )}
              </span>
            </div>

            {/* The count above is the accessible value; the bar is decorative
                reinforcement, hence role="presentation" rather than a redundant
                aria-label that a screen reader would announce twice. */}
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" role="presentation">
              <div className={cn("h-full rounded-full", BAR_FILL[tone])} style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Composition meter ───────────────────────────────────────────────────

/**
 * Single-bar breakdown of a whole into labelled segments.
 *
 * Used where a stacked bar or donut would otherwise appear. A donut costs a
 * charting library and is harder to read than a 6px bar with a legend: comparing
 * arc lengths is measurably slower than comparing lengths along one axis.
 *
 * Segments with a zero value are dropped rather than rendered at 0% — a 0-width
 * div still contributes to the flex gap and produces visible seams.
 */
export function CompositionBar({
  segments,
  label,
  className,
}: {
  segments: Array<{ label: string; value: number; tone: BarTone }>;
  /** What the whole represents, e.g. "Guard decisions this month". */
  label: string;
  className?: string;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className={cn("text-sm text-slate-400", className)}>No decisions recorded yet.</p>;
  }

  return (
    <div className={className}>
      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-slate-800"
        role="img"
        aria-label={`${label}: ${visible.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        {visible.map((segment) => (
          <div
            key={segment.label}
            className={BAR_FILL[segment.tone]}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {visible.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-xs">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", BAR_FILL[segment.tone])} aria-hidden="true" />
            <span className="text-slate-400">{segment.label}</span>
            <span data-numeric className="font-medium text-slate-200">
              {segment.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
