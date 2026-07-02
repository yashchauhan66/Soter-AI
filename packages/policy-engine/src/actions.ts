import type { PolicyAction, PolicySeverity } from "./types";

export const ACTION_PRECEDENCE: Record<PolicyAction, number> = {
  allow: 0,
  log_only: 1,
  warn: 2,
  redact: 3,
  rewrite: 4,
  require_justification: 5,
  require_approval: 6,
  block: 7,
};

export const SEVERITY_PRECEDENCE: Record<PolicySeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function maxAction(actions: PolicyAction[]) {
  return actions.reduce<PolicyAction>((winner, action) => (
    ACTION_PRECEDENCE[action] > ACTION_PRECEDENCE[winner] ? action : winner
  ), "allow");
}

export function maxSeverity(severities: PolicySeverity[]) {
  return severities.reduce<PolicySeverity>((winner, severity) => (
    SEVERITY_PRECEDENCE[severity] > SEVERITY_PRECEDENCE[winner] ? severity : winner
  ), "info");
}
