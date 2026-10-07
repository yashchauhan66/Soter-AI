/**
 * Continuous learning — the intake seam.
 *
 * WHY THIS FILE EXISTS AT ALL
 *   workers/continuousLearningWorker.ts already exports recordObservation(), and
 *   the obvious "wiring" is to import it from the guard routes. That does not
 *   work, and the reason matters:
 *
 *     1. recordObservation() pushes into a MODULE-LOCAL array. The worker is a
 *        separate process, so a route-side push lands in the web process's copy
 *        of the buffer, which nothing ever drains. The loop would report
 *        "harvest: nothing observed" forever while the web process slowly filled
 *        20,000 rows of RAM.
 *     2. Importing that worker has side effects: three top-level setInterval()s
 *        and http.createServer().listen(3098). A one-line import into a Next.js
 *        route would bind port 3098 in the web process (and fail on the second
 *        instance).
 *
 *   So intake needs a real cross-process transport. This module is that, and it
 *   is deliberately side-effect-free at import: no timers, no sockets, no
 *   listeners. Both ends — the route that writes and the worker that drains —
 *   use the functions here, so the wire format is defined exactly once. A format
 *   defined in two places drifts, and the drift is silent.
 *
 * WHAT IT REFUSES TO DO
 *   - It never blocks or fails a guard request. Every path is fail-open and
 *     swallows its own errors; a learning loop that breaks the guard is strictly
 *     worse than no learning loop.
 *   - It never re-scans text. prepareSafeLogContent() already ran the detectors
 *     and produced the redacted text this queue carries, so intake reuses that
 *     output instead of calling redactBeforePersistence() again. Re-running the
 *     whole detector stack on the hot path to recompute a value we are already
 *     holding is pure latency.
 *   - It never enqueues a row the harvester would drop. detectSignals() is pure
 *     and I/O-free, so intake runs it up front: a row the stack handled
 *     confidently teaches nothing, and queueing it would spend Redis memory and
 *     the worker's batch budget to reach the same conclusion later.
 */

import { randomUUID } from "node:crypto";
import { getRedis, type RedisLike } from "../../redis";
import { detectSignals } from "./harvest";
import type { GuardObservation } from "./types";
import type { MlAugmentDetail } from "../../guard/mlAugment";
import type { GuardDirection } from "../../guard/types";

/** One key, both ends. FIFO: lpush at the head, rpop from the tail. */
export const OBSERVATION_QUEUE_KEY = "soterai:cl:observations";

/**
 * Same switch as the worker (CONTINUOUS_LEARNING=on), read per call rather than
 * at module load so a test can toggle it without re-importing the module graph.
 */
export function intakeEnabled(): boolean {
  return (process.env.CONTINUOUS_LEARNING ?? "off").toLowerCase() === "on";
}

/**
 * Newest-wins cap, mirroring the worker's OBSERVATION_BUFFER_CAP. The queue is a
 * learning buffer, not an audit log: if the worker falls behind, the right thing
 * to lose is the oldest traffic, because novelty is the entire point.
 */
const QUEUE_CAP = Math.max(100, Number(process.env.CL_QUEUE_CAP ?? 20_000));

/**
 * Bounded retention. Set only when the key is created (llen back from lpush is 1),
 * so this costs one extra round trip per TTL window rather than one per request.
 *
 * Consequence, stated rather than discovered later: if the worker is down longer
 * than this, the queue disappears instead of growing. That is the intended
 * trade — week-old traffic is worthless to the harvester, and an unbounded,
 * never-expiring store of customer text is a retention problem even when the
 * text is redacted.
 */
const QUEUE_TTL_SECONDS = Math.max(300, Number(process.env.CL_QUEUE_TTL_SECONDS ?? 604_800));

/**
 * Rows longer than this are skipped, never truncated. Truncating would change
 * the text's fingerprint, and the harvester uses that fingerprint to exclude the
 * frozen eval set — a truncated eval row would hash differently, slip past
 * excludeFingerprints, and end up back in training. Dropping a row is cheap;
 * contaminating the eval set is not recoverable.
 */
const MAX_TEXT_CHARS = Math.max(256, Number(process.env.CL_QUEUE_MAX_TEXT_CHARS ?? 8_000));

export type IntakeOutcome =
  | "queued"
  /** The stack was confident. Correct and by far the most common outcome. */
  | "no-signal"
  | "disabled"
  /** No redacted text was available to learn from without exposing raw content. */
  | "no-text"
  | "too-long"
  /** The text survived redaction as nothing but a placeholder. */
  | "placeholder-only"
  /** The configured Redis has no list ops (a test double, typically). */
  | "unsupported"
  | "error";

export interface ObservationIntakeInput {
  direction: GuardDirection;
  /**
   * The text prepareSafeLogContent() already cleared for persistence. Pass its
   * `safeText`/`redactedText`; pass `originalText` only when that function
   * returned it non-null, which is exactly its own "nothing confidential fired"
   * signal. Raw text must not reach this function.
   */
  text: string | null | undefined;
  /** The action on the FINAL result. rulesTierFlagged() subtracts ML's part. */
  action: string;
  /** result.metadata.ml, as written by withMlMetadata(). */
  ml?: MlAugmentDetail | null;
}

