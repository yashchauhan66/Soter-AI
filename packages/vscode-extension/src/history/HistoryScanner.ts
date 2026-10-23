import { createHash } from "node:crypto";
import { supportsCheckedGitVersion } from "../terminal/CheckedGitMetadata";
import { HYGIENE_KINDS, HYGIENE_PROVIDERS, type HygieneInput, type HygieneAnalysis, type HygieneFinding } from "../hygiene/HygieneAnalysis";
import { HISTORY_LIMITS, parseHistoryCommitList, parseHistoryTree, parseHistoryBatch, decodeHistoryBlob, type HistoryTreeBlob } from "./GitHistoryProtocol";
import type { HistoryGitOperation, HistoryGitOutcome } from "./HistoryGitProcess";

interface Options {
    run: (operation: HistoryGitOperation, deadline: number) => Promise<HistoryGitOutcome>;
    analyze: (input: HygieneInput) => Readonly<HygieneAnalysis>;
    valid: () => boolean; deadline: number; now?: () => number;
}
export interface HistoryScanResult {
    readonly status: "ANALYZED" | "PARTIAL" | "UNAVAILABLE";
    readonly commits: number; readonly files: number; readonly findings: readonly HygieneFinding[];
    readonly skipped: Readonly<{ unsupported: number; oversize: number; binary: number; analysis: number; capped: boolean }>;
    readonly guidance: string; readonly scope: string;
}
export const HISTORY_GUIDANCE = "Review historical credential candidates privately and rotate affected credentials with their provider. Ask the repository owner to coordinate any removal or history rewrite with backups and collaborators. This scanner never rewrites history; objects, remotes and existing copies may remain readable.";
export const HISTORY_SCOPE = "Bounded regular blobs reachable from local refs only. Findings use opaque historical references; private owner Git inspection is required to locate originals. No commit messages, reflogs, unreachable objects, linked content, credential-validity, AI-access or removal verification.";
const fail = (): never => { throw new Error("History analysis unavailable."); };
const env = (source: string) => /^\.env(?:\..*)?$/i.test(source.split("/").at(-1) ?? "");
function safeFinding(value: HygieneFinding): HygieneFinding {
    if (!value || [value.id, value.fileRef, value.valueRef].some(v => typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v))
        || !HYGIENE_KINDS.includes(value.kind) || !HYGIENE_PROVIDERS.includes(value.provider)
        || !Number.isSafeInteger(value.line) || value.line < 1 || value.line > 65536) return fail();
    return Object.freeze({ id: value.id, fileRef: value.fileRef, valueRef: value.valueRef, line: value.line,
        kind: value.kind, provider: value.provider, suggestions: Object.freeze(["rotation-checklist"]) });
}

/** Private orchestration over a canonical owned Git runner and hygiene analyzer.
 * It has no filesystem, shell, Git executable or approval authority of its own. */
