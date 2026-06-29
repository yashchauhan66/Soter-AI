import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs HiddenLayer | AI Security Comparison",
  description:
    "SoterAI vs HiddenLayer: app-layer runtime guardrails and agent controls vs model/ML asset security. Compare prompt injection, RAG security, agent firewall, and self-hosting.",
  alternates: { canonical: "/comparison/hiddenlayer" },
  openGraph: {
    title: "SoterAI vs HiddenLayer — AI Security Comparison",
    description:
      "HiddenLayer secures model artifacts and the ML supply chain. SoterAI secures the runtime behavior of chatbots, RAG apps, and agents.",
  },
};

const data: VsContent = {
  slug: "hiddenlayer",
  competitor: "HiddenLayer",
  competitorNote: "AI/ML model security platform",
  tagline:
    "HiddenLayer protects model artifacts and the ML supply chain. SoterAI protects the runtime behavior of the AI applications you ship — input, output, RAG, and agents.",
  intro:
    "HiddenLayer is focused on AI asset and model security: model scanning, inventory, attack simulation, and ML supply-chain protection for enterprise AI assets. SoterAI operates at the application layer — it intercepts prompts and responses, scans RAG context, authorizes agent tool calls, and enforces policy at request time. The two are complementary; this page covers where SoterAI is the faster, lighter fit for app-layer guardrails.",
  theirStrength:
    "HiddenLayer is stronger for protecting model artifacts themselves — model inventory, adversarial ML detection, attack simulation, and supply-chain security across the enterprise AI estate.",
  soterEdge: [
    "Malicious model artifact scanning: pickle code-execution (os.system / eval / subprocess) detection",
    "Application-layer runtime guardrails: inline input + output enforcement",
    "RAG security: document scanning, quarantine, ACL continuity",
    "Agent firewall: tool-call authorization, passports, approvals, escrow",
    "Lightweight, fast integration via framework SDKs",
    "Integrity + SLSA/in-toto provenance verification with AI-BOM (CycloneDX)",
    "Self-hostable with HMAC-signed audit exports",
  ],
  theirEdge: [
    "Deeper adversarial ML / model attack simulation",
    "Broader ML supply-chain coverage across the enterprise AI estate",
    "Longer enterprise security-operations track record",
  ],
  rows: [
    { feature: "Malicious model scanning", desc: "Pickle RCE / unsafe deserialization", soter: "yes", them: "yes" },
    { feature: "Integrity + provenance", desc: "SHA-256, SLSA/in-toto binding", soter: "yes", them: "yes" },
    { feature: "Input guard (prompt injection)", soter: "yes", them: "Partial" },
    { feature: "Output guard (unsafe content)", soter: "yes", them: "Partial" },
    { feature: "RAG security", desc: "Doc scan + quarantine", soter: "yes", them: "no" },
    { feature: "Agent firewall", desc: "Tool-call authorization", soter: "yes", them: "no" },
    { feature: "Policy engine", desc: "3 enforcement modes", soter: "yes", them: "no" },
    { feature: "Adversarial ML attack simulation", soter: "Partial", them: "yes" },
    { feature: "Self-hosted (Docker)", soter: "yes", them: "Partial" },
    { feature: "Framework SDKs", desc: "LangChain, Vercel AI, Next.js", soter: "yes", them: "no" },
    { feature: "Free tier", soter: "yes", them: "no" },
  ],
  bestFor: {
    soter:
      "You need to secure both the runtime behavior of chatbots/RAG/agents AND scan the model artifacts you ship for malicious serialization.",
    them:
      "Your priority is deep adversarial ML attack simulation and enterprise-wide AI asset inventory.",
  },
  sourceUrl: "https://hiddenlayer.com/",
  sourceLabel: "HiddenLayer",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
