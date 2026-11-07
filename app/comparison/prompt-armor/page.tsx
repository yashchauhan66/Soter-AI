import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: { absolute: "SoterAI vs Prompt Armor | AI Security Guardrail Comparison 2026" },
  description:
    "SoterAI vs Prompt Armor: compare local-first zero-egress guardrails against cloud APIs. Sub-5ms latency, MCP agent security, and self-hosting evaluated.",
  alternates: { canonical: "/comparison/prompt-armor" },
  openGraph: {
    title: "SoterAI vs Prompt Armor — Local-First AI Agent Guardrail Comparison",
    description:
      "Prompt Armor provides cloud-based prompt injection detection. SoterAI adds sub-5ms local-first inference, zero data exfiltration, MCP agent firewalls, and signed compliance audits.",
  },
};

const data: VsContent = {
  slug: "prompt-armor",
  competitor: "Prompt Armor",
  competitorNote: "Cloud LLM Firewall & Prompt Injection SaaS",
  tagline:
    "Prompt Armor routes prompts through third-party cloud APIs. SoterAI runs 100% locally on your infrastructure with sub-5ms latency, zero data exfiltration, and native MCP agent tool security.",
  intro:
    "Prompt Armor provides hosted API endpoints for detecting prompt injections and data leaks in chatbot conversations. However, sending proprietary prompts and sensitive context to third-party cloud APIs introduces latency spikes, egress costs, and compliance risks. SoterAI delivers local-first, zero-network guardrails with edge ONNX classifiers and regex heuristics that execute inline in under 5ms, while extending full protection to autonomous agents and Model Context Protocol (MCP) tool calls.",
  theirStrength:
    "Prompt Armor offers a straightforward hosted SaaS API for teams wanting quick managed cloud integration without managing model runtimes or local dependencies.",
  soterEdge: [
    "100% Local-First Execution: Prompts and secrets never leave your host or VPC",
    "Sub-5ms Execution Latency: Up to 20x faster than cloud API network roundtrips",
    "MCP & Agent Native: Pre-execution tool call authorization, container sandbox isolation, and canary tripwires",
    "Comprehensive PII Coverage: Global PII plus India-specific identifiers (Aadhaar, PAN, GSTIN, UPI, IFSC)",
    "RAG Document Security: Pre-vectorization quarantine, chunk poisoning detection, and ACL continuity",
    "HMAC-Signed Audit Exports: Cryptographically verifiable JSONL and CSV trails for enterprise SIEM integration",
  ],
  theirEdge: [
    "Turnkey managed cloud SaaS without local infrastructure overhead",
    "Centralized multi-tenant cloud analytics dashboard out-of-the-box",
    "Simpler zero-config onboarding for non-regulated environments",
  ],
  rows: [
    { feature: "Input guard (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output guard (leak prevention)", soter: "yes", them: "yes" },
    { feature: "Zero data exfiltration (Local-first)", desc: "No prompt sends to 3rd party", soter: "yes", them: "no" },
    { feature: "Sub-5ms execution latency", desc: "Local ONNX + heuristic pre-filter", soter: "yes", them: "no" },
    { feature: "MCP tool poisoning defense", desc: "Model Context Protocol guard", soter: "yes", them: "no" },
    { feature: "Agent terminal & shell guard", desc: "PowerShell & bash command firewalls", soter: "yes", them: "no" },
    { feature: "RAG security & quarantine", desc: "Embedding poisoning prevention", soter: "yes", them: "Partial" },
    { feature: "Self-hosted Docker deployment", soter: "yes", them: "no" },
    { feature: "Signed audit compliance exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "no" },
    { feature: "India-specific PII", desc: "Aadhaar, PAN, GSTIN, UPI", soter: "yes", them: "no" },
    { feature: "Developer SDKs", desc: "Next.js, Python, VS Code, Browser Extension", soter: "yes", them: "Partial" },
    { feature: "Free / Community Tier", soter: "yes", them: "no" },
  ],
  bestFor: {
    soter:
      "Enterprise teams, AI agent developers, and regulated industries requiring zero data egress, sub-5ms speed, and autonomous tool-call security.",
    them:
      "Teams seeking a quick cloud-managed prompt injection SaaS who don't have strict data residency or ultra-low latency constraints.",
  },
  sourceUrl: "https://promptarmor.com/",
  sourceLabel: "Prompt Armor",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}

