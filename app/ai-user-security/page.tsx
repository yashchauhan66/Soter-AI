import type { Metadata } from "next";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "AI User Security for ChatGPT and Employee AI Tools",
  description:
    "Secure employee use of ChatGPT, Claude, Gemini, and AI coding tools. Detect data leaks, enforce usage policies, discover shadow AI, and retain redacted evidence.",
  path: "/ai-user-security",
  keywords: [
    "AI user security",
    "employee AI security",
    "ChatGPT security for business",
    "secure employee AI use",
    "AI usage security",
    "shadow AI security",
    "generative AI data protection",
    "AI browser security",
    "employee AI governance",
    "AI data loss prevention",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-user-security",
  eyebrow: "AI User Security",
  h1: "Secure how employees use ChatGPT, Claude, Gemini, and AI coding tools",
  productName: "SoterAI User Security",
  intro:
    "Employees use generative AI in browsers, code editors, and automated workflows—often before security teams can review where company data goes. SoterAI adds preventive controls around that usage: scan prompts locally where supported, detect secrets and personal data, apply provider and department policies, surface shadow AI destinations, and record redacted evidence for investigation.",
  features: [
    {
      title: "Sensitive-data protection",
      body: "Detect credentials, database URLs, personal information, and India-specific identifiers before they are shared with an external AI service.",
    },
    {
      title: "Browser and IDE coverage",
      body: "Apply controls where employees use AI in supported Chrome, Edge, VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium workflows.",
    },
    {
      title: "AI provider policies",
      body: "Define approved providers and department-level handling rules so engineering, finance, HR, and support can follow different policies.",
    },
    {
      title: "Shadow AI visibility",
      body: "Surface unknown AI-like destinations observed by enrolled browser clients and let administrators review or classify them.",
    },
    {
      title: "Prompt attack detection",
      body: "Inspect text for prompt injection, jailbreak attempts, instruction overrides, and suspicious requests before model submission.",
    },
    {
      title: "Privacy-aware evidence",
      body: "Keep decision metadata, risk categories, and policy actions while avoiding raw-secret storage on supported redaction paths.",
    },
  ],
  how: [
    {
      step: "Choose the surfaces to protect",
      body: "Deploy the appropriate Beta browser or IDE guard, or route an application workflow through the stable API Guard.",
    },
    {
      step: "Define acceptable AI use",
      body: "Set approved destinations, data-handling rules, enforcement actions, and department-specific exceptions.",
    },
    {
      step: "Inspect before sharing",
      body: "Evaluate supported prompts and context for sensitive data or attack signals, then allow, redact, block, or request review.",
    },
    {
      step: "Review evidence and improve policy",
      body: "Use redacted events and usage trends to investigate risk, educate teams, and tune controls without relying on raw prompt archives.",
    },
  ],
  limitations: [
    "Browser Guard and IDE Guard are Beta surfaces. API Guard is Stable; MCP and agent controls remain Labs where labeled.",
    "SoterAI only inspects supported and enrolled surfaces. Unmanaged devices, encrypted traffic outside the integration boundary, and tools that bypass the guard are not visible.",
    "Secret, PII, and prompt-attack detection is probabilistic or heuristic and cannot guarantee that every sensitive value or novel attack will be detected.",
    "Shadow AI discovery identifies suspicious destinations using observed signals and requires administrator review; it is not a complete inventory of every AI service in an organization.",
    "SoterAI supports governance and audit workflows but does not by itself make an organization compliant with DPDP, SOC 2, ISO 27001, or another framework.",
  ],
  faqs: [
    {
      q: "What is AI user security?",
      a: "AI user security protects people and company data when employees use generative AI tools. It combines data inspection, provider policy, prompt-risk detection, visibility, and audit evidence around browser, IDE, workflow, and API usage.",
    },
    {
      q: "How can a company secure employee use of ChatGPT and Claude?",
      a: "Start with an approved-use policy, deploy controls on supported browsers and IDEs, detect or redact sensitive data before submission, review unknown AI destinations, and retain privacy-aware security events. SoterAI provides these controls on the surfaces routed through it.",
    },
    {
      q: "Does SoterAI store employee prompts?",
      a: "SoterAI is designed to avoid storing raw prompts and secret values on supported redaction paths. Administrators can retain decision metadata such as the risk category, policy action, destination, and timestamp for investigation.",
    },
    {
      q: "Can SoterAI detect shadow AI tools?",
      a: "Enrolled browser clients can report unknown AI-like destinations for administrator review. Discovery is heuristic and should be treated as a review queue rather than a guaranteed complete inventory.",
    },
    {
      q: "Does SoterAI replace employee training or endpoint security?",
      a: "No. It is a defense-in-depth control. Organizations should combine it with employee training, identity and endpoint controls, vendor review, incident response, and clear acceptable-use policies.",
    },
  ],
  related: [
    { label: "Browser Guard", href: "/extensions/browser" },
    { label: "IDE Guard", href: "/extensions/ide" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "AI Security for India", href: "/ai-security-india" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "AI Agent Security", href: "/ai-agent-security" },
    { label: "Trust Center", href: "/trust" },
  ],
};

export default function AiUserSecurityPage() {
  return <FeatureLanding data={data} />;
}