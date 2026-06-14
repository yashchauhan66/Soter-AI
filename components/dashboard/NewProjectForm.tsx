"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  clients?: { id: string; name: string }[];
}

export function NewProjectForm({ clients = [] }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const preselectedClient = search.get("clientId") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || undefined,
          publicName: form.get("publicName") || undefined,
          clientId: form.get("clientId") || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not create project.");
      router.push("/dashboard/projects");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create project.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-5 p-6">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium">Project name</label>
        <input id="name" name="name" required minLength={2} maxLength={80} className="input" placeholder="Customer support chatbot" />
      </div>
      <div>
        <label htmlFor="publicName" className="mb-2 block text-sm font-medium">Public name (for badge)</label>
        <input id="publicName" name="publicName" maxLength={80} className="input" placeholder="Acme Help Desk" />
        <p className="mt-1 text-xs text-slate-500">Shown on the public security status page. Defaults to the project name.</p>
      </div>
      {clients.length > 0 && (
        <div>
          <label htmlFor="clientId" className="mb-2 block text-sm font-medium">Client (optional)</label>
          <select id="clientId" name="clientId" className="input" defaultValue={preselectedClient}>
            <option value="">No client</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium">Description</label>
        <textarea id="description" name="description" maxLength={300} className="input min-h-28" placeholder="Where and how this guard will be used" />
      </div>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <button disabled={loading} className="button-primary">{loading ? "Creating..." : "Create project"}</button>
    </form>
  );
}
