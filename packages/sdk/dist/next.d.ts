import { CyberRakshakClient } from "./client";
import type { ClientOptions, GuardInputRequest, GuardOutputRequest, GuardResult } from "./types";
export interface SecureChatHandlerOptions extends ClientOptions {
    callLLM: (context: {
        safeInput: string;
        original: string;
        inputResult: GuardResult;
    }) => Promise<string>;
    blockedResponse?: string;
    withholdResponse?: string;
}
/**
 * Returns a Next.js Route Handler that runs a chatbot turn through the input guard,
 * the consumer-provided LLM, and the output guard. Mount it under any POST route.
 */
export declare function secureChatHandler(options: SecureChatHandlerOptions): (request: Request) => Promise<Response>;
/**
 * Run a single request body through the input guard from inside a Next.js
 * Route Handler / Server Action. Returns the typed {@link GuardResult}.
 * Use `client.shouldBlock(result)` to decide whether to proceed.
 */
export declare function guardNextInput(client: CyberRakshakClient, input: GuardInputRequest): Promise<GuardResult>;
/** Output-guard counterpart of {@link guardNextInput}. */
export declare function guardNextOutput(client: CyberRakshakClient, input: GuardOutputRequest): Promise<GuardResult>;
export interface GuardedRouteOptions extends ClientOptions {
    /** Field on the JSON body holding the user message. Default `"message"`. */
    inputField?: string;
    /** Your LLM call. Receives the safe (possibly redacted) input text. */
    callLLM: (safeInput: string) => Promise<string>;
    blockedResponse?: string;
    withholdResponse?: string;
}
/**
 * Convenience factory that returns a Next.js POST handler. Thin wrapper over
 * {@link secureChatHandler} with a configurable input field name. The API key
 * stays server-side; only redacted results are returned to the browser.
 */
export declare function createGuardedRoute(options: GuardedRouteOptions): (request: Request) => Promise<Response>;
//# sourceMappingURL=next.d.ts.map