"use client";

import { useMemo, useState } from "react";
import { Rocket, RotateCcw, Save, ShieldCheck, TestTube2 } from "lucide-react";
import { AI_DESTINATION_PRESETS, POLICY_TEMPLATES, privacySafeFingerprint, testPolicy as evaluatePolicyTest, validateRegexPattern } from "@/lib/admin-ai-policies";
import type { AdminAiPolicy, AdminPolicyTemplate, PolicyAction, PolicyAuditLog, PolicyLogMode, PolicySeverity, PolicyVersion } from "@/lib/admin-ai-policies";

const actions: PolicyAction[] = ["allow", "log_only", "warn", "redact", "rewrite", "block", "require_justification", "require_approval"];
const severities: PolicySeverity[] = ["low", "medium", "high", "critical"];
const logModes: PolicyLogMode[] = ["metadata_only", "redacted_prompt", "full_prompt_only_if_enabled_by_admin"];
const semanticCategories = ["customer_data", "legal_contract", "financial_text", "hr_salary", "source_code", "production_logs", "internal_roadmap", "investor_data", "support_tickets", "confidential_notes"];

interface Props {
  organizationId: string;
  organizations: Array<{ id: string; name: string }>;
  initialPolicies: AdminAiPolicy[];
  initialVersions: PolicyVersion[];
  initialAuditLogs: PolicyAuditLog[];
  templates?: AdminPolicyTemplate[];
}

