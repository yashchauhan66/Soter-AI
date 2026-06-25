/**
 * Feature Flags — Open-Core Model
 *
 * Defines which features are available per plan.
 * Core guard features are FREE for all (including self-hosted).
 * Advanced features require a paid plan or SaaS subscription.
 *
 * Usage:
 *   import { FEATURES, canAccess } from "@/lib/featureFlags";
 *
 *   if (!canAccess(project.plan, "webhooks")) {
 *     return { error: "Webhooks require a paid plan." };
 *   }
 */

import type { ProjectPlan } from "@prisma/client";

/* ── Feature Definitions ────────────────────────────────── */

export type FeatureId =
  | "guard_input"          // Input guard (prompt injection, jailbreak)
  | "guard_output"         // Output guard (unsafe content)
  | "pii_redaction"        // PII + India PII redaction
  | "secrets_detection"    // API key / credential detection
  | "guard_logs"           // Basic guard audit logs
  | "playground"           // Public playground access
  | "dashboard"            // Basic dashboard
  | "api_keys"             // API key management
  | "webhooks"             // Webhook delivery
  | "monthly_reports"      // Scheduled monthly PDF reports
  | "rag_security"         // RAG document scanning + quarantine
  | "agent_firewall"       // Agent firewall, passports, tool chain
  | "semantic_egress"      // Semantic egress detection
  | "canary_network"       // Canary tokens for injection detection
  | "red_team_lab"         // Red-team testing lab
  | "team_management"      // Multi-user organization
  | "sso_saml"             // SSO / SAML authentication
  | "scim"                 // SCIM provisioning
  | "audit_exports"        // Compliance audit exports
  | "evidence_vault"       // SOC 2 / ISO 27001 evidence
  | "siem_integration"     // SIEM export integration
  | "high_rate_limits"     // Higher request rate limits
  | "priority_support"     // Priority customer support
  | "white_label"          // White-label reporting (agency)
  | "self_host"            // Self-hosting capability (always free)
  | "cost_firewall"        // Cost/budget controls
  | "retention_policy"     // Custom data retention policies
  | "ip_allowlist"         // IP allowlisting
  ;

/* ── Feature → Plan Mapping ─────────────────────────────── */
/* Each feature lists which plans can access it.             */

export const FEATURE_PLANS: Record<FeatureId, ProjectPlan[]> = {
  /* ── FREE — Core security for everyone ── */
  guard_input:       ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  guard_output:      ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  pii_redaction:     ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  secrets_detection: ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  guard_logs:        ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  playground:        ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  dashboard:         ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  api_keys:          ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],
  self_host:         ["FREE", "STARTER", "PRO", "AGENCY", "ENTERPRISE", "DEMO"],

  /* ── STARTER — Production chatbot traffic ── */
  webhooks:          ["STARTER", "PRO", "AGENCY", "ENTERPRISE"],
  monthly_reports:   ["STARTER", "PRO", "AGENCY", "ENTERPRISE"],
  cost_firewall:     ["STARTER", "PRO", "AGENCY", "ENTERPRISE"],

  /* ── PRO — Team controls & deeper reporting ── */
  rag_security:      ["PRO", "AGENCY", "ENTERPRISE"],
  agent_firewall:    ["PRO", "AGENCY", "ENTERPRISE"],
  semantic_egress:   ["PRO", "AGENCY", "ENTERPRISE"],
  canary_network:    ["PRO", "AGENCY", "ENTERPRISE"],
  red_team_lab:      ["PRO", "AGENCY", "ENTERPRISE"],
  team_management:   ["PRO", "AGENCY", "ENTERPRISE"],
  audit_exports:     ["PRO", "AGENCY", "ENTERPRISE"],
  retention_policy:  ["PRO", "AGENCY", "ENTERPRISE"],
  high_rate_limits:  ["PRO", "AGENCY", "ENTERPRISE"],

  /* ── AGENCY — Multi-client operations ── */
  white_label:       ["AGENCY", "ENTERPRISE"],
  evidence_vault:    ["AGENCY", "ENTERPRISE"],

  /* ── ENTERPRISE — Custom deployment ── */
  sso_saml:          ["ENTERPRISE"],
  scim:              ["ENTERPRISE"],
  siem_integration:  ["ENTERPRISE"],
  ip_allowlist:      ["ENTERPRISE"],
  priority_support:  ["ENTERPRISE"],
};

/* ── Plan Hierarchy (for inheritance) ──────────────────── */

const PLAN_RANK: Record<ProjectPlan, number> = {
  FREE: 0,
  DEMO: 0,
  STARTER: 1,
  PRO: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
};

export function getPlanRank(plan: ProjectPlan): number {
  return PLAN_RANK[plan] ?? 0;
}

/* ── Access Check Functions ─────────────────────────────── */

/**
 * Check if a plan can access a specific feature.
 *
 * @example
 *   if (!canAccess(project.plan, "webhooks")) {
 *     return { error: "Upgrade to Starter for webhooks." };
 *   }
 */
export function canAccess(plan: ProjectPlan, feature: FeatureId): boolean {
  const allowedPlans = FEATURE_PLANS[feature];
  if (!allowedPlans) return false;
  return allowedPlans.includes(plan);
}

/**
 * Get all features available to a given plan.
 */
export function getPlanFeatures(plan: ProjectPlan): FeatureId[] {
  const features: FeatureId[] = [];
  for (const [feature, plans] of Object.entries(FEATURE_PLANS)) {
    if (plans.includes(plan)) {
      features.push(feature as FeatureId);
    }
  }
  return features;
}

/**
 * Get the minimum plan required for a feature.
 * Returns null if the feature is not available to any plan.
 */
export function minPlanForFeature(feature: FeatureId): ProjectPlan | null {
  const plans = FEATURE_PLANS[feature];
  if (!plans || plans.length === 0) return null;
  // Return the lowest-ranked plan (most affordable) that includes this feature
  let minPlan: ProjectPlan = plans[0];
  let minRank = PLAN_RANK[minPlan] ?? 99;
  for (const plan of plans) {
    const rank = PLAN_RANK[plan] ?? 99;
    if (rank < minRank) {
      minRank = rank;
      minPlan = plan;
    }
  }
  return minPlan;
}

/**
 * Get a human-readable message explaining which plan is needed.
 */
export function upgradeMessage(feature: FeatureId): string {
  const minPlan = minPlanForFeature(feature);
  if (!minPlan) return "This feature is not available.";
  if (minPlan === "FREE") return "Available on the Free plan.";
  const planName = minPlan.charAt(0) + minPlan.slice(1).toLowerCase();
  return `${planName} plan required. Upgrade to access this feature.`;
}

/**
 * Get the rate limit multiplier for a given plan.
 * Free: 1x, Starter: 5x, Pro: 20x, Agency: 50x, Enterprise: custom
 */
export function planRateLimitMultiplier(plan: ProjectPlan): number {
  switch (plan) {
    case "FREE":
    case "DEMO":
      return 1;
    case "STARTER":
      return 5;
    case "PRO":
      return 20;
    case "AGENCY":
      return 50;
    case "ENTERPRISE":
      return 100;
    default:
      return 1;
  }
}
