import { GatewayPolicyError } from "./GatewayBoundary";

type Row = Record<string, unknown>;
export const GEMINI_SAFE_FUNCTION = "mcp_soterai_safe_read_soterai_read_project_file_safely";
function fail(): never { throw new GatewayPolicyError("gateway_schema_unsupported"); }
const record = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
function keys(v: unknown, allowed: readonly string[]): asserts v is Row {
    if (!record(v) || Object.keys(v).some(key => !allowed.includes(key))) fail();
}
const text = (v: unknown, maximum = 65536): v is string => typeof v === "string" && Buffer.byteLength(v) <= maximum;
const id = (v: unknown): v is string => text(v, 256) && !!v && !/[\x00-\x20\x7f]/.test(v);
export const validGeminiModel = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(v);
const number = (v: unknown, min: number, max: number, integer = false) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isSafeInteger(v));
function args(v: unknown): void {
    keys(v, ["path", "wait_for_previous"]);
    if (!text(v.path, 4096) || !v.path || /[\x00-\x1f\x7f]/.test(v.path)
        || v.wait_for_previous !== undefined && typeof v.wait_for_previous !== "boolean") fail();
}
function call(v: unknown, requireId: boolean): void {
    keys(v, ["name", "args", "id"]);
    if (v.name !== GEMINI_SAFE_FUNCTION || (requireId || v.id !== undefined) && !id(v.id)) fail();
    args(v.args);
}
function part(v: unknown, response: boolean): "text" | "call" | "result" {
    keys(v, ["text", "thought", "thoughtSignature", "functionCall", "functionResponse"]);
    if (["text", "functionCall", "functionResponse"].filter(key => Object.hasOwn(v, key)).length !== 1
        || v.thought !== undefined && typeof v.thought !== "boolean"
        || v.thoughtSignature !== undefined && v.thoughtSignature !== "skip_thought_signature_validator") fail();
    if (v.text !== undefined) { if (!text(v.text)) fail(); return "text"; }
    if (v.thought !== undefined) return fail();
    if (v.functionCall !== undefined) { call(v.functionCall, !response); return "call"; }
    if (response) return fail();
    keys(v.functionResponse, ["name", "response", "id"]);
    if (v.functionResponse.name !== GEMINI_SAFE_FUNCTION || !id(v.functionResponse.id)) fail();
    keys(v.functionResponse.response, ["output", "error"]);
    const result = v.functionResponse.response;
    if (Object.keys(result).length !== 1 || !text(result.output ?? result.error)) fail();
    return "result";
}
function parts(v: unknown): asserts v is Row[] { if (!Array.isArray(v) || !v.length || v.length > 128) fail(); }
function toolSchema(v: unknown): void {
    keys(v, ["type", "properties", "required", "additionalProperties"]);
    if (v.type !== "object" || v.additionalProperties !== false || !Array.isArray(v.required)
        || v.required.length !== 1 || v.required[0] !== "path") fail();
    keys(v.properties, ["path", "wait_for_previous"]);
    for (const [key, child] of Object.entries(v.properties)) {
        keys(child, ["type", "description"]);
        if (child.type !== (key === "path" ? "string" : "boolean") || child.description !== undefined && !text(child.description, 16384)) fail();
    }
    if (!Object.hasOwn(v.properties, "path")) fail();
}
function tools(v: unknown): number {
    if (!Array.isArray(v) || v.length > 1) return fail();
    let count = 0;
    for (const tool of v) {
        keys(tool, ["functionDeclarations"]);
        if (!Array.isArray(tool.functionDeclarations) || tool.functionDeclarations.length > 1) fail();
        for (const fn of tool.functionDeclarations) {
            keys(fn, ["name", "description", "parametersJsonSchema"]);
            if (fn.name !== GEMINI_SAFE_FUNCTION || fn.description !== undefined && !text(fn.description, 16384)) fail();
            toolSchema(fn.parametersJsonSchema); count++;
        }
    }
    return count;
}
/** Internal envelope for the declared stateless native text/single-safe-tool
 * profile. Transport model/stream are removed before the Google-format hop. */
