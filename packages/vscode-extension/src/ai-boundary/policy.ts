import { createHash } from "node:crypto";

/** Deny-only policy. No negation, regex execution, or repository-supplied allow rule. */
export interface PathRule { kind: "file" | "folder" | "glob"; pattern: string }
export interface ProtectedRegion { path: string; digest: string; start: number; end: number }
export interface ManualRules { paths: PathRule[]; regions: ProtectedRegion[] }
export const OMITTED = "[AI-forbidden content omitted by SoterAI]";
export const MAX_RULES = 256;

export function documentDigest(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

export function relativePath(value: string): string {
    const p = value.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!p || p.length > 4096 || p.startsWith("/") || /[:\x00-\x1f]/.test(p)
        || p.split("/").some(s => s === ".." || s === "." || !s)) {
        throw new Error("Invalid workspace-relative path.");
    }
    // Conservative on case-sensitive hosts too: a differently-cased name cannot weaken a deny.
    return p.toLowerCase();
}

export function validateGlob(pattern: string): string {
    const p = pattern.trim().replace(/\\/g, "/");
    if (!p || p.length > 256 || /[!\[\]{}:\x00-\x1f]/.test(p)
        || p.replace(/^\//, "").replace(/\/$/, "").split("/").some(s => !s || s === "." || s === "..")) {
        throw new Error("Use a relative deny glob with *, ** or ?. Negation, brackets and regex are unsupported.");
    }
    return p;
}

export function parseAiIgnore(text: string): string[] {
    if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("AI policy is too large.");
    const rules = text.replace(/^\uFEFF/, "").split(/\r?\n/)
        .map(line => line.trim()).filter(line => line && !line.startsWith("#"));
    if (rules.length > MAX_RULES) throw new Error("Too many AI policy rules.");
    return rules.map(validateGlob);
}

/** Bounded glob matching without user-controlled regular expressions/backtracking. */
function segmentMatches(pattern: string, value: string): boolean {
    let previous = Array<boolean>(value.length + 1).fill(false);
    previous[0] = true;
    for (const c of pattern) {
        const next = Array<boolean>(value.length + 1).fill(false);
        next[0] = c === "*" && previous[0];
        for (let j = 1; j <= value.length; j++) {
            next[j] = c === "*" ? previous[j] || next[j - 1]
                : previous[j - 1] && (c === "?" || c === value[j - 1]);
        }
        previous = next;
    }
    return previous[value.length];
}

export function matchesGlob(input: string, glob: string): boolean {
    const parts = relativePath(input).split("/");
    const anchored = glob.startsWith("/");
    const rule = glob.toLowerCase().replace(/^\//, "").replace(/\/$/, "").split("/");
    if (!anchored && rule.length === 1) return parts.some(part => segmentMatches(rule[0], part));
    let previous = Array<boolean>(parts.length + 1).fill(false);
    previous[0] = true;
    for (const segment of rule) {
        const next = Array<boolean>(parts.length + 1).fill(false);
        next[0] = segment === "**" && previous[0];
        for (let j = 1; j <= parts.length; j++) {
            next[j] = segment === "**" ? previous[j] || next[j - 1]
                : previous[j - 1] && segmentMatches(segment, parts[j - 1]);
        }
        previous = next;
    }
    // A denied directory denies its descendants as well.
    return previous.some(Boolean);
}

export function matchesRule(input: string, rule: PathRule): boolean {
    if (rule.kind === "glob") return matchesGlob(input, validateGlob(rule.pattern));
    const p = relativePath(input);
    const target = rule.pattern === "." && rule.kind === "folder" ? "" : relativePath(rule.pattern);
    return !target || p === target || (rule.kind === "folder" && p.startsWith(`${target}/`));
}

export function parseManualRules(raw: unknown): ManualRules {
    if (raw === undefined) return { paths: [], regions: [] };
    const source = raw as ManualRules;
    if (!source || !Array.isArray(source.paths) || !Array.isArray(source.regions)
        || source.paths.length + source.regions.length > MAX_RULES) throw new Error("Invalid stored AI rules.");
    for (const rule of source.paths) {
        if (!rule || !["file", "folder", "glob"].includes(rule.kind) || typeof rule.pattern !== "string") throw new Error("Invalid AI path rule.");
        if (rule.kind === "glob") validateGlob(rule.pattern);
        else if (!(rule.kind === "folder" && rule.pattern === ".")) relativePath(rule.pattern);
    }
    for (const region of source.regions) {
        if (!region || typeof region.path !== "string" || !/^[a-f0-9]{64}$/.test(region.digest)
            || !Number.isSafeInteger(region.start) || !Number.isSafeInteger(region.end)
            || region.start < 0 || region.end <= region.start) throw new Error("Invalid protected region.");
        relativePath(region.path);
    }
    return structuredClone(source);
}

/** Offsets apply only to the exact document. Any edit blocks the whole file until re-marked. */
export function redactRegions(input: string, text: string, regions: ProtectedRegion[], start = 0, end = text.length): string {
    const matching = regions.filter(region => relativePath(region.path) === relativePath(input));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > text.length) return OMITTED;
    if (!matching.length) return text.slice(start, end);
    const digest = documentDigest(text);
    if (matching.some(region => region.digest !== digest || region.end > text.length)) return OMITTED;
    const merged: Array<{ start: number; end: number }> = [];
    for (const region of matching.slice().sort((a, b) => a.start - b.start)) {
        const last = merged[merged.length - 1];
        if (last && region.start <= last.end) last.end = Math.max(last.end, region.end);
        else merged.push({ start: region.start, end: region.end });
    }
    let result = "";
    let cursor = start;
    for (const region of merged) {
        if (region.end <= cursor || region.start >= end) continue;
        result += text.slice(cursor, Math.max(cursor, region.start)) + OMITTED;
        cursor = Math.min(end, Math.max(cursor, region.end));
    }
    return result + text.slice(cursor, end);
}
