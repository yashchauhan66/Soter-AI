import { LockKeyhole } from "lucide-react";
import { CodeSecurityReviewClient } from "@/components/dashboard/CodeSecurityReviewClient";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function CodeSecurityPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "project:read");

  return (
    <div className="space-y-7">
      <FeatureGuide
        eyebrow="AI-assisted secure development"
        title="AI Code Security Review"
        description="Catch secrets, authorization flaws, injection paths, unsafe AI-output execution, and insecure configuration before AI-generated code reaches production."
        useCase="AI coding assistants ship code fast, but they also introduce familiar security mistakes at scale — hardcoded secrets, missing authorization checks, injection-prone string building, and code that executes model output directly. This review reads submitted source with AI-aware context (production, exposure, data sensitivity, and auth signals) so severity reflects real risk, and produces audit-ready evidence you can hand to a reviewer or attach to a change."
        howItWorks={[
          { heading: "Submit source for review", body: "Paste or upload the code you want reviewed. Source is analyzed in-request and is not persisted by this feature; finding evidence is truncated and credential values are redacted." },
          { heading: "AI-aware severity", body: "Findings are scored using context signals — whether the code is production-facing, internet-exposed, handles sensitive data, or sits behind auth — so severity tracks actual exposure rather than raw pattern counts." },
          { heading: "Gate risky changes in CI", body: "Copy a GitHub Actions workflow that runs the same review on pull requests and fails the check when risky changes appear, keeping insecure AI-generated code out of main." },
          { heading: "Export audit evidence", body: "Export findings mapped to OWASP, SOC 2, ISO 27001, and NIST SSDF so a security review or auditor can trace what was checked and what was resolved." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

// Review code before it merges (e.g. in a PR gate)
const review = await soter.reviewCode({
  filename: "src/handler.ts",
  content: sourceCode,
  context: { productionFacing: true, handlesSensitiveData: true },
});

if (review.findings.some((f) => f.severity === "HIGH" || f.severity === "CRITICAL")) {
  process.exit(1); // fail the CI check
}`}
        callout="This review performs static analysis of the source you submit; it does not execute your code and cannot catch runtime-only issues. Treat it as one gate alongside tests, dependency scanning, and human review, not a guarantee that code is secure."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200"><LockKeyhole className="mt-0.5 shrink-0 text-emerald-300" size={18} /><p><strong className="text-slate-200">Privacy by design:</strong> submitted source is analyzed in-request and is not persisted by this feature. Finding evidence is truncated and credential values are redacted.</p></div>
      <CodeSecurityReviewClient projectId={project.id} />
    </div>
  );
}
