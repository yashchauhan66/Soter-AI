import { Users, Plus, Trash2 } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { listDepartments } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

export default async function GovernanceDepartmentsPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const departments = await listDepartments(active.org.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Department Rules</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Define AI usage policies for specific departments. Each department can have its own
          default action and provider-specific rules.
        </p>
      </div>

      <form action="/api/usage-governance/departments" method="POST" className="card p-5 space-y-4">
        <h2 className="font-semibold">Add Department</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Department name</label>
            <input name="name" className="input w-full" required placeholder="e.g., Engineering" maxLength={200} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Default action</label>
            <select name="defaultAction" className="input w-full" defaultValue="MONITOR_ONLY">
              <option value="ALLOW">Allow</option>
              <option value="BLOCK">Block</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
              <option value="MONITOR_ONLY">Monitor Only</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <input name="description" className="input w-full" placeholder="Optional description" maxLength={500} />
          </div>
        </div>
        <input type="hidden" name="organizationId" value={active.org.id} />
        <button className="button-primary text-sm" type="submit">
          <Plus size={16} className="mr-1" /> Add Department
        </button>
      </form>

      <div className="space-y-4">
        {departments.length === 0 ? (
          <p className="text-sm text-slate-500">No departments configured yet. Add your first department above.</p>
        ) : (
          departments.map((dept) => (
            <section className="card p-5" key={dept.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="text-cyan" size={20} />
                  <div>
                    <h3 className="font-semibold">{dept.name}</h3>
                    {dept.description && <p className="text-sm text-slate-400">{dept.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {dept.memberUserIds.length} members
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    Default: {dept.defaultAction.replace("_", " ")}
                  </span>
                  <form action="/api/usage-governance/departments/delete" method="POST">
                    <input type="hidden" name="departmentId" value={dept.id} />
                    <button className="text-xs text-red-400 hover:text-red-300" type="submit">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Department rules */}
              <div className="space-y-2">
                {dept.rules.length === 0 ? (
                  <p className="text-sm text-slate-500">No provider-specific rules for this department.</p>
                ) : (
                  dept.rules.map((rule) => (
                    <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 text-sm" key={rule.id}>
                      <div>
                        <span className="font-medium">{rule.providerName}</span>
                        {rule.modelPattern && <span className="ml-2 text-slate-500">({rule.modelPattern})</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          rule.action === "ALLOW" ? "bg-emerald-500/10 text-emerald-300" :
                          rule.action === "BLOCK" ? "bg-red-500/10 text-red-300" :
                          "bg-amber-500/10 text-amber-300"
                        }`}>
                          {rule.action.replace("_", " ")}
                        </span>
                        <form action="/api/usage-governance/departments/rules/delete" method="POST">
                          <input type="hidden" name="ruleId" value={rule.id} />
                          <button className="text-xs text-red-400 hover:text-red-300" type="submit">Remove</button>
                        </form>
                      </div>
                    </div>
                  ))
                )}

                {/* Add department rule form */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-cyan hover:underline">Add rule for this department</summary>
                  <form action="/api/usage-governance/departments/rules" method="POST" className="mt-3 flex flex-wrap gap-3">
                    <input type="hidden" name="departmentId" value={dept.id} />
                    <select name="providerName" className="input text-sm" required>
                      <option value="">Provider...</option>
                      <option value="*">All</option>
                      <option value="OpenAI">OpenAI</option>
                      <option value="Anthropic">Anthropic</option>
                      <option value="Google AI">Google AI</option>
                      <option value="Azure OpenAI">Azure OpenAI</option>
                      <option value="Amazon Bedrock">Amazon Bedrock</option>
                      <option value="DeepSeek">DeepSeek</option>
                      <option value="xAI Grok">xAI Grok</option>
                      <option value="Mistral AI">Mistral AI</option>
                    </select>
                    <input name="modelPattern" className="input text-sm" placeholder="Model pattern (optional)" maxLength={200} />
                    <select name="action" className="input text-sm" required>
                      <option value="ALLOW">Allow</option>
                      <option value="BLOCK">Block</option>
                      <option value="REQUIRE_APPROVAL">Require Approval</option>
                      <option value="MONITOR_ONLY">Monitor Only</option>
                    </select>
                    <button className="button-primary text-xs" type="submit">Add Rule</button>
                  </form>
                </details>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
