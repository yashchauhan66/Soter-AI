import type { AnalyzeRequest, ClientOptions, ExpressLikeNext, ExpressLikeRequest, ExpressLikeResponse, GuardInputRequest, GuardOutputRequest, GuardResult, ProtectChatOptions, ProtectChatResult, ProtectRagOptions, ProtectRagResult, RagSource, SecureChatOptions, SecureChatResult } from "./types";
export interface CyberRakshakGuard {
    input(message: string, options?: Omit<GuardInputRequest, "message">): Promise<GuardResult>;
    output(aiResponse: string, options?: Omit<GuardOutputRequest, "aiResponse">): Promise<GuardResult>;
    analyze(text: string, direction: AnalyzeRequest["direction"]): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    protectChat(input: ProtectChatOptions): Promise<ProtectChatResult>;
    protectRag(input: ProtectRagOptions): Promise<ProtectRagResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    shouldCallLLM(result: GuardResult): boolean;
    getSafeInput(result: GuardResult, originalMessage: string): string;
    getSafeOutput(result: GuardResult, originalOutput: string): string;
    createExpressMiddleware(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
    createNextHandler(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (request: Request) => Promise<Response>;
}
export declare function createClient(options: ClientOptions): CyberRakshakGuard;
export declare class GuardClient implements CyberRakshakGuard {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly retryBackoffMs;
    private readonly fetchImpl;
    private readonly extraHeaders;
    constructor(options: ClientOptions);
    input(message: string, options?: Omit<GuardInputRequest, "message">): Promise<GuardResult>;
    output(aiResponse: string, options?: Omit<GuardOutputRequest, "aiResponse">): Promise<GuardResult>;
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(textOrInput: string | AnalyzeRequest, direction?: AnalyzeRequest["direction"]): Promise<GuardResult>;
    shouldCallLLM(result: GuardResult): boolean;
    getSafeInput(result: GuardResult, originalMessage: string): string;
    getSafeOutput(result: GuardResult, originalOutput: string): string;
    protectChat(input: ProtectChatOptions): Promise<ProtectChatResult>;
    protectRag<TSource extends RagSource = RagSource>(input: ProtectRagOptions<TSource>): Promise<ProtectRagResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    createExpressMiddleware(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: ExpressLikeNext) => Promise<unknown>;
    createNextHandler(options: Omit<ProtectChatOptions, "message" | "userId" | "sessionId" | "metadata">): (request: Request) => Promise<Response>;
    private post;
    private fetchWithNetworkRetry;
}
//# sourceMappingURL=client.d.ts.map