"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { ResolvedPolicy } from "@/lib/guard/policy";

const TOGGLES: Array<[keyof ResolvedPolicy, string, string]> = [
  ["blockPromptInjection", "Block prompt injection", "Detects and blocks instruction-override and bypass attempts."],
  ["blockJailbreak", "Block jailbreaks", "Detects DAN, developer-mode, and similar persona prompts."],
  ["redactPII", "Redact PII", "Email, phone, address, DOB, IP, payment-card-like patterns."],
  ["redactIndiaPII", "Redact India-specific PII", "Aadhaar, PAN, GSTIN, UPI, IFSC, mobile, bank, student, patient identifiers."],
  ["blockSecrets", "Block secrets", "API keys, tokens, JWTs, database URLs, private keys."],
  ["blockSystemPromptLeak", "Block system prompt leakage", "Both attempts to extract and outputs that disclose internal instructions."],
];

export function PolicyForm({ projectId, initial }: { projectId: string; initial: ResolvedPolicy }) {
  const router = useRouter();
  const [policy, setPolicy] = useState<ResolvedPolicy>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/projects/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...policy, customFallbackMessage: policy.customFallbackMessage ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Save failed.");
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-7 grid gap-5">
      <div className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Policy mode</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {(["MONITOR", "BALANCED", "STRICT"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPolicy({ ...policy, mode })}
              className={`rounded-xl border p-4 text-left transition ${policy.mode === mode ? "border-cyan/60 bg-cyan/5" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"}`}
            >
              <p className="font-semibold">{mode}</p>
              <p className="mt-1 text-xs text-slate-500">
                {mode === "MONITOR"
                  ? "Logs everything, downgrades blocks except for secrets."
                  : mode === "BALANCED"
                    ? "Default. Blocks high-risk, redacts sensitive."
                    : "Promotes redaction/rewrite to block at score ≥ 50."}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Detectors</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {TOGGLES.map(([key, label, description]) => (
            <label key={String(key)} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 p-4 hover:border-cyan/40">
              <input
                type="checkbox"
                checked={Boolean(policy[key as keyof ResolvedPolicy])}
                onChange={(event) => setPolicy({ ...policy, [key]: event.currentTarget.checked } as ResolvedPolicy)}
                className="mt-1 h-4 w-4 accent-cyan"
              />
              <div>
                <p className="font-medium">{label}</p>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Unsafe output handling</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(["WARN", "REDACT", "BLOCK"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPolicy({ ...policy, unsafeOutputMode: mode })}
              className={`rounded-lg border p-3 text-sm ${policy.unsafeOutputMode === mode ? "border-cyan/60 bg-cyan/5" : "border-slate-800 hover:border-slate-600"}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6 grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">RAG grounding</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3"><input type="checkbox" checked={policy.citationRequired} onChange={(event) => setPolicy({ ...policy, citationRequired: event.currentTarget.checked })} className="h-4 w-4 accent-cyan" /> Require citations</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={policy.requireSourceUrls} onChange={(event) => setPolicy({ ...policy, requireSourceUrls: event.currentTarget.checked })} className="h-4 w-4 accent-cyan" /> Require source URLs</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={policy.highRiskTopicReview} onChange={(event) => setPolicy({ ...policy, highRiskTopicReview: event.currentTarget.checked })} className="h-4 w-4 accent-cyan" /> Review high-risk topics</label>
            <label className="text-sm">Minimum sources<input type="number" min={0} max={20} value={policy.minSourceCount} onChange={(event) => setPolicy({ ...policy, minSourceCount: Number(event.currentTarget.value) })} className="input mt-2" /></label>
          </div>
          <textarea className="input mt-3 min-h-20" maxLength={500} value={policy.noSourceFallback ?? ""} onChange={(event) => setPolicy({ ...policy, noSourceFallback: event.target.value || null })} placeholder="I don't have verified source information for this answer. Please contact support." />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom blocked topics (one per line)</p>
          <textarea
            className="input mt-2 min-h-24"
            value={policy.customBlockedTopics.join("\n")}
            onChange={(event) => setPolicy({ ...policy, customBlockedTopics: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            placeholder="competitor pricing&#10;internal codename"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom denylist regex (one per line)</p>
          <textarea
            className="input mt-2 min-h-24 font-mono text-xs"
            value={policy.deniedPatterns.join("\n")}
            onChange={(event) => setPolicy({ ...policy, deniedPatterns: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            placeholder="EMP-\\d{6}&#10;internal_token=[a-z0-9]+"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Allowlisted domains (one per line)</p>
          <textarea
            className="input mt-2 min-h-20"
            value={policy.allowlistedDomains.join("\n")}
            onChange={(event) => setPolicy({ ...policy, allowlistedDomains: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
            placeholder="docs.acme.com&#10;status.acme.com"
          />
          <p className="mt-1 text-xs text-slate-500">Used by the unsafe-output detector to ignore links from approved domains.</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom block fallback message</p>
          <textarea
            className="input mt-2 min-h-20"
            maxLength={500}
            value={policy.customFallbackMessage ?? ""}
            onChange={(event) => setPolicy({ ...policy, customFallbackMessage: event.target.value || null })}
            placeholder="We can't help with that. Please rephrase or contact support."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="button-primary gap-2"><Save size={16} /> {saving ? "Saving..." : "Save policy"}</button>
        {savedAt && <span className="text-xs text-emerald-300">Saved at {savedAt}</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </div>
  );
}
