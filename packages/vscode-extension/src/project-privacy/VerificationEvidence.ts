import * as path from "node:path";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, type BigIntStats } from "node:fs";

export const PRIVACY_EVIDENCE_PATH = "verification/project-privacy-verification.json";
const MAX_EVIDENCE_BYTES = 64 * 1024;
const MAX_BUNDLE_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
export const PRIVACY_SURFACES = ["managed-reader", "public-workspace", "cline-tools", "ordinary-terminal",
    "buffers-clipboard", "independent-network", "os-isolation", "trusted-runtime"] as const;
export type PrivacySurface = typeof PRIVACY_SURFACES[number];
export type EvidenceStatus = "NOT_TESTED" | "UNMANAGED" | "PASS" | "FAIL" | "INCOMPLETE";
export type SuiteKind = "unit" | "typecheck" | "build" | "ui-template" | "extension-host" | "cline-live" | "agent-cli";
export interface VerificationSuite {
    id: string; kind: SuiteKind; scope: string; passed: number; failed: number; skipped: number;
}
export interface SurfaceEvidence { id: PrivacySurface; status: EvidenceStatus; scope: string; suiteIds: string[] }
export interface PrivacyVerificationEvidence {
    schemaVersion: 1; generatedAt: string; artifact: { extensionSha256: string };
    suites: VerificationSuite[]; surfaces: SurfaceEvidence[];
}
export interface BundleIdentity { path: string; sha256: string }
export interface PrivacyVerificationState {
    state: "MATCHED" | "MISMATCH" | "MISSING" | "INVALID" | "DISABLED" | "UNAVAILABLE";
    loadedSha256?: string; installedSha256?: string; evidenceSha256?: string;
    generatedAt?: string; suites: VerificationSuite[]; surfaces: SurfaceEvidence[];
    fullClaim: "BLOCKED";
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function keys(value: Record<string, unknown>, allowed: string[]): void {
    if (Object.keys(value).length !== allowed.length || Object.keys(value).some(key => !allowed.includes(key)))
        throw new Error("Unexpected verification metadata.");
}
function label(value: unknown, maximum = 240): string {
    if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f-\u009f]/.test(value))
        throw new Error("Invalid verification label.");
    return value;
}
function count(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000)
        throw new Error("Invalid verification count.");
    return value as number;
}
function identifier(value: unknown): string {
    if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error("Invalid verification identifier.");
    return value;
}

