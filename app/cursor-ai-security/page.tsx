import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Cursor AI Security — Local Secret and Prompt Injection Guard for Cursor",
  description:
    "SoterAI IDE Guard protects Cursor users from secret leakage, prompt injection, and risky MCP tools. Scan your workspace context locally before it reaches Claude or GPT-4 inside Cursor.",
  path: "/cursor-ai-security",
  keywords: [
    "cursor ai security",
    "cursor security extension",
    "cursor secret scanning",
    "cursor prompt injection",
    "cursor mcp security",
    "cursor ide guard",
    "protect secrets cursor ai",
    "cursor copilot security",
  ],
});

const data: FeatureLandingData = {
  path: "/cursor-ai-security",
  eyebrow: "Cursor Security",
  h1: "Local AI security for Cursor — scan before Claude or GPT sees your code",
  productName: "SoterAI IDE Guard for Cursor",
  intro:
    "Cursor reads your open files, recent edits, and project context to power its AI commands. That same context can contain API keys, database credentials, patient data, or other sensitive content that should never leave your machine. SoterAI IDE Guard runs locally in VS Code-compatible editors including Cursor, scanning your workspace for secrets, PII, prompt-injection text, and risky MCP tool configurations before they reach the AI model.",
  features: [
    {
      title: "Local secret and PII scanning",
      body: "Scan files, selections, or your entire workspace for API keys, tokens, database URLs, Aadhaar patterns, PAN, and other sensitive data — entirely on your machine before anything reaches Cursor's AI.",
    },
    {
      title: "Scan before Cursor AI Prompt",
      body: "Use 'Scan Before AI Prompt' to review and redact context immediately before sending it to Claude, GPT-4, or any model inside Cursor. See exactly what the AI will read.",
    },
    {
      title: "MCP config review",
      body: "Cursor supports MCP tools. SoterAI IDE Guard scans your MCP server configurations and flags over-broad tool permissions before you enable them in your Cursor workspace.",
    },
    {
      title: "Prompt injection detection",
      body: "Detect injected instructions in files, repository content, or pasted snippets before they enter a Cursor AI command — including invisible unicode character tricks.",
    },
    {
      title: "AI Memory Inspector",
      body: "Keep a local ledger of what context Cursor AI saw in your session so you can audit exposure after the fact — without sending any data to a server.",
    },
    {
      title: "Terminal command guard",
      body: "Warn on destructive or exfiltration-prone shell commands suggested by Cursor's terminal AI before they run on your machine.",
    },
  ],
  how: [
    {
      step: "Install SoterAI IDE Guard from the VS Code Marketplace",
      body: "SoterAI IDE Guard is built on the VS Code extension API and works in Cursor, which is built on the same platform. Install from the VS Code Marketplace or the Open VSX Registry.",
    },
    {
      step: "Open your Cursor workspace",
      body: "The extension activates automatically. All scanning defaults to local — no data is sent anywhere without your explicit opt-in.",
    },
    {
      step: "Scan before you run a Cursor AI command",
      body: "Use the 'Scan Before AI Prompt' command from the Command Palette to review your context for secrets, PII, and injection text before sending it to Cursor's AI.",
    },
    {
      step: "Review and redact",
      body: "Redact detected sensitive spans directly in the scan results. The redacted version stays on your machine; the original file is unchanged.",
    },
  ],
  limitations: [
    "SoterAI IDE Guard uses the VS Code extension API. It works in Cursor but cannot intercept Cursor-internal AI calls that bypass the extension host.",
    "Detection is heuristic and signature-based. It reduces risk significantly but cannot guarantee every sensitive value in every format is caught.",
    "The extension does not make Cursor AI itself secure — it governs what context you send to the model and records what was shared.",
    "MCP scanning covers tool configurations visible in the workspace. Tools configured externally to the workspace may not be visible.",
  ],
  faqs: [
    {
      q: "Does SoterAI IDE Guard work in Cursor?",
      a: "Yes. Cursor is built on VS Code's extension API. SoterAI IDE Guard installs and runs in Cursor using the same extension host. Install it from the VS Code Marketplace.",
    },
    {
      q: "Can it scan context before a Cursor AI command?",
      a: "Yes. Use the 'Scan Before AI Prompt' command from the Command Palette to review your current file or selection for secrets, PII, and injection text before running a Cursor AI command.",
    },
    {
      q: "Does scanning send my code to SoterAI's servers?",
      a: "No. Secret, PII, prompt-injection, and MCP scanning run locally in the extension host on your machine. Cloud features are opt-in and disabled by default.",
    },
    {
      q: "Does it work with Cursor's Claude and GPT-4 models?",
      a: "The extension is model-agnostic and editor-side. It inspects the context you are about to send, regardless of which AI model Cursor uses under the hood.",
    },
  ],
  related: [
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Windsurf AI Security", href: "/windsurf-ai-security" },
    { label: "MCP Security", href: "/mcp-security" },
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
