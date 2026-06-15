import Link from "next/link";

import { LOG_ACTIONS, LOG_DIRECTIONS, type LogAction, type LogDirection } from "@/lib/guard/logFilters";

export interface LogFilterState {
  project: string;
  action?: string;
  direction?: string;
  riskType?: string;
  from?: string;
  to?: string;
}

const ACTION_LABELS: Record<LogAction, string> = {
  ALLOW: "Allow",
  ALLOW_WITH_REDACTION: "Allow + redact",
  REWRITE: "Rewrite",
  BLOCK: "Block",
  HUMAN_REVIEW: "Human review",
};

const DIRECTION_LABELS: Record<LogDirection, string> = {
  INPUT: "Input",
  OUTPUT: "Output",
  ANALYZE: "Analyze",
};

// Server-rendered GET form: filters are URL params so they are shareable,
// bookmarkable, and reset pagination naturally (no cursor carried over).
export function LogsFilterBar({ filters, riskTypeOptions }: { filters: LogFilterState; riskTypeOptions: string[] }) {
  const hasActiveFilter = Boolean(filters.action || filters.direction || filters.riskType || filters.from || filters.to);
  return (
    <form method="GET" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="project" value={filters.project} />
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Decision
        <select name="action" defaultValue={filters.action ?? ""} className="input">
          <option value="">All decisions</option>
          {LOG_ACTIONS.map((value) => (
            <option key={value} value={value}>{ACTION_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Direction
        <select name="direction" defaultValue={filters.direction ?? ""} className="input">
          <option value="">All directions</option>
          {LOG_DIRECTIONS.map((value) => (
            <option key={value} value={value}>{DIRECTION_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Risk type
        <input
          name="riskType"
          defaultValue={filters.riskType ?? ""}
          list="log-risk-types"
          placeholder="Any risk type"
          maxLength={64}
          className="input"
        />
        <datalist id="log-risk-types">
          {riskTypeOptions.map((value) => <option key={value} value={value} />)}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        From
        <input type="date" name="from" defaultValue={filters.from ?? ""} className="input" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        To
        <input type="date" name="to" defaultValue={filters.to ?? ""} className="input" />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className="button-primary flex-1">Apply</button>
        {hasActiveFilter && (
          <Link href={`/dashboard/logs?project=${encodeURIComponent(filters.project)}`} className="button-secondary">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
