import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { listProviderRules } from "@/lib/usage-governance";
import { KNOWN_AI_PROVIDERS } from "@/lib/shadow-ai";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  ALLOW: { label: "Allowed", color: "text-emerald-300 bg-emerald-500/10" },
  BLOCK: { label: "Blocked", color: "text-red-300 bg-red-500/10" },
  REQUIRE_APPROVAL: { label: "Requires Approval", color: "text-amber-300 bg-amber-500/10" },
  MONITOR_ONLY: { label: "Monitored", color: "text-cyan bg-cyan/10" },
};

export default async function GovernanceProvidersPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const rules = await listProviderRules(active.org.id);
  const rulesMap = new Map(rules.map((r) => [r.providerName, r]));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Provider Allow/Block Lists</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Control which AI providers and models are allowed, blocked, or require approval
          for use across your organization. Add rules for specific models using wildcard patterns.
        </p>
      </div>

      {/* Add rule form */}
      <form action="/api/usage-governance/rules" method="POST" className="card p-5 space-y-4">
        <h2 className="font-semibold">Add Provider Rule</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Provider</label>
            <select name="providerName" className="input w-full" required>
              <option value="">Select provider...</option>
              {KNOWN_AI_PROVIDERS.map((p) => (
                <option key={p.name} value={p.name}>{p.name} ({p.providerType})</option>
              ))}
              <option value="*">All Providers (*)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Model pattern (optional)</label>
            <input name="modelPattern" className="input w-full" placeholder="e.g., gpt-4*" maxLength={200} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Action</label>
            <select name="action" className="input w-full" required>
              <option value="ALLOW">Allow</option>
              <option value="BLOCK">Block</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
              <option value="MONITOR_ONLY">Monitor Only</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Reason</label>
            <input name="reason" className="input w-full" placeholder="Why this rule?" maxLength={500} />
          </div>
        </div>
        <input type="hidden" name="organizationId" value={active.org.id} />
        <button className="button-primary text-sm" type="submit">Add Rule</button>
      </form>

      {/* Rules list */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Provider Rules</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500">No provider rules configured. Add rules above.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const actionStyle = ACTION_LABELS[rule.action] ?? ACTION_LABELS.MONITOR_ONLY;
              return (
                <div className="card flex items-center justify-between p-4" key={rule.id}>
                  <div className="flex items-center gap-3">
                    {rule.action === "ALLOW" ? (
                      <CheckCircle size={18} className="text-emerald-400" />
                    ) : rule.action === "BLOCK" ? (
                      <XCircle size={18} className="text-red-400" />
                    ) : (
                      <HelpCircle size={18} className="text-amber-400" />
                    )}
                    <div>
                      <p className="font-medium">{rule.providerName === "*" ? "All Providers" : rule.providerName}</p>
                      {rule.modelPattern && <p className="text-xs text-slate-500">Model: {rule.modelPattern}</p>}
                      {rule.reason && <p className="text-xs text-slate-500">{rule.reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${actionStyle.color}`}>
                      {actionStyle.label}
                    </span>
                    <form action="/api/usage-governance/rules/delete" method="POST">
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button className="text-xs text-red-400 hover:text-red-300" type="submit">Remove</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Provider inventory */}
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Known AI Providers</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {KNOWN_AI_PROVIDERS.map((provider) => {
            const rule = rulesMap.get(provider.name);
            const actionStyle = rule
              ? ACTION_LABELS[rule.action] ?? { label: "Default", color: "text-slate-400 bg-slate-800" }
              : { label: "Default (Monitor)", color: "text-slate-400 bg-slate-800" };
            return (
              <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 text-sm" key={provider.name}>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-xs text-slate-500">{provider.providerType} · {provider.dataRegion}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle.color}`}>
                  {actionStyle.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
