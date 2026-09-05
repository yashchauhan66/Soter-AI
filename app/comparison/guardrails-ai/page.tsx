import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs Guardrails AI | LLM Guardrails Comparison",
  description:
    "SoterAI vs Guardrails AI: compare runtime blocking vs output validation, prompt injection detection, agent tool-call control, India PII, and self-hosting. Honest strengths on both sides.",
  alternates: { canonical: "/comparison/guardrails-ai" },
  openGraph: {
    title: "SoterAI vs Guardrails AI — LLM Guardrails Comparison",
    description:
      "Guardrails AI is the strongest output-validation framework. SoterAI is inline runtime enforcement across input, output, RAG context, and agent tool calls.",
  },
};

const data: VsContent = {
  slug: "guardrails-ai",
  competitor: "Guardrails AI",
  competitorNote: "Apache-2.0 core + Enterprise hub · Python/JS validator framework",
  tagline:
    "Guardrails AI validates that model output has the right shape. SoterAI decides whether the request, the retrieved context, the response, and the tool call should happen at all.",
  intro:
    "Guardrails AI is a validator-composition framework: you declare the structure and constraints an LLM response must satisfy (JSON schema, types, no-PII, tone), and it validates or re-asks until the output conforms. It has the richest validator ecosystem in open source. SoterAI solves a different half of the problem — it is an inline enforcement layer that classifies the incoming prompt before you spend a token, scans retrieved RAG documents, redacts secrets and Indian PII on the way out, and authorizes agent tool calls against a reversibility model with a human approval queue. The two are complementary as often as they are alternatives: teams commonly validate schema with Guardrails AI and enforce security policy with SoterAI.",
  theirStrength:
    "Guardrails AI has a genuinely excellent validator ecosystem (50+ composable validators), permissive Apache-2.0 licensing on the core, first-class structured-output guarantees, and a large Python community. For 'make this LLM return valid, typed, schema-conformant JSON', it is the better tool.",
  soterEdge: [
    "Runtime blocking, not just validation — BLOCK / REDACT / ALLOW decisions inline",
    "Input-side prompt injection and jailbreak classification before the model call",
    "Agent firewall: tool-call authorization, reversibility classification, approval queue, rollback windows",
    "RAG security: retrieved-document scanning, quarantine, and ACL enforcement",
    "India-specific PII (Aadhaar-like, PAN, GSTIN, UPI, IFSC) plus global PII and secret detection",
    "Policy engine with Monitor / Balanced / Strict modes and per-department rules",
    "HMAC-signed JSONL/CSV audit exports for SIEM and compliance evidence",
    "Local CPU detection with no network call — works air-gapped, p95 17.83 ms",
  ],
  theirEdge: [
    "Far richer validator library for structured-output correctness (50+ validators)",
    "Apache-2.0 on the entire core, versus SoterAI's BUSL-1.1 open-core model",
    "Larger open-source contributor community and longer track record",
    "Re-ask / self-correction loops for malformed output are more mature",
  ],
  rows: [
    { feature: "Output schema / type validation", desc: "JSON schema, typed fields", soter: "Partial", them: "yes" },
    { feature: "Input guard (prompt injection)", desc: "Classify before the model call", soter: "yes", them: "no" },
    { feature: "Jailbreak detection", soter: "yes", them: "Partial" },
    { feature: "Runtime blocking", desc: "Inline BLOCK / REDACT decision", soter: "yes", them: "no" },
    { feature: "RAG security", desc: "Doc scan + quarantine + ACL", soter: "yes", them: "no" },
    { feature: "Agent firewall", desc: "Tool-call authorization + rollback", soter: "yes", them: "no" },
    { feature: "India PII", desc: "Aadhaar-like, PAN, GSTIN, UPI, IFSC", soter: "yes", them: "no" },
    { feature: "Secret / credential detection", soter: "yes", them: "Partial" },
    { feature: "Policy engine", desc: "3 enforcement modes", soter: "yes", them: "no" },
    { feature: "Signed audit exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "no" },
    { feature: "Self-hosted", soter: "yes", them: "yes" },
    { feature: "Offline / air-gapped detection", soter: "yes", them: "Partial" },
    { feature: "Fully permissive core license", soter: "no", them: "yes" },
    { feature: "Free tier", soter: "yes", them: "yes" },
  ],
  bestFor: {
    soter:
      "You need to stop something happening — a malicious prompt reaching the model, a secret or Aadhaar number reaching the user, or an agent sending a payment without approval — and you want that decision logged, signed, and self-hostable.",
    them:
      "Your primary problem is output correctness: valid JSON, typed fields, schema conformance, and re-asking the model when it drifts. You want Apache-2.0 across the whole stack and a large validator library to compose from.",
  },
  sourceUrl: "https://github.com/guardrails-ai/guardrails",
  sourceLabel: "Guardrails AI (GitHub)",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
