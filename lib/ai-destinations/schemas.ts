import { z } from "zod";

export const destinationCategorySchema = z.enum(["public_ai", "browser_coding", "local_ai", "ide", "cli_api", "custom"]);
export const destinationRiskSchema = z.enum(["low", "medium", "high", "critical"]);
export const destinationLoggingSchema = z.enum(["metadata_only", "redacted_prompt", "disabled", "full_prompt_explicit_admin_enabled"]);
const policyActionSchema = z.enum(["allow", "log_only", "warn", "redact", "rewrite", "block", "require_justification", "require_approval"]);

const baseCreateAIDestinationSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  destinationId: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().trim().min(1).max(160),
  category: destinationCategorySchema,
  domains: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  urlPatterns: z.array(z.string().trim().min(1).max(1000)).max(100).default([]),
  enabled: z.boolean().default(true),
  riskLevel: destinationRiskSchema,
  allowedDepartments: z.array(z.string().trim().min(1).max(100)).max(100).default(["all"]),
  allowedRoles: z.array(z.string().trim().min(1).max(100)).max(100).default(["all"]),
  policyOverrides: z.record(policyActionSchema).default({}),
  responseScanningEnabled: z.boolean().default(true),
  loggingMode: destinationLoggingSchema.default("metadata_only"),
});

export const createAIDestinationSchema = baseCreateAIDestinationSchema.superRefine((value, context) => {
  if (!["ide", "cli_api"].includes(value.category) && value.domains.length + value.urlPatterns.length === 0) {
    context.addIssue({ code: "custom", path: ["urlPatterns"], message: "A browser destination needs at least one domain or URL pattern." });
  }
});

export const updateAIDestinationSchema = baseCreateAIDestinationSchema.omit({ organizationId: true, destinationId: true }).partial().extend({
  organizationId: z.string().trim().min(1).max(200),
}).superRefine((value, context) => {
  const category = value.category;
  const domains = value.domains ?? [];
  const urlPatterns = value.urlPatterns ?? [];
  if (!category || (!["ide", "cli_api"].includes(category) && domains.length + urlPatterns.length === 0)) {
    context.addIssue({ code: "custom", path: ["urlPatterns"], message: "A browser destination needs at least one domain or URL pattern." });
  }
});

export type CreateAIDestinationInput = z.infer<typeof createAIDestinationSchema>;
