import { Shield, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { RunRedTeamButton } from "@/components/dashboard/RunRedTeamButton";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { getOrCreateSuite, getRedTeamSummary } from "@/lib/redteam/lab";

export const dynamic = "force-dynamic";

export default async function RedTeamLabPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, _projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "redteam:read");

  const orgId = project.organizationId ?? "";
  await getOrCreateSuite(orgId, project.id);
  const { latestRun, suite, trends } = await getRedTeamSummary(orgId, project.id);

  const TrendIcon = trends.trend === "improving" ? TrendingUp
    : trends.trend === "declining" ? TrendingDown : Minus;

  const passRate = latestRun && (latestRun.passed + latestRun.failed) > 0
    ? Math.round((latestRun.passed / (latestRun.passed + latestRun.failed)) * 100)
    : 0;

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Authorized testing</p>
        <h1 className="mt-2 text-3xl font-bold">AI Red Team Lab</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Automatically test your guard policies against known attack patterns including
          prompt injection, jailbreaks, PII exfiltration, tool misuse, and more. Each run
          executes non-destructive test prompts against your policies and reports results.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <Shield className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Total runs</p>
          <p className="mt-1 text-2xl font-bold">{trends.totalRuns}</p>
        </div>
        <div className="card p-5">
          <CheckCircle2 className="mb-2 text-emerald-300" size={20} />
          <p className="text-sm text-slate-400">Pass rate</p>
          <p className="mt-1 text-2xl font-bold">
            {Math.round(trends.averagePassRate * 100)}%
          </p>
        </div>
        <div className="card p-5">
          <AlertTriangle className="mb-2 text-amber-300" size={20} />
          <p className="text-sm text-slate-400">Scenarios</p>
          <p className="mt-1 text-2xl font-bold">{suite?._count?.scenarios ?? 0}</p>
        </div>
        <div className="card p-5">
          <TrendIcon
            className={`mb-2 ${
              trends.trend === "improving"
                ? "text-emerald-300"
                : trends.trend === "declining"
                  ? "text-rose-300"
                  : "text-slate-500"
            }`}
            size={20}
          />
          <p className="text-sm text-slate-400">Trend</p>
          <p className="mt-1 text-2xl font-bold capitalize">{trends.trend}</p>
        </div>
      </div>

      {latestRun && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5">
          <p className="text-sm text-slate-400">Latest run</p>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-lg font-semibold">
              Passed: {latestRun.passed} · Failed: {latestRun.failed}
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                passRate >= 80
                  ? "bg-emerald-500/15 text-emerald-300"
                  : passRate >= 50
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {passRate}% pass rate
            </span>
            <span className="text-xs text-slate-500">
              {latestRun.completedAt?.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {trends.weakestCategories.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Weakest categories</h2>
          <div className="space-y-2">
            {trends.weakestCategories.map((cat) => (
              <div
                className="card flex items-center justify-between p-4"
                key={cat.category}
              >
                <div>
                  <p className="font-medium">{cat.category.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">{cat.totalTests} tests</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    cat.passRate >= 0.8
                      ? "bg-emerald-500/15 text-emerald-300"
                      : cat.passRate >= 0.5
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {Math.round(cat.passRate * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Run a red-team test</h2>
        <p className="mt-1 text-sm text-slate-400">
          Execute all {suite?._count?.scenarios ?? 11} test scenarios against your
          current guard policies. Results are recorded and tracked over time.
        </p>
        <div className="mt-4">
          <RunRedTeamButton projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
