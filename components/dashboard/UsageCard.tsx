import { CircleDollarSign } from "lucide-react";

interface Props {
  plan: string;
  used: number;
  limit: number;
  warning?: boolean;
  exceeded?: boolean;
}

export function UsageCard({ plan, used, limit, warning, exceeded }: Props) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const tone = exceeded ? "bg-red-400" : warning ? "bg-amber-400" : "bg-cyan";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-cyan/10 p-2 text-cyan"><CircleDollarSign size={18} /></span>
          <p className="text-sm text-slate-500">Plan usage</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold">{plan}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{used.toLocaleString("en-IN")}<span className="text-sm font-normal text-slate-500"> / {limit.toLocaleString("en-IN")}</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      {exceeded
        ? <p className="mt-3 text-xs text-red-300">Monthly limit exceeded. Upgrade to resume guarded traffic.</p>
        : warning
          ? <p className="mt-3 text-xs text-amber-200">Above 80% of your monthly quota.</p>
          : <p className="mt-3 text-xs text-slate-500">Healthy usage, well under quota.</p>}
    </div>
  );
}
