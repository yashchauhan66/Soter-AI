import Link from "next/link";

import { LogsTable } from "@/components/dashboard/LogsTable";
import { LogsFilterBar, type LogFilterState } from "@/components/dashboard/LogsFilterBar";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { listGuardEventsByProject } from "@/lib/events/store";
import { parseLogFilters } from "@/lib/guard/logFilters";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

// Risk types are a finite, non-sensitive vocabulary; surface the recent set as
// filter suggestions without scanning the full table.
const RISK_TYPE_SUGGESTION_SCAN = 200;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    action?: string;
    direction?: string;
    riskType?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);

  // A `to` date (YYYY-MM-DD) should be inclusive of that whole day.
  const toInclusive = params.to ? `${params.to}T23:59:59.999Z` : undefined;
  const filters = parseLogFilters({
    action: params.action,
    direction: params.direction,
    riskType: params.riskType,
    from: params.from,
    to: toInclusive,
    cursor: params.cursor,
    limit: params.limit,
  });

  const [page, recentPage] = await Promise.all([
    listGuardEventsByProject(project.id, {
      limit: filters.limit,
      cursor: params.cursor,
      from: filters.from,
      to: filters.to,
      decision: filters.action,
      direction: filters.direction,
      category: filters.riskType,
    }),
    listGuardEventsByProject(project.id, {
      limit: RISK_TYPE_SUGGESTION_SCAN,
    }),
  ]);

  const logs = page.items;
  const nextCursor = page.nextCursor;
  const riskTypeOptions = Array.from(new Set(recentPage.items.flatMap((row) => row.riskTypes))).sort();

  const filterState: LogFilterState = {
    project: project.id,
    action: params.action,
    direction: params.direction,
    riskType: params.riskType,
    from: params.from,
    to: params.to,
  };

  const nextHref = nextCursor
    ? `/dashboard/logs?${new URLSearchParams({
        project: project.id,
        ...(params.action ? { action: params.action } : {}),
        ...(params.direction ? { direction: params.direction } : {}),
        ...(params.riskType ? { riskType: params.riskType } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        cursor: nextCursor,
      }).toString()}`
    : null;

  const isPaged = Boolean(params.cursor);
  const firstPageHref = `/dashboard/logs?${new URLSearchParams({
    project: project.id,
    ...(params.action ? { action: params.action } : {}),
    ...(params.direction ? { direction: params.direction } : {}),
    ...(params.riskType ? { riskType: params.riskType } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.limit ? { limit: params.limit } : {}),
  }).toString()}`;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Audit trail"
        title="Guard logs"
        description="A searchable, redacted record of every guard decision — what was allowed, blocked, or flagged — across your project's inbound prompts and outbound responses."
        useCase="When an agent misbehaves or a customer disputes a block, you need to see exactly what the guard decided and why. Guard logs give you that timeline: filter by decision, direction, risk type, and date range to trace an incident or prove what your controls caught. Sensitive values are only ever stored redacted."
        howItWorks={[
          { heading: "Every decision is recorded", body: "Each time the guard evaluates a prompt or response, the decision, direction, and detected risk types are written to the log for the project." },
          { heading: "Filter and search", body: "Narrow the view by decision (allow, block, flag), direction (inbound or outbound), risk type, and a date range to find the events you care about." },
          { heading: "Page through history", body: "Results are cursor-paged newest-first, so you can walk back through the full history without loading everything at once." },
          { heading: "Redacted by design", body: "Detected secrets and sensitive spans are shown and stored only in redacted form — the raw values are never persisted in the log." },
        ]}
        callout="Logs reflect only traffic sent through the guard. Requests that bypass SoterAI are not recorded here."
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <p className="mb-5 mt-3 text-slate-400">Sensitive values are displayed and stored only in redacted form.</p>
      <LogsFilterBar filters={filterState} riskTypeOptions={riskTypeOptions} />
      <LogsTable logs={logs} />
      <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Logs pagination">
        <div>
          {isPaged && (
            <Link href={firstPageHref} className="button-secondary">First page</Link>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Showing up to {filters.limit} decisions per page, newest first.
        </div>
        <div>
          {nextHref ? (
            <Link href={nextHref} className="button-secondary">Next page</Link>
          ) : (
            <span className="text-xs text-slate-600">No more results</span>
          )}
        </div>
      </nav>
    </div>
  );
}
