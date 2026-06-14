import {
  CyberRakshakAuthError,
  CyberRakshakError,
  CyberRakshakNetworkError,
  CyberRakshakRateLimitError,
  CyberRakshakValidationError,
} from "./errors";
import type {
  AnalyzeRequest,
  ClientOptions,
  GuardInputRequest,
  GuardOutputRequest,
  GuardResult,
  SecureChatOptions,
  SecureChatResult,
} from "./types";

const DEFAULT_BASE_URL = "https://api.cyberrakshak.dev";
const DEFAULT_TIMEOUT_MS = 8000;

export interface CyberRakshakGuard {
  guardInput(input: GuardInputRequest): Promise<GuardResult>;
  guardOutput(input: GuardOutputRequest): Promise<GuardResult>;
  analyze(input: AnalyzeRequest): Promise<GuardResult>;
  secureChat(input: SecureChatOptions): Promise<SecureChatResult>;
}


export function createClient(options: ClientOptions): CyberRakshakGuard {
  return new GuardClient(options);
}

export class GuardClient implements CyberRakshakGuard {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    if (!options.apiKey) throw new CyberRakshakError("apiKey is required.", { code: "config_error" });
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.extraHeaders = options.headers ?? {};
    if (!this.fetchImpl) {
      throw new CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", { code: "config_error" });
    }
  }

  guardInput(input: GuardInputRequest): Promise<GuardResult> {
    return this.post<GuardResult>("/api/guard/input", input, true);
  }

  guardOutput(input: GuardOutputRequest): Promise<GuardResult> {
    return this.post<GuardResult>("/api/guard/output", input, true);
  }

  analyze(input: AnalyzeRequest): Promise<GuardResult> {
    return this.post<GuardResult>("/api/guard/analyze", input, false);
  }

  async secureChat(input: SecureChatOptions): Promise<SecureChatResult> {
    const blocked = input.blockedResponse ?? "This request was blocked for security reasons.";
    const inputResult = await this.guardInput({
      message: input.message,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    if (!inputResult.allowed) {
      return { reply: inputResult.safeText ?? blocked, blocked: true, inputResult };
    }
    const llmReply = await input.callLLM({
      safeInput: inputResult.safeText ?? input.message,
      original: input.message,
      inputResult,
    });


    const outputResult = await this.guardOutput({
      aiResponse: llmReply,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    
    if (!outputResult.allowed) {
      return { reply: outputResult.safeText ?? blocked, blocked: true, inputResult, outputResult };
    }
    return { reply: outputResult.safeText ?? llmReply, blocked: false, inputResult, outputResult };
  }

  private async post<T>(path: string, body: unknown, requireApiKey: boolean): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "cyberrakshak-guard-sdk/0.1",
      ...this.extraHeaders,
    };
    if (requireApiKey) headers["x-api-key"] = this.apiKey;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
    } catch (caught) {
      throw new CyberRakshakNetworkError(
        caught instanceof Error ? caught.message : "Network request failed.",
        caught,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try { data = JSON.parse(text); } catch {
        throw new CyberRakshakError("Server returned non-JSON response.", { status: response.status });
      }
    }
    if (!response.ok) {
      const message = (data && typeof data === "object" && "message" in data && typeof (data as { message?: unknown }).message === "string")
        ? (data as { message: string }).message
        : `Request failed with status ${response.status}.`;
      if (response.status === 401 || response.status === 403) throw new CyberRakshakAuthError(message, response.status);
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
        throw new CyberRakshakRateLimitError(message, response.status, retryAfter);
      }
      if (response.status === 400) throw new CyberRakshakValidationError(message, response.status, data);
      throw new CyberRakshakError(message, { status: response.status, details: data });
    }
    return data as T;
  }
}
