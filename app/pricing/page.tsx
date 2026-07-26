import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, HelpCircle, Zap, Users, Building2, Shield, ArrowRight } from "lucide-react";
import { safeJsonLd } from "@/lib/seo/jsonLd";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "SoterAI",
  "applicationCategory": "SecurityApplication",
  "description": "AI security command layer for chatbots, RAG apps, and autonomous agents.",
  "url": `${siteUrl}/pricing`,
  "brand": { "@type": "Brand", "name": "SoterAI" },
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "INR",
    "lowPrice": "0",
    "highPrice": "9999",
    "offerCount": "5",
    "offers": [
      { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Starter", "price": "999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Pro", "price": "2999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Agency", "price": "9999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Enterprise", "price": "0", "priceCurrency": "INR", "availability": "https://schema.org/ContactForPricing" },
    ],
  },
};

export const metadata: Metadata = {
  title: "Pricing | SoterAI AI Security Plans",
  description:
    "SoterAI pricing for guarded AI operations — Free, Starter, Pro, Agency, and Enterprise. Server-enforced limits, signed webhooks, white-label reports, SAML/SCIM, and SIEM.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | SoterAI AI Security Plans",
    description: "Free, Starter, Pro, Agency, and Enterprise plans for AI security guardrails. India PII detection, RAG security, and agent firewall included.",
  },
};

// ── Plan definitions ────────────────────────────────────────────────────────

interface PlanDef {
  id: string;
  name: string;
  price: string;
  period: string;
  icon: typeof Zap;
  copy: string;
  target: string;
  highlight: boolean;
  cta: string;
  ctaHref: string;
  features: Array<{ text: string; included: boolean; group?: string }>;
  limits: string[];
}

