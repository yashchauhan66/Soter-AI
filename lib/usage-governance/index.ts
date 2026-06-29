// SECURITY: AI Usage Governance for Companies
// Provides company-wide policies to govern AI tool usage across departments,
// track employee usage, enforce data classification rules, and generate
// compliance reports.
//
// This library integrates with:
//   - Shadow AI Scanner (lib/shadow-ai) for provider discovery
//   - Organization model for tenant isolation
//   - AiProvider/AiModel models for provider inventory

import { db } from "../db";

// ── Types ────────────────────────────────────────────────────────────────────

export type GovernanceAction = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" | "MONITOR_ONLY";
export type DataSensitivity = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PII" | "FINANCIAL" | "HEALTH";
export type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";

export interface GovernanceRuleInput {
  providerName: string;
  modelPattern?: string;
  action: GovernanceAction;
  priority?: number;
  reason?: string;
}

export interface DepartmentInput {
  name: string;
  description?: string;
  defaultAction?: GovernanceAction;
  memberUserIds?: string[];
  rules?: GovernanceRuleInput[];
}

export interface DataClassificationInput {
  sensitivityLevel: DataSensitivity;
  providerName: string;
  allowedActions: GovernanceAction[];
  requiresApproval?: boolean;
  description?: string;
}

export interface ApprovalRequestInput {
  providerName: string;
  modelName?: string;
  useCase: string;
  justification?: string;
  dataSensitivity?: DataSensitivity;
}

