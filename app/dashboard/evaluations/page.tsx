import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel, PayloadViewer, safeJson } from "@/components/dashboard/MetricCard";
import { DEFAULT_SLM_CONFIG } from "@/lib/evaluation/types";

export const dynamic = "force-dynamic";

type EvaluationRow = {
  id: string;
  promptText: string;
  responseText: string;
  overallScore: number;
  overallPassed: boolean;
  modelUsed: string;
  latencyMs: number;
  scoresJson: unknown;
  createdAt: Date;
};

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const evaluations = await safeRows<EvaluationRow>`
    SELECT "id", "promptText", "responseText",
      "overallScore", "overallPassed", "modelUsed", "latencyMs", "scoresJson", "createdAt"
    FROM "SlmEvaluation"
    WHERE "projectId" = ${project.id}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;

  const passed = evaluations.filter((e) => e.overallPassed).length;
  const failed = evaluations.filter((e) => !e.overallPassed).length;
  const avgScore = evaluations.length > 0
    ? Math.round(evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length)
    : 0;
  const modelAvailable = !!DEFAULT_SLM_CONFIG.apiKey;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="AI evaluation"
        title="SLM evaluations"
        description="Evaluate LLM outputs across multiple quality dimensions using a cost-effective Small Language Model as judge."
        useCase="Without systematic evaluation, it is impossible to know if your LLM responses are factually correct, safe, and on-topic. Manual review does not scale, and Galileo-style LLM-as-judge approaches can be expensive. SLM-as-judge uses compact, efficient models to provide fast, repeatable quality scoring across factuality, hallucination, safety, relevance, and more."
        howItWorks={[
          { heading: "Configure evaluation criteria", body: "Choose which quality dimensions to evaluate — factuality, hallucination, safety, relevance, tone, completeness, conciseness, and coherence. Each criterion has a configurable pass/fail threshold." },
          { heading: "SLM analyzes the response", body: "The configured SLM (Small Language Model) evaluates each criterion independently, scoring it from 0–100 with a detailed reasoning. All criteria are evaluated in parallel for speed." },
          { heading: "Weighted scoring", body: "Individual criterion scores are combined into a weighted overall score. Critical dimensions like factuality and hallucination carry more weight than secondary ones like tone and conciseness." },
          { heading: "Review evaluation history", body: "All evaluation results are persisted and visible in this dashboard. Filter by pass/fail status, review scoring breakdowns, and track quality trends over time." },
        ]}
        callout="SLM evaluations provide a useful quality signal but should not be the sole measure of LLM output quality. Combine with human review, red team testing, and application-specific metrics for comprehensive quality assurance."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Evaluations" value={evaluations.length} tone="gray" />
        <MetricCard label="Passed" value={passed} tone="green" />
        <MetricCard label="Failed" value={failed} tone="red" />
        <MetricCard label="Avg score (/100)" value={avgScore} tone={avgScore >= 70 ? "green" : "yellow"} />
      </div>

      {!modelAvailable && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-4 text-sm text-amber-300">
          <strong>SLM provider not configured.</strong> Set <code className="text-amber-200">SLM_API_KEY</code> in your environment to enable live evaluations. Defaults to OpenAI-compatible API.
        </div>
      )}

      {evaluations.length > 0 ? (
        <>
          <section className="card overflow-x-auto p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent evaluations</h2>
              <span className="text-xs font-medium text-slate-500">
                Model: {evaluations[0]?.modelUsed ?? "\u2014"}
              </span>
            </div>
            <table className="mt-4 w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Status</th>
                  <th>Score</th>
                  <th>Prompt</th>
                  <th>Response</th>
                  <th>Latency</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-3">
                      <StatusBadge value={ev.overallPassed ? "PASS" : "FAIL"} />
                    </td>
                    <td className="font-semibold">
                      <RiskLevel level={ev.overallScore >= 70 ? "LOW" : ev.overallScore >= 40 ? "MEDIUM" : "HIGH"} />
                    </td>
                    <td className="max-w-[300px] truncate text-slate-300">{ev.promptText}</td>
                    <td className="max-w-[300px] truncate text-slate-400">{ev.responseText}</td>
                    <td className="text-xs text-slate-500">{(ev.latencyMs / 1000).toFixed(1)}s</td>
                    <td>{ev.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Criterion breakdown</h2>
                <span className="text-xs font-medium text-slate-500">Latest 12</span>
              </div>
              <div className="mt-4 grid gap-3">
                {evaluations.slice(0, 12).map((ev) => {
                  const scores = safeJson(ev.scoresJson);
                  return (
                    <div className="rounded-lg border border-slate-800 p-3 text-sm" key={ev.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-[70%]">
                          <p className="truncate font-semibold">{ev.promptText}</p>
                          <p className="mt-1 truncate text-slate-400">{ev.responseText}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge value={ev.overallPassed ? "PASS" : "FAIL"} />
                          <RiskLevel level={ev.overallScore >= 70 ? "LOW" : ev.overallScore >= 40 ? "MEDIUM" : "HIGH"} />
                        </div>
                      </div>
                      <PayloadViewer title="Scores" value={scores} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Stats</h2>
              </div>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-slate-800 p-4 text-sm">
                  <p className="mb-2 font-semibold text-slate-300">Model</p>
                  <p className="text-slate-400">{evaluations[0]?.modelUsed ?? "\u2014"}</p>
                </div>
                <div className="rounded-lg border border-slate-800 p-4 text-sm">
                  <p className="mb-2 font-semibold text-slate-300">Configuration</p>
                  <p className="text-slate-400">
                    Evaluations use the configured SLM provider. Set <code className="text-cyan">SLM_API_URL</code> and <code className="text-cyan">SLM_MODEL</code> in your environment.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 p-4 text-sm">
                  <p className="mb-2 font-semibold text-slate-300">Typical latency</p>
                  <p className="text-slate-400">
                    {evaluations.length > 0
                      ? `${(evaluations.reduce((s, e) => s + e.latencyMs, 0) / evaluations.length / 1000).toFixed(1)}s average`
                      : "\u2014"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="card p-8 text-center text-slate-500">
          <p className="text-lg font-medium">No evaluations yet</p>
          <p className="mt-2 text-sm">
            Run an evaluation via the API at <code className="text-cyan">POST /api/evaluate/slm</code>
            {" "}with your project ID, prompt text, and response text.
          </p>
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-left font-mono text-xs">
            <p className="text-slate-400"># Example curl command:</p>
            <pre className="mt-1 text-slate-300 whitespace-pre-wrap">
{`curl -X POST https://yourdomain.com/api/evaluate/slm \\
  -H "x-api-key: $SOTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "proj_xxx", "promptText": "What is 2+2?", "responseText": "The answer is 4.", "mode": "quick"}'`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(
      strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""),
      ...values
    );
  } catch {
    return [];
  }
}
