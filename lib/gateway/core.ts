/**
 * Universal AI Gateway core — SoterAI's hosted inline enforcement point.
 *
 * Customers point their OpenAI/Anthropic SDK base_url at
 *   /api/gateway/openai/v1/chat/completions
 *   /api/gateway/anthropic/v1/messages
 * keep their provider key where their SDK already puts it (Authorization /
 * x-api-key), and add ONE header: `x-soterai-api-key: ck_live_...`.
 *
 * The gateway then enforces inline — request scan before forwarding, response
 * scan before returning, per-SSE-event scan while streaming — and emits the
 * canonical decision contract (lib/gateway/decision.ts) on every response.
 *
 * Failure posture (documented, deliberate):
 * - SoterAI auth failure, malformed/oversized body → fail CLOSED (4xx).
 * - Upstream provider failure → 502 passthrough (nothing to protect).
 * - Internal scan pipeline crash → fail OPEN for availability, but the
 *   decision is stamped enforcement=FAIL_OPEN so evidence never overclaims.
 * - Streaming: tokens already flushed before a BLOCK cannot be recalled
 *   (same documented bypass as the local broker's SSE proxy).
 */
import { randomUUID } from "crypto";
import { runInputGuard } from "../guard/inputGuard";
import { runOutputGuard } from "../guard/outputGuard";
import { augmentWithMl } from "../guard/mlAugment";
import { augmentWithLlmJudge } from "../guard/llmJudge";
import { applyPolicy, loadProjectPolicy, DEFAULT_POLICY, type ResolvedPolicy } from "../guard/policy";
import { scheduleGuardResultPersistence } from "../guard/scheduledPersistence";
import { checkRedisRateLimit, peekMonthlyUsage, planLimit, planRpm } from "../rateLimit";
import { verifyApiKey } from "../apiKey";
import type { GuardResult } from "../guard/types";
import {
  buildGatewayDecision,
  decisionHeaders,
  policyFingerprint,
} from "./decision";
import type { ProviderAdapter } from "./providers";

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB JSON request cap
const MAX_SCAN_CHARS = 200_000; // decision engine slices internally too; bound our join
const STREAM_SCAN_MIN_GROWTH = 24; // rescan accumulated stream text every N new chars
const DEFAULT_UPSTREAM_TIMEOUT_MS = 120_000;

type VerifyOk = Extract<Awaited<ReturnType<typeof verifyApiKey>>, { ok: true }>;

export interface GatewayDeps {
  fetchImpl: typeof fetch;
  verifyKey: (rawKey: string | null) => ReturnType<typeof verifyApiKey>;
  loadPolicy: (projectId: string) => Promise<ResolvedPolicy>;
  checkLimits: (auth: VerifyOk) => Promise<{ allowed: boolean; retryAfterSeconds: number; message: string }>;
  scanInput: (text: string, policy: ResolvedPolicy) => Promise<GuardResult>;
  scanOutput: (text: string, policy: ResolvedPolicy) => Promise<GuardResult>;
  persist: (input: Parameters<typeof scheduleGuardResultPersistence>[0]) => void;
  upstreamTimeoutMs: number;
}

async function defaultScanInput(text: string, policy: ResolvedPolicy): Promise<GuardResult> {
  const baseline = await augmentWithLlmJudge(
    await augmentWithMl(runInputGuard(text), text, "INPUT"),
    text,
    "INPUT",
  );
  return applyPolicy(text, baseline, policy, "INPUT");
}

async function defaultScanOutput(text: string, policy: ResolvedPolicy): Promise<GuardResult> {
  const baseline = await augmentWithLlmJudge(
    await augmentWithMl(runOutputGuard(text), text, "OUTPUT"),
    text,
    "OUTPUT",
  );
  return applyPolicy(text, baseline, policy, "OUTPUT");
}

async function defaultCheckLimits(auth: VerifyOk) {
  const orgId = auth.project.organizationId;
  const [rpm, usage] = await Promise.all([
    checkRedisRateLimit(`key:${auth.apiKey.id}`, planRpm(auth.project.plan)),
    orgId
      ? peekMonthlyUsage(orgId, auth.project.plan, auth.project.organization?.quotaOverride)
      : Promise.resolve({ allowed: true, exceeded: false, remaining: planLimit(auth.project.plan) }),
  ]);
  if (usage.exceeded) {
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((nextMonth.getTime() - Date.now()) / 1000)),
      message: "Monthly usage limit exceeded. Upgrade your plan to continue.",
    };
  }
  if (!rpm.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rpm.resetAt - Date.now()) / 1000)),
      message: "Per-minute API key rate limit was exceeded.",
    };
  }
  return { allowed: true, retryAfterSeconds: 0, message: "" };
}

