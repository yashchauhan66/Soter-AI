import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { SecretContentScanner, parseSecretScanPolicy, secretScanPolicyDigest, safeRelativePath, type SecretScanPolicy } from "@soterai/guard-core";

export interface CiFinding { ruleId: string; path: string; line: number; column: number; fingerprint: string }
export type CiDiagnostic = "ROOT_UNAVAILABLE" | "UNSAFE_PATH" | "LINK_REFUSED" | "READ_FAILED" | "CHANGED_DURING_SCAN" | "ENTRY_LIMIT" | "FILE_LIMIT" | "BYTE_LIMIT" | "TIME_LIMIT" | "UNSUPPORTED_CONTENT" | "MATCHING_INCOMPLETE" | "CANCELLED";
export interface CiScanReport {
    schemaVersion: 1; status: "clean" | "findings" | "incomplete"; policyDigest: string; scannerVersion: string;
    scannedFiles: number; scannedBytes: number; excludedEntries: number; approvedOpaqueFiles: number;
    findings: CiFinding[]; diagnostics: Array<{ code: CiDiagnostic; path?: string }>;
    scope: { mode: "source" | "artifact"; excludedDirectories: string[]; maxFileBytes: number; selectedFileCount?: number };
    snapshotSha256?: string;
}
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const inside = (root: string, target: string) => target === root || target.startsWith(root + path.sep);

