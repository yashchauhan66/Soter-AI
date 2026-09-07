import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "MCP Security: Permissions and Access Control",
  description:
    "Review MCP security, permissions, access control, and tool risks. Scan Model Context Protocol configs locally and create least-privilege policies.",
  path: "/mcp-security",
  keywords: [
    "mcp security",
    "model context protocol security",
    "mcp tool permissions",
    "mcp config scanning",
    "mcp access control",
    "mcp security scanner",
    "mcp security tools",
    "mcp protection",
  ],
});

const data: FeatureLandingData = {
  path: "/mcp-security",
  eyebrow: "MCP Security",
  h1: "MCP security for tool permissions, access control, and config scanning",
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
  contentSections: [
    {
      title: "MCP permissions and access-control checklist",
      intro:
        "Secure MCP deployments treat every server and tool as a separate trust boundary. A config scanner can expose declared capabilities, but enforcement should also exist at runtime and outside the model.",
      items: [
        {
          title: "Filesystem permissions",
          body: "Allow only required directories and operations. Separate read from write access, block credential locations, and avoid granting an entire home directory when one project folder is enough.",
        },
        {
          title: "Shell and process execution",
          body: "Use command allowlists, argument validation, timeouts, and isolation. Treat arbitrary shell execution as high risk even when a tool description sounds harmless.",
        },
        {
          title: "Network and credential access",
          body: "Restrict outbound destinations and inject short-lived, scoped credentials at execution time. Do not place reusable production tokens directly in an MCP config.",
        },
        {
          title: "Human approval for high-impact tools",
          body: "Require review before payments, deletes, deployments, external messages, permission changes, or other irreversible actions. The model should not approve its own request.",
        },
      ],
    },
    {
      title: "What an MCP security scanner can and cannot verify",
      intro:
        "An MCP security scanner is useful for inventory and pre-deployment review, but static configuration is not proof of safe runtime behavior. Combine scanning with isolation, identity, authorization, logging, and continuous review.",
      items: [
        {
          title: "Can verify declared configuration",
          body: "A scanner can locate server definitions, exposed commands, environment variables, broad path scopes, suspicious arguments, and known risky permission combinations.",
        },
        {
          title: "Cannot prove implementation honesty",
          body: "A malicious or compromised server can behave differently from its name or declared purpose. Test untrusted servers in an isolated environment with synthetic data.",
        },
        {
          title: "Can support least privilege",
          body: "Review findings can become a baseline policy that limits tools, paths, commands, destinations, and approval requirements to the current use case.",
        },
        {
          title: "Cannot replace runtime controls",
          body: "Permissions can drift and tool behavior can change. Re-scan after updates and enforce authorization, network boundaries, audit logs, and revocation during execution.",
        },
      ],
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
      q: "What is MCP security?",
      a: "MCP security is the set of controls used to limit how Model Context Protocol servers and tools access files, commands, networks, credentials, and external systems. It includes config scanning, least-privilege permissions, isolation, runtime authorization, approval, logging, and revocation.",
    },
    {
      q: "How should MCP access control work?",
      a: "Authorize each tool for a specific identity, resource, action, and time window. Keep filesystem, shell, network, and credential scopes narrow; require human approval for high-impact actions; and enforce the decision outside the language model.",
    },
    {
      q: "What does an MCP security scanner check?",
      a: "A scanner reviews visible MCP server configs for declared tools, broad filesystem or shell access, exposed credentials, risky arguments, network access, and permission combinations. It cannot prove that a server's runtime implementation is safe.",
    },
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
