import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, lstat, constants } from "node:fs/promises";
import { readBoundaryFile } from "../../ai-boundary/readFile";
import { developmentContract, syntheticEnvironment, syntheticFixture, type SyntheticField } from "./DevelopmentContract";
import { canonicalDirectory, publicationRelativePath, validateNewDestination } from "./PublicationPaths";

export const MAX_PUBLIC_FILES = 64;
export const MAX_PUBLIC_BYTES = 1024 * 1024;
const MAX_SINGLE_BYTES = 64 * 1024;
const MAX_MANIFEST_BYTES = 128 * 1024;
const REVIEW_LIFETIME_MS = 5 * 60_000;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
export interface PublicationCapture { readonly relativePath: string; readonly revision: string;
    readonly identity: string; readonly safeText: string; readonly kind: "public-code" | "environment-schema";
    readonly environmentNames?: readonly string[] }
export interface PublicationEntry { readonly path: string; readonly bytes: number; readonly sha256: string;
    readonly treatment: "recognized-secret-redaction" | "approved-keys-masked" | "synthetic-generated" }
export interface PublicationPlan { readonly format: "soterai-publication-v1"; readonly id: string;
    readonly sourceNamespaceSha256: string; readonly isolation: "NO ISOLATION"; readonly expiresAt: number;
    readonly entries: readonly PublicationEntry[]; readonly contract: ReturnType<typeof developmentContract>;
    readonly limitations: readonly string[]; readonly manifestSha256: string }
interface PlanState { captures: readonly PublicationCapture[]; files: ReadonlyMap<string, string>; fingerprint: string; generation: number; issuedAt: number }
export interface PublicationOptions { readonly enabled: () => boolean; readonly now: () => number;
    readonly capture: (relativePath: string) => Promise<PublicationCapture> }
export interface PublicationResult { readonly destination: string; readonly manifestSha256: string;
    readonly fileCount: number; readonly isolation: "NO ISOLATION" }

/** Explicit one-shot publication. No watch/sync, import, shell, credential access or cleanup. */
export class PublicationSession {
    private readonly plans = new WeakMap<PublicationPlan, PlanState>();
    private generation = 0;
    private lastClock = 0;
    constructor(private readonly sourceRoot: string, private readonly options: PublicationOptions) {}
    revoke(): void { this.generation++; }
    private check(): void { if (!this.options.enabled()) throw new Error("Safe publication is unavailable."); }
    private clock(): number {
        const value = this.options.now();
        if (!Number.isFinite(value) || value < this.lastClock || value < 0
            || value > Number.MAX_SAFE_INTEGER - REVIEW_LIFETIME_MS) throw new Error("Publication clock is invalid or regressing.");
        this.lastClock = value;
        return value;
    }

