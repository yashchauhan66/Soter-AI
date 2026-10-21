import { Composer, Parser, isAlias, isMap, isScalar, isSeq, type Node, type Scalar } from "yaml";
import { classifySecretType, extractVaultCandidates } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { hygieneCredentialName, isHygieneCandidate } from "../hygiene/HygieneCandidatePolicy";
import type { PrivateVaultCandidate, PrivateVaultPlan } from "../firewall/VaultMigrationPlan";

export type CiFormat = "ci-yaml";
const GITHUB = ".[gG][iI][tT][hH][uU][bB]/[wW][oO][rR][kK][fF][lL][oO][wW][sS]", GITLAB = ".[gG][iI][tT][lL][aA][bB]", EXT = "{[yY][mM][lL],[yY][aA][mM][lL]}";
export const CI_WORKSPACE_GLOBS = Object.freeze(["**/" + GITHUB + "/*." + EXT, "**/" + GITLAB + "-[cC][iI]." + EXT, "**/" + GITLAB + "/**/*." + EXT]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = (): never => { throw Error("CI YAML syntax, expression or size is unsupported; existing files are preserved."); };
export function ciFormatForPath(relative: string): CiFormat | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative) || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) return fail();
    return /(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i.test(relative) || /(?:^|\/)\.gitlab-ci\.ya?ml$/i.test(relative) || /(?:^|\/)\.gitlab\/(?:[^/]+\/)*[^/]+\.ya?ml$/i.test(relative) ? "ci-yaml" : undefined;
}
interface TextScalar { key: string; rawValue: string; start: number; end: number; path: string[] }
interface Comment { text: string; offset: number }
function hasCredential(key: string, raw: string, location: readonly string[]): boolean {
    if (raw.includes("[SOTERAI_PROTECTED_")) { if (!/^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/.test(raw)) return fail(); return false; }
    if (raw.includes("${")) { if (!/^(?:\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$\{\{\s*[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+\s*\}\})$/.test(raw)) return fail(); return false; }
    if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return false;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)) { let url: URL; try { url = new URL(raw); } catch { return fail(); } if (url.username || url.password || [...url.searchParams.keys()].some(name => hygieneCredentialName(name))) return true; }
    if (isHygieneCandidate("", raw)) return true;
    if (location.includes("permissions") && ["read", "write", "none"].includes(raw)) return false;
    const compound = /(?:--(?:api[-_]key|token|password|secret)(?:[= \t])|\b(?:Authorization|Bearer)[ \t:]+|\b(?:[A-Za-z_][A-Za-z0-9_]*_)?(?:API_KEY|TOKEN|PASSWORD|SECRET)[ \t]*=)/i.test(raw)
        || extractVaultCandidates(raw).some(candidate => isHygieneCandidate(candidate.key, candidate.rawValue));
    if (compound && /[$`]/.test(raw)) return fail();
    return compound || isHygieneCandidate(key, raw);
}
/** Fixed parse-only YAML1.2 core grammar. No materialization, resolver or evaluation. */
function parseYaml(text: string): { scalars: TextScalar[]; names: string[]; comments: Comment[] } {
    const tokens = [...new Parser().parse(text)], pending: Array<{ value: unknown; depth: number }> = tokens.map(value => ({ value, depth: 0 })), comments: Comment[] = []; let work = 0;
    while (pending.length) {
        const { value, depth } = pending.pop()!; if (++work > 32768 || depth > 128) return fail(); if (Array.isArray(value)) { for (const child of value) pending.push({ value: child, depth: depth + 1 }); continue; }
        if (!value || typeof value !== "object") continue; const token = value as Record<string, unknown>;
        if (["error", "alias", "anchor", "tag", "directive"].includes(token.type as string)) return fail();
        if (token.type === "comment") { if (typeof token.source !== "string" || typeof token.offset !== "number") return fail(); comments.push({ text: token.source.slice(1), offset: token.offset + 1 }); }
        for (const child of Object.values(token)) if (child && typeof child === "object") pending.push({ value: child, depth: depth + 1 });
    }
    const composer = new Composer({ version: "1.2", schema: "core", strict: true, stringKeys: true, uniqueKeys: true, merge: false, customTags: [], keepSourceTokens: true, prettyErrors: false, logLevel: "silent" }), docs = [...composer.compose(tokens, true, text.length)], stream = composer.streamInfo();
    if (docs.length !== 1 || stream.errors.length || stream.warnings.length || docs.some(doc => doc.errors.length || doc.warnings.length) || !isMap(docs[0].contents)) return fail();
    const scalars: TextScalar[] = [], names: string[] = [], stack: Array<{ node: unknown; key: string; path: string[]; variable?: string; options?: boolean }> = [{ node: docs[0].contents, key: "", path: [] }]; work = 0;
    while (stack.length) {
        const frame = stack.pop()!, n = frame.node; if (++work > 16384 || frame.path.length > 64) return fail(); if (n == null) continue;
        if (isAlias(n) || (n as Node).tag || (n as Scalar).anchor) return fail();
        if (isMap(n)) {
            const jobLabel = frame.path.length === 2 && frame.path[0] === "jobs";
            if (frame.path.length > 1 && !jobLabel && hygieneCredentialName(frame.key) && frame.key !== "private" && !frame.variable) return fail();
            for (const pair of n.items) {
                if (!isScalar(pair.key) || typeof pair.key.value !== "string" || !pair.key.value || pair.key.value.length > 1024 || pair.key.value === "<<") return fail(); const key = pair.key.value; new SecureEditorModel(key, false); if (hasCredential("", key, [])) return fail(); names.push(key);
                const hint = frame.variable && (key === "value" || key === "options") ? frame.variable : key, variable = frame.path.at(-1) === "variables" && isMap(pair.value) ? key : undefined;
                stack.push({ node: pair.value, key: hint, path: [...frame.path, key], variable, options: !!frame.variable && key === "options" });
            }
        } else if (isSeq(n)) { if (hygieneCredentialName(frame.key) && !frame.options) return fail(); for (const item of n.items) stack.push({ node: item, key: frame.key, path: frame.path }); }
        else if (isScalar(n)) {
            if (!n.range || typeof n.value !== "string" && hygieneCredentialName(frame.key) && n.value != null) return fail(); if (typeof n.value !== "string") continue; new SecureEditorModel(n.value, false);
            scalars.push({ key: frame.key, rawValue: n.value, start: n.range[0], end: n.range[1], path: frame.path });
        } else return fail();
    }
    return { scalars, names, comments };
}
/** Private complete-scalar plan; no original values/names are public receipts. */
export function createCiSecretPlan(text: string, format: CiFormat, generation: string): PrivateVaultPlan {
    try {
        if (format !== "ci-yaml" || typeof generation !== "string" || !UUID.test(generation)) return fail(); new SecureEditorModel(text, false); const parsed = parseYaml(text), recognized = new Set(parsed.scalars.filter(s => hasCredential(s.key, s.rawValue, s.path)).map(s => s.rawValue));
        const pending: Array<PrivateVaultCandidate & { mask: (marker: string) => string }> = [];
        const add = (rawValue: string, start: number, end: number, mask: (marker: string) => string) => { new SecureEditorModel(rawValue, false); if (pending.length >= 128 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return fail(); const key = /PRIVATE KEY-----/.test(rawValue) ? "CI_PRIVATE_KEY" : "CI_SECRET"; pending.push({ key, rawValue, start, end, placeholder: "", replacementText: text.slice(start, end), type: classifySecretType(key, rawValue), mask }); };
        for (const s of parsed.scalars) if (recognized.has(s.rawValue)) { const eol = /(\r?\n)$/.exec(text.slice(s.start, s.end))?.[1] ?? ""; add(s.rawValue, s.start, s.end, marker => JSON.stringify(marker) + eol); }
        for (const comment of parsed.comments) { const candidates = extractVaultCandidates(comment.text).filter(c => isHygieneCandidate(c.key, c.rawValue)); if (!candidates.length && hasCredential("", comment.text, [])) return fail(); for (const c of candidates) add(c.rawValue, comment.offset + c.start, comment.offset + c.end, marker => marker); }
        pending.sort((a, b) => a.start - b.start); for (let i = 0; i < pending.length; i++) { const c = pending[i]; if (i && c.start < pending[i - 1].end) return fail(); c.placeholder = `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${i}]`; if (text.includes(c.placeholder)) return fail(); }
        let maskedText = text; for (const c of [...pending].reverse()) maskedText = maskedText.slice(0, c.start) + c.mask(c.placeholder) + maskedText.slice(c.end);
        if (pending.some(c => maskedText.includes(c.rawValue) || maskedText.includes(c.replacementText))) return fail(); new SecureEditorModel(maskedText, false); const checked = parseYaml(maskedText);
        if (checked.scalars.some(s => hasCredential(s.key, s.rawValue, s.path)) || pending.some(c => checked.names.some(name => name.includes(c.rawValue)) || checked.scalars.some(s => s.rawValue.includes(c.rawValue)) || checked.comments.some(comment => comment.text.includes(c.rawValue)))) return fail();
        return { maskedText, exampleText: "", restoreMode: "checkpoint", candidates: pending.map(({ mask: _privateMask, ...candidate }) => candidate) };
    } catch { return fail(); }
}
