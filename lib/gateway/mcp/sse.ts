/**
 * SSE (Server-Sent Events) transport for the MCP inline gateway.
 *
 * Per the MCP Streamable HTTP spec, SSE carries streaming responses from the
 * server back to the client: the client POSTs JSON-RPC and the gateway
 * responds with SSE frames for long-running operations.
 *
 * SHARED-PIPELINE CONTRACT (rewritten 2026-07-30)
 * -----------------------------------------------
 * This module previously re-implemented its own inspection using
 * `runOutputGuard` + `applyPolicy` directly, and it never called the engine it
 * was handed. That was a duplicated policy path with two defects: it swallowed
 * exceptions and returned "don't block" (fail-open), and it emitted no audit
 * evidence at all. Both are fixed by delegating to the SAME
 * `engine.inspectToolResult` that stdio and HTTP use.
 *
 * Pre-execution enforcement (`evaluateToolCall`) has already run in the HTTP
 * handler before any upstream request is made — a BLOCKed call never reaches
 * this module, because no upstream stream is ever opened for it.
 *
 * FAIL BEHAVIOUR (explicit, mode-dependent):
 *  - Inspector exception → treated as unsafe. In `strict` /
 *    `enterprise_locked` the stream is terminated with a block frame. In other
 *    modes the stream is also terminated, but the reason is marked
 *    FAIL_CLOSED_DEGRADED in evidence. There is NO silent allow in any mode.
 *  - Oversized frame, oversized accumulation, or stream-duration overrun →
 *    block frame + upstream cancel.
 *
 * INSPECT-BEFORE-RELEASE (fixed 2026-07-30):
 *  Frames are held in a queue and are released ONLY after an inspection that
 *  covers them returns RELEASE. The earlier version enqueued each frame
 *  immediately and only scanned once `STREAM_SCAN_MIN_GROWTH` bytes had
 *  accumulated, so any result smaller than that window — the common case — was
 *  released to the client having never been inspected at all. The growth
 *  threshold now bounds re-scan COST only, never release.
 *
 * PULL PRODUCTIVITY (fixed 2026-07-30):
 *  A ReadableStream only re-invokes `pull` after a pull that enqueued, closed or
 *  errored. Holding frames back does none of those, so the first hold-only pull
 *  stalled the response permanently — every result under the scan threshold hung
 *  the client instead of arriving. `pull` therefore keeps consuming upstream in a
 *  loop until it either releases frames or terminates the stream. The loop is
 *  bounded by the frame, accumulation and duration ceilings, and by upstream EOF.
 *
 * HONEST BYPASS — the already-released window:
 *  SSE is incremental, so bytes cleared by an EARLIER passing inspection are
 *  already gone when a LATER batch trips a BLOCK. That window is unavoidable
 *  for any streaming transport: it is exactly the content the guard has already
 *  examined and approved. What is no longer possible is releasing content the
 *  guard never saw. Callers needing whole-result semantics (e.g. a secret split
 *  across two batches) must use the non-streaming JSON path, which inspects the
 *  complete result before releasing any of it.
 */
import type { McpEnforcementEngine } from "./engine";
import type { McpGatewayLimits } from "./types";
import type { McpGatewayDecision } from "./decision";
import { buildMcpDecision } from "./decision";
import type { DecisionIdentity } from "../decision";
import type { ProtectionMode } from "@soterai/guard-core";

/** Hard ceiling on total accumulated scannable text. */
const MAX_ACCUMULATED_BYTES = 5_000_000;
/** Hard ceiling on a single SSE frame. */
const MAX_FRAME_BYTES = 1_000_000;
/** Scan once this many new bytes accumulate. Bounds re-scan cost, not release. */
const STREAM_SCAN_MIN_GROWTH = 256;
/** Hard ceiling on total stream duration. */
const MAX_STREAM_DURATION_MS = 300_000;

export interface SseStreamOptions {
  engine: McpEnforcementEngine;
  limits?: Partial<McpGatewayLimits>;
  onEvidence?: (decision: McpGatewayDecision) => void;
  protectionMode?: ProtectionMode;
  /** Session identity, so failure evidence is attributable to a tenant. */
  identity?: DecisionIdentity;
  /** Called once when the stream ends, for engine concurrency accounting. */
  onComplete?: () => void;
  /** Called to abort the upstream request after BLOCK/QUARANTINE. */
  onCancelUpstream?: () => void;
  now?: () => number;
}

