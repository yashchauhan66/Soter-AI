import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Local AI Broker — Redact Prompts Before They Reach the Model",
  description:
    "A loopback-only proxy for OpenAI- and Anthropic-compatible APIs. The Local AI Broker scans and redacts prompts on your machine before forwarding them upstream.",
  path: "/local-ai-broker",
  keywords: [
    "local ai proxy",
    "openai compatible proxy",
    "prompt redaction proxy",
    "ai data loss prevention",
  ],
});

const data: FeatureLandingData = {
  path: "/local-ai-broker",
  eyebrow: "Local AI Broker",
  h1: "A local proxy that redacts prompts before they leave your machine",
  productName: "SoterAI Local AI Broker",
  intro:
    "The Local AI Broker is a loopback-only HTTP proxy that speaks the OpenAI and Anthropic wire formats. Point your AI tool at it, and every request is scanned and redacted on your machine before it is forwarded to the real provider — so secrets and PII are stripped in transit, not just in the editor.",
  features: [
    {
      title: "OpenAI- and Anthropic-compatible endpoints",
      body: "Drop-in base URLs for chat completions and messages. Copy the broker URL and paste it into any tool that supports a custom endpoint.",
    },
    {
      title: "Loopback-only by design",
      body: "The broker binds to localhost on a configurable port (default 47321). It is not exposed to your network.",
    },
    {
      title: "Inline scan and redact",
      body: "Requests pass through the same detectors as the editor scans: secrets, PII, and prompt-injection signatures are redacted before forwarding.",
    },
    {
      title: "Token protection",
      body: "Broker tokens are stored locally and can be rotated or cleared on demand. Upstream provider URLs are configured locally.",
    },
    {
      title: "Test protection",
      body: "A built-in “Test Broker Protection” command lets you confirm redaction is working with a fake canary before you trust it.",
    },
  ],
  how: [
    {
      step: "Start the broker",
      body: "Launch it from the command palette. It runs on loopback only and reports its status in the SoterAI panel.",
    },
    {
      step: "Point your tool at the broker URL",
      body: "Copy the OpenAI- or Anthropic-compatible URL and set it as the base URL / endpoint in your AI client.",
    },
    {
      step: "Send prompts as usual",
      body: "Requests are scanned and redacted locally, then forwarded to your configured upstream provider.",
    },
    {
      step: "Verify with a canary",
      body: "Run Test Broker Protection to confirm a planted fake secret is stripped before the upstream call.",
    },
  ],
  limitations: [
    "The broker only protects traffic that is actually routed through it. Tools that call providers directly are not covered.",
    "Redaction is heuristic; unusual secret formats may not be recognized. Treat it as defense-in-depth, not a guarantee.",
    "It forwards to the upstream provider you configure — it does not host or replace the model, and normal provider terms still apply to forwarded (redacted) content.",
    "TLS to the upstream provider is handled normally; the broker itself is plain loopback HTTP and intended for local use only.",
  ],
  faqs: [
    {
      q: "Is my prompt sent anywhere before redaction?",
      a: "No. The broker scans and redacts on your machine first, then forwards the redacted request to the upstream provider you configured.",
    },
    {
      q: "Which tools can use it?",
      a: "Any client that lets you set a custom OpenAI- or Anthropic-compatible base URL. You paste the loopback broker URL as the endpoint.",
    },
    {
      q: "What port does it use?",
      a: "It binds to localhost on a configurable port (default 47321) and is never exposed beyond loopback.",
    },
  ],
  related: [
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
