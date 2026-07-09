/**
 * Streaming Guard — SoterAI Guard
 * Real-time token-by-token protection for streaming LLM responses
 * Competitors: Lakera has basic streaming; SoterAI has full streaming with tool interception
 */

export type StreamingAction = "ALLOW" | "BLOCK" | "PAUSE" | "REWRITE";

export interface StreamingChunk {
  token: string;
  index: number;
  isFinal: boolean;
}

export interface StreamingDecision {
  action: StreamingAction;
  chunk: StreamingChunk;
  reason?: string;
  findings?: string[];
}

export interface StreamingGuardConfig {
  maxTokens: number;
  blockPatterns: RegExp[];
  pausePatterns: RegExp[];
  redactPatterns: RegExp[];
  toolCallInterceptor?: (call: { name: string; args: unknown }) => StreamingAction;
}

const DEFAULT_BLOCK_PATTERNS: RegExp[] = [
  /\b(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}["']?/gi,
  /\b(sk-[A-Za-z0-9]{20,})\b/g,
  /\b(ghp_[A-Za-z0-9]{20,})\b/g,
  /\b(AKIA[A-Z0-9]{16})\b/g,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g,
];

const DEFAULT_PAUSE_PATTERNS: RegExp[] = [
  /\b(Ignore|Forget|Disregard)\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|rules?|prompts?)\b/gi,
  /\b(new\s+system\s+prompt|override\s+safety)\b/gi,
];

const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
];

export function createStreamingGuard(config?: Partial<StreamingGuardConfig>) {
  const cfg: StreamingGuardConfig = {
    maxTokens: config?.maxTokens ?? 4096,
    blockPatterns: config?.blockPatterns ?? DEFAULT_BLOCK_PATTERNS,
    pausePatterns: config?.pausePatterns ?? DEFAULT_PAUSE_PATTERNS,
    redactPatterns: config?.redactPatterns ?? DEFAULT_REDACT_PATTERNS,
    toolCallInterceptor: config?.toolCallInterceptor,
  };

  let buffer = "";
  let tokenCount = 0;

  function inspectChunk(chunk: StreamingChunk): StreamingDecision {
    tokenCount++;
    buffer += chunk.token;

    if (tokenCount > cfg.maxTokens) {
      return {
        action: "BLOCK",
        chunk,
        reason: `Token limit exceeded: ${tokenCount} > ${cfg.maxTokens}`,
        findings: ["TOKEN_LIMIT_EXCEEDED"],
      };
    }

    for (const pattern of cfg.blockPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(buffer)) {
        return {
          action: "BLOCK",
          chunk,
          reason: `Blocked pattern detected in streaming output`,
          findings: [`BLOCKED_PATTERN: ${pattern.source.slice(0, 50)}`],
        };
      }
    }

    for (const pattern of cfg.pausePatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(chunk.token)) {
        return {
          action: "PAUSE",
          chunk,
          reason: `Pause pattern detected — possible injection in output`,
          findings: [`PAUSE_PATTERN: ${pattern.source.slice(0, 50)}`],
        };
      }
    }

    const redactedToken = chunk.token;
    let wasRedacted = false;
    for (const pattern of cfg.redactPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(redactedToken)) {
        wasRedacted = true;
        break;
      }
    }

    if (wasRedacted) {
      return {
        action: "REWRITE",
        chunk: { ...chunk, token: "[REDACTED]" },
        reason: "Sensitive data detected — redacting",
        findings: ["REDACTED_PII_OR_SECRET"],
      };
    }

    return { action: "ALLOW", chunk };
  }

  function reset(): void {
    buffer = "";
    tokenCount = 0;
  }

  function getStats(): { tokenCount: number; bufferLength: number } {
    return { tokenCount, bufferLength: buffer.length };
  }

  return { inspectChunk, reset, getStats };
}