    async prepare(selected: readonly string[], approvedFields: readonly SyntheticField[] = []): Promise<PublicationPlan> {
        this.check();
        const generation = this.generation;
        const issuedAt = this.clock();
        if (!selected.length || selected.length > MAX_PUBLIC_FILES) throw new Error("Select between 1 and 64 files.");
        const source = await canonicalDirectory(this.sourceRoot);
        const names = selected.map(publicationRelativePath);
        const key = (name: string) => process.platform === "win32" ? name.toLowerCase() : name;
        if (new Set(names.map(key)).size !== names.length) throw new Error("Duplicate publication paths.");
        const contract = developmentContract(approvedFields);
        const approved = new Set(contract.fields.map(field => field.name));
        const captures: PublicationCapture[] = [];
        const files = new Map<string, string>();
        let total = 0;
        const entries: PublicationEntry[] = [];
        const add = (name: string, text: string, treatment: PublicationEntry["treatment"]) => {
            const bytes = Buffer.byteLength(text, "utf8");
            total += bytes;
            if (bytes > MAX_SINGLE_BYTES || total > MAX_PUBLIC_BYTES || text.includes("\0")) throw new Error("Publication size exceeded.");
            if (files.has(name) || [...files.keys()].some(existing => key(existing) === key(name))) throw new Error("Publication output collision.");
            files.set(name, text);
            entries.push(Object.freeze({ path: name, bytes, sha256: digest(text), treatment }));
        };
        const foundFields = new Set<string>();
        for (const name of names) {
            this.check();
            if (generation !== this.generation) throw new Error("Publication revoked during preparation.");
            if (this.clock() >= issuedAt + REVIEW_LIFETIME_MS) throw new Error("Publication preparation expired.");
            const capture = await this.options.capture(name);
            if (capture.relativePath !== name || !capture.revision || !capture.identity) throw new Error("Invalid publication capture.");
            const retained: PublicationCapture = Object.freeze({ ...capture,
                environmentNames: capture.environmentNames ? Object.freeze([...capture.environmentNames]) : undefined });
            captures.push(retained);
            if (capture.kind === "environment-schema") {
                const environmentNames = capture.environmentNames ?? [];
                if (environmentNames.length > 256 || environmentNames.some(name => !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name))) {
                    throw new Error("Invalid environment schema.");
                }
                const allowed = environmentNames.filter(name => approved.has(name));
                allowed.forEach(name => foundFields.add(name));
                // Source .env files are never created, including masked replicas: names-only metadata instead.
                continue;
            }
            if (capture.kind !== "public-code") throw new Error("Unsupported publication treatment.");
            add(name, capture.safeText, "recognized-secret-redaction");
        }
        if (approvedFields.some(field => !foundFields.has(field.name))) throw new Error("Synthetic fields must come from explicitly selected environment schemas.");
        add(".env.example", syntheticEnvironment(contract), "synthetic-generated");
        add("soterai-development-contract.json", JSON.stringify(contract, null, 2) + "\n", "synthetic-generated");
        add("soterai-fixtures.json", syntheticFixture(), "synthetic-generated");
        const body = { format: "soterai-publication-v1" as const, id: randomUUID(),
            sourceNamespaceSha256: digest(process.platform === "win32" ? source.toLowerCase() : source),
            isolation: "NO ISOLATION" as const, expiresAt: issuedAt + REVIEW_LIFETIME_MS,
            entries: Object.freeze(entries), contract, limitations: Object.freeze([
                "Explicit saved-file snapshot only. No automatic publication, synchronization or patch import.",
                "Recognized-secret redaction cannot detect all private text. Review selected public content.",
                "Same-user agents and extensions can still reach the original workspace, buffers and network.",
                "Revocation prevents future publication only; released copies cannot be recalled.",
                "Synthetic examples are not a provisioned or automatically runnable application environment.",
            ]) };
        const plan = Object.freeze({ ...body, manifestSha256: digest(JSON.stringify(body)) });
        this.check();
        if (generation !== this.generation) throw new Error("Publication revoked during preparation.");
        if (this.clock() >= plan.expiresAt) throw new Error("Publication preparation expired.");
        if (Buffer.byteLength(JSON.stringify(plan, null, 2), "utf8") > MAX_MANIFEST_BYTES) throw new Error("Publication metadata exceeded its size limit.");
        this.plans.set(plan, { captures: Object.freeze(captures), files, fingerprint: JSON.stringify(plan), generation, issuedAt });
        return plan;
    }

    async publish(plan: PublicationPlan, destination: string, protectedRoots: readonly string[] = []): Promise<PublicationResult> {
        this.check();
        const generation = this.generation;
        const state = this.plans.get(plan);
        if (!state || state.generation !== generation || state.fingerprint !== JSON.stringify(plan)) throw new Error("Publication manifest is invalid, revoked or already used.");
        this.plans.delete(plan); // A review cannot be replayed, including failed publications.
        const current = () => {
            this.check();
            const now = this.clock();
            if (generation !== this.generation || now < state.issuedAt || now >= plan.expiresAt) throw new Error("Publication revoked or expired.");
        };
        current();
        const checkCaptures = async () => {
            for (const before of state.captures) {
                current();
                const after = await this.options.capture(before.relativePath);
                if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error("Source or policy changed. Prepare and review again.");
            }
        };
        await checkCaptures();
        const target = await validateNewDestination(this.sourceRoot, destination, protectedRoots);
        current();
        await mkdir(target, { recursive: false, mode: 0o700 });
        const rootIdentity = await lstat(target);
        const validRoot = async () => {
            current();
            await canonicalDirectory(target);
            const identity = await lstat(target);
            if (!identity.isDirectory() || identity.isSymbolicLink() || identity.dev !== rootIdentity.dev || identity.ino !== rootIdentity.ino) {
                throw new Error("Publication directory changed.");
            }
        };
        for (const [name, text] of state.files) {
            await validRoot();
            const output = path.join(target, ...name.split("/"));
            const parent = path.dirname(output);
            if (parent !== target) await mkdir(parent, { recursive: true, mode: 0o700 });
            await canonicalDirectory(parent);
            await validRoot();
            const file = await open(output, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
            try {
                const identity = await file.stat();
                if (!identity.isFile() || identity.nlink !== 1) throw new Error("Unsafe publication output.");
                current();
                await file.writeFile(text, "utf8");
                const after = await file.stat();
                if (after.nlink !== 1) throw new Error("Publication output changed.");
            } finally { await file.close(); }
        }
        await checkCaptures();
        await validRoot();
        const verifySavedOutputs = async () => {
            for (const entry of plan.entries) {
                await validRoot();
                const saved = await readBoundaryFile(target, path.join(target, ...entry.path.split("/")), MAX_SINGLE_BYTES);
                if (digest(saved) !== entry.sha256 || Buffer.byteLength(saved, "utf8") !== entry.bytes) {
                    throw new Error("Published output changed before completion.");
                }
            }
        };
        await verifySavedOutputs();
        // Completion manifest is written last. Incomplete output is retained for user inspection, never auto-deleted.
        const manifest = await open(path.join(target, "soterai-publication-manifest.json"),
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
        const manifestText = JSON.stringify(plan, null, 2) + "\n";
        try {
            current();
            const identity = await manifest.stat();
            if (!identity.isFile() || identity.nlink !== 1) throw new Error("Unsafe completion manifest output.");
            await manifest.writeFile(manifestText, "utf8");
        }
        finally { await manifest.close(); }
        current();
        await validRoot();
        const savedManifest = await readBoundaryFile(target, path.join(target, "soterai-publication-manifest.json"), MAX_MANIFEST_BYTES);
        if (savedManifest !== manifestText) throw new Error("Completion manifest changed.");
        await verifySavedOutputs();
        await checkCaptures();
        await validRoot();
        current();
        return { destination: target, manifestSha256: plan.manifestSha256, fileCount: state.files.size + 1, isolation: "NO ISOLATION" };
    }
}
