import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "VS Code AI Security — Local Guard for AI Coding",
  description:
    "SoterAI IDE Guard is a local VS Code security extension that scans secrets, prompts, MCP tools, and terminal commands before they reach Copilot, Cursor, or Claude.",
  path: "/vscode-ai-security",
  keywords: [
    "vscode ai security",
    "ai coding security",
    "copilot secret scanning",
    "cursor security extension",
    "local ai guard",
  ],
});

const data: FeatureLandingData = {
  path: "/vscode-ai-security",
  eyebrow: "VS Code Extension",
  h1: "AI security for VS Code, running locally",
  productName: "SoterAI IDE Guard",
  intro:
    "AI coding assistants read your open files, selections, and context to answer. SoterAI IDE Guard inspects that context on your machine — flagging secrets, PII, prompt-injection text, risky MCP tools, and dangerous terminal commands — before it is shared with Copilot, Cursor, Claude, or any AI model.",
  features: [
    {
      title: "Local secret & PII scanning",
      body: "Scan the current file, a selection, or the whole workspace for API keys, tokens, database URLs, and personal data. Detection runs in-process; nothing is uploaded to run a scan.",
    },
    {
      title: "Scan before AI prompt",
      body: "Check exactly what an assistant is about to see and redact sensitive spans before you send them, so credentials do not leave your editor by accident.",
    },
    {
      title: "MCP config review",
      body: "Inspect Model Context Protocol server configs and tool permissions, and flag over-broad or risky tool recommendations before you enable them.",
    },
    {
      title: "Terminal command guard",
      body: "Warn on destructive or exfiltration-prone shell commands (in warn or approval mode) before they run from an AI suggestion.",
    },
    {
      title: "AI Memory Inspector & Access Ledger",
      body: "Keep a local record of what context AI saw during a session so you can review exposure after the fact.",
    },
    {
      title: "Local canaries",
      body: "Generate fake canary secrets, plant them in test files, and verify they never appear in logs, reports, or AI output.",
    },
  ],
  how: [
    {
      step: "Install and open a workspace",
      body: "Add the extension from the VS Code Marketplace. All scanning defaults to local; cloud features are opt-in and disabled in untrusted workspaces.",
    },
    {
      step: "Scan on demand or before a prompt",
      body: "Run a scan of the file, selection, or workspace, or use “Scan Before AI Prompt” to review and redact context first.",
    },
    {
      step: "Redact, approve, or block",
      body: "Redact detected secrets, approve safe context for the session, or block risky context and MCP recommendations.",
    },
    {
      step: "Review the ledger",
      body: "Use the Memory Inspector and Access Ledger to see what AI saw and export a local report.",
    },
  ],
  limitations: [
    "Detection is heuristic and signature-based. It reduces the risk of leaking secrets and PII, but it cannot guarantee that every sensitive value in every format is caught.",
    "The extension inspects context you route through its commands and its optional local broker. It cannot see traffic sent by other extensions that bypass it.",
    "It does not make an AI model itself “safe” — it reduces what sensitive data reaches the model and records exposure.",
    "Redaction is best-effort; always review redacted output before sharing externally.",
  ],
  faqs: [
    {
      q: "Does the extension send my code to a server?",
      a: "No. Secret, PII, prompt-injection, and MCP scanning run locally in the extension host. Cloud connection and remote scan escalation are opt-in, disabled by default, and disabled entirely in untrusted workspaces.",
    },
    {
      q: "Does it work with Copilot, Cursor, and Claude?",
      a: "Yes. The extension is editor-side. It scans and redacts the context you are about to share, and its optional Local AI Broker can sit in front of OpenAI- or Anthropic-compatible endpoints those tools use.",
    },
    {
      q: "Is it free?",
      a: "The extension is free to install and its local scanning works without an account. Team and enterprise policy sync are optional paid cloud features.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "MCP Security", href: "/mcp-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Local AI Broker", href: "/local-ai-broker" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
