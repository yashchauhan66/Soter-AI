import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldCheck, Download, KeyRound, Workflow } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";
import { faqPageLd } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/seo/jsonLd";

const NODE_NPM_URL = "https://www.npmjs.com/package/n8n-nodes-soterai";

export const metadata: Metadata = buildMetadata({
  title: "n8n AI Security — Install the SoterAI Community Node",
  description:
    "Install the SoterAI community node (n8n-nodes-soterai) directly from the n8n marketplace. Add prompt injection, jailbreak, PII, and data leakage protection to any n8n AI workflow in minutes.",
  path: "/integrations/n8n",
  keywords: [
    "n8n ai security",
    "n8n prompt injection",
    "n8n llm security",
    "n8n ai workflow security",
    "n8n soterai integration",
    "secure n8n ai nodes",
    "n8n data leakage prevention",
    "n8n-nodes-soterai",
  ],
});

const installSteps = [
  {
    step: "Open n8n and go to Settings → Community Nodes",
    body: "The SoterAI node is published in the n8n community node registry — no separate package install is needed.",
  },
  {
    step: "Install n8n-nodes-soterai",
    body: "Click Install a Community Node and enter n8n-nodes-soterai, or find SoterAI in the community node list.",
  },
  {
    step: "Restart n8n if prompted",
    body: "Some n8n instances require a restart after installing a community node. After it reloads, SoterAI appears in the node panel.",
  },
  {
    step: "Search for SoterAI in the node panel",
    body: "Drag the SoterAI node into any workflow. It works before or after any AI node — OpenAI, Anthropic, Ollama, or the n8n AI Agent node.",
  },
];

const setupSteps = [
  {
    step: "Create a SoterAI project and API key",
    body: "Sign up at soterai.in, create a project, and generate an API key. The key starts with sk_.",
  },
  {
    step: "Add a SoterAI API credential in n8n",
    body: "In the SoterAI node, create a new SoterAI API credential and paste your API key. n8n stores it in its encrypted credential store — it never lives in workflow JSON.",
  },
  {
    step: "Keep the default Base URL",
    body: "https://soterai.in is pre-filled. Change it only when you run a self-hosted SoterAI API. Optionally set a default Project ID; each node can override it.",
  },
  {
    step: "Run a safe test",
    body: "Test with fake values first (e.g. sk-test-1234567890abcdef). Never paste real production secrets into test workflows.",
  },
];

const operationRows = [
  ["Universal AI Firewall (Best Protection)", "Recommended one-node protection. Checks prompt injection, jailbreaks, PII/secrets, RAG context, tool calls, memory operations, AI output, and semantic data egress in a single node."],
  ["Guard Input", "Check inbound prompts before an AI app receives them. Supports Block, Redact, Warn, or Continue."],
  ["Guard Output", "Check AI-generated output before sending, saving, or responding with it. Supports Block, Redact, Warn, or Continue."],
  ["Redact Secrets or PII", "Detect and redact sensitive strings such as emails, phone numbers, API keys, and secrets."],
  ["Get RAG Risk Summary", "Scan a document or chunk and return trustScore, trustLevel, findings, and a recommended action."],
  ["Audit n8n Workflow Security", "Score an exported n8n workflow for AI Agent, tool, webhook, Code node, memory, RAG, credential, and output-egress risks."],
  ["Analyze Text", "Analyze a text field and return allowed, riskScore, categories, reason, and safe text without blocking."],
];

