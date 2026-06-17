"use client";
import { useState } from "react";

export function PartnerProfileForm({ defaultWebsite = "", defaultMarkets = [] }: { defaultWebsite?: string; defaultMarkets?: string[] }) {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const response = await fetch("/api/ops/partner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: formData.get("website"), focusMarkets: String(formData.get("markets") ?? "").split(",").map((value) => value.trim()).filter(Boolean) }) });
    const result = await response.json(); setMessage(response.ok ? `Partner profile saved. Referral code: ${result.referralCode}` : result.message);
  }
  return <form action={submit} className="grid gap-4"><label className="text-sm text-slate-300">Website<input name="website" type="url" defaultValue={defaultWebsite} className="input mt-2" placeholder="https://agency.example" /></label><label className="text-sm text-slate-300">Focus markets<input name="markets" defaultValue={defaultMarkets.join(", ")} className="input mt-2" placeholder="SaaS, clinics, coaching" /></label><button className="button-primary">Save partner profile</button>{message && <p className="text-sm text-cyan">{message}</p>}</form>;
}
