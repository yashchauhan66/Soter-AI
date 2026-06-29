import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs Prompt Security | AI Security Comparison",
  description:
    "SoterAI vs Prompt Security (SentinelOne): developer-integrated runtime guardrails vs employee/SaaS AI governance. Compare RAG security, agent firewall, self-hosting, and audit exports.",
  alternates: { canonical: "/comparison/prompt-security" },
  openGraph: {
    title: "SoterAI vs Prompt Security — AI Security Comparison",
    description:
      "Prompt Security focuses on workforce AI and SaaS governance. SoterAI focuses on developer-integrated chatbot/RAG/agent runtime enforcement.",
  },
};

const data: VsContent = {
  slug: "prompt-security",
  competitor: "Prompt Security",
  competitorNote: "Acquired by SentinelOne (2025)",
  tagline:
    "Prompt Security secures employee AI usage and SaaS access. SoterAI secures the AI you build — chatbots, RAG apps, and autonomous agents — with inline runtime enforcement.",
  intro:
    "Prompt Security (now part of SentinelOne) is strong at workforce AI visibility: discovering shadow AI usage, governing browser and SaaS access, and applying data controls across employees. SoterAI sits in a different place in the stack — it protects the AI applications your team ships. It guards model input and output inline, scans RAG context, authorizes agent tool calls, and produces signed audit trails, with the option to self-host.",
  theirStrength:
    "Prompt Security is purpose-built for enterprise workforce AI governance — discovering and controlling how employees use AI across browsers and SaaS, backed by SentinelOne's endpoint security platform.",
  soterEdge: [
    "Developer-integrated runtime enforcement (block / redact / approve) before risky actions execute",
    "RAG security: document scanning, quarantine, and ACL continuity",
    "Agent firewall: tool-call authorization, passports, approvals, escrow",
    "Self-hostable in your own VPC with full data residency",
    "Framework SDKs: LangChain, Vercel AI, Next.js, Express, FastAPI, WordPress",
    "HMAC-signed audit exports for SIEM pipelines",
  ],
  theirEdge: [
    "Employee/SaaS AI discovery and browser-proxy governance at scale",
    "SentinelOne endpoint and enterprise security graph integration",
    "Workforce data-loss controls across third-party AI tools",
  ],
  rows: [
    { feature: "Input guard (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output guard (unsafe content)", soter: "yes", them: "yes" },
    { feature: "Developer SDK runtime enforcement", soter: "yes", them: "Partial" },
    { feature: "RAG security", desc: "Doc scan + quarantine", soter: "yes", them: "no" },
    { feature: "Agent firewall", desc: "Tool-call authorization", soter: "yes", them: "no" },
    { feature: "Employee AI / SaaS governance", desc: "Browser + proxy", soter: "no", them: "yes" },
    { feature: "Self-hosted (Docker)", soter: "yes", them: "no" },
    { feature: "Signed audit exports", soter: "yes", them: "Partial" },
    { feature: "India PII", soter: "yes", them: "Partial" },
    { feature: "Free tier", soter: "yes", them: "no" },
  ],
  bestFor: {
    soter:
      "You are building AI features (chatbot, RAG, agents) and need inline guardrails and audit baked into your application.",
    them:
      "Your priority is governing how employees use third-party AI tools across browsers and SaaS at enterprise scale.",
  },
  sourceUrl: "https://www.prompt.security/",
  sourceLabel: "Prompt Security",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
