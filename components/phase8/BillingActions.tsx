"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BillingActions({ organizationId, status }: { organizationId: string; status: string }) { const router = useRouter(); const [message, setMessage] = useState(""); async function action(path: string, reason: string) { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, reason }) }); const result = await response.json(); setMessage(response.ok ? `Subscription ${result.status ?? "updated"}.` : result.message); router.refresh(); }
  return <div className="mt-4 flex flex-wrap items-center gap-3">{status === "CANCELLED" ? <button className="button-primary !py-2" onClick={() => action("/api/billing/reactivate", "Billing page reactivation")}>Reactivate</button> : <button className="button-secondary !py-2" onClick={() => action("/api/billing/cancel", "Billing page cancellation")}>Cancel at period end</button>}<button className="button-secondary !py-2" onClick={() => action("/api/billing/lifecycle", "Lifecycle refresh")}>Refresh billing state</button>{message && <span className="text-sm text-cyan">{message}</span>}</div>;
}
