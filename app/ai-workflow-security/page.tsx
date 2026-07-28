import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "AI Workflow Security — Protect n8n, Zapier, Make and AI Automations",
  description:
    "Secure AI-powered workflows and automations: n8n, Zapier, Make.com, and custom AI agent pipelines. SoterAI Guard prevents prompt injection, data leakage, and tool abuse in automated AI workflows.",
  path: "/ai-workflow-security",
  keywords: [
    "ai workflow security",
    "ai automation security",
    "n8n ai security",
    "zapier ai security",
    "make.com ai security",
    "ai agent workflow security",
    "secure ai automations",
    "llm workflow security",
  ],
});

const data: FeatureLandingData = {
  path: "/ai-workflow-security",
  eyebrow: "AI Workflow Security",
  h1: "Secure AI-powered automations and workflows",
  productName: "SoterAI Workflow Security",
  intro:
    "AI-powered workflows connect LLMs, tools, and data sources into automated pipelines — creating new attack surfaces. A single compromised step can exfiltrate data, execute unauthorized actions, or cascade failures. SoterAI Guard secures every node in your AI workflow: scanning inputs, authorizing tool calls, monitoring data flow, and providing audit trails for n8n, Zapier, Make.com, and custom agent pipelines.",
  features: [
    {
      title: "Workflow input scanning",
      body: "Scan data entering any workflow step for prompt injection, PII, and malicious content before processing.",
    },
    {
      title: "Tool call authorization",
      body: "Authorize every tool call in your workflow. Block unauthorized API calls, database queries, and file operations.",
    },
    {
      title: "Data flow monitoring",
      body: "Track data as it moves between workflow steps. Detect and block unauthorized data exfiltration.",
    },
    {
      title: "Cascade failure prevention",
      body: "Isolate compromised workflow nodes to prevent attacks from propagating through your pipeline.",
    },
    {
      title: "Workflow audit trail",
      body: "Complete audit log of every workflow execution: inputs, outputs, tool calls, and security decisions.",
    },
  ],
  how: [
    {
      step: "Add SoterAI to your workflow",
      body: "Integrate SoterAI Guard via API or SDK at key decision points in your n8n, Zapier, Make, or custom workflow.",
    },
    {
      step: "Configure per-step policies",
      body: "Set security policies for each workflow node: what data can enter, what tools can be called, what output is allowed.",
    },
    {
      step: "Runtime enforcement",
      body: "Each workflow step is evaluated against policy. Threats are blocked before they propagate to downstream steps.",
    },
    {
      step: "Monitor and audit",
      body: "Review workflow execution logs, identify security events, and tune policies for your automation patterns.",
    },
  ],
  limitations: [
    "Workflow security covers steps routed through SoterAI. Steps operating outside the security boundary are not inspected.",
    "Cascade failure prevention limits propagation but cannot reverse data already exfiltrated before detection.",
    "Per-step policies require initial configuration effort. Pre-built templates are available for common workflow patterns.",
  ],
  faqs: [
    {
      q: "Does SoterAI work with n8n AI nodes?",
      a: "Yes. SoterAI Guard integrates with n8n HTTP Request nodes and AI agent nodes. API-based integration works with any n8n workflow.",
    },
    {
      q: "Can it secure Zapier AI actions?",
      a: "Yes. Zapier AI actions can be routed through SoterAI's API for input scanning and output inspection before and after each action.",
    },
    {
      q: "Does it work with Make.com?",
      a: "Yes. Make.com (formerly Integromat) scenarios can integrate SoterAI via webhook or HTTP module for data inspection.",
    },
    {
      q: "Will it slow down my workflows?",
      a: "SoterAI adds under 100ms per inspection step. For most workflows this is negligible compared to LLM call latency.",
    },
  ],
  related: [
    { label: "AI Agent Security", href: "/ai-agent-security" },
    { label: "MCP Security", href: "/mcp-security" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
