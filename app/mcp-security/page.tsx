import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "MCP Security — Review Model Context Protocol Tool Permissions",
  description:
    "Scan Model Context Protocol (MCP) server configs and tool permissions locally. SoterAI IDE Guard flags over-broad tools and risky recommendations before you enable them.",
  path: "/mcp-security",
  keywords: [
    "mcp security",
    "model context protocol security",
    "mcp tool permissions",
    "mcp config scanning",
  ],
});

const data: FeatureLandingData = {
  path: "/mcp-security",
  eyebrow: "MCP Security",
  h1: "Review MCP tool permissions before you trust them",
  productName: "SoterAI MCP Security",
  intro:
    "The Model Context Protocol (MCP) lets AI agents call external tools — file systems, shells, databases, and web services. That power is also the risk: a single over-permissioned or malicious tool can exfiltrate data or run destructive actions. SoterAI IDE Guard scans your MCP configs locally, surfaces what each tool can actually do, and flags risky recommendations before you enable them.",
  features: [
    {
      title: "Scan MCP configs",
      body: "Detect MCP server definitions in your workspace and review them in one place instead of trusting them blind.",
    },
    {
      title: "Show tool permissions",
      body: "Surface the capabilities each MCP tool requests — file access, shell execution, network — so scope is explicit.",
    },
    {
      title: "Block risky recommendations",
      body: "Flag and block over-broad or suspicious MCP tool recommendations before they are added to your setup.",
    },
    {
      title: "Generate a safe MCP policy",
      body: "Produce a starting policy that constrains MCP tools to least-privilege defaults you can adjust.",
    },
  ],
  how: [
    {
      step: "Scan the workspace",
      body: "Run “Scan MCP Configs” to find MCP server definitions and tool declarations.",
    },
    {
      step: "Review permissions",
      body: "Inspect what each tool can do and identify anything broader than the task requires.",
    },
    {
      step: "Block or constrain",
      body: "Block risky recommendations and generate a safe baseline policy for the tools you keep.",
    },
    {
      step: "Re-scan on change",
      body: "Re-run the scan whenever configs change or a new tool is proposed.",
    },
  ],
  limitations: [
    "The scanner reasons about declared configuration and permissions. It cannot fully predict a tool’s runtime behavior or catch a tool that misrepresents itself.",
    "It reviews MCP configs it can see in the workspace; tools configured entirely outside the workspace may not be visible.",
    "Flagging is based on heuristics for known risky patterns; novel abuse patterns may not be recognized.",
    "It reduces MCP risk but is not a replacement for running untrusted tools in an isolated environment.",
  ],
  faqs: [
    {
      q: "What is MCP and why does it need securing?",
      a: "The Model Context Protocol lets AI agents invoke external tools. Because those tools can touch files, shells, and networks, an over-permissioned or malicious tool is a real exfiltration and execution risk — so reviewing permissions before enabling matters.",
    },
    {
      q: "Does scanning send my config anywhere?",
      a: "No. MCP scanning runs locally in the extension. Cloud features are opt-in and disabled in untrusted workspaces.",
    },
    {
      q: "Can it stop a malicious MCP tool?",
      a: "It can flag over-broad permissions and known risky patterns and help you block or constrain them. It cannot guarantee a tool is safe at runtime, which is why least privilege and isolation still matter.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "VS Code AI Security", href: "/vscode-ai-security" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