export async function scanGitHistory(options: Options): Promise<Readonly<HistoryScanResult>> {
    const findings: HygieneFinding[] = [], skipped = { unsupported: 0, oversize: 0, binary: 0, analysis: 0, capped: false };
    let commits = 0, files = 0;
    const result = (status: HistoryScanResult["status"]): Readonly<HistoryScanResult> => Object.freeze({ status,
        commits: status === "UNAVAILABLE" ? 0 : commits, files: status === "UNAVAILABLE" ? 0 : files,
        findings: Object.freeze(status === "UNAVAILABLE" ? [] : findings.slice()),
        skipped: Object.freeze(status === "UNAVAILABLE" ? { unsupported: 0, oversize: 0, binary: 0, analysis: 0, capped: false } : { ...skipped }),
        guidance: HISTORY_GUIDANCE, scope: HISTORY_SCOPE });
    try {
        const clock = options.now ?? (() => performance.now()), start = clock(); let last = start, processBytes = 0;
        if (!Number.isFinite(start) || !Number.isFinite(options.deadline) || options.deadline <= start) return fail();
        const deadline = Math.min(options.deadline, start + HISTORY_LIMITS.milliseconds);
        const valid = () => {
            const now = clock(); if (!Number.isFinite(now) || now < start || now < last || now >= deadline || options.valid() !== true) return fail();
            last = now;
        };
        const run = async (operation: HistoryGitOperation, cap: number): Promise<Buffer> => {
            valid(); const outcome = await options.run(operation, deadline); valid();
            if (outcome?.status !== "COMPLETE" || !Buffer.isBuffer(outcome.bytes) || outcome.bytes.length > cap) return fail();
            processBytes += outcome.bytes.length; if (processBytes > 4 * 1024 * 1024) return fail(); return outcome.bytes;
        };
        const version = await run({ kind: "version" }, 4096);
        if (!supportsCheckedGitVersion(version.toString("utf8"))) return fail();
        const list = parseHistoryCommitList(await run({ kind: "commits" }, HISTORY_LIMITS.listBytes)); skipped.capped = list.capped;
        type Selected = HistoryTreeBlob & { commit: string; environment: boolean };
        const selected = new Map<string, Selected>(); let total = 0, entries = 0;
        history: for (const commit of list.commits) {
            const tree = parseHistoryTree(await run({ kind: "tree", oid: commit }, HISTORY_LIMITS.treeBytes)); commits++;
            skipped.unsupported += tree.skipped; entries += tree.skipped;
            for (const blob of tree.blobs) {
                if (++entries > 4096) { skipped.capped = true; break history; }
                const before = selected.get(blob.oid);
                if (before) {
                    if (before.size !== blob.size) return fail();
                    // Renaming a dotenv blob must not erase its historical format.
                    if (!before.environment && env(blob.source)) selected.set(blob.oid, { ...blob, commit, environment: true });
                    continue;
                }
                if (blob.size > HISTORY_LIMITS.blobBytes) { skipped.oversize++; continue; }
                if (selected.size >= HISTORY_LIMITS.blobs || total + blob.size > HISTORY_LIMITS.totalBytes) { skipped.capped = true; break history; }
                selected.set(blob.oid, { ...blob, commit, environment: env(blob.source) }); total += blob.size;
            }
            if (entries > 4096) { skipped.capped = true; break; }
        }
        if (selected.size) {
            const objects = [...selected.values()].map(({ oid, size }) => ({ oid, size }));
            const batch = parseHistoryBatch(await run({ kind: "batch", objects }, total + objects.length * 96), objects);
            const ids = new Set<string>();
            for (const blob of batch) {
                valid(); files++; const context = selected.get(blob.oid)!;
                const text = decodeHistoryBlob(blob.bytes);
                if (text === undefined) { skipped.binary++; blob.bytes.fill(0); continue; }
                let source = "history-v1/" + context.commit + "/" + context.source;
                if (source.length > 2048) source = "history-v1/" + context.commit + "/path-" + createHash("sha256").update(context.source).digest("hex");
                let analysis: Readonly<HygieneAnalysis>;
                try { analysis = options.analyze({ source, text, environment: context.environment }); }
                catch { skipped.analysis++; blob.bytes.fill(0); continue; }
                valid();
                if (!analysis || !Array.isArray(analysis.findings) || analysis.findings.length > 128) return fail();
                for (const candidate of analysis.findings) {
                    const finding = safeFinding(candidate); if (ids.has(finding.id)) continue;
                    if (findings.length >= 128) { skipped.capped = true; break; }
                    findings.push(finding); ids.add(finding.id);
                }
                blob.bytes.fill(0);
            }
        }
        valid();
        return result(skipped.capped || skipped.unsupported || skipped.oversize || skipped.binary || skipped.analysis ? "PARTIAL" : "ANALYZED");
    } catch { return result("UNAVAILABLE"); }
}
