import { z } from "zod";
import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const pilotEventTypes = [
  "user_signed_up",
  "project_created",
  "api_key_created",
  "first_scan_completed",
  "extension_connected",
  "n8n_workflow_run",
  "risk_blocked",
  "false_positive_reported",
  "false_negative_reported",
  "upgrade_clicked",
  "demo_booked",
] as const;

const blockedPropertyNames = /prompt|secret|password|token|api[_-]?key|credential|raw|content|message|input|output/i;

export const pilotEventSchema = z.object({
  eventType: z.enum(pilotEventTypes),
  organizationId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  properties: z.record(z.unknown()).default({}),
});

export type PilotEventInput = z.infer<typeof pilotEventSchema>;

export function privacySafePilotProperties(properties: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (blockedPropertyNames.test(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) safe[key] = value;
    else if (Array.isArray(value)) {
      safe[key] = value
        .filter((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
        .slice(0, 20);
    }
  }

  return sanitizeMetadata(safe);
}

export function buildPilotEvent(input: PilotEventInput) {
  return {
    organizationId: input.organizationId ?? null,
    projectId: input.projectId ?? null,
    userId: input.userId ?? null,
    eventType: `pilot.${input.eventType}`,
    properties: privacySafePilotProperties(input.properties),
  };
}
