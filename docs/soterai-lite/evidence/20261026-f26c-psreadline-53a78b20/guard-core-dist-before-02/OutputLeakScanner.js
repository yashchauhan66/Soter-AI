"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanAIOutput = scanAIOutput;
exports.outputReferencesVault = outputReferencesVault;
const SecretDetector_1 = require("./detectors/SecretDetector");
const OutputExfiltrationDetector_1 = require("./detectors/OutputExfiltrationDetector");
const utils_1 = require("./detectors/utils");
const EvidenceMinimizer_1 = require("./EvidenceMinimizer");
const Canary_1 = require("./Canary");
const Vault_1 = require("./Vault");
function scanAIOutput(text, options) {
    const secretResult = (0, SecretDetector_1.detectSecrets)(text);
    const exfilResult = (0, OutputExfiltrationDetector_1.detectOutputExfiltration)(text);
    const canaryHits = options?.canaries?.length ? (0, Canary_1.matchCanaries)(text, options.canaries) : [];
    const canaryLeaked = canaryHits.length > 0;
    // Placeholder reversal: a raw-looking value adjacent to a known placeholder,
    // or the placeholder appearing verbatim in "reveal" style output.
    const placeholderHitCount = (options?.placeholders ?? []).reduce((n, ph) => n + (text.includes(ph) ? 1 : 0), 0);
    const allMatches = (0, utils_1.deduplicateMatches)([...secretResult.matches, ...exfilResult.matches]);
    const scoringMatches = (0, utils_1.collapseOverlappingMatches)(allMatches);
    let riskScore = Math.min(100, scoringMatches.reduce((sum, m) => sum + m.score, 0));
    if (placeholderHitCount > 0)
        riskScore = Math.min(100, riskScore + 20);
    if (canaryLeaked)
        riskScore = 100; // A canary leak is unambiguous.
    const findings = [
        ...(0, EvidenceMinimizer_1.minimizeEvidence)(secretResult.matches, secretResult.detectorName),
        ...(0, EvidenceMinimizer_1.minimizeEvidence)(exfilResult.matches, exfilResult.detectorName),
    ];
    // Surface canary hits as findings with redacted previews (never raw token).
    for (const hit of canaryHits) {
        findings.push({
            id: `canary-${hit.id}`,
            category: "canary",
            severity: "critical",
            title: "Canary secret detected in AI output",
            reason: `A SoterAI canary (${hit.redactedPreview}) appeared ${hit.count}× — an AI tool likely read protected context.`,
            redactedEvidence: hit.redactedPreview,
            confidence: 1,
        });
    }
    const categories = [
        ...new Set([
            ...scoringMatches.map((m) => m.type),
            ...(canaryLeaked ? ["canary"] : []),
            ...(placeholderHitCount > 0 ? ["placeholder_reversal"] : []),
        ]),
    ].sort();
    let decision = "allow";
    if (canaryLeaked || riskScore >= 70)
        decision = "block";
    else if (riskScore >= 35)
        decision = "warn";
    else if (riskScore > 0)
        decision = "warn";
    return {
        decision,
        riskScore,
        canaryLeaked,
        leakedCanaries: canaryHits,
        findings,
        evidencePreview: (0, EvidenceMinimizer_1.createEvidencePreview)(findings),
        categories,
    };
}
/** Convenience: does this output mention any known vault placeholder? */
function outputReferencesVault(text) {
    return text.includes(`[${Vault_1.PLACEHOLDER_PREFIX}`) || text.includes(Vault_1.PLACEHOLDER_PREFIX);
}
//# sourceMappingURL=OutputLeakScanner.js.map