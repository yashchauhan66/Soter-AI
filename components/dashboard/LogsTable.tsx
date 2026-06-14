import { RiskBadge } from "@/components/guard/RiskBadge";
import { formatDate } from "@/lib/utils";
import { FeedbackButtons } from "./FeedbackButtons";

interface StoredFinding {
  type: string;
  label: string;
  severity: string;
  score: number;
  message: string;
}

export interface LogRow {
  id: string;
  createdAt: Date | string;
  direction: string;
  action: string;
  riskScore: number;
  riskTypes: string[];
  reason: string;
  redactedText?: string | null;
  safeText?: string | null;
  metadata?: unknown;
}

export function LogsTable({ logs }: { logs: LogRow[] }) {
  if (!logs.length) {
    return (
      <div className="card p-10 text-center">
        <h3 className="font-semibold">No guard decisions yet</h3>
        <p className="mt-2 text-sm text-slate-500">Requests sent through input or output guard will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {['Date', 'Direction', 'Action', 'Risk', 'Risk types', 'Reason', 'Details'].map((label) => (
              <th className="px-4 py-3" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {logs.map((log) => {
            const findings = readFindings(log.metadata);
            const displayText = log.redactedText ?? log.safeText;
            return (
              <tr key={log.id} className="align-top hover:bg-slate-900/50">
                <td className="whitespace-nowrap px-4 py-4 text-slate-400">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-4">{log.direction}</td>
                <td className="px-4 py-4"><RiskBadge action={log.action} /></td>
                <td className="px-4 py-4 font-bold">{log.riskScore}</td>
                <td className="max-w-48 px-4 py-4 text-xs text-slate-400">{log.riskTypes.join(", ")}</td>
                <td className="max-w-72 px-4 py-4 text-slate-400">{log.reason}</td>
                <td className="px-4 py-4">
                  <details className="min-w-64">
                    <summary className="cursor-pointer font-medium text-cyan">View details</summary>
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Redacted / safe text</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-300">
                          {displayText ?? "No text retained for this decision."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Findings</p>
                        {findings.length ? findings.map((finding, index) => (
                          <div className="mt-2 border-t border-slate-800 pt-2" key={`${finding.label}-${index}`}>
                            <p className="text-xs font-semibold">{finding.label} · {finding.severity}</p>
                            <p className="mt-1 text-xs text-slate-500">{finding.message}</p>
                          </div>
                        )) : <p className="mt-1 text-xs text-slate-500">No material findings.</p>}
                      </div>
                      <FeedbackButtons guardLogId={log.id} />
                    </div>
                  </details>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function readFindings(metadata: unknown): StoredFinding[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const findings = (metadata as Record<string, unknown>).findings;
  if (!Array.isArray(findings)) return [];
  return findings.filter((finding): finding is StoredFinding => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return false;
    const value = finding as Record<string, unknown>;
    return typeof value.label === "string" && typeof value.message === "string";
  });
}
