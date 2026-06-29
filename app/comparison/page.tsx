import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SoterAI vs Competitors | AI Security Guardrail Comparison",
  description:
    "Compare SoterAI against Lakera (Check Point), Palo Alto Prisma AIRS, Galileo, Arthur AI, Prompt Security, HiddenLayer, Protect AI, Pangea, Cisco AI Defense, NVIDIA NeMo, Guardrails AI, LLM Guard, GA Guard, AWS Bedrock, and Azure AI Content Safety.",
  alternates: { canonical: "/comparison" },    openGraph: {
    title: "SoterAI vs Competitors — AI Security Guardrail Comparison",
    description: "Compare the core AI guardrail matrix plus the expanded 2026 AI security landscape including Check Point, Palo Alto Prisma AIRS, Galileo Agent Control, and AWS Cross-Account Safeguards.",
  },
};

// ─── Data ──────────────────────────────────────────────────────────────────

const competitors = [
  { id: "soter", name: "SoterAI", icon: "🛡️", color: "text-cyan", bg: "bg-cyan/10 border-cyan/30" },
  { id: "lakera", name: "Lakera", note: "(Check Point)", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  { id: "nemo", name: "NVIDIA NeMo", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { id: "ga", name: "GA Guard", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { id: "grail", name: "Guardrails AI", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  { id: "llm", name: "LLM Guard", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { id: "aws", name: "AWS Bedrock", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
];

const features: Array<{ name: string; desc: string; values: Record<string, string>; unique?: boolean }> = [
  {
    name: "Input Guard",
    desc: "Prompt injection detection",
    values: { soter: "✅", lakera: "✅", nemo: "✅", ga: "✅", grail: "✅", llm: "✅", aws: "✅" },
  },
  {
    name: "Output Guard",
    desc: "Unsafe content filtering",
    values: { soter: "✅", lakera: "✅", nemo: "✅", ga: "✅", grail: "✅", llm: "✅", aws: "✅" },
  },
  {
    name: "India PII",
    desc: "Aadhaar, PAN, GSTIN, UPI, IFSC",
    values: { soter: "✅", lakera: "✅", nemo: "❌", ga: "❌", grail: "✅", llm: "✅", aws: "✅" },
    unique: false,
  },
  {
    name: "RAG Security",
    desc: "Doc scan + quarantine",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Model Scanning",
    desc: "Pickle RCE / unsafe deserialization",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Agent Firewall",
    desc: "Tool-call authorization",
    values: { soter: "✅", lakera: "❌", nemo: "✅", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Policy Engine",
    desc: "3 modes (Monitor/Balanced/Strict)",
    values: { soter: "✅", lakera: "❌", nemo: "✅", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "LangChain",
    desc: "SDK integration",
    values: { soter: "✅", lakera: "✅", nemo: "✅", ga: "❌", grail: "✅", llm: "❌", aws: "❌" },
  },
  {
    name: "LlamaIndex",
    desc: "SDK integration",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Vercel AI SDK",
    desc: "Middleware support",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Next.js Helper",
    desc: "secureChatHandler",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Express / FastAPI / Flask",
    desc: "Framework helpers",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "WordPress Plugin",
    desc: "CMS integration",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Self-Hosted",
    desc: "Docker deployment",
    values: { soter: "✅", lakera: "❌", nemo: "✅", ga: "✅", grail: "✅", llm: "✅", aws: "❌" },
  },
  {
    name: "Enterprise SSO",
    desc: "SCIM v2, SAML",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "✅" },
  },
  {
    name: "Audit Exports",
    desc: "HMAC-signed JSONL/CSV",
    values: { soter: "✅", lakera: "❌", nemo: "❌", ga: "❌", grail: "❌", llm: "❌", aws: "❌" },
    unique: true,
  },
  {
    name: "Open Source",
    desc: "License",
    values: { soter: "❌", lakera: "❌", nemo: "✅", ga: "✅", grail: "✅", llm: "✅", aws: "❌" },
  },
  {
    name: "Packages",
    desc: "npm / PyPI",
    values: { soter: "4+1", lakera: "1", nemo: "—", ga: "HF", grail: "PyPI", llm: "PyPI", aws: "—" },
  },
];

const benchmarks: Array<{
  category: string;
  tests: number;
  soter: string;
  gaGuard: string;
  nemo: string;
  notes: string;
}> = [
  { category: "Prompt Injection", tests: 30, soter: "100%", gaGuard: "98%", nemo: "88%", notes: "Classic + roleplay + system prompt extraction" },
  { category: "Jailbreak / DAN", tests: 11, soter: "100%", gaGuard: "98%", nemo: "75%", notes: "Developer mode, unrestricted, hypotheticals" },
  { category: "Encoding / Obfuscation", tests: 12, soter: "100%", gaGuard: "85%", nemo: "70%", notes: "Base64, rot13, leetspeak, spaced, zero-width" },
  { category: "Multilingual Attacks", tests: 7, soter: "100%", gaGuard: "90%", nemo: "65%", notes: "Hindi/Hinglish bypass attempts" },
  { category: "Indirect Injection", tests: 6, soter: "100%", gaGuard: "86%", nemo: "—", notes: "RAG-poisoned context, email exfiltration" },
  { category: "PII Detection", tests: 12, soter: "100%", gaGuard: "—", nemo: "—", notes: "India-specific (Aadhaar, PAN, GSTIN) + global" },
  { category: "Secrets / Credentials", tests: 19, soter: "100%", gaGuard: "—", nemo: "—", notes: "API keys, tokens, connection strings, env vars" },
  { category: "Unsafe Output", tests: 7, soter: "100%", gaGuard: "—", nemo: "—", notes: "Spam, scams, harmful content (output guard)" },
  { category: "False Positives", tests: 25, soter: "0% FPR", gaGuard: "—", nemo: "—", notes: "25 safe inputs correctly allowed" },
];

const profiles = [
  {
    id: "lakera",
    icon: "🔴",
    name: "Lakera → Check Point",
    status: "Acquired Sep 2025 ($300M)",
    focus: "Prompt injection / jailbreak detection API",
    strength: "Purpose-built, sub-50ms latency, 100+ languages, Gandalf red-team community",
    weakness: "Cloud-only (no self-host), no RAG/agent/enterprise features",
    pricing: "Enterprise only (Check Point sales-gated)",
    url: "https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/",
  },
  {
    id: "paloalto",
    icon: "🟠",
    name: "Palo Alto Prisma AIRS",
    status: "Proprietary · Palo Alto Networks",
    focus: "AI runtime security with MCP/agent lifecycle protection",
    strength: "Enterprise MCP discovery, WebSocket scanning, multi-cloud posture management",
    weakness: "Requires Palo Alto security stack, no self-host, heavy enterprise deployment",
    pricing: "Enterprise only (Palo Alto sales-gated)",
    url: "https://www.paloaltonetworks.com/ai-runtime-security",
  },
  {
    id: "galileo",
    icon: "🟤",
    name: "Galileo",
    status: "Proprietary (Free/Pro/Enterprise)",
    focus: "LLM evaluation and agent observability platform",
    strength: "Luna-2 SLM-as-judge, Agent Control governance layer, deep trace visibility",
    weakness: "Observation-only (no runtime enforcement), cloud-only, no agent security",
    pricing: "Free (5K traces/mo) / Pro ($100/mo) / Enterprise (custom)",
    url: "https://www.rungalileo.io",
  },
  {
    id: "nemo",
    icon: "🔵",
    name: "NVIDIA NeMo Guardrails",
    status: "Apache 2.0 (Open Source) · 3.3K⭐",
    focus: "Conversational flow control with Colang DSL",
    strength: "Most programmable, NVIDIA ecosystem",
    weakness: "Complex Colang DSL, no PII/agent security built-in",
    pricing: "Free",
    url: "https://github.com/NVIDIA/NeMo-Guardrails",
  },
  {
    id: "grail",
    icon: "🟡",
    name: "Guardrails AI",
    status: "Apache 2.0 (Open Source) · 17K⭐",
    focus: "Output validation with structured schemas (Pydantic)",
    strength: "Largest validator library, composable guards, custom Python agent security blocks",
    weakness: "No runtime enforcement, no RAG/agent support, output-focused only",
    pricing: "Free (self-host) / Cloud (usage-based)",
    url: "https://github.com/guardrails-ai/guardrails",
  },
  {
    id: "llm",
    icon: "🟠",
    name: "LLM Guard (Protect AI)",
    status: "MIT (Open Source) · 4.6K⭐",
    focus: "Self-hosted input/output security scanner",
    strength: "MIT licensed, plug-and-play scanner suite",
    weakness: "No RAG/agent/enterprise features",
    pricing: "Free",
    url: "https://github.com/protectai/llm-guard",
  },
  {
    id: "ga",
    icon: "🟢",
    name: "GA Guard (General Analysis)",
    status: "Open-weight (HuggingFace) · 2K⭐",
    focus: "Adversarially trained safety classifier",
    strength: "Highest independent F1 (0.983), 256K context",
    weakness: "Pure classifier only — no RAG/agent/policy engine",
    pricing: "Free (self-host) / Enterprise platform",
    url: "https://huggingface.co/general-analysis",
  },
  {
    id: "aws",
    icon: "🟣",
    name: "AWS Bedrock Guardrails",
    status: "Proprietary (AWS)",
    focus: "Cloud-native guardrails for AWS ecosystem",
    strength: "Deep AWS integration, zero-ops, cross-account safeguards (new), pay-per-token",
    weakness: "AWS vendor lock-in, no self-host, no RAG/agent security",
    pricing: "Pay-per-token ($0.75-$1.50 per 1K units)",
    url: "https://aws.amazon.com/bedrock/guardrails/",
  },
];

const whoWins: Array<{ emoji: string; winner: string; reason: string }> = [
  { emoji: "🛡️", winner: "Soter", reason: "Most comprehensive — Input + Output + RAG + Agent Firewall + Policy + Enterprise in one product" },
  { emoji: "🟢", winner: "GA Guard", reason: "Best adversarial detection — highest independent F1 (0.983), adversarially trained" },
  { emoji: "🟡", winner: "Guardrails AI", reason: "Largest open source community — 17K+ GitHub stars, richest validator library" },
  { emoji: "🟣", winner: "AWS Bedrock", reason: "Best cloud integration — deepest AWS ecosystem with new cross-account safeguards" },
  { emoji: "🔵", winner: "NVIDIA NeMo", reason: "Best flow control — only programmable dialog flow with Colang DSL" },
  { emoji: "🟤", winner: "Galileo", reason: "Best observability — Luna-2 SLM-as-judge, Agent Control governance, deep trace visibility" },
  { emoji: "🔴", winner: "Palo Alto Prisma AIRS", reason: "Best enterprise MCP security — agent lifecycle management, WebSocket scanning, multi-cloud posture" },
];

// ─── JSON-LD ───────────────────────────────────────────────────────────────

const bestByUseCase = [
  {
    useCase: "Production chatbot, RAG app, or AI agent security",
    winner: "SoterAI",
    why: "Broadest runtime coverage: input guard, output guard, RAG scanning, agent firewall, approvals, audit logs, webhooks, and enterprise controls in one stack.",
  },
  {
    useCase: "Pure adversarial classifier accuracy",
    winner: "GA Guard / Lakera",
    why: "Stronger public third-party or large-scale adversarial detection proof. Soter has strong internal tests, but still needs independent benchmarking.",
  },
  {
    useCase: "Open-source validation and structured outputs",
    winner: "Guardrails AI",
    why: "Large validator ecosystem and community; best fit when the primary need is schema and output validation rather than full runtime security.",
  },
  {
    useCase: "Programmable conversation flow control",
    winner: "NVIDIA NeMo Guardrails",
    why: "Colang-based rails are best for teams that want explicit dialog flow programming and can absorb the DSL complexity.",
  },
  {
    useCase: "AWS-native managed guardrails",
    winner: "AWS Bedrock Guardrails",
    why: "Best choice for teams already standardized on AWS Bedrock and prioritizing managed service operations over portability.",
  },
  {
    useCase: "Enterprise AI asset protection",
    winner: "HiddenLayer / Protect AI / Cisco AI Defense",
    why: "Stronger focus on model inventory, AI asset security, ML supply chain, and enterprise security operations.",
  },
  {
    useCase: "Enterprise MCP/agent lifecycle and runtime security",
    winner: "Palo Alto Prisma AIRS",
    why: "Stronger MCP discovery, WebSocket scanning for real-time agents, and multi-cloud posture management across enterprise security stacks.",
  },
  {
    useCase: "LLM observability, evaluation, and cost monitoring",
    winner: "Galileo",
    why: "Luna-2 SLM-as-judge provides cost-effective evaluation at scale; Agent Control enables fleet-wide governance without code changes.",
  },
  {
    useCase: "Shadow agent discovery and EU AI Act compliance",
    winner: "Arthur AI",
    why: "Automated agent discovery across VPCs and OpenTelemetry streams; purpose-built for EU AI Act audit trails.",
  },
  {
    useCase: "Employee AI governance and SaaS visibility",
    winner: "Prompt Security / Pangea AI Guard",
    why: "Better fit for workforce AI usage discovery, browser/proxy governance, and broad enterprise SaaS controls.",
  },
  {
    useCase: "LLM evaluation, hallucination, and factuality testing",
    winner: "Patronus AI / Galileo / Arthur AI",
    why: "Evaluation-first tools remain stronger for offline evals, factuality, and observability workflows.",
  },
];

const expandedCompetitors = [
  {
    name: "Lakera / Check Point",
    category: "Prompt injection and AI app security",
    bestAt: "Low-latency prompt injection and jailbreak detection with enterprise GTM.",
    soterEdge: "Soter adds self-hosting, RAG quarantine, agent firewall, policy modes, India PII, and audit workflows.",
    caveat: "Lakera has stronger brand maturity and public adversarial corpus visibility.",
  },
  {
    name: "Prompt Security / SentinelOne",
    category: "Employee AI and SaaS governance",
    bestAt: "Workforce AI visibility, data controls, and enterprise browser/SaaS governance.",
    soterEdge: "Soter is stronger for developer-integrated chatbot/RAG/agent runtime enforcement.",
    caveat: "Soter is not yet a full employee-AI browser/proxy governance suite.",
  },
  {
    name: "HiddenLayer",
    category: "AI asset and model security",
    bestAt: "Model inventory, attack simulation, supply-chain and runtime security for enterprise AI assets.",
    soterEdge: "Soter is lighter and faster to integrate for app-layer guardrails and agent controls.",
    caveat: "HiddenLayer is stronger for model artifact and enterprise AI asset protection.",
  },
  {
    name: "Palo Alto Prisma AIRS",
    category: "Enterprise agent runtime security",
    bestAt: "MCP/agent lifecycle discovery, WebSocket scanning for real-time agents, enterprise posture management.",
    soterEdge: "Soter is self-hostable, has 12 agent security modules with runtime enforcement, and doesn't require Palo Alto security stack.",
    caveat: "Prisma AIRS has stronger enterprise MCP discovery, cross-cloud posture, and Palo Alto's security operations maturity.",
  },
  {
    name: "Protect AI",
    category: "AI supply chain and model security",
    bestAt: "Model scanning, ML supply-chain security, and LLM Guard ecosystem.",
    soterEdge: "Soter bundles SaaS guard APIs, RAG, agent firewall, dashboards, and compliance workflows.",
    caveat: "Protect AI has deeper model security and research footprint.",
  },
  {
    name: "Galileo",
    category: "AI evaluation and observability",
    bestAt: "Luna-2 SLM-as-judge, Agent Control governance layer, deep trace visibility into agent thought paths.",
    soterEdge: "Soter enforces runtime security decisions before risky actions execute, not just after-the-fact observability.",
    caveat: "Galileo's evaluation depth, cost-effective SLM monitoring, and trace analytics are stronger for observability workflows.",
  },
  {
    name: "Arthur AI",
    category: "Agent discovery and governance",
    bestAt: "Shadow agent discovery across VPCs, OTel streams, and network analysis; EU AI Act audit trails.",
    soterEdge: "Soter provides runtime enforcement (block/allow/escrow) in addition to governance — Arthur is evaluation and discovery focused.",
    caveat: "Arthur is stronger for discovering shadow agents and providing compliance audit trails for agent fleets.",
  },
  {
    name: "Pangea AI Guard / CrowdStrike ecosystem",
    category: "Security platform-integrated AI guardrails",
    bestAt: "Policy enforcement and security telemetry in broader enterprise security stacks.",
    soterEdge: "Soter is more developer-centric and self-hostable for AI app teams.",
    caveat: "Enterprise security graph and endpoint integrations are stronger in larger platforms.",
  },
  {
    name: "Cisco AI Defense",
    category: "Enterprise AI posture and protection",
    bestAt: "Security operations, posture management, and enterprise governance.",
    soterEdge: "Soter provides practical app-layer guard APIs and agent workflow controls for builders.",
    caveat: "Cisco is stronger for large-enterprise procurement and platform coverage.",
  },
  {
    name: "Azure AI Content Safety",
    category: "Cloud-native content safety",
    bestAt: "Managed moderation and PII/content safety for Azure customers.",
    soterEdge: "Soter is cloud-portable, self-hostable, and covers RAG/agent runtime workflows.",
    caveat: "Azure is stronger for teams standardized on Microsoft cloud governance.",
  },
  {
    name: "Patronus AI / Galileo / Arthur AI",
    category: "LLM evaluation and observability",
    bestAt: "Offline evals, factuality, hallucination checks, and production monitoring.",
    soterEdge: "Soter enforces runtime security decisions before risky actions execute.",
    caveat: "Evaluation depth and analytics are stronger in eval-first platforms.",
  },
];

function jsonLd() {
  const softwareItems = competitors.map((c) => {
    const featureProps = features.map((f) => ({
      "@type": "PropertyValue",
      name: f.name,
      value: f.values[c.id as keyof typeof f.values],
      description: f.desc,
    }));
    return {
      "@type": "ListItem",
      position: competitors.indexOf(c) + 1,
      item: {
        "@type": "SoftwareApplication",
        name: c.name,
        url: `https://soterai.publicvm.com/comparison#${c.id}`,
        applicationCategory: "SecurityApplication",
        description: `AI security guardrail platform. Features: ${features
          .filter((f) => f.values[c.id as keyof typeof f.values] === "✅")
          .map((f) => f.name)
          .join(", ")}.`,
        additionalProperty: featureProps,
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "mainEntityOfPage": { "@type": "WebPage", "@id": "https://soterai.publicvm.com/comparison" },
        "name": "Soter vs Competitors — AI Security Guardrail Comparison",
        "description": "Compare core AI guardrail platforms plus the expanded 2026 AI security landscape, including Lakera (Check Point), Palo Alto Prisma AIRS, Galileo, Arthur AI, Prompt Security, HiddenLayer, Protect AI, Pangea, Cisco, NVIDIA, Guardrails AI, LLM Guard, AWS, Azure, and Patronus.",
        "mainEntity": {
          "@type": "ItemList",
          "name": "AI Security Guardrail Platforms",
          "description": "Comparison of core AI guardrail platforms and broader 2026 AI security competitors",
          "numberOfItems": competitors.length,
          "itemListOrder": "Descending",
          "itemListElement": softwareItems,
        },
      },
    ],
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ComparisonPage() {
  return (
    <main className="py-16 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />
      <div className="container-page">
        {/* ── Hero ── */}
        <div className="text-center">
          <p className="eyebrow">Soter vs Competitors</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            The <span className="text-cyan">most comprehensive</span> AI security platform
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-7 text-slate-400">
            Only Soter covers Input + Output + RAG Security + Agent Firewall + Policy Engine + Enterprise features
            in a single product. Compare features, benchmarks, and pricing.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="button-primary gap-2">
              Get started free <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/benchmarks" className="button-secondary gap-2">
              <BarChart3 size={16} aria-hidden="true" /> View benchmarks
            </Link>
            <Link href="/playground" className="text-sm text-slate-400 hover:text-white">
              Try the playground
            </Link>
          </div>
        </div>

        {/* ── Head-to-head pages ── */}
        <section className="mt-12">
          <p className="text-center text-sm text-slate-400">Head-to-head breakdowns</p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-3">
            {[
              ["SoterAI vs Lakera", "/comparison/lakera"],
              ["SoterAI vs Prompt Security", "/comparison/prompt-security"],
              ["SoterAI vs HiddenLayer", "/comparison/hiddenlayer"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan/50 hover:text-white"
              >
                {label} →
              </Link>
            ))}
          </div>
        </section>

        {/* ── Feature Comparison Table ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Award className="text-cyan" size={24} aria-hidden="true" />
            Feature Comparison
          </h2>
          <p className="mt-2 text-sm text-slate-400">Core feature matrix plus expanded 2026 competitor landscape</p>

          {/* Mobile: card layout */}
          <div className="mt-6 space-y-3 sm:hidden">
            {features.map((f) => (
              <div key={f.name} className={`card p-4 ${f.unique ? "border-cyan/30" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.desc}</p>
                  </div>
                  {f.unique && <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">Unique</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {competitors.map((c) => (
                    <div key={c.id} className="flex items-center gap-1.5">
                      <span className={c.color}>{f.values[c.id as keyof typeof f.values]}</span>
                      <span className="text-slate-400">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="mt-6 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th scope="col" className="sticky left-0 bg-ink px-4 py-3 text-left font-semibold text-slate-300">Feature</th>
                  {competitors.map((c) => (
                    <th key={c.id} scope="col" className={`px-3 py-3 text-center font-semibold ${c.color}`}>
                      {c.icon} {c.name}
                      {c.note && <span className="block text-xs font-normal text-slate-500">{c.note}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.name} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-950/30" : ""} ${f.unique ? "bg-cyan/5" : ""}`}>
                    <td className="sticky left-0 bg-ink px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{f.name}</span>
                        {f.unique && (
                          <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-medium text-cyan whitespace-nowrap">
                            Only Soter
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{f.desc}</p>
                    </td>
                    {competitors.map((c) => {
                      const val = f.values[c.id as keyof typeof f.values];
                      const isYes = val === "✅";
                      const isNo = val === "❌";
                      const isSoter = c.id === "soter";
                      return (
                        <td key={c.id} className={`px-3 py-3.5 text-center ${isSoter ? "font-bold" : ""}`}>
                          {isYes ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-lime/10 text-lime">
                              <CheckCircle2 size={16} />
                            </span>
                          ) : isNo ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500/10 text-red-400">
                              <XCircle size={16} />
                            </span>
                          ) : (
                            <span className="text-slate-500">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            ✅ = Supported &nbsp; ❌ = Not supported &nbsp; — = Not available
            &nbsp;·&nbsp;
            <Link href="/signup" className="text-cyan underline underline-offset-2 hover:text-cyan/80">
              Start with the free tier →
            </Link>
          </p>
        </section>

        {/* ── Benchmark Comparison ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <BarChart3 className="text-cyan" size={24} aria-hidden="true" />
            Benchmark Comparison
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Soter vs GA Guard vs NVIDIA NeMo (independent + internal benchmarks, Jun 2026)
          </p>

          {/* Mobile: stacked cards */}
          <div className="mt-6 space-y-3 sm:hidden">
            {benchmarks.map((b) => (
              <div key={b.category} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{b.category}</p>
                  <span className="text-xs text-slate-500">{b.tests} tests</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-cyan/10 p-2">
                    <p className="text-cyan font-bold">{b.soter}</p>
                    <p className="text-slate-500">Soter</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <p className="text-emerald-400 font-bold">{b.gaGuard}</p>
                    <p className="text-slate-500">GA Guard</p>
                  </div>
                  <div className="rounded-lg bg-green-500/10 p-2">
                    <p className="text-green-400 font-bold">{b.nemo}</p>
                    <p className="text-slate-500">NeMo</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{b.notes}</p>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="mt-6 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-300">Category</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-slate-300">Tests</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-cyan">Soter</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-emerald-400">GA Guard</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-green-400">NVIDIA NeMo</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold text-slate-300">Notes</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b, i) => (
                  <tr key={b.category} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-slate-950/30" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-200">{b.category}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{b.tests}</td>
                    <td className="px-3 py-3 text-center font-bold text-cyan">{b.soter}</td>
                    <td className="px-3 py-3 text-center text-emerald-400">{b.gaGuard}</td>
                    <td className="px-3 py-3 text-center text-green-400">{b.nemo}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{b.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Soter scores from internal Garak-style benchmark (Jun 21, 2026). GA Guard &amp; NeMo per-category scores are interpolated from their published overall F1 scores (0.983 and 0.875 respectively). 
            &quot;—&quot; = not tested in that category.
          </p>
        </section>

        {/* ── Who Wins Where ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Star className="text-cyan" size={24} aria-hidden="true" />
            Who Wins Where
          </h2>
          <p className="mt-2 text-sm text-slate-400">Each platform has a distinct strength quadrant</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whoWins.map((w) => (
              <div key={w.winner} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{w.emoji}</span>
                  <div>
                    <p className="font-bold text-lg">{w.winner}</p>
                    <p className="text-sm leading-5 text-slate-400">{w.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Competitor Profiles ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Award className="text-cyan" size={24} aria-hidden="true" />
            Best Platform by Use Case
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            The honest answer: Soter is best for broad app-layer runtime security, while some competitors win narrow categories.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {bestByUseCase.map((item) => (
              <div key={item.useCase} className="card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.useCase}</p>
                <p className="mt-2 text-lg font-bold text-cyan">{item.winner}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.why}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <ShieldCheck className="text-cyan" size={24} aria-hidden="true" />
            Expanded Competitor Landscape
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Major AI security competitors beyond the core guardrail table, with where Soter wins and where it should stay humble.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {expandedCompetitors.map((competitor) => (
              <div key={competitor.name} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">{competitor.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{competitor.category}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-400">
                    Compared
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Best at</dt>
                    <dd className="mt-1 text-slate-300">{competitor.bestAt}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-cyan">Soter edge</dt>
                    <dd className="mt-1 text-slate-300">{competitor.soterEdge}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-amber-300">Caveat</dt>
                    <dd className="mt-1 text-slate-400">{competitor.caveat}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <Users className="text-cyan" size={24} aria-hidden="true" />
            Competitor Profiles
          </h2>
          <p className="mt-2 text-sm text-slate-400">Detailed breakdown of each competitor</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {profiles.map((p) => (
              <div key={p.id} className="card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.status}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  <span className="font-medium">Focus:</span> {p.focus}
                </p>
                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex gap-2">
                    <TrendingUp className="mt-0.5 shrink-0 text-lime" size={14} aria-hidden="true" />
                    <span className="text-slate-400">{p.strength}</span>
                  </div>
                  <div className="flex gap-2">
                    <XCircle className="mt-0.5 shrink-0 text-red-400" size={14} aria-hidden="true" />
                    <span className="text-slate-400">{p.weakness}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{p.pricing}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-cyan hover:text-cyan/80"
                  >
                    Source <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Market Map ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <BookOpen className="text-cyan" size={24} aria-hidden="true" />
            Competitive Positioning Map
          </h2>

          <div className="mt-6 card p-6 sm:p-8">
            <div className="overflow-x-auto">
              <pre className="text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">
{`                    COMPREHENSIVENESS
                    (+ RAG + Agent + Policy)
                          |
                          |   Soter
                          |
   GA Guard ------+------ AWS Bedrock
   LLM Guard      |       Lakera (Check Point)
                  |
    --------------+-------------- OPEN SOURCE
    Guardrails AI |
    NeMo          |
                  |
                  |   Patronus AI (evaluation only)
                  |
                  +--------------------------
                  LATENCY / PERFORMANCE`}
              </pre>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Soter is the most comprehensive — the only platform covering Input + Output + RAG + Agent Firewall + Policy + Enterprise in one product.
            </p>
          </div>
        </section>

        {/* ── Market Trends ── */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <TrendingUp className="text-cyan" size={24} aria-hidden="true" />
            Market Context (2026)
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-semibold">Major Consolidation</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li className="flex gap-2">
                  <span className="text-red-400">🔴</span>
                  <span><strong className="text-slate-200">Lakera</strong> → Check Point ($300M, Sep 2025)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-orange-400">🟠</span>
                  <span><strong className="text-slate-200">Protect AI</strong> → Palo Alto Networks (2025)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400">⚪</span>
                  <span><strong className="text-slate-200">Prompt Security</strong> → Acquired (2025)</span>
                </li>
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold">Key Market Trends</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li className="flex gap-2"><span className="text-cyan">→</span>Agentic Shift: Tool-call auth = #1 priority for AI security buyers</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>Shadow AI discovery becomes critical — Arthur AI pioneers Agent Discovery &amp; Governance (ADG)</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>AWS introduces Cross-Account Safeguards for org-wide immutable AI policies</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>Palo Alto launches WebSocket scanning for real-time voice/trading bot agents</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>EU AI Act enforcement begins (fines up to 7% global revenue)</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>Small adversarial SLMs beat LLM-as-judge in detection accuracy</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>Galileo Luna-2 sets new standard for cost-effective on-device evaluation</li>
                <li className="flex gap-2"><span className="text-cyan">→</span>Function-call safety remains unsolved benchmark (Mozilla.ai κ~0.26)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Soter's Unique Strengths ── */}
        <section className="mt-16">
          <div className="rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent p-8 sm:p-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold">
              <ShieldCheck className="text-cyan" size={28} aria-hidden="true" />
              Why Soter?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              The only platform that delivers all of these capabilities in a single product:
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Input + Output Guard",
                "RAG Security (Doc Scan + Quarantine)",
                "Agent Firewall (Tool-Call Auth)",
                "Policy Engine (3 Modes)",
                "India-Specific PII (Aadhaar, PAN, GSTIN)",
                "8 Framework Integrations",
                "Full Self-Hosted (Docker)",
                "Enterprise SSO (SCIM v2, SAML)",
                "HMAC-Signed Audit Exports",
                "WordPress Plugin",
                "4 npm + 1 PyPI Packages",
                "Free Tier Available",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="shrink-0 text-lime" size={16} aria-hidden="true" />
                  <span className="text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mt-16">
          <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Ready to secure your AI?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Start with the interactive playground, then protect your chatbot with a single SDK call.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white"
              >
                Sign up free <ArrowRight size={18} />
              </Link>
              <Link
                href="/playground"
                className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink"
              >
                Try the playground
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink"
              >
                Read docs
              </Link>
            </div>
          </div>
        </section>

        {/* ── Sources ── */}
        <p className="mt-8 text-center text-xs text-slate-600">
          Sources:{" "}
          <a href="https://docs.lakera.ai/guard" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">Lakera (Check Point)</a>
          {" · "}
          <a href="https://docs.paloaltonetworks.com/ai-runtime-security" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">Palo Alto Prisma AIRS</a>
          {" · "}
          <a href="https://www.rungalileo.io" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">Galileo</a>
          {" · "}
          <a href="https://generalanalysis.com/guides/best-ai-guardrails" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">General Analysis</a>
          {" · "}
          <a href="https://truefoundry.com/blog/ai-guardrails-comparison" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">TrueFoundry</a>
          {" · "}
          <a href="https://mozilla.ai" className="text-cyan underline underline-offset-2" target="_blank" rel="noopener">Mozilla.ai</a>
          {" · "}
          <a href="/api/benchmarks" className="text-cyan underline underline-offset-2">Soter Internal Benchmark</a>
        </p>
      </div>
    </main>
  );
}
