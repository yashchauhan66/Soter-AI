"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Mode = "redact" | "approval" | "block";

export interface AgentFirewallPolicyFormValue {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedWorkspaceDir?: string;
  blockedFilePatterns: string[];
  toolsRequiringApproval: string[];
  toolsAlwaysBlocked: string[];
  piiMode: Mode;
  secretsMode: Mode;
  failClosed: boolean;
  maxRiskWithoutApproval: Risk;
}

export function AgentFirewallPolicyForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: AgentFirewallPolicyFormValue;
}) {
  const router = useRouter();
  const [policy, setPolicy] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/agent/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...policy }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Save failed.");
      setMessage("Policy saved");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Policy editor</p>
          <h2 className="mt-1 text-lg font-semibold">Agent action rules</h2>
        </div>
        <button type="button" onClick={save} disabled={saving} className="button-primary gap-2">
          <Save size={16} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Textarea label="Allowed domains" value={policy.allowedDomains} onChange={(allowedDomains) => setPolicy({ ...policy, allowedDomains })} />
        <Textarea label="Blocked domains" value={policy.blockedDomains} onChange={(blockedDomains) => setPolicy({ ...policy, blockedDomains })} />
        <Textarea label="Tools requiring approval" value={policy.toolsRequiringApproval} onChange={(toolsRequiringApproval) => setPolicy({ ...policy, toolsRequiringApproval })} />
        <Textarea label="Tools always blocked" value={policy.toolsAlwaysBlocked} onChange={(toolsAlwaysBlocked) => setPolicy({ ...policy, toolsAlwaysBlocked })} />
        <Textarea label="Blocked file patterns" value={policy.blockedFilePatterns} onChange={(blockedFilePatterns) => setPolicy({ ...policy, blockedFilePatterns })} />
        <label className="text-sm">
          Allowed workspace folder
          <input className="input mt-2" value={policy.allowedWorkspaceDir ?? ""} onChange={(event) => setPolicy({ ...policy, allowedWorkspaceDir: event.target.value })} />
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Select label="PII handling" value={policy.piiMode} options={["redact", "approval", "block"]} onChange={(piiMode) => setPolicy({ ...policy, piiMode })} />
        <Select label="Secrets handling" value={policy.secretsMode} options={["redact", "approval", "block"]} onChange={(secretsMode) => setPolicy({ ...policy, secretsMode })} />
        <Select label="Max risk no approval" value={policy.maxRiskWithoutApproval} options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} onChange={(maxRiskWithoutApproval) => setPolicy({ ...policy, maxRiskWithoutApproval })} />
        <label className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 text-sm">
          <input className="h-4 w-4 accent-cyan" type="checkbox" checked={policy.failClosed} onChange={(event) => setPolicy({ ...policy, failClosed: event.currentTarget.checked })} />
          Fail closed
        </label>
      </div>
      {message && <p className="mt-3 text-xs text-slate-400">{message}</p>}
    </section>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <label className="text-sm">
      {label}
      <textarea
        className="input mt-2 min-h-24 font-mono text-xs"
        value={value.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
      />
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (next: T) => void }) {
  return (
    <label className="text-sm">
      {label}
      <select className="input mt-2" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option className="bg-slate-950" key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
