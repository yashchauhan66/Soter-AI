import { createHash } from "node:crypto";
import { detectSecrets, SECRET_DETECTOR_VERSION } from "./detectors/SecretDetector";
import { detectEncodedSecrets } from "./detectors/EncodedSecretDetector";
import { RegisteredSecretMatcher } from "./RegisteredSecretMatcher";

export interface SecretScanPolicy {
    schemaVersion: 1; mode: "source" | "artifact";
    maxFiles: number; maxFileBytes: number; maxTotalBytes: number; maxEntries: number; maxMilliseconds: number;
    excludedDirectories: string[];
    trustedOpaqueFiles: Array<{ path: string; sha256: string }>;
}
export const SECRET_SCAN_DEFAULTS: Readonly<SecretScanPolicy> = Object.freeze({ schemaVersion: 1, mode: "source",
    maxFiles: 2048, maxFileBytes: 131072, maxTotalBytes: 16777216, maxEntries: 16384, maxMilliseconds: 60000,
    excludedDirectories: [".git", "node_modules"], trustedOpaqueFiles: [] });
const LIMITS = { maxFiles: 8192, maxFileBytes: 131072, maxTotalBytes: 67108864, maxEntries: 65536, maxMilliseconds: 120000 };
const EXCLUSIONS = new Set([".git", "node_modules", ".pytest_cache", ".ruff_cache", ".next/cache"]);
const FIELDS = new Set(["schemaVersion", "mode", ...Object.keys(LIMITS), "excludedDirectories", "trustedOpaqueFiles"]);
const PUBLIC_IDENTIFIERS = new Set(["heroku_key", "twilio_sid"]);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function safeRelativePath(value: unknown): value is string {
    return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\\:\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/u.test(value)
        && !value.startsWith("/") && value.split("/").every(part => part && part !== "." && part !== ".." && !/[. ]$/.test(part)
            && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
export function parseSecretScanPolicy(input: unknown = {}): SecretScanPolicy {
    if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error("Invalid scan policy");
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !FIELDS.has(key) || !("value" in descriptors[key]))) throw Error("Invalid scan policy");
    const value = { ...SECRET_SCAN_DEFAULTS, ...input } as SecretScanPolicy;
    if (value.schemaVersion !== 1 || !["source", "artifact"].includes(value.mode)) throw Error("Invalid scan policy");
    for (const [key, maximum] of Object.entries(LIMITS)) {
        const n = value[key as keyof typeof LIMITS]; if (!Number.isSafeInteger(n) || n < 1 || n > maximum) throw Error("Invalid scan limit");
    }
    if (!Object.hasOwn(input, "excludedDirectories") && value.mode === "artifact") value.excludedDirectories = [];
    if (!Array.isArray(value.excludedDirectories) || value.excludedDirectories.some(name => !EXCLUSIONS.has(name))
        || new Set(value.excludedDirectories).size !== value.excludedDirectories.length || value.mode === "artifact" && value.excludedDirectories.length) throw Error("Invalid scan exclusions");
    if (!Array.isArray(value.trustedOpaqueFiles) || value.trustedOpaqueFiles.length > 512) throw Error("Invalid opaque assets");
    const names = new Set<string>();
    value.trustedOpaqueFiles = value.trustedOpaqueFiles.map(entry => {
        if (!entry || typeof entry !== "object" || Object.keys(entry).sort().join(",") !== "path,sha256" || !safeRelativePath(entry.path)
            || !/^[a-f0-9]{64}$/.test(entry.sha256) || names.has(entry.path.toLowerCase())
            || !/\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|otf)$/i.test(entry.path)) throw Error("Invalid opaque asset");
        names.add(entry.path.toLowerCase()); return { path: entry.path, sha256: entry.sha256 };
    });
    return { ...value, excludedDirectories: [...value.excludedDirectories] };
}
export function secretScanPolicyDigest(policy: SecretScanPolicy): string {
    const normalized = parseSecretScanPolicy(policy);
    return digest(JSON.stringify({ ...normalized, excludedDirectories: [...normalized.excludedDirectories].sort(), trustedOpaqueFiles: [...normalized.trustedOpaqueFiles].sort((a,b) => a.path.localeCompare(b.path)) }));
}
export interface ContentSecretFinding { ruleId: string; start: number; end: number }
export class SecretContentScanner {
    #matcher: RegisteredSecretMatcher;
    #unsupportedShort: boolean;
    readonly version = `secret-policy-v1/${SECRET_DETECTOR_VERSION}`;
    constructor(values: readonly string[] = []) { this.#matcher = new RegisteredSecretMatcher(values); this.#unsupportedShort = Array.isArray(values) && values.some(value => typeof value === "string" && Array.from(value).length < 8); }
    scan(text: string): { findings: ContentSecretFinding[]; complete: boolean } {
        const result = this.#matcher.inspectRequest([text]);
        if (this.#unsupportedShort || result.status === "WITHHELD") return { findings: [], complete: false };
        const matches = [...detectSecrets(text).matches.filter(match => !PUBLIC_IDENTIFIERS.has(match.type)), ...detectEncodedSecrets(text).matches];
        const findings: ContentSecretFinding[] = matches.map(match => ({ ruleId: match.type, start: match.start, end: match.end }));
        for (const match of result.matches) if (match.kind === "registered") findings.push({ ruleId: "registered_secret", start: match.start, end: match.end });
        const unique = new Map(findings.map(f => [`${f.ruleId}:${f.start}:${f.end}`, f]));
        return { findings: [...unique.values()].sort((a,b) => a.start-b.start || a.ruleId.localeCompare(b.ruleId)), complete: true };
    }
    reportPath(path: string, ordinal: number): string {
        const result = this.scan(path);
        return !safeRelativePath(path) || !result.complete || result.findings.length ? `withheld-path-${ordinal}` : path;
    }
}
