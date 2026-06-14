"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewClientForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/agency/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          contactEmail: form.get("contactEmail") || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not create client.");
      router.push(`/dashboard/agency/clients/${data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create client.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-7 grid max-w-xl gap-4 p-5">
      <input name="name" required minLength={2} maxLength={120} className="input" placeholder="Acme Corporation" />
      <input name="contactEmail" type="email" maxLength={200} className="input" placeholder="contact@client.com (optional)" />
      <button disabled={loading} className="button-primary">{loading ? "Creating..." : "Create client"}</button>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </form>
  );
}
