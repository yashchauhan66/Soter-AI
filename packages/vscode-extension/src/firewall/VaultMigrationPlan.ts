import { applyPlaceholders, classifySecretType, containsRawSecret, extractVaultCandidates, type VaultCandidate } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { createSourceSecretPlan, type SourceSyntax } from "../config-scanners/SourceSecretPlan";

export interface PrivateVaultCandidate extends VaultCandidate { replacementText: string }
export interface PrivateVaultPlan { maskedText: string; exampleText: string; candidates: PrivateVaultCandidate[] }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EXISTING = /^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/;
const fail = (): never => { throw new Error("Vault migration syntax or size is unsupported."); };

/** Private plan: no raw values or original representation are a UI/tool receipt. */
export function createVaultMigrationPlan(text: string, environment: boolean, generation: string, sourceSyntax?: SourceSyntax): PrivateVaultPlan {
    if (typeof generation !== "string" || !UUID.test(generation) || typeof environment !== "boolean") return fail();
    if (sourceSyntax !== undefined) {
        if (environment) return fail();
        return createSourceSecretPlan(text, sourceSyntax, generation);
    }
    const model = new SecureEditorModel(text, environment), candidates: PrivateVaultCandidate[] = [];
    const placeholder = (ordinal: number) => `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${ordinal}]`;
    let exampleText = "";
    if (environment) {
        const fields = model.metadata().fields;
        if (fields.some(field => !field.editable || field.id === "contents")) return fail();
        exampleText = [...new Set(fields.map(field => field.name))].map(name => name + "=\n").join("");
        for (let ordinal = 0; ordinal < fields.length; ordinal++) {
            const field = fields[ordinal], rawValue = model.readOwnerValue(field.id);
            if (!rawValue || EXISTING.test(rawValue)) continue;
            // Probe only the public key name, never a value, to reuse canonical heuristics.
            if (!extractVaultCandidates(field.name + "=x").length && !containsRawSecret(rawValue) && !/[\r\n]/.test(rawValue)) continue;
            const replacement = placeholder(ordinal); if (text.includes(replacement)) return fail();
            const isolated = new SecureEditorModel(text, true); isolated.applyOwnerValue(field.id, replacement);
            const changed = isolated.snapshotForStorage(), start = changed.indexOf(replacement);
            const suffix = changed.slice(start + replacement.length), end = text.length - suffix.length;
            if (start < 0 || end <= start || !text.startsWith(changed.slice(0, start)) || !text.endsWith(suffix)) return fail();
            candidates.push({ key: field.name, rawValue, type: classifySecretType(field.name, rawValue), placeholder: replacement,
                start, end, replacementText: text.slice(start, end) });
        }
    } else {
        for (const candidate of extractVaultCandidates(text).sort((a, b) => a.start - b.start)) {
            if (EXISTING.test(candidate.rawValue)) continue;
            candidates.push({ ...candidate, placeholder: placeholder(candidates.length), replacementText: text.slice(candidate.start, candidate.end) });
        }
    }
    const maskedText = applyPlaceholders(text, candidates);
    // Decline before touching disk if an original value also appears in an unselected span.
    if (candidates.some(candidate => maskedText.includes(candidate.rawValue) || maskedText.includes(candidate.replacementText))) return fail();
    new SecureEditorModel(maskedText, environment); // Validate expansion, syntax and UTF-8 budgets.
    return { maskedText, exampleText, candidates };
}
