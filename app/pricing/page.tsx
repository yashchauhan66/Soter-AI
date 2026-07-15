import Link from "next/link";
import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { productStatus } from "@/lib/marketing/launchStatus";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "SoterAI",
  applicationCategory: "SecurityApplication",
  description: "AI data and agent-action security for browsers, IDEs, workflows, and APIs.",
  url: `${siteUrl}/pricing`,
  brand: { "@type": "Brand", name: "SoterAI" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "0",
    highPrice: "9999",
    offerCount: "5",
  },
};

export const metadata: Metadata = {
  title: "Pricing | SoterAI AI Security Plans",
  description:
    "SoterAI pricing for guarded AI operations: Free, Starter, Pro, Agency, and Enterprise. Includes honest status labels for API, browser, VS Code, n8n, MCP, and audit evidence surfaces.",
  alternates: { canonical: "/pricing" },
};

const plans = [
  { name: "Free", price: "INR 0", copy: "Evaluate API Guard, the playground, and one project.", features: ["Input/output guard", "Playground", "Basic logs"], cta: "Start Free", href: "/signup" },
  { name: "Starter", price: "INR 999/mo", copy: "For a guarded AI app with operational alerts.", features: ["Signed webhooks", "Monthly reports", "5 projects"], cta: "Start Free", href: "/signup" },
  { name: "Pro", price: "INR 2,999/mo", copy: "For growing product and security teams.", features: ["Higher limits", "Security badge", "20 projects"], cta: "Start Free", href: "/signup" },
  { name: "Agency", price: "INR 9,999/mo", copy: "For agencies protecting multiple client AI workflows.", features: ["Client management", "White-label reports", "Partner resources"], cta: "Start Free", href: "/signup" },
  { name: "Enterprise", price: "Custom", copy: "For regulated, high-scale, self-hosted, or paid pilot deployments.", features: ["SAML and SCIM", "SIEM and retention", "Pilot and SLA review"], cta: "Join Paid Pilot", href: "/enterprise/pilot" },
];

const faqs = [
  {
    q: "What counts as a security check?",
    a: "Each API call to an input, output, PII, RAG, or grounding guard endpoint counts as one security check. Integration calls are counted the same way.",
  },
  {
    q: "Are all integrations production ready?",
    a: "No. Each product surface has its own status label. API Guard and Audit Evidence are stable; Browser Guard, VS Code Guard, and n8n Guard are beta; MCP / Agent Guard is labs.",
  },
  {
    q: "Does SoterAI store my prompts or AI outputs?",
    a: "SoterAI is designed to avoid persisting raw prompts, secrets, and AI outputs on redaction paths. Audit records store metadata such as risk scores, categories, timestamps, and actions.",
  },
  {
    q: "Is SoterAI a replacement for human security review?",
    a: "No. SoterAI is a defense-in-depth control that reduces risk. It does not replace human review, secure design, monitoring, or incident response.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(pricingJsonLd) }} />

      <section className="container-page py-16">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-2 text-4xl font-bold">Plans for guarded AI operations</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          Server-enforced limits, transparent lifecycle states, and OWASP LLM Top 10 aligned defense-in-depth.
          No plan claims complete protection, SOC2 compliance, or unqualified enterprise GA readiness.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => (
            <article className="card flex flex-col p-5" key={plan.name}>
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-2 text-2xl font-bold text-cyan">{plan.price}</p>
              <p className="mt-3 min-h-20 text-sm text-slate-400">{plan.copy}</p>
              <div className="mt-4 space-y-2 text-sm">{plan.features.map((feature) => <p key={feature}>+ {feature}</p>)}</div>
              <Link className="button-secondary mt-6 !px-3 !py-2" href={plan.href}>{plan.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 py-12">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Billing behavior</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Trials expire after the configured window. Payment failures enter a limited grace period. Plan activation and changes require server-verified Razorpay signatures.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Need deployment review?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Enterprise pricing depends on message volume, deployment model, support expectations, and integration scope. Enterprise GA remains evidence-gated.
            </p>
            <Link href="/contact-sales" className="mt-4 inline-block text-cyan hover:underline">Book Security Demo</Link>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-2xl font-semibold">Product status by surface</h2>
        <p className="mt-3 text-slate-400">Integrations are sold and supported according to their status label. Stable does not mean complete protection; Beta and Labs require pilot expectations.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {productStatus.map((product) => (
            <div key={product.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{product.name}</h3>
                <span className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs text-cyan">{product.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{product.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 py-16">
        <div className="container-page">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="card p-5">
                <h3 className="font-semibold text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
