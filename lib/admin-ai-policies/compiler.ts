import { DEFAULT_FILE_NAME_KEYWORDS, POLICY_TEMPLATES } from "./templates";
import type { AdminAiPolicy, ExtensionCompiledPolicyBundle, PolicyAction } from "./types";

export const ACTION_PRIORITY: Record<PolicyAction, number> = {
  allow: 0,
  log_only: 1,
  warn: 2,
  redact: 3,
  rewrite: 4,
  require_justification: 5,
  require_approval: 6,
  block: 7,
};

export function strictestAction(actions: PolicyAction[]) {
  return actions.reduce<PolicyAction>((winner, action) => (
    ACTION_PRIORITY[action] > ACTION_PRIORITY[winner] ? action : winner
  ), "allow");
}

export function buildTemplatePolicy(organizationId: string, templateKey: string, actorId?: string): AdminAiPolicy {
  const template = POLICY_TEMPLATES.find((item) => item.key === templateKey);
  if (!template) throw new Error(`Unknown policy template: ${templateKey}`);
  const now = new Date().toISOString();
  return {
    id: `policy_${crypto.randomUUID()}`,
    organizationId,
    name: template.name,
    description: template.description,
    enabled: template.enabledByDefault,
    mode: "template",
    severity: template.defaultSeverity,
    action: template.defaultAction,
    scope: { type: "all", departments: ["all"], roles: ["all"], users: ["all"] },
    destinations: { preset: "all_ai_tools", domains: ["*"], riskLevel: "all" },
    detectionConfig: {
      detectorKeys: template.detectorKeys,
      keywords: [],
      regex: [],
      domains: [],
      fileNames: DEFAULT_FILE_NAME_KEYWORDS.filter((name) => template.detectorKeys.some((key) => key.includes(name) || name.includes(key))),
      documentFingerprints: [],
      semanticCategories: template.detectorKeys,
      scanResponses: template.key === "scan-llm-responses",
    },
    logMode: "redacted_prompt",
    version: 0,
    createdBy: actorId,
    updatedBy: actorId,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function compileExtensionPolicyBundle(organizationId: string, policies: AdminAiPolicy[]): ExtensionCompiledPolicyBundle {
  const publishedOrEnabled = policies.filter((policy) => policy.enabled && Boolean(policy.publishedAt));
  const latestVersion = Math.max(0, ...publishedOrEnabled.map((policy) => policy.version));
  const latestPublished = publishedOrEnabled
    .map((policy) => policy.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    organizationId,
    version: latestVersion,
    publishedAt: latestPublished,
    defaultAction: "allow",
    policies: publishedOrEnabled.map((policy) => ({
      id: policy.id,
      name: policy.name,
      enabled: policy.enabled,
      severity: policy.severity,
      action: policy.action,
      detectors: detectorKeysForPolicy(policy),
      scope: {
        departments: policy.scope.departments.length ? policy.scope.departments : ["all"],
        roles: policy.scope.roles.length ? policy.scope.roles : ["all"],
        users: policy.scope.users.length ? policy.scope.users : ["all"],
      },
      destinations: policy.destinations.domains.length ? policy.destinations.domains : ["*"],
      logMode: policy.logMode,
    })),
    customDetectors: {
      keywords: unique(publishedOrEnabled.flatMap((policy) => policy.detectionConfig.keywords)),
      regex: unique(publishedOrEnabled.flatMap((policy) => policy.detectionConfig.regex)),
      documentFingerprints: unique(publishedOrEnabled.flatMap((policy) => policy.detectionConfig.documentFingerprints)),
    },
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function detectorKeysForPolicy(policy: AdminAiPolicy) {
  return unique([
    ...policy.detectionConfig.detectorKeys,
    ...policy.detectionConfig.semanticCategories,
    ...(policy.detectionConfig.keywords.length ? ["custom_keyword"] : []),
    ...(policy.detectionConfig.regex.length ? ["custom_regex"] : []),
    ...(policy.detectionConfig.fileNames.length ? ["custom_file_name"] : []),
    ...(policy.detectionConfig.documentFingerprints.length ? ["custom_document_fingerprint"] : []),
  ]);
}
