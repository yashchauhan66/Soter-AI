import { cn } from "@/lib/utils";

export function RiskBadge({ action }: { action: string }) {
  const styles = action === "BLOCK" ? "bg-red-500/15 text-red-300" : action === "ALLOW" ? "bg-emerald-500/15 text-emerald-300" : action === "ALLOW_WITH_REDACTION" ? "bg-amber-500/15 text-amber-300" : "bg-violet-500/15 text-violet-300";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", styles)}>{action.replaceAll("_", " ")}</span>;
}
