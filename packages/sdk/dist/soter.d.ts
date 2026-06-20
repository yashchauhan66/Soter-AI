import { GuardClient } from "./client";
import type { ClientOptions, SoterConfig, SoterProtectRequest, SoterProtectResult } from "./types";
/** Resolve Soter variables first while preserving the existing environment contract. */
export declare function resolveSoterConfig(config?: SoterConfig): ClientOptions;
/**
 * Primary Soter client. Existing GuardClient methods remain available for
 * integrations that need lower-level input, output, RAG, or agent controls.
 */
export declare class Soter extends GuardClient {
    constructor(config?: SoterConfig);
    protect(request: SoterProtectRequest): Promise<SoterProtectResult>;
}
//# sourceMappingURL=soter.d.ts.map