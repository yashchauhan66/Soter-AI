import { GatewayPolicyError } from "./GatewayBoundary";
type Row = Record<string, unknown>;
const fail = (): never => { throw new GatewayPolicyError("gateway_schema_unsupported"); };
const record = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
function keys(v: unknown, allowed: readonly string[]): asserts v is Row { if (!record(v) || Object.keys(v).some(k => !allowed.includes(k))) fail(); }
const text = (v: unknown, maximum = 65536): v is string => typeof v === "string" && Buffer.byteLength(v) <= maximum;
const identifier = (v: unknown): v is string => text(v, 512) && !!v && !/[\x00-\x1f\x7f]/.test(v);
const name = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const oneOf = (v: unknown, choices: readonly string[]): boolean => typeof v === "string" && choices.includes(v);
function parts(value: unknown): void {
    if (!Array.isArray(value) || value.length > 128) return fail();
    for (const p of value) {
        keys(p, ["type", "text", "annotations"]);
        if (!["input_text", "output_text"].includes(String(p.type)) || !text(p.text)
            || p.annotations !== undefined && (!Array.isArray(p.annotations) || p.annotations.length !== 0)) fail();
    }
}
function item(v: unknown, response = false): void {
    if (!record(v)) return fail();
    if (v.type === "message") {
        keys(v, ["type", "id", "role", "content", "status", "phase"]);
        if (!["system", "developer", "user", "assistant"].includes(String(v.role))) fail();
        if (v.phase !== undefined && !["commentary", "final_answer"].includes(String(v.phase))) fail();
        parts(v.content);
    } else if (v.type === "function_call") {
        keys(v, ["type", "id", "name", "namespace", "arguments", "call_id", "status", ...(response ? ["content"] : [])]);
        if (!name(v.name) || v.namespace !== undefined && !name(v.namespace) || !identifier(v.call_id) || !text(v.arguments)
            || v.content !== undefined && (!Array.isArray(v.content) || v.content.length !== 0)) fail();
    } else if (v.type === "function_call_output" && !response) {
        keys(v, ["type", "id", "call_id", "output", "status"]);
        if (!identifier(v.call_id)) fail(); if (!text(v.output)) parts(v.output);
    } else return fail();
    if (v.id !== undefined && !identifier(v.id) || v.status !== undefined && !["completed", "in_progress"].includes(String(v.status))) fail();
}
function tools(value: unknown): void {
    if (!Array.isArray(value) || value.length > 32) return fail(); let count = 0;
    const fn = (v: unknown): void => {
        keys(v, ["type", "name", "description", "parameters", "strict"]);
        if (++count > 32 || v.type !== "function" || !name(v.name) || !record(v.parameters)
            || v.description !== undefined && !text(v.description, 16384) || v.strict !== undefined && typeof v.strict !== "boolean") fail();
    };
    for (const v of value) {
        if (record(v) && v.type === "namespace") {
            keys(v, ["type", "name", "description", "tools"]);
            if (!name(v.name) || v.description !== undefined && !text(v.description, 16384) || !Array.isArray(v.tools) || v.tools.length > 32) fail();
            (v.tools as unknown[]).forEach(fn);
        } else fn(v);
    }
}
/** Exact stateless HTTP text/function profile. Images, encrypted replay, server
 * state, background work and unknown carriers fail closed. This is not a
 * declaration of general Codex/Responses compatibility. */
