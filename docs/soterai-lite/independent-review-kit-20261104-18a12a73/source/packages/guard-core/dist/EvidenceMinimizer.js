"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimizeEvidence = minimizeEvidence;
exports.createEvidencePreview = createEvidencePreview;
const Redactor_1 = require("./Redactor");
/**
 * Evidence minimizer — converts raw detector matches into safe Findings.
 * Raw match content is redacted before being stored/displayed.
 */
function minimizeEvidence(matches, detectorName) {
    return matches.map((m, idx) => ({
        id: `${detectorName}-${m.type}-${m.start}-${idx}`,
        category: m.type,
        severity: mapSeverity(m.severity),
        title: m.label,
        reason: m.message,
        redactedEvidence: (0, Redactor_1.redactMatch)(m.match, m.type),
        start: m.start,
        end: m.end,
        confidence: m.confidence,
    }));
}
/**
 * Create evidence preview from findings without raw content.
 * Max 200 chars.
 */
function createEvidencePreview(findings) {
    if (!findings.length)
        return "No findings.";
    const parts = findings.slice(0, 5).map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.redactedEvidence}`);
    const preview = parts.join(" | ");
    if (findings.length > 5)
        return `${preview} ... (+${findings.length - 5} more)`;
    return preview.slice(0, 200);
}
function mapSeverity(s) {
    const map = {
        low: "low", medium: "medium", high: "high", critical: "critical",
    };
    return map[s] ?? "medium";
}
//# sourceMappingURL=EvidenceMinimizer.js.map