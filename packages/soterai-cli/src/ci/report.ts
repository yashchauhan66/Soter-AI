import type { CiScanReport } from "./scan";
export function sarifReport(report: CiScanReport): object {
    const rules = [...new Set(report.findings.map(item => item.ruleId))].sort();
    return { version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: [{
        tool: { driver: { name: "SoterAI Secret Policy", version: report.scannerVersion, rules: rules.map(id => ({ id, shortDescription: { text: "Possible sensitive value" } })) } },
        invocations: [{ executionSuccessful: report.status !== "incomplete", toolExecutionNotifications: report.diagnostics.map(item => ({ level: "error", descriptor: { id: item.code }, message: { text: "Part of the declared scan scope was not verified." } })) }],
        results: report.findings.map(item => ({ ruleId: item.ruleId, level: "error", message: { text: "Possible secret detected; value and source snippet withheld." },
            locations: [{ physicalLocation: { artifactLocation: { uri: item.path.split("/").map(encodeURIComponent).join("/"), uriBaseId: "%SRCROOT%" }, region: { startLine: item.line, startColumn: item.column } } }],
            partialFingerprints: { soteraiLocation: item.fingerprint } })),
        properties: { status: report.status, policyDigest: report.policyDigest, scannedFiles: report.scannedFiles, scope: report.scope } }] };
}

const diagnosticCodes = new Set(["ROOT_UNAVAILABLE", "UNSAFE_PATH", "LINK_REFUSED", "READ_FAILED", "CHANGED_DURING_SCAN", "ENTRY_LIMIT", "FILE_LIMIT", "BYTE_LIMIT", "TIME_LIMIT", "UNSUPPORTED_CONTENT", "MATCHING_INCOMPLETE", "CANCELLED"]);
/** Shareable CI projection: no source paths, snippets, values or fingerprints. */
export function publicCiSummary(report: CiScanReport) {
    if (!report || report.schemaVersion !== 1 || !["clean", "findings", "incomplete"].includes(report.status)
        || !["source", "artifact"].includes(report.scope?.mode) || !Number.isSafeInteger(report.scannedFiles) || report.scannedFiles < 0 || report.scannedFiles > 8192
        || !Number.isSafeInteger(report.scannedBytes) || report.scannedBytes < 0 || report.scannedBytes > 67108864
        || !Array.isArray(report.findings) || report.findings.length > 2048 || !Array.isArray(report.diagnostics) || report.diagnostics.length > 128
        || report.status === "clean" && (report.findings.length || report.diagnostics.length || report.scope.mode === "artifact" && !report.scannedFiles)
        || report.status === "findings" && (!report.findings.length || report.diagnostics.length)
        || report.status !== "incomplete" && report.diagnostics.length) throw Error("Invalid CI summary");
    const categories: Record<string, number> = { registered: 0, password: 0, "sensitive-filename": 0, other: 0 };
    for (const finding of report.findings) {
        const category = finding.ruleId === "registered_secret" ? "registered" : finding.ruleId === "password_assignment" ? "password" : finding.ruleId === "filename_secret" ? "sensitive-filename" : "other";
        categories[category]++;
    }
    const failures = [...new Set(report.diagnostics.map(item => diagnosticCodes.has(item.code) ? item.code : "SCAN_UNAVAILABLE"))].sort();
    if (report.status === "incomplete" && !failures.length) failures.push("SCAN_UNAVAILABLE");
    return { schemaVersion: 1, mode: report.scope.mode, status: report.status, scannedFiles: report.scannedFiles, scannedBytes: report.scannedBytes,
        findingCount: report.findings.length, findingsByCategory: categories, failureCodes: failures };
}
export function githubSummary(report: CiScanReport): string {
    const summary = publicCiSummary(report);
    return [`### SoterAI ${summary.mode} check`, "", `Result: **${summary.status.toUpperCase()}**`, "",
        `Files checked: ${summary.scannedFiles}. Bytes checked: ${summary.scannedBytes}. Findings: ${summary.findingCount}.`, "",
        ...Object.entries(summary.findingsByCategory).filter(([, count]) => count).map(([category, count]) => `- ${category}: ${count}`),
        ...summary.failureCodes.map(code => `- Incomplete: ${code}`), "", "This result applies only to the declared directory and supported inputs. Values, filenames and snippets are withheld.", ""].join("\n");
}
