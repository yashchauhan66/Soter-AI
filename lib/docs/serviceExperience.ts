export interface ServiceExperience {
  dashboardHref: string;
  dashboardLabel: string;
}

export const SERVICE_EXPERIENCE: Record<string, ServiceExperience> = {
  "guard-logs": { dashboardHref: "/dashboard/logs", dashboardLabel: "Guard Logs" },
  reports: { dashboardHref: "/dashboard/reports", dashboardLabel: "Reports" },
  "detection-feedback": { dashboardHref: "/dashboard/detection-feedback", dashboardLabel: "Detection Feedback" },
  "customer-success": { dashboardHref: "/dashboard/customer-success", dashboardLabel: "Customer Success" },
  "agent-firewall": { dashboardHref: "/dashboard/agent-firewall", dashboardLabel: "Agent Firewall" },
  "policy-engine": { dashboardHref: "/dashboard/policy", dashboardLabel: "Policy Engine" },
  "rag-security": { dashboardHref: "/dashboard/rag/security", dashboardLabel: "RAG Security" },
  webhooks: { dashboardHref: "/dashboard/webhooks", dashboardLabel: "Webhooks" },
  "shadow-ai": { dashboardHref: "/dashboard/shadow-ai", dashboardLabel: "Shadow AI" },
  "red-team-lab": { dashboardHref: "/dashboard/redteam/lab", dashboardLabel: "Red Team Lab" },
  forensics: { dashboardHref: "/dashboard/forensics", dashboardLabel: "Forensics" },
  "canary-network": { dashboardHref: "/dashboard/canary-network", dashboardLabel: "Canary Network" },
  "semantic-egress": { dashboardHref: "/dashboard/semantic-egress", dashboardLabel: "Semantic Egress" },
  "agent-passports": { dashboardHref: "/dashboard/agent-passports", dashboardLabel: "Agent Passports" },
  "transaction-escrow": { dashboardHref: "/dashboard/escrow", dashboardLabel: "Transaction Escrow" },
  "intent-guard": { dashboardHref: "/dashboard/intent-guard", dashboardLabel: "Intent Guard" },
  "tool-chain": { dashboardHref: "/dashboard/tool-chain", dashboardLabel: "Tool Chain" },
  "dry-run-sandbox": { dashboardHref: "/dashboard/dry-run", dashboardLabel: "Dry Run Sandbox" },
  "memory-firewall": { dashboardHref: "/dashboard/memory-firewall", dashboardLabel: "Memory Firewall" },
  "mcp-drift": { dashboardHref: "/dashboard/mcp-drift", dashboardLabel: "MCP Drift" },
  "legal-boundary": { dashboardHref: "/dashboard/legal-boundary", dashboardLabel: "Legal Boundary" },
  "evidence-vault": { dashboardHref: "/dashboard/evidence-vault", dashboardLabel: "Evidence Vault" },
  "context-lineage": { dashboardHref: "/dashboard/lineage", dashboardLabel: "Context Lineage" },
  "blast-radius": { dashboardHref: "/dashboard/blast-radius", dashboardLabel: "Blast Radius" },
  "credential-vault": { dashboardHref: "/dashboard/credentials", dashboardLabel: "Credential Vault" },
  projects: { dashboardHref: "/dashboard/projects", dashboardLabel: "Projects" },
  "api-keys": { dashboardHref: "/dashboard/api-keys", dashboardLabel: "API Keys" },
  "cost-firewall": { dashboardHref: "/dashboard/cost-firewall", dashboardLabel: "Cost Firewall" },
  "security-badges": { dashboardHref: "/dashboard/badges", dashboardLabel: "Security Badges" },
  billing: { dashboardHref: "/dashboard/billing", dashboardLabel: "Billing" },
  settings: { dashboardHref: "/dashboard/settings", dashboardLabel: "Settings" },
  "audit-exports": { dashboardHref: "/dashboard/exports", dashboardLabel: "Audit Exports" },
  onboarding: { dashboardHref: "/dashboard/onboarding", dashboardLabel: "Onboarding" },
};

export function getServiceExperience(serviceId: string): ServiceExperience {
  return SERVICE_EXPERIENCE[serviceId] ?? {
    dashboardHref: "/dashboard",
    dashboardLabel: "Dashboard",
  };
}