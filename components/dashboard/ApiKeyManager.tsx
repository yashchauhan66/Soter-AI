"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Project = { id: string; name: string };
type Key = {
  id: string;
  name: string;
  prefix: string;
  projectId: string;
  isActive: boolean;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
  project: { name: string };
};

export function ApiKeyManager({ projects, keys }: { projects: Project[]; keys: Key[] }) {
  const router = useRouter();
  const [rawKey, setRawKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [copied, setCopied] = useState(false);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          projectId: form.get("projectId"),
          environment: form.get("environment"),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "API key generation failed.");
      setRawKey(data.apiKey);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API key generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleKey(id: string, isActive: boolean) {
    setUpdatingId(id);
    setError("");
    try {
      const response = await fetch("/api/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "API key update failed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API key update failed.");
    } finally {
      setUpdatingId("");
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
  }


  return (
    <div>
      <form onSubmit={createKey} className="card grid gap-4 p-5 md:grid-cols-[1fr_1fr_150px_auto]">
        <input name="name" required minLength={2} maxLength={80} className="input" placeholder="Production gateway" />
        <select name="projectId" required className="input" defaultValue={projects[0]?.id}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select name="environment" className="input" defaultValue="test">
          <option value="test">Test key</option>
          <option value="live">Live key</option>
        </select>
        <button disabled={loading || !projects.length} className="button-primary">
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>
      
      {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {rawKey && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-semibold text-amber-200">Copy this key now. It will not be shown again.</p>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-950 p-3 text-sm text-slate-200">{rawKey}</code>
            <button type="button" className="button-secondary !px-4" onClick={copyKey} aria-label="Copy API key">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}
      <div className="mt-7 space-y-3">
        {keys.length ? keys.map((key) => (
          <div key={key.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              <span className="rounded-xl bg-cyan/10 p-3 text-cyan"><KeyRound size={20} /></span>
              <div>
                <p className="font-semibold">{key.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{key.prefix}******** · {key.project.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Last used: {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={updatingId === key.id}
              onClick={() => toggleKey(key.id, key.isActive)}
              className={key.isActive ? "button-secondary !py-2 text-red-300" : "button-secondary !py-2 text-emerald-300"}
            >
              {updatingId === key.id ? "Updating..." : key.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        )) : <div className="card p-10 text-center text-slate-500">No API keys issued yet.</div>}
      </div>
    </div>
  );
}