/**
 * Mirror of mlAugment's PROTECTIVE_ACTIONS. Copied rather than imported so this
 * module stays dependency-free enough for the worker to load without pulling the
 * ONNX backend in behind it; tests/continuous-learning-intake.test.ts asserts the
 * copy still equals the exported original, so the duplication cannot drift.
 */
const PROTECTIVE_ACTIONS: ReadonlySet<string> = new Set([
  "BLOCK",
  "HUMAN_REVIEW",
  "REWRITE",
  "ALLOW_WITH_REDACTION",
]);

/**
 * Did the DETERMINISTIC tier consider this an attack?
 *
 * This cannot be read off the final result, and getting it wrong silently
 * destroys the thing intake exists to collect. On escalation mlAugment appends
 * its own finding and risk type and sets the action to HUMAN_REVIEW, so
 * `riskTypes.length > 0` on the final result is true *because* ML said attack —
 * which makes rulesFlagged equal mlSaysAttack by construction, and
 * detectSignals()'s `rules-ml-disagreement`, weighted 0.7 and described there as
 * "the single richest signal", could then never fire once in production.
 *
 * The subtraction is exact rather than heuristic: mlAugment escalates ONLY when
 * the base action was not already protective (mlAugment.ts:520), so when it did
 * escalate the rules tier provably took no protective action, and when it did
 * not, the final action IS the rules action.
 */
export function rulesTierFlagged(action: string, ml?: MlAugmentDetail | null): boolean {
  if (ml?.escalated || ml?.abstainReview) return false;
  return PROTECTIVE_ACTIONS.has(action);
}

/**
 * ANALYZE is an input-side scan, so it learns as INPUT. GuardObservation has
 * only the two directions on purpose: the harvester's dedup and the trainer's
 * label policy both key on input-vs-output, and a third value would silently
 * create a class neither handles.
 */
function observationDirection(direction: GuardDirection): "INPUT" | "OUTPUT" {
  return direction === "OUTPUT" ? "OUTPUT" : "INPUT";
}

/**
 * When the redactor could not do a per-finding replacement, prepareSafeLogContent()
 * substitutes the whole body with a single marker ("[REDACTED_SENSITIVE_CONTENT]",
 * "[REDACTED_SYSTEM_INSTRUCTIONS]"). Such a row carries no linguistic content to
 * learn from, and every one of them normalizes to the same fingerprint, so they
 * would arrive as one endlessly re-merged candidate. Matched by SHAPE rather than
 * against copies of those two literals, so a new marker is covered automatically.
 */
const PLACEHOLDER_ONLY = /^\[REDACTED_[A-Z0-9_]+\]$/;

/**
 * Build the observation, or return null with a reason when there is nothing
 * worth queueing. Pure: no clock beyond Date.now(), no I/O, so it is directly
 * testable without a Redis.
 */
export function buildObservation(
  input: ObservationIntakeInput,
): { observation: GuardObservation } | { rejected: IntakeOutcome } {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) return { rejected: "no-text" };
  if (text.length > MAX_TEXT_CHARS) return { rejected: "too-long" };
  if (PLACEHOLDER_ONLY.test(text)) return { rejected: "placeholder-only" };

  const ml = input.ml;
  // Built WITHOUT an id first. detectSignals() never reads the id, and this
  // function runs on every guard request while rejecting the large majority of
  // them as no-signal, so minting a UUID before that test would spend entropy on
  // a row that is about to be discarded.
  const candidate: Omit<GuardObservation, "id"> = {
    text,
    direction: observationDirection(input.direction),
    // Live traffic, so UNTRUSTED by definition. SOURCE_TRUST maps this to
    // "untrusted", which is what stops decideLabel() auto-assigning `benign`.
    source: "customer-traffic",
    observedAt: Date.now(),
    rulesFlagged: rulesTierFlagged(input.action, ml),
    ml:
      ml && ml.ran
        ? {
            predictedLabel: ml.predictedLabel,
            confidence: ml.confidence,
            attackProbability: ml.attackProbability,
            abstained: ml.abstained,
            gatedBy: ml.gatedBy,
          }
        : undefined,
    // `semantic` is deliberately absent: the semantic classifier's score is not
    // on GuardResult, so there is nothing honest to put here. The cost is that
    // the `gate-near-miss` signal can only fire via the confidence floor from
    // this path, never via semantic-benign. Recording a made-up score to unlock
    // a signal would be worse than not having the signal.
  };

  // The harvester's own test, run here so the queue never carries a row that is
  // provably destined for dropped.noSignal.
  if (detectSignals(candidate as GuardObservation).length === 0) {
    return { rejected: "no-signal" };
  }

  return { observation: { id: randomUUID(), ...candidate } };
}

/** Narrow the optional list ops once, so callers read as straight-line code. */
type ListCapableRedis = RedisLike &
  Required<Pick<RedisLike, "lpush" | "rpop" | "llen" | "ltrim">>;

