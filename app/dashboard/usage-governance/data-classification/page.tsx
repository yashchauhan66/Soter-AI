import { Shield } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { listDataClassifications } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

const SENSITIVITY_COLORS: Record<string, string> = {
  PUBLIC: "text-green-300 bg-green-500/10",
  INTERNAL: "text-blue-300 bg-blue-500/10",
  CONFIDENTIAL: "text-yellow-300 bg-yellow-500/10",
  RESTRICTED: "text-orange-300 bg-orange-500/10",
  PII: "text-red-300 bg-red-500/10",
  FINANCIAL: "text-purple-300 bg-purple-500/10",
  HEALTH: "text-pink-300 bg-pink-500/10",
};

export default async function DataClassificationPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const classifications = await listDataClassifications(active.org.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Data Classification Rules</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Define what data sensitivity levels can be sent to which AI providers. 
          This helps prevent sensitive data from being shared with unauthorized AI services.
        </p>
      </div>

      <form action="/api/usage-governance/data-classification" method="POST" className="card p-5 space-y-4">
        <h2 className="font-semibold">Add Classification Rule</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Sensitivity Level</label>
            <select name="sensitivityLevel" className="input w-full" required>
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="RESTRICTED">Restricted</option>
              <option value="PII">PII</option>
              <option value="FINANCIAL">Financial</option>
              <option value="HEALTH">Health</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Provider</label>
            <select name="providerName" className="input w-full" required>
              <option value="">Select...</option>
              <option value="*">All Providers</option>
              <option value="OpenAI">OpenAI</option>
              <option value="Anthropic">Anthropic</option>
              <option value="Google AI">Google AI</option>
              <option value="Azure OpenAI">Azure OpenAI</option>
              <option value="Amazon Bedrock">Amazon Bedrock</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Allowed Actions</label>
            <select name="allowedActions" className="input w-full" required multiple={false}>
              <option value="ALLOW">Allow</option>
              <option value="MONITOR_ONLY">Monitor Only</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Requires Approval</label>
            <select name="requiresApproval" className="input w-full" defaultValue="true">
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <input type="hidden" name="organizationId" value={active.org.id} />
        <button className="button-primary text-sm" type="submit">
          <Shield size={16} className="mr-1" /> Add Classification Rule
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Classification Rules</h2>
        {classifications.length === 0 ? (
          <p className="text-sm text-slate-500">No data classification rules configured. Add rules above.</p>
        ) : (
          <div className="space-y-2">
            {classifications.map((c) => (
              <div className="card flex items-center justify-between p-4" key={c.id}>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SENSITIVITY_COLORS[c.sensitivityLevel] ?? "text-slate-300 bg-slate-800"}`}>
                    {c.sensitivityLevel}
                  </span>
                  <span className="text-sm font-medium">{c.providerName === "*" ? "All Providers" : c.providerName}</span>
                  <span className="text-xs text-slate-500">
                    Actions: {c.allowedActions.join(", ")}
                    {c.requiresApproval && " · Requires Approval"}
                  </span>
                </div>
                <form action="/api/usage-governance/data-classification/delete" method="POST">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-red-400 hover:text-red-300" type="submit">Remove</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
