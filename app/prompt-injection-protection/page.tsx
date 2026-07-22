import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Prompt Injection Protection for AI Coding Tools",
  description:
    "Detect prompt-injection and instruction-override text hidden in files, dependencies, and AI output before it reaches your coding assistant — locally, in VS Code.",
  path: "/prompt-injection-protection",
  keywords: [
    "prompt injection protection",
    "prompt injection detection",
    "ai instruction override",
    "indirect prompt injection",
    "prompt injection prevention",
    "llm jailbreak protection",
    "prompt injection india",
    "ai security prompt injection",
  ],
});

const data: FeatureLandingData = {
  path: "/prompt-injection-protection",
  eyebrow: "Prompt Injection Protection",
  h1: "Catch prompt injection before it reaches your assistant",
  productName: "SoterAI Prompt Injection Protection",
  intro:
    "Prompt injection hides instructions inside content an AI reads — a README, a dependency file, a pasted snippet, or a tool result — to hijack the assistant into leaking data or taking unwanted actions. SoterAI IDE Guard scans the context you are about to share, and the output you get back, for instruction-override and extraction patterns before they can take effect.",
  features: [
    {
      title: "Context scanning",
      body: "Inspect files and selections for injected instructions (“ignore previous instructions”, hidden directives, and obfuscated variants) before they enter an AI prompt.",
    },
    {
      title: "Repo instruction poisoning checks",
      body: "Flag suspicious instructions planted in repository files that an assistant might treat as authoritative.",
    },
    {
      title: "Output inspection",
      body: "Scan AI output for leaked system instructions, suspicious links, and signs the model was steered off task.",
    },
    {
      title: "Invisible-character detection",
      body: "Catch zero-width and combining-mark tricks used to smuggle instructions past a human reviewer.",
    },
  ],
  how: [
    {
      step: "Scan before prompting",
      body: "Run a scan of the context you are about to share so hidden instructions are surfaced first.",
    },
    {
      step: "Review flagged spans",
      body: "See exactly which text triggered a prompt-injection signal and decide whether to redact or remove it.",
    },
    {
      step: "Inspect the response",
      body: "Scan AI output for leaked instructions or suspicious content before you act on it.",
    },
    {
      step: "Tune thresholds",
      body: "Adjust sensitivity to balance detection against false positives for your codebase.",
    },
  ],
  limitations: [
    "Prompt-injection detection is heuristic. It raises the cost of an attack and catches known patterns, but a novel or heavily obfuscated injection may evade it.",
    "It reduces risk on context and output routed through the extension; it cannot inspect channels it does not see.",
    "Detection is not the same as prevention — treat flags as a prompt to review, and keep least-privilege tool permissions as a second layer.",
    "No detector can guarantee an AI model will never be manipulated; this lowers probability, it does not eliminate it.",
  ],
  faqs: [
    {
      q: "What is indirect prompt injection?",
      a: "It is when malicious instructions are hidden in content the AI reads — files, web pages, dependency metadata, or tool output — rather than typed by the user. Because assistants often treat that content as trusted, it is a common attack path.",
    },
    {
      q: "Can you block 100% of prompt injections?",
      a: "No, and we do not claim to. Detection is heuristic and pattern-based. It meaningfully reduces risk and catches known techniques, but novel attacks can still slip through, so we recommend layered defenses.",
    },
    {
      q: "Does it scan AI output too?",
      a: "Yes. You can scan responses for leaked system instructions, suspicious links, and off-task steering before you rely on them.",
    },
  ],
  related: [
    { label: "MCP Security", href: "/mcp-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
