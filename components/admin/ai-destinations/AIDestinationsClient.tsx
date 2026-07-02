"use client";

import { useMemo, useState } from "react";
import { Globe2, Laptop, Plus, Save, ShieldCheck, Terminal, Trash2 } from "lucide-react";
import type { AIDestinationCategory, AIDestinationPolicy, DestinationLoggingMode, DestinationRiskLevel } from "@/packages/shared/src/ai-destinations";
import type { PolicyAction } from "@/packages/policy-engine/src/types";

const tabs: Array<{ category: AIDestinationCategory; label: string }> = [
  { category: "public_ai", label: "Public AI Tools" }, { category: "browser_coding", label: "Browser Coding Platforms" },
  { category: "local_ai", label: "Local AI Tools" }, { category: "ide", label: "IDE Tools" },
  { category: "cli_api", label: "CLI/API Tools" }, { category: "custom", label: "Custom Destinations" },
];
const actions: PolicyAction[] = ["allow", "warn", "redact", "rewrite", "block", "require_approval"];

interface Props { organizationId: string; organizations: Array<{ id: string; name: string }>; initialDestinations: AIDestinationPolicy[]; }

export function AIDestinationsClient({ organizationId, organizations, initialDestinations }: Props) {
  const [orgId, setOrgId] = useState(organizationId);
  const [activeTab, setActiveTab] = useState<AIDestinationCategory>("public_ai");
  const [destinations, setDestinations] = useState(initialDestinations);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", destinationId: "", category: "custom" as AIDestinationCategory, patterns: "", riskLevel: "high" as DestinationRiskLevel });
  const visible = useMemo(() => destinations.filter((destination) => destination.category === activeTab), [activeTab, destinations]);

  async function refresh(targetOrgId = orgId) {
    const response = await fetch(`/api/admin/ai-destinations?organizationId=${encodeURIComponent(targetOrgId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Could not load destinations.");
    setDestinations(body.destinations ?? []);
  }

  async function patchDestination(destination: AIDestinationPolicy, patch: Partial<AIDestinationPolicy>) {
    const response = await fetch(`/api/admin/ai-destinations/${destination.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: orgId, ...patch }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Could not update destination.");
    setDestinations((current) => current.map((item) => item.id === destination.id ? body.destination : item));
    setMessage(`${destination.name} policy saved.`);
  }

  async function createDestination() {
    const patterns = splitList(draft.patterns);
    const domains = patterns.filter((value) => !value.includes("://") && !value.includes("*"));
    const urlPatterns = patterns.filter((value) => !domains.includes(value));
    const response = await fetch("/api/admin/ai-destinations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      organizationId: orgId, destinationId: slug(draft.destinationId || draft.name), name: draft.name, category: draft.category,
      domains, urlPatterns, enabled: true, riskLevel: draft.riskLevel, allowedDepartments: ["all"], allowedRoles: ["all"],
      policyOverrides: {}, responseScanningEnabled: true, loggingMode: "metadata_only",
    }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Could not create destination.");
    setDestinations((current) => [...current, body.destination]); setActiveTab(draft.category); setShowCreate(false); setMessage(`${draft.name} added.`);
    setDraft({ name: "", destinationId: "", category: "custom", patterns: "", riskLevel: "high" });
  }

  async function removeDestination(destination: AIDestinationPolicy) {
    const response = await fetch(`/api/admin/ai-destinations/${destination.id}?organizationId=${encodeURIComponent(orgId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Could not delete destination.");
    setDestinations((current) => current.filter((item) => item.id !== destination.id));
  }

  const showError = (error: unknown) => setMessage(error instanceof Error ? error.message : "The operation failed.");
  return <div className="space-y-7">
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div>
        <div className="flex items-center gap-2 text-cyan-300"><ShieldCheck size={20} /><span className="text-xs font-bold uppercase tracking-wider">AI Workstation Guard</span></div>
        <h1 className="mt-3 text-2xl font-bold">AI destinations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Choose exactly where Soter activates. Browser monitoring is limited to enabled URL patterns; desktop IDEs and direct APIs use official plugins or the transparent local proxy.</p>
      </div><button className="button-primary inline-flex items-center gap-2" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> Add destination</button></div>
      <label className="mt-5 grid max-w-md gap-2 text-sm text-slate-300">Organization<select className="input" value={orgId} onChange={(event) => { const id = event.target.value; setOrgId(id); void refresh(id).catch(showError); }}>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
      {message && <p className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{message}</p>}
    </section>

    {showCreate && <section className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-5"><h2 className="font-semibold">Add a public, coding, local, or custom endpoint</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Stable ID"><input className="input" value={draft.destinationId} onChange={(e) => setDraft({ ...draft, destinationId: e.target.value })} placeholder="my-local-ai" /></Field>
        <Field label="Category"><Select value={draft.category} options={tabs.map((tab) => tab.category)} onChange={(value) => setDraft({ ...draft, category: value as AIDestinationCategory })} /></Field>
        <Field label="Risk"><Select value={draft.riskLevel} options={["low", "medium", "high", "critical"]} onChange={(value) => setDraft({ ...draft, riskLevel: value as DestinationRiskLevel })} /></Field>
        <div className="md:col-span-2 xl:col-span-4"><Field label="Domains or URL patterns (comma separated)"><input className="input" value={draft.patterns} onChange={(e) => setDraft({ ...draft, patterns: e.target.value })} placeholder="http://localhost:3000/*, ai.example.com" /></Field></div>
      </div><button className="button-primary mt-4 inline-flex items-center gap-2" disabled={!draft.name.trim() || !draft.patterns.trim()} onClick={() => void createDestination().catch(showError)}><Save size={16} /> Create destination</button></section>}

    <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.category} className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm ${activeTab === tab.category ? "border-cyan-400 bg-cyan-500/15 text-cyan-100" : "border-slate-800 text-slate-400"}`} onClick={() => setActiveTab(tab.category)}>{tab.label}</button>)}</div>
    <section className="grid gap-4 xl:grid-cols-2">{visible.map((destination) => <DestinationCard key={destination.id} destination={destination} onPatch={(patch) => void patchDestination(destination, patch).catch(showError)} onDelete={() => void removeDestination(destination).catch(showError)} />)}{!visible.length && <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">No destinations in this category yet.</div>}</section>
    <section className="grid gap-4 md:grid-cols-3"><Boundary icon={<Globe2 />} title="Browser extension">Configured AI and coding URLs only. Supports prompts, paste, uploads, Monaco/CodeMirror, and responses.</Boundary><Boundary icon={<Laptop />} title="IDE extensions">VS Code/Cursor and JetBrains plugins enforce the same signed organization policy inside native editors.</Boundary><Boundary icon={<Terminal />} title="Local proxy / CLI">Direct Ollama, LM Studio, OpenAI-compatible, n8n, and CLI traffic must be routed through the transparent local agent.</Boundary></section>
  </div>;
}

function DestinationCard({ destination, onPatch, onDelete }: { destination: AIDestinationPolicy; onPatch: (patch: Partial<AIDestinationPolicy>) => void; onDelete: () => void }) {
  const [local, setLocal] = useState(destination);
  const patterns = [...local.domains, ...local.urlPatterns].join(", ") || "Native integration (no browser URL)";
  const change = <K extends keyof AIDestinationPolicy>(key: K, value: AIDestinationPolicy[K]) => setLocal((current) => ({ ...current, [key]: value }));
  return <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-100">{local.name}</h2><p className="mt-1 break-all text-xs text-slate-500">{patterns}</p></div><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={local.enabled} onChange={(e) => { change("enabled", e.target.checked); onPatch({ enabled: e.target.checked }); }} /> Enabled</label></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Risk level"><Select value={local.riskLevel ?? local.defaultRiskLevel} options={["low", "medium", "high", "critical"]} onChange={(value) => change("riskLevel", value as DestinationRiskLevel)} /></Field><Field label="Logging"><Select value={local.loggingMode} options={["metadata_only", "redacted_prompt", "disabled", "full_prompt_explicit_admin_enabled"]} onChange={(value) => change("loggingMode", value as DestinationLoggingMode)} /></Field>
      <Field label="Allowed departments"><input className="input" value={local.allowedDepartments.join(", ")} onChange={(e) => change("allowedDepartments", splitList(e.target.value))} /></Field><Field label="Allowed roles"><input className="input" value={local.allowedRoles.join(", ")} onChange={(e) => change("allowedRoles", splitList(e.target.value))} /></Field>
      {(["secrets", "source_code", "customer_data"] as const).map((type) => <Field key={type} label={`${type.replace("_", " ")} action`}><Select value={local.policyOverrides[type] ?? "allow"} options={actions} onChange={(value) => change("policyOverrides", { ...local.policyOverrides, [type]: value as PolicyAction })} /></Field>)}
      <label className="flex items-center gap-2 pt-6 text-sm text-slate-300"><input type="checkbox" checked={local.responseScanningEnabled} onChange={(e) => change("responseScanningEnabled", e.target.checked)} /> Scan AI responses</label></div>
    <div className="mt-4 flex gap-2"><button className="button-primary inline-flex items-center gap-2 px-3 py-2 text-xs" onClick={() => onPatch({ riskLevel: local.riskLevel, loggingMode: local.loggingMode, allowedDepartments: local.allowedDepartments, allowedRoles: local.allowedRoles, policyOverrides: local.policyOverrides, responseScanningEnabled: local.responseScanningEnabled })}><Save size={14} /> Save</button><button className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300" onClick={onDelete}><Trash2 size={14} /> Delete</button></div></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm text-slate-300"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>; }
function Boundary({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <div className="rounded-xl border border-slate-800 p-5"><span className="text-cyan-300">{icon}</span><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-400">{children}</p></div>; }
function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function slug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
