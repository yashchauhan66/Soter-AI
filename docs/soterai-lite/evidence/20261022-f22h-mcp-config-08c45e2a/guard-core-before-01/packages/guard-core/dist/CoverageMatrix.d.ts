/** Honest coverage level. Mirrors the extension's ProtectionLevel vocabulary. */
export type CoverageLevel = "ENFORCED" | "REDACTED" | "MONITORED" | "UNKNOWN";
export interface RouteCoverage {
    /** Stable id, e.g. "soterai-broker". */
    id: string;
    /** Human label, e.g. "SoterAI Local Broker". */
    route: string;
    /** What SoterAI can technically do on this route. */
    level: CoverageLevel;
    /** Can SoterAI observe traffic/content on this route at all? */
    observable: boolean;
    /** Can SoterAI transform (redact/tokenize) before it leaves? */
    transformable: boolean;
    /** Can SoterAI block/prevent plaintext exposure on this route? */
    enforceable: boolean;
    /** Honest one-line explanation, including the limitation. */
    note: string;
}
/**
 * The canonical coverage matrix. Order is stable for display. This is the
 * single source of truth for "what can SoterAI actually do here" — every badge
 * and marketing claim must be consistent with it.
 */
export declare const ROUTE_COVERAGE: RouteCoverage[];
/**
 * Coverage for a plaintext secret sitting in a workspace file, given whether
 * the user has migrated it to the vault/broker. This is the exact honesty
 * decision behind Scenario B: an un-migrated plaintext secret is MONITORED
 * (never ENFORCED), because any extension/process can read the file directly.
 */
export declare function plaintextSecretCoverage(opts: {
    migratedToVault: boolean;
    brokered: boolean;
}): RouteCoverage;
//# sourceMappingURL=CoverageMatrix.d.ts.map