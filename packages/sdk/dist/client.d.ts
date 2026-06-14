import type { AnalyzeRequest, ClientOptions, GuardInputRequest, GuardOutputRequest, GuardResult, SecureChatOptions, SecureChatResult } from "./types";
export interface CyberRakshakGuard {
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
}
export declare function createClient(options: ClientOptions): CyberRakshakGuard;
export declare class GuardClient implements CyberRakshakGuard {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly fetchImpl;
    private readonly extraHeaders;
    constructor(options: ClientOptions);
    guardInput(input: GuardInputRequest): Promise<GuardResult>;
    guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
    analyze(input: AnalyzeRequest): Promise<GuardResult>;
    secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
    private post;
}
//# sourceMappingURL=client.d.ts.map