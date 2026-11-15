import { classifyResponse, type AnalyzeOutcome, type Direction, type RawResponseParts } from './review';

export const ANALYZE_ENDPOINT = '/api/guard/analyze';

/** What the caller gets back. `aborted` means a newer request replaced this one. */
export type Analysis =
  | { aborted: true }
  | { aborted: false; outcome: AnalyzeOutcome; retryAtMs?: number };

/**
 * Send one text to the live engine and say what happened.
 *
 * Plain function, no React, so the timing and the status handling live in one
 * place and can be exercised on their own.
 *
 * `text` is sent exactly as given. The caller must pass the trimmed string, and
 * must render that same string: the server trims before it analyses, so the
 * offsets in the response are relative to the trimmed text.
 */
export async function requestAnalysis(
  text: string,
  direction: Direction,
  signal: AbortSignal,
  endpoint: string = ANALYZE_ENDPOINT,
  timeoutMs: number = 15000,
): Promise<Analysis> {
  if (signal.aborted) return { aborted: true };
  const started = performance.now();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', forwardAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000);
  let parts: RawResponseParts;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, direction }),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    parts = {
      status: res.status,
      body,
      retryAfter: res.headers.get('retry-after'),
      remaining: res.headers.get('x-ratelimit-remaining'),
      limit: res.headers.get('x-ratelimit-limit'),
      roundTripMs: Math.round(performance.now() - started),
    };
  } catch {
    if (signal.aborted) return { aborted: true };
    parts = { status: 0, body: null, retryAfter: null, remaining: null, limit: null, roundTripMs: 0 };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', forwardAbort);
  }
  if (signal.aborted) return { aborted: true };
  if (timedOut) {
    return { aborted: false, outcome: { kind: 'unavailable', message: 'The engine took too long to respond. No verdict is shown. Try again.' } };
  }
  const outcome = classifyResponse(parts);
  const retryAtMs = outcome.kind === 'rate-limited' ? Date.now() + outcome.retryAfterSeconds * 1000 : undefined;
  return { aborted: false, outcome, retryAtMs };
}

/** Seconds left until `untilMs`, never negative. */
export function secondsUntil(untilMs: number): number {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}
