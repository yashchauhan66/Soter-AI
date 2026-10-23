import { classifySecretType } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { hygieneCredentialName, isHygieneCandidate } from "../hygiene/HygieneCandidatePolicy";
import type { PrivateVaultCandidate, PrivateVaultPlan } from "../firewall/VaultMigrationPlan";

export type ServiceAccountFormat = "service-account-json";
export const SERVICE_ACCOUNT_WORKSPACE_GLOBS = Object.freeze(["**/*.[jJ][sS][oO][nN]"]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PUBLIC_FIELDS = new Set(["private_key_id", "client_id", "client_email", "project_id", "quota_project_id", "auth_uri", "token_uri", "auth_provider_x509_cert_url", "client_x509_cert_url", "universe_domain", "type"]);
const fail = (): never => { throw Error("Service-account JSON syntax, credential source or size is unsupported; existing files are preserved."); };
export function serviceAccountFormatForPath(relative: string): ServiceAccountFormat | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative) || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) return fail();
    return /\.json$/i.test(relative) ? "service-account-json" : undefined;
}
interface Scalar { key: string; rawValue: string; start: number; end: number }
function parse(text: string): { scalars: Scalar[]; names: string[] } {
    let cursor = 0, work = 0; const scalars: Scalar[] = [], names: string[] = [];
    const space = () => { while (/[ \r\n\t]/.test(text[cursor] ?? "") && cursor < text.length) cursor++; };
    const tick = () => { if (++work > 16384) return fail(); };
    const symbol = (s: string) => { space(); tick(); if (text[cursor++] !== s) return fail(); };
    const string = (): { value: string; start: number; end: number } => {
        space(); tick(); const start = cursor; if (text[cursor++] !== '"') return fail(); let closed = false;
        while (cursor < text.length) { const c = text[cursor++]; if (c === '"') { closed = true; break; } if (c.charCodeAt(0) < 32) return fail(); if (c === "\\") { const escape = text[cursor++]; if (escape === "u") { if (!/^[a-f0-9]{4}$/i.test(text.slice(cursor, cursor + 4))) return fail(); cursor += 4; } else if (!escape || !'"\\/bfnrt'.includes(escape)) return fail(); } }
        if (!closed) return fail(); const value: string = JSON.parse(text.slice(start, cursor)); new SecureEditorModel(value, false); return { value, start, end: cursor };
    };
    function value(key: string, depth: number): void {
        if (depth > 64) return fail(); space(); tick(); const c = text[cursor], credentialField = hygieneCredentialName(key) && !PUBLIC_FIELDS.has(key);
        if (c === '"') { const scalar = string(); if (key === "type" && ["external_account", "external_account_authorized_user", "impersonated_service_account"].includes(scalar.value)) return fail(); scalars.push({ key, rawValue: scalar.value, start: scalar.start, end: scalar.end }); return; }
        // A public grouping named "private" is not an inherited credential field.
        // Actual credential fields still require a string (or an empty null).
        if (credentialField && !(key === "private" && c === "{") && text.slice(cursor, cursor + 4) !== "null") return fail();
        if (c === "{") {
            symbol("{"); const keys = new Set<string>(); space();
            if (text[cursor] !== "}") while (true) {
                const name = string().value; if (!name || name.length > 1024 || keys.has(name) || credential({ key: "", rawValue: name, start: 0, end: 0 }) || /^(?:credential_source|source_credentials|private_key_file|client_secret_file|certificate_file|key_file)$/i.test(name)) return fail(); keys.add(name); names.push(name); symbol(":"); value(name, depth + 1); space(); if (text[cursor] === "}") break; symbol(",");
            }
            symbol("}"); return;
        }
        if (c === "[") { symbol("["); space(); if (text[cursor] !== "]") while (true) { value("", depth + 1); space(); if (text[cursor] === "]") break; symbol(","); } symbol("]"); return; }
        const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(cursor)); if (!literal || !["true", "false", "null"].includes(literal[0]) && !Number.isFinite(Number(literal[0]))) return fail(); cursor += literal[0].length;
    }
    space(); if (text[cursor] !== "{") return fail(); value("", 0); space(); if (cursor !== text.length) return fail(); return { scalars, names };
}
function credential(s: Scalar): boolean {
    const value = s.rawValue;
    if (value.includes("[SOTERAI_PROTECTED_")) { if (!/^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/.test(value)) return fail(); return false; }
    if (value.includes("${")) { if (!/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value)) return fail(); return false; }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) {
        let url: URL; try { url = new URL(value); } catch { return fail(); }
        if (url.username || url.password || [...url.searchParams.keys()].some(key => hygieneCredentialName(key))) return true;
    }
    return /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/.test(value) || isHygieneCandidate(PUBLIC_FIELDS.has(s.key) ? "" : s.key, value);
}
/** Parse saved text only. Plaintext and exact representations never form public metadata. */
export function createServiceAccountSecretPlan(text: string, format: ServiceAccountFormat, generation: string): PrivateVaultPlan {
    try {
        if (format !== "service-account-json" || typeof generation !== "string" || !UUID.test(generation)) return fail(); new SecureEditorModel(text, false);
        const { scalars } = parse(text), recognized = new Set(scalars.filter(credential).map(s => s.rawValue));
        const candidates: PrivateVaultCandidate[] = [];
        for (const s of scalars) if (recognized.has(s.rawValue)) {
            if (candidates.length >= 128) return fail(); const key = /PRIVATE KEY-----/.test(s.rawValue) ? "GOOGLE_PRIVATE_KEY" : "SERVICE_ACCOUNT_SECRET", placeholder = `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${candidates.length}]`; if (text.includes(placeholder)) return fail();
            candidates.push({ ...s, key, type: classifySecretType(key, s.rawValue), placeholder, replacementText: text.slice(s.start, s.end) });
        }
        let maskedText = text; for (const c of [...candidates].reverse()) maskedText = maskedText.slice(0, c.start) + JSON.stringify(c.placeholder) + maskedText.slice(c.end);
        if (candidates.some(c => maskedText.includes(c.rawValue) || maskedText.includes(c.replacementText))) return fail(); new SecureEditorModel(maskedText, false); const checked = parse(maskedText); if (checked.scalars.some(credential) || candidates.some(c => checked.names.some(name => name.includes(c.rawValue)) || checked.scalars.some(scalar => scalar.rawValue.includes(c.rawValue)))) return fail();
        return { maskedText, exampleText: "", restoreMode: "checkpoint", candidates };
    } catch { return fail(); }
}
