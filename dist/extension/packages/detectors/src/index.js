import { detectBusinessSensitive } from "./business-sensitive.js";
import { detectSourceCode } from "./code.js";
import { detectPiiGlobal } from "./pii-global.js";
import { detectPiiIndia } from "./pii-india.js";
import { detectPromptInjection } from "./prompt-injection.js";
import { detectSecrets } from "./secrets.js";
export function scanText(text) {
    const findings = dedupeFindings([
        ...detectSecrets(text),
        ...detectPiiIndia(text),
        ...detectPiiGlobal(text),
        ...detectSourceCode(text),
        ...detectBusinessSensitive(text),
        ...detectPromptInjection(text),
    ]);
    const detectedDataTypes = Array.from(new Set(findings.map((finding) => finding.type))).sort();
    const riskScore = Math.min(100, findings.reduce((sum, finding) => sum + finding.score, 0));
    return { findings, detectedDataTypes, riskScore };
}
function dedupeFindings(findings) {
    const seen = new Set();
    return findings
        .sort((a, b) => a.start - b.start || b.score - a.score)
        .filter((finding) => {
        const key = `${finding.type}:${finding.start}:${finding.end}:${finding.match}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
export * from "./business-sensitive.js";
export * from "./code.js";
export * from "./core.js";
export * from "./pii-global.js";
export * from "./pii-india.js";
export * from "./prompt-injection.js";
export * from "./secrets.js";
