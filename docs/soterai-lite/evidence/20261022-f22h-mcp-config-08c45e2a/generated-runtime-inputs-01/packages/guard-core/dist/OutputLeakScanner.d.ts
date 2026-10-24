import type { Finding, GuardAction } from "./types";
import { type Canary, type CanaryHit } from "./Canary";
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
export declare function scanAIOutput(text: string, options?: OutputScanOptions): OutputScanResult;
/** Convenience: does this output mention any known vault placeholder? */
export declare function outputReferencesVault(text: string): boolean;
//# sourceMappingURL=OutputLeakScanner.d.ts.map