/**
 * Wrap an upstream SSE body in the SoterAI inspection pipeline.
 *
 * Frames are held until an inspection covering them permits release. On a
 * non-releasable decision the upstream is cancelled, the held frames are
 * DISCARDED, and a block frame is the last thing the client sees.
 */
export function createSseInspectionStream(
  upstreamBody: ReadableStream<Uint8Array>,
  tool: string,
  traceId: string,
  opts: SseStreamOptions,
): ReadableStream<Uint8Array> {
  const now = opts.now ?? (() => Date.now());
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstreamBody.getReader();
  const startedAt = now();

  let pending = "";
  let accumulated = "";
  let lastScannedLength = 0;
  let finished = false;
  /**
   * Complete frames that are NOT yet cleared for release. They leave the
   * gateway only after an inspection covering them returns RELEASE.
   */
  let holdQueue: string[] = [];

  const emit = (decision: McpGatewayDecision): void => {
    try {
      opts.onEvidence?.(decision);
    } catch {
      /* evidence must never break enforcement */
    }
  };

  const complete = (): void => {
    if (finished) return;
    finished = true;
    try {
      opts.onComplete?.();
    } catch {
      /* accounting must never break enforcement */
    }
  };

  const cancelUpstream = (reason: string): void => {
    try {
      opts.onCancelUpstream?.();
    } catch {
      /* ignore */
    }
    reader.cancel(reason).catch(() => {});
  };

  /**
   * Inspect accumulated content through the SHARED engine path.
   * Returns null when release is permitted, or a block reason when not.
   */
  const inspect = (text: string): { block: true; reason: string } | null => {
    lastScannedLength = text.length;
    try {
      const inspection = opts.engine.inspectToolResult(
        tool,
        { content: [{ type: "text", text }] },
        traceId,
      );
      emit(inspection.decision);
      // RELEASE is the only outcome that permits continued streaming. REDACT
      // cannot be applied retroactively to already-flushed frames, so on a
      // stream we escalate it to a stop rather than release unredacted bytes.
      if (inspection.outcome === "RELEASE") return null;
      return { block: true, reason: inspection.outcome };
    } catch (err) {
      // Explicit fail-closed. The old code returned false here (fail-open).
      const mode = opts.protectionMode ?? "standard";
      const strict = mode === "strict" || mode === "enterprise_locked";
      emit(
        buildStreamFailureEvidence(
          opts.engine,
          opts.identity ?? { projectId: "unknown" },
          tool,
          traceId,
          (err as Error).name,
          strict,
        ),
      );
      return { block: true, reason: strict ? "INSPECTION_FAILED" : "FAIL_CLOSED_DEGRADED" };
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      /**
       * Release every held frame. Only ever called after a passing inspection.
       * Returns true when something actually reached the client, which is what
       * makes this `pull` invocation "productive" (see the loop below).
       */
      const flushHeld = (): boolean => {
        if (holdQueue.length === 0) return false;
        for (const frame of holdQueue) controller.enqueue(encoder.encode(frame));
        holdQueue = [];
        return true;
      };
      /** Drop held frames unread and terminate with a block frame. */
      const blockAndClose = (message: string): void => {
        holdQueue = [];
        pending = "";
        controller.enqueue(encoder.encode(formatBlockFrame(message)));
        complete();
        controller.close();
      };

      if (finished) {
        controller.close();
        return;
      }

      /**
       * A `pull` MUST enqueue, close, or error before it resolves. Holding
       * frames back does none of those, and a ReadableStream does not re-invoke
       * `pull` after an unproductive one — the stream would stall forever. So we
       * keep consuming upstream within a single `pull` until we either release
       * frames or terminate. Every loop exit is bounded by the frame,
       * accumulation and duration ceilings below.
       */
      for (;;) {
        // Stream-duration bound.
        if (now() - startedAt > MAX_STREAM_DURATION_MS) {
          cancelUpstream("soterai-stream-duration-exceeded");
          blockAndClose("Stream exceeded maximum duration");
          return;
        }

        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          // Upstream failed mid-stream: held frames were never cleared, so they
          // are discarded rather than released un-inspected.
          blockAndClose("Upstream stream error");
          return;
        }

        if (chunk.done) {
          // A trailing partial frame is still protected content: fold it into
          // the scanned text and hold it, rather than flushing it un-inspected.
          if (pending.length > 0) {
            const tailText = extractEventText(pending);
            if (tailText) accumulated += tailText;
            holdQueue.push(pending);
            pending = "";
          }
          if (accumulated.length > lastScannedLength) {
            const verdict = inspect(accumulated);
            if (verdict) {
              blockAndClose(`Response blocked by SoterAI (${verdict.reason})`);
              return;
            }
          }
          flushHeld();
          complete();
          controller.close();
          return;
        }

        pending += decoder.decode(chunk.value, { stream: true });

        // Bound the un-framed buffer: a peer that never sends "\n\n" must not
        // grow memory without limit.
        if (Buffer.byteLength(pending, "utf8") > MAX_FRAME_BYTES) {
          cancelUpstream("soterai-frame-too-large");
          blockAndClose("SSE frame exceeded size bound");
          return;
        }

        let released = false;
        let eventEnd: number;
        while ((eventEnd = pending.indexOf("\n\n")) >= 0) {
          const frame = pending.slice(0, eventEnd + 2);
          pending = pending.slice(eventEnd + 2);

          const eventText = extractEventText(frame);
          if (eventText) accumulated += eventText;

          // Held first, released later — never the other way round.
          holdQueue.push(frame);

          if (Buffer.byteLength(accumulated, "utf8") > MAX_ACCUMULATED_BYTES) {
            cancelUpstream("soterai-accumulation-exceeded");
            blockAndClose("Accumulated response exceeded size bound");
            return;
          }

          if (accumulated.length - lastScannedLength >= STREAM_SCAN_MIN_GROWTH) {
            const verdict = inspect(accumulated);
            if (verdict) {
              cancelUpstream("soterai-guard-blocked");
              blockAndClose(`Response stream blocked by SoterAI (${verdict.reason})`);
              return;
            }
            released = flushHeld() || released;
          }
        }

        // Frames reached the client, so this `pull` was productive and the
        // stream will call us again. Otherwise keep reading upstream.
        if (released) return;
      }
    },

    cancel(reason) {
      // Client disconnected — cancel upstream so the call does not keep running.
      cancelUpstream(typeof reason === "string" ? reason : "client-cancelled");
      complete();
    },
  });
}

