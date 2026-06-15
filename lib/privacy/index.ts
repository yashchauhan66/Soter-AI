import { createHash } from "crypto";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const PRIVACY_PREVIEW_GAPS = [
  "Full DSR SLA workflow with reviewer assignment, evidence export, and reminder cadence is not complete in this preview.",
  "Breach notification drafting is readiness support; legal counsel review and regulator submission are out of scope.",
  "Consent capture, retention scheduling, and processing-record approvals require organization-specific configuration before production use.",
  "DPDP/GDPR/CCPA compliance certification is never claimed by this preview; this is defensive readiness only.",
] as const;

export function buildDataSubjectConfirmation(email: string, requestType: string) {
  return createHash("sha256").update(`dsr:${email.toLowerCase()}:${requestType}:${Date.now()}`).digest("hex").slice(0, 16).toUpperCase();
}

export function redactPrivacyIncident(input: string) {
  return sanitizeLogText(input).slice(0, 4_000);
}

export function createBreachNotificationDraft(input: { organizationName: string; summary: string; affectedCategories: string[]; safeguards: string[] }) {
  return [
    `Draft DPDP readiness notification for ${sanitizeLogText(input.organizationName)}.`,
    `Summary: ${redactPrivacyIncident(input.summary)}`,
    `Affected data categories: ${input.affectedCategories.map(sanitizeLogText).join(", ") || "To be confirmed"}.`,
    `Safeguards and containment: ${input.safeguards.map(sanitizeLogText).join(", ") || "Under investigation"}.`,
    "This is a readiness draft, not legal advice or a compliance certification.",
  ].join("\n");
}

export function privacyActionAudit(action: string, actorUserId?: string | null) {
  return {
    action,
    actorUserId: actorUserId ?? null,
    category: "PRIVACY",
    createdAt: new Date().toISOString(),
  };
}

