"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  organizationId: string;
  currentPlan: string;
  plans: Array<{
    id: "STARTER" | "PRO" | "AGENCY";
    name: string;
    price: string;
    description: string;
    features: string[];
    highlight?: boolean;
  }>;
  enterpriseEmail: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

async function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  const scriptUrl = "https://checkout.razorpay.com/v1/checkout.js";
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
  if (existing) existing.remove();

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      resolve(false);
    }, 10_000);

    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve(Boolean(window.Razorpay));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export function PlanGrid({ organizationId, currentPlan, plans, enterpriseEmail }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function checkout(planId: "STARTER" | "PRO" | "AGENCY") {
    setLoading(planId);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, plan: planId }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === "string" ? ` ${data.detail}` : "";
        throw new Error(`${data.message ?? "Checkout failed."}${detail}`);
      }

      if (data.mock) {
        // Sandbox path: activate immediately so the dashboard reflects the new plan.
        const activate = await fetch("/api/billing/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            plan: planId,
            razorpayOrderId: data.orderId,
            razorpayPaymentId: `mock_pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
            mock: true,
          }),
        });
        if (!activate.ok) {
          const detail = await activate.json();
          throw new Error(detail.message ?? "Mock activation failed.");
        }
        setMessage({ tone: "ok", text: `Sandbox plan switched to ${planId}.` });
        router.refresh();
        return;
      }

      const ok = await ensureRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Could not load Razorpay checkout script.");

      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "SoterAI",
        description: `${planId} plan`,
        order_id: data.orderId,
        notes: { organizationId, plan: planId },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const activate = await fetch("/api/billing/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              plan: planId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const data = await activate.json();
          if (!activate.ok) {
            setMessage({ tone: "err", text: data.message ?? "Payment captured but activation failed." });
            return;
          }
          setMessage({ tone: "ok", text: `${planId} plan activated.` });
          router.refresh();
        },
      });
      razorpay.open();
    } catch (caught) {
      setMessage({ tone: "err", text: caught instanceof Error ? caught.message : "Checkout failed." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div key={plan.id} className={`card flex h-full flex-col p-5 ${plan.highlight ? "border-cyan/40" : ""} ${isCurrent ? "ring-2 ring-cyan/40" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-cyan/10 p-2 text-cyan"><CreditCard size={18} /></span>
                {isCurrent && <span className="rounded-full bg-cyan/15 px-2 py-1 text-[10px] font-bold uppercase text-cyan">Current</span>}
              </div>
              <p className="mt-4 text-lg font-bold">{plan.name}</p>
              <p className="mt-1 text-2xl font-black">{plan.price}</p>
              <p className="mt-2 text-xs text-slate-500">{plan.description}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
                {plan.features.map((feature) => <li key={feature}>· {feature}</li>)}
              </ul>
              <div className="mt-auto pt-5">
                <button
                  type="button"
                  disabled={isCurrent || loading === plan.id}
                  onClick={() => checkout(plan.id)}
                  className={isCurrent ? "button-secondary block w-full text-center !py-2 text-xs" : "button-primary block w-full text-center !py-2 text-xs gap-2"}
                >
                  {loading === plan.id ? <Loader2 className="animate-spin" size={14} /> : null}
                  {isCurrent ? "Current plan" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
        <div className="card flex h-full flex-col p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-cyan/10 p-2 text-cyan"><CreditCard size={18} /></span>
            {currentPlan === "ENTERPRISE" && <span className="rounded-full bg-cyan/15 px-2 py-1 text-[10px] font-bold uppercase text-cyan">Current</span>}
          </div>
          <p className="mt-4 text-lg font-bold">Enterprise</p>
          <p className="mt-1 text-2xl font-black">Talk to us</p>
          <p className="mt-2 text-xs text-slate-500">Custom volume, SSO, audit log retention, priority support.</p>
          <div className="mt-auto pt-5">
            <a href={`mailto:${enterpriseEmail}?subject=${encodeURIComponent("Enterprise plan inquiry")}`} className="button-secondary block w-full text-center !py-2 text-xs gap-2">
              Contact sales <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
      {message && (
        <p className={`mt-5 rounded-xl p-3 text-sm ${message.tone === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{message.text}</p>
      )}
    </div>
  );
}