function extractEventText(frame: string): string | null {
  const parts: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("data:")) {
      const data = line.slice(5).trim();
      if (data && data !== "[DONE]") parts.push(data);
    }
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

function formatBlockFrame(message: string): string {
  const payload = { type: "error", error: { type: "soterai_guard_blocked", message } };
  return `event: error\ndata: ${JSON.stringify(payload)}\n\n`;
}

/** Privacy-safe evidence for an inspector failure during streaming. */
function buildStreamFailureEvidence(
  engine: McpEnforcementEngine,
  identity: DecisionIdentity,
  tool: string,
  traceId: string,
  errorName: string,
  strict: boolean,
): McpGatewayDecision {
  return buildMcpDecision({
    decision: "BLOCK",
    riskScore: 80,
    identity,
    server: "unknown",
    tool,
    transport: "mcp-sse",
    argsFingerprint: "af_none",
    reason: `stream inspection failed (${errorName}) — failing closed`,
    policyVersion: engine.policyVersion,
    traceId,
    direction: "OUTPUT",
    // The stream is stopped in every mode, so enforcement really is ENFORCED.
    // The reason codes record which posture produced it.
    enforcement: "ENFORCED",
    evidence: {
      reasonCodes: [
        `STREAM_INSPECTION_ERROR:${errorName}`,
        strict ? "FAIL_CLOSED_STRICT" : "FAIL_CLOSED_DEGRADED",
      ],
      categories: ["MCP_STREAM_INSPECTION"],
      findingSummaries: [],
      redactedArgsPreview: "",
    },
  });
}