/** Metadata-only, bounded local report. It is not an independent security attestation. */
export function parsePrivacyVerificationEvidence(text: string): PrivacyVerificationEvidence {
    if (Buffer.byteLength(text, "utf8") > MAX_EVIDENCE_BYTES) throw new Error("Oversized verification report.");
    const value: unknown = JSON.parse(text);
    if (!record(value)) throw new Error("Invalid verification report.");
    keys(value, ["schemaVersion", "generatedAt", "artifact", "suites", "surfaces"]);
    if (value.schemaVersion !== 1 || typeof value.generatedAt !== "string"
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.generatedAt)
        || !Number.isFinite(Date.parse(value.generatedAt))) throw new Error("Invalid verification date or version.");
    if (!record(value.artifact)) throw new Error("Missing artifact identity.");
    keys(value.artifact, ["extensionSha256"]);
    if (typeof value.artifact.extensionSha256 !== "string" || !SHA256.test(value.artifact.extensionSha256))
        throw new Error("Invalid artifact identity.");
    if (!Array.isArray(value.suites) || value.suites.length > 32 || !Array.isArray(value.surfaces)
        || value.surfaces.length > PRIVACY_SURFACES.length) throw new Error("Invalid verification collections.");
    const suiteIds = new Set<string>();
    const suites = value.suites.map(item => {
        if (!record(item)) throw new Error("Invalid verification suite.");
        keys(item, ["id", "kind", "scope", "passed", "failed", "skipped"]);
        const id = identifier(item.id);
        if (suiteIds.has(id) || !["unit", "typecheck", "build", "ui-template", "extension-host", "cline-live", "agent-cli"].includes(String(item.kind)))
            throw new Error("Duplicate or unsupported verification suite.");
        suiteIds.add(id);
        return { id, kind: item.kind as SuiteKind, scope: label(item.scope), passed: count(item.passed),
            failed: count(item.failed), skipped: count(item.skipped) };
    });
    const seen = new Set<string>();
    const surfaces = value.surfaces.map(item => {
        if (!record(item)) throw new Error("Invalid surface report.");
        keys(item, ["id", "status", "scope", "suiteIds"]);
        if (!PRIVACY_SURFACES.includes(item.id as PrivacySurface) || seen.has(String(item.id))
            || !["NOT_TESTED", "UNMANAGED", "PASS", "FAIL", "INCOMPLETE"].includes(String(item.status))
            || !Array.isArray(item.suiteIds) || item.suiteIds.length > 32)
            throw new Error("Invalid surface metadata.");
        seen.add(String(item.id));
        const references = item.suiteIds.map(identifier);
        if (new Set(references).size !== references.length || references.some(id => !suiteIds.has(id)))
            throw new Error("Invalid suite references.");
        const reports = suites.filter(suite => references.includes(suite.id));
        if (item.status === "PASS" && (!reports.length || reports.some(suite => suite.failed || suite.skipped || !suite.passed)))
            throw new Error("PASS requires complete passing checks.");
        if (item.status === "FAIL" && !reports.some(suite => suite.failed > 0))
            throw new Error("FAIL requires a failing check.");
        return { id: item.id as PrivacySurface, status: item.status as EvidenceStatus, scope: label(item.scope), suiteIds: references };
    });
    return { schemaVersion: 1, generatedAt: value.generatedAt, artifact: { extensionSha256: value.artifact.extensionSha256 }, suites, surfaces };
}

function readBoundedFile(filename: string, maximum: number): Buffer {
    const safe = (stat: BigIntStats) => stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n
        && stat.size >= 0n && stat.size <= BigInt(maximum);
    // Windows path stats report dev=0 while descriptor stats contain the volume ID; compare real descriptor IDs separately.
    const same = (first: BigIntStats, second: BigIntStats, pathStat = false) =>
        (first.dev === second.dev || (pathStat && process.platform === "win32" && (first.dev === 0n || second.dev === 0n)))
        && first.ino === second.ino
        && first.mode === second.mode && first.size === second.size && first.nlink === second.nlink
        && first.birthtimeNs === second.birthtimeNs && first.ctimeNs === second.ctimeNs && first.mtimeNs === second.mtimeNs;
    const initial = lstatSync(filename, { bigint: true });
    if (!safe(initial)) throw new Error("Unsafe verification file.");
    const descriptor = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
        const opened = fstatSync(descriptor, { bigint: true });
        if (!safe(opened) || !same(initial, opened, true)) throw new Error("Changed verification file.");
        // Read from the checked descriptor into a bounded buffer; growing files never cause an unbounded allocation.
        const buffer = Buffer.alloc(Math.min(maximum + 1, Number(opened.size) + 1));
        let offset = 0;
        while (offset < buffer.byteLength) {
            const bytes = readSync(descriptor, buffer, offset, buffer.byteLength - offset, offset);
            if (!bytes) break;
            offset += bytes;
        }
        const finished = fstatSync(descriptor, { bigint: true });
        const currentPath = lstatSync(filename, { bigint: true });
        if (!safe(finished) || !safe(currentPath) || !same(opened, finished) || !same(opened, currentPath, true)
            || BigInt(offset) !== opened.size) throw new Error("Changed verification file.");
        const currentDescriptor = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
        try {
            const finalPathIdentity = fstatSync(currentDescriptor, { bigint: true });
            const finalPathStat = lstatSync(filename, { bigint: true });
            if (!safe(finalPathIdentity) || !same(opened, finalPathIdentity)
                || !safe(finalPathStat) || !same(opened, finalPathStat, true)) throw new Error("Changed verification file.");
        } finally { closeSync(currentDescriptor); }
        return buffer.subarray(0, offset);
    } finally { closeSync(descriptor); }
}

