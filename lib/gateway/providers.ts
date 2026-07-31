/**
 * Provider adapters — SoterAI Universal AI Gateway.
 *
 * Each adapter knows one provider's wire shapes: how to pull scannable text
 * out of a request, how to substitute transformed (redacted/rewritten) text
 * back in, how to read assistant text from a response, and how to parse SSE
 * stream deltas. The gateway core is provider-agnostic.
 *
 * SSRF note: upstream hosts are fixed per adapter (env-overridable by the
 * OPERATOR only — never by request headers or body).
 */

type JsonObject = Record<string, unknown>;

export interface ProviderAdapter {
  id: "openai" | "anthropic";
  upstreamUrl(): string;
  /** Header that carries the PROVIDER credential (passed through, never logged). */
  providerAuthHeaders: string[];
  /** Additional headers safe to forward upstream. */
  forwardHeaders: string[];
  extractRequestTexts(body: JsonObject): string[];
  /** Returns a deep-copied body with every scannable text run through `transform`. */
  transformRequestTexts(body: JsonObject, transform: (text: string) => string): JsonObject;
  isStreamRequest(body: JsonObject): boolean;
  modelOf(body: JsonObject): string | null;
  extractResponseText(json: JsonObject): string;
  /**
   * Substitute assistant text. When `blocked`, all content is replaced with
   * `text` and tool calls are stripped (a blocked response must not carry
   * executable side-effects).
   */
  transformResponseText(json: JsonObject, text: string, blocked: boolean): JsonObject;
  /** Extract the incremental text of one parsed SSE data payload (null = none). */
  extractStreamDelta(data: JsonObject): string | null;
  /** SSE frames that terminate a blocked stream in a client-parseable way. */
  blockedStreamFrames(message: string): string[];
  /** Provider-shaped JSON error body for a request blocked before forwarding. */
  blockedRequestBody(message: string): JsonObject;
}

function asTextParts(content: unknown): string[] {
  if (typeof content === "string") return content.length > 0 ? [content] : [];
  if (!Array.isArray(content)) return [];
  const parts: string[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && typeof (part as JsonObject).text === "string") {
      parts.push((part as { text: string }).text);
    }
  }
  return parts;
}

function transformContent(content: unknown, transform: (text: string) => string): unknown {
  if (typeof content === "string") return content.length > 0 ? transform(content) : content;
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (part && typeof part === "object" && typeof (part as JsonObject).text === "string") {
      return { ...(part as JsonObject), text: transform((part as { text: string }).text) };
    }
    return part;
  });
}

