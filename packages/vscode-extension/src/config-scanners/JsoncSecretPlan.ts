import { createScanner, parseTree, SyntaxKind, ScanError, type Node, type ParseError } from "jsonc-parser";
import { classifySecretType, extractVaultCandidates } from "@soterai/guard-core";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";
import { hygieneCredentialName, isHygieneCandidate } from "../hygiene/HygieneCandidatePolicy";
import type { PrivateVaultCandidate, PrivateVaultPlan } from "../firewall/VaultMigrationPlan";

export type ConfigScanMode = "editor" | "mcp";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const configSyntaxUnavailable = (): never => { throw Error("Config syntax, expression or size is unsupported; existing files are preserved."); };
const fail = configSyntaxUnavailable;
export interface TextScalar { key: string; rawValue: string; start: number; end: number }
export interface ConfigComment { text: string; offset: number }
export const configArgumentName = (text: string) => /^--(?:api[-_]key|access[-_]token|token|password|passwd|secret|credentials?)$/i.test(text);
export const configCredentialName = (name: string) => hygieneCredentialName(name) || /^(?:Authorization|Proxy-Authorization|http\.proxyAuthorization)$/i.test(name);
const publicRootMaps = new Set(["editor.tokenColorCustomizations", "editor.semanticTokenColorCustomizations"]);
export function hasConfigCommentCredential(text: string, mode: ConfigScanMode): boolean {
    // Only exact whole-line protected assignments/markers are comment controls.
    // Other lines are checked even when a supported candidate was also present.
    const control = /^\s*(?:(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*)?(?:"\[SOTERAI_PROTECTED_[A-Z0-9_]+\]"|'\[SOTERAI_PROTECTED_[A-Z0-9_]+\]'|\[SOTERAI_PROTECTED_[A-Z0-9_]+\])\s*$/;
    return hasConfigCredential("", text.split(/\r?\n/).filter(line => !control.test(line)).join("\n"), mode);
}
export function hasConfigCredential(key: string, raw: string, mode: ConfigScanMode): boolean {
    if (raw.includes("[SOTERAI_PROTECTED_")) { if (!/^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/.test(raw)) return fail(); return false; }
    if (raw.includes("${")) { if (mode === "mcp" && /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(raw)) return false; if (!/^\$\{(?:(?:env):[A-Za-z_][A-Za-z0-9_]*|(?:config|command|input):[A-Za-z0-9_.-]+|workspaceFolder(?::[A-Za-z0-9_. -]+)?|file|fileBasename|fileBasenameNoExtension|fileDirname|fileExtname|relativeFile|relativeFileDirname|cwd|userHome|pathSeparator|execPath)\}$/.test(raw)) return fail(); return false; }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)) { let url: URL; try { url = new URL(raw); } catch { return fail(); } if (url.username || url.password || [...url.searchParams.keys()].some(name => hygieneCredentialName(name))) return true; }
    if (isHygieneCandidate("", raw)) return true;
    const compound = /(?:--(?:api[-_]key|access[-_]token|token|password|passwd|secret|credentials?)(?:[= \t])|\b(?:Authorization|Bearer)[ \t:]+|\b(?:[A-Za-z_][A-Za-z0-9_]*_)?(?:API_KEY|TOKEN|PASSWORD|SECRET)[ \t]*=)/i.test(raw)
        || extractVaultCandidates(raw).some(candidate => isHygieneCandidate(candidate.key, candidate.rawValue));
    if (compound && /[$`]/.test(raw)) return fail();
    return compound || isHygieneCandidate(configCredentialName(key) ? (mode === "mcp" ? "MCP_SECRET" : "EDITOR_SECRET") : key, raw);
}
/** Bound scanner work/depth BEFORE the fixed parser's recursive descent. Never evaluate config. */
function parseJsonc(text: string, mode: ConfigScanMode): StaticConfigSyntax {
    const scanner = createScanner(text, false), comments: ConfigComment[] = []; let depth = 0, work = 0;
    for (;;) {
        const token = scanner.scan(); if (++work > 32768 || scanner.getTokenError() !== ScanError.None || token === SyntaxKind.Unknown) return fail();
        if (token === SyntaxKind.OpenBraceToken || token === SyntaxKind.OpenBracketToken) { if (++depth > 64) return fail(); }
        if (token === SyntaxKind.CloseBraceToken || token === SyntaxKind.CloseBracketToken) { if (--depth < 0) return fail(); }
        if (token === SyntaxKind.LineCommentTrivia || token === SyntaxKind.BlockCommentTrivia) { const start = scanner.getTokenOffset(), length = scanner.getTokenLength(); comments.push({ text: text.slice(start + 2, start + length - (token === SyntaxKind.BlockCommentTrivia ? 2 : 0)), offset: start + 2 }); }
        if (token === SyntaxKind.EOF) break;
    }
    if (depth) return fail(); const errors: ParseError[] = [], root = parseTree(text, errors, { disallowComments: false, allowTrailingComma: true, allowEmptyContent: false });
    if (errors.length || !root || root.type !== "object") return fail();
    const scalars: TextScalar[] = [], names: string[] = [], stack: Array<{ node: Node; key: string; depth: number; path: string[]; inputItem?: boolean; inputPassword?: boolean }> = [{ node: root, key: "", depth: 0, path: [] }]; work = 0;
    while (stack.length) {
        const frame = stack.pop()!, n = frame.node; if (++work > 16384 || frame.depth > 64) return fail();
        if (n.type === "object") {
            if (configCredentialName(frame.key) && !(mode === "editor" && frame.depth === 1 && publicRootMaps.has(frame.key)) && !(mode === "mcp" && frame.path.length === 2 && /^(?:servers|mcpServers)$/.test(frame.path[0]))) return fail(); const seen = new Set<string>();
            const input = mode === "mcp" && frame.inputItem === true;
            const fields = new Map((n.children ?? []).filter(p => p.children?.length === 2).map(p => [p.children![0].value, p.children![1]]));
            const privateDefault = input && (fields.get("password")?.value === true || (typeof fields.get("id")?.value === "string" && configCredentialName(fields.get("id")!.value)));
            for (const property of n.children ?? []) {
                if (property.type !== "property" || property.children?.length !== 2) return fail(); const [name, value] = property.children;
                if (name.type !== "string" || typeof name.value !== "string" || !name.value || name.value.length > 1024 || seen.has(name.value)) return fail();
                new SecureEditorModel(name.value, false); if (hasConfigCredential("", name.value, mode)) return fail(); seen.add(name.value); names.push(name.value); stack.push({ node: value, key: privateDefault && name.value === "default" ? "MCP_SECRET" : name.value, depth: frame.depth + 1, path: [...frame.path, name.value], inputPassword: input && name.value === "password" });
            }
        } else if (n.type === "array") {
            if (configCredentialName(frame.key)) return fail(); const items = n.children ?? [];
            for (let i = 0; i < items.length; i++) { const previous = items[i - 1], argument = /^(?:args|arguments)$/i.test(frame.key) && previous?.type === "string" && configArgumentName(previous.value);
                if (argument && items[i].type !== "string") return fail();
                if (/^(?:args|arguments)$/i.test(frame.key) && items[i].type === "string" && configArgumentName(items[i].value) && i + 1 === items.length) return fail();
                stack.push({ node: items[i], key: argument ? (mode === "mcp" ? "MCP_SECRET" : "EDITOR_SECRET") : "", depth: frame.depth + 1, path: [...frame.path, String(i)], inputItem: mode === "mcp" && frame.path.length === 1 && frame.path[0] === "inputs" && items[i].type === "object" });
            }
        } else if (n.type === "string") { if (typeof n.value !== "string") return fail(); new SecureEditorModel(n.value, false); scalars.push({ key: frame.key, rawValue: n.value, start: n.offset, end: n.offset + n.length }); }
        else if (configCredentialName(frame.key) && n.type !== "null" && !(mode === "mcp" && frame.inputPassword === true && n.type === "boolean")) return fail();
    }
    return { scalars, names, comments };
}
export interface StaticConfigSyntax { scalars: TextScalar[]; names: string[]; comments: ConfigComment[] }
export function createJsoncSecretPlan(text: string, generation: string, mode: ConfigScanMode): PrivateVaultPlan {
    return createStaticConfigSecretPlan(text, generation, mode, value => parseJsonc(value, mode));
}
/** Private complete-string plan. Explicit encrypted whole-file recovery only. */
export function createStaticConfigSecretPlan(text: string, generation: string, mode: ConfigScanMode, parse: (value: string) => StaticConfigSyntax): PrivateVaultPlan {
    try {
        if ((mode !== "editor" && mode !== "mcp") || typeof generation !== "string" || !UUID.test(generation)) return fail(); new SecureEditorModel(text, false); const parsed = parse(text), recognized = new Set(parsed.scalars.filter(s => hasConfigCredential(s.key, s.rawValue, mode)).map(s => s.rawValue));
        const pending: Array<PrivateVaultCandidate & { mask: (marker: string) => string }> = [];
        const add = (rawValue: string, start: number, end: number, mask: (marker: string) => string) => { new SecureEditorModel(rawValue, false); if (pending.length >= 128 || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) return fail(); const prefix = mode === "mcp" ? "MCP" : "EDITOR", key = /PRIVATE KEY-----/.test(rawValue) ? prefix + "_PRIVATE_KEY" : prefix + "_SECRET"; pending.push({ key, rawValue, start, end, placeholder: "", replacementText: text.slice(start, end), type: classifySecretType(key, rawValue), mask }); };
        for (const s of parsed.scalars) if (recognized.has(s.rawValue)) add(s.rawValue, s.start, s.end, JSON.stringify);
        for (const comment of parsed.comments) { const candidates = extractVaultCandidates(comment.text).filter(c => isHygieneCandidate(c.key, c.rawValue)); if (!candidates.length && hasConfigCommentCredential(comment.text, mode)) return fail(); for (const c of candidates) add(c.rawValue, comment.offset + c.start, comment.offset + c.end, marker => marker); }
        pending.sort((a, b) => a.start - b.start); for (let i = 0; i < pending.length; i++) { const c = pending[i]; if (i && c.start < pending[i - 1].end) return fail(); c.placeholder = `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${i}]`; if (text.includes(c.placeholder)) return fail(); }
        let maskedText = text; for (const c of [...pending].reverse()) maskedText = maskedText.slice(0, c.start) + c.mask(c.placeholder) + maskedText.slice(c.end);
        if (pending.some(c => maskedText.includes(c.rawValue) || maskedText.includes(c.replacementText))) return fail(); new SecureEditorModel(maskedText, false); const checked = parse(maskedText);
        if (checked.scalars.some(s => hasConfigCredential(s.key, s.rawValue, mode)) || checked.comments.some(comment => hasConfigCommentCredential(comment.text, mode)) || pending.some(c => checked.names.some(name => name.includes(c.rawValue)) || checked.scalars.some(s => s.rawValue.includes(c.rawValue)) || checked.comments.some(comment => comment.text.includes(c.rawValue)))) return fail();
        return { maskedText, exampleText: "", restoreMode: "checkpoint", candidates: pending.map(({ mask: _privateMask, ...candidate }) => candidate) };
    } catch { return fail(); }
}
