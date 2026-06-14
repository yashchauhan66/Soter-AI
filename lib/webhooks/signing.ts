import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export type WebhookEvent =
  | "guard.prompt_injection.blocked"
  | "guard.jailbreak.detected"
  | "guard.secret.detected"
  | "guard.pii.redacted"
  | "guard.system_prompt_leak.blocked"
  | "guard.unsafe_output.blocked"
  | "usage.limit.warning"
  | "usage.limit.exceeded";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "guard.prompt_injection.blocked",
  "guard.jailbreak.detected",
  "guard.secret.detected",
  "guard.pii.redacted",
  "guard.system_prompt_leak.blocked",
  "guard.unsafe_output.blocked",
  "usage.limit.warning",
  "usage.limit.exceeded",
];

export function generateWebhookSecret() {
  const raw = `whsec_${randomBytes(32).toString("base64url")}`;
  return {
    raw,
    preview: `${raw.slice(0, 12)}...${raw.slice(-4)}`,
    hash: hashWebhookSecret(raw),
  };
}

export function hashWebhookSecret(secret: string) {
  const pepper = process.env.API_KEY_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:wh:${secret}`).digest("hex");
}

export function signWebhookPayload(secret: string, timestamp: number, payload: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  payload: string,
  signature: string,
) {
  const expected = signWebhookPayload(secret, timestamp, payload);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
