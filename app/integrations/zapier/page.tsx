import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";
import { faqPageLd } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Zapier AI Security — Protect Zapier AI Actions from Prompt Injection",
  description:
    "Add prompt injection protection and PII redaction to Zapier AI actions. SoterAI Guard integrates with Zapier via webhooks to scan every AI step before and after execution.",
  path: "/integrations/zapier",
  keywords: [
    "zapier ai security",
    "zapier prompt injection",
    "zapier llm security",
    "zapier ai automation security",
    "secure zapier ai actions",
    "zapier data leakage prevention",
    "soterai zapier integration",
  ],
});

const faqs = [
  {
    q: "How does SoterAI integrate with Zapier?",
    a: "SoterAI integrates with Zapier via the Webhooks by Zapier action (available on paid plans). Add a POST webhook step before your AI action to scan inputs, and another after to inspect AI output before passing it downstream.",
  },
  {
    q: "Can SoterAI stop a Zapier workflow if it detects an attack?",
    a: "Yes. When SoterAI returns action: 'block', use a Zapier Filter step to halt the workflow. In Monitor mode, the workflow continues but the event is logged for review.",
  },
  {
    q: "Does SoterAI detect India-specific PII in Zapier workflows?",
    a: "Yes. SoterAI detects Aadhaar-pattern numbers, PAN, GSTIN, UPI IDs, IFSC codes, and Indian mobile numbers in addition to global PII types like email addresses and credit card numbers.",
  },
  {
    q: "Is there a Zapier native app for SoterAI?",
    a: "Not yet. Integration is via the Webhooks by Zapier action today. A native Zapier app is on the roadmap — contact us to be notified when it launches.",
  },
];

const steps = [
  {
    step: "Get your SoterAI API key",
    body: "Sign up at soterai.in, create a project, and copy your API key from the project settings.",
  },
  {
    step: "Add a Webhooks step before your AI action",
    body: "In your Zapier workflow, add a Webhooks by Zapier > POST action before your AI step. URL: https://api.soterai.in/v1/guard/input",
  },
  {
    step: "Configure the webhook payload",
    body: 'Set Payload Type to JSON. Data: { "input": "<map the user input field>", "project": "YOUR_PROJECT_ID" }. Header: Authorization: Bearer YOUR_API_KEY',
  },
  {
    step: "Add a Filter to halt blocked requests",
    body: "Add a Filter by Zapier step after the webhook. Condition: the webhook response field action Exactly matches allow. This stops the workflow when SoterAI detects a threat.",
  },
  {
    step: "Guard the AI output",
    body: "After your AI action, add another Webhooks POST to /v1/guard/output with the AI response body. Use a second Filter to halt if the output guard returns block.",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to add SoterAI AI security to Zapier workflows",
  "description": "Step-by-step guide to integrate SoterAI Guard with Zapier AI actions using the Webhooks by Zapier action.",
  "step": steps.map((s, i) => ({
    "@type": "HowToStep",
    "position": i + 1,
    "name": s.step,
    "text": s.body,
  })),
};

export default function Page() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Integrations", path: "/integrations" },
    { name: "Zapier AI Security", path: "/integrations/zapier" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqPageLd(faqs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(howToLd) }} />

      <section className="max-w-3xl">
        <p className="eyebrow">Integration · Zapier</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          AI security for Zapier workflows
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Zapier&apos;s AI actions automate tasks across thousands of apps — but prompt injection,
          PII leakage, and unsafe AI outputs can propagate silently through every downstream step.
          SoterAI Guard adds a real-time security layer to your Zapier AI automations.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/signup" className="button-primary gap-2">
            Get your API key <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/docs/rest-api" className="button-secondary">
            REST API docs
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">What SoterAI protects in Zapier</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Input guard", body: "Scan data entering your Zapier AI action for prompt injection, jailbreak attempts, and hidden instruction overrides before the AI model sees it." },
            { title: "PII detection", body: "Detect and surface Aadhaar patterns, PAN, GSTIN, credit card numbers, emails, and other sensitive identifiers flowing through workflow steps." },
            { title: "Output guard", body: "Inspect AI-generated responses for leaked instructions, unsafe content, or sensitive data before it reaches downstream Zapier actions." },
            { title: "Audit logging", body: "Every guard decision is logged with timestamp, threat type, and confidence score — available via the SoterAI dashboard and SIEM export." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-panel/40 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan" aria-hidden="true" />
                <h3 className="font-semibold text-slate-100">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">How to integrate SoterAI with Zapier</h2>
        <ol className="mt-6 space-y-6">
          {steps.map((s, i) => (
            <li key={s.step} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cyan/10 text-sm font-bold text-cyan">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{s.step}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Limitations</h2>
        <ul className="mt-5 space-y-3">
          {[
            "Integration requires Webhooks by Zapier, available on Zapier paid plans.",
            "SoterAI inspects data routed through the webhook steps. Zapier steps that bypass the guard are not covered.",
            "Detection is heuristic. Novel or heavily obfuscated injection attempts may not be flagged.",
          ].map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-6 space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-wrap gap-3">
        {[
          ["AI Workflow Security", "/ai-workflow-security"],
          ["n8n Integration", "/integrations/n8n"],
          ["Make.com Integration", "/integrations/make"],
          ["AI Agent Security", "/ai-agent-security"],
          ["Limitations", "/limitations"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Secure your Zapier AI automations</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Create a free SoterAI project, add two webhook steps to your Zap, and every AI action is protected.
        </p>
        <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90">
          Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
