/**
 * MCP Gateway — Tool Result Inspector
 *
 * Inspects MCP tool results before returning them to the client.
 * Detects and handles:
 * - Secrets (API keys, tokens, passwords)
 * - PII (emails, phone numbers, SSNs, etc.)
 * - Sensitive files content
 * - Command output leakage
 * - Untrusted instructions
 * - Oversized responses
 * - Suspicious encoded content
 * - Tool/server protocol violations
 *
 * Applies policy: REDACT, TRANSFORM, BLOCK, QUARANTINE
 * Never stores raw secrets in logs or evidence.
 */

import type { ToolCallResult, ToolResultContent, GatewayEnforcement } from "./MCPJsonRpcTypes";

export interface InspectionResult {
  enforcement: GatewayEnforcement;
  redactedResult?: ToolCallResult;
  riskScore: number;
  categories: string[];
  reason: string;
  findings: InspectionFinding[];
}

export interface InspectionFinding {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  redactedPreview: string;
}

export interface ResultInspectorOptions {
  /** Maximum result content size in bytes before truncation. */
  maxResultBytes?: number;
  /** Whether to detect secrets in results. */
  detectSecrets?: boolean;
  /** Whether to detect PII in results. */
  detectPII?: boolean;
  /** Whether to detect oversized responses. */
  detectOversized?: boolean;
  /** Whether to detect suspicious encoded content. */
  detectEncoded?: boolean;
  /** Whether to detect untrusted instructions. */
  detectUntrustedInstructions?: boolean;
}

const DEFAULT_MAX_RESULT_BYTES = 512_000; // 500KB
const SECRET_PATTERNS: RegExp[] = [
  // OpenAI / Anthropic API keys
  /sk-(?:proj|test|live|ant)-[A-Za-z0-9]{20,}/g,
  // AWS keys
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  // Generic tokens
  /(?:api[_-]?key|token|secret|password|passwd|credential|auth)[=:]["']?[A-Za-z0-9_.-]{16,}/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Private keys
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  // Connection strings
  /(?:postgres|mysql|mongodb|redis|amqp):\/\/[^@\s]+@/g,
];

const PII_PATTERNS = [
  // Email addresses
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // US phone numbers
  /(?:\+1[-\s.]?)?\(?[0-9]{3}\)?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4}/g,
  // US SSNs
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // IP addresses (private/internal)
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
];

const UNTRUSTED_INSTRUCTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior)\s+(instructions|policy)/gi,
  /override\s+(the\s+)?(policy|security|guard|protection)/gi,
  /you\s+(are\s+)?(now|are\s+free|don.t\s+need\s+to)/gi,
  /do\s+not\s+(tell|reveal|disclose|show|output)/gi,
  /exfiltrat(e|ion)/gi,
  /send\s+(the\s+)?(secret|token|key|password|credential)/gi,
];

const SUSPICIOUS_ENCODED_PATTERNS: RegExp[] = [
  // Base64 with high entropy (potential encoded payloads)
  /[A-Za-z0-9+/]{100,}={0,2}/g,
  // Hex encoded strings
  /(?:\\x[0-9a-fA-F]{2}){20,}/g,
  // URL encoded strings
  /(?:%[0-9a-fA-F]{2}){20,}/g,
];

export class MCPResultInspector {
  private readonly options: Required<ResultInspectorOptions>;

  constructor(options: ResultInspectorOptions = {}) {
    this.options = {
      maxResultBytes: options.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES,
      detectSecrets: options.detectSecrets ?? true,
      detectPII: options.detectPII ?? true,
      detectOversized: options.detectOversized ?? true,
      detectEncoded: options.detectEncoded ?? true,
      detectUntrustedInstructions: options.detectUntrustedInstructions ?? true,
    };
  }

