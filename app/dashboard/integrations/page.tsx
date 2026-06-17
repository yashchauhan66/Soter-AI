import { IntegrationWizard } from "@/components/dashboard/IntegrationWizard";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  const [projects, apiKeys] = await Promise.all([
    db.project.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.apiKey.findMany({
      where: { project: { userId: user.id }, isActive: true },
      select: { id: true, name: true, prefix: true, projectId: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <div>
      <p className="eyebrow">Developer experience</p>
      <h1 className="mt-2 text-3xl font-bold">Integration wizard</h1>
      <p className="mb-7 mt-3 max-w-3xl text-slate-400">
        Pick your platform, copy the server-side snippet, and verify that the Guard API is reachable. Raw API keys are never retrieved from storage after creation.
      </p>
      <IntegrationWizard projects={projects} apiKeys={apiKeys} defaultBaseUrl={baseUrl} />
    </div>
  );
}