function defaultDeps(): GatewayDeps {
  return {
    fetchImpl: fetch,
    verifyKey: verifyApiKey,
    loadPolicy: loadProjectPolicy,
    checkLimits: defaultCheckLimits,
    scanInput: defaultScanInput,
    scanOutput: defaultScanOutput,
    persist: scheduleGuardResultPersistence,
    upstreamTimeoutMs: readTimeoutEnv(),
  };
}

function readTimeoutEnv(): number {
  const raw = Number(process.env.SOTERAI_GATEWAY_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 1_000 && raw <= 600_000) return raw;
  return DEFAULT_UPSTREAM_TIMEOUT_MS;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Copy ONLY allowlisted headers upstream. x-soterai-api-key is never forwarded. */
function buildUpstreamHeaders(request: Request, adapter: ProviderAdapter): Headers {
  const headers = new Headers();
  for (const name of [...adapter.providerAuthHeaders, ...adapter.forwardHeaders]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "application/json");
  return headers;
}

function synthResult(reason: string): GuardResult {
  return {
    allowed: true,
    action: "ALLOW",
    riskScore: 0,
    riskTypes: [],
    reason,
    findings: [],
  };
}

export function createGatewayHandler(
  adapter: ProviderAdapter,
  overrides: Partial<GatewayDeps> = {},
): (request: Request, preverified?: VerifyOk) => Promise<Response> {
  return async function handleGatewayRequest(request: Request, preverified?: VerifyOk): Promise<Response> {
    const deps: GatewayDeps = { ...defaultDeps(), ...overrides };
    const traceId = `soter_${randomUUID()}`;

    // ── 1. SoterAI authentication (dedicated header — x-api-key belongs to
    // Anthropic's provider credential on the anthropic route) ──
    const soterKey = request.headers.get("x-soterai-api-key");
    const verified = preverified ?? await deps.verifyKey(soterKey);
    if (!verified.ok) {
      return jsonResponse(
        adapter.blockedRequestBody(`SoterAI authentication failed: ${verified.message} (send your SoterAI key in x-soterai-api-key)`),
        verified.status,
        { "X-Soter-Trace-Id": traceId },
      );
    }
    const { apiKey, project } = verified;

    // ── 2. Rate/quota limits ──
    const limits = await deps.checkLimits(verified);
    if (!limits.allowed) {
      return jsonResponse(adapter.blockedRequestBody(limits.message), 429, {
        "Retry-After": String(limits.retryAfterSeconds),
        "X-Soter-Trace-Id": traceId,
      });
    }

    // ── 3. Bounded body read + parse (fail closed) ──
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonResponse(adapter.blockedRequestBody("Request body exceeds the 2MB gateway limit."), 413, {
        "X-Soter-Trace-Id": traceId,
      });
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse(adapter.blockedRequestBody("Request body must be a JSON object."), 400, {
        "X-Soter-Trace-Id": traceId,
      });
    }

    const model = adapter.modelOf(body);
    const identity = {
      projectId: project.id,
      organizationId: project.organizationId ?? null,
      apiKeyId: apiKey.id,
      userId: typeof body.user === "string" ? body.user : null,
      sessionId: null,
    };
    const destination = {
      provider: adapter.id,
      model,
      host: new URL(adapter.upstreamUrl()).host,
    };

    // ── 4. Load policy + input scan ──
    let policy: ResolvedPolicy;
    try {
      policy = await deps.loadPolicy(project.id);
    } catch {
      policy = DEFAULT_POLICY; // fail to the strictest shared default, never to "off"
    }
    const policyVersion = policyFingerprint(policy);

    const texts = adapter.extractRequestTexts(body);
    const joined = texts.join("\n").slice(0, MAX_SCAN_CHARS);

    let inputResult: GuardResult;
    let inputEnforcement: "ENFORCED" | "FAIL_OPEN" = "ENFORCED";
    if (joined.length === 0) {
      inputResult = synthResult("No scannable text in request; gateway abstained on input.");
    } else {
      try {
        inputResult = await deps.scanInput(joined, policy);
      } catch (error) {
        console.error("[SoterAI gateway] input scan failed (failing open)", error);
        inputResult = synthResult("Input scan pipeline error; request forwarded unscanned.");
        inputEnforcement = "FAIL_OPEN";
      }
    }

    const inputDecision = buildGatewayDecision({
      result: inputResult,
      direction: "INPUT",
      identity,
      destination,
      traceId,
      policyVersion,
      enforcement: inputEnforcement,
      decisionOverride: joined.length === 0 ? "ABSTAIN" : undefined,
    });
    persistSafely(deps, {
      projectId: project.id,
      apiKeyId: apiKey.id,
      apiKeyPrefix: apiKey.prefix,
      direction: "INPUT",
      result: inputResult,
      requestMetadata: { gateway: adapter.id, model, traceId, decision: inputDecision.decision, enforcement: inputDecision.enforcement },
      projectContext: project,
    });

    // ── 5. Enforce the input decision ──
    let outboundBody = body;
    if (inputDecision.decision === "BLOCK" || inputDecision.decision === "REQUIRE_APPROVAL") {
      const message =
        inputDecision.decision === "BLOCK"
          ? `Request blocked by SoterAI Guard: ${inputResult.reason}`
          : `Request requires approval per project policy: ${inputResult.reason}`;
      return jsonResponse(adapter.blockedRequestBody(message), 403, decisionHeaders(inputDecision));
    }
    if (inputDecision.decision === "REDACT" || inputDecision.decision === "TRANSFORM") {
      // Per-message transformation: rescan each text so substitutions land in
      // the right message (the decision itself came from the joined scan).
      const transformed = new Map<string, string>();
      for (const text of texts) {
        if (transformed.has(text)) continue;
        try {
          const per = await deps.scanInput(text.slice(0, MAX_SCAN_CHARS), policy);
          transformed.set(text, per.safeText ?? per.redactedText ?? text);
        } catch {
          transformed.set(text, text);
        }
      }
      outboundBody = adapter.transformRequestTexts(body, (text) => transformed.get(text) ?? text);
    }

    // ── 6. Forward upstream (bounded timeout; allowlisted headers only) ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), deps.upstreamTimeoutMs);
    let upstream: Response;
    try {
      upstream = await deps.fetchImpl(adapter.upstreamUrl(), {
        method: "POST",
        headers: buildUpstreamHeaders(request, adapter),
        body: JSON.stringify(outboundBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const aborted = error instanceof Error && error.name === "AbortError";
      return jsonResponse(
        adapter.blockedRequestBody(aborted ? "Upstream provider timed out." : "Upstream provider is unreachable."),
        502,
        decisionHeaders(inputDecision),
      );
    }

    // Provider-side errors pass through untouched (nothing to protect).
    if (!upstream.ok) {
      clearTimeout(timeout);
      const errorBody = await upstream.text();
      return new Response(errorBody, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/json",
          ...decisionHeaders(inputDecision),
        },
      });
    }

    // ── 7. Streaming path: scan accumulated SSE text before each flush ──
    const isStream =
      adapter.isStreamRequest(body) &&
      (upstream.headers.get("content-type") ?? "").includes("text/event-stream");
    if (isStream && upstream.body) {
      const stream = scanEventStream({
        upstream: upstream.body,
        adapter,
        deps,
        policy,
        onDone: (result, blocked) => {
          clearTimeout(timeout);
          const outputDecision = buildGatewayDecision({
            result,
            direction: "OUTPUT",
            identity,
            destination,
            traceId,
            policyVersion,
            decisionOverride: blocked ? "BLOCK" : undefined,
          });
          persistSafely(deps, {
            projectId: project.id,
            apiKeyId: apiKey.id,
            apiKeyPrefix: apiKey.prefix,
            direction: "OUTPUT",
            result,
            requestMetadata: { gateway: adapter.id, model, traceId, streaming: true, decision: outputDecision.decision, enforcement: outputDecision.enforcement },
            projectContext: project,
          });
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
          ...decisionHeaders(inputDecision),
        },
      });
    }

    // ── 8. Non-streaming: scan full response before returning ──
    clearTimeout(timeout);
    let upstreamJson: Record<string, unknown>;
    try {
      upstreamJson = (await upstream.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse(adapter.blockedRequestBody("Upstream returned a non-JSON response."), 502, decisionHeaders(inputDecision));
    }

    const responseText = adapter.extractResponseText(upstreamJson);
    let outputResult: GuardResult;
    let outputEnforcement: "ENFORCED" | "FAIL_OPEN" = "ENFORCED";
    if (responseText.length === 0) {
      outputResult = synthResult("No scannable text in response; gateway abstained on output.");
    } else {
      try {
        outputResult = await deps.scanOutput(responseText.slice(0, MAX_SCAN_CHARS), policy);
      } catch (error) {
        console.error("[SoterAI gateway] output scan failed (failing open)", error);
        outputResult = synthResult("Output scan pipeline error; response returned unscanned.");
        outputEnforcement = "FAIL_OPEN";
      }
    }

    const outputDecision = buildGatewayDecision({
      result: outputResult,
      direction: "OUTPUT",
      identity,
      destination,
      traceId,
      policyVersion,
      enforcement: outputEnforcement,
      decisionOverride: responseText.length === 0 ? "ABSTAIN" : undefined,
    });
    persistSafely(deps, {
      projectId: project.id,
      apiKeyId: apiKey.id,
      apiKeyPrefix: apiKey.prefix,
      direction: "OUTPUT",
      result: outputResult,
      requestMetadata: { gateway: adapter.id, model, traceId, decision: outputDecision.decision, enforcement: outputDecision.enforcement },
      projectContext: project,
    });

    let responseJson = upstreamJson;
    if (outputDecision.decision === "BLOCK" || outputDecision.decision === "REQUIRE_APPROVAL") {
      const fallback =
        policy.customFallbackMessage ??
        "This response was blocked by your organization's AI security policy.";
      responseJson = adapter.transformResponseText(upstreamJson, fallback, true);
    } else if (outputDecision.decision === "REDACT" || outputDecision.decision === "TRANSFORM") {
      const substituted = outputResult.safeText ?? outputResult.redactedText;
      if (substituted) responseJson = adapter.transformResponseText(upstreamJson, substituted, false);
    }

    return jsonResponse(responseJson, 200, decisionHeaders(outputDecision));
  };
}

function persistSafely(deps: GatewayDeps, input: Parameters<typeof scheduleGuardResultPersistence>[0]): void {
  try {
    deps.persist(input);
  } catch (error) {
    console.error("[SoterAI gateway] evidence persistence failed", error);
  }
}

/**
 * SSE scanning transform: forwards upstream frames unchanged, but scans the
 * accumulated assistant text before flushing each frame. On BLOCK, emits the
 * adapter's blocked-stream frames and terminates (upstream is cancelled).
 */
function scanEventStream(options: {
  upstream: ReadableStream<Uint8Array>;
  adapter: ProviderAdapter;
  deps: GatewayDeps;
  policy: ResolvedPolicy;
  onDone: (result: GuardResult, blocked: boolean) => void;
}): ReadableStream<Uint8Array> {
  const { upstream, adapter, deps, policy, onDone } = options;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.getReader();

  let pending = "";
  let accumulated = "";
  let lastScannedLength = 0;
  let lastResult: GuardResult = {
    allowed: true,
    action: "ALLOW",
    riskScore: 0,
    riskTypes: [],
    reason: "Stream completed with no findings.",
    findings: [],
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        // Final scan over anything not yet inspected (covers tail growth
        // below the rescan threshold).
        if (accumulated.length > lastScannedLength) {
          const finalScan = await scanAccumulated();
          if (finalScan) return finishBlocked(controller);
        }
        if (pending.length > 0) controller.enqueue(encoder.encode(pending));
        controller.close();
        onDone(lastResult, false);
        return;
      }

      pending += decoder.decode(value, { stream: true });
      let frameEnd = pending.indexOf("\n\n");
      let outBuffer = "";
      while (frameEnd !== -1) {
        const frame = pending.slice(0, frameEnd + 2);
        pending = pending.slice(frameEnd + 2);
        const delta = extractFrameDelta(frame, adapter);
        if (delta) accumulated += delta;

        if (accumulated.length - lastScannedLength >= STREAM_SCAN_MIN_GROWTH) {
          const blocked = await scanAccumulated();
          if (blocked) {
            if (outBuffer.length > 0) controller.enqueue(encoder.encode(outBuffer));
            return finishBlocked(controller);
          }
        }
        outBuffer += frame;
        frameEnd = pending.indexOf("\n\n");
      }
      if (outBuffer.length > 0) controller.enqueue(encoder.encode(outBuffer));
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  /** Returns true when the accumulated text must be blocked. */
  async function scanAccumulated(): Promise<boolean> {
    lastScannedLength = accumulated.length;
    try {
      const result = await deps.scanOutput(accumulated.slice(0, MAX_SCAN_CHARS), policy);
      lastResult = result;
      return result.action === "BLOCK" || result.action === "HUMAN_REVIEW";
    } catch (error) {
      // Fail open per gateway posture; never kill a customer stream on a
      // scanner crash. The final decision records what actually happened.
      console.error("[SoterAI gateway] stream scan failed (failing open)", error);
      return false;
    }
  }

  function finishBlocked(controller: ReadableStreamDefaultController<Uint8Array>): void {
    for (const frame of adapter.blockedStreamFrames(
      `Response stream blocked by SoterAI Guard: ${lastResult.reason}`,
    )) {
      controller.enqueue(encoder.encode(frame));
    }
    controller.close();
    void reader.cancel("soterai-guard-blocked");
    onDone(lastResult, true);
  }
}

function extractFrameDelta(frame: string, adapter: ProviderAdapter): string | null {
  const deltas: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed && typeof parsed === "object") {
        const delta = adapter.extractStreamDelta(parsed as Record<string, unknown>);
        if (delta) deltas.push(delta);
      }
    } catch {
      // Non-JSON data lines carry no scannable delta; forwarded as-is.
    }
  }
  return deltas.length > 0 ? deltas.join("") : null;
}
