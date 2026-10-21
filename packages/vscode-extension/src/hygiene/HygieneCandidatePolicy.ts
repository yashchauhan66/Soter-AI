import { containsRawSecret } from "@soterai/guard-core";

/** Private candidate policy shared by parsers; never an authority or UI value. */
export function normalizeHygieneName(name: string): string {
    return name.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
}
export function hygieneCredentialName(name: string): boolean {
    return /(?:^|_)(?:API|KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIALS?|AUTH|PRIVATE|DATABASE_URL|DB_URL|CONNECTION_STRING|DSN)(?:_|$)/.test(normalizeHygieneName(name));
}
export function isHygieneCandidate(name: string, value: string): boolean {
    const normalized = normalizeHygieneName(name);
    const template = /^(?:\$\{[A-Za-z_][A-Za-z0-9_]*\}|YOUR_[A-Z0-9_]+|REPLACE_ME|\[MASKED\]|<[^<>\r\n]{1,128}>)$/i.test(value)
        || value.includes("[SOTERAI_PROTECTED_") || /^(?:ssh-(?:rsa|ed25519) |-----BEGIN (?:RSA )?PUBLIC KEY-----)/.test(value);
    const stripePublic = /(?:^|_)STRIPE(?:_|$)/.test(normalized) && /(?:^|_)(?:PUBLISHABLE|PUBLIC)(?:_|$)/.test(normalized)
        && /^pk_(?:test|live)_[A-Za-z0-9]+$/.test(value);
    return !!value && !template && !stripePublic && (hygieneCredentialName(name) || containsRawSecret(value));
}
