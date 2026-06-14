import { z } from "zod";
import { MAX_TEXT_LENGTH } from "./guard/constants";
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

export const inputGuardSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(MAX_TEXT_LENGTH),
  userId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  metadata: metadataSchema.optional().default({}),
});

export const outputGuardSchema = z.object({
  aiResponse: z.string().trim().min(1, "AI response is required.").max(MAX_TEXT_LENGTH),
  sessionId: z.string().max(200).optional(),
  metadata: metadataSchema.optional().default({}),
});

export const analyzeSchema = z.object({
  text: z.string().trim().min(1, "Text is required.").max(MAX_TEXT_LENGTH),
  direction: z.enum(["INPUT", "OUTPUT"]),
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
