import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "LLM Firewall — Runtime Protection for Large Language Models",
  description:
    "SoterAI Guard's LLM firewall provides runtime input/output protection, threat detection, and policy enforcement for any LLM application. Block prompt injection, jailbreaks, and data leakage.",
  path: "/llm-firewall",
  keywords: [
    "llm firewall",
    "ai firewall",
    "llm runtime protection",
    "ai input output guard",
    "llm security gateway",
    "ai application firewall",
    "llm threat protection",
    "ai model firewall",
  ],
});

const data: FeatureLandingData = {
  path: "/llm-firewall",
  eyebrow: "LLM Firewall",
  h1: "A runtime firewall for every LLM call",
  productName: "SoterAI LLM Firewall",
  intro:
    "An LLM firewall sits between your application and the model, inspecting every input and output for threats. SoterAI Guard's LLM firewall provides real-time detection of prompt injection, jailbreaks, PII leakage, unsafe outputs, and policy violations — with configurable enforcement modes and sub-50ms latency.",
  features: [
    {
      title: "Input firewall",
      body: "Inspect every prompt for injection attempts, jailbreaks, malicious instructions, and policy violations before they reach the model.",
    },
    {
      title: "Output firewall",
      body: "Scan model responses for leaked system prompts, PII, unsafe content, and suspicious links before serving to users.",
    },
    {
      title: "Policy enforcement",
      body: "Define custom security policies per application, user, or tenant. Enforce in Monitor, Balanced, or Strict mode.",
    },
    {
      title: "Streaming support",
      body: "Inspect streaming responses in real time with minimal added latency. Block or redact unsafe content mid-stream.",
    },
    {
      title: "Audit logging",
      body: "Every LLM interaction is logged with HMAC-signed audit records for compliance and forensic analysis.",
    },
  ],
  how: [
    {
      step: "Route LLM calls through the firewall",
      body: "Add SoterAI Guard as a middleware layer between your app and any LLM provider.",
    },
    {
      step: "Configure policies",
      body: "Set which threats to block, log, or allow. Customize per endpoint, user role, or data sensitivity.",
    },
    {
      step: "Runtime protection",
      body: "Every input and output is evaluated in real time. Threats are blocked before they reach the model or the user.",
    },
    {
      step: "Monitor and tune",
      body: "Review firewall events in the dashboard and adjust policies based on observed traffic patterns.",
    },
  ],
  limitations: [
    "An LLM firewall reduces risk but cannot guarantee 100% protection against every novel attack.",
    "Streaming inspection may introduce up to 100ms latency on the first chunk of a streaming response.",
    "Custom policies require careful tuning to avoid blocking legitimate use cases.",
  ],
  faqs: [
    {
      q: "What LLM providers does the firewall support?",
      a: "The LLM firewall works with OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI, and any OpenAI-compatible or Anthropic-compatible endpoint.",
    },
    {
      q: "Can the firewall block attacks in real time?",
      a: "Yes. Input inspection adds under 50ms latency. Threats are blocked before the request reaches the LLM provider.",
    },
    {
      q: "Does it support streaming responses?",
      a: "Yes. The firewall inspects streaming output chunk by chunk and can block or redact unsafe content mid-stream.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "Jailbreak Detection", href: "/jailbreak-detection" },
    { label: "LLM Security", href: "/llm-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
