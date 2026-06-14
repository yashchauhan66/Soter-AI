export * from "./types";
export * from "./errors";
export { GuardClient, createClient } from "./client";
import { GuardClient } from "./client";
import type { ClientOptions } from "./types";
/**
 * Class form: `new CyberRakshakGuard({ apiKey })`.
 * Functionally identical to `createClient`. Implements the same surface as the GuardClient.
 */
export declare class CyberRakshakGuard extends GuardClient {
    constructor(options: ClientOptions);
}
//# sourceMappingURL=index.d.ts.map