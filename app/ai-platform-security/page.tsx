import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, faqPageLd, softwareApplicationLd } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";
import {
  EXTENSION_ID,
  OPEN_VSX_URL,
  VSCODE_MARKETPLACE_URL,
} from "@/app/extensions/ide/extensionData";

const N8N_NPM_URL = "https://www.npmjs.com/package/n8n-nodes-soterai";
const JS_SDK_URL = "https://www.npmjs.com/package/@soterai/core";

export const metadata: Metadata = buildMetadata({
  title: "AI Security for VS Code, IDEs, Browsers and n8n",
  description:
    "One local security layer for VS Code, Cursor, Windsurf, Chrome, Edge, and n8n: stop secret leaks, prompt injection, and risky MCP tools before AI uses them.",
  path: "/ai-platform-security",
  keywords: [
    "ai security platforms",
    "ide security extension",
    "vscode cursor windsurf security",
    "browser ai security extension",
    "n8n ai security",
    "windsurf security risks",
    "is windsurf safe",
    "secure windsurf ai usage",
  ],
});

interface PlatformCard {
  name: string;
  scope: string;
  protect: string;
  status: string;
  installLabel: string;
  installUrl: string;
  external: boolean;
  command?: string;
  docHref?: string;
  docLabel?: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    name: "VS Code",
    scope: "Microsoft's extensible code editor",
    protect:
      "Scans open files, selections, and workspace context for secrets, PII, prompt injection, risky MCP tools, and dangerous terminal commands before AI reads them.",
    status: "Runtime verified",
    installLabel: "Install from VS Marketplace",
    installUrl: VSCODE_MARKETPLACE_URL,
    external: true,
    command: `code --install-extension ${EXTENSION_ID}`,
    docHref: "/vscode-ai-security",
    docLabel: "VS Code security guide",
  },
  {
    name: "Cursor",
    scope: "AI-native development environment",
    protect:
      "Guards context before Claude or GPT inside Cursor sees it — including the MCP configs Cursor uses for agent tools.",
    status: "Runtime verified",
    installLabel: "Install from Open VSX",
    installUrl: OPEN_VSX_URL,
    external: true,
    command: `cursor --install-extension ${EXTENSION_ID}`,
    docHref: "/cursor-ai-security",
    docLabel: "Cursor security guide",
  },
  {
    name: "Windsurf",
    scope: "Agentic IDE (now Devin)",
    protect:
      "Scan Before AI Prompt reviews context before Cascade runs; MCP config scanning flags over-permissioned agent tools; the terminal guard reviews risky commands.",
    status: "Runtime verified",
    installLabel: "Install from Open VSX",
    installUrl: OPEN_VSX_URL,
    external: true,
    command: `windsurf --install-extension ${EXTENSION_ID}`,
  },
  {
    name: "Kiro, Antigravity & VSCodium",
    scope: "VS Code-compatible editors",
    protect:
      "The same local scanner runs in any editor built on the VS Code extension platform, with per-editor install commands and Open VSX distribution.",
    status: "Published on Open VSX",
    installLabel: "Install from Open VSX",
    installUrl: OPEN_VSX_URL,
    external: true,
    command: `kiro / antigravity / codium --install-extension ${EXTENSION_ID}`,
    docHref: "/extensions/ide",
    docLabel: "All editor install options",
  },
  {
    name: "Chrome & Edge browsers",
    scope: "20+ AI tools: ChatGPT, Claude, Gemini, Copilot",
    protect:
      "Browser Guard scans prompts in real time, redacts secrets and India PII in place, enforces organization policy offline, and surfaces shadow-AI usage.",
    status: "Manual install today",
    installLabel: "Chrome install guide",
    installUrl: "/extensions/browser/chrome",
    external: false,
    docHref: "/extensions/browser",
    docLabel: "Browser Guard overview",
  },
  {
    name: "n8n, Make & Zapier",
    scope: "AI workflow automation",
    protect:
      "Guard nodes sit before and after every AI step: input checks, output checks, redaction, RAG document risk, and whole-workflow security audits.",
    status: "Published",
    installLabel: "Install the n8n community node",
    installUrl: N8N_NPM_URL,
    external: true,
    docHref: "/integrations/n8n",
    docLabel: "n8n integration guide",
  },
  {
    name: "Any stack via API & SDKs",
    scope: "JavaScript/TypeScript, Python, REST",
    protect:
      "Input guard, output guard, RAG document scanning, and grounding checks behind one API call, with self-hosting for teams that need hard data boundaries.",
    status: "Stable API",
    installLabel: "JS SDK on npm",
    installUrl: JS_SDK_URL,
    external: true,
    docHref: "/docs/rest-api",
    docLabel: "REST API docs",
  },
];
const USEFUL = [
  {
    title: "Stops secrets before they are sent",
    body: "API keys, tokens, database URLs, and credentials are detected in the editor or browser and redacted before the prompt leaves your machine.",
  },
  {
    title: "Blocks prompt injection at the source",
    body: "Instruction-override text hidden in files, repositories, tool output, and web content is flagged before it can steer a model.",
  },
  {
    title: "Reviews MCP tool permissions",
    body: "MCP servers are inventoried with their requested capabilities so over-broad filesystem, shell, or network access is caught before enablement.",
  },
  {
    title: "Keeps an audit trail",
    body: "The AI Memory Inspector records what context was shared per session, so exposure can be reviewed and credentials rotated quickly.",
  },
  {
    title: "Fast enough for real work",
    body: "Local analyzer checks complete in under 50ms at p95 on CPU, so scanning happens inline instead of becoming a separate review step.",
  },
  {
    title: "Free where developers live",
    body: "The IDE extension and its local scanning are free to install and work without an account; team policy sync is an optional cloud feature.",
  },
];