export interface GovernanceSummary {
  policyCount: number;
  totalRules: number;
  totalDepartments: number;
  pendingApprovals: number;
  blockedEvents: number;
  allowedEvents: number;
  complianceScore: number;
  topProviders: Array<{ name: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

// ── Policy CRUD ──────────────────────────────────────────────────────────────

export async function getOrCreatePolicy(organizationId: string) {
  let policy = await db.aiUsageGovernancePolicy.findFirst({
    where: { organizationId, enabled: true },
    include: {
      rules: true,
      departments: { include: { rules: true } },
      dataClassifications: true,
    },
  });
  if (!policy) {
    policy = await db.aiUsageGovernancePolicy.create({
      data: {
        organizationId,
        name: "Default AI Usage Governance Policy",
        description: "Auto-created default policy for governing AI tool usage across the company.",
      },
      include: {
        rules: true,
        departments: { include: { rules: true } },
        dataClassifications: true,
      },
    });
  }
  return policy;
}

export async function updatePolicy(
  organizationId: string,
  data: {
    name?: string;
    description?: string;
    enabled?: boolean;
    defaultAction?: GovernanceAction;
    requireApprovalForNew?: boolean;
    notifyOnBlocked?: boolean;
    notifyOnApprovalRequest?: boolean;
    restrictedDataAction?: GovernanceAction;
    piiDataAction?: GovernanceAction;
    employeeMonitoringEnabled?: boolean;
    auditRetentionDays?: number;
  },
) {
  const policy = await getOrCreatePolicy(organizationId);
  const updated = await db.aiUsageGovernancePolicy.update({
    where: { id: policy.id },
    data,
    include: {
      rules: true,
      departments: { include: { rules: true } },
      dataClassifications: true,
    },
  });
  await recordGovernanceAudit(organizationId, null, "POLICY_CHANGE", "MODIFIED", "Governance policy updated");
  return updated;
}

// ── Provider Rules ───────────────────────────────────────────────────────────

export async function addProviderRule(organizationId: string, input: GovernanceRuleInput) {
  const policy = await getOrCreatePolicy(organizationId);
  const rule = await db.aiUsageGovernanceRule.create({
    data: {
      policyId: policy.id,
      providerName: input.providerName,
      modelPattern: input.modelPattern ?? null,
      action: input.action as any,
      priority: input.priority ?? 0,
      reason: input.reason ?? null,
    },
  });
  await recordGovernanceAudit(organizationId, null, "RULE_ADDED", input.action, `Rule added for ${input.providerName}`);
  return rule;
}

export async function updateProviderRule(ruleId: string, input: Partial<GovernanceRuleInput>) {
  const rule = await db.aiUsageGovernanceRule.update({
    where: { id: ruleId },
    data: {
      ...(input.action && { action: input.action as any }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.reason && { reason: input.reason }),
      ...(input.modelPattern !== undefined && { modelPattern: input.modelPattern }),
    },
  });
  return rule;
}

export async function removeProviderRule(ruleId: string) {
  await db.aiUsageGovernanceRule.delete({ where: { id: ruleId } });
}

export async function listProviderRules(organizationId: string) {
  const policy = await getOrCreatePolicy(organizationId);
  return db.aiUsageGovernanceRule.findMany({
    where: { policyId: policy.id },
    orderBy: [{ priority: "desc" }, { providerName: "asc" }],
  });
}

// ── Department Rules ─────────────────────────────────────────────────────────

export async function addDepartment(organizationId: string, input: DepartmentInput) {
  const policy = await getOrCreatePolicy(organizationId);
  const dept = await db.aiUsageGovernanceDepartment.create({
    data: {
      policyId: policy.id,
      name: input.name,
      description: input.description ?? null,
      defaultAction: (input.defaultAction ?? "MONITOR_ONLY") as any,
      memberUserIds: input.memberUserIds ?? [],
      rules: input.rules?.length
        ? {
            create: input.rules.map((r) => ({
              providerName: r.providerName,
              modelPattern: r.modelPattern ?? null,
              action: r.action as any,
              reason: r.reason ?? null,
            })),
          }
        : undefined,
    },
    include: { rules: true },
  });
  await recordGovernanceAudit(organizationId, null, "DEPARTMENT_ADDED", "MODIFIED", `Department "${input.name}" added`);
  return dept;
}

export async function updateDepartment(
  departmentId: string,
  input: Partial<DepartmentInput>,
) {
  const dept = await db.aiUsageGovernanceDepartment.update({
    where: { id: departmentId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.defaultAction && { defaultAction: input.defaultAction as any }),
      ...(input.memberUserIds && { memberUserIds: input.memberUserIds }),
    },
    include: { rules: true },
  });
  return dept;
}

export async function removeDepartment(departmentId: string) {
  await db.aiUsageGovernanceDepartment.delete({ where: { id: departmentId } });
}

export async function listDepartments(organizationId: string) {
  const policy = await getOrCreatePolicy(organizationId);
  return db.aiUsageGovernanceDepartment.findMany({
    where: { policyId: policy.id },
    include: { rules: true },
    orderBy: { name: "asc" },
  });
}

export async function addDepartmentRule(departmentId: string, input: GovernanceRuleInput) {
  return db.aiUsageGovernanceDepartmentRule.create({
    data: {
      departmentId,
      providerName: input.providerName,
      modelPattern: input.modelPattern ?? null,
      action: input.action as any,
      reason: input.reason ?? null,
    },
  });
}

export async function removeDepartmentRule(ruleId: string) {
  await db.aiUsageGovernanceDepartmentRule.delete({ where: { id: ruleId } });
}

// ── Data Classification ──────────────────────────────────────────────────────

export async function addDataClassification(organizationId: string, input: DataClassificationInput) {
  const policy = await getOrCreatePolicy(organizationId);
  const classification = await db.aiUsageGovernanceDataClassification.create({
    data: {
      policyId: policy.id,
      sensitivityLevel: input.sensitivityLevel as any,
      providerName: input.providerName,
      allowedActions: input.allowedActions as any,
      requiresApproval: input.requiresApproval ?? true,
      description: input.description ?? null,
    },
  });
  await recordGovernanceAudit(
    organizationId,
    null,
    "DATA_CLASSIFICATION_ADDED",
    "MODIFIED",
    `Data classification for ${input.sensitivityLevel} → ${input.providerName}`,
  );
  return classification;
}

export async function listDataClassifications(organizationId: string) {
  const policy = await getOrCreatePolicy(organizationId);
  return db.aiUsageGovernanceDataClassification.findMany({
    where: { policyId: policy.id },
    orderBy: [{ sensitivityLevel: "asc" }, { providerName: "asc" }],
  });
}

export async function removeDataClassification(id: string) {
  await db.aiUsageGovernanceDataClassification.delete({ where: { id } });
}

// ── Approval Workflow ────────────────────────────────────────────────────────

export async function createApprovalRequest(
  organizationId: string,
  requestedById: string,
  input: ApprovalRequestInput,
) {
  const request = await db.aiUsageApprovalRequest.create({
    data: {
      organizationId,
      requestedById,
      providerName: input.providerName,
      modelName: input.modelName ?? null,
      useCase: input.useCase,
      justification: input.justification ?? null,
      dataSensitivity: input.dataSensitivity as any ?? null,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });
  await recordGovernanceAudit(organizationId, requestedById, "APPROVAL_REQUESTED", "PENDING", `Approval requested for ${input.providerName}`);
  return request;
}

export async function reviewApprovalRequest(
  requestId: string,
  reviewedById: string,
  status: "APPROVED" | "DENIED",
  decisionReason?: string,
) {
  const request = await db.aiUsageApprovalRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewedById,
      decisionReason: decisionReason ?? null,
      reviewedAt: new Date(),
    },
  });
  await recordGovernanceAudit(
    request.organizationId,
    reviewedById,
    status === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_DENIED",
    status,
    `Approval request ${status} for ${request.providerName}: ${decisionReason ?? "No reason given"}`,
  );
  return request;
}

