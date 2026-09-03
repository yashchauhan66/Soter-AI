import { cn } from "@/lib/utils";

/**
 * Risk score readout, 0–100.
 *
 * The four-step colour ramp is kept — here colour genuinely encodes severity,
 * which is the one case where an accent earns its place. What changed is the
 * weight and size: `text-4xl font-black` made the score the loudest element on
 * the playground, louder than the verdict beside it, even at a score of 0.
 */
export function RiskScore({ score }: { score: number }) {
  const color =
    score > 85 ? "text-rose-300" : score > 60 ? "text-orange-300" : score > 30 ? "text-amber-300" : "text-emerald-300";

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-slate-500">Risk score</p>
      <p data-numeric className={cn("mt-1 text-3xl font-semibold", color)}>
        {score}
        <span className="text-base font-normal text-slate-600">/100</span>
      </p>
    </div>
  );
}