export function PolicyBuilderClient({ organizationId, organizations, initialPolicies, initialVersions, initialAuditLogs, templates = POLICY_TEMPLATES }: Props) {
  const [orgId, setOrgId] = useState(organizationId);
  const [policies, setPolicies] = useState(initialPolicies);
  const [versions, setVersions] = useState(initialVersions);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, boolean>>({});
  const [templateSettings, setTemplateSettings] = useState<Record<string, {
    severity: PolicySeverity;
    action: PolicyAction;
    scope: string;
    destination: string;
    logMode: PolicyLogMode;
  }>>({});
  const [sampleText, setSampleText] = useState("soter_internal_api uses prod-db and customer-list for private-roadmap");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [custom, setCustom] = useState({
    policyName: "Block Internal Project Codename",
    description: "Blocks internal codenames and sensitive company phrases on public AI tools.",
    enabled: true,
    severity: "critical" as PolicySeverity,
    action: "block" as PolicyAction,
    departments: "all",
    roles: "all",
    users: "all",
    destinations: "chatgpt.com, claude.ai, gemini.google.com, unknown",
    destinationRiskLevel: "all",
    keywords: "soter_internal_api, prod-db, private-roadmap, enterprise_customer_list",
    regex: "",
    fileNames: "salary, payroll, contract, investor, roadmap, database, export, customer-list",
    documentText: "",
    semanticCategories: ["customer_data", "internal_roadmap"],
    logMode: "redacted_prompt" as PolicyLogMode,
  });

  const customPreview = useMemo(() => ({
    organizationId: orgId,
    policyName: custom.policyName,
    description: custom.description,
    enabled: custom.enabled,
    mode: "custom",
    severity: custom.severity,
    action: custom.action,
    scope: {
      type: custom.departments.trim() === "all" && custom.roles.trim() === "all" && custom.users.trim() === "all" ? "all" : custom.departments.trim() !== "all" ? "department" : custom.roles.trim() !== "all" ? "role" : "selected_users",
      departments: splitList(custom.departments),
      roles: splitList(custom.roles),
      users: splitList(custom.users),
    },
    destinations: {
      preset: "advanced_custom",
      domains: splitList(custom.destinations),
      riskLevel: custom.destinationRiskLevel,
    },
    detectionConfig: {
      detectorKeys: [],
      keywords: splitList(custom.keywords),
      regex: splitList(custom.regex),
      domains: splitList(custom.destinations),
      fileNames: splitList(custom.fileNames),
      documentFingerprints: custom.documentText.trim() ? [privacySafeFingerprint(custom.documentText)] : [],
      semanticCategories: custom.semanticCategories,
      scanResponses: false,
    },
    logMode: custom.logMode,
  }), [custom, orgId]);

  const customPolicyForTest = useMemo<AdminAiPolicy>(() => ({
    id: "preview_policy",
    organizationId: orgId,
    name: customPreview.policyName,
    description: customPreview.description,
    enabled: customPreview.enabled,
    mode: "custom",
    severity: customPreview.severity,
    action: customPreview.action,
    scope: customPreview.scope as AdminAiPolicy["scope"],
    destinations: customPreview.destinations as AdminAiPolicy["destinations"],
    detectionConfig: customPreview.detectionConfig,
    logMode: customPreview.logMode,
    version: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }), [customPreview, orgId]);

  async function refresh(targetOrgId = orgId) {
    const response = await fetch(`/api/admin/ai-policies?organizationId=${encodeURIComponent(targetOrgId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Could not refresh policies.");
    setPolicies(data.policies ?? []);
    setVersions(data.versions ?? []);
    setAuditLogs(data.auditLogs ?? []);
  }

  async function createTemplate(template: AdminPolicyTemplate) {
    const settings = templateSetting(template);
    const destination = AI_DESTINATION_PRESETS.find((item) => item.label === settings.destination) ?? AI_DESTINATION_PRESETS[0];
    const scopeType = settings.scope === "department" ? "department" : settings.scope === "role" ? "role" : settings.scope === "selected users" ? "selected_users" : "all";
    const response = await fetch("/api/admin/ai-policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        name: template.name,
        description: template.description,
        enabled: selectedTemplate[template.key] ?? template.enabledByDefault,
        mode: "template",
        severity: settings.severity,
        action: settings.action,
        scope: {
          type: scopeType,
          departments: scopeType === "department" ? ["Security"] : ["all"],
          roles: scopeType === "role" ? ["ADMIN"] : ["all"],
          users: scopeType === "selected_users" ? ["selected"] : ["all"],
        },
        destinations: {
          preset: destination.key,
          domains: destination.domains,
          riskLevel: destination.key === "unknown_ai" ? "unknown" : destination.key === "enterprise_ai_only" ? "approved" : "all",
        },
        detectionConfig: {
          detectorKeys: template.detectorKeys,
          keywords: [],
          regex: [],
          domains: [],
          fileNames: [],
          documentFingerprints: [],
          semanticCategories: template.detectorKeys,
          scanResponses: template.key === "scan-llm-responses",
        },
        logMode: settings.logMode,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? `Created policy: ${data.policy.name}` : data.message);
    if (response.ok) await refresh();
  }

  function templateSetting(template: AdminPolicyTemplate) {
    return templateSettings[template.key] ?? {
      severity: template.defaultSeverity,
      action: template.defaultAction,
      scope: "all employees",
      destination: "All AI tools",
      logMode: "redacted_prompt",
    };
  }

  function setTemplateSetting(template: AdminPolicyTemplate, patch: Partial<ReturnType<typeof templateSetting>>) {
    setTemplateSettings((current) => ({ ...current, [template.key]: { ...templateSetting(template), ...patch } }));
  }

  async function saveCustom(publish = false) {
    const response = await fetch("/api/admin/ai-policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(customPreview),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Could not save policy.");
      return;
    }
    setMessage(publish ? "Draft saved. Publishing..." : `Draft saved: ${data.policy.name}`);
    if (publish) await publishPolicy(data.policy.id);
    await refresh();
  }

  async function publishPolicy(policyId: string) {
    const response = await fetch(`/api/admin/ai-policies/${policyId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });
    const data = await response.json();
    setMessage(response.ok ? `Published version ${data.policy.version}` : data.message);
    if (response.ok) await refresh();
  }

  async function rollbackPolicy(policyId: string, version: number) {
    const response = await fetch(`/api/admin/ai-policies/${policyId}/rollback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, version }),
    });
    const data = await response.json();
    setMessage(response.ok ? `Rolled back and published version ${data.policy.version}` : data.message);
    if (response.ok) await refresh();
  }

  async function testPolicy(policyId: string) {
    const response = await fetch(`/api/admin/ai-policies/${policyId}/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, sampleText, destinationDomain: "chatgpt.com" }),
    });
    const data = await response.json();
    setTestResult(data.result ?? data);
    setMessage(response.ok ? "Policy test completed." : data.message);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">AI policy builder</h1>
            <p className="mt-2 text-sm text-slate-400">Create extension policies with checkboxes, selectors, and safe previews.</p>
          </div>
          <select
            className="input w-full max-w-xs"
            value={orgId}
            onChange={(event) => {
              setOrgId(event.target.value);
              void refresh(event.target.value).catch((error) => setMessage(error.message));
            }}
          >
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </div>
        {message && <p className="mt-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">{message}</p>}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-semibold">Quick policy templates</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3">Enabled</th>
                <th className="px-3 py-3">Policy</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Who does this apply to?</th>
                <th className="px-3 py-3">Which AI tools?</th>
                <th className="px-3 py-3">What should be stored in logs?</th>
                <th className="px-3 py-3">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {templates.map((template) => (
                <tr key={template.key} className="align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTemplate[template.key] ?? template.enabledByDefault}
                      onChange={(event) => setSelectedTemplate((current) => ({ ...current, [template.key]: event.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-100">{template.name}</p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">{template.description}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{template.category}</td>
                  <td className="px-3 py-3"><Select options={severities} value={templateSetting(template).severity} onChange={(value) => setTemplateSetting(template, { severity: value as PolicySeverity })} /></td>
                  <td className="px-3 py-3"><Select options={actions} value={templateSetting(template).action} onChange={(value) => setTemplateSetting(template, { action: value as PolicyAction })} /></td>
                  <td className="px-3 py-3"><Select options={["all employees", "department", "role", "selected users"]} value={templateSetting(template).scope} onChange={(value) => setTemplateSetting(template, { scope: value })} /></td>
                  <td className="px-3 py-3"><Select options={AI_DESTINATION_PRESETS.map((item) => item.label)} value={templateSetting(template).destination} onChange={(value) => setTemplateSetting(template, { destination: value })} /></td>
                  <td className="px-3 py-3"><Select options={logModes} value={templateSetting(template).logMode} onChange={(value) => setTemplateSetting(template, { logMode: value as PolicyLogMode })} /></td>
                  <td className="px-3 py-3">
                    <button className="button-primary whitespace-nowrap px-3 py-2 text-xs" onClick={() => void createTemplate(template)}>Create</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
          <h2 className="text-xl font-semibold">Advanced custom policy builder</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Policy name"><input className="input" value={custom.policyName} onChange={(event) => setCustom({ ...custom, policyName: event.target.value })} /></Field>
            <Field label="What should Soter do?"><Select options={actions} value={custom.action} onChange={(value) => setCustom({ ...custom, action: value as PolicyAction })} /></Field>
            <Field label="Description"><input className="input" value={custom.description} onChange={(event) => setCustom({ ...custom, description: event.target.value })} /></Field>
            <Field label="Severity"><Select options={severities} value={custom.severity} onChange={(value) => setCustom({ ...custom, severity: value as PolicySeverity })} /></Field>
            <Field label="Policy status">
              <label className="flex h-11 items-center gap-2 rounded-md border border-slate-700 px-3">
                <input type="checkbox" checked={custom.enabled} onChange={(event) => setCustom({ ...custom, enabled: event.target.checked })} />
                Enabled
              </label>
            </Field>
            <Field label="Destination risk level"><Select options={["all", "approved", "known_public", "unknown"]} value={custom.destinationRiskLevel} onChange={(value) => setCustom({ ...custom, destinationRiskLevel: value })} /></Field>
            <Field label="Who does this apply to? Departments"><input className="input" value={custom.departments} onChange={(event) => setCustom({ ...custom, departments: event.target.value })} /></Field>
            <Field label="Roles"><input className="input" value={custom.roles} onChange={(event) => setCustom({ ...custom, roles: event.target.value })} /></Field>
            <Field label="Selected users"><input className="input" value={custom.users} onChange={(event) => setCustom({ ...custom, users: event.target.value })} /></Field>
            <Field label="Which AI tools does this apply on?"><input className="input" value={custom.destinations} onChange={(event) => setCustom({ ...custom, destinations: event.target.value })} /></Field>
            <Field label="What should Soter detect? Keywords"><textarea className="input min-h-24" value={custom.keywords} onChange={(event) => setCustom({ ...custom, keywords: event.target.value })} /></Field>
            <Field label="Regex patterns">
              <textarea className="input min-h-24" value={custom.regex} onChange={(event) => setCustom({ ...custom, regex: event.target.value })} />
              {splitList(custom.regex).map((pattern) => {
                const validation = validateRegexPattern(pattern);
                return <span className={`text-xs ${validation.ok ? "text-emerald-300" : "text-red-300"}`} key={pattern}>{validation.ok ? `Valid: ${pattern}` : `${pattern}: ${validation.message}`}</span>;
              })}
            </Field>
            <Field label="File name match"><textarea className="input min-h-20" value={custom.fileNames} onChange={(event) => setCustom({ ...custom, fileNames: event.target.value })} /></Field>
            <Field label="Reference document fingerprint">
              <input
                className="input"
                type="file"
                accept=".txt,.md,.csv,.json,.log"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCustom((current) => ({ ...current, documentText: String(reader.result ?? "") }));
                  reader.readAsText(file);
                }}
              />
              <textarea className="input min-h-20" value={custom.documentText} onChange={(event) => setCustom({ ...custom, documentText: event.target.value })} placeholder="Paste reference text to generate a privacy-safe fingerprint" />
              {custom.documentText.trim() && <span className="text-xs text-slate-500">Fingerprint: {privacySafeFingerprint(custom.documentText)}. Raw reference text is not sent by this form.</span>}
            </Field>
            <Field label="Semantic classifier categories">
              <div className="grid gap-2 sm:grid-cols-2">
                {semanticCategories.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={custom.semanticCategories.includes(category)} onChange={(event) => setCustom((current) => ({ ...current, semanticCategories: event.target.checked ? [...current.semanticCategories, category] : current.semanticCategories.filter((item) => item !== category) }))} />
                    {category.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="What should be stored in logs?"><Select options={logModes} value={custom.logMode} onChange={(value) => setCustom({ ...custom, logMode: value as PolicyLogMode })} /></Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="button-primary inline-flex items-center gap-2" onClick={() => void saveCustom(false)}><Save size={16} /> Save as draft</button>
            <button className="button-primary inline-flex items-center gap-2" onClick={() => void saveCustom(true)}><Rocket size={16} /> Publish policy</button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="font-semibold">Policy preview</h2>
            <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-black/40 p-3 text-xs text-slate-300">{JSON.stringify(customPreview, null, 2)}</pre>
          </section>
          <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <h2 className="font-semibold">Test policy</h2>
            <textarea className="input mt-3 min-h-28" value={sampleText} onChange={(event) => setSampleText(event.target.value)} />
            <p className="mt-2 text-xs text-slate-500">Sample text is not stored unless a request explicitly enables it.</p>
            <button
              className="button-primary mt-3 inline-flex items-center gap-2"
              onClick={() => {
                const result = evaluatePolicyTest({ policy: customPolicyForTest, sampleText, destinationDomain: "chatgpt.com" });
                setTestResult(result as unknown as Record<string, unknown>);
                setMessage("Local policy preview test completed. Sample text was not stored.");
              }}
            >
              <TestTube2 size={16} /> Test policy
            </button>
            {testResult && <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/40 p-3 text-xs text-slate-300">{JSON.stringify(testResult, null, 2)}</pre>}
          </section>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
        <h2 className="text-xl font-semibold">Saved policies</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-3">Name</th><th>Mode</th><th>Action</th><th>Severity</th><th>Version</th><th>Published</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="py-3 pr-4"><p className="font-semibold">{policy.name}</p><p className="text-xs text-slate-500">{policy.description}</p></td>
                  <td>{policy.mode}</td>
                  <td>{policy.action}</td>
                  <td>{policy.severity}</td>
                  <td>{policy.version}</td>
                  <td>{policy.publishedAt ? new Date(policy.publishedAt).toLocaleString() : "Draft"}</td>
                  <td className="space-x-2">
                    <button className="rounded-md border border-slate-700 px-2 py-1 text-xs" onClick={() => void testPolicy(policy.id)}>Test</button>
                    <button className="rounded-md border border-cyan-500/50 px-2 py-1 text-xs text-cyan-200" onClick={() => void publishPolicy(policy.id)}>Publish</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
          <h2 className="text-lg font-semibold">Policy versions</h2>
          <div className="mt-3 space-y-2">
            {versions.slice(0, 10).map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-900/70 p-3 text-sm">
                <span>{version.snapshot.name} v{version.version}</span>
                <button className="inline-flex items-center gap-1 text-xs text-cyan-200" onClick={() => void rollbackPolicy(version.policyId, version.version)}><RotateCcw size={14} /> Rollback</button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-5">
          <h2 className="text-lg font-semibold">Policy change audit log</h2>
          <div className="mt-3 space-y-2">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-md bg-slate-900/70 p-3 text-sm">
                <p className="font-semibold">{log.action} {log.policyId ? `· ${log.policyId}` : ""}</p>
                <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm text-slate-300"><span className="font-medium">{label}</span>{children}</label>;
}

function Select({ options, value, onChange }: { options: string[]; value: string; onChange?: (value: string) => void }) {
  return (
    <select className="input min-w-36" {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue: value })}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
