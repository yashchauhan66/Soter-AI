import type { IncomingMessage, ServerResponse } from "node:http";
import { GatewayBoundary, GatewayPolicyError, GATEWAY_LIMITS, type GatewayProvider } from "./GatewayBoundary";
import { validateProviderTarget } from "./ProviderTarget";
type Mode = { enabled: boolean; level: string };
interface GatewayChecks {
    canaries?(): readonly string[];
    request?(body: Record<string, unknown>, provider: GatewayProvider, session?: string): Promise<{ body: Record<string, unknown>; decision: string }>;
    response?(text: string): Promise<string>;
}
export interface GatewayOptions {
    gatewayPolicy?: boolean;
    clineToolSchemas?: boolean;
    claudeToolSchemas?: boolean;
    codexResponses?: boolean;
    codexResponsesProviderUrl?: string;
    requireGatewaySync?: boolean;
    registeredValues?: readonly string[];
    gatewayGuard?: (generation: string) => Promise<boolean>;
    /** Trusted in-process capability used by the isolated built-in self-test. */
    gatewayBoundary?: GatewayBoundary;
    token: string;
    controlToken?: string;
    providerApiKey?: string;
    openAIProviderUrl?: string;
    anthropicProviderUrl?: string;
    canaries?: Array<{ token: string }>;
    requestTimeoutMs?: number;
    fetchImpl?: typeof fetch;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
// Captured public declarations of the pinned2.1.301 manual/text client.
// Caller-supplied beta/header values never become provider headers.
const CLAUDE_BETAS = "claude-code-20250219,interleaved-thinking-2025-05-14,thinking-token-count-2026-05-13,context-management-2025-06-27,prompt-caching-scope-2026-01-05,effort-2025-11-24";
const fail = (code: GatewayPolicyError["code"]): never => { throw new GatewayPolicyError(code); };
/** Only owned controller sync can replace a live private policy/registry snapshot. */
export class GatewayPolicy {
    #boundary?: GatewayBoundary;
    #generation = "standalone";
    #mode?: Mode;
    #closed = false;
    #active = new Set<AbortController>();
    constructor(private readonly options: GatewayOptions, private readonly mode: () => Mode, private readonly stopping: () => boolean,
        private readonly audit: (event: "request_allowed" | "request_blocked" | "response_allowed" | "response_blocked" | "provider_error") => void,
        private readonly checks: GatewayChecks = {}) {
        if (options.gatewayPolicy !== false && !options.requireGatewaySync) this.#boundary = options.gatewayBoundary ?? this.compile(options.registeredValues ?? []);
    }
    private compile(values: readonly string[]): GatewayBoundary {
        return new GatewayBoundary({ version: 1, clineToolSchemas: this.options.clineToolSchemas === true, claudeToolSchemas: this.options.claudeToolSchemas === true, codexResponses: this.options.codexResponses === true, values: [...values, ...[this.options.token, this.options.controlToken, this.options.providerApiKey].filter((v): v is string => !!v), ...(this.checks.canaries?.() ?? (this.options.canaries ?? []).map(c => c.token))] });
    }
    status(): { version: number; enabled: boolean; ready: boolean; generation: string; clineToolSchemas: boolean; claudeToolSchemas: boolean; codexResponses: boolean } {
        return { version: 1, enabled: this.options.gatewayPolicy !== false, ready: !this.#closed && this.#boundary?.available() === true && (!this.#mode || JSON.stringify(this.#mode) === JSON.stringify(this.mode())), generation: this.#generation, clineToolSchemas: this.options.clineToolSchemas === true, claudeToolSchemas: this.options.claudeToolSchemas === true, codexResponses: this.options.codexResponses === true };
    }
    synchronize(value: Record<string, unknown>): { version: number; synchronized: boolean; generation: string } {
        this.invalidate();
        if (this.options.gatewayPolicy === false || this.#closed || this.options.requireGatewaySync && !this.options.gatewayGuard) return fail("gateway_unavailable");
        if (Object.keys(value).sort().join(",") !== "generation,mode,values,version" || value.version !== 1 || typeof value.generation !== "string" || !uuid.test(value.generation)
            || !Array.isArray(value.values) || value.values.some(v => typeof v !== "string") || !value.mode || typeof value.mode !== "object" || Array.isArray(value.mode)) return fail("gateway_policy_unknown");
        const mode = value.mode as Record<string, unknown>;
        if (Object.keys(mode).sort().join(",") !== "enabled,level" || typeof mode.enabled !== "boolean" || !["developer", "strict", "enterprise"].includes(String(mode.level))
            || JSON.stringify({ enabled: mode.enabled, level: mode.level }) !== JSON.stringify(this.mode())) return fail("gateway_policy_unknown");
        const boundary = this.compile(value.values as string[]);if (!boundary.available()) { boundary.dispose();return fail("gateway_unavailable"); }
        this.#boundary = boundary;this.#generation = value.generation;this.#mode = Object.freeze({ enabled: mode.enabled, level: String(mode.level) });
        return { version: 1, synchronized: true, generation: this.#generation };
    }
    /** Registry mutations revoke in-flight snapshots before validation or replacement. */
    invalidate(): void {
        this.#boundary?.dispose();this.#boundary = undefined;this.#generation = "";this.#mode = undefined;
        for (const controller of this.#active) controller.abort();
    }
    async fresh(boundary = this.#boundary): Promise<void> {
        if (!boundary || !boundary.available() || this.#boundary !== boundary || !this.status().ready || this.stopping()) return fail("gateway_unavailable");
        if (this.options.gatewayGuard) {
            let timer: ReturnType<typeof setTimeout> | undefined, allowed = false;
            try { allowed = await Promise.race([this.options.gatewayGuard(this.#generation), new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1000); })]); } catch { /* No backend exception text. */ } finally { clearTimeout(timer); }
            if (!allowed || !boundary.available() || this.#boundary !== boundary || !this.status().ready || this.stopping()) return fail("gateway_unavailable");
        }
    }
    async withSynthetic<T>(value: string, operation: (boundary: GatewayBoundary) => Promise<T>): Promise<T> {
        const boundary = this.#boundary;await this.fresh(boundary);if (!boundary) return fail("gateway_unavailable");
        const result = await boundary.withSynthetic(value, operation);await this.fresh(boundary);return result;
    }
    async proxy(provider: GatewayProvider, body: Record<string, unknown>, req: IncomingMessage, res: ServerResponse): Promise<void> {
        const boundary = this.#boundary;let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        const controller = new AbortController(), cancelled = () => { if (!res.writableEnded) controller.abort(); };
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
            await this.fresh(boundary);if (!boundary) return fail("gateway_unavailable");
            const route = new URL(req.url ?? "/", "http://127.0.0.1"), profile = provider === "codex" ? "openai-responses" : provider + "-compatible";
            const nativeClaude = provider === "anthropic" && this.options.claudeToolSchemas === true && route.pathname === "/v1/ai/anthropic-compatible/v1/messages";
            if (route.search && !(nativeClaude && route.search === "?beta=true") || route.hash || req.headers["x-soterai-provider-key"] !== undefined || req.headers["anthropic-version"] !== undefined && req.headers["anthropic-version"] !== "2023-06-01") return fail("gateway_schema_unsupported");
            for (const name of ["x-soterai-tool", "x-soterai-policy-version"]) {
                let count = 0;for (let i = 0; i < req.rawHeaders.length; i += 2) if (req.rawHeaders[i].toLowerCase() === name) count++;
                if (count > 1) return fail("gateway_policy_unknown");
            }
            if (req.headers["x-soterai-tool"] !== undefined && req.headers["x-soterai-tool"] !== profile || req.headers["x-soterai-policy-version"] !== undefined && req.headers["x-soterai-policy-version"] !== "1") return fail("gateway_policy_unknown");
            const original = boundary.prepareRequest(provider, body), assessed = await this.checks.request?.(original.body, provider, typeof req.headers["x-soterai-session-id"] === "string" ? req.headers["x-soterai-session-id"] : undefined);
            if (assessed?.decision === "approval_required") return fail("gateway_approval_required");
            if (assessed?.decision === "block") return fail("gateway_sensitive");
            const inspected = assessed ? boundary.prepareRequest(provider, assessed.body) : original, target = provider === "codex" ? this.options.codexResponsesProviderUrl : provider === "openai" ? this.options.openAIProviderUrl : this.options.anthropicProviderUrl;
            if (!target || !this.options.providerApiKey) return fail("gateway_unavailable");
            const url = new URL(validateProviderTarget(target));if (url.search) return fail("gateway_policy_unknown");
            const streaming = inspected.body.stream === true, headers: Record<string, string> = { "content-type": "application/json", accept: streaming ? "text/event-stream" : "application/json" };
            if (provider === "openai" || provider === "codex") headers.authorization = "Bearer " + this.options.providerApiKey;
            else { headers["x-api-key"] = this.options.providerApiKey;headers["anthropic-version"] = "2023-06-01";if(nativeClaude)headers["anthropic-beta"] = CLAUDE_BETAS; }
            await this.fresh(boundary);
            if (req.aborted || req.destroyed && !req.complete || res.destroyed) return fail("gateway_unavailable");
            req.once("aborted", cancelled);res.once("close", cancelled);this.#active.add(controller);
            deadline = setTimeout(() => controller.abort(), Math.min(30000, Math.max(1, this.options.requestTimeoutMs ?? 30000)));
            this.audit("request_allowed");
            const response = await (this.options.fetchImpl ?? fetch)(url.href, { method: "POST", headers, body: inspected.canonical, redirect: "error", signal: controller.signal });
            const media = response.headers.get("content-type") ?? "";
            if (!response.ok || !response.body || !(streaming ? /^text\/event-stream(?:[ \t]*;[ \t]*charset=utf-8)?$/i : /^application\/json(?:[ \t]*;[ \t]*charset=utf-8)?$/i).test(media)) { await response.body?.cancel();return fail("gateway_provider_error"); }
            reader = response.body.getReader();const chunks: Uint8Array[] = [];let bytes = 0;
            while (true) {
                const next = await reader.read();if (next.done) break;
                bytes += next.value.byteLength;if (bytes > GATEWAY_LIMITS.bytes || chunks.length >= GATEWAY_LIMITS.chunks) return fail("gateway_output_withheld");chunks.push(next.value);
            }
            const output = boundary.inspectResponse(provider, chunks, streaming), outputDecision = await this.checks.response?.(output.wire + "\n" + output.semantic) ?? "allow";
            if (!["allow", "warn"].includes(outputDecision)) return fail("gateway_output_withheld");
            await this.fresh(boundary);
            if (controller.signal.aborted || req.aborted || res.destroyed) return fail("gateway_unavailable");
            this.audit("response_allowed");res.statusCode = response.status;res.setHeader("content-type", output.media);res.setHeader("cache-control", "no-store");if(streaming)res.setHeader("x-soterai-stream-buffered", "1");res.setHeader("x-soterai-request-decision", assessed?.decision ?? "allow");res.setHeader("x-soterai-response-decision", outputDecision);res.end(output.wire);
        } catch (error) {
            if (error instanceof GatewayPolicyError && error.code === "gateway_output_withheld" && !res.headersSent) res.setHeader("x-soterai-response-decision", "block");
            this.audit(error instanceof GatewayPolicyError && error.code === "gateway_output_withheld" ? "response_blocked" : error instanceof GatewayPolicyError ? "request_blocked" : "provider_error");
            if (error instanceof GatewayPolicyError) throw error;return fail("gateway_provider_error");
        } finally {
            clearTimeout(deadline);req.off("aborted", cancelled);res.off("close", cancelled);this.#active.delete(controller);
            try { await reader?.cancel(); } catch { /* Already closed or aborted. */ }finally { reader?.releaseLock(); }
        }
    }
    dispose(): void { this.#closed = true;this.invalidate(); }
}
