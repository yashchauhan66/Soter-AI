import Link from "next/link";
import type { Metadata } from "next";
import { Check, Sparkles } from "lucide-react";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { productStatus, STATUS_BADGE } from "@/lib/marketing/launchStatus";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": `${siteUrl}/pricing#product`,
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
      mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/pricing` },
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/pricing#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What counts as a security check?",
          acceptedAnswer: { "@type": "Answer", text: "Each API call to an input, output, PII, RAG, or grounding guard endpoint counts as one security check. Integration calls are counted the same way." },
        },
        {
          "@type": "Question",
          name: "Does SoterAI store my prompts or AI outputs?",
          acceptedAnswer: { "@type": "Answer", text: "SoterAI is designed to avoid persisting raw prompts, secrets, and AI outputs on redaction paths. Audit records store metadata such as risk scores, categories, timestamps, and actions." },
        },
        {
          "@type": "Question",
          name: "Is SoterAI a replacement for human security review?",
          acceptedAnswer: { "@type": "Answer", text: "No. SoterAI is a defense-in-depth control that reduces risk. It does not replace human review, secure design, monitoring, or incident response." },
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  title: "AI Security Pricing: Free to Enterprise",
  description:
    "SoterAI AI security pricing for Indian businesses. Free plan at ₹0/mo, Starter at ₹999/mo, Pro at ₹2,999/mo, Agency and Enterprise plans. AI guardrails, PII redaction, and agent firewall for every budget.",
  keywords: ["ai security pricing", "ai guardrail cost", "llm security pricing india", "prompt injection protection price", "aadhaar pii detection cost", "budget ai security"],
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "SoterAI Pricing: Free, Starter, Pro, Agency, Enterprise",
    description: "AI security plans starting at ₹0/mo. Prompt injection protection, India PII detection, agent firewall, and guardrails for Indian businesses of every size.",
  },
};

/**
 * Plan definitions.
 *
 * `highlight` marks the recommended plan. Five plan cards with identical visual
 * weight and five identical "Start Free" buttons gave the visitor no guidance at
 * all — a pricing table's job is to make one choice obviously the default.
 * Prices use the ₹ symbol rather than the string "INR" because that is what an
 * Indian buyer scans for.
 */
const plans = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    copy: "Evaluate API Guard, the playground, and one project.",
    features: ["Input/output guard", "Playground access", "Basic logs"],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Starter",
    price: "₹999",
    cadence: "per month",
    copy: "For a guarded AI app with operational alerts.",
    features: ["Signed webhooks", "Monthly reports", "5 projects"],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Pro",
    price: "₹2,999",
    cadence: "per month",
    copy: "For growing product and security teams.",
    features: ["Higher limits", "Security badge", "20 projects"],
    cta: "Start free",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Agency",
    price: "₹9,999",
    cadence: "per month",
    copy: "For agencies protecting multiple client AI workflows.",
    features: ["Client management", "White-label reports", "Partner resources"],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "volume-based",
    copy: "For regulated, high-scale, self-hosted, or paid pilot deployments.",
    features: ["SAML and SCIM", "SIEM and retention", "Pilot and SLA review"],
    cta: "Join paid pilot",
    href: "/enterprise/pilot",
  },
];


const comparisonRows = [
  { feature: "Input/output guard", starter: "Included", pro: "Included", enterprise: "Included" },
  { feature: "Signed webhooks", starter: "Included", pro: "Included", enterprise: "Included" },
  { feature: "Projects", starter: "5", pro: "20", enterprise: "Custom" },
  { feature: "Monthly reports", starter: "Included", pro: "Advanced", enterprise: "Custom evidence pack" },
  { feature: "SSO / SCIM", starter: "Not included", pro: "Not included", enterprise: "Included" },
  { feature: "SIEM and retention", starter: "Basic", pro: "Advanced", enterprise: "Custom" },
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
        <h1 className="heading-1 mt-2">Plans for guarded AI operations</h1>
        <p className="lede mt-4">
          Server-enforced limits, transparent lifecycle states, and OWASP LLM Top 10 aligned defense in depth. No plan
          claims complete protection, SOC 2 compliance, or unqualified enterprise GA readiness.
        </p>

        {/* `items-start` matters: without it the highlighted card's extra ring
            would stretch every sibling to match its height. */}
        <div className="mt-10 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`card relative flex flex-col p-5 ${
                plan.highlight ? "border-cyan/40 shadow-ring-brand xl:-mt-3" : ""
              }`}
            >
              {plan.highlight && (
                <span className="badge-brand absolute -top-3 left-5">
                  <Sparkles size={12} aria-hidden="true" /> Most popular
                </span>
              )}

              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span data-numeric className="text-3xl font-black text-cyan">
                  {plan.price}
                </span>
                <span className="text-xs text-slate-400">{plan.cadence}</span>
              </p>
              <p className="mt-3 min-h-[3.5rem] text-sm leading-6 text-slate-300">{plan.copy}</p>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-300">
                    <Check size={15} className="mt-1 shrink-0 text-lime" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                className={`${plan.highlight ? "button-primary" : "button-secondary"} button-sm mt-6 w-full`}
                href={plan.href}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          All plans include the same detection engine. Higher tiers raise limits and add team, reporting, and governance
          capabilities — they do not unlock stronger security.
        </p>
      </section>

      <section className="container-page pb-16">
        <h2 className="heading-3">Feature comparison</h2>
        <p className="body-copy mt-3 text-sm">
          Compare Starter, Pro, and Enterprise before choosing a plan. Free is for evaluation and playground use.
        </p>
        <div className="mt-6 overflow-x-auto rounded-card border border-slate-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Feature availability by plan</caption>
            <thead className="bg-slate-950/80 text-slate-300">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Feature</th>
                <th scope="col" className="px-4 py-3 font-semibold">Starter</th>
                <th scope="col" className="px-4 py-3 font-semibold">Pro</th>
                <th scope="col" className="px-4 py-3 font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="bg-slate-950/40">
                  <th scope="row" className="px-4 py-3 font-medium text-slate-100">{row.feature}</th>
                  <td className="px-4 py-3 text-slate-300">{row.starter}</td>
                  <td className="px-4 py-3 text-slate-300">{row.pro}</td>
                  <td className="px-4 py-3 text-slate-300">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-slate-800 py-12">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Billing behavior</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Trials expire after the configured window. Payment failures enter a limited grace period. Plan activation
              and changes require server-verified Razorpay signatures.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Need deployment review?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Enterprise pricing depends on message volume, deployment model, support expectations, and integration
              scope. Enterprise GA remains evidence-gated.
            </p>
            <Link href="/contact-sales" className="mt-4 inline-flex font-semibold text-cyan hover:underline">
              Book a security demo
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="heading-3">Product status by surface</h2>
        <p className="body-copy mt-3">
          Integrations are sold and supported according to their status label. Stable does not mean complete protection;
          Beta and Labs carry pilot expectations.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {productStatus.map((product) => (
            <div key={product.name} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{product.name}</h3>
                {/* Same semantic tones as the Features section, so a status means
                    the same thing everywhere on the site. */}
                <span className={STATUS_BADGE[product.status]}>{product.status}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{product.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 py-16">
        <div className="container-page">
          <h2 className="heading-3">Frequently asked questions</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="card p-5">
                <h3 className="font-semibold text-slate-100">{faq.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
