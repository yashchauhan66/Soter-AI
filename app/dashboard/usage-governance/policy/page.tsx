import { Shield } from "lucide-react";
import dynamicImport from "next/dynamic";
import { getActiveOrganization, requireUser } from "@/lib/auth/guards";
import { getOrCreatePolicy } from "@/lib/usage-governance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const GovernanceWebhookSection = dynamicImport(
  () => import("@/components/dashboard/GovernanceWebhookSection").then((mod) => mod.GovernanceWebhookSection),
);

export default async function GovernancePolicyPage() {
  const [active, user] = await Promise.all([
    getActiveOrganization(),
    requireUser(),
  ]);
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const [policy, userProjects] = await Promise.all([
    getOrCreatePolicy(active.org.id),
    db.project.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Policy Configuration</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Configure the default AI usage governance policy. This controls how your organization
          handles AI provider usage, data sensitivity, and employee monitoring.
        </p>
      </div>

      <form
        action="/api/usage-governance/policy"
        method="POST"
        className="space-y-6"
      >
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">General Settings</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Policy name</label>
            <input
              name="name"
              defaultValue={policy.name}
              className="input w-full max-w-md"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              name="description"
              defaultValue={policy.description ?? ""}
              className="input w-full max-w-lg"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={policy.enabled}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800"
              id="policy-enabled"
            />
            <label htmlFor="policy-enabled" className="text-sm">Policy enabled</label>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Default Actions</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Default action for AI providers</label>
            <select name="defaultAction" defaultValue={policy.defaultAction} className="input w-full max-w-xs">
              <option value="MONITOR_ONLY">Monitor Only</option>
              <option value="ALLOW">Allow</option>
              <option value="BLOCK">Block</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Restricted data action</label>
            <select name="restrictedDataAction" defaultValue={policy.restrictedDataAction} className="input w-full max-w-xs">
              <option value="BLOCK">Block</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
              <option value="MONITOR_ONLY">Monitor Only</option>
              <option value="ALLOW">Allow</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">PII data action</label>
            <select name="piiDataAction" defaultValue={policy.piiDataAction} className="input w-full max-w-xs">
              <option value="BLOCK">Block</option>
              <option value="REQUIRE_APPROVAL">Require Approval</option>
              <option value="MONITOR_ONLY">Monitor Only</option>
              <option value="ALLOW">Allow</option>
            </select>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Approval & Notifications</h2>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="requireApprovalForNew" defaultChecked={policy.requireApprovalForNew} className="h-4 w-4 rounded border-slate-600 bg-slate-800" id="require-approval" />
            <label htmlFor="require-approval" className="text-sm">Require approval for new providers</label>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="notifyOnBlocked" defaultChecked={policy.notifyOnBlocked} className="h-4 w-4 rounded border-slate-600 bg-slate-800" id="notify-blocked" />
            <label htmlFor="notify-blocked" className="text-sm">Notify on blocked usage</label>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="notifyOnApprovalRequest" defaultChecked={policy.notifyOnApprovalRequest} className="h-4 w-4 rounded border-slate-600 bg-slate-800" id="notify-approval" />
            <label htmlFor="notify-approval" className="text-sm">Notify on approval requests</label>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" name="employeeMonitoringEnabled" defaultChecked={policy.employeeMonitoringEnabled} className="h-4 w-4 rounded border-slate-600 bg-slate-800" id="employee-monitoring" />
            <label htmlFor="employee-monitoring" className="text-sm">Enable employee usage monitoring</label>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Retention</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Audit retention (days)</label>
            <input
              type="number"
              name="auditRetentionDays"
              defaultValue={policy.auditRetentionDays}
              className="input w-full max-w-xs"
              min={30}
              max={3650}
            />
          </div>
        </section>

        <input type="hidden" name="organizationId" value={active.org.id} />

        <button className="button-primary" type="submit">
          <Shield size={16} className="mr-2" />
          Save Policy Settings
        </button>
      </form>

      {/* Governance webhook subscriptions */}
      <GovernanceWebhookSection projects={userProjects} />
    </div>
  );
}
