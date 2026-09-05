import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs LLM Guard | Open-Source LLM Security Comparison",
  description:
    "SoterAI vs LLM Guard (Protect AI): compare open-source scanner libraries against a managed policy engine with agent tool-call control, India PII, signed audit exports, and a hosted API.",
  alternates: { canonical: "/comparison/llm-guard" },
  openGraph: {
    title: "SoterAI vs LLM Guard — Open-Source LLM Security Comparison",
    description:
      "LLM Guard is a solid MIT scanner toolkit you assemble yourself. SoterAI is a policy engine, control plane, and audit trail you deploy.",
  },
};

const data: VsContent = {
  slug: "llm-guard",
  competitor: "LLM Guard",
  competitorNote: "MIT · Protect AI (acquired by JFrog, 2024) · Python scanner toolkit",
  tagline:
    "LLM Guard gives you scanners and lets you wire the policy yourself. SoterAI ships the policy engine, the enforcement decision, the approval workflow, and the signed audit trail.",
  intro:
    "LLM Guard is a Python toolkit of composable input and output scanners — prompt injection, toxicity, secrets, PII anonymization, ban-topics, and more — released under MIT by Protect AI (now part of JFrog). It is a good, honest library: you import the scanners you want and decide what to do with the results. SoterAI operates one level up. It is a deployed control layer with a five-step policy engine, three enforcement modes, per-department rules, an agent firewall that classifies tool-call reversibility and holds irreversible actions for human approval, HMAC-signed audit exports, and a REST API with JS/TS and Python SDKs. If you enjoy assembling your own security stack, LLM Guard is more flexible. If you need a decision, a log, and an approval queue on day one, SoterAI is less work.",
  theirStrength:
    "LLM Guard is MIT-licensed with no commercial restrictions at all, has a clean and well-documented scanner API, is trivially embeddable in any Python service, carries no vendor dependency, and benefits from Protect AI's model-security research lineage.",
  soterEdge: [
    "Policy engine — five-step evaluation with Monitor / Balanced / Strict modes, not just raw scanner scores",
    "Agent firewall: tool-call authorization, reversibility classification, approval queue, rollback windows",
    "Hosted REST API plus JS/TS SDK — LLM Guard is a Python library only",
    "First-class framework middleware: LangChain, LlamaIndex, Vercel AI SDK, MCP gateway, n8n node",
    "India-specific PII (Aadhaar-like, PAN, GSTIN, UPI, IFSC) as maintained detectors",
    "RAG security: retrieved-document scanning, quarantine, and ACL enforcement",
    "HMAC-signed JSONL/CSV audit exports and compliance evidence collection",
    "Dashboard, guard logs, projects, and API-key management out of the box",
    "Published reproducible benchmark with blind held-out results, not just per-scanner claims",
    "IDE guard for VS Code / Cursor / Windsurf covering the developer surface",
  ],
  theirEdge: [
    "MIT licence with zero commercial-use restrictions — no BUSL clause to read",
    "Zero vendor dependency; nothing to deploy beyond your own process",
    "Scanner-level granularity is easy to fork and modify",
    "Simpler mental model if you only need one or two checks",
    "Backed by JFrog's model-supply-chain security portfolio",
  ],
  rows: [
    { feature: "Input scanners (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output scanners (toxicity, relevance)", soter: "yes", them: "yes" },
    { feature: "Secret / credential detection", soter: "yes", them: "yes" },
    { feature: "PII anonymization", soter: "yes", them: "yes" },
    { feature: "India PII", desc: "Aadhaar-like, PAN, GSTIN, UPI, IFSC", soter: "yes", them: "no" },
    { feature: "Policy engine", desc: "5-step eval, 3 enforcement modes", soter: "yes", them: "no" },
    { feature: "Agent tool-call firewall", desc: "Authorization + rollback", soter: "yes", them: "no" },
    { feature: "Human approval queue", soter: "yes", them: "no" },
    { feature: "RAG security", desc: "Doc scan + quarantine + ACL", soter: "yes", them: "no" },
    { feature: "Hosted REST API", soter: "yes", them: "Partial" },
    { feature: "JS / TypeScript SDK", soter: "yes", them: "no" },
    { feature: "Framework middleware", desc: "LangChain, LlamaIndex, Vercel AI, MCP, n8n", soter: "yes", them: "Partial" },
    { feature: "Dashboard + guard logs", soter: "yes", them: "no" },
    { feature: "Signed audit exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "no" },
    { feature: "Self-hosted", soter: "yes", them: "yes" },
    { feature: "MIT / fully permissive licence", soter: "no", them: "yes" },
  ],
  bestFor: {
    soter:
      "You need an enforced decision, an audit trail someone else can verify, an approval step before an agent does something irreversible, and Indian PII coverage — without building the policy layer yourself.",
    them:
      "You are a Python team that wants MIT-licensed building blocks, prefers to own the policy logic in your own code, and does not need agent action control, a dashboard, or signed audit exports.",
  },
  sourceUrl: "https://github.com/protectai/llm-guard",
  sourceLabel: "LLM Guard (GitHub)",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
