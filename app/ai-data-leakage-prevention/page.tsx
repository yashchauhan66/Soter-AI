import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Data Leakage Prevention — Stop Secrets Reaching AI",
  description:
    "Scan and redact secrets, API keys, and PII locally before they reach an AI coding assistant. SoterAI IDE Guard reduces accidental data leakage at the source.",
  path: "/ai-data-leakage-prevention",
  keywords: [
    "ai data leakage prevention",
    "secret scanning",
    "pii redaction",
    "ai data loss prevention",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-data-leakage-prevention",
  eyebrow: "AI Data Leakage Prevention",
  h1: "Stop secrets and PII from reaching AI by accident",
  productName: "SoterAI AI Data Leakage Prevention",
  intro:
    "The fastest way to leak a credential is to paste a file into an AI assistant that happens to contain one. SoterAI IDE Guard scans your files, selections, and prompts locally for API keys, tokens, database URLs, and personal data — then redacts them before the context is shared, so sensitive values never leave your editor by accident.",
  features: [
    {
      title: "Secret & credential detection",
      body: "Recognize common API keys, tokens, private keys, and database connection strings across your workspace.",
    },
    {
      title: "PII detection",
      body: "Flag personal data, including region-specific identifiers, so it can be redacted before sharing.",
    },
    {
      title: "Redact for AI",
      body: "Replace detected secrets with safe placeholders in a copy of the context, leaving your real files untouched.",
    },
    {
      title: "Protected vault & .env safety",
      body: "Move secrets into a protected local vault, restore placeholders when needed, and generate a safe .env.example without real values.",
    },
    {
      title: "Canary verification",
      body: "Plant fake canary secrets and verify they never appear in logs, reports, or AI output — a live test that redaction is working.",
    },
  ],
  how: [
    {
      step: "Scan the context",
      body: "Scan the file, selection, or workspace for secrets and PII before sharing anything with AI.",
    },
    {
      step: "Redact before sharing",
      body: "Use “Redact Selection for AI” to produce a safe, placeholder-substituted copy to paste or send.",
    },
    {
      step: "Vault real secrets",
      body: "Migrate secrets to the protected vault and keep them out of prompts entirely.",
    },
    {
      step: "Verify with canaries",
      body: "Confirm redaction end-to-end by checking that planted canaries never leak.",
    },
  ],
  limitations: [
    "Detection is heuristic and signature-based. It catches common secret and PII formats but cannot guarantee every value in every format is found.",
    "It protects context routed through the extension and its local broker. Data sent by tools that bypass it is out of scope.",
    "Redaction is best-effort and should be reviewed; a redacted export is safer, not provably secret-free.",
    "It reduces accidental leakage at the source — it does not control what a provider does with content you deliberately send.",
  ],
  faqs: [
    {
      q: "Does scanning upload my code?",
      a: "No. Secret and PII scanning run locally in the extension host. Cloud escalation is opt-in, off by default, and disabled in untrusted workspaces.",
    },
    {
      q: "What happens to a detected secret?",
      a: "You can redact it to a placeholder in the shared copy, move it to a protected vault, or leave your file as-is and simply avoid sharing that span. Your real files are not modified unless you ask.",
    },
    {
      q: "How do I know redaction actually works?",
      a: "Use the canary workflow: generate a fake canary secret, plant it, and run the verification commands to confirm it never appears in logs, reports, or AI output.",
    },
  ],
  related: [
    { label: "Local AI Broker", href: "/local-ai-broker" },
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Memory Inspector", href: "/ai-memory-inspector" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
