import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs Lakera | AI Security Guardrail Comparison",
  description:
    "SoterAI vs Lakera (Check Point): compare prompt injection detection, RAG security, agent firewall, self-hosting, India PII, and audit exports. Honest strengths on both sides.",
  alternates: { canonical: "/comparison/lakera" },
  openGraph: {
    title: "SoterAI vs Lakera — AI Security Comparison",
    description:
      "Lakera is a strong cloud prompt-injection API. SoterAI adds RAG quarantine, agent firewall, policy modes, self-hosting, and signed audit exports.",
  },
};

const data: VsContent = {
  slug: "lakera",
  competitor: "Lakera",
  competitorNote: "Acquired by Check Point, Sep 2025 ($300M)",
  tagline:
    "Lakera pioneered low-latency prompt-injection detection. SoterAI delivers that plus RAG security, an agent firewall, policy modes, self-hosting, and signed audit trails in one product.",
  intro:
    "Lakera (now part of Check Point) is a purpose-built, cloud-hosted API for prompt injection and jailbreak detection, with a well-known red-team community (Gandalf) and broad language coverage. SoterAI is a broader runtime security command layer: it guards both input and output, scans and quarantines RAG documents, authorizes agent tool calls, enforces policy modes, and ships HMAC-signed audit exports — and it can run fully self-hosted in your own VPC.",
  theirStrength:
    "Lakera has deep, purpose-built adversarial detection with strong brand maturity, a large public attack corpus, and Check Point's enterprise go-to-market.",
  soterEdge: [
    "Self-hostable in your own VPC (Lakera is cloud-only)",
    "RAG security: document scanning + quarantine + ACL enforcement",
    "Agent firewall: tool-call authorization, passports, approvals, escrow",
    "Policy engine with Monitor / Balanced / Strict modes",
    "India-specific PII (Aadhaar, PAN, GSTIN, UPI, IFSC) plus global PII",
    "HMAC-signed JSONL/CSV audit exports for SIEM and compliance",
  ],
  theirEdge: [
    "Larger public adversarial corpus and longer track record",
    "Check Point enterprise security stack integration and GTM",
    "Very broad language coverage validated at scale",
  ],
  rows: [
    { feature: "Input guard (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output guard (unsafe content)", soter: "yes", them: "yes" },
    { feature: "RAG security", desc: "Doc scan + quarantine + ACL", soter: "yes", them: "no" },
    { feature: "Agent firewall", desc: "Tool-call authorization", soter: "yes", them: "no" },
    { feature: "Policy engine", desc: "3 enforcement modes", soter: "yes", them: "no" },
    { feature: "India PII", desc: "Aadhaar, PAN, GSTIN, UPI", soter: "yes", them: "yes" },
    { feature: "Self-hosted (Docker)", soter: "yes", them: "no" },
    { feature: "Signed audit exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "no" },
    { feature: "Framework SDKs", desc: "LangChain, Vercel AI, Next.js, Express, FastAPI", soter: "yes", them: "Partial" },
    { feature: "Free tier", soter: "yes", them: "no" },
  ],
  bestFor: {
    soter:
      "You need end-to-end runtime security — input + output + RAG + agents + policy + audit — and want the option to self-host.",
    them:
      "You want a focused, battle-tested cloud prompt-injection API and are standardized on the Check Point security stack.",
  },
  sourceUrl:
    "https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/",
  sourceLabel: "Check Point / Lakera",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
