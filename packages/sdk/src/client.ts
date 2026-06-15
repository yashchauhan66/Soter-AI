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
  GuardAction,
  GuardConversationOptions,
  GuardDecision,
  GuardInputRequest,
  GuardOutputRequest,
  GuardResult,
  MetadataValue,
  SecureChatOptions,
  SecureChatResult,
} from "./types";

const DEFAULT_BASE_URL = "https://api.cyberrakshak.dev";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_BLOCKED_RESPONSE = "This request was blocked for security reasons.";

/** Maps the server `action` onto the normalized {@link GuardDecision}. */
export function normalizeDecision(action: GuardAction): GuardDecision {
  switch (action) {
    case "ALLOW":
      return "ALLOW";
    case "ALLOW_WITH_REDACTION":
    case "REWRITE":
      return "REDACT";
    case "HUMAN_REVIEW":
      return "HUMAN_REVIEW";
    case "BLOCK":
    default:
      return "BLOCK";
  }
}

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

export function createClient(options: ClientOptions): CyberRakshakClient {
  return new CyberRakshakClient(options);
}

export class CyberRakshakClient implements CyberRakshakGuard {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly projectId?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly debug: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: ClientOptions) {
    if (!options || !options.apiKey) {
      throw new CyberRakshakError("apiKey is required.", { code: "config_error" });
    }
    // Defensive: never let a secret reach untrusted browser code.
    if (isBrowserLike()) {
      // eslint-disable-next-line no-console
      console.warn(
        "[cyberrakshak] CyberRakshakClient appears to be running in a browser. " +
          "Never embed an API key in client-side code. Call the Guard from a " +
          "server route or proxy instead.",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.projectId = options.projectId;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = Math.max(0, options.retries ?? 0);
    this.debug = options.debug ?? false;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.extraHeaders = options.headers ?? {};
    if (!this.fetchImpl) {
      throw new CyberRakshakError("Global fetch is not available. Pass options.fetch explicitly.", {
        code: "config_error",
      });
    }
  }

  async guardInput(input: GuardInputRequest): Promise<GuardResult> {
    const message = input.message ?? input.text;
    if (!message || !message.trim()) {
      throw new CyberRakshakValidationError("guardInput requires `text` or `message`.", 400);
    }
    return this.post<GuardResult>(
      "/api/guard/input",
      {
        message,
        userId: input.userId,
        sessionId: input.sessionId,
        metadata: this.withProjectMetadata(input.metadata),
      },
      true,
    );
  }

  async guardOutput(input: GuardOutputRequest): Promise<GuardResult> {
    const aiResponse = input.aiResponse ?? input.text;
    if (!aiResponse || !aiResponse.trim()) {
      throw new CyberRakshakValidationError("guardOutput requires `text` or `aiResponse`.", 400);
    }
    return this.post<GuardResult>(
      "/api/guard/output",
      {
        aiResponse,
        sessionId: input.sessionId,
        metadata: this.withProjectMetadata(input.metadata),
      },
      true,
    );
  }

  async analyze(input: AnalyzeRequest): Promise<GuardResult> {
    return this.post<GuardResult>(
      "/api/guard/analyze",
      { text: input.text, direction: input.direction },
      false,
    );
  }

  isAllowed(result: GuardResult): boolean {
    return result.allowed === true && this.decisionOf(result) !== "BLOCK";
  }

  shouldBlock(result: GuardResult): boolean {
    const decision = this.decisionOf(result);
    return result.allowed === false || decision === "BLOCK" || decision === "HUMAN_REVIEW";
  }

  getSafeText(result: GuardResult, fallback?: string): string | undefined {
    return result.safeText ?? result.redactedText ?? fallback;
  }

  async secureChat(input: SecureChatOptions): Promise<SecureChatResult> {
    const blocked = input.blockedResponse ?? DEFAULT_BLOCKED_RESPONSE;
    const inputResult = await this.guardInput({
      message: input.message,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    if (this.shouldBlock(inputResult)) {
      return { reply: inputResult.safeText ?? blocked, blocked: true, inputResult };
    }
    const llmReply = await input.callLLM({
      safeInput: this.getSafeText(inputResult, input.message) ?? input.message,
      original: input.message,
      inputResult,
    });
    const outputResult = await this.guardOutput({
      aiResponse: llmReply,
      sessionId: input.sessionId,
      metadata: input.metadata,
    });
    if (this.shouldBlock(outputResult)) {
      return { reply: outputResult.safeText ?? blocked, blocked: true, inputResult, outputResult };
    }
    return {
      reply: this.getSafeText(outputResult, llmReply) ?? llmReply,
      blocked: false,
      inputResult,
      outputResult,
    };
  }

  /** Ergonomic wrapper around {@link secureChat} matching the docs `guardConversation` shape. */
  guardConversation(input: GuardConversationOptions): Promise<SecureChatResult> {
    return this.secureChat({
      message: input.input,
      userId: input.userId,
      sessionId: input.sessionId,
      metadata: input.metadata,
      blockedResponse: input.blockedResponse,
      callLLM: ({ safeInput }) => input.callLLM(safeInput),
    });
  }

  private decisionOf(result: GuardResult): GuardDecision {
    return result.decision ?? normalizeDecision(result.action);
  }

  private withProjectMetadata(
    metadata?: Record<string, MetadataValue>,
  ): Record<string, MetadataValue> | undefined {
    if (!this.projectId) return metadata;
    return { ...(metadata ?? {}), projectId: this.projectId };
  }

  private async post<T>(path: string, body: unknown, requireApiKey: boolean): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    // attempt 0 is the first try; retries add additional attempts.
    for (;;) {
      try {
        const result = await this.postOnce<T>(url, path, body, requireApiKey);
        return result;
      } catch (caught) {
        const retriable =
          caught instanceof CyberRakshakNetworkError ||
          (caught instanceof CyberRakshakError &&
            typeof caught.status === "number" &&
            caught.status >= 500);
        if (attempt < this.retries && retriable) {
          attempt += 1;
          this.log(`retrying ${path} (attempt ${attempt + 1}/${this.retries + 1})`);
          await delay(Math.min(250 * 2 ** (attempt - 1), 2000));
          continue;
        }
        throw caught;
      }
    }
  }

  private async postOnce<T>(
    url: string,
    path: string,
    body: unknown,
    requireApiKey: boolean,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "cyberrakshak-guard-sdk/0.1",
      ...this.extraHeaders,
    };
    if (requireApiKey) headers["x-api-key"] = this.apiKey;
    this.log(`POST ${path}`);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
    } catch (caught) {
      const aborted = caught instanceof Error && caught.name === "AbortError";
      throw new CyberRakshakNetworkError(
        aborted ? `Request timed out after ${this.timeoutMs}ms.` : "Network request failed.",
        caught,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new CyberRakshakError("Server returned non-JSON response.", { status: response.status });
      }
    }
    if (!response.ok) {
      const message = extractMessage(data) ?? `Request failed with status ${response.status}.`;
      this.log(`error ${response.status} on ${path}`);
      if (response.status === 401 || response.status === 403) {
        throw new CyberRakshakAuthError(message, response.status);
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0) || undefined;
        throw new CyberRakshakRateLimitError(message, response.status, retryAfter);
      }
      if (response.status === 400) {
        throw new CyberRakshakValidationError(message, response.status, data);
      }
      throw new CyberRakshakError(message, { status: response.status, details: data });
    }
    const result = data as GuardResult;
    if (result && typeof result === "object" && typeof result.action === "string" && !result.decision) {
      result.decision = normalizeDecision(result.action);
    }
    return result as T;
  }

  private log(message: string): void {
    if (!this.debug) return;
    // Never log the API key or raw text; only safe diagnostics reach here.
    // eslint-disable-next-line no-console
    console.debug(`[cyberrakshak] ${message}`);
  }
}

/** Backwards-compatible alias retained for existing imports. */
export { CyberRakshakClient as GuardClient };

function extractMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

function isBrowserLike(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { document?: unknown }).document !== "undefined"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