const GAPS = [
  {
    title: "IDE-side guard, not just API-side",
    body: "Most AI-security vendors offer only a server-side API. SoterAI inspects context inside the editor and browser, where the leak or injection actually starts.",
  },
  {
    title: "MCP review inside the workflow",
    body: "Agent tool ecosystems are growing faster than their controls. SoterAI reviews MCP permissions where tools are adopted — the workspace — not after an incident.",
  },
  {
    title: "Employee browser guard with India PII",
    body: "Detection covers Aadhaar-like numbers, PAN, GSTIN, UPI IDs, IFSC codes, and Hinglish phrasing — the least-covered capability among general-purpose vendors.",
  },
  {
    title: "Offline and air-gapped operation",
    body: "Scanning runs locally on CPU with no network call, so it works in restricted enterprise and government environments where cloud guardrails cannot.",
  },
  {
    title: "Inline enforcement, not post-hoc measurement",
    body: "Observability platforms score interactions after the fact; SoterAI blocks, redacts, or requests approval before data crosses the boundary.",
  },
  {
    title: "Self-hosting with one policy engine",
    body: "Teams can run the full stack on their own infrastructure and keep IDE, browser, workflow, and API enforcement under one policy and audit trail.",
  },
];

const WINDSURF_RISKS = [
  {
    title: "Secrets included in Cascade context",
    body: "Open files, terminal output, and nearby project files can contain credentials that silently enter AI prompts. Scan and redact before running Cascade.",
  },
  {
    title: "Indirect prompt injection",
    body: "Instructions hidden in repository files, documentation, or tool output can steer the agent away from the developer's intended task.",
  },
  {
    title: "Over-permissioned MCP tools",
    body: "An MCP server with broad filesystem, shell, or network access exposes more than the task requires. Review permissions before enabling agent tools.",
  },
  {
    title: "Risky terminal commands",
    body: "Agent-suggested commands can delete files, upload data, or expose environment variables. High-impact commands should be reviewed before execution.",
  },
];

