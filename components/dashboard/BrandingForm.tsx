"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

interface Props {
  agency: { id: string; name: string; contactEmail: string };
  branding: {
    agencyName: string;
    logoUrl: string;
    contactEmail: string;
    reportFooter: string;
    brandColor: string;
  } | null;
}

export function BrandingForm({ agency, branding }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function saveAll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const form = new FormData(event.currentTarget);
      const agencyResponse = await fetch("/api/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("agencyName"),
          contactEmail: form.get("contactEmail") || undefined,
        }),
      });
      const agencyJson = await agencyResponse.json();
      if (!agencyResponse.ok) throw new Error(agencyJson.message ?? "Agency update failed.");

      const brandingResponse = await fetch("/api/agency/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyName: form.get("agencyName"),
          logoUrl: form.get("logoUrl") || "",
          contactEmail: form.get("contactEmail") || "",
          reportFooter: form.get("reportFooter") || "",
          brandColor: form.get("brandColor") || "",
        }),
      });
      const brandingJson = await brandingResponse.json();
      if (!brandingResponse.ok) throw new Error(brandingJson.message ?? "Branding update failed.");
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={saveAll} className="card mt-7 grid gap-4 p-6 max-w-2xl">
      <div>
        <label className="text-sm font-semibold">Agency name</label>
        <input name="agencyName" required minLength={2} maxLength={120} defaultValue={branding?.agencyName ?? agency.name} className="input mt-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold">Contact email</label>
          <input name="contactEmail" type="email" defaultValue={branding?.contactEmail ?? agency.contactEmail} maxLength={254} className="input mt-2" />
        </div>
        <div>
          <label className="text-sm font-semibold">Brand colour</label>
          <input name="brandColor" defaultValue={branding?.brandColor ?? "#31d7c8"} maxLength={7} className="input mt-2" placeholder="#31d7c8" />
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold">Logo URL</label>
        <input name="logoUrl" type="url" defaultValue={branding?.logoUrl} maxLength={2048} className="input mt-2" placeholder="https://yourdomain.com/logo.png" />
      </div>
      <div>
        <label className="text-sm font-semibold">Report footer</label>
        <textarea name="reportFooter" defaultValue={branding?.reportFooter} className="input mt-2 min-h-24" placeholder="Generated for internal use only. Not legal advice." maxLength={500} />
      </div>
      <button disabled={loading} className="button-primary gap-2 self-start"><Save size={16} /> {loading ? "Saving..." : "Save settings"}</button>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">Saved.</p>}
    </form>
  );
}