function withLists(client: RedisLike): ListCapableRedis | null {
  return typeof client.lpush === "function" &&
    typeof client.rpop === "function" &&
    typeof client.llen === "function" &&
    typeof client.ltrim === "function"
    ? (client as ListCapableRedis)
    : null;
}

/**
 * Enqueue one observation. Returns why, so a caller or test can assert the
 * decision instead of inferring it from queue length.
 */
export async function enqueueObservation(
  input: ObservationIntakeInput,
  client?: RedisLike,
): Promise<IntakeOutcome> {
  if (!intakeEnabled()) return "disabled";

  const built = buildObservation(input);
  if ("rejected" in built) return built.rejected;

  try {
    // getRedis() throws in production when nothing is configured; that belongs
    // inside the try, because an unconfigured Redis must not fail a guard call.
    const redis = withLists(client ?? getRedis());
    if (!redis) return "unsupported";

    const length = await redis.lpush(OBSERVATION_QUEUE_KEY, JSON.stringify(built.observation));
    if (length === 1) {
      await redis.expire(OBSERVATION_QUEUE_KEY, QUEUE_TTL_SECONDS);
    }
    if (length > QUEUE_CAP) {
      // Head-side keep: lpush writes the head, so [0, cap-1] is the newest cap
      // rows and the dropped tail is the oldest.
      await redis.ltrim(OBSERVATION_QUEUE_KEY, 0, QUEUE_CAP - 1);
    }
    return "queued";
  } catch (error) {
    console.error("[SoterAI] Continuous-learning intake failed (guard unaffected)", error);
    return "error";
  }
}

/**
 * Fire-and-forget form for the guard hot path. Returns void by design: a caller
 * that cannot await this also cannot be made to handle its failure, so the
 * failure is logged here and nowhere else.
 */
export function recordGuardObservation(input: ObservationIntakeInput): void {
  if (!intakeEnabled()) return;
  void enqueueObservation(input).catch((error) =>
    console.error("[SoterAI] Continuous-learning intake threw (guard unaffected)", error),
  );
}

/**
 * Drain up to `limit` observations, oldest first.
 *
 * EVERY ROW HERE IS UNTRUSTED INPUT. It arrived over a Redis key, and anything
 * with write access to that key — another service, a misconfigured shared
 * instance, an operator's redis-cli — can put arbitrary JSON in it. The
 * poisoning attack this whole subsystem is built to resist is precisely a row
 * claiming `source: "human-review"` with `humanOverrodeTo: "benign"`, because
 * decideLabel() lets a TRUSTED source auto-assign the benign label that deletes
 * a detection class. So the trust-bearing fields are not read from the wire at
 * all: source is clamped to customer-traffic and the human/teacher fields are
 * dropped. Intake only ever writes those values anyway, so clamping costs
 * nothing and closes the escalation.
 */
export async function drainObservations(
  limit: number,
  client?: RedisLike,
): Promise<GuardObservation[]> {
  if (limit <= 0) return [];
  try {
    const redis = withLists(client ?? getRedis());
    if (!redis) return [];

    // rpop-with-count, not lrange+ltrim: the latter is two round trips with no
    // atomicity, so two workers (or one worker plus a restart) can read the same
    // rows twice or trim rows nobody read.
    const raw = await redis.rpop(OBSERVATION_QUEUE_KEY, limit);
    const out: GuardObservation[] = [];
    for (const row of raw ?? []) {
      const parsed = parseObservation(row);
      // A malformed row must not abort the drain — the rest of the batch is
      // still good data, and the popped rows are already gone.
      if (parsed) out.push(parsed);
    }
    return out;
  } catch (error) {
    console.error("[SoterAI] Continuous-learning drain failed", error);
    return [];
  }
}

function parseObservation(row: string): GuardObservation | null {
  let value: unknown;
  try {
    value = JSON.parse(row);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const text = typeof candidate.text === "string" ? candidate.text : "";
  if (!text || text.length > MAX_TEXT_CHARS) return null;

  const observedAt = typeof candidate.observedAt === "number" ? candidate.observedAt : Date.now();
  const ml = candidate.ml && typeof candidate.ml === "object"
    ? (candidate.ml as GuardObservation["ml"])
    : undefined;

  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : randomUUID(),
    text,
    direction: candidate.direction === "OUTPUT" ? "OUTPUT" : "INPUT",
    // Clamped, not read. See the drainObservations() comment.
    source: "customer-traffic",
    observedAt,
    rulesFlagged: candidate.rulesFlagged === true,
    ml,
    // humanLabel / humanOverrodeTo / teacherVerdict are intentionally NOT
    // carried across this boundary: they are the trusted-label fields.
  };
}

/** Queue depth, for the worker's health payload. -1 when unavailable. */
export async function observationQueueDepth(client?: RedisLike): Promise<number> {
  try {
    const redis = withLists(client ?? getRedis());
    if (!redis) return -1;
    return await redis.llen(OBSERVATION_QUEUE_KEY);
  } catch {
    return -1;
  }
}