export async function scanDirectory(rootPath: string, inputPolicy: unknown = {}, values: readonly string[] = [], context: { signal?: AbortSignal; includePaths?: readonly string[]; onFile?(name: string, bytes: Buffer): void } = {}): Promise<CiScanReport> {
    const policy: SecretScanPolicy = parseSecretScanPolicy(inputPolicy), scanner = new SecretContentScanner(values);
    const report: CiScanReport = { schemaVersion: 1, status: "clean", policyDigest: secretScanPolicyDigest(policy), scannerVersion: scanner.version,
        scannedFiles: 0, scannedBytes: 0, excludedEntries: 0, approvedOpaqueFiles: 0, findings: [], diagnostics: [],
        scope: { mode: policy.mode, excludedDirectories: policy.excludedDirectories, maxFileBytes: policy.maxFileBytes } };
    const started = Date.now(), root = path.resolve(rootPath), captures: Array<{ name: string; digest: string }> = [];
    const selected = context.includePaths ? new Set(context.includePaths) : undefined, visited = new Set<string>();
    if (selected && (!selected.size || selected.size > policy.maxFiles || [...selected].some(name => !safeRelativePath(name)))) throw Error("Invalid selected scope");
    if (selected) report.scope.selectedFileCount = selected.size;
    let entries = 0, ordinal = 0, stopped = false;
    const issue = (code: CiDiagnostic, name?: string) => {
        report.status = "incomplete";
        if (report.diagnostics.length < 128) report.diagnostics.push({ code, ...(name ? { path: scanner.reportPath(name, ordinal) } : {}) });
    };
    const current = () => { if (context.signal?.aborted) { if (!stopped) issue("CANCELLED"); stopped = true; } else if (Date.now() - started > policy.maxMilliseconds) { if (!stopped) issue("TIME_LIMIT"); stopped = true; } return !stopped; };
    const excluded = (name: string) => policy.excludedDirectories.some(prefix => name === prefix || name.startsWith(prefix + "/") || !prefix.includes("/") && name.split("/").includes(prefix));
    if (!scanner.scan("").complete) { issue("MATCHING_INCOMPLETE"); return report; }
    try {
        const stat = await fs.lstat(root);
        const resolved = path.resolve(await fs.realpath(root));
        if (!stat.isDirectory() || stat.isSymbolicLink() || root.startsWith("\\\\") || (process.platform === "win32" ? resolved.toLowerCase() !== root.toLowerCase() : resolved !== root)) { issue("ROOT_UNAVAILABLE"); return report; }
    } catch { issue("ROOT_UNAVAILABLE"); return report; }
    async function visit(directory: string, relative: string, depth: number): Promise<void> {
        if (!current()) return;
        if (depth > 32) { issue("ENTRY_LIMIT", relative); return; }
        const names: string[] = [];
        try {
            const handle = await fs.opendir(directory);
            for await (const entry of handle) {
                if (++entries > policy.maxEntries) { issue("ENTRY_LIMIT", relative); stopped = true; break; }
                names.push(entry.name);
            }
        } catch { issue("READ_FAILED", relative); return; }
        names.sort();
        const caseNames = new Set<string>();
        for (const name of names) {
            if (!current()) break;
            ordinal++;
            const rel = relative ? relative + "/" + name : name, file = path.join(directory, name);
            if (selected && !selected.has(rel) && ![...selected].some(value => value.startsWith(rel + "/"))) { report.excludedEntries++; continue; }
            if (!safeRelativePath(rel) || caseNames.has(name.toLowerCase())) { issue("UNSAFE_PATH", rel); continue; }
            caseNames.add(name.toLowerCase());
            if (excluded(rel)) { report.excludedEntries++; continue; }
            let stat;
            try { stat = await fs.lstat(file); if (stat.isSymbolicLink() || !inside(root, await fs.realpath(file))) { issue("LINK_REFUSED", rel); continue; } }
            catch { issue("READ_FAILED", rel); continue; }
            if (stat.isDirectory()) { await visit(file, rel, depth + 1); continue; }
            if (!stat.isFile() || stat.nlink !== 1) { issue("LINK_REFUSED", rel); continue; }
            if (report.scannedFiles >= policy.maxFiles) { issue("FILE_LIMIT", rel); stopped = true; break; }
            if (stat.size > policy.maxFileBytes || report.scannedBytes + stat.size > policy.maxTotalBytes) { issue("BYTE_LIMIT", rel); continue; }
            let bytes: Buffer;
            try {
                const handle = await fs.open(file, "r");
                try {
                    const opened = await handle.stat();
                    // Some Windows path-stat providers report dev=0; the open
                    // handle reports the actual volume. Zero is not a device ID.
                    if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== stat.ino || stat.dev !== 0 && opened.dev !== stat.dev || opened.size !== stat.size) throw Error();
                    bytes = Buffer.alloc(stat.size + 1); let read = 0;
                    while (read < bytes.length) { const next = await handle.read(bytes, read, bytes.length - read, read); if (!next.bytesRead) break; read += next.bytesRead; }
                    const after = await handle.stat(), linked = await fs.lstat(file);
                    if (read !== stat.size || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
                        || linked.isSymbolicLink() || linked.ino !== opened.ino || !inside(root, await fs.realpath(file))) throw Error();
                    bytes = bytes.subarray(0, read);
                } finally { await handle.close(); }
            } catch { issue("CHANGED_DURING_SCAN", rel); continue; }
            report.scannedFiles++; report.scannedBytes += bytes.length;
            visited.add(rel);
            const digest = sha(bytes), approved = policy.trustedOpaqueFiles.find(asset => asset.path === rel && asset.sha256 === digest);
            captures.push({ name: rel, digest });
            const filenameScan = scanner.scan(rel);
            if (!filenameScan.complete) { issue("MATCHING_INCOMPLETE", rel); continue; }
            if (filenameScan.findings.length) {
                if (report.findings.length >= 2048) { issue("ENTRY_LIMIT"); stopped = true; break; }
                const safePath = scanner.reportPath(rel, ordinal);
                report.findings.push({ ruleId: "filename_secret", path: safePath, line: 1, column: 1,
                    fingerprint: sha(`${report.policyDigest}:${safePath}:filename_secret`) });
                continue;
            }
            if (approved) { report.approvedOpaqueFiles++; context.onFile?.(rel, Buffer.from(bytes)); continue; }
            let content: string;
            try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); if (content.includes("\0")) throw Error(); }
            catch { issue("UNSUPPORTED_CONTENT", rel); continue; }
            if (/\.(?:zip|tar|gz|tgz|7z|pdf|docx|exe|dll|node)$/i.test(rel)) { issue("UNSUPPORTED_CONTENT", rel); continue; }
            const scan = scanner.scan(content);
            if (!scan.complete) { issue("MATCHING_INCOMPLETE", rel); continue; }
            if (!scan.findings.length) context.onFile?.(rel, Buffer.from(bytes));
            const safePath = scanner.reportPath(rel, ordinal);
            for (const finding of scan.findings) {
                if (report.findings.length >= 2048) { issue("ENTRY_LIMIT"); stopped = true; break; }
                const prefix = content.slice(0, finding.start), line = prefix.split("\n").length, column = finding.start - prefix.lastIndexOf("\n");
                report.findings.push({ ruleId: finding.ruleId, path: safePath, line, column, fingerprint: sha(`${report.policyDigest}:${safePath}:${line}:${column}:${finding.ruleId}`) });
            }
        }
    }
    await visit(root, "", 0);
    if (selected) for (const name of selected) if (!visited.has(name)) issue("READ_FAILED", name);
    if (policy.mode === "artifact" && report.scannedFiles === 0) issue("ROOT_UNAVAILABLE");
    if (report.status !== "incomplete") report.status = report.findings.length ? "findings" : "clean";
    if (report.status === "clean") report.snapshotSha256 = sha(JSON.stringify(captures.sort((a,b) => a.name.localeCompare(b.name))));
    // The last read/callback and digest computation can exhaust the budget too.
    // Never issue an admission receipt after cancellation or deadline expiry.
    if (!current()) delete report.snapshotSha256;
    return report;
}
export const scanExitCode = (report: CiScanReport): number => report.status === "clean" ? 0 : report.status === "findings" ? 1 : 2;
