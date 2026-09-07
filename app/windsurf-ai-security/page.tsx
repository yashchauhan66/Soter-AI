import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Windsurf Security Risks and Safe AI Coding",
  description:
    "Understand Windsurf security risks and scan code locally for secrets, prompt injection, unsafe MCP permissions, and risky commands before AI reads it.",
  path: "/windsurf-ai-security",
  keywords: [
    "windsurf ai security",
    "windsurf security extension",
    "windsurf secret scanning",
    "windsurf prompt injection",
    "windsurf mcp security",
    "codeium security",
    "windsurf ide guard",
    "protect secrets windsurf ai",
    "windsurf security risks",
    "is windsurf safe",
    "secure windsurf ai usage",
  ],
});

const data: FeatureLandingData = {
  path: "/windsurf-ai-security",
  eyebrow: "Windsurf Security",
  h1: "Windsurf security: reduce secret, prompt injection, and MCP risks",
  productName: "SoterAI IDE Guard for Windsurf",
  intro:
    "Windsurf (by Codeium) is an agentic AI IDE that reads your project context deeply to power Cascade and other AI features. That deep context access means secrets, credentials, and personal data can silently end up in AI prompts. SoterAI IDE Guard runs locally in VS Code-compatible editors including Windsurf, scanning your workspace for secrets, PII, prompt injection, and risky MCP configurations before they reach the AI model.",
  features: [
    {
      title: "Local secret and PII scanning",
      body: "Scan your open files, selections, and workspace for API keys, tokens, database connection strings, Aadhaar patterns, PAN, and other sensitive data — all on your machine before Windsurf AI reads it.",
    },
    {
      title: "Scan before Cascade or AI prompts",
      body: "Use 'Scan Before AI Prompt' to inspect and redact your context before sending it to Windsurf's Cascade agent or any AI command, so sensitive content never reaches the model.",
    },
    {
      title: "MCP config security for Windsurf",
      body: "Windsurf supports MCP tools via its agent mode. SoterAI IDE Guard scans MCP server configurations in your workspace and flags tools with over-broad permissions before you enable them.",
    },
    {
      title: "Prompt injection detection",
      body: "Catch injected instructions in files, dependency metadata, or pasted content before they enter a Windsurf AI command — including obfuscation techniques like invisible unicode characters.",
    },
    {
      title: "AI Memory Inspector",
      body: "Maintain a local ledger of what Windsurf AI was given access to during a session so you can review and audit exposure without uploading anything.",
    },
    {
      title: "Terminal command guard",
      body: "Flag destructive or risky shell commands suggested by Windsurf's terminal AI before they execute — covering commands like rm -rf, curl with data upload, or environment variable exfiltration patterns.",
    },
  ],
  how: [
    {
      step: "Install SoterAI IDE Guard",
      body: "Windsurf is built on VS Code's extension platform. Install SoterAI IDE Guard from the VS Code Marketplace or the Open VSX Registry directly within Windsurf.",
    },
    {
      step: "Open your Windsurf project",
      body: "The extension activates in your Windsurf workspace automatically. Local scanning is on by default — cloud features are opt-in only.",
    },
    {
      step: "Scan before running Cascade",
      body: "Before using Windsurf's Cascade agent on sensitive code, run 'Scan Before AI Prompt' from the Command Palette to surface any secrets or injection text in the context.",
    },
    {
      step: "Redact and review",
      body: "Redact detected sensitive spans in the scan results panel. Your original files are unchanged; only the context you choose to share is modified.",
    },
  ],
  contentSections: [
    {
      title: "Windsurf security risks to review",
      intro:
        "Windsurf can be used safely for many coding tasks, but agentic access creates risks that depend on the files, tools, permissions, and commands in scope. Review these boundaries before giving an AI agent access to a sensitive repository.",
      items: [
        {
          title: "Secrets included in AI context",
          body: "Open files, selections, terminal output, and nearby project context can contain API keys, tokens, database URLs, or customer data. Scan and redact context before sharing it.",
        },
        {
          title: "Indirect prompt injection",
          body: "Repository files, documentation, pasted snippets, and tool output can contain instructions designed to steer an agent away from the developer's intended task.",
        },
        {
          title: "Over-permissioned MCP tools",
          body: "An MCP server with broad filesystem, shell, or network access can expose more data or execute more actions than the current task requires. Use least-privilege scopes.",
        },
        {
          title: "Risky terminal commands",
          body: "Agent-suggested commands can delete files, upload data, change dependencies, or expose environment variables. Review high-impact commands before execution.",
        },
      ],
    },
    {
      title: "How to use Windsurf more safely",
      intro:
        "No extension can make every internal AI action safe. A practical setup combines local scanning with repository hygiene, narrow tool permissions, command review, and provider-level data controls.",
      items: [
        {
          title: "Keep real secrets out of project context",
          body: "Prefer placeholder-only .env.example files, avoid opening production credentials, and rotate any credential that may already have been shared with an AI provider.",
        },
        {
          title: "Scan before Cascade reads context",
          body: "Use SoterAI's Scan Before AI Prompt command for the file or selection you intend to share, then review every redaction before continuing.",
        },
        {
          title: "Constrain tools and networks",
          body: "Grant MCP servers only the directories, commands, and destinations needed for the task. Isolate untrusted tools rather than relying on declarations alone.",
        },
        {
          title: "Review what crossed the boundary",
          body: "Keep an access ledger and audit sensitive sessions so a suspected exposure can be investigated and affected credentials can be rotated quickly.",
        },
      ],
    },
  ],
  limitations: [
    "SoterAI IDE Guard uses the VS Code extension API. It works in Windsurf but cannot intercept Windsurf-internal AI calls that bypass the extension host entirely.",
    "Windsurf's Cascade agent may read context outside the current file. SoterAI's 'Scan Before AI Prompt' covers context you explicitly route through it.",
    "Detection is heuristic and reduces risk meaningfully but cannot guarantee 100% coverage of every sensitive data format.",
    "MCP scanning is limited to tool configurations visible in the current workspace directory.",
  ],
  faqs: [
    {
      q: "Is Windsurf safe to use?",
      a: "Windsurf can be used with appropriate controls, but no agentic IDE is risk-free. Safety depends on what code and credentials it can read, which MCP tools it can call, provider data settings, and whether commands are reviewed. Keep secrets out of context, restrict tool permissions, and scan sensitive content before sharing it.",
    },
    {
      q: "What are the main Windsurf security risks?",
      a: "The main risks are accidental secret or PII exposure through project context, indirect prompt injection hidden in files or tool output, over-permissioned MCP servers, and destructive or exfiltration-prone terminal commands.",
    },
    {
      q: "Does SoterAI IDE Guard work in Windsurf?",
      a: "Yes. Windsurf (by Codeium) is built on VS Code's extension API. SoterAI IDE Guard installs and runs in Windsurf from the VS Code Marketplace or Open VSX Registry.",
    },
    {
      q: "Can I use it with Windsurf's Cascade agent?",
      a: "Yes. Use the 'Scan Before AI Prompt' command to review your context before running Cascade. This surfaces secrets and injection text before the agent processes your request.",
    },
    {
      q: "Does scanning upload my code anywhere?",
      a: "No. All secret, PII, and prompt-injection scanning runs locally in the extension host. Nothing leaves your machine without your explicit opt-in.",
    },
    {
      q: "Does it work with Windsurf's MCP tool support?",
      a: "Yes. SoterAI IDE Guard's MCP scanner works with any MCP configuration file present in your workspace, including those created for Windsurf's agent tools.",
    },
  ],
  related: [
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Cursor AI Security", href: "/cursor-ai-security" },
    { label: "MCP Security", href: "/mcp-security" },
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
