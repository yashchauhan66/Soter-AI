import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Safe Mode — Guardrails for AI Coding Sessions",
  description:
    "AI Safe Mode applies local rules that restrict what context AI assistants can read and what actions they can trigger during a coding session.",
  path: "/ai-safe-mode",
  keywords: [
    "ai safe mode",
    "ai coding guardrails",
    "restrict ai context",
    "ai session security",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-safe-mode",
  eyebrow: "AI Safe Mode",
  h1: "Guardrails for what AI can read and do in your session",
  productName: "SoterAI AI Safe Mode",
  intro:
    "AI Safe Mode is a toggle that applies a set of local rules to your AI coding session — restricting which files and context assistants can read, warning on risky terminal commands, and requiring approval before sensitive context is shared. It turns ad-hoc caution into a consistent, reviewable policy.",
  features: [
    {
      title: "One-toggle protection",
      body: "Enable or disable Safe Mode per session. When on, protected files and secrets are held back from AI context by default.",
    },
    {
      title: "Configurable rules",
      body: "Choose terminal protection (manual, warn, or approval), file-size and workspace scan limits, and exclusion globs to fit your project.",
    },
    {
      title: "Context approval flow",
      body: "Review, approve once, or deny AI context. Approvals are scoped to the session and can be cleared at any time.",
    },
    {
      title: "Visible rule set",
      body: "“Show AI Safe Mode Rules” surfaces exactly which rules are active, so behavior is never a black box.",
    },
  ],
  how: [
    {
      step: "Enable Safe Mode",
      body: "Turn it on from the command palette or the SoterAI panel at the start of a session.",
    },
    {
      step: "Work as usual",
      body: "When AI context includes protected files, secrets, or risky commands, Safe Mode warns or requires approval per your configuration.",
    },
    {
      step: "Approve or deny in-flow",
      body: "Grant session-scoped approval for context you trust, or deny it. All decisions are local.",
    },
    {
      step: "Review and disable",
      body: "Check the ledger of what was shared, then disable Safe Mode when the session ends.",
    },
  ],
  limitations: [
    "Safe Mode enforces rules for context and actions routed through the extension; it cannot control assistants that read files through channels it does not intercept.",
    "Rules are heuristics and policies, not a sandbox. They reduce accidental exposure but do not isolate the AI model.",
    "Approval fatigue is real — overly strict rules can lead to blanket approvals. Tune the rules to your project.",
    "It does not audit the AI provider’s own data handling; it governs what leaves your editor.",
  ],
  faqs: [
    {
      q: "What does Safe Mode actually block?",
      a: "By configuration: sharing of protected files and detected secrets, and risky terminal commands. In approval mode it pauses those actions until you explicitly allow them.",
    },
    {
      q: "Is the policy stored in the cloud?",
      a: "No. Safe Mode rules are local. Team and enterprise policy sync is an optional, opt-in cloud feature.",
    },
    {
      q: "Can I see what rules are active?",
      a: "Yes. Run “Show AI Safe Mode Rules” to view the active rule set at any time.",
    },
  ],
  related: [
    { label: "AI Memory Inspector", href: "/ai-memory-inspector" },
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
