import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: "SoterAI vs NVIDIA NeMo Guardrails | AI Guardrails Comparison",
  description:
    "SoterAI vs NVIDIA NeMo Guardrails: compare Colang DSL conversational rails against inline runtime enforcement, agent tool-call control, PII redaction, and self-hosting. Honest strengths on both sides.",
  alternates: { canonical: "/comparison/nemo-guardrails" },
  openGraph: {
    title: "SoterAI vs NVIDIA NeMo Guardrails — AI Guardrails Comparison",
    description:
      "NeMo Guardrails is the best tool for scripted conversation flows. SoterAI is inline security enforcement across input, output, RAG context, and agent tool calls — no DSL to learn.",
  },
};

const data: VsContent = {
  slug: "nemo-guardrails",
  competitor: "NVIDIA NeMo Guardrails",
  competitorNote: "Apache-2.0 · Python + Colang DSL · NVIDIA NIM / Triton ecosystem",
  tagline:
    "NeMo Guardrails scripts what your bot is allowed to talk about. SoterAI decides what data and actions are allowed to move — at the input, the output, the retrieved context, and the tool call.",
  intro:
    "NVIDIA NeMo Guardrails models conversational safety as a state machine written in Colang, a purpose-built DSL. That design is excellent for dialog control: topic fencing, canned refusals, fact-checking rails, and multi-turn flow management, all tightly integrated with NVIDIA NIM and Triton. SoterAI takes the opposite approach — no DSL, no dialog authoring. It is a security control layer you drop in front of an existing app: classify the prompt, scan retrieved documents, redact secrets and Indian PII from the response, and authorize agent tool calls against a reversibility model before they execute. If your problem is 'keep the conversation on-topic', NeMo is the right shape. If your problem is 'stop injection, leakage, and rogue agent actions', SoterAI is.",
  theirStrength:
    "NeMo Guardrails is the most capable open-source tool for scripted conversational control. Colang gives precise, auditable dialog state machines; the NVIDIA ecosystem integration (NIM, Triton) is deep; it is Apache-2.0; and it has NVIDIA's engineering weight and enterprise support behind it.",
  soterEdge: [
    "No DSL to learn — three SDK calls instead of authoring Colang flows",
    "Agent firewall: tool-call authorization, reversibility classification, approval queue, rollback",
    "PII detection and redaction, including India-specific Aadhaar-like, PAN, GSTIN, UPI, IFSC",
    "Secret and credential detection on both input and output",
    "RAG security: retrieved-document scanning, quarantine, and ACL enforcement",
    "JS/TS SDK plus Python — NeMo is Python-only",
    "Multilingual and Hinglish attack detection measured on a published corpus",
    "HMAC-signed audit exports and compliance evidence collection",
    "Local CPU detection with no network call and no GPU requirement",
  ],
  theirEdge: [
    "Colang gives finer-grained, explicitly auditable multi-turn dialog control",
    "Apache-2.0 across the whole project, versus SoterAI's BUSL-1.1 open core",
    "Native NVIDIA NIM / Triton integration and NVIDIA enterprise support",
    "Fact-checking and hallucination rails are more developed",
    "Larger open-source community and contributor base",
  ],
  rows: [
    { feature: "Conversational flow control", desc: "Scripted multi-turn dialog rails", soter: "Partial", them: "yes" },
    { feature: "Topic fencing", soter: "yes", them: "yes" },
    { feature: "Input guard (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output guard (unsafe content)", soter: "yes", them: "yes" },
    { feature: "PII detection + redaction", soter: "yes", them: "no" },
    { feature: "India PII", desc: "Aadhaar-like, PAN, GSTIN, UPI, IFSC", soter: "yes", them: "no" },
    { feature: "Secret / credential detection", soter: "yes", them: "no" },
    { feature: "RAG security", desc: "Doc scan + quarantine + ACL", soter: "yes", them: "Partial" },
    { feature: "Agent firewall", desc: "Tool-call authorization + rollback", soter: "yes", them: "no" },
    { feature: "No DSL required", soter: "yes", them: "no" },
    { feature: "JS / TypeScript SDK", soter: "yes", them: "no" },
    { feature: "Signed audit exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "no" },
    { feature: "Self-hosted", soter: "yes", them: "yes" },
    { feature: "Runs on CPU without a GPU", soter: "yes", them: "Partial" },
    { feature: "Fully permissive core license", soter: "no", them: "yes" },
  ],
  bestFor: {
    soter:
      "You have an app, a RAG pipeline, or an agent already built, and you need a security layer in front of it in an afternoon — covering injection, leakage, Indian PII, and agent action approval, with signed logs and no new language to learn.",
    them:
      "You are building a conversational product where the exact dialog path matters, you want to declare that path explicitly and auditably, and you are already standardized on the NVIDIA inference stack.",
  },
  sourceUrl: "https://github.com/NVIDIA/NeMo-Guardrails",
  sourceLabel: "NVIDIA NeMo Guardrails (GitHub)",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