const OPENAI_DEFAULT_UPSTREAM = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_DEFAULT_UPSTREAM = "https://api.anthropic.com/v1/messages";

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  upstreamUrl: () => process.env.SOTERAI_GATEWAY_OPENAI_UPSTREAM ?? OPENAI_DEFAULT_UPSTREAM,
  providerAuthHeaders: ["authorization"],
  forwardHeaders: ["content-type", "accept", "openai-organization", "openai-project", "openai-beta"],

  extractRequestTexts(body) {
    const texts: string[] = [];
    const messages = Array.isArray(body.messages) ? body.messages : [];
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      texts.push(...asTextParts((message as JsonObject).content));
    }
    return texts;
  },

  transformRequestTexts(body, transform) {
    const copy = structuredClone(body);
    if (Array.isArray(copy.messages)) {
      copy.messages = copy.messages.map((message: unknown) => {
        if (!message || typeof message !== "object") return message;
        const m = message as JsonObject;
        return { ...m, content: transformContent(m.content, transform) };
      });
    }
    return copy;
  },

  isStreamRequest: (body) => body.stream === true,
  modelOf: (body) => (typeof body.model === "string" ? body.model : null),

  extractResponseText(json) {
    const texts: string[] = [];
    const choices = Array.isArray(json.choices) ? json.choices : [];
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const message = (choice as JsonObject).message as JsonObject | undefined;
      if (!message || typeof message !== "object") continue;
      texts.push(...asTextParts(message.content));
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      for (const call of toolCalls) {
        const fn = (call as JsonObject)?.function as JsonObject | undefined;
        if (fn && typeof fn.arguments === "string") texts.push(fn.arguments);
      }
    }
    return texts.join("\n");
  },

  transformResponseText(json, text, blocked) {
    const copy = structuredClone(json);
    if (!Array.isArray(copy.choices)) return copy;
    copy.choices = copy.choices.map((choice: unknown) => {
      if (!choice || typeof choice !== "object") return choice;
      const c = { ...(choice as JsonObject) };
      const message = c.message && typeof c.message === "object" ? { ...(c.message as JsonObject) } : null;
      if (message) {
        message.content = text;
        if (blocked) {
          delete message.tool_calls;
          c.finish_reason = "content_filter";
        }
        c.message = message;
      }
      return c;
    });
    return copy;
  },

  extractStreamDelta(data) {
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const first = choices[0] as JsonObject | undefined;
    const delta = first?.delta as JsonObject | undefined;
    if (!delta || typeof delta !== "object") return null;
    const parts: string[] = [];
    if (typeof delta.content === "string") parts.push(delta.content);
    const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const call of toolCalls) {
      const fn = (call as JsonObject)?.function as JsonObject | undefined;
      if (fn && typeof fn.arguments === "string") parts.push(fn.arguments);
    }
    return parts.length > 0 ? parts.join("") : null;
  },

  blockedStreamFrames(message) {
    const payload = {
      id: "soterai-gateway-block",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: { content: `\n[SoterAI Gateway] ${message}` },
          finish_reason: "content_filter",
        },
      ],
    };
    return [`data: ${JSON.stringify(payload)}\n\n`, "data: [DONE]\n\n"];
  },

  blockedRequestBody(message) {
    return {
      error: {
        message: `[SoterAI Gateway] ${message}`,
        type: "soterai_guard_blocked",
        code: "content_blocked",
      },
    };
  },
};

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  upstreamUrl: () => process.env.SOTERAI_GATEWAY_ANTHROPIC_UPSTREAM ?? ANTHROPIC_DEFAULT_UPSTREAM,
  providerAuthHeaders: ["x-api-key", "authorization"],
  forwardHeaders: ["content-type", "accept", "anthropic-version", "anthropic-beta"],

  extractRequestTexts(body) {
    const texts: string[] = [];
    texts.push(...asTextParts(body.system));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      texts.push(...asTextParts((message as JsonObject).content));
    }
    return texts;
  },

  transformRequestTexts(body, transform) {
    const copy = structuredClone(body);
    if (copy.system !== undefined) copy.system = transformContent(copy.system, transform);
    if (Array.isArray(copy.messages)) {
      copy.messages = copy.messages.map((message: unknown) => {
        if (!message || typeof message !== "object") return message;
        const m = message as JsonObject;
        return { ...m, content: transformContent(m.content, transform) };
      });
    }
    return copy;
  },

  isStreamRequest: (body) => body.stream === true,
  modelOf: (body) => (typeof body.model === "string" ? body.model : null),

  extractResponseText(json) {
    const texts: string[] = [];
    const content = Array.isArray(json.content) ? json.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as JsonObject;
      if (typeof b.text === "string") texts.push(b.text);
      if (b.type === "tool_use" && b.input !== undefined) texts.push(JSON.stringify(b.input));
    }
    return texts.join("\n");
  },

  transformResponseText(json, text, blocked) {
    const copy = structuredClone(json);
    if (blocked) {
      copy.content = [{ type: "text", text }];
      copy.stop_reason = "end_turn";
      return copy;
    }
    if (Array.isArray(copy.content)) {
      let replaced = false;
      const blocks = copy.content.map((block: unknown) => {
        if (!replaced && block && typeof block === "object" && typeof (block as JsonObject).text === "string") {
          replaced = true;
          return { ...(block as JsonObject), text };
        }
        return block;
      });
      copy.content = replaced ? blocks : [{ type: "text", text }, ...blocks];
    }
    return copy;
  },

  extractStreamDelta(data) {
    if (data.type !== "content_block_delta") return null;
    const delta = data.delta as JsonObject | undefined;
    if (!delta || typeof delta !== "object") return null;
    if (typeof delta.text === "string") return delta.text;
    if (typeof delta.partial_json === "string") return delta.partial_json;
    return null;
  },

  blockedStreamFrames(message) {
    const payload = {
      type: "error",
      error: { type: "api_error", message: `[SoterAI Gateway] ${message}` },
    };
    return [`event: error\ndata: ${JSON.stringify(payload)}\n\n`];
  },

  blockedRequestBody(message) {
    return {
      type: "error",
      error: { type: "invalid_request_error", message: `[SoterAI Gateway] ${message}` },
    };
  },
};