/** Captured once as the production bundle initializes; subsequent disk changes are compared separately. */
export function captureLoadedBundleIdentity(filename: string): BundleIdentity | undefined {
    if (path.basename(filename) !== "extension.js" || path.basename(path.dirname(filename)) !== "dist") return;
    try { return { path: path.resolve(filename), sha256: createHash("sha256").update(readBoundedFile(filename, MAX_BUNDLE_BYTES)).digest("hex") }; }
    catch { return; }
}
const LOADED_BUNDLE_IDENTITY = captureLoadedBundleIdentity(__filename);

export function defaultSurfaceEvidence(): SurfaceEvidence[] {
    return PRIVACY_SURFACES.map(id => ({ id, status: ["cline-tools", "ordinary-terminal", "buffers-clipboard", "independent-network"].includes(id)
        ? "UNMANAGED" : "NOT_TESTED", scope: "No matching live verification; no independent boundary is claimed.", suiteIds: [] }));
}

export function evaluatePrivacyVerification(loaded: BundleIdentity | undefined, installedSha256: string | undefined,
    evidence: PrivacyVerificationEvidence | undefined, absence: "MISSING" | "INVALID" | "DISABLED" = "MISSING"): PrivacyVerificationState {
    const result: PrivacyVerificationState = { state: absence, fullClaim: "BLOCKED", loadedSha256: loaded?.sha256,
        installedSha256, evidenceSha256: evidence?.artifact.extensionSha256, generatedAt: evidence?.generatedAt,
        suites: evidence?.suites ?? [], surfaces: defaultSurfaceEvidence() };
    if (!evidence) return result;
    if (!loaded || !installedSha256) { result.state = "UNAVAILABLE"; return result; }
    if (loaded.sha256 !== installedSha256 || loaded.sha256 !== evidence.artifact.extensionSha256) {
        result.state = "MISMATCH"; return result;
    }
    result.state = "MATCHED";
    // A passing local report can describe tested managed surfaces, never grant authority over independent routes.
    result.surfaces = result.surfaces.map(surface => {
        const reported = evidence.surfaces.find(item => item.id === surface.id);
        if (!reported) return surface;
        const checks = evidence.suites.filter(suite => reported.suiteIds.includes(suite.id));
        if (reported.status === "PASS") {
            if (!["managed-reader", "public-workspace"].includes(surface.id)) return surface;
            if (checks.length !== reported.suiteIds.length || !checks.length
                || checks.some(suite => suite.failed !== 0 || suite.skipped !== 0 || !Number.isSafeInteger(suite.passed) || suite.passed <= 0)
                || !checks.some(suite => suite.kind === "extension-host"))
                return { ...surface, scope: "Complete passing extension-host checks are unavailable; live coverage remains NOT_TESTED." };
        }
        // Never let a local report hide an unmanaged route or imply a deployed OS/trusted-runtime boundary.
        if (["cline-tools", "ordinary-terminal", "buffers-clipboard", "independent-network", "os-isolation", "trusted-runtime"].includes(surface.id)) {
            return reported.status === "FAIL" || reported.status === "INCOMPLETE" ? reported : surface;
        }
        return reported;
    });
    return result;
}

export function loadPrivacyVerification(extensionPath: string, enabled = true): PrivacyVerificationState {
    const installed = path.resolve(extensionPath, "dist", "extension.js");
    const loaded = LOADED_BUNDLE_IDENTITY?.path === installed ? LOADED_BUNDLE_IDENTITY : undefined;
    const installedSha256 = captureLoadedBundleIdentity(installed)?.sha256;
    if (!enabled) return evaluatePrivacyVerification(loaded, installedSha256, undefined, "DISABLED");
    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(readBoundedFile(path.resolve(extensionPath, PRIVACY_EVIDENCE_PATH), MAX_EVIDENCE_BYTES));
        return evaluatePrivacyVerification(loaded, installedSha256, parsePrivacyVerificationEvidence(text));
    } catch (error) {
        return evaluatePrivacyVerification(loaded, installedSha256, undefined,
            (error as NodeJS.ErrnoException).code === "ENOENT" ? "MISSING" : "INVALID");
    }
}
