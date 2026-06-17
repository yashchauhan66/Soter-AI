import { createHash } from "crypto";
import { sanitizeLogText } from "../guard/logSafety";

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

