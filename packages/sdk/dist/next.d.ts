import type { ClientOptions, GuardResult } from "./types";
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
//# sourceMappingURL=next.d.ts.map