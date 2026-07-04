import Link from "next/link";

import { LogsTable } from "@/components/dashboard/LogsTable";
import { LogsFilterBar, type LogFilterState } from "@/components/dashboard/LogsFilterBar";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { listGuardEventsByProject } from "@/lib/events/store";
import { parseLogFilters } from "@/lib/guard/logFilters";

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
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1 className="mt-2 text-3xl font-bold">Guard logs</h1>
        </div>
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
