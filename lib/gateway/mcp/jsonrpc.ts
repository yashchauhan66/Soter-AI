/**
 * Bounded JSON-RPC parsing/framing for the MCP gateway.
 *
 * MCP stdio transport is newline-delimited JSON. All parsing here is bounded:
 * a hard byte cap and a recursion-depth cap defend against oversized or deeply
 * nested payloads (billion-laughs style) before any policy logic runs.
 */
import type { JsonRpcMessage, JsonRpcId } from "./types";

export class BoundedParseError extends Error {
  constructor(
    message: string,
    readonly code: "TOO_LARGE" | "TOO_DEEP" | "MALFORMED",
  ) {
    super(message);
    this.name = "BoundedParseError";
  }
}

/** Measure structural depth without trusting JSON.parse to bound it. */
function assertDepth(value: unknown, maxDepth: number, depth = 0): void {
  if (depth > maxDepth) throw new BoundedParseError("payload nesting too deep", "TOO_DEEP");
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertDepth(item, maxDepth, depth + 1);
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    assertDepth((value as Record<string, unknown>)[key], maxDepth, depth + 1);
  }
}

export function parseBounded(raw: string, maxBytes: number, maxDepth: number): unknown {
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > maxBytes) throw new BoundedParseError(`message ${bytes}B exceeds ${maxBytes}B`, "TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BoundedParseError("invalid JSON", "MALFORMED");
  }
  assertDepth(parsed, maxDepth);
  return parsed;
}

export function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.jsonrpc !== "2.0") return false;
  const hasMethod = typeof v.method === "string";
  const hasResultOrError = "result" in v || "error" in v;
  return hasMethod || hasResultOrError;
}

export function isRequest(msg: JsonRpcMessage): msg is import("./types").JsonRpcRequest {
  return "method" in msg && "id" in msg && (msg as { id: unknown }).id !== undefined;
}

export function isNotification(msg: JsonRpcMessage): msg is import("./types").JsonRpcNotification {
  return "method" in msg && !("id" in msg);
}

export function isResponse(msg: JsonRpcMessage): boolean {
  return "result" in msg || "error" in msg;
}

export function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): string {
  const payload: Record<string, unknown> = { jsonrpc: "2.0", id, error: { code, message } };
  if (data !== undefined) (payload.error as Record<string, unknown>).data = data;
  return JSON.stringify(payload);
}

/**
 * Newline-delimited line splitter with a hard buffer cap. Feed raw chunks;
 * yields complete lines. Prevents unbounded buffering on a stuck stream.
 */
export class LineFramer {
  private buffer = "";
  constructor(private readonly maxLineBytes: number) {}

  push(chunk: string, onLine: (line: string) => void, onOverflow: () => void): void {
    this.buffer += chunk;
    if (Buffer.byteLength(this.buffer, "utf8") > this.maxLineBytes * 2) {
      this.buffer = "";
      onOverflow();
      return;
    }
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0) onLine(line);
    }
  }
}
