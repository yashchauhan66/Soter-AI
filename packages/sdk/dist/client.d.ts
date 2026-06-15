import type { AnalyzeRequest, ClientOptions, GuardAction, GuardConversationOptions, GuardDecision, GuardInputRequest, GuardOutputRequest, GuardResult, SecureChatOptions, SecureChatResult } from "./types";
/** Maps the server `action` onto the normalized {@link GuardDecision}. */
export declare function normalizeDecision(action: GuardAction): GuardDecision;
export interface CyberRakshakGuard {
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    guardConversation(input: GuardConversationOptions): Promise<SecureChatResult>;
    isAllowed(result: GuardResult): boolean;
    shouldBlock(result: GuardResult): boolean;
    getSafeText(result: GuardResult, fallback?: string): string | undefined;
}
export declare function createClient(options: ClientOptions): CyberRakshakClient;
export declare class CyberRakshakClient implements CyberRakshakGuard {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly projectId?;
    private readonly timeoutMs;
    private readonly retries;
    private readonly debug;
    private readonly fetchImpl;
    private readonly extraHeaders;
    constructor(options: ClientOptions);
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    isAllowed(result: GuardResult): boolean;
    shouldBlock(result: GuardResult): boolean;
    getSafeText(result: GuardResult, fallback?: string): string | undefined;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    /** Ergonomic wrapper around {@link secureChat} matching the docs `guardConversation` shape. */
    guardConversation(input: GuardConversationOptions): Promise<SecureChatResult>;
    private decisionOf;
    private withProjectMetadata;
    private post;
    private postOnce;
    private log;
}
/** Backwards-compatible alias retained for existing imports. */
export { CyberRakshakClient as GuardClient };
//# sourceMappingURL=client.d.ts.map