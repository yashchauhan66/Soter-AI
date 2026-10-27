/** The eight exact protection levels from Section 3. Ordered strongest→weakest. */
export type ProtectionLevelName = "FULL_ENFORCEMENT" | "STRONG_ENFORCEMENT" | "PARTIAL_ENFORCEMENT" | "ADVISORY_ONLY" | "DETECTION_ONLY" | "VISIBILITY_ONLY" | "UNSUPPORTED" | "UNKNOWN_NOT_TESTED";
/** Levels that assert a real, pre-execution enforcement claim to the user. */
export declare const ENFORCING_LEVELS: ReadonlySet<ProtectionLevelName>;
export interface ProtectionCapability {
    id: string;
    name: string;
    category: string;
    level: ProtectionLevelName;
    integration: string;
    /** File(s) where the security decision is actually made. */
    enforcementPoint?: string;
    /** Does SoterAI block BEFORE the protected action executes? */
    preExecutionBlock: boolean;
    rollbackSupported: boolean;
    conditions: string[];
    knownBypasses: string[];
    /** Test ids proving the behaviour (behavioural, not string-inspection). */
    evidenceTestIds: string[];
    lastVerifiedVersion?: string;
    /**
     * HONESTY FLAG (extends the Section 5 baseline type): does a real caller in
     * a SHIPPED runtime (packaged extension/broker, or a deployed web
     * control-plane route) route through `enforcementPoint`? `false` means the
     * engine exists and unit-tests pass, but no shipped code path invokes it
     * yet — so it cannot claim runtime enforcement.
     */
    wiredInRuntime: boolean;
}
export interface CapabilityEvidenceRecord extends ProtectionCapability {
    enforcementPoint: string;
    evidenceLevel: ProtectionLevelName;
    supportedSurfaces: string[];
    unsupportedSurfaces: string[];
    runtimeProof: {
        wiredInRuntime: boolean;
        testIds: string[];
    };
    latency: {
        status: "MEASURED" | "NOT_MEASURED_PER_CAPABILITY";
        evidence: string | null;
    };
}
/**
 * The registry. Each entry's `level` is what SoterAI can HONESTLY claim in the
 * packaged runtime today — not what the engine could do once wired. Six
 * guard-core engines (taint, file/network/process firewalls, governance,
 * checkpoint) remain implemented-but-unwired (UNKNOWN_NOT_TESTED). MCP gateway
 * is wired as DETECTION_ONLY via broker preflight + extension command — not
 * FULL/STRONG universal interception.
 */
export declare const CAPABILITY_REGISTRY: ProtectionCapability[];
/** A violation of the honesty invariant. */
export interface HonestyViolation {
    id: string;
    reason: string;
}
/**
 * The honesty invariant, in code. Returns every capability that makes a claim
 * it cannot back:
 *   1. Claims an ENFORCING level (FULL/STRONG) but is not wired into the runtime.
 *   2. Claims pre-execution blocking but is not wired into the runtime.
 *   3. Claims an ENFORCING level but declares no enforcement point.
 * An empty array means the registry is honest.
 */
export declare function findHonestyViolations(caps?: readonly ProtectionCapability[]): HonestyViolation[];
/** Throws if the registry makes any dishonest claim. Call from CI/tests. */
export declare function assertHonestLevels(caps?: readonly ProtectionCapability[]): void;
/** Stable serializable snapshot for artifacts/security/capabilities.json. */
export declare function capabilitiesSnapshot(): {
    generatedFor: string;
    honest: boolean;
    counts: Record<string, number>;
    capabilities: CapabilityEvidenceRecord[];
};
//# sourceMappingURL=CapabilityRegistry.d.ts.map