export function validateGeminiRequest(v: Row): void {
    keys(v, ["model", "stream", "contents", "systemInstruction", "tools", "generationConfig"]);
    if (!validGeminiModel(v.model) || v.stream !== true || !Array.isArray(v.contents) || !v.contents.length || v.contents.length > 128) fail();
    const calls = new Set<string>(), results = new Set<string>();
    for (const content of v.contents) {
        keys(content, ["role", "parts"]);
        if (!["user", "model"].includes(String(content.role))) fail();
        parts(content.parts);
        for (const p of content.parts) {
            const kind = part(p, false);
            if (kind === "call") {
                if (content.role !== "model") fail();
                const key = String((p.functionCall as Row).id); if (calls.has(key)) fail(); calls.add(key);
            } else if (kind === "result") {
                if (content.role !== "user") fail();
                const key = String((p.functionResponse as Row).id); if (!calls.has(key) || results.has(key)) fail(); results.add(key);
            }
        }
    }
    if (calls.size !== results.size) fail();
    if (v.systemInstruction !== undefined) {
        keys(v.systemInstruction, ["role", "parts"]);
        if (v.systemInstruction.role !== undefined && v.systemInstruction.role !== "user") fail();
        parts(v.systemInstruction.parts);
        for (const p of v.systemInstruction.parts) { keys(p, ["text"]); if (!text(p.text)) fail(); }
    }
    if (tools(v.tools) === 0 && calls.size) fail();
    if (v.generationConfig !== undefined) {
        keys(v.generationConfig, ["temperature", "topP", "topK", "maxOutputTokens", "candidateCount", "thinkingConfig"]);
        const g = v.generationConfig;
        if (g.temperature !== undefined && !number(g.temperature, 0, 2) || g.topP !== undefined && !number(g.topP, 0, 1)
            || g.topK !== undefined && !number(g.topK, 1, 1024, true) || g.maxOutputTokens !== undefined && !number(g.maxOutputTokens, 1, 65536, true)
            || g.candidateCount !== undefined && g.candidateCount !== 1) fail();
        if (g.thinkingConfig !== undefined) {
            keys(g.thinkingConfig, ["includeThoughts", "thinkingLevel"]);
            if (g.thinkingConfig.includeThoughts !== undefined && typeof g.thinkingConfig.includeThoughts !== "boolean"
                || g.thinkingConfig.thinkingLevel !== undefined && !["MINIMAL", "LOW", "MEDIUM", "HIGH"].includes(String(g.thinkingConfig.thinkingLevel))) fail();
        }
    }
}
export function validateGeminiEvent(v: Row, label: string): boolean {
    keys(v, ["candidates", "usageMetadata", "modelVersion", "responseId"]);
    if (label || !Array.isArray(v.candidates) || v.candidates.length !== 1 || v.modelVersion !== undefined && !id(v.modelVersion)
        || v.responseId !== undefined && !id(v.responseId)) return fail();
    const candidate = v.candidates[0]; keys(candidate, ["content", "finishReason", "index"]);
    if (candidate.index !== undefined && candidate.index !== 0 || candidate.finishReason !== undefined && candidate.finishReason !== "STOP") fail();
    keys(candidate.content, ["role", "parts"]); if (candidate.content.role !== "model") fail();
    parts(candidate.content.parts); for (const p of candidate.content.parts) part(p, true);
    if (v.usageMetadata !== undefined) {
        keys(v.usageMetadata, ["promptTokenCount", "candidatesTokenCount", "totalTokenCount", "thoughtsTokenCount", "cachedContentTokenCount"]);
        if (Object.values(v.usageMetadata).some(value => !number(value, 0, 2147483647, true))) fail();
    }
    return candidate.finishReason === "STOP";
}
/** Separate protocol/metadata and32 semantic-string budgets; every canonical
 * and ordered string remains subject to the same registered-value engine. */
export function geminiStrings(value: unknown): { leaves: string[]; texts: string[] } {
    const leaves: string[] = [], texts: string[] = [];
    const semantic = (v: unknown): void => {
        if (typeof v === "string") { if (texts.length >= 32) throw new GatewayPolicyError("gateway_limit"); texts.push(v); }
        else if (Array.isArray(v)) v.forEach(semantic);
        else if (record(v)) Object.values(v).forEach(semantic);
    };
    const visit = (v: unknown): void => {
        if (typeof v === "string") { if (leaves.length >= 1024) throw new GatewayPolicyError("gateway_limit"); leaves.push(v); }
        else if (Array.isArray(v)) v.forEach(visit);
        else if (record(v)) for (const [key, child] of Object.entries(v)) {
            if (["text", "output", "error", "args"].includes(key)) semantic(child);
            visit(child);
        }
    };
    visit(value); return { leaves, texts };
}
