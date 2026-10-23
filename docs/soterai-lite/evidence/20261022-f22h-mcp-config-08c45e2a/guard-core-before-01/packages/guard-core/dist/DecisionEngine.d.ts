import type { GuardDecision, ScanOptions, ScanPipeline } from "./types";
import { PolicyEvaluator } from "./PolicyEvaluator";
import { HashCache } from "./HashCache";
/** Bump when detector selection / pipeline semantics change (invalidates cache). */
export declare const SCAN_PIPELINE_VERSION = "1.3.0";
export declare const DETECTOR_VERSIONS: Record<string, string>;
/**
 * Shared scan-policy for every entry path (live scan, manual scan, clipboard,
 * broker preflight, etc.). Callers must not invent private detector lists.
 */
export declare function resolveScanPipeline(context?: ScanOptions["context"]): ScanPipeline;
export declare class DecisionEngine {
    private policyEvaluator;
    private hashCache;
    private maxContentLength;
    constructor(opts?: {
        policyEvaluator?: PolicyEvaluator;
        hashCache?: HashCache;
        maxContentLength?: number;
    });
    scan(text: string, options?: ScanOptions): Promise<GuardDecision>;
    /**
     * Shared detector selection. Every scan path (live, manual, clipboard,
     * broker) must go through this so detector lists cannot drift.
     */
    private runDetectors;
    getCache(): HashCache;
    getPolicyEvaluator(): PolicyEvaluator;
}
//# sourceMappingURL=DecisionEngine.d.ts.map