const faqs = [
  {
    q: "Do I need to install a package to use the SoterAI node?",
    a: "No. The node is published in the n8n community node registry, so you install it directly from n8n (Settings → Community Nodes) without touching the command line.",
  },
  {
    q: "Where is the SoterAI node available?",
    a: "n8n-nodes-soterai is published on the n8n community node registry and npm. The direct node page is https://www.npmjs.com/package/n8n-nodes-soterai.",
  },
  {
    q: "Which n8n node types does SoterAI work with?",
    a: "SoterAI is a standalone community node with Safe and Flagged outputs. It works before or after any AI node — OpenAI, Anthropic, Ollama, or custom LLM nodes — as well as with n8n's AI Agent node.",
  },
  {
    q: "Will SoterAI slow down my n8n workflows?",
    a: "SoterAI adds under 100ms per guard check. For most n8n workflows this is negligible compared to the LLM API call itself (typically 1-10 seconds).",
  },
  {
    q: "Does SoterAI work with n8n self-hosted deployments?",
    a: "Yes. The node also supports a custom Base URL, so both SoterAI and n8n can run on the same self-hosted infrastructure, keeping all data within your network boundary.",
  },
  {
    q: "What happens when the node detects an attack?",
    a: "The node routes items itself. Safe items go to the Safe output and stopped items go to the Flagged output — no IF node needed. In Monitor-style settings it logs and continues so you can review patterns without blocking production workflows.",
  },
];

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to install and use the SoterAI community node in n8n",
  "description": "Install the SoterAI node from the n8n community node registry and add prompt injection and data leakage protection to any n8n AI workflow.",
  "step": installSteps.map((s, i) => ({
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
          SoterAI community node for n8n
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          Install <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-cyan">n8n-nodes-soterai</code>{" "}
          directly from the n8n marketplace and drag a SoterAI guard node before and after every AI step.
          It detects prompt injection, jailbreaks, secrets, PII, unsafe tool calls, risky memory writes,
          RAG poisoning, and data leakage — no command line or package install required.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={NODE_NPM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary gap-2"
          >
            <Download size={16} aria-hidden="true" /> View the node
          </Link>
          <Link href="/signup" className="button-secondary">
            Get your API key <ArrowRight size={16} aria-hidden="true" />
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
            { title: "Workflow security audit", body: "Score an exported n8n workflow for AI Agent, tool, webhook, Code node, memory, and output-egress risks before you deploy it." },
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
        <h2 className="text-2xl font-bold">Install the node from n8n</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          The node is published in the n8n community node registry, so it installs in four steps — no npm needed.
        </p>
        <ol className="mt-6 space-y-6">
          {installSteps.map((s, i) => (
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
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Direct node link</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <Link href={NODE_NPM_URL} target="_blank" rel="noopener noreferrer" className="text-cyan transition hover:underline">
              {NODE_NPM_URL}
            </Link>
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Set up credentials</h2>
        <ol className="mt-6 space-y-6">
          {setupSteps.map((s, i) => (
            <li key={s.step} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-500/10 text-sm font-bold text-violet-300">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{s.step}</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <KeyRound className="mt-0.5 h-4 w-4 flex-none text-amber-400" aria-hidden="true" />
          <p className="text-sm leading-6 text-slate-200">
            API keys are handled through n8n credentials and are never stored in workflow JSON. Use fake test values
            such as <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan">sk-test-1234567890abcdef</code>{" "}
            in demos and screenshots.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Use the node in a workflow</h2>
        <h3 className="mt-6 text-lg font-semibold text-slate-100">Supported operations</h3>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-300">
                <th className="px-4 py-3">Operation</th>
                <th className="px-4 py-3">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {operationRows.map(([name, purpose]) => (
                <tr key={name} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-100">{name}</td>
                  <td className="px-4 py-3 leading-6 text-slate-200">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">Recommended: one-node AI protection</h3>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          Choose <span className="text-slate-100">Universal AI Firewall (Best Protection)</span> for the simplest and
          strongest workflow pattern:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-5 text-xs leading-6 text-cyan">
{`User/Webhook Input
  → SoterAI Universal AI Firewall (Input Text = user message)
  → LLM
  → SoterAI Universal AI Firewall (AI Output Text = model response)
  → Respond / Tool / Memory`}
        </pre>
        <p className="mt-4 text-sm leading-6 text-slate-200">
          Fill <span className="text-slate-100">Input Text</span> with the incoming message, add{" "}
          <span className="text-slate-100">AI Output Text (Optional)</span> to scan the model response, and keep{" "}
          <span className="text-slate-100">Maximum Protection</span> with{" "}
          <span className="text-slate-100">On Threat = Block</span> for production flows. Optional layers for RAG
          context, tool calls, memory operations, and output destinations live under{" "}
          <span className="text-slate-100">Security Context</span>.
        </p>

        <h3 className="mt-10 text-lg font-semibold text-slate-100">Safe and Flagged outputs</h3>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          Every SoterAI node has two outputs and routes items itself — you do not need an IF node to act on a verdict.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-5 text-xs leading-6 text-cyan">
{`                    ┌─ Safe ────► rest of your workflow
Webhook ──► SoterAI ─┤
                    └─ Flagged ─► respond "blocked", log, or leave unconnected`}
        </pre>
        <ul className="mt-4 space-y-3">
          {[
            "Safe: everything the node let through. Use {{ $json.outputText }} downstream — it holds the cleaned or redacted value.",
            "Flagged: items the node stopped. Leave it unconnected to drop them, or wire it to a response or logging branch.",
            "Setting On Threat to Redact, Warn, or Continue keeps those items on Safe with their cleaned text. Only genuinely stopped items go to Flagged.",
          ].map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-cyan-500" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Example workflows</h2>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          The node ships with importable example workflows. Import any file from{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-cyan">examples/</code> in the package.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { name: "Basic analyze", body: "Manual Trigger → SoterAI Analyze Text → IF High Risk." },
            { name: "Guard input webhook", body: "Webhook → SoterAI Guard Input → IF Risk High → Respond to Webhook." },
            { name: "Guard output", body: "Manual Trigger → AI Output Text → SoterAI Guard Output → Save Safe Output." },
            { name: "Secret / PII redaction", body: "Manual Trigger → SoterAI Redact Secrets or PII → IF Secrets Found → Safe Output." },
            { name: "Universal AI firewall", body: "Webhook → SoterAI Universal AI Firewall → blocked / allowed response branches." },
            { name: "Workflow security audit", body: "Manual Trigger → SoterAI Audit n8n Workflow Security → posture report." },
          ].map((w) => (
            <div key={w.name} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-panel/40 p-5">
              <Workflow className="mt-0.5 h-4 w-4 flex-none text-cyan" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-semibold text-slate-100">{w.name}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-200">{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">Limitations</h2>
        <ul className="mt-5 space-y-3">
          {[
            "SoterAI inspects the data explicitly passed through the guard node. Workflow branches that bypass the guard are out of scope.",
            "Detection is heuristic. It reduces risk and catches known attack patterns, but novel injection techniques may not be flagged.",
            "Adding a guard node increases workflow execution time by under 100ms per step under normal conditions.",
            "Live workflow execution requires a reachable SoterAI API and a valid API key.",
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
          ["AI Agent Security", "/ai-agent-security"],
          ["Integrations", "/integrations"],
          ["Zapier Integration", "/integrations/zapier"],
          ["Make.com Integration", "/integrations/make"],
          ["Limitations", "/limitations"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {label}
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Secure your n8n AI workflows today</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-200">
          Install the node from n8n Settings → Community Nodes, create a free SoterAI project, and guard your first
          workflow in under 10 minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            href={NODE_NPM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            View the node <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg border border-cyan/40 px-6 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/10">
            Get started free
          </Link>
        </div>
      </section>
    </main>
  );
}
