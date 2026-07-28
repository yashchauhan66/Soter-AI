import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "LLM Security Platform — Protect Large Language Model Applications",
  description:
    "SoterAI Guard is an LLM security platform that detects prompt injection, jailbreaks, data leakage, and unsafe outputs. Protect chatbots, RAG apps, and AI agents with runtime guardrails.",
  path: "/llm-security",
  keywords: [
    "llm security",
    "llm security platform",
    "llm firewall",
    "llm guardrails",
    "large language model security",
    "llm application security",
    "llm runtime protection",
    "llm input output guard",
  ],
});

const data: FeatureLandingData = {
  path: "/llm-security",
  eyebrow: "LLM Security",
  h1: "Full-stack security for LLM applications",
  productName: "SoterAI LLM Security",
  intro:
    "Large language models introduce new attack surfaces: prompt injection, jailbreaks, data leakage, unsafe outputs, and tool abuse. SoterAI Guard provides comprehensive LLM security — input guard, output guard, RAG security, agent firewall, and audit — in a single platform that runs in the cloud or self-hosted in your VPC.",
  features: [
    {
      title: "Input guard",
      body: "Detect prompt injection, jailbreak attempts, instruction overrides, and malicious inputs before they reach your LLM.",
    },
    {
      title: "Output guard",
      body: "Inspect model outputs for leaked system instructions, PII, unsafe content, and suspicious links before serving to users.",
    },
    {
      title: "RAG security",
      body: "Scan and quarantine documents in your vector database. Enforce access controls on retrieved content.",
    },
    {
      title: "Agent firewall",
      body: "Authorize every tool call an LLM-powered agent makes. Block unauthorized data access and actions.",
    },
    {
      title: "PII redaction",
      body: "Detect and redact global PII plus India-specific identifiers (Aadhaar, PAN, GSTIN, UPI, IFSC) in real time.",
    },
    {
      title: "Audit and compliance",
      body: "HMAC-signed audit logs for every LLM interaction. Export to SIEM for SOC2, ISO 27001, and DPDP compliance.",
    },
  ],
  how: [
    {
      step: "Integrate the SDK",
      body: "Add SoterAI Guard to your LLM app with a single SDK call. Works with LangChain, Vercel AI SDK, Express, FastAPI, and more.",
    },
    {
      step: "Configure policies",
      body: "Set enforcement modes (Monitor / Balanced / Strict) and customize which threats to block, log, or allow.",
    },
    {
      step: "Runtime protection",
      body: "Every LLM input and output is evaluated in real time. Threats are blocked, redacted, or flagged based on policy.",
    },
    {
      step: "Monitor and improve",
      body: "Review security events in the dashboard, export audit logs, and tune policies based on real traffic patterns.",
    },
  ],
  limitations: [
    "LLM security reduces risk but cannot guarantee 100% protection against every novel attack. Defense in depth is recommended.",
    "Detection is heuristic and model-assisted. Novel obfuscation techniques may evade detection.",
    "Self-hosted deployment requires Docker infrastructure and operational expertise.",
    "Audit logs are tamper-evident (HMAC-signed) but not tamper-proof if the signing key is compromised.",
  ],
  faqs: [
    {
      q: "What LLM platforms does SoterAI support?",
      a: "SoterAI Guard works with any LLM API — OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI, self-hosted models, and open-source LLMs via our SDK.",
    },
    {
      q: "Can SoterAI prevent jailbreak attacks?",
      a: "Yes. The input guard detects known jailbreak patterns, DAN variants, role-play exploits, and multilingual attack attempts before they reach the model.",
    },
    {
      q: "Does it work with streaming responses?",
      a: "Yes. SoterAI Guard supports streaming output inspection with minimal added latency (typically under 100ms for the first chunk).",
    },
    {
      q: "Can I self-host SoterAI?",
      a: "Yes. SoterAI Guard is available as a Docker image for self-hosted deployment in your own VPC. All detection runs locally.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Agent Security", href: "/ai-agent-security" },
    { label: "RAG Security", href: "/rag-security" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "Benchmark", href: "/benchmark" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
