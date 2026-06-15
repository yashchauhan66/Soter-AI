export * from "./types";
export * from "./errors";
export { CyberRakshakClient, GuardClient, createClient, normalizeDecision } from "./client";
export type { CyberRakshakGuard as CyberRakshakGuardInterface } from "./client";
import { CyberRakshakClient } from "./client";
import type { ClientOptions } from "./types";
/**
 * Class form kept for backwards compatibility: `new CyberRakshakGuard({ apiKey })`.
 * Identical surface to {@link CyberRakshakClient}; prefer `CyberRakshakClient` in new code.
 */
export declare class CyberRakshakGuard extends CyberRakshakClient {
    constructor(options: ClientOptions);
}
//# sourceMappingURL=index.d.ts.map