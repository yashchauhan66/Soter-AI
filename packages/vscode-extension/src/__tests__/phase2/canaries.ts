/**
 * PHASE 2 — canary registry.
 *
 * Every fixture secret is built from a per-run random nonce, so a hit in any
 * captured artifact cannot be a coincidental match against real repo content.
 * NO REAL SECRET IS USED ANYWHERE IN THIS HARNESS.
 *
 * Two families, because they answer different questions:
 *
 *   VENDOR-SHAPED canaries (`vendor.*`) carry a real provider prefix, so they
 *   are what the denylist in `Redactor.ts` is designed to catch. A leak here is
 *   a failure of the redactor itself.
 *
 *   CUSTOM canaries (`custom.*`) carry no provider shape and no keyword the
 *   generic assignment rules look for. They exist because the product promise
 *   covers "custom data", not just vendor credentials. A leak here is a failure
 *   of the ARCHITECTURE (denylist instead of allowlist), not of a regex.
 */
import { randomBytes } from "node:crypto";

/** Per-run nonce. Override with SOTERAI_P2_NONCE to reproduce a specific run. */
export const NONCE: string = process.env.SOTERAI_P2_NONCE ?? randomBytes(9).toString("hex");

/** 32 lowercase hex chars, the shape several vendor formats require. */
const HEX32 = (tag: string): string => (NONCE + tag.padEnd(14, "0")).replace(/[^0-9a-f]/g, "0").slice(0, 32).padEnd(32, "0");

/** 40 base64-ish chars, the AWS secret-key shape. */
const B64_40 = (tag: string): string => `${NONCE}${tag}`.padEnd(40, "A").slice(0, 40);

export interface Canary {
    /** Stable id used in the results table. */
    id: string;
    /** The exact string planted on disk. */
    value: string;
    /** True when a vendor pattern in REDACTION_RULES is supposed to match it. */
    vendorShaped: boolean;
    /** Human note for the evidence column. */
    note: string;
}

function c(id: string, value: string, vendorShaped: boolean, note: string): Canary {
    return { id, value, vendorShaped, note };
}

export const CANARIES: Canary[] = [
    // ── vendor-shaped: the denylist claims these ────────────────────────────
    c("V-ANTHROPIC", `sk-ant-api03-${NONCE}${"x".repeat(24)}`, true, "sk-ant- rule"),
    c("V-GITHUB", `ghp_${NONCE}${"A".repeat(22)}`, true, "ghp_ rule"),
    c("V-AWS-ID", `AKIA${NONCE.toUpperCase().replace(/[^0-9A-Z]/g, "Q").slice(0, 16).padEnd(16, "Q")}`, true, "AKIA rule"),
    c("V-AWS-SECRET", `aws_secret_access_key=${B64_40("aws")}`, true, "aws_secret_access_key rule"),
    c("V-OPENAI", `sk-${NONCE}${"T".repeat(24)}`, true, "broad sk- rule"),
    c("V-SLACK", `xoxb-${NONCE}-${NONCE}-slackcanary`, true, "xox[bpoars]- rule"),
    c("V-STRIPE", `sk_live_${NONCE}${"9".repeat(16)}`, true, "stripe rule"),
    c("V-JWT", `eyJ${Buffer.from(`{"k":"${NONCE}"}`).toString("base64url")}.eyJzdWIi${NONCE}.sig${NONCE}`, true, "JWT rule"),
    c("V-DB-URL", `postgres://admin:${NONCE}@db.internal:5432/prod`, true, "database URL rule"),
    c("V-PRIVKEY", `-----BEGIN RSA PRIVATE KEY-----\nMIIEow${NONCE}FAKEKEYMATERIALFORTESTONLY\n-----END RSA PRIVATE KEY-----`, true, "private key rule"),
    c("V-DO", `dop_v1_${HEX32("do")}${HEX32("do2")}`, true, "dop_v1_ rule"),

    // ── custom data: no vendor shape, no keyword the generic rules read ─────
    c("C-PLAIN", `CANARYCUSTOM${NONCE}PLAIN`, false, "bare custom value, no assignment"),
    c("C-ASSIGN", `INTERNAL_PARTNER_ID=CANARYCUSTOM${NONCE}ASSIGN`, false, "assignment with a non-keyword key"),
    c("C-PROSE", `Our merchant reference is CANARYCUSTOM${NONCE}PROSE for reconciliation.`, false, "secret inside prose"),
    c("C-CSV", `acct,name\n9912,CANARYCUSTOM${NONCE}CSV`, false, "customer data row"),
];

export const VENDOR_CANARIES = CANARIES.filter((k) => k.vendorShaped);
export const CUSTOM_CANARIES = CANARIES.filter((k) => !k.vendorShaped);

export function canaryById(id: string): Canary {
    const found = CANARIES.find((k) => k.id === id);
    if (!found) throw new Error(`unknown canary ${id}`);
    return found;
}

/**
 * The distinctive core of each canary — what a grep must look for.
 *
 * Matching on the WHOLE planted string would miss a partial leak (the first 24
 * characters of a key are still a key), so each canary also contributes its
 * nonce-bearing core. The nonce alone is 18 hex chars: long enough that a hit is
 * never an accident.
 */
export function canaryNeedles(k: Canary): string[] {
    const needles = new Set<string>([k.value]);
    // The nonce-bearing run inside the value (drop the vendor prefix / prose).
    const core = k.value.match(new RegExp(`[A-Za-z0-9_+/=-]*${NONCE}[A-Za-z0-9_+/=-]*`));
    if (core) needles.add(core[0]);
    needles.add(NONCE);
    return [...needles].filter((n) => n.length >= 12);
}
