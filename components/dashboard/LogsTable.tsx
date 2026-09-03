import { RiskBadge } from "@/components/guard/RiskBadge";
import { Table, THead, TBody, TH, TR, TD } from "@/components/ui/DataTable";
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
        <h3 className="font-semibold text-slate-100">No guard decisions yet</h3>
        <p className="mt-2 text-sm text-slate-400">Requests sent through input or output guard will appear here.</p>
      </div>
    );
  }

  return (
    /**
     * Guard decision log.
     *
     * Uses the shared table primitives from `components/ui/DataTable.tsx`, which
     * own the sticky header, the row rule weight, and the numeric-column
     * alignment. Before that existed, this file was one of eleven different
     * `<thead>` treatments in the codebase.
     *
     * Two conventions worth noting at this call site:
     *
     * - **Risk score is a numeric column** (`<TH numeric>` / `<TD numeric>`), so
     *   it is right-aligned with tabular figures. It is the one column a reader
     *   scans vertically, and proportional digits make that ragged.
     * - **Rows are `interactive`** because each one opens a details disclosure.
     *   A hover response on a row that does nothing would be a false affordance.
     */
    <div className="card overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <Table label="Guard decisions" minWidth="54rem">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Direction</TH>
              <TH>Action</TH>
              <TH numeric>Risk</TH>
              <TH>Risk types</TH>
              <TH>Reason</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((log) => {
              const findings = readFindings(log.metadata);
              const displayText = log.redactedText ?? log.safeText;
              return (
                <TR key={log.id} interactive>
                  <TD numeric className="whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </TD>
                  <TD className="text-slate-400">{log.direction}</TD>
                  <TD>
                    <RiskBadge action={log.action} />
                  </TD>
                  <TD numeric className="font-semibold text-slate-100">
                    {log.riskScore}
                  </TD>
                  <TD className="max-w-48 text-xs text-slate-400">{log.riskTypes.join(", ")}</TD>
                  <TD className="max-w-72">{log.reason}</TD>
                  <TD>
                    <details className="min-w-64">
                      <summary className="cursor-pointer text-sm font-medium text-cyan hover:underline">
                        View details
                      </summary>
                      <div className="surface mt-3 space-y-3 p-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-micro text-slate-500">
                            Redacted / safe text
                          </p>
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                            {displayText ?? "No text retained for this decision."}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-micro text-slate-500">Findings</p>
                          {findings.length ? (
                            findings.map((finding, index) => (
                              <div
                                className="mt-2 border-t border-slate-800 pt-2 first:mt-1.5 first:border-t-0 first:pt-0"
                                key={`${finding.label}-${index}`}
                              >
                                <p className="text-xs font-semibold text-slate-200">
                                  {finding.label} · {finding.severity}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">{finding.message}</p>
                              </div>
                            ))
                          ) : (
                            <p className="mt-1.5 text-xs text-slate-400">No material findings.</p>
                          )}
                        </div>
                        <FeedbackButtons guardLogId={log.id} />
                      </div>
                    </details>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
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
