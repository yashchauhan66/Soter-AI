import { db } from "@/lib/db";
import { POLICY_TEMPLATES } from "@/lib/admin-ai-policies";
import { listPolicies, listPolicyAuditLogs, listPolicyVersions } from "@/lib/admin-ai-policies/store";
import { PolicyBuilderClient } from "@/components/admin/ai-policies/PolicyBuilderClient";

export const dynamic = "force-dynamic";

export default async function AdminAiPoliciesPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });
  const organizationId = organizations[0]?.id ?? "";
  const { policies, versions, auditLogs } = organizationId ? await loadPolicyData(organizationId) : { policies: [], versions: [], auditLogs: [] };

  if (!organizationId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
        <h1 className="text-2xl font-bold">AI policy builder</h1>
        <p className="mt-2 text-sm text-slate-400">Create an organization before configuring extension AI policies.</p>
      </div>
    );
  }

  return (
    <PolicyBuilderClient
      organizationId={organizationId}
      organizations={organizations}
      initialPolicies={policies}
      initialVersions={versions}
      initialAuditLogs={auditLogs}
      templates={POLICY_TEMPLATES}
    />
  );
}

async function loadPolicyData(organizationId: string) {
  try {
    const [policies, versions, auditLogs] = await Promise.all([
      listPolicies(organizationId),
      listPolicyVersions(organizationId),
      listPolicyAuditLogs(organizationId),
    ]);
    return { policies, versions, auditLogs };
  } catch (error) {
    console.error("[Soter] AI policy builder data unavailable", error);
    return { policies: [], versions: [], auditLogs: [] };
  }
}
