import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";
import { faqPageLd } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = buildMetadata({
  title: "n8n AI Security — Add Prompt Injection Protection to n8n Workflows",
  description:
    "Protect n8n AI workflows from prompt injection, data leakage, and jailbreak attacks. SoterAI integrates with n8n via HTTP Request node to guard every AI step in your automation.",
  path: "/integrations/n8n",
  keywords: [
    "n8n ai security",
    "n8n prompt injection",
    "n8n llm security",
    "n8n ai workflow security",
    "n8n soterai integration",
    "secure n8n ai nodes",
    "n8n data leakage prevention",
  ],
});

const faqs = [
  {
    q: "Does SoterAI work with n8n self-hosted deployments?",
    a: "Yes. SoterAI Guard is available as a self-hosted Docker deployment. Both SoterAI and n8n can run on the same infrastructure, keeping all data within your network boundary.",
  },
  {
    q: "Which n8n node types does SoterAI integrate with?",
    a: "SoterAI integrates via the n8n HTTP Request node. This means it works before or after any AI node — OpenAI, Anthropic, Ollama, or custom LLM nodes — as well as with n8n's AI Agent node.",
  },
  {
    q: "Will SoterAI slow down my n8n workflows?",
    a: "SoterAI adds under 100ms per guard check. For most n8n workflows this is negligible compared to the LLM API call itself (typically 1-10 seconds).",
  },
  {
    q: "Can SoterAI block a workflow step if it detects an attack?",
    a: "Yes. In Strict mode, SoterAI returns a 403 response that n8n can handle via its error branch to stop the workflow. In Monitor mode, it logs the threat and continues so you can review patterns without blocking production workflows.",
  },
];

const steps = [
  {
    step: "Create a SoterAI project",
    body: "Sign up at soterai.in and create a project. Copy your project's API key — you will need it in the n8n credential.",
  },
  {
    step: "Add an HTTP Request node before your AI node",
    body: "In your n8n workflow, add an HTTP Request node before your OpenAI or LLM node. Set the method to POST and the URL to https://api.soterai.in/v1/guard/input.",
  },
  {
    step: "Configure the request body",
    body: 'Set Content-Type to application/json. Body: { "input": "{{ $json.chatInput }}", "project": "YOUR_PROJECT_ID" }. Add your API key as a Bearer token in the Authorization header.',
  },
  {
    step: "Handle the guard response",
    body: "SoterAI returns { action: 'allow' | 'block' | 'redact', redactedInput, threats }. Use an IF node to check action == 'block' and stop the workflow, or pass redactedInput to your LLM node.",
  },
  {
    step: "Add an output guard after your LLM node",
    body: "Repeat the HTTP Request pattern after your LLM node, calling /v1/guard/output with the model response. This catches leaked PII or unsafe content in the AI output before it reaches users.",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to add SoterAI prompt injection protection to n8n",
  "description": "Step-by-step guide to integrate SoterAI Guard with n8n workflows using the HTTP Request node.",
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
    { name: "n8n AI Security", path: "/integrations/n8n" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqPageLd(faqs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(howToLd) }} />

      <section className="max-w-3xl">
        <p className="eyebrow">Integration · n8n</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          AI security for n8n workflows
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          n8n&apos;s AI nodes can call any LLM — but untrusted inputs, injected instructions,
          and leaked PII travel through automation steps just as easily as legitimate data.
          SoterAI Guard integrates directly with n8n via the HTTP Request node to inspect
          every AI step in real time.
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
        <h2 className="text-2xl font-bold">What SoterAI protects in n8n</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Prompt injection detection", body: "Block instruction-override attempts before they reach your LLM node — including indirect injection from external data sources fetched by n8n." },
            { title: "PII and secret redaction", body: "Detect and redact Aadhaar, PAN, GSTIN, API keys, and other sensitive data flowing through workflow nodes before they enter the AI model." },
            { title: "Output inspection", body: "Scan LLM responses for leaked data, unsafe content, or signs the model was steered off task before passing results to downstream nodes." },
            { title: "Workflow audit trail", body: "Every guard decision is logged with request metadata, threat type, and action taken — exportable for compliance and SIEM integration." },
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
        <h2 className="text-2xl font-bold">How to integrate SoterAI with n8n</h2>
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

        <div className="mt-8 rounded-lg border border-slate-800 bg-slate-950/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example guard response</p>
          <pre className="mt-3 overflow-x-auto text-xs leading-6 text-cyan">
{`{
  "action": "block",
  "threats": [{ "type": "prompt_injection", "confidence": 0.96 }],
  "redactedInput": "[BLOCKED — prompt injection detected]",
  "latencyMs": 12
}`}
          </pre>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Limitations</h2>
        <ul className="mt-5 space-y-3">
          {[
            "SoterAI inspects the data explicitly passed through the HTTP Request node. Workflow branches that bypass the guard are out of scope.",
            "Detection is heuristic. It reduces risk and catches known attack patterns, but novel injection techniques may not be flagged.",
            "Adding a guard node increases workflow execution time by under 100ms per step under normal conditions.",
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
          ["AI Agent Security", "/ai-agent-security"],
          ["Zapier Integration", "/integrations/zapier"],
          ["Make.com Integration", "/integrations/make"],
          ["REST API Reference", "/docs/rest-api"],
          ["Limitations", "/limitations"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Secure your n8n AI workflows today</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Create a free SoterAI project, get your API key, and add a guard node to your n8n workflow in under 10 minutes.
        </p>
        <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90">
          Get started free <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
