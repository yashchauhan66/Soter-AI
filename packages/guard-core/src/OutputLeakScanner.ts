import type { Finding, GuardAction } from "./types";
import { detectSecrets } from "./detectors/SecretDetector";
import { detectOutputExfiltration } from "./detectors/OutputExfiltrationDetector";
import { deduplicateMatches, collapseOverlappingMatches } from "./detectors/utils";
import { minimizeEvidence, createEvidencePreview } from "./EvidenceMinimizer";
import { matchCanaries, type Canary, type CanaryHit } from "./Canary";
import { PLACEHOLDER_PREFIX } from "./Vault";

/**
 * OutputLeakScanner — the Phase 6 "Scan AI Output" brain. Composes:
 *   1. SecretDetector — raw secrets that leaked into the output.
 *   2. OutputExfiltrationDetector — intent to send secrets away.
 *   3. Canary matching — proof a planted secret was seen by the AI.
 *   4. Placeholder-reversal check — output that reconstructs a vaulted value.
 *
 * Returns redacted evidence only. A canary hit is always CRITICAL.
 */

export interface OutputScanOptions {
    /** Active canaries to look for (raw tokens compared in memory only). */
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    /** Known SoterAI placeholders (e.g. from the vault) to watch for reversal. */
    placeholders?: string[];
}

export interface OutputScanResult {
    decision: GuardAction;
    riskScore: number;
    /** True when a planted canary appeared — highest-signal leak evidence. */
    canaryLeaked: boolean;
    leakedCanaries: CanaryHit[];
    findings: Finding[];
    evidencePreview: string;
    /** Categories present (secret types + exfil types + `canary`). */
    categories: string[];
}

export function scanAIOutput(text: string, options?: OutputScanOptions): OutputScanResult {
    const secretResult = detectSecrets(text);
    const exfilResult = detectOutputExfiltration(text);

    const canaryHits = options?.canaries?.length ? matchCanaries(text, options.canaries) : [];
    const canaryLeaked = canaryHits.length > 0;

    // Placeholder reversal: a raw-looking value adjacent to a known placeholder,
    // or the placeholder appearing verbatim in "reveal" style output.
    const placeholderHitCount = (options?.placeholders ?? []).reduce(
        (n, ph) => n + (text.includes(ph) ? 1 : 0),
        0,
    );

    const allMatches = deduplicateMatches([...secretResult.matches, ...exfilResult.matches]);
    const scoringMatches = collapseOverlappingMatches(allMatches);

    let riskScore = Math.min(100, scoringMatches.reduce((sum, m) => sum + m.score, 0));
    if (placeholderHitCount > 0) riskScore = Math.min(100, riskScore + 20);
    if (canaryLeaked) riskScore = 100; // A canary leak is unambiguous.

    const findings: Finding[] = [
        ...minimizeEvidence(secretResult.matches, secretResult.detectorName),
        ...minimizeEvidence(exfilResult.matches, exfilResult.detectorName),
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

    let decision: GuardAction = "allow";
    if (canaryLeaked || riskScore >= 70) decision = "block";
    else if (riskScore >= 35) decision = "warn";
    else if (riskScore > 0) decision = "warn";

    return {
        decision,
        riskScore,
        canaryLeaked,
        leakedCanaries: canaryHits,
        findings,
        evidencePreview: createEvidencePreview(findings),
        categories,
    };
}

/** Convenience: does this output mention any known vault placeholder? */
export function outputReferencesVault(text: string): boolean {
    return text.includes(`[${PLACEHOLDER_PREFIX}`) || text.includes(PLACEHOLDER_PREFIX);
}
