import { Globe, ScanLine, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getShadowAiSummary } from "@/lib/shadow-ai";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

export default async function ShadowAIPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, _projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "shadow_ai:read");

  const summary = await getShadowAiSummary(project.organizationId ?? "");
  const { scans, providers, models } = summary;

  const recentScans = await db.shadowAiScan.findMany({
    where: { organizationId: project.organizationId ?? "" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { findings: true } } },
  });

  const highRiskProviders = providers.filter(
    (p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL",
  );

  return (
    <div className="space-y-7">
      <FeatureGuide
        eyebrow="Discovery"
        title="Shadow AI Scanner"
        description="Detect and catalog every AI provider, model, SDK, and tool used across your organization by scanning project dependencies, code snippets, and environment variables."
        useCase="Teams adopt AI tools faster than security can track them. An engineer adds an unvetted LLM SDK, or an env var points at a provider in an unapproved data region. The scanner surfaces that shadow AI usage so you can review risk, approve models, and catch high-risk providers before they handle sensitive data."
        howItWorks={[
          { heading: "Run a scan", body: "Submit your package.json, code snippets, and environment variable keys. The scanner inspects them for known AI SDKs, providers, and model references." },
          { heading: "Discover providers and models", body: "Detected AI providers and models are cataloged with their type, data region, and status so you can see everything in use in one place." },
          { heading: "Assess risk", body: "Each provider and model is assigned a risk level. High and critical-risk providers are flagged at the top for immediate review." },
          { heading: "Approve or review", body: "Models start as pending review. Approve the ones your organization sanctions and follow up on the rest from the providers view." },
        ]}
        integrationCode={`// Scan a project for shadow AI usage
const res = await fetch("https://soterai.in/api/shadow/scan", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.SOTER_API_KEY}\`,
  },
  body: JSON.stringify({
    projectId: "your-project-id",
    scanType: "FULL",
    packageJson: packageJsonString,
    codeSnippets: ["import OpenAI from 'openai'"],
    envKeys: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
  }),
});

const { scan } = await res.json();`}
        callout="The scanner detects AI usage from the code, dependencies, and env keys you submit. It cannot discover providers used in code paths or systems you do not include in the scan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <Globe className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">AI providers</p>
          <p className="mt-1 text-2xl font-bold">{providers.length}</p>
        </div>
        <div className="card p-5">
          <ScanLine className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">AI models</p>
          <p className="mt-1 text-2xl font-bold">{models.length}</p>
        </div>
        <div className="card p-5">
          <ShieldAlert className="mb-2 text-rose-300" size={20} />
          <p className="text-sm text-slate-200">Risk findings</p>
          <p className="mt-1 text-2xl font-bold">
            {scans.reduce((sum, s) => sum + s.riskFindings, 0)}
          </p>
        </div>
      </div>

      {highRiskProviders.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
          <strong className="block">{highRiskProviders.length} high-risk provider(s)</strong>
          {highRiskProviders.map((p) => (
            <span key={p.id} className="mr-2">
              {p.name} ({p.riskLevel})
            </span>
          ))}
          <Link className="ml-2 underline" href={`/dashboard/shadow-ai/providers?project=${project.id}`}>
            Review providers →
          </Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Discovered providers</h2>
          <div className="space-y-2">
            {providers.length === 0 && (
              <p className="text-sm text-slate-300">
                No providers discovered yet. Run a scan to detect AI usage.
              </p>
            )}
            {providers.map((p) => (
              <div className="card flex items-center justify-between p-4" key={p.id}>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-300">
                    {p.providerType} · {p.dataRegion ?? "Unknown region"} · {p.status}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.riskLevel === "LOW"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : p.riskLevel === "MEDIUM"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {p.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Discovered models</h2>
          <div className="space-y-2">
            {models.length === 0 && (
              <p className="text-sm text-slate-300">
                No models discovered yet. Run a scan to detect model usage.
              </p>
            )}
            {models.map((m) => (
              <div className="card flex items-center justify-between p-4" key={m.id}>
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-slate-300">
                    {m.modality} · {m.approved ? "Approved" : "Pending review"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                  {m.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent scans</h2>
        <div className="space-y-2">
          {recentScans.length === 0 && (
            <p className="text-sm text-slate-300">
              No scans yet. Scan your project dependencies to discover shadow AI usage.
            </p>
          )}
          {recentScans.map((scan) => (
            <div className="card flex items-center justify-between p-4" key={scan.id}>
              <div>
                <p className="text-sm font-medium">
                  {scan.scanType} scan · {scan.status}
                </p>
                <p className="text-xs text-slate-300">
                  {scan.providerCount} providers · {scan.modelCount} models ·{" "}
                  {scan._count.findings} findings
                </p>
              </div>
              <p className="text-xs text-slate-300">{scan.createdAt.toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Run a scan</h2>
        <p className="mt-1 text-sm text-slate-200">
          Scan your project&apos;s <code>package.json</code>, code snippets, and environment
          variables to detect shadow AI usage across your organization.
        </p>
        <div className="mt-4">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90"
            href={`/dashboard/shadow-ai/scan?project=${project.id}`}
          >
            <ScanLine size={16} />
            Scan new project
          </Link>
        </div>
      </div>
    </div>
  );
}
