import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";
import { faqPageLd } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Make.com AI Security — Guard AI Scenarios from Prompt Injection",
  description:
    "Protect Make.com AI scenarios from prompt injection, PII leakage, and unsafe AI outputs. SoterAI integrates with Make via the HTTP module to secure every AI step in your automation.",
  path: "/integrations/make",
  keywords: [
    "make.com ai security",
    "make ai scenario security",
    "integromat ai security",
    "make prompt injection",
    "make llm security",
    "secure make ai modules",
    "soterai make integration",
  ],
});

const faqs = [
  {
    q: "Does SoterAI work with Make.com's native AI modules?",
    a: "Yes. Use Make's HTTP module before and after any AI module (OpenAI, Anthropic, Google AI, or custom). The HTTP module calls SoterAI's REST API to inspect inputs and outputs inline.",
  },
  {
    q: "Can I use SoterAI with Make's self-hosted (on-premise) edition?",
    a: "Yes. SoterAI is available as a self-hosted Docker deployment. Both Make on-premise and SoterAI can run within the same network, keeping all data inside your infrastructure.",
  },
  {
    q: "How does SoterAI handle Make error branches?",
    a: "When SoterAI returns action: 'block', you configure Make's error handler or a Router module to branch on that value and stop or reroute the scenario. Make's built-in error handling works naturally with SoterAI's response format.",
  },
  {
    q: "What is the latency impact on Make scenarios?",
    a: "SoterAI adds under 100ms per guard check. Given that AI API calls in Make scenarios typically take 1-15 seconds, the added latency is negligible.",
  },
];

const steps = [
  {
    step: "Create a SoterAI project and get your API key",
    body: "Sign up at soterai.in, create a project, and copy the API key from project settings.",
  },
  {
    step: "Add an HTTP module before your AI module",
    body: "In your Make scenario, add an HTTP > Make a request module before your AI module. Method: POST. URL: https://api.soterai.in/v1/guard/input",
  },
  {
    step: "Set up the request body and authentication",
    body: 'Body type: Raw. Content type: application/json. Body: { "input": "{{triggerInputField}}", "project": "YOUR_PROJECT_ID" }. Add an Authorization header: Bearer YOUR_API_KEY',
  },
  {
    step: "Route on the guard response",
    body: "Add a Router module after the HTTP call. Branch 1: continue if response.action equals allow (pass the redactedInput to your AI module). Branch 2: stop scenario or send alert if action equals block.",
  },
  {
    step: "Add output guard after your AI module",
    body: "After your AI module, add another HTTP module calling /v1/guard/output with the AI response. Route on the output guard result to catch leakage in AI-generated text.",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to add SoterAI AI security to Make.com scenarios",
  "description": "Step-by-step guide to integrate SoterAI Guard with Make.com AI scenarios using the HTTP module.",
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
    { name: "Make.com AI Security", path: "/integrations/make" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqPageLd(faqs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(howToLd) }} />

      <section className="max-w-3xl">
        <p className="eyebrow">Integration · Make.com</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          AI security for Make.com scenarios
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          Make.com connects AI modules to your business data and workflows at scale.
          SoterAI Guard integrates via Make&apos;s HTTP module to inspect every AI input and
          output — blocking prompt injection, detecting PII, and preventing unsafe AI
          responses from reaching downstream apps.
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
        <h2 className="text-2xl font-bold">What SoterAI protects in Make</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Input guard", body: "Block prompt injection and jailbreak attempts before data reaches your OpenAI, Anthropic, or custom AI module inside Make." },
            { title: "PII and secret detection", body: "Surface sensitive identifiers — Aadhaar, PAN, GSTIN, API keys, email addresses — before they enter the AI model context." },
            { title: "Output guard", body: "Scan AI-generated text for leaked sensitive data, unsafe content, or signs the model was manipulated before results flow to downstream modules." },
            { title: "Scenario audit trail", body: "Log every guard decision with scenario metadata, threat type, and action for compliance reporting and incident investigation." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-panel/40 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan" aria-hidden="true" />
                <h3 className="font-semibold text-slate-100">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">How to integrate SoterAI with Make.com</h2>
        <ol className="mt-6 space-y-6">
          {steps.map((s, i) => (
            <li key={s.step} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cyan/10 text-sm font-bold text-cyan">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{s.step}</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Limitations</h2>
        <ul className="mt-5 space-y-3">
          {[
            "SoterAI only inspects data routed through the HTTP module guard steps. Make modules bypassing the guard are not covered.",
            "The HTTP module approach requires a Make plan that supports HTTP requests. Check Make's plan restrictions.",
            "Detection is heuristic and reduces risk significantly but cannot guarantee detection of every novel attack pattern.",
          ].map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-200">
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
              <p className="mt-2 text-sm leading-6 text-slate-200">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-wrap gap-3">
        {[
          ["AI Workflow Security", "/ai-workflow-security"],
          ["n8n Integration", "/integrations/n8n"],
          ["Zapier Integration", "/integrations/zapier"],
          ["AI Agent Security", "/ai-agent-security"],
          ["Limitations", "/limitations"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Secure your Make AI scenarios</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-200">
          Add two HTTP modules to any Make scenario and every AI step is guarded. Free tier available.
        </p>
        <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90">
          Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
