import { RegisteredSecretMatcher } from "../../../packages/core/src/RegisteredSecretMatcher";
import { StreamingOutputRedactor } from "../../../packages/core/src/StreamingOutputRedactor";
import { decodeBoundedJson } from "./BoundedJson";
import { validateCodexRequest, validateCodexEvent, codexStrings } from "./CodexResponsesSchema";

export type GatewayProvider = "openai" | "anthropic" | "codex";
export const GATEWAY_LIMITS = Object.freeze({ bytes: 131072, leaves: 32, chunks: 4096, events: 256, lines: 2048, inspectionMs: 1000 });
export class GatewayPolicyError extends Error {
    constructor(readonly code: "gateway_unavailable" | "gateway_policy_unknown" | "gateway_schema_unsupported" | "gateway_limit" | "gateway_sensitive" | "gateway_output_withheld" | "gateway_provider_error" | "gateway_approval_required") { super("Gateway policy withheld protected data"); }
}
const fail = (code: GatewayPolicyError["code"]): never => { throw new GatewayPolicyError(code); };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const common = ["model", "messages", "stream", "temperature", "top_p", "max_tokens", "stop", "tools", "tool_choice", "metadata", "session_id"];
const fields = { openai: new Set([...common, "n", "seed", "user", "response_format", "frequency_penalty", "presence_penalty", "max_completion_tokens", "stream_options", "parallel_tool_calls", "logprobs", "top_logprobs", "reasoning_effort"]), anthropic: new Set([...common, "system", "top_k", "stop_sequences"]), codex: new Set<string>()};
const messageFields = new Set(["role", "content", "name", "tool_calls", "tool_call_id", "function_call"]);
function strings(value: unknown, result: string[] = []): string[] {
    if (typeof value === "string") { if (result.length >= GATEWAY_LIMITS.leaves) return fail("gateway_limit"); result.push(value); }
    else if (Array.isArray(value)) for (const item of value) strings(item, result);
    else if (record(value)) for (const item of Object.values(value)) strings(item, result);
    return result;
}
/** Expanded metadata budget only for the declared OpenAI function schema.
 * Every string retains its original order and remains inspected. */
function toolSchemaStrings(value: unknown): string[] {
    if (!record(value) || value.tools === undefined) return strings(value);
    const tools = value.tools;
    if (!Array.isArray(tools) || tools.length > 32) return fail("gateway_schema_unsupported");
    for (const tool of tools) {
        if (!record(tool) || Object.keys(tool).some(key => !["type", "function"].includes(key)) || tool.type !== "function" || !record(tool.function)) return fail("gateway_schema_unsupported");
        const definition = tool.function;
        if (Object.keys(definition).some(key => !["name", "description", "parameters", "strict"].includes(key))
            || typeof definition.name !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(definition.name) || !record(definition.parameters)
            || definition.description !== undefined && (typeof definition.description !== "string" || Buffer.byteLength(definition.description) > 16384)
            || definition.strict !== undefined && typeof definition.strict !== "boolean") return fail("gateway_schema_unsupported");
    }
    const all: string[] = [], general: string[] = []; let metadata = 0;
    const collect = (item: unknown): void => {
        if (typeof item === "string") { if (++metadata > 512) return fail("gateway_limit"); all.push(item); }
        else if (Array.isArray(item)) item.forEach(collect);
        else if (record(item)) Object.values(item).forEach(collect);
    };
    for (const [key, item] of Object.entries(value)) {
        if (key === "tools") collect(item);
        else { const before = general.length; strings(item, general); all.push(...general.slice(before)); }
    }
    return all;
}
/** Pinned Claude manual/text tools. Bound every metadata string without
 * changing the ordinary request-content budget or skipping inspection. */
