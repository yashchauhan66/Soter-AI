import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Jailbreak Detection — Block LLM Jailbreak and DAN Attacks",
  description:
    "Detect and block LLM jailbreak attempts, DAN (Do Anything Now) variants, role-play exploits, and multilingual attacks before they compromise your AI application.",
  path: "/jailbreak-detection",
  keywords: [
    "jailbreak detection",
    "llm jailbreak protection",
    "dan attack prevention",
    "ai jailbreak detector",
    "prompt jailbreak prevention",
    "llm security jailbreak",
    "role play exploit detection",
    "multilingual jailbreak detection",
  ],
});

const data: FeatureLandingData = {
  path: "/jailbreak-detection",
  eyebrow: "Jailbreak Detection",
  h1: "Detect and block jailbreak attempts before they reach your LLM",
  productName: "SoterAI Jailbreak Detection",
  intro:
    "Jailbreak attacks trick LLMs into bypassing their safety training by using role-play scenarios, encoded instructions, hypothetical framing, or multilingual obfuscation. SoterAI Guard detects known jailbreak patterns, DAN variants, character-based exploits, and novel attack attempts using a multi-layered detection engine that combines heuristics, pattern matching, and behavioral analysis.",
  features: [
    {
      title: "Known pattern detection",
      body: "Detect DAN, STAN, hypothetical scenario exploits, and hundreds of known jailbreak templates.",
    },
    {
      title: "Role-play exploit detection",
      body: "Flag prompts that use fictional scenarios, character assumptions, or authority impersonation to bypass safety rules.",
    },
    {
      title: "Multilingual attack detection",
      body: "Catch jailbreak attempts that switch languages or use transliterated scripts to evade detection.",
    },
    {
      title: "Obfuscation detection",
      body: "Identify base64-encoded instructions, character substitution, whitespace tricks, and invisible unicode smuggling.",
    },
    {
      title: "Contextual analysis",
      body: "Evaluate multi-turn conversations for gradual jailbreak progressions that would not trigger single-turn detection.",
    },
  ],
  how: [
    {
      step: "Set enforcement policy",
      body: "Choose Monitor, Balanced, or Strict mode to control how aggressively jailbreak attempts are blocked.",
    },
    {
      step: "Real-time detection",
      body: "Every prompt is evaluated in under 50ms. Detected jailbreak attempts are blocked, logged, or flagged.",
    },
    {
      step: "Review and tune",
      body: "Review false positives in the dashboard and tune detection sensitivity per use case.",
    },
  ],
  limitations: [
    "Jailbreak detection reduces risk but cannot guarantee 100% protection against novel attack variants.",
    "Highly creative or context-specific jailbreaks may evade pattern-based detection.",
    "Detection is single-turn and multi-turn aware, but very long conversations may reduce detection accuracy.",
  ],
  faqs: [
    {
      q: "What is a DAN attack?",
      a: "DAN (Do Anything Now) is a classic jailbreak that instructs the LLM to adopt a persona free of content restrictions. SoterAI detects DAN and hundreds of similar persona-based exploits.",
    },
    {
      q: "Can SoterAI detect zero-day jailbreaks?",
      a: "No detector can guarantee zero-day detection. SoterAI uses heuristic and behavioral analysis alongside known patterns to catch novel variants.",
    },
    {
      q: "Does it add latency to prompts?",
      a: "Jailbreak detection typically adds under 50ms to prompt processing time.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "LLM Firewall", href: "/llm-firewall" },
    { label: "LLM Security", href: "/llm-security" },
    { label: "Benchmark", href: "/benchmark" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
