import { db } from "@/lib/db";
import type { EmergencyLockdownPolicy, ExtensionOrgPolicy } from "@/packages/policy-engine/src/types";

export const LOCKDOWN_BLOCKED_DATA_TYPES = [
  "env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password",
  "customer_data", "hr_salary", "financial_text", "legal_contract",
];

export function lockdownPolicy(state?: { enabled: boolean; policyVersion: number; reason: string | null; enabledAt: Date | null } | null): EmergencyLockdownPolicy {
  return {
    enabled: state?.enabled ?? false,
    policyVersion: state?.policyVersion ?? 1,
    reason: state?.reason ?? null,
    enabledAt: state?.enabledAt?.toISOString() ?? null,
    blockUnknownDestinations: true,
    blockAllFileUploads: true,
    blockedDataTypes: LOCKDOWN_BLOCKED_DATA_TYPES,
    requireApprovalDataTypes: ["source_code"],
    allowOnlyEnterpriseDestinations: true,
  };
}

export function applyEmergencyLockdown(
  policy: ExtensionOrgPolicy,
  state?: { enabled: boolean; policyVersion: number; reason: string | null; enabledAt: Date | null } | null,
): ExtensionOrgPolicy {
  const emergencyLockdown = lockdownPolicy(state);
  return {
    ...policy,
    version: `${policy.version}-emergency-${emergencyLockdown.policyVersion}`,
    emergencyLockdown,
  };
}

export async function getEmergencyLockdown(organizationId: string, database: typeof db = db) {
  const state = await database.emergencyLockdownState.findUnique({ where: { organizationId } });
  return state ?? {
    id: null, organizationId, enabled: false, enabledByAdminId: null, enabledAt: null,
    disabledByAdminId: null, disabledAt: null, reason: null, policyVersion: 1,
    createdAt: null, updatedAt: null,
  };
}

export async function setEmergencyLockdown(input: { organizationId: string; enabled: boolean; adminId: string; reason?: string }, database: typeof db = db) {
  const now = new Date();
  return database.$transaction(async (tx) => {
    const state = await tx.emergencyLockdownState.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId, enabled: input.enabled, reason: input.reason,
        policyVersion: 2,
        ...(input.enabled ? { enabledByAdminId: input.adminId, enabledAt: now } : { disabledByAdminId: input.adminId, disabledAt: now }),
      },
      update: {
        enabled: input.enabled, reason: input.reason, policyVersion: { increment: 1 },
        ...(input.enabled
          ? { enabledByAdminId: input.adminId, enabledAt: now }
          : { disabledByAdminId: input.adminId, disabledAt: now }),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: input.adminId,
        organizationId: input.organizationId,
        action: input.enabled ? "emergency_lockdown_enabled" : "emergency_lockdown_disabled",
        targetType: "emergency_lockdown_state",
        targetId: state.id,
        reason: input.reason ?? (input.enabled ? "Emergency lockdown activated" : "Emergency lockdown deactivated"),
        metadata: { enabled: input.enabled, policyVersion: state.policyVersion },
      },
    });
    await tx.securityEvent.create({
      data: {
        organizationId: input.organizationId,
        eventType: input.enabled ? "EMERGENCY_LOCKDOWN_ENABLED" : "EMERGENCY_LOCKDOWN_DISABLED",
        severity: input.enabled ? "CRITICAL" : "HIGH",
        riskTypes: [], action: input.enabled ? "LOCKDOWN" : "NORMAL",
        source: "api.admin.emergency-lockdown",
        metadata: { adminUserId: input.adminId, policyVersion: state.policyVersion, reason: input.reason ?? null },
      },
    });
    return state;
  });
}
