import { z } from "zod";
import { validateRegexPattern } from "./tester";

export const policyActionSchema = z.enum(["allow", "log_only", "warn", "redact", "rewrite", "block", "require_justification", "require_approval"]);
export const policySeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const policyLogModeSchema = z.enum(["metadata_only", "redacted_prompt", "full_prompt_only_if_enabled_by_admin"]);

const listOfStrings = z.array(z.string().trim().min(1).max(300)).max(100).default([]);

export const policyScopeSchema = z.object({
  type: z.enum(["all", "department", "role", "selected_users"]).default("all"),
  departments: listOfStrings.default(["all"]),
  roles: listOfStrings.default(["all"]),
  users: listOfStrings.default(["all"]),
});

export const policyDestinationsSchema = z.object({
  preset: z.string().trim().min(1).max(80).default("all_ai_tools"),
  domains: listOfStrings.default(["*"]),
  riskLevel: z.enum(["all", "approved", "known_public", "unknown"]).default("all"),
});

export const detectionConfigSchema = z.object({
  detectorKeys: listOfStrings,
  keywords: listOfStrings,
  regex: listOfStrings.refine((patterns) => patterns.every((pattern) => validateRegexPattern(pattern).ok), {
    message: "One or more regex patterns are invalid or unsafe.",
  }),
  domains: listOfStrings,
  fileNames: listOfStrings,
  documentFingerprints: listOfStrings,
  semanticCategories: listOfStrings,
  scanResponses: z.boolean().default(false),
});

export const createPolicySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  templateKey: z.string().trim().max(120).optional(),
  policyName: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean().default(true),
  mode: z.enum(["template", "custom"]).default("custom"),
  severity: policySeveritySchema.default("high"),
  action: policyActionSchema.default("block"),
  scope: policyScopeSchema.default({ type: "all", departments: ["all"], roles: ["all"], users: ["all"] }),
  destinations: policyDestinationsSchema.default({ preset: "all_ai_tools", domains: ["*"], riskLevel: "all" }),
  detectionConfig: detectionConfigSchema.default({
    detectorKeys: [],
    keywords: [],
    regex: [],
    domains: [],
    fileNames: [],
    documentFingerprints: [],
    semanticCategories: [],
    scanResponses: false,
  }),
  logMode: policyLogModeSchema.default("redacted_prompt"),
});

export const updatePolicySchema = createPolicySchema.omit({ organizationId: true, templateKey: true }).partial().extend({
  organizationId: z.string().trim().min(1).max(200),
});

export const testPolicySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  sampleText: z.string().max(20_000),
  destinationDomain: z.string().trim().max(300).default("chatgpt.com"),
  department: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  userId: z.string().trim().max(200).optional(),
  fileName: z.string().trim().max(500).optional(),
  storeSample: z.boolean().default(false),
});

export const rollbackPolicySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  version: z.number().int().positive(),
});
