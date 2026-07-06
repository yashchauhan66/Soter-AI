import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Memory Inspector — See What AI Saw in Your Session",
  description:
    "The AI Memory Inspector keeps a local, reviewable record of the context your AI assistant read during a session, so you can audit exposure after the fact.",
  path: "/ai-memory-inspector",
  keywords: [
    "ai memory inspector",
    "what ai saw",
    "ai context audit",
    "ai access ledger",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-memory-inspector",
  eyebrow: "AI Memory Inspector",
  h1: "See exactly what your AI assistant saw",
  productName: "SoterAI AI Memory Inspector",
  intro:
    "AI assistants accumulate context across a session — files, selections, and snippets you may not remember sharing. The AI Memory Inspector records that context locally so you can review what was exposed, compare AI responses against the context they were given, and export a report for your own audit trail.",
  features: [
    {
      title: "Session memory timeline",
      body: "Start and end memory sessions to capture the context shared with AI, then open the inspector to review it.",
    },
    {
      title: "Local AI Access Ledger",
      body: "Every piece of context routed through the extension is logged locally. Open, export, or clear the ledger — it never leaves your machine unless you export it.",
    },
    {
      title: "“What AI saw last session”",
      body: "A one-command recap of the most recent session’s exposure, useful right after a heavy AI-assisted refactor.",
    },
    {
      title: "Response vs. context comparison",
      body: "Compare an AI response against the protected context it was given to spot leaked instructions or unexpected echoes.",
    },
  ],
  how: [
    {
      step: "Start a memory session",
      body: "Begin recording at the start of an AI-assisted task.",
    },
    {
      step: "Work normally",
      body: "Context shared through the extension is captured in the local ledger as you go.",
    },
    {
      step: "Inspect and compare",
      body: "Open the inspector to review exposure and compare responses against the context provided.",
    },
    {
      step: "Export or clear",
      body: "Export a local report for your records, or clear the session data entirely.",
    },
  ],
  limitations: [
    "The inspector records context that flows through the extension and its broker. It cannot record context read by tools that bypass it.",
    "It is an audit and visibility tool, not a preventive control on its own — pair it with Safe Mode and redaction to reduce exposure.",
    "Exported reports are redacted of detected secrets, but you should still review any export before sharing it.",
    "It reflects what was shared, not what the AI model retained internally on the provider side.",
  ],
  faqs: [
    {
      q: "Where is the memory stored?",
      a: "Locally, in the extension’s workspace state. Nothing is uploaded unless you explicitly export or enable an opt-in cloud feature.",
    },
    {
      q: "Can I prove what AI did not see?",
      a: "You can review the local ledger of what was routed through the extension. It cannot attest to channels outside the extension, and we do not claim otherwise.",
    },
    {
      q: "Does exporting leak secrets?",
      a: "Exports are redacted of detected secrets and canaries. As with any redaction, review the file before sharing it externally.",
    },
  ],
  related: [
    { label: "AI Safe Mode", href: "/ai-safe-mode" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
