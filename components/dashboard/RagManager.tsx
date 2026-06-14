"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RagManager({ projectId, collections }: { projectId: string; collections: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function createCollection(formData: FormData) {
    const response = await fetch("/api/rag/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, name: formData.get("name"), description: formData.get("description") }) });
    const data = await response.json(); setMessage(response.ok ? "Collection created." : data.message); if (response.ok) router.refresh();
  }
  async function upload(formData: FormData) {
    const response = await fetch("/api/rag/documents", { method: "POST", body: formData });
    const data = await response.json(); setMessage(response.ok ? `Scanned: ${data.status}, trust ${data.trustScore}` : data.message); if (response.ok) router.refresh();
  }
  return <div className="grid gap-5 lg:grid-cols-2">
    <form action={createCollection} className="card p-6"><h2 className="font-semibold">New collection</h2><input name="name" required minLength={2} className="input mt-4" placeholder="Support knowledge base" /><textarea name="description" className="input mt-3" placeholder="Purpose and approved sources" /><button className="button-primary mt-3">Create collection</button></form>
    <form action={upload} className="card p-6"><h2 className="font-semibold">Scan document</h2><select name="collectionId" required className="input mt-4"><option value="">Select collection</option>{collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="file" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" required className="input mt-3" /><p className="mt-2 text-xs text-slate-500">TXT, Markdown, and text-extractable PDF. Raw secrets are never stored.</p><button className="button-primary mt-3">Upload and scan</button></form>
    {message && <p className="text-sm text-cyan lg:col-span-2">{message}</p>}
  </div>;
}
