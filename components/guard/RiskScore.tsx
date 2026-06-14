import { cn } from "@/lib/utils";

export function RiskScore({ score }: { score: number }) {
  const color = score > 85 ? "text-red-300" : score > 60 ? "text-orange-300" : score > 30 ? "text-amber-300" : "text-emerald-300";
  return <div><p className="text-xs uppercase tracking-wider text-slate-500">Risk score</p><p className={cn("mt-1 text-4xl font-black", color)}>{score}<span className="text-base text-slate-600">/100</span></p></div>;
}