const LIMITS = [
  "The IDE extension uses the VS Code extension API and cannot intercept internal AI calls that bypass the extension host entirely.",
  "Browser store listings are not live yet; installs use the documented manual route until publishing completes.",
  "Detection is heuristic. It reduces risk meaningfully but cannot guarantee coverage of every sensitive format or novel injection.",
  "MCP scanning covers configurations visible in the workspace and their declared permissions; runtime behavior still needs isolation and review.",
];

const FAQS = [
  {
    q: "Is Windsurf safe to use?",
    a: "Windsurf can be used with appropriate controls, but no agentic IDE is risk-free. Safety depends on what code and credentials it can read, which MCP tools it can call, provider data settings, and whether commands are reviewed. Keep secrets out of context, restrict tool permissions, and scan sensitive content before sharing it.",
  },
  {
    q: "What are the main Windsurf security risks?",
    a: "The main risks are accidental secret or PII exposure through project context, indirect prompt injection hidden in files or tool output, over-permissioned MCP servers, and destructive or exfiltration-prone terminal commands.",
  },
  {
    q: "Which IDEs does SoterAI IDE Guard support?",
    a: "VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium. The extension is runtime-verified on the first four and published on Open VSX for the rest, with per-editor install commands.",
  },
  {
    q: "Is the browser extension on the Chrome Web Store?",
    a: "Not yet. Until the store listings are live, Chrome and Edge installs use a documented manual route on the Browser Guard pages that takes about a minute and delivers the same build.",
  },
  {
    q: "Does the n8n node need a separate package install?",
    a: "No. n8n-nodes-soterai is published in the n8n community node registry and on npm, so you install it from n8n Settings → Community Nodes without the command line.",
  },
  {
    q: "Do all platforms share one policy?",
    a: "Yes. The IDE extension, browser guard, workflow nodes, and API enforce the same policy engine, so an organization sets rules once and gets one audit trail across surfaces.",
  },
];
export default function Page() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "AI Platform Security", path: "/ai-platform-security" },
  ]);
  const appLd = softwareApplicationLd({
    name: "SoterAI IDE Guard",
    description:
      "Local AI security for VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium: secret and PII redaction, prompt-injection detection, MCP review, and terminal command guard.",
    path: "/ai-platform-security",
  });

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={appLd} />
      <JsonLd data={faqPageLd(FAQS)} />

      {/* Hero */}
      <section className="max-w-3xl">
        <p className="eyebrow">Platform coverage</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          One security layer for every AI platform your team uses
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          SoterAI secures the places AI actually enters your company: VS Code and its derivative IDEs
          (Cursor, Windsurf, Kiro, Antigravity, VSCodium), the browsers employees use for ChatGPT and
          Gemini, workflow automations in n8n, Make, and Zapier, and any application through one API.
          Scanning runs locally, secrets and India PII are redacted before data leaves the machine, and
          every surface shares one policy engine and audit trail.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={VSCODE_MARKETPLACE_URL} target="_blank" rel="noopener noreferrer" className="button-primary">
            Install the IDE extension <ArrowRight size={16} aria-hidden="true" />
          </a>
          <Link href="/playground" className="button-secondary">
            Try the playground first
          </Link>
        </div>
      </section>

      {/* Platforms secured + real install links */}
      <section className="mt-16">
        <h2 className="heading-2">Platforms SoterAI secures — with real install links</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Every link below goes to the live listing or the documented install route. IDE builds are
          runtime-verified per editor; the browser extension ships with a manual install guide until its
          store listings are live.
        </p>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="flex flex-col rounded-panel border border-slate-800 bg-slate-950/40 p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-100">{p.name}</h3>
                <span className="badge-neutral flex-none">{p.status}</span>
              </div>
              <p className="mt-1 text-xs font-medium uppercase tracking-micro text-slate-400">{p.scope}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{p.protect}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.external ? (
                  <a href={p.installUrl} target="_blank" rel="noopener noreferrer" className="button-primary gap-2 text-sm">
                    {p.installLabel} <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <Link href={p.installUrl} className="button-primary gap-2 text-sm">
                    {p.installLabel} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
                {p.docHref ? (
                  <Link href={p.docHref} className="button-secondary text-sm">
                    {p.docLabel}
                  </Link>
                ) : null}
              </div>
              {p.command ? (
                <p className="mt-3 break-all rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[12px] text-cyan">
                  {p.command}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Why it is useful */}
      <section className="mt-16">
        <h2 className="heading-2">What the layer actually does for a team</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USEFUL.map((u) => (
            <div key={u.title} className="rounded-panel border border-slate-800 bg-slate-950/40 p-5">
              <ShieldCheck className="text-cyan" size={20} aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-slate-100">{u.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Market gaps */}
      <section className="mt-16">
        <h2 className="heading-2">Market gaps this fills</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          These are the coverage holes we hear about most from security reviews — and the honest reasons
          SoterAI exists, stated the way we would want a vendor to state them to us.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {GAPS.map((g) => (
            <div key={g.title} className="rounded-panel border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-slate-100">{g.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Windsurf-specific risks (retained depth for Windsurf queries) */}
      <section className="mt-16">
        <h2 className="heading-2">Windsurf security risks to review</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Windsurf can be used safely for many tasks, but its Cascade agent reads project context deeply
          and supports MCP tools. Secure windsurf AI usage by reviewing these boundaries before giving the
          agent access to a sensitive repository, and keep an access ledger so exposure can be audited.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {WINDSURF_RISKS.map((r) => (
            <div key={r.title} className="rounded-panel border border-slate-800 bg-slate-950/40 p-5">
              <h3 className="font-semibold text-slate-100">{r.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{r.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">
          Using Windsurf with production credentials today? Install the extension from Open VSX with{" "}
          <code className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[13px] text-cyan">
            windsurf --install-extension {EXTENSION_ID}
          </code>
          , run Scan Before AI Prompt, and rotate anything that may already have been shared.
        </p>
      </section>

      {/* Honest limitations */}
      <section className="mt-16">
        <h2 className="heading-3">Honest limitations</h2>
        <ul className="mt-5 max-w-3xl space-y-3">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="heading-3">Frequently asked questions</h2>
        <div className="mt-6 max-w-3xl space-y-6">
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related guides */}
      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-micro text-slate-200">Related guides</h2>
        <nav aria-label="Related pages" className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "VS Code AI Security", href: "/vscode-ai-security" },
            { label: "Cursor AI Security", href: "/cursor-ai-security" },
            { label: "IDE Guard installs", href: "/extensions/ide" },
            { label: "Browser Guard", href: "/extensions/browser" },
            { label: "n8n integration", href: "/integrations/n8n" },
            { label: "MCP Security", href: "/mcp-security" },
            { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
            { label: "Known limitations", href: "/limitations" },
          ].map((r) => (
            <Link key={r.href} href={r.href} className="badge-neutral transition-colors hover:border-cyan/50 hover:text-cyan">
              <CheckCircle2 size={13} aria-hidden="true" /> {r.label}
            </Link>
          ))}
        </nav>
      </section>

      {/* Final CTA */}
      <section className="mt-16 rounded-panel border border-cyan/20 bg-cyan/[0.06] p-8 text-center">
        <h2 className="heading-3">Secure every AI surface with one install</h2>
        <p className="mx-auto mt-3 max-w-measure text-sm leading-6 text-slate-300">
          Free for developers. Scan secrets, prompts, MCP tools, and terminal commands locally before they
          ever reach an AI model — in the editor, the browser, and your workflows.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={VSCODE_MARKETPLACE_URL} target="_blank" rel="noopener noreferrer" className="button-primary">
            Install for VS Code <ArrowRight size={16} aria-hidden="true" />
          </a>
          <Link href="/pricing" className="button-secondary">
            See team plans
          </Link>
        </div>
      </section>
    </main>
  );
}