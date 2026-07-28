import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Agent Security — Protect Autonomous Agents from Exploitation",
  description:
    "Secure AI agents against prompt injection, tool abuse, data exfiltration, and privilege escalation. SoterAI Guard provides agent firewall, MCP security, and runtime enforcement.",
  path: "/ai-agent-security",
  keywords: [
    "ai agent security",
    "ai agent firewall",
    "agent security platform",
    "autonomous agent protection",
    "ai agent tool permissions",
    "ai agent runtime security",
    "agent supply chain security",
    "ai agent monitoring",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-agent-security",
  eyebrow: "AI Agent Security",
  h1: "Secure autonomous agents at runtime",
  productName: "SoterAI Agent Security",
  intro:
    "AI agents can call tools, access data, execute code, and make decisions autonomously — making them powerful but risky. A compromised agent can exfiltrate data, abuse tool permissions, or execute unintended actions. SoterAI Guard provides runtime agent security: an agent firewall that authorizes every tool call, MCP security scanning, passport-based identity, privileged escalation controls, and a complete audit trail of agent actions.",
  features: [
    {
      title: "Agent firewall",
      body: "Authorize, block, or escrow every tool call an agent makes. Prevent unauthorized actions before they execute.",
    },
    {
      title: "MCP security scanning",
      body: "Scan Model Context Protocol configs for over-broad tool permissions, risky recommendations, and malicious tool definitions.",
    },
    {
      title: "Agent passport & identity",
      body: "Assign cryptographically verified identities to agents. Enforce what each agent is permitted to do based on its passport.",
    },
    {
      title: "Privileged escalation controls",
      body: "Detect and block agents attempting to escalate their own permissions, modify security policies, or access forbidden tools.",
    },
    {
      title: "Runtime audit trail",
      body: "Record every agent action — tool calls, data access, decisions — in an HMAC-signed audit log for SIEM and compliance.",
    },
    {
      title: "Agent supply chain security",
      body: "Scan agent definitions, dependencies, and MCP configurations for known vulnerabilities before deployment.",
    },
  ],
  how: [
    {
      step: "Connect your agent framework",
      body: "Integrate SoterAI Guard with any agent framework — LangChain, CrewAI, AutoGen, or custom agents via the SDK.",
    },
    {
      step: "Define agent policies",
      body: "Set guardrails for each agent: allowed tools, data access scope, approval requirements for high-risk actions.",
    },
    {
      step: "Runtime enforcement",
      body: "Every tool call and data access is evaluated against policy in real time. Risky actions are blocked or sent for approval.",
    },
    {
      step: "Monitor and audit",
      body: "Review agent activity in the dashboard, export signed audit logs, and tune policies based on observed behavior.",
    },
  ],
  limitations: [
    "Agent security policies reduce risk but cannot guarantee an agent will never be compromised. Defense in depth is essential.",
    "The agent firewall covers tool calls routed through SoterAI. Agents operating entirely outside the security boundary are not visible.",
    "Passport-based identity is only as secure as the key management backing it. Protect private keys used for agent identity.",
    "Runtime enforcement adds latency to tool calls (typically under 50ms for policy evaluation).",
  ],
  faqs: [
    {
      q: "What types of agents does SoterAI support?",
      a: "SoterAI Guard works with any agent framework that can route tool calls through our SDK or API: LangChain, CrewAI, AutoGen, Semantic Kernel, custom agents, and MCP-compatible tools.",
    },
    {
      q: "Can SoterAI stop an agent from exfiltrating data?",
      a: "Yes. The agent firewall evaluates every tool call against policy. If an agent attempts to read a sensitive file, call an external API, or send data outside the allowed scope, the action is blocked before execution.",
    },
    {
      q: "Does it work with open-source agents?",
      a: "Yes. Our SDK works with any HTTP-capable agent. MCP scanning works with any MCP server configuration.",
    },
    {
      q: "Is agent identity forgeable?",
      a: "Agent passports use cryptographic signatures. As long as the signing key is protected, an attacker cannot forge a passport to impersonate a trusted agent.",
    },
  ],
  related: [
    { label: "MCP Security", href: "/mcp-security" },
    { label: "AI Workflow Security", href: "/ai-workflow-security" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