export async function listApprovalRequests(organizationId: string, status?: ApprovalStatus) {
  const where: any = { organizationId };
  if (status) where.status = status;
  return db.aiUsageApprovalRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
  });
}

// ── Audit Log ────────────────────────────────────────────────────────────────

async function recordGovernanceAudit(
  organizationId: string,
  userId: string | null,
  action: string,
  decision: string,
  reason?: string,
) {
  try {
    await db.aiUsageGovernanceAuditLog.create({
      data: {
        organizationId,
        userId,
        action,
        decision,
        reason: reason ?? null,
        contextRedacted: null,
      },
    });
  } catch (error) {
    console.error("[SoterAI] Failed to record governance audit log:", error);
  }
}

export async function logAiUsageEvent(
  organizationId: string,
  userId: string | null,
  providerName: string,
  modelName: string | null,
  decision: string,
  reason: string,
  contextRedacted?: string,
) {
  await db.aiUsageGovernanceAuditLog.create({
    data: {
      organizationId,
      userId,
      providerName,
      modelName,
      action: "USAGE_EVENT",
      decision,
      reason,
      contextRedacted,
    },
  });
}

export async function queryAuditLogs(
  organizationId: string,
  options?: {
    userId?: string;
    action?: string;
    decision?: string;
    providerName?: string;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  },
) {
  const where: any = { organizationId };
  if (options?.userId) where.userId = options.userId;
  if (options?.action) where.action = options.action;
  if (options?.decision) where.decision = options.decision;
  if (options?.providerName) where.providerName = options.providerName;
  if (options?.fromDate || options?.toDate) {
    where.createdAt = {};
    if (options?.fromDate) where.createdAt.gte = options.fromDate;
    if (options?.toDate) where.createdAt.lte = options.toDate;
  }

  const [logs, total] = await Promise.all([
    db.aiUsageGovernanceAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    }),
    db.aiUsageGovernanceAuditLog.count({ where }),
  ]);

  return { logs, total };
}

// ── Governance Engine ────────────────────────────────────────────────────────

export interface GovernanceDecision {
  allowed: boolean;
  action: GovernanceAction;
  reason: string;
  matchedRule: string | null;
  matchedDepartment: string | null;
  requiresApproval: boolean;
  dataClassificationApplied: string | null;
}

/**
 * Evaluate whether a specific AI provider/model usage is allowed
 * under the organization's governance policy.
 *
 * Resolution order:
 * 1. Department-specific rules (if user belongs to a department)
 * 2. Department default action
 * 3. Policy-level provider rules
 * 4. Policy default action
 * 5. Data classification override
 */
