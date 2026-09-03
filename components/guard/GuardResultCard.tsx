import type { GuardResult } from "@/lib/guard/types";
import { TriangleAlert } from "lucide-react";
import { RiskBadge } from "./RiskBadge";
import { RiskScore } from "./RiskScore";
import { RedactedTextView } from "./RedactedTextView";

export function GuardResultCard({ result }: { result: GuardResult }) {
  const isWarnMode = result.metadata?.policyMode === "WARN";
  const hasWarnings = isWarnMode && result.findings.length > 0;

  return (
    <div className="card p-6">
      {/* Warn-mode notice. Uses the shared `.warn-card` callout instead of a
          hand-rolled yellow box, and a real icon instead of the ⚠️ emoji — an
          emoji renders at a different size and colour on every OS, which is why
          this notice looked different on Windows than on macOS. */}
      {hasWarnings && (
        <div className="warn-card mb-5">
          <div className="flex items-start gap-2.5">
            <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">Warning mode active</p>
              <p className="mt-1 text-amber-100/70">
                Content was flagged but allowed through with a warning. The original text has been
                replaced with a security notice. Review findings below for details.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-5">
        <RiskScore score={result.riskScore} />
        <div className="text-right">
          <RiskBadge action={result.action} />
          <p className="mt-2 text-sm text-slate-400">
            {hasWarnings
              ? "Request allowed with warning"
              : result.allowed
                ? "Request may continue"
                : "Request stopped"}
          </p>
        </div>
      </div>

      <p className="surface mt-6 p-4 text-sm leading-6 text-slate-300">{result.reason}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {result.riskTypes.map((type) => (
          <span key={type} className="badge-neutral">
            {type.replaceAll("_", " ")}
          </span>
        ))}
      </div>

      {result.findings.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-micro text-slate-500">Findings</p>
          <div className="space-y-2">
            {result.findings.map((finding, index) => (
              <div key={`${finding.label}-${index}`} className="surface p-4">
                <div className="flex justify-between gap-4">
                  <p className="font-medium text-slate-100">{finding.label}</p>
                  {/* Severity was `text-cyan` — the brand colour applied to a
                      severity value, which inverts its meaning. */}
                  <span className="text-xs font-semibold uppercase tracking-micro text-slate-500">
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{finding.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <RedactedTextView text={result.redactedText ?? result.safeText} />
      </div>
    </div>
  );
}