const plans: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "",
    icon: Zap,
    copy: "Evaluate core guard behaviour and validate your AI workflow at no cost.",
    target: "Individual developers & evaluation",
    highlight: false,
    cta: "Start free",
    ctaHref: "/signup",
    features: [
      { text: "Input Guard (prompt injection, jailbreak)", included: true, group: "Guard" },
      { text: "Output Guard (unsafe content filtering)", included: true, group: "Guard" },
      { text: "PII redaction (global + India Aadhaar/PAN)", included: true, group: "Guard" },
      { text: "Secrets & credential detection", included: true, group: "Guard" },
      { text: "Playground for testing", included: true, group: "Guard" },
      { text: "Basic guard audit logs", included: true, group: "Logs" },
      { text: "1 project", included: true, group: "Limits" },
      { text: "Signed webhooks", included: false, group: "Alerts" },
      { text: "Monthly reports", included: false, group: "Reports" },
      { text: "RAG security scanning", included: false, group: "Advanced" },
      { text: "Agent Firewall", included: false, group: "Advanced" },
      { text: "Team management", included: false, group: "Team" },
    ],
    limits: ["~10K requests/mo", "1 project", "Basic logs"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹999",
    period: "/mo",
    icon: Shield,
    copy: "For a production chatbot with operational alerts and scheduled reporting.",
    target: "Production chatbot teams",
    highlight: false,
    cta: "Start free trial",
    ctaHref: "/signup",
    features: [
      { text: "Input Guard + Output Guard + PII redaction", included: true, group: "Guard" },
      { text: "Secrets & credential detection", included: true, group: "Guard" },
      { text: "Signed webhooks with retry logic", included: true, group: "Alerts" },
      { text: "Monthly PDF reports with trends", included: true, group: "Reports" },
      { text: "Cost firewall (budget controls)", included: true, group: "Advanced" },
      { text: "Playground + basic logs", included: true, group: "Logs" },
      { text: "5 projects", included: true, group: "Limits" },
      { text: "RAG security scanning", included: false, group: "Advanced" },
      { text: "Agent Firewall", included: false, group: "Advanced" },
      { text: "Team management", included: false, group: "Team" },
      { text: "Audit exports", included: false, group: "Compliance" },
      { text: "SSO / SCIM", included: false, group: "Enterprise" },
    ],
    limits: ["~50K requests/mo", "5 projects", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹2,999",
    period: "/mo",
    icon: Users,
    copy: "For growing product and security teams that need RAG security, agent controls, and team collaboration.",
    target: "Product & security teams",
    highlight: true,
    cta: "Start free trial",
    ctaHref: "/signup",
    features: [
      { text: "All Starter features", included: true, group: "Guard" },
      { text: "RAG document scanning & quarantine", included: true, group: "Advanced" },
      { text: "Agent Firewall (tool-call control)", included: true, group: "Advanced" },
      { text: "Semantic egress detection", included: true, group: "Advanced" },
      { text: "Canary network (tripwire tokens)", included: true, group: "Advanced" },
      { text: "Red-team testing lab", included: true, group: "Advanced" },
      { text: "Team management (multi-user org)", included: true, group: "Team" },
      { text: "Audit exports (HMAC-signed JSONL/CSV)", included: true, group: "Compliance" },
      { text: "Custom retention policies", included: true, group: "Compliance" },
      { text: "Higher rate limits", included: true, group: "Limits" },
      { text: "20 projects", included: true, group: "Limits" },
      { text: "Security badge for status page", included: true, group: "Brand" },
      { text: "SSO / SCIM", included: false, group: "Enterprise" },
      { text: "SIEM integration", included: false, group: "Enterprise" },
    ],
    limits: ["~200K requests/mo", "20 projects", "Email support"],
  },
  {
    id: "agency",
    name: "Agency",
    price: "₹9,999",
    period: "/mo",
    icon: Building2,
    copy: "For agencies protecting multiple client chatbots with white-label reporting and partner resources.",
    target: "Agencies & consultancies",
    highlight: false,
    cta: "Start free trial",
    ctaHref: "/signup",
    features: [
      { text: "All Pro features", included: true, group: "Guard" },
      { text: "White-label security reports", included: true, group: "Agency" },
      { text: "Client management & portfolio", included: true, group: "Agency" },
      { text: "Evidence vault (SOC 2 / ISO 27001)", included: true, group: "Compliance" },
      { text: "Partner resources & referral", included: true, group: "Agency" },
      { text: "All advanced security features", included: true, group: "Advanced" },
      { text: "SSO / SCIM", included: false, group: "Enterprise" },
      { text: "SIEM integration", included: false, group: "Enterprise" },
      { text: "Priority support", included: false, group: "Support" },
    ],
    limits: ["~500K requests/mo", "50 projects", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    icon: Shield,
    copy: "For regulated, high-scale, or self-hosted deployments with dedicated support and SLAs.",
    target: "Regulated enterprises & high-scale",
    highlight: false,
    cta: "Request pilot",
    ctaHref: "/enterprise/pilot",
    features: [
      { text: "All Agency features", included: true, group: "Guard" },
      { text: "SAML / OIDC SSO", included: true, group: "Enterprise" },
      { text: "SCIM v2 provisioning", included: true, group: "Enterprise" },
      { text: "SIEM integration (Splunk, Sentinel, Datadog)", included: true, group: "Enterprise" },
      { text: "IP allowlisting", included: true, group: "Enterprise" },
      { text: "Self-hosted Docker deployment", included: true, group: "Enterprise" },
      { text: "Custom retention & audit exports", included: true, group: "Compliance" },
      { text: "Dedicated support & SLA", included: true, group: "Support" },
      { text: "Unlimited projects & requests", included: true, group: "Limits" },
    ],
    limits: ["Unlimited requests", "Unlimited projects", "Dedicated support & SLA"],
  },
];

// ── Compare rows ────────────────────────────────────────────────────────────

interface CompareRow {
  label: string;
  values: string[];
  section?: string;
}

const compareRows: CompareRow[] = [
  { section: "Core Security", label: "", values: ["", "", "", "", ""] },
  { label: "Input Guard (prompt injection)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Output Guard (unsafe content)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "PII redaction (global + India)", values: ["✓", "✓", "✓", "✓", "✓"] },
  { label: "Secrets / credential detection", values: ["✓", "✓", "✓", "✓", "✓"] },

  { section: "Advanced Security", label: "", values: ["", "", "", "", ""] },
  { label: "RAG scanning & quarantine", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Agent Firewall", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Semantic egress", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Canary network", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Red-team lab", values: ["—", "—", "✓", "✓", "✓"] },

  { section: "Operations", label: "", values: ["", "", "", "", ""] },
  { label: "Signed webhooks", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Monthly reports", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Cost firewall", values: ["—", "✓", "✓", "✓", "✓"] },
  { label: "Audit exports (signed)", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "Custom retention", values: ["—", "—", "✓", "✓", "✓"] },

  { section: "Team & Enterprise", label: "", values: ["", "", "", "", ""] },
  { label: "Team management", values: ["—", "—", "✓", "✓", "✓"] },
  { label: "White-label reports", values: ["—", "—", "—", "✓", "✓"] },
  { label: "Evidence vault", values: ["—", "—", "—", "✓", "✓"] },
  { label: "SAML / OIDC SSO", values: ["—", "—", "—", "—", "✓"] },
  { label: "SCIM provisioning", values: ["—", "—", "—", "—", "✓"] },
  { label: "SIEM integration", values: ["—", "—", "—", "—", "✓"] },
  { label: "Self-hosted deployment", values: ["✓", "✓", "✓", "✓", "✓"] },
];

const planShortNames = ["Free", "Starter", "Pro", "Agency", "Enterprise"];

const faqs = [
  {
    q: "What counts as a security check?",
    a: "Each API call to the Input Guard, Output Guard, PII Redactor, or RAG Scanner endpoints counts as one security check. Calls from any integration (n8n, Zapier, Make, Dify, Botpress, etc.) or direct API usage are counted the same way.",
  },
  {
    q: "Can I use SoterAI with n8n, Zapier, Make, and other platforms?",
    a: "Yes. SoterAI has ready-to-use integrations for n8n, Dify, Zapier, Make.com, Botpress, Flowise, Langflow, and Voiceflow. All integrations work with every plan, including Free.",
  },
  {
    q: "Does SoterAI store my prompts or AI outputs?",
    a: "No. SoterAI processes text in-memory for security analysis and does not persist raw prompts or AI responses. Only threat detection summaries (risk scores, categories, timestamps) are stored for your audit dashboard.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan includes core Input and Output Guard with basic logs. No credit card required.",
  },
  {
    q: "Can I self-host SoterAI?",
    a: "Self-hosted deployment is available on all plans (including Free). Contact sales for Enterprise deployment options and pricing.",
  },
  {
    q: "What happens when I exceed my plan limits?",
    a: "When monthly request limits are reached, new guard requests return a 429 response. Existing integrations and configurations remain intact. Upgrade your plan or wait until the next billing cycle to resume.",
  },
  {
    q: "Is SoterAI a replacement for human security review?",
    a: "No. SoterAI provides automated defense-in-depth to catch common AI threats. It reduces risk but does not replace human security oversight, code review, or incident response processes.",
  },
];

function PlanCard({ plan, index }: { plan: PlanDef; index: number }) {
  const Icon = plan.icon;
  return (
    <article
      className={`card flex flex-col p-5 transition hover:border-cyan/30 ${
        plan.highlight ? "border-cyan/40 ring-1 ring-cyan/40 relative" : ""
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
          Most popular
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className={`rounded-xl p-2.5 ${plan.highlight ? "bg-cyan text-ink" : "bg-cyan/10 text-cyan"}`}>
          <Icon size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <p className="mt-1">
            <span className="text-2xl font-black">{plan.price}</span>
            <span className="text-sm text-slate-400">{plan.period}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-400 leading-relaxed">{plan.copy}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-600">{plan.target}</p>

      <ul className="mt-4 space-y-2 text-sm flex-1">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-2">
            {feature.included ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-lime" />
            ) : (
              <span className="mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-full border border-slate-700" />
            )}
            <span className={feature.included ? "text-slate-300" : "text-slate-600"}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1.5 border-t border-slate-800 pt-4">
        {plan.limits.map((limit) => (
          <p key={limit} className="text-xs text-slate-600">
            · {limit}
          </p>
        ))}
      </div>

      <Link
        href={plan.ctaHref}
        className={`mt-5 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
          plan.highlight
            ? "bg-cyan text-ink hover:bg-cyan/90"
            : "border border-slate-700 text-slate-200 hover:border-cyan/50 hover:text-white"
        }`}
      >
        {plan.cta}
      </Link>
    </article>
  );
}

export default function PricingPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(pricingJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow text-center">Pricing</p>
        <h1 className="mt-2 text-center text-4xl font-bold sm:text-5xl">
          Plans for guarded AI operations
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-center text-lg text-slate-400">
          Server-enforced limits, transparent lifecycle states, and OWASP LLM Top 10 aligned
          defense-in-depth. All plans include self-hosting capability. No plan claims complete protection.
        </p>
      </section>

      {/* ── Plan cards ── */}
      <section className="container-page pb-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} index={index} />
          ))}
        </div>
      </section>

      {/* ── Feature comparison table ── */}
      <section className="container-page py-16">
        <h2 className="text-2xl font-bold">Full feature comparison</h2>
        <p className="mt-2 text-sm text-slate-400">
          Every plan includes self-hosting. Compare what is available across tiers.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="sticky left-0 bg-ink py-3 pr-4 text-left font-medium text-slate-400">
                  Feature
                </th>
                {planShortNames.map((name) => (
                  <th key={name} className="px-3 py-3 text-center font-medium text-slate-400">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {compareRows.map((row, i) => {
                if (row.section) {
                  return (
                    <tr key={i} className="bg-slate-950/60">
                      <td
                        colSpan={6}
                        className="py-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        {row.section}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={i} className="hover:bg-slate-950/30">
                    <td className="sticky left-0 bg-ink py-3 pr-4 text-slate-300">
                      {row.label}
                    </td>
                    {row.values.map((val, j) => (
                      <td key={j} className="px-3 py-3 text-center">
                        {val === "✓" ? (
                          <CheckCircle2
                            size={16}
                            className="mx-auto text-lime"
                          />
                        ) : (
                          <span className="text-slate-600">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          ✓ = Included &nbsp; — = Not included &nbsp;·&nbsp;
          <Link href="/signup" className="text-cyan underline underline-offset-2 hover:text-cyan/80">
            Start with the free tier →
          </Link>
        </p>
      </section>

      {/* ── Billing & enterprise ── */}
      <section className="border-y border-slate-800 py-12">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Billing behaviour</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Trials expire after the configured window. Payment failures enter a limited grace period.
              Plan activation and changes require server-verified Razorpay signatures.
              All prices in INR. GST may apply.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <HelpCircle size={14} />
              Overages do not auto-bill — requests return 429 until the plan is upgraded or the cycle resets.
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Need deployment review?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Enterprise pricing depends on message volume, deployment model, support expectations,
              and integration scope. Self-hosted deployment is available on every plan.
            </p>
            <Link
              href="/enterprise/pilot"
              className="mt-4 inline-flex items-center gap-1 text-cyan hover:underline"
            >
              Request enterprise pilot <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="container-page py-16">
        <h2 className="text-2xl font-semibold">Works with your favourite platforms</h2>
        <p className="mt-3 text-slate-400">
          All integrations work with every plan, including Free. Install SoterAI guard nodes directly inside your workflow tools.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {["n8n", "Dify", "Zapier", "Make.com", "Botpress", "Flowise", "Langflow", "Voiceflow", "REST API", "JavaScript SDK", "Python SDK", "WordPress"].map(
            (p) => (
              <span
                key={p}
                className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-slate-300"
              >
                {p}
              </span>
            ),
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
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

      {/* ── CTA ── */}
      <section className="container-page pb-20">
        <div className="rounded-2xl bg-cyan p-10 text-center text-ink">
          <h2 className="text-3xl font-black">Add observable controls to every AI turn.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-ink/70">
            Start with the Free plan — no credit card required. Upgrade when your usage grows.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-ink px-6 py-3 font-semibold text-white transition hover:bg-ink/90"
            >
              Get started free
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-ink/30 px-6 py-3 font-semibold text-ink transition hover:bg-ink/10"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