export async function evaluateGovernance(
  organizationId: string,
  providerName: string,
  modelName?: string,
  userId?: string,
  dataSensitivity?: DataSensitivity,
): Promise<GovernanceDecision> {
  const policy = await getOrCreatePolicy(organizationId);
  if (!policy.enabled) {
    return { allowed: true, action: "ALLOW", reason: "Governance policy is disabled", matchedRule: null, matchedDepartment: null, requiresApproval: false, dataClassificationApplied: null };
  }

  // Step 1: Check department-specific rules
  if (userId) {
    const departments = await db.aiUsageGovernanceDepartment.findMany({
      where: { policyId: policy.id, memberUserIds: { has: userId } },
      include: { rules: true },
    });

    for (const dept of departments) {
      // Check department-specific provider rules
      for (const rule of dept.rules) {
        if (rule.providerName === "*" || rule.providerName === providerName) {
          if (!rule.modelPattern || (modelName && modelName.includes(rule.modelPattern))) {
            return {
              allowed: rule.action === "ALLOW",
              action: rule.action as GovernanceAction,
              reason: rule.reason ?? `Department "${dept.name}" policy for ${providerName}`,
              matchedRule: rule.id,
              matchedDepartment: dept.name,
              requiresApproval: rule.action === "REQUIRE_APPROVAL",
              dataClassificationApplied: null,
            };
          }
        }
      }

      // Department default action
      if (dept.defaultAction !== "MONITOR_ONLY") {
        return {
          allowed: dept.defaultAction === "ALLOW",
          action: dept.defaultAction as GovernanceAction,
          reason: `Department "${dept.name}" default policy`,
          matchedRule: null,
          matchedDepartment: dept.name,
          requiresApproval: dept.defaultAction === "REQUIRE_APPROVAL",
          dataClassificationApplied: null,
        };
      }
    }
  }

  // Step 2: Check data classification rules (highest priority for restricted data)
  if (dataSensitivity) {
    const classification = await db.aiUsageGovernanceDataClassification.findFirst({
      where: {
        policyId: policy.id,
        sensitivityLevel: dataSensitivity as any,
        providerName: { in: [providerName, "*"] },
      },
    });
    if (classification) {
      if (classification.requiresApproval && dataSensitivity !== "PUBLIC") {
        return {
          allowed: false,
          action: "REQUIRE_APPROVAL",
          reason: `${dataSensitivity} data requires approval to use ${providerName}`,
          matchedRule: null,
          matchedDepartment: null,
          requiresApproval: true,
          dataClassificationApplied: dataSensitivity,
        };
      }
      if (!classification.allowedActions.includes("ALLOW" as any)) {
        return {
          allowed: false,
          action: "BLOCK",
          reason: `${dataSensitivity} data not allowed to be sent to ${providerName}`,
          matchedRule: null,
          matchedDepartment: null,
          requiresApproval: false,
          dataClassificationApplied: dataSensitivity,
        };
      }
    }
  }

  // Step 3: Check policy-level provider rules
  const rules = await db.aiUsageGovernanceRule.findMany({
    where: { policyId: policy.id },
    orderBy: [{ priority: "desc" }, { providerName: "asc" }],
  });

  for (const rule of rules) {
    if (rule.providerName === "*" || rule.providerName === providerName) {
      if (!rule.modelPattern || (modelName && modelName.includes(rule.modelPattern))) {
        return {
          allowed: rule.action === "ALLOW",
          action: rule.action as GovernanceAction,
          reason: rule.reason ?? `Policy rule for ${providerName}`,
          matchedRule: rule.id,
          matchedDepartment: null,
          requiresApproval: rule.action === "REQUIRE_APPROVAL",
          dataClassificationApplied: null,
        };
      }
    }
  }

  // Step 4: Apply restricted/PII data action override
  if (dataSensitivity === "RESTRICTED" || dataSensitivity === "PII" || dataSensitivity === "FINANCIAL" || dataSensitivity === "HEALTH") {
    const sensitiveAction = dataSensitivity === "PII" ? policy.piiDataAction : policy.restrictedDataAction;
    return {
      allowed: sensitiveAction === "ALLOW",
      action: sensitiveAction as GovernanceAction,
      reason: `Sensitive data (${dataSensitivity}) default action: ${sensitiveAction}`,
      matchedRule: null,
      matchedDepartment: null,
      requiresApproval: sensitiveAction === "REQUIRE_APPROVAL",
      dataClassificationApplied: dataSensitivity,
    };
  }

  // Step 5: Fall back to policy default
  const defaultAction = policy.defaultAction as GovernanceAction;
  return {
    allowed: defaultAction === "ALLOW",
    action: defaultAction,
    reason: `Default governance policy: ${defaultAction}`,
    matchedRule: null,
    matchedDepartment: null,
    requiresApproval: defaultAction === "REQUIRE_APPROVAL",
    dataClassificationApplied: null,
  };
}

// ── Reporting ────────────────────────────────────────────────────────────────