export function validateCodexRequest(v: Row): void {
    keys(v, ["model", "instructions", "input", "tools", "tool_choice", "parallel_tool_calls", "reasoning", "store", "stream", "include", "prompt_cache_key", "client_metadata"]);
    if (!identifier(v.model) || v.instructions !== undefined && !text(v.instructions) || v.store !== false || v.stream !== true
        || v.parallel_tool_calls !== undefined && typeof v.parallel_tool_calls !== "boolean"
        || v.tool_choice !== undefined && !oneOf(v.tool_choice, ["auto", "none"])
        || !Array.isArray(v.input) || !v.input.length || v.input.length > 128) fail();
    const calls = new Set<string>(), results = new Set<string>();
    for (const p of v.input as unknown[]) {
        item(p); const row = p as Row;
        if (row.type === "function_call") { if (calls.has(String(row.call_id))) fail(); calls.add(String(row.call_id)); }
        if (row.type === "function_call_output") { if (!calls.has(String(row.call_id)) || results.has(String(row.call_id))) fail(); results.add(String(row.call_id)); }
    }
    tools(v.tools);
    if (v.reasoning !== undefined) { keys(v.reasoning, ["summary", "effort"]);
        if (v.reasoning.summary !== undefined && !["auto", "concise", "detailed"].includes(String(v.reasoning.summary))
            || v.reasoning.effort !== undefined && !["none", "minimal", "low", "medium", "high", "xhigh"].includes(String(v.reasoning.effort))) fail(); }
    if (v.include !== undefined && (!Array.isArray(v.include) || v.include.length > 1 || v.include.some(x => x !== "reasoning.encrypted_content"))) fail();
    if (v.prompt_cache_key !== undefined && !identifier(v.prompt_cache_key)) fail();
    if (v.client_metadata !== undefined) { if (!record(v.client_metadata) || Object.keys(v.client_metadata).length > 16
        || Object.entries(v.client_metadata).some(([k, x]) => !identifier(k) || !text(x, 2048))) fail(); }
}
const responseFields = ["id", "object", "created_at", "completed_at", "status", "model", "output", "usage", "error", "incomplete_details", "metadata", "instructions", "parallel_tool_calls", "tools", "tool_choice", "store", "reasoning", "temperature", "top_p", "max_output_tokens", "max_tool_calls", "previous_response_id", "background", "text", "service_tier", "truncation", "user", "safety_identifier", "prompt_cache_key", "prompt_cache_retention", "top_logprobs"];
function response(v: unknown, complete: boolean): void {
    keys(v, responseFields);
    if (!identifier(v.id) || v.object !== "response" || !identifier(v.model)
        || v.status !== (complete ? "completed" : "in_progress") || !Array.isArray(v.output) || v.output.length > 128
        || v.error != null || v.incomplete_details != null || v.previous_response_id != null || v.background === true) fail();
    (v.output as unknown[]).forEach(p => item(p, true));
}
export function validateCodexEvent(v: Row, label: string): boolean {
    if (label !== v.type) return fail();
    const type = String(v.type);
    if (["response.created", "response.in_progress", "response.completed"].includes(type)) {
        keys(v, ["type", "sequence_number", "response"]); response(v.response, type === "response.completed");
    } else if (["response.output_item.added", "response.output_item.done"].includes(type)) {
        keys(v, ["type", "sequence_number", "output_index", "item"]); item(v.item, true);
    } else if (["response.content_part.added", "response.content_part.done"].includes(type)) {
        keys(v, ["type", "sequence_number", "item_id", "output_index", "content_index", "part"]); parts([v.part]);
    } else if (["response.output_text.delta", "response.output_text.done", "response.function_call_arguments.delta", "response.function_call_arguments.done"].includes(type)) {
        keys(v, ["type", "sequence_number", "item_id", "output_index", "content_index", "delta", "text", "arguments", "logprobs"]);
        const field = type.endsWith(".delta") ? "delta" : type.includes("arguments") ? "arguments" : "text";
        if (!text(v[field]) || v.logprobs !== undefined && (!Array.isArray(v.logprobs) || v.logprobs.length)) fail();
    } else return fail();
    for (const key of ["sequence_number", "output_index", "content_index"]) if (v[key] !== undefined && (!Number.isSafeInteger(v[key]) || Number(v[key]) < 0)) fail();
    if (v.item_id !== undefined && !identifier(v.item_id)) fail();
    return type === "response.completed";
}
/** Separate bounded counts for schema512, protocol128 and metadata128; actual
 * text/arguments/results retain32. All strings retain order and are scanned. */
export function codexStrings(value: unknown): { leaves: string[]; texts: string[] } {
    const leaves: string[] = [], texts: string[] = []; let schema = 0, protocol = 0, metadata = 0, ordinary = 0;
    const literals = new Set(["message", "function_call", "function_call_output", "input_text", "output_text", "response", "user", "system", "developer", "assistant", "completed", "in_progress", "commentary", "final_answer", "auto", "none", "concise", "detailed", "minimal", "low", "medium", "high", "xhigh"]);
    const visit = (v: unknown, key = "", inTools = false): void => {
        if (typeof v === "string") {
            let over: boolean;
            if (inTools) over = ++schema > 512;
            else if (["type", "role", "status", "object", "phase"].includes(key) && (literals.has(v) || v.startsWith("response."))) over = ++protocol > 128;
            else if (["id", "item_id", "call_id", "name", "namespace", "model", "tool_choice", "summary", "effort", "include", "prompt_cache_key", "client_metadata"].includes(key)) over = ++metadata > 128;
            else { over = ++ordinary > 32; texts.push(v); }
            if (over) throw new GatewayPolicyError("gateway_limit"); leaves.push(v);
        } else if (Array.isArray(v)) for (const p of v) visit(p, key, inTools);
        else if (record(v)) for (const [k, p] of Object.entries(v)) visit(p, key === "client_metadata" ? key : k, inTools || k === "tools");
    };
    visit(value); return { leaves, texts };
}
