import { RegisteredSecretMatcher } from "../../../packages/core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor } from "../../../packages/core/src/StreamingOutputRedactor";
import { decodeBoundedJson } from "./BoundedJson";

export type GatewayProvider = "openai" | "anthropic";
export const GATEWAY_LIMITS = Object.freeze({ bytes: 131072, leaves: 32, chunks: 4096, events: 256, lines: 2048, inspectionMs: 1000 });
export class GatewayPolicyError extends Error {
    constructor(readonly code: "gateway_unavailable" | "gateway_policy_unknown" | "gateway_schema_unsupported" | "gateway_limit" | "gateway_sensitive" | "gateway_output_withheld" | "gateway_provider_error" | "gateway_approval_required") { super("Gateway policy withheld protected data"); }
}
const fail = (code: GatewayPolicyError["code"]): never => { throw new GatewayPolicyError(code); };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const common = ["model", "messages", "stream", "temperature", "top_p", "max_tokens", "stop", "tools", "tool_choice", "metadata", "session_id"];
const fields = { openai: new Set([...common, "n", "seed", "user", "response_format", "frequency_penalty", "presence_penalty", "max_completion_tokens", "stream_options", "parallel_tool_calls", "logprobs", "top_logprobs", "reasoning_effort"]), anthropic: new Set([...common, "system", "top_k", "stop_sequences"])};
const messageFields = new Set(["role", "content", "name", "tool_calls", "tool_call_id", "function_call"]);
function strings(value: unknown, result: string[] = []): string[] {
    if (typeof value === "string") { if (result.length >= GATEWAY_LIMITS.leaves) return fail("gateway_limit"); result.push(value); }
    else if (Array.isArray(value)) for (const item of value) strings(item, result);
    else if (record(value)) for (const item of Object.values(value)) strings(item, result);
    return result;
}
function contentStrings(value: unknown, result: string[] = []): string[] {
    if (Array.isArray(value)) for (const item of value) contentStrings(item, result);
    else if (record(value)) for (const [key, item] of Object.entries(value)) {
        if (["content", "text", "arguments", "system"].includes(key) && typeof item === "string") { if (result.length >= 32) return fail("gateway_limit"); result.push(item); }
        else contentStrings(item, result);
    }
    return result;
}
/** Request-local private snapshot. No value-bearing state serializes to audit/UI. */
export class GatewayBoundary {
    #values: readonly string[];
    #matcher: RegisteredSecretMatcher;
    #available: boolean;
    #short: boolean;
    constructor(options: { values: readonly string[]; version: number; enabled?: boolean }) {
        this.#values = Object.freeze(Array.isArray(options.values) ? [...options.values] : []);
        this.#matcher = new RegisteredSecretMatcher(options.values);
        this.#available = options.version === 1 && options.enabled !== false && this.#matcher.inspectRequest([]).status === "CLEAN";
        this.#short = this.#values.some(v => typeof v === "string" && Array.from(v).length < 8);
    }
    available(): boolean { return this.#available; }
    dispose(): void { this.#available = false; this.#values = []; this.#matcher = new RegisteredSecretMatcher([""]); }
    /** Internal fixture capability: clone current registrations without returning them. */
    withSynthetic<T>(value: string, operation: (copy: GatewayBoundary) => Promise<T>): Promise<T> {
        if (!this.#available) return Promise.reject(new GatewayPolicyError("gateway_unavailable"));
        const copy = new GatewayBoundary({ values: [...this.#values, value], version: 1 });
        return operation(copy).finally(() => copy.dispose());
    }
    #inspect(value: unknown, canonical: string, start: number): void {
        if (!this.#available) return fail("gateway_unavailable");
        if (this.#short) return fail("gateway_sensitive");
        const leaves = strings(value), texts = contentStrings(value);
        for (const parts of [[canonical], leaves, texts]) {
            const decision = this.#matcher.inspectRequest(parts);
            if (decision.status === "MATCHED") return fail("gateway_sensitive");
            if (decision.status !== "CLEAN") return fail("gateway_limit");
            if (Date.now() - start > GATEWAY_LIMITS.inspectionMs) return fail("gateway_limit");
        }
    }
    prepareRequest(provider: GatewayProvider, value: unknown): { readonly body: Readonly<Record<string, unknown>>; readonly canonical: string } {
        const start = Date.now();
        try {
            if (!this.#available) return fail("gateway_unavailable");
            if (!Object.hasOwn(fields, provider)) return fail("gateway_policy_unknown");
            const parsed = decodeBoundedJson(Buffer.from(JSON.stringify(value)), { maxBytes: GATEWAY_LIMITS.bytes }), body = parsed.body;
            if (Object.keys(body).some(key => !fields[provider].has(key)) || !Array.isArray(body.messages) || !body.messages.length) return fail("gateway_schema_unsupported");
            if (body.model !== undefined && (typeof body.model !== "string" || !body.model)) return fail("gateway_schema_unsupported");
            if (body.stream !== undefined && typeof body.stream !== "boolean") return fail("gateway_schema_unsupported");
            const textContent = (content: unknown, tools = true): void => {
                if (typeof content === "string" || content === null) return;
                if (!Array.isArray(content)) return fail("gateway_schema_unsupported");
                for (const part of content) {
                    if (!record(part)) return fail("gateway_schema_unsupported");
                    if (part.type === "text" && typeof part.text === "string" && Object.keys(part).every(k => ["type", "text", "cache_control"].includes(k))) continue;
                    if (provider === "anthropic" && tools && part.type === "tool_use" && typeof part.id === "string" && !!part.id && typeof part.name === "string" && !!part.name && record(part.input)
                        && Object.keys(part).every(k => ["type", "id", "name", "input", "cache_control"].includes(k))) continue;
                    if (provider === "anthropic" && tools && part.type === "tool_result" && typeof part.tool_use_id === "string" && !!part.tool_use_id
                        && (part.is_error === undefined || typeof part.is_error === "boolean") && Object.keys(part).every(k => ["type", "tool_use_id", "content", "is_error", "cache_control"].includes(k))) { textContent(part.content, false);continue; }
                    return fail("gateway_schema_unsupported");
                }
            };
            for (const message of body.messages) {
                if (!record(message) || Object.keys(message).some(key => !messageFields.has(key)) || !["system", "user", "assistant", "tool", "function", "developer"].includes(String(message.role))) return fail("gateway_schema_unsupported");
                if (provider === "anthropic" && !["user", "assistant"].includes(String(message.role))) return fail("gateway_schema_unsupported");
                if (Object.hasOwn(message, "content")) textContent(message.content);
                else if (!Array.isArray(message.tool_calls) && !record(message.function_call)) return fail("gateway_schema_unsupported");
            }
            if (body.system !== undefined) textContent(body.system);
            this.#inspect(body, parsed.canonical, start); return Object.freeze(parsed);
        } catch (error) { if (error instanceof GatewayPolicyError) throw error; return fail("gateway_limit"); }
    }
    inspectResponse(provider: GatewayProvider, chunks: readonly Uint8Array[], streaming: boolean): { readonly wire: string; readonly media: string; readonly semantic: string } {
        const start = Date.now(); let redactor: StreamingOutputRedactor | undefined;
        try {
            if (!this.#available || !Object.hasOwn(fields, provider)) return fail("gateway_unavailable");
            if (!Array.isArray(chunks) || chunks.length > GATEWAY_LIMITS.chunks) return fail("gateway_output_withheld");
            redactor = new StreamingOutputRedactor(this.#values, { enabled: () => this.#available });
            let bytes = 0; const buffers: Buffer[] = [];
            for (const chunk of chunks) {
                if (!(chunk instanceof Uint8Array) || (bytes += chunk.byteLength) > GATEWAY_LIMITS.bytes || redactor.push("stdout", chunk).status !== "BUFFERED") return fail("gateway_output_withheld");
                buffers.push(Buffer.from(chunk));
            }
            const wire = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(buffers, bytes)), completed = redactor.finish(0);
            if (completed.status !== "COMPLETE" || completed.redacted || completed.stdout !== wire.replace(/\r\n/g, "\n")) return fail("gateway_output_withheld");
            let semantic: string;
            if (!streaming) {
                const parsed = decodeBoundedJson(Buffer.from(wire), { maxBytes: GATEWAY_LIMITS.bytes });this.#inspect(parsed.body, parsed.canonical, start);
                semantic = contentStrings(parsed.body).join("");
            } else {
                if (!wire.endsWith("\n\n") && !wire.endsWith("\r\n\r\n")) return fail("gateway_output_withheld");
                const rows = wire.replace(/\r\n/g, "\n").split("\n");if (rows.length - 1 > GATEWAY_LIMITS.lines || rows.some(row => row.includes("\r"))) return fail("gateway_output_withheld");
                const data: string[] = [], values: unknown[] = [];let terminal = false, events = 0;
                for (const row of rows) {
                    if (!row) {
                        if (!data.length) continue;
                        if (terminal || ++events > GATEWAY_LIMITS.events) return fail("gateway_output_withheld");
                        const text = data.join("\n");data.length = 0;
                        if (text === "[DONE]") { terminal = true;continue; }
                        const parsed = decodeBoundedJson(Buffer.from(text), { maxBytes: GATEWAY_LIMITS.bytes });values.push(parsed.body);
                        if (provider === "anthropic" && parsed.body.type === "message_stop") terminal = true;
                    } else if (row.startsWith("data:")) data.push(row.slice(5).replace(/^ /, ""));
                    else if (row.startsWith(":")) { /* Opaque comments remain scanned in raw wire. */ }
                    else if (/^(?:event|id|retry):/.test(row)) { /* Fixed metadata is covered by raw-wire matching. */ }
                    else return fail("gateway_output_withheld");
                }
                if (!terminal || !values.length || data.length) return fail("gateway_output_withheld");
                this.#inspect(values, wire, start);
                semantic = contentStrings(values).join("");
            }
            return Object.freeze({ wire, semantic, media: streaming ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8" });
        } catch { return fail("gateway_output_withheld"); } finally { redactor?.dispose(); }
    }
}