export async function generateGovernanceReport(
  organizationId: string,
  period: "WEEKLY" | "MONTHLY" | "QUARTERLY",
) {
  const policy = await getOrCreatePolicy(organizationId);
  const now = new Date();

  let periodStart: Date;
  switch (period) {
    case "WEEKLY":
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "MONTHLY":
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "QUARTERLY":
      periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
  }

  const logs = await db.aiUsageGovernanceAuditLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: periodStart },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalUsageEvents = logs.filter((l) => l.action === "USAGE_EVENT").length;
  const allowedEvents = logs.filter((l) => l.decision === "ALLOWED" || l.decision === "ALLOW").length;
  const blockedEvents = logs.filter((l) => l.decision === "BLOCKED" || l.decision === "BLOCK").length;
  const approvalRequests = logs.filter((l) => l.action === "APPROVAL_REQUESTED" || l.action === "APPROVAL_GRANTED" || l.action === "APPROVAL_DENIED").length;

  // Top providers
  const providerMap = new Map<string, number>();
  for (const log of logs) {
    if (log.providerName) {
      providerMap.set(log.providerName, (providerMap.get(log.providerName) ?? 0) + 1);
    }
  }
  const topProviders = [...providerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Top users
  const userMap = new Map<string, number>();
  for (const log of logs) {
    if (log.userId) {
      userMap.set(log.userId, (userMap.get(log.userId) ?? 0) + 1);
    }
  }
  const topUsers = [...userMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));

  const complianceScore = totalUsageEvents > 0
    ? Math.round((allowedEvents / totalUsageEvents) * 100)
    : 100;

  // Findings
  const findings: string[] = [];
  if (blockedEvents > 0) findings.push(`${blockedEvents} AI usage event(s) blocked by governance policy`);
  if (approvalRequests > 0) findings.push(`${approvalRequests} approval request(s) processed`);
  if (topProviders.length === 0) findings.push("No AI usage events recorded in this period");

  // Recommendations
  const recommendations: string[] = [];
  if (blockedEvents > totalUsageEvents * 0.1) recommendations.push("Review governance rules: high block rate may impact productivity");
  if (topProviders.some((p) => p.name.includes("DeepSeek") || p.name.includes("xAI"))) recommendations.push("Review data handling policies for non-standard AI providers");
  if (complianceScore < 80) recommendations.push("Consider updating governance policy to improve compliance score");

  const report = await db.aiUsageReport.create({
    data: {
      policyId: policy.id,
      period: period as any,
      periodStart,
      periodEnd: now,
      totalUsageEvents,
      allowedEvents,
      blockedEvents,
      approvalRequests,
      topProviders: JSON.parse(JSON.stringify(topProviders)),
      topUsers: JSON.parse(JSON.stringify(topUsers)),
      complianceScore,
      findings: JSON.parse(JSON.stringify(findings)),
      recommendations: JSON.parse(JSON.stringify(recommendations)),
    },
  });

  return report;
}

export async function listReports(organizationId: string) {
  const policy = await getOrCreatePolicy(organizationId);
  return db.aiUsageReport.findMany({
    where: { policyId: policy.id },
    orderBy: { periodStart: "desc" },
    take: 12,
  });
}

// ── Dashboard Summary ────────────────────────────────────────────────────────

export async function getGovernanceSummary(organizationId: string): Promise<GovernanceSummary> {
  const policy = await getOrCreatePolicy(organizationId);

  const [
    rules,
    departments,
    pendingApprovals,
    auditLogs,
  ] = await Promise.all([
    db.aiUsageGovernanceRule.count({ where: { policyId: policy.id } }),
    db.aiUsageGovernanceDepartment.count({ where: { policyId: policy.id } }),
    db.aiUsageApprovalRequest.count({ where: { organizationId, status: "PENDING" } }),
    db.aiUsageGovernanceAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const totalEvents = auditLogs.filter((l) => l.action === "USAGE_EVENT").length;
  const blockedEvents = auditLogs.filter((l) => l.decision === "BLOCKED" || l.decision === "BLOCK").length;
  const allowedEvents = auditLogs.filter((l) => l.decision === "ALLOWED" || l.decision === "ALLOW").length;

  // Top providers
  const providerMap = new Map<string, number>();
  for (const log of auditLogs) {
    if (log.providerName) providerMap.set(log.providerName, (providerMap.get(log.providerName) ?? 0) + 1);
  }
  const topProviders = [...providerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  // Top users
  const userMap = new Map<string, number>();
  for (const log of auditLogs) {
    if (log.userId) userMap.set(log.userId, (userMap.get(log.userId) ?? 0) + 1);
  }
  const topUsers = [...userMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([userId, count]) => ({ userId, count }));

  const complianceScore = totalEvents > 0 ? Math.round((allowedEvents / totalEvents) * 100) : 100;

  return {
    policyCount: 1,
    totalRules: rules,
    totalDepartments: departments,
    pendingApprovals,
    blockedEvents,
    allowedEvents,
    complianceScore,
    topProviders,
    topUsers,
  };
}
