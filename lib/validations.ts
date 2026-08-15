import { z } from "zod";
import { MAX_TEXT_LENGTH } from "./guard/constants";
import { PROVENANCE_VALUES } from "./guard/decisionEngine";
import { parsePublicHttpsUrl } from "./network/outboundUrl";

const metadataValue = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const metadataSchema = z
  .record(z.string().min(1).max(64), metadataValue)
  .superRefine((value, context) => {
    if (Object.keys(value).length > 20) {
      context.addIssue({ code: "custom", message: "Metadata may contain at most 20 fields." });
    }
  });

/**
 * Where the caller says the text came from. Optional everywhere: omitting it means
 * USER (first-party), which is the behaviour every existing integration already has.
 * Supplying it is what lets the decision engine treat "ignore previous instructions"
 * inside a retrieved document as an indirect injection rather than as the operator's
 * own instruction — see lib/guard/decisionEngine.ts.
 *
 * Accepted loosely (case-insensitive, hyphens or spaces for underscores) because this
 * is a hint from an SDK caller, and rejecting `"retrieved-document"` with a 400 would
 * push integrators toward simply omitting it.
 */
export const guardSourceSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase().replace(/[-\s]+/g, "_") : value),
  z.enum(PROVENANCE_VALUES),
);
const sourceSchema = guardSourceSchema;

export const inputGuardSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(MAX_TEXT_LENGTH),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  providerName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  source: sourceSchema.optional(),
  // Topical scope. All three are optional and the guard is a no-op without them,
  // so adding these cannot change any existing caller's verdict. Bounded so a
  // caller cannot turn the topic vocabulary into an unbounded work item.
  allowedTopics: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  systemPromptContext: z.string().trim().max(4000).optional(),
  minTopicRelevance: z.number().min(0).max(1).optional(),
  metadata: metadataSchema.optional().default({}),
});

export const outputGuardSchema = z.object({
  aiResponse: z.string().trim().min(1, "AI response is required.").max(MAX_TEXT_LENGTH),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  providerName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  source: sourceSchema.optional(),
  metadata: metadataSchema.optional().default({}),
});

export const analyzeSchema = z.object({
  text: z.string().trim().min(1, "Text is required.").max(MAX_TEXT_LENGTH),
  direction: z.enum(["INPUT", "OUTPUT"]),
  source: sourceSchema.optional(),
});

// One request covering both directions, for callers that cannot chain two.
// See app/api/guard/universal/route.ts for why that constraint is real.
export const universalGuardSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(MAX_TEXT_LENGTH),
  aiResponse: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
  profile: z.enum(["BALANCED", "STRICT", "MAXIMUM"]).default("BALANCED"),
  source: sourceSchema.optional(),
  allowedTopics: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  systemPromptContext: z.string().trim().max(4000).optional(),
  minTopicRelevance: z.number().min(0).max(1).optional(),
  metadata: metadataSchema.optional().default({}),
});

// A workflow export is much larger than a guard message — 2 MB is roughly a
// 200-node workflow with inline parameters, which is well past anything a real
// n8n canvas holds. It is a bound, not a target.
export const workflowAuditSchema = z.object({
  workflowJson: z.string().trim().min(1, "Workflow JSON is required.").max(2_000_000),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  publicName: z.string().trim().max(80).optional(),
  clientId: z.string().min(1).optional(),
});
export const apiKeySchema = z.object({ name: z.string().trim().min(2).max(80), projectId: z.string().min(1), environment: z.enum(["test", "live"]).default("test") });

export const WEBHOOK_EVENT_VALUES = [
  "guard.prompt_injection.blocked",
  "guard.jailbreak.detected",
  "guard.secret.detected",
  "guard.pii.redacted",
  "guard.system_prompt_leak.blocked",
  "guard.unsafe_output.blocked",
  "governance.enforcement.blocked",
  "governance.enforcement.approval_required",
  "usage.limit.warning",
  "usage.limit.exceeded",
] as const;

export const webhookCreateSchema = z.object({
  projectId: z.string().min(1),
  url: z.string().url().max(2048).superRefine((value, context) => { try { parsePublicHttpsUrl(value); } catch (error) { context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid webhook URL." }); } }),
  description: z.string().trim().max(200).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_VALUES)).min(1).max(WEBHOOK_EVENT_VALUES.length),
});

export const webhookUpdateSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().max(2048).superRefine((value, context) => { try { parsePublicHttpsUrl(value); } catch (error) { context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid webhook URL." }); } }).optional(),
  description: z.string().trim().max(200).optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_VALUES)).min(1).max(WEBHOOK_EVENT_VALUES.length).optional(),
  isActive: z.boolean().optional(),
});

export const agencySchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactEmail: z.string().email().max(200).optional(),
});

export const clientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactEmail: z.string().email().max(200).optional(),
});

export const brandingSchema = z.object({
  agencyName: z.string().trim().min(2).max(120),
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
  contactEmail: z.string().email().max(200).optional().or(z.literal("")),
  reportFooter: z.string().trim().max(500).optional().or(z.literal("")),
  brandColor: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/).optional().or(z.literal("")),
});