function claudeSchemaStrings(value: unknown): string[] {
    if (!record(value) || value.tools === undefined) return strings(value);
    if (!Array.isArray(value.tools) || value.tools.length > 32) return fail("gateway_schema_unsupported");
    for (const definition of value.tools) {
        if (!record(definition) || Object.keys(definition).some(key => !["name", "description", "input_schema"].includes(key))
            || typeof definition.name !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(definition.name) || !record(definition.input_schema)
            || definition.description !== undefined && (typeof definition.description !== "string" || Buffer.byteLength(definition.description) > 16384)) return fail("gateway_schema_unsupported");
    }
    const all: string[] = [], general: string[] = []; let metadata = 0;
    const collect = (item: unknown): void => {
        if (typeof item === "string") { if (++metadata > 512) return fail("gateway_limit"); all.push(item); }
        else if (Array.isArray(item)) item.forEach(collect);
        else if (record(item)) Object.values(item).forEach(collect);
    };
    // Only validated role/type constants receive a protocol count. Text,
    // identifiers, arguments, cache-control metadata and every other carrier
    // retain the original 32-string budget. All strings keep their order and
    // still pass canonical, ordered and semantic secret inspection.
    let protocolLiterals = 0;
    const literal = (item: string): void => { if (++protocolLiterals > 128) return fail("gateway_limit"); all.push(item); };
    const ordinary = (item: unknown): void => { const before = general.length; strings(item, general); all.push(...general.slice(before)); };
    const content = (item: unknown): void => {
        if (!Array.isArray(item)) { ordinary(item); return; }
        for (const part of item) {
            if (!record(part)) return fail("gateway_schema_unsupported");
            for (const [key, child] of Object.entries(part)) {
                if (key === "type" && typeof child === "string" && ["text", "tool_use", "tool_result"].includes(child)) literal(child);
                else if (key === "content" && part.type === "tool_result") content(child);
                else ordinary(child);
            }
        }
    };
    for (const [key, item] of Object.entries(value)) {
        if (key === "tools") collect(item);
        else if (key === "messages" && Array.isArray(item)) {
            for (const message of item) {
                if (!record(message)) return fail("gateway_schema_unsupported");
                for (const [field, child] of Object.entries(message)) {
                    if (field === "role" && typeof child === "string" && ["user", "assistant"].includes(child)) literal(child);
                    else if (field === "content") content(child);
                    else ordinary(child);
                }
            }
        } else if (key === "system") content(item);
        else ordinary(item);
    }
    return all;
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
    #claudeMatcher: RegisteredSecretMatcher | undefined;
    #available: boolean;
    #short: boolean;
    #clineToolSchemas: boolean;
    #claudeToolSchemas: boolean;
    #codexResponses: boolean;
    #codexMatcher: RegisteredSecretMatcher | undefined;
    constructor(options: { values: readonly string[]; version: number; enabled?: boolean; clineToolSchemas?: boolean; claudeToolSchemas?: boolean; codexResponses?: boolean }) {
        this.#values = Object.freeze(Array.isArray(options.values) ? [...options.values] : []);
        this.#clineToolSchemas = options.clineToolSchemas === true;
        this.#claudeToolSchemas = options.claudeToolSchemas === true;
        this.#codexResponses = options.codexResponses === true;
        this.#codexMatcher = this.#codexResponses ? new RegisteredSecretMatcher(options.values, { decodedCandidateProfile: "structured-json-v1" }) : undefined;
        this.#matcher = new RegisteredSecretMatcher(options.values, this.#clineToolSchemas ? { maxDecodedCandidates: 1024 } : {});
        this.#claudeMatcher = this.#claudeToolSchemas ? new RegisteredSecretMatcher(options.values, { decodedCandidateProfile: "structured-json-v1" }) : undefined;
        this.#available = options.version === 1 && options.enabled !== false && this.#matcher.inspectRequest([]).status === "CLEAN"
            && (!this.#claudeMatcher || this.#claudeMatcher.inspectRequest([]).status === "CLEAN")
            && (!this.#codexMatcher || this.#codexMatcher.inspectRequest([]).status === "CLEAN");
        this.#short = this.#values.some(v => typeof v === "string" && Array.from(v).length < 8);
    }
    available(): boolean { return this.#available; }
    dispose(): void { this.#available = false; this.#values = []; this.#matcher = new RegisteredSecretMatcher([""]); this.#claudeMatcher = undefined; this.#codexMatcher = undefined; }
    /** Internal fixture capability: clone current registrations without returning them. */
    withSynthetic<T>(value: string, operation: (copy: GatewayBoundary) => Promise<T>): Promise<T> {
        if (!this.#available) return Promise.reject(new GatewayPolicyError("gateway_unavailable"));
        const copy = new GatewayBoundary({ values: [...this.#values, value], version: 1, clineToolSchemas: this.#clineToolSchemas, claudeToolSchemas: this.#claudeToolSchemas, codexResponses: this.#codexResponses });
        return operation(copy).finally(() => copy.dispose());
    }
    #inspect(value: unknown, canonical: string, start: number, toolSchemas: false | GatewayProvider = false): void {
        if (!this.#available) return fail("gateway_unavailable");
        if (this.#short) return fail("gateway_sensitive");
        const codex = toolSchemas === "codex" ? codexStrings(value) : undefined;
        const leaves = codex?.leaves ?? (toolSchemas === "anthropic" ? claudeSchemaStrings(value) : toolSchemas ? toolSchemaStrings(value) : strings(value)), texts = codex?.texts ?? contentStrings(value);
        // F07 scans joined input. Short registrations already withhold above;
        // joining this bounded metadata adds no short-value exception.
        for (const parts of [[canonical], leaves.length > 32 ? [leaves.join("")] : leaves, texts]) {
            const decision = (toolSchemas === "codex" ? this.#codexMatcher! : toolSchemas === "anthropic" ? this.#claudeMatcher! : this.#matcher).inspectRequest(parts);
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
            if (provider === "codex") {
                if (!this.#codexResponses) return fail("gateway_policy_unknown");
                validateCodexRequest(body); this.#inspect(body, parsed.canonical, start, "codex"); return Object.freeze(parsed);
            }
            const claude = provider === "anthropic" && this.#claudeToolSchemas;
            if (Object.keys(body).some(key => !fields[provider].has(key) && !(claude && ["thinking", "output_config"].includes(key))) || !Array.isArray(body.messages) || !body.messages.length) return fail("gateway_schema_unsupported");
            if (claude && (body.thinking !== undefined && (!record(body.thinking) || Object.keys(body.thinking).join(",") !== "type" || body.thinking.type !== "disabled")
                || body.output_config !== undefined && (!record(body.output_config) || Object.keys(body.output_config).join(",") !== "effort" || typeof body.output_config.effort !== "string" || !["low", "medium", "high", "max"].includes(body.output_config.effort)))) return fail("gateway_schema_unsupported");
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
            this.#inspect(body, parsed.canonical, start, provider === "openai" && this.#clineToolSchemas ? "openai" : claude ? "anthropic" : false); return Object.freeze(parsed);
        } catch (error) { if (error instanceof GatewayPolicyError) throw error; return fail("gateway_limit"); }
    }
    inspectResponse(provider: GatewayProvider, chunks: readonly Uint8Array[], streaming: boolean): { readonly wire: string; readonly media: string; readonly semantic: string } {
        const start = Date.now(); let redactor: StreamingOutputRedactor | undefined;
        try {
            if (!this.#available || !Object.hasOwn(fields, provider) || provider === "codex" && (!this.#codexResponses || !streaming)) return fail("gateway_unavailable");
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
                const parsed = decodeBoundedJson(Buffer.from(wire), { maxBytes: GATEWAY_LIMITS.bytes });this.#inspect(parsed.body, parsed.canonical, start, provider === "anthropic" && this.#claudeToolSchemas ? "anthropic" : false);
                semantic = contentStrings(parsed.body).join("");
            } else {
                if (!wire.endsWith("\n\n") && !wire.endsWith("\r\n\r\n")) return fail("gateway_output_withheld");
                const rows = wire.replace(/\r\n/g, "\n").split("\n");if (rows.length - 1 > GATEWAY_LIMITS.lines || rows.some(row => row.includes("\r"))) return fail("gateway_output_withheld");
                const data: string[] = [], values: unknown[] = [];let terminal = false, events = 0, eventLabel = "";
                for (const row of rows) {
                    if (!row) {
                        if (!data.length) continue;
                        if (terminal || ++events > GATEWAY_LIMITS.events) return fail("gateway_output_withheld");
                        const text = data.join("\n");data.length = 0;
                        if (text === "[DONE]") { if (provider === "codex") return fail("gateway_output_withheld"); terminal = true;continue; }
                        const parsed = decodeBoundedJson(Buffer.from(text), { maxBytes: GATEWAY_LIMITS.bytes });values.push(parsed.body);
                        if (provider === "codex") { terminal = validateCodexEvent(parsed.body, eventLabel); eventLabel = ""; }
                        if (provider === "anthropic" && parsed.body.type === "message_stop") terminal = true;
                    } else if (row.startsWith("data:")) data.push(row.slice(5).replace(/^ /, ""));
                    else if (row.startsWith(":")) { /* Opaque comments remain scanned in raw wire. */ }
                    else if (provider === "codex" && row.startsWith("event:")) { if (eventLabel) return fail("gateway_output_withheld"); eventLabel = row.slice(6).replace(/^ /, ""); }
                    else if (provider !== "codex" && /^(?:event|id|retry):/.test(row)) { /* Fixed metadata is covered by raw-wire matching. */ }
                    else return fail("gateway_output_withheld");
                }
                if (!terminal || !values.length || data.length) return fail("gateway_output_withheld");
                this.#inspect(values, wire, start, provider === "codex" ? "codex" : provider === "anthropic" && this.#claudeToolSchemas ? "anthropic" : false);
                semantic = (provider === "codex" ? codexStrings(values).texts : contentStrings(values)).join("");
            }
            return Object.freeze({ wire, semantic, media: streaming ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8" });
        } catch { return fail("gateway_output_withheld"); } finally { redactor?.dispose(); }
    }
}
