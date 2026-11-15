import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Security India: PII Detection & DPDP",
  description:
    "AI security with native Aadhaar, PAN, GSTIN, UPI and IFSC PII detection. Protect AI apps from prompt injection and data leakage, with DPDP Act alignment.",
  path: "/ai-security-india",
  keywords: [
    "ai security india",
    "india pii detection",
    "aadhaar pii detection",
    "dpdp ai compliance",
    "indian ai compliance",
    "llm security india",
    "ai security platform india",
    "chatbot security india",
    "indian pii redaction",
    "ai guardrails india",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-security-india",
  eyebrow: "AI Security for India",
  h1: "AI security built for Indian enterprises and startups",
  productName: "SoterAI Guard — India Edition",
  intro:
    "Indian enterprises face unique AI security challenges: detecting Aadhaar, PAN, GSTIN, UPI, and IFSC identifiers, complying with the DPDP Act, and protecting AI applications at scale. SoterAI names these identifiers directly, can be self-hosted, and lists its known gaps: the Aadhaar-like rule has no checksum and can fire on some card and IBAN digits, and masked numbers are not reliably named.",
  features: [
    {
      title: "India PII detection",
      body: "Detect and redact Aadhaar-like numbers, PAN, GSTIN, UPI IDs, IFSC codes and Indian mobile numbers. The Aadhaar-like rule matches the 12-digit format and does not check the checksum yet.",
    },
    {
      title: "DPDP Act compliance",
      body: "Audit logs, consent management, data minimization controls, and data subject request handling for the Digital Personal Data Protection Act.",
    },
    {
      title: "Local-first architecture",
      body: "Self-host with Docker, Postgres and Redis on a provider or machine you choose. Where text is processed then depends on how you deploy and which optional services you enable.",
    },
    {
      title: "Multilingual support",
      body: "Detect threats and PII in English, Hindi, and transliterated Hinglish — essential for Indian AI applications.",
    },
    {
      title: "Aadhaar-safe AI",
      body: "Prevent Aadhaar numbers from being sent to AI models or stored in AI training data. Redact before any data leaves your application.",
    },
  ],
  how: [
    {
      step: "Integrate with your AI app",
      body: "Add SoterAI Guard to your chatbot, RAG app, or AI agent with a single SDK call.",
    },
    {
      step: "Configure India PII detection",
      body: "Enable India-specific detectors for Aadhaar, PAN, GSTIN, UPI, IFSC, and Indian mobile numbers.",
    },
    {
      step: "Set compliance policies",
      body: "Configure DPDP-compliant audit logging, data retention, and consent workflows.",
    },
    {
      step: "Deploy locally",
      body: "Deploy on AWS India, Azure India, GCP Mumbai, or on-premises. Data sovereignty is built in.",
    },
  ],
  limitations: [
    "India PII detection is heuristic and signature-based. It reduces the risk of data leakage but cannot guarantee 100% detection of every format variant.",
    "DPDP compliance tooling supports audit trails and data minimization but does not replace legal advice or full DPDP certification.",
    "Multilingual detection covers English, Hindi, and Hinglish patterns. Other Indian languages may not be fully supported.",
  ],
  faqs: [
    {
      q: "Does SoterAI detect masked Aadhaar numbers?",
      a: "Not reliably. It names 12-digit Aadhaar-like numbers. In two samples on 2026-11-09, a masked number written as 'XXXX XXXX 1234' got no pattern rule and was only held for review by the model tier. Treat masked numbers as a known gap.",
    },
    {
      q: "Is SoterAI DPDP Act compliant?",
      a: "SoterAI provides tooling to support DPDP Act compliance — audit logs, consent management, data minimization — but compliance certification is your organization's responsibility.",
    },
    {
      q: "Can I deploy SoterAI on Indian cloud providers?",
      a: "Yes. SoterAI Guard can be deployed on AWS India (ap-south-1), Azure India, GCP Mumbai, or any on-premises infrastructure.",
    },
    {
      q: "Does it detect PII in Hindi text?",
      a: "Yes. SoterAI includes detection patterns for PII in English, Hindi, and transliterated Hinglish text.",
    },
  ],
  related: [
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "LLM Security", href: "/llm-security" },
    { label: "Compliance: OWASP LLM Top 10", href: "/compliance/owasp-llm-top-10" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