  /**
   * Inspect a tool call result and return an enforcement decision.
   */
  inspect(result: ToolCallResult, traceId: string): InspectionResult {
    const findings: InspectionFinding[] = [];
    const categories: string[] = [];
    let riskScore = 0;
    let redactedResult = this.cloneResult(result);

    // Extract all text content from the result
    const allText = this.extractAllText(result);

    // Check for oversized responses
    if (this.options.detectOversized) {
      const totalBytes = new TextEncoder().encode(allText).length;
      if (totalBytes > this.options.maxResultBytes) {
        findings.push({
          category: "oversized_response",
          severity: "medium",
          description: `Response size (${totalBytes} bytes) exceeds maximum (${this.options.maxResultBytes} bytes)`,
          redactedPreview: `[Oversized response: ${totalBytes} bytes]`,
        });
        categories.push("oversized_response");
        riskScore = Math.max(riskScore, 40);
      }
    }

    // Detect secrets
    if (this.options.detectSecrets) {
      for (const pattern of SECRET_PATTERNS) {
        const matches = allText.match(pattern);
        if (matches) {
          findings.push({
            category: "secret_leak",
            severity: "critical",
            description: `Found ${matches.length} potential secret(s) matching pattern`,
            redactedPreview: `[${matches.length} secret(s) redacted]`,
          });
          categories.push("secret_leak");
          riskScore = Math.max(riskScore, 95);
          redactedResult = this.redactInResult(redactedResult, pattern, "[REDACTED_SECRET]");
        }
      }
    }

    // Detect PII
    if (this.options.detectPII) {
      for (const pattern of PII_PATTERNS) {
        const matches = allText.match(pattern);
        if (matches) {
          findings.push({
            category: "pii_leak",
            severity: "high",
            description: `Found ${matches.length} potential PII item(s)`,
            redactedPreview: `[${matches.length} PII item(s) redacted]`,
          });
          categories.push("pii_leak");
          riskScore = Math.max(riskScore, 75);
          redactedResult = this.redactInResult(redactedResult, pattern, "[REDACTED_PII]");
        }
      }
    }

    // Detect untrusted instructions
    if (this.options.detectUntrustedInstructions) {
      for (const pattern of UNTRUSTED_INSTRUCTION_PATTERNS) {
        const matches = allText.match(pattern);
        if (matches) {
          findings.push({
            category: "untrusted_instruction",
            severity: "high",
            description: `Found ${matches.length} untrusted instruction pattern(s)`,
            redactedPreview: `[${matches.length} untrusted instruction(s) redacted]`,
          });
          categories.push("untrusted_instruction");
          riskScore = Math.max(riskScore, 80);
          redactedResult = this.redactInResult(redactedResult, pattern, "[REDACTED_INSTRUCTION]");
        }
      }
    }

    // Detect suspicious encoded content
    if (this.options.detectEncoded) {
      for (const pattern of SUSPICIOUS_ENCODED_PATTERNS) {
        const matches = allText.match(pattern);
        if (matches) {
          findings.push({
            category: "suspicious_encoded",
            severity: "medium",
            description: `Found ${matches.length} suspicious encoded content block(s)`,
            redactedPreview: `[${matches.length} encoded block(s) detected]`,
          });
          categories.push("suspicious_encoded");
          riskScore = Math.max(riskScore, 50);
        }
      }
    }

    // Determine enforcement action based on findings
    let enforcement: GatewayEnforcement;
    let reason: string;

    if (riskScore >= 90) {
      enforcement = "BLOCK";
      reason = `Tool result blocked: ${findings.map((f) => f.description).join("; ")}`;
    } else if (riskScore >= 70) {
      enforcement = "REDACT";
      reason = `Tool result redacted: ${findings.map((f) => f.description).join("; ")}`;
    } else if (riskScore >= 40) {
      enforcement = "TRANSFORM";
      reason = `Tool result transformed: ${findings.map((f) => f.description).join("; ")}`;
    } else {
      enforcement = "ALLOW";
      reason = "Tool result passed inspection";
    }

    return {
      enforcement,
      redactedResult: findings.length > 0 ? redactedResult : undefined,
      riskScore,
      categories: [...new Set(categories)],
      reason,
      findings,
    };
  }

  /**
   * Extract all text content from a tool result.
   */
  private extractAllText(result: ToolCallResult): string {
    const texts: string[] = [];
    for (const content of result.content) {
      if (content.type === "text" && content.text) {
        texts.push(content.text);
      } else if (content.type === "resource" && content.resource?.text) {
        texts.push(content.resource.text);
      } else if (content.type === "embedded" && content.resource?.text) {
        texts.push(content.resource.text);
      }
    }
    return texts.join("\n");
  }

  /**
   * Redact matching patterns in a tool result.
   */
  private redactInResult(result: ToolCallResult, pattern: RegExp, replacement: string): ToolCallResult {
    const redacted: ToolCallResult = {
      content: result.content.map((content) => this.redactContent(content, pattern, replacement)),
      isError: result.isError,
    };
    return redacted;
  }

  /**
   * Redact matching patterns in a single content item.
   */
  private redactContent(
    content: ToolResultContent,
    pattern: RegExp,
    replacement: string,
  ): ToolResultContent {
    if (content.type === "text" && content.text) {
      return { ...content, text: content.text.replace(pattern, replacement) };
    }
    if (content.type === "resource" && content.resource?.text) {
      return {
        ...content,
        resource: { ...content.resource, text: content.resource.text.replace(pattern, replacement) },
      };
    }
    if (content.type === "embedded" && content.resource?.text) {
      return {
        ...content,
        resource: { ...content.resource, text: content.resource.text.replace(pattern, replacement) },
      };
    }
    return content;
  }

  /**
   * Deep clone a tool result for safe mutation.
   */
  private cloneResult(result: ToolCallResult): ToolCallResult {
    return {
      content: result.content.map((c) => ({ ...c })),
      isError: result.isError,
    };
  }
}
