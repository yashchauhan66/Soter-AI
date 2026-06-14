import type { GuardResult } from "@/lib/guard/types";
import { RiskBadge } from "./RiskBadge";
import { RiskScore } from "./RiskScore";
import { RedactedTextView } from "./RedactedTextView";

export function GuardResultCard({ result }: { result: GuardResult }) {
  return <div className="card p-6"><div className="flex flex-wrap items-start justify-between gap-5"><RiskScore score={result.riskScore} /><div className="text-right"><RiskBadge action={result.action}/><p className="mt-2 text-sm text-slate-500">{result.allowed ? "Request may continue" : "Request stopped"}</p></div></div><p className="mt-6 rounded-xl bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">{result.reason}</p><div className="mt-5 flex flex-wrap gap-2">{result.riskTypes.map(type=><span key={type} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{type.replaceAll("_", " ")}</span>)}</div>{result.findings.length > 0 && <div className="mt-6"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Findings</p><div className="space-y-2">{result.findings.map((finding, index)=><div key={`${finding.label}-${index}`} className="rounded-xl border border-slate-800 p-4"><div className="flex justify-between gap-4"><p className="font-medium">{finding.label}</p><span className="text-xs font-bold text-cyan">{finding.severity}</span></div><p className="mt-1 text-sm text-slate-400">{finding.message}</p></div>)}</div></div>}<div className="mt-6"><RedactedTextView text={result.redactedText ?? result.safeText}/></div></div>;
}
