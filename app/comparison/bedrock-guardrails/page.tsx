import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: { absolute: "SoterAI vs AWS Bedrock Guardrails | AI Security Comparison" },
  description:
    "SoterAI vs AWS Bedrock Guardrails: model-agnostic runtime security, agent tool-call control, India PII detection and self-hosting vs AWS-native guardrails.",
  alternates: { canonical: "/comparison/bedrock-guardrails" },
  openGraph: {
    title: "SoterAI vs AWS Bedrock Guardrails — AI Security Comparison",
    description:
      "Bedrock Guardrails is the easiest choice inside AWS. SoterAI is model-agnostic, cloud-agnostic, self-hostable, and adds an agent tool-call firewall.",
  },
};

const data: VsContent = {
  slug: "bedrock-guardrails",
  competitor: "AWS Bedrock Guardrails",
  competitorNote: "AWS-managed · Priced per policy evaluation · Bedrock-scoped",
  tagline:
    "Bedrock Guardrails secures models you run inside Bedrock. SoterAI secures whichever models, clouds, and agents you actually use — including on-prem and air-gapped.",
  intro:
    "AWS Bedrock Guardrails is the path of least resistance if your inference already runs in Bedrock: content filters, denied topics, word filters, contextual grounding checks, and PII redaction, all configured in the console and enforced by AWS with no infrastructure of your own. The constraint is scope. It is designed around Bedrock, priced per policy evaluation, and does not govern the layer where agents call tools. SoterAI sits outside any single provider: it guards OpenAI, Anthropic, Gemini, Bedrock, and self-hosted models through the same policy engine, runs detection locally on CPU with no network call, and adds an agent firewall that classifies tool-call reversibility and holds irreversible actions for human approval.",
  theirStrength:
    "Bedrock Guardrails is fully managed with zero operational burden, is covered by AWS's compliance posture and contracts, integrates natively with Bedrock Agents and Knowledge Bases, and requires no code to configure. Inside a Bedrock-only architecture it is the pragmatic default.",
  soterEdge: [
    "Model- and cloud-agnostic — one policy across OpenAI, Anthropic, Gemini, Bedrock, and self-hosted models",
    "Self-hostable in your own VPC, and runs fully offline / air-gapped",
    "Agent firewall: tool-call authorization, reversibility classification, approval queue, rollback windows",
    "India-specific PII (Aadhaar-like, PAN, GSTIN, UPI, IFSC) as first-class detectors",
    "Local CPU detection with no per-evaluation network hop — p95 17.83 ms measured",
    "Reproducible, published benchmark with the methodology and blind held-out results shown",
    "HMAC-signed JSONL/CSV audit exports designed for external SIEM ingestion",
    "Employee AI-usage governance: provider allow/block, data classification, shadow-AI visibility",
    "No per-policy-evaluation pricing on self-hosted deployments",
  ],
  theirEdge: [
    "Zero infrastructure to run or patch — fully AWS-managed",
    "Covered by AWS's existing certifications, contracts, and procurement path",
    "Native integration with Bedrock Agents, Knowledge Bases, and IAM",
    "Automatic reasoning / contextual grounding checks backed by AWS research",
    "Enterprise support and SLA through an existing AWS agreement",
  ],
  rows: [
    { feature: "Input guard (prompt injection)", soter: "yes", them: "yes" },
    { feature: "Output guard (unsafe content)", soter: "yes", them: "yes" },
    { feature: "PII detection + redaction", soter: "yes", them: "yes" },
    { feature: "India PII", desc: "Aadhaar-like, PAN, GSTIN, UPI, IFSC", soter: "yes", them: "no" },
    { feature: "Denied topics / word filters", soter: "yes", them: "yes" },
    { feature: "Contextual grounding check", soter: "Partial", them: "yes" },
    { feature: "Works with non-AWS models", desc: "OpenAI, Anthropic, Gemini, self-hosted", soter: "yes", them: "no" },
    { feature: "Self-hosted deployment", soter: "yes", them: "no" },
    { feature: "Offline / air-gapped operation", soter: "yes", them: "no" },
    { feature: "Agent tool-call firewall", desc: "Authorization + rollback", soter: "yes", them: "no" },
    { feature: "Human approval queue", desc: "Hold irreversible actions", soter: "yes", them: "no" },
    { feature: "Employee AI usage governance", desc: "Shadow AI, provider policy", soter: "yes", them: "no" },
    { feature: "Signed audit exports", desc: "HMAC JSONL/CSV", soter: "yes", them: "Partial" },
    { feature: "Fully managed, no ops", soter: "Partial", them: "yes" },
    { feature: "Free tier", soter: "yes", them: "no" },
  ],
  bestFor: {
    soter:
      "You use more than one model provider, need to self-host or run air-gapped, must detect Indian PII, or need to stop an agent from sending a payment or deleting a record without human approval.",
    them:
      "Your inference runs entirely in Bedrock, you want configuration instead of code, and you would rather inherit AWS's compliance and support posture than operate anything yourself.",
  },
  sourceUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html",
  sourceLabel: "AWS Bedrock Guardrails docs",
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
