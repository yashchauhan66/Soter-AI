import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "Enterprise AI Security — Platform for Large-Scale AI Deployments",
  description:
    "Enterprise AI security platform with SSO, RBAC, audit logging, self-hosted deployment, and compliance tooling. Protect enterprise LLM applications, AI agents, and RAG pipelines at scale.",
  path: "/enterprise-ai-security",
  keywords: [
    "enterprise ai security",
    "enterprise ai security platform",
    "enterprise llm security",
    "enterprise ai guardrails",
    "enterprise ai compliance",
    "enterprise ai governance",
    "enterprise ai risk management",
    "enterprise ai data protection",
  ],
});

const data: FeatureLandingData = {
  path: "/enterprise-ai-security",
  eyebrow: "Enterprise AI Security",
  h1: "Enterprise-grade AI security at scale",
  productName: "SoterAI Guard Enterprise",
  intro:
    "Enterprises deploying AI at scale need security that matches their compliance, governance, and operational requirements. SoterAI Guard Enterprise provides SSO/SAML, RBAC, audit logging, self-hosted deployment, SOC2/ISO27001 readiness tooling, and multi-tenant policy management — all while protecting against prompt injection, data leakage, and agent abuse.",
  features: [
    {
      title: "SSO and SAML",
      body: "Integrate with your identity provider via SAML 2.0, OIDC, or SCIM. Enforce enterprise authentication policies.",
    },
    {
      title: "RBAC and team management",
      body: "Define roles, permissions, and teams. Audit every action with user-level granularity.",
    },
    {
      title: "Self-hosted deployment",
      body: "Deploy in your own VPC, on-premises, or on any cloud. Full data sovereignty and network isolation.",
    },
    {
      title: "Audit and compliance",
      body: "HMAC-signed audit logs for every AI interaction. Export to SIEM for SOC2, ISO 27001, and SOX compliance.",
    },
    {
      title: "Multi-tenant policy management",
      body: "Define global security policies and per-team overrides. Centrally manage AI security across the organization.",
    },
    {
      title: "Usage controls and budgets",
      body: "Set per-team or per-project usage limits, cost controls, and rate limiting for LLM API consumption.",
    },
  ],
  how: [
    {
      step: "Configure enterprise SSO",
      body: "Connect your identity provider via SAML 2.0 or OIDC. Provision users automatically via SCIM.",
    },
    {
      step: "Define security policies",
      body: "Set organization-wide AI security policies and per-team exceptions. Choose enforcement modes per policy.",
    },
    {
      step: "Deploy in your environment",
      body: "Deploy SoterAI Guard in your VPC, on-premises, or hybrid. Data never leaves your infrastructure.",
    },
    {
      step: "Monitor and audit",
      body: "Central dashboard for AI security events across all teams. Export signed audit logs to your SIEM.",
    },
  ],
  limitations: [
    "Enterprise features require a paid plan. SSO, RBAC, and audit logging are not available on the free tier.",
    "Self-hosted deployment requires Docker and operational expertise. SoterAI provides deployment guides and support.",
    "Audit logs are tamper-evident but not tamper-proof. Protect the signing key used for HMAC signatures.",
  ],
  faqs: [
    {
      q: "What identity providers do you support?",
      a: "SoterAI Guard supports SAML 2.0, OIDC, and SCIM for provisioning. Works with Okta, Azure AD, Google Workspace, and any SAML-compatible IdP.",
    },
    {
      q: "Can I deploy SoterAI in my own cloud?",
      a: "Yes. SoterAI Guard Enterprise includes self-hosted deployment on AWS, Azure, GCP, or on-premises infrastructure.",
    },
    {
      q: "What compliance standards do you support?",
      a: "SoterAI provides tooling for SOC2, ISO 27001, and SOX compliance — audit logs, RBAC, data retention controls. Full certification is your organization's responsibility.",
    },
    {
      q: "Is there a volume discount for enterprise plans?",
      a: "Yes. Enterprise plans include volume pricing. Contact our sales team for a custom quote based on your usage patterns.",
    },
  ],
  related: [
    { label: "AI Security Platform", href: "/llm-security" },
    { label: "AI Agent Security", href: "/ai-agent-security" },
    { label: "AI Security India", href: "/ai-security-india" },
    { label: "Contact Sales", href: "/contact-sales" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
