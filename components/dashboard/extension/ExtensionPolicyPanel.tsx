"use client";

import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

type Action = "block" | "redact" | "warn" | "log_only" | "require_approval";

interface Settings {
  enabled: boolean;
  action: Action;
  monitoredDomains: string[];
  scanResponses: boolean;
}

const AI_TOOL_CATALOG: { domain: string; label: string }[] = [
  { domain: "chatgpt.com", label: "ChatGPT" },
  { domain: "chat.openai.com", label: "OpenAI Chat" },
  { domain: "claude.ai", label: "Claude" },
  { domain: "gemini.google.com", label: "Gemini" },
  { domain: "perplexity.ai", label: "Perplexity" },
  { domain: "poe.com", label: "Poe" },
  { domain: "openrouter.ai", label: "OpenRouter" },
  { domain: "copilot.microsoft.com", label: "Microsoft Copilot" },
  { domain: "replit.com", label: "Replit" },
  { domain: "v0.dev", label: "v0" },
  { domain: "bolt.new", label: "Bolt" },
  { domain: "lovable.dev", label: "Lovable" },
];

const ACTIONS: { value: Action; label: string; hint: string }[] = [
  { value: "block", label: "Block", hint: "Stop the message entirely" },
  { value: "redact", label: "Redact", hint: "Strip sensitive parts, allow the rest" },
  { value: "warn", label: "Warn", hint: "Let it through with a warning" },
  { value: "require_approval", label: "Require approval", hint: "Hold for admin approval" },
  { value: "log_only", label: "Log only", hint: "Record silently, take no action" },
];

export function ExtensionPolicyPanel({
  organizationId,
  initialSettings,
}: {
  organizationId: string;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDomain(domain: string) {
    setSettings((s) => ({
      ...s,
      monitoredDomains: s.monitoredDomains.includes(domain)
        ? s.monitoredDomains.filter((d) => d !== domain)
        : [...s.monitoredDomains, domain],
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/dashboard/extension/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to save policy.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save policy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-cyan" />
        <h2 className="text-lg font-semibold">Extension policy</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        High-level guardrails applied to every enrolled browser. Granular rules live in{" "}
        <a href="/dashboard/usage-governance/policy" className="text-cyan hover:underline">
          Usage Governance
        </a>
        .
      </p>

      <div className="mt-5 space-y-5">
        {/* Enforcement toggle */}
        <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div>
            <p className="text-sm font-semibold">Enforcement enabled</p>
            <p className="text-xs text-slate-500">Turn the extension&apos;s protection on or off org-wide.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            className="h-5 w-5 accent-cyan"
          />
        </label>

        {/* Default action */}
        <div>
          <p className="text-sm font-semibold">When sensitive data is detected</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {ACTIONS.map((a) => (
              <button
                key={a.value}
                onClick={() => setSettings((s) => ({ ...s, action: a.value }))}
                className={`rounded-lg border p-3 text-left transition ${
                  settings.action === a.value
                    ? "border-cyan bg-cyan/10"
                    : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                }`}
              >
                <p className={`text-sm font-semibold ${settings.action === a.value ? "text-cyan" : "text-slate-200"}`}>
                  {a.label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{a.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Monitored tools */}
        <div>
          <p className="text-sm font-semibold">Monitored AI tools</p>
          <p className="text-xs text-slate-500">Text sent to these destinations is scanned before it leaves the browser.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AI_TOOL_CATALOG.map((tool) => {
              const on = settings.monitoredDomains.includes(tool.domain);
              return (
                <label
                  key={tool.domain}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                    on ? "border-cyan/40 bg-cyan/5" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleDomain(tool.domain)} className="h-4 w-4 accent-cyan" />
                  <span className="flex-1 text-slate-200">{tool.label}</span>
                  <span className="text-[10px] text-slate-500">{tool.domain}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Response scanning */}
        <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div>
            <p className="text-sm font-semibold">Scan AI responses</p>
            <p className="text-xs text-slate-500">Also inspect what the AI sends back for unsafe or leaked content.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.scanResponses}
            onChange={(e) => setSettings((s) => ({ ...s, scanResponses: e.target.checked }))}
            className="h-5 w-5 accent-cyan"
          />
        </label>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="button-primary !py-2 text-sm">
            {busy && <Loader2 size={15} className="mr-2 animate-spin" />}
            Save policy
          </button>
          {saved && <span className="text-xs text-emerald-300">Saved — devices sync on next heartbeat.</span>}
          {error && <span className="text-xs text-red-300">{error}</span>}
        </div>
      </div>
    </section>
  );
}
