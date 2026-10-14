import { documentDigest, matchesGlob, matchesRule, mergeManualRules, parseManualRules, relativePath, validateGlob, type ManualRules, type PathRule } from "./policy";

export const POLICY_SCHEMA_VERSION = 1;
export const STORED_POLICY_SCHEMA_VERSION = 2;
export const MAX_POLICY_BYTES = 128 * 1024;
export const MAX_POLICY_RULES = 256;
export const MAX_SENSITIVE_GLOBS = 512;
export interface VersionedPolicy { schemaVersion: 1; presets: string[]; rules: ManualRules; sensitiveGlobs: string[] }
export interface StoredPolicy { manual: ManualRules; policy?: VersionedPolicy }

export { LITE_CREDENTIAL_PATTERNS as CREDENTIAL_PATTERNS, LITE_STACK_PRESETS as STACK_PRESETS } from '@soterai/guard-core';
import { LITE_CREDENTIAL_PATTERNS as CREDENTIAL_PATTERNS, LITE_STACK_PRESETS as STACK_PRESETS } from '@soterai/guard-core';

function object(raw: unknown, keys: string[]): Record<string, unknown> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
        || Object.keys(raw).some(key => !keys.includes(key))) throw new Error("Invalid policy object.");
    return raw as Record<string, unknown>;
}
function budget(raw: unknown): void {
    let text: string | undefined;
    try { text = JSON.stringify(raw); } catch { throw new Error("Invalid policy serialization."); }
    if (!text || Buffer.byteLength(text, "utf8") > MAX_POLICY_BYTES) throw new Error("Policy byte budget exceeded.");
}
const canonicalGlob = (value: string) => validateGlob(value.normalize("NFC")).toLowerCase();
function validatedRules(raw: unknown): ManualRules {
    const source = object(raw, ["paths", "regions"]);
    if (!Array.isArray(source.paths) || !Array.isArray(source.regions)) throw new Error("Invalid policy rules.");
    for (const rule of source.paths) object(rule, ["kind", "pattern", "sensitive"]);
    for (const region of source.regions) object(region, ["path", "digest", "start", "end"]);
    const rules = parseManualRules(source);
    rules.paths = rules.paths.map(rule => ({ ...rule, pattern: rule.kind === "glob" ? canonicalGlob(rule.pattern)
        : rule.kind === "folder" && rule.pattern === "." ? "." : relativePath(rule.pattern.normalize("NFC")) }));
    rules.regions = rules.regions.map(region => ({ ...region, path: relativePath(region.path.normalize("NFC")) }));
    return mergeManualRules({ paths: [], regions: [] }, rules);
}
export function parseVersionedPolicy(raw: unknown): VersionedPolicy {
    budget(raw);
    const source = object(raw, ["schemaVersion", "presets", "rules", "sensitiveGlobs"]);
    if (source.schemaVersion !== POLICY_SCHEMA_VERSION) throw new Error("Unsupported policy schema.");
    if (!Array.isArray(source.presets) || source.presets.length > STACK_PRESETS.length
        || source.presets.some(id => typeof id !== "string" || !STACK_PRESETS.some(preset => preset.id === id))) throw new Error("Unknown policy preset.");
    if (!Array.isArray(source.sensitiveGlobs) || source.sensitiveGlobs.length > MAX_SENSITIVE_GLOBS
        || source.sensitiveGlobs.some(value => typeof value !== "string")) throw new Error("Invalid sensitive globs.");
    const presets = [...new Set(source.presets as string[])].sort();
    const sensitiveGlobs = [...new Set([...(source.sensitiveGlobs as string[]), ...STACK_PRESETS.filter(preset => presets.includes(preset.id)).flatMap(preset => preset.patterns)].map(canonicalGlob))].sort();
    if (sensitiveGlobs.length > MAX_SENSITIVE_GLOBS) throw new Error("Expanded policy exceeds its pattern budget.");
    const result: VersionedPolicy = { schemaVersion: POLICY_SCHEMA_VERSION, presets, rules: validatedRules(source.rules), sensitiveGlobs };
    budget(result);
    return result;
}
export function parseVersionedPolicyText(text: string): VersionedPolicy {
    if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_POLICY_BYTES || text.includes("\0")) throw new Error("Invalid policy text.");
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    // JSON.parse accepts duplicate keys. Reject ambiguous objects including escaped aliases.
    const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
    const stack: Array<Set<string> | undefined> = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === "{") stack.push(new Set()); else if (token === "[") stack.push(undefined);
        else if (token === "}" || token === "]") stack.pop();
        else if (token.startsWith('"') && tokens[i + 1] === ":") {
            const keys = stack[stack.length - 1]; const key = JSON.parse(token) as string;
            if (!keys || keys.has(key)) throw new Error("Duplicate or invalid policy key.");
            keys.add(key);
        }
    }
    return parseVersionedPolicy(value);
}
export function mergeVersionedPolicies(before: VersionedPolicy, added: VersionedPolicy): VersionedPolicy {
    const a = parseVersionedPolicy(before), b = parseVersionedPolicy(added);
    return parseVersionedPolicy({ schemaVersion: POLICY_SCHEMA_VERSION, presets: [...new Set([...a.presets, ...b.presets])],
        rules: mergeManualRules(a.rules, b.rules), sensitiveGlobs: [...new Set([...a.sensitiveGlobs, ...b.sensitiveGlobs])] });
}
export function defaultVersionedPolicy(presetIds: string[] = []): VersionedPolicy {
    const presets = parseVersionedPolicy({ schemaVersion: POLICY_SCHEMA_VERSION, presets: presetIds, rules: { paths: [], regions: [] }, sensitiveGlobs: [] }).presets;
    return parseVersionedPolicy({ schemaVersion: POLICY_SCHEMA_VERSION, presets, rules: { paths: [], regions: [] },
        sensitiveGlobs: [...CREDENTIAL_PATTERNS.map(row => row.pattern), ...STACK_PRESETS.filter(preset => presets.includes(preset.id)).flatMap(preset => preset.patterns)] });
}
export function exportVersionedPolicy(policy: VersionedPolicy): string {
    const validated = parseVersionedPolicy(policy);
    const pretty = JSON.stringify(validated, null, 2) + "\n";
    // A valid compact policy near the byte limit must still round-trip.
    return Buffer.byteLength(pretty, "utf8") <= MAX_POLICY_BYTES ? pretty : JSON.stringify(validated);
}
export function parseStoredPolicy(raw: unknown): StoredPolicy {
    if (raw === undefined) return { manual: { paths: [], regions: [] } };
    if (raw && typeof raw === "object" && "schemaVersion" in raw) {
        budget(raw);
        const source = object(raw, ["schemaVersion", "manual", "policy"]);
        if (source.schemaVersion !== STORED_POLICY_SCHEMA_VERSION) throw new Error("Unsupported stored policy schema.");
        const manual = validatedRules(source.manual), policy = parseVersionedPolicy(source.policy);
        // Every accepted envelope must fit the portable effective-rule budget.
        // Defaults use a separate sensitive-glob budget, not manual rule slots.
        mergeManualRules(manual, policy.rules);
        budget({ schemaVersion: STORED_POLICY_SCHEMA_VERSION, manual, policy });
        return { manual, policy };
    }
    return { manual: parseManualRules(raw) };
}
export function versionedPolicyBlocks(input: string, policy: VersionedPolicy): boolean {
    const normalized = relativePath(input.normalize("NFC"));
    return policy.sensitiveGlobs.some(glob => matchesGlob(normalized, glob)) || policy.rules.paths.some(rule => matchesRule(normalized, rule));
}
export function versionedPolicySensitive(input: string, policy: VersionedPolicy): boolean {
    const normalized = relativePath(input.normalize("NFC"));
    return policy.sensitiveGlobs.some(glob => matchesGlob(normalized, glob))
        || policy.rules.paths.some(rule => rule.sensitive === true && matchesRule(normalized, rule));
}
