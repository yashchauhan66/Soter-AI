/**
 * SS-6 — the enforcement overlay's re-mount watchdog, as pure decision logic.
 *
 * A hostile or merely aggressive page can reach the overlay host in three ways that all
 * amount to the same thing — the user stops seeing the security verdict: remove the host
 * node, re-parent it somewhere it no longer covers the viewport, or neutralise it with
 * inline style (`display:none`, `visibility:hidden`, a lower `z-index`, dropping the
 * `data-soter-overlay` attribute that every site adapter keys off). This is the LayerX
 * "Man-in-the-Prompt" class of attack applied to the guard's own UI.
 *
 * The logic lives apart from the MutationObserver wiring for one reason: `tests/extension`
 * runs under `tsx --test` with no DOM library available, so anything that touches `document`
 * cannot be unit-tested at all. Everything here is expressed against injected hooks, so the
 * budget, the ordering and the tamper-report cap are proved by unit test, and the observer
 * wiring that drives it is proved at runtime in a real browser (RT-710).
 *
 * What this deliberately does *not* do is carry the enforcement. The submit gesture is
 * already cancelled by `preventDefault()` before the overlay is ever constructed, and the
 * network-layer deny window (SS-9) is armed by the background worker, not by the DOM. A page
 * that wins the race against the watchdog gets an invisible verdict, not a released
 * submission — which is why exhausting the budget is a safe outcome rather than a bypass.
 */

export type SentinelOutcome =
  /** Host present and intact — nothing to do. */
  | "none"
  /** Host present but tampered with; inline style and attributes were re-applied. */
  | "restored"
  /** Host was gone or re-parented; a fresh one was mounted. */
  | "remounted"
  /** Too many re-mounts inside the window; the watchdog stood down (see the note above). */
  | "budget_exhausted"
  /** Already stopped — a legitimate dismiss, or a previous budget exhaustion. */
  | "stopped";

export interface SentinelHooks {
  /** Is the host still attached where it was put? */
  isMounted(): boolean;
  /**
   * Does the host still carry the marker attribute, the inline style it needs, and the last
   * position among its siblings? The last one matters because a `z-index` tie is broken by
   * DOM order, so a page appending its own maximum-`z-index` element after ours paints over
   * the verdict without touching it.
   */
  isIntact(): boolean;
  /** Re-apply the marker attribute, the inline style, and the stacking position. */
  restoreIntegrity(): void;
  /** Build and attach a fresh host + shadow root with the same verdict. */
  remount(): void;
  now(): number;
  /** Audit hook. Called at most `maxTamperReports` times per overlay. */
  onTamper?(detail: string): void;
}

export interface SentinelLimits {
  /**
   * Corrective actions — re-mounts *and* integrity restores together — allowed inside
   * `windowMs` before the watchdog stands down. Shared rather than per-kind because both
   * kinds can be driven in a loop by a page that keeps undoing the correction, and the
   * point of the budget is to bound that loop however it is shaped.
   */
  maxActions?: number;
  windowMs?: number;
  /** Cap on audit reports, so a remove/remount loop cannot flood the audit endpoint. */
  maxTamperReports?: number;
}

export const SENTINEL_MAX_ACTIONS = 20;
export const SENTINEL_WINDOW_MS = 10_000;
export const SENTINEL_MAX_TAMPER_REPORTS = 2;

export interface OverlaySentinel {
  /** Evaluate the host once. Safe to call from an observer callback and from a timer. */
  check(): SentinelOutcome;
  /** Stand down permanently — called on a legitimate dismiss. */
  stop(): void;
  stats(): { remounts: number; restores: number; reports: number; stopped: boolean };
}

export function createOverlaySentinel(hooks: SentinelHooks, limits: SentinelLimits = {}): OverlaySentinel {
  const maxActions = limits.maxActions ?? SENTINEL_MAX_ACTIONS;
  const windowMs = limits.windowMs ?? SENTINEL_WINDOW_MS;
  const maxTamperReports = limits.maxTamperReports ?? SENTINEL_MAX_TAMPER_REPORTS;

  let actionTimes: number[] = [];
  let remounts = 0;
  let restores = 0;
  let reports = 0;
  let stopped = false;

  const report = (detail: string) => {
    if (reports >= maxTamperReports) return;
    reports += 1;
    hooks.onTamper?.(detail);
  };

  return {
    check() {
      if (stopped) return "stopped";

      const mounted = hooks.isMounted();
      if (mounted && hooks.isIntact()) return "none";

      const at = hooks.now();
      actionTimes = actionTimes.filter((time) => at - time < windowMs);
      if (actionTimes.length >= maxActions) {
        // Standing down beats spinning: the submission is already cancelled, so the cost of
        // losing the overlay is a missing explanation, not a released prompt.
        stopped = true;
        report(`overlay repair budget exhausted (${maxActions} in ${windowMs}ms)`);
        return "budget_exhausted";
      }
      actionTimes.push(at);

      if (!mounted) {
        remounts += 1;
        hooks.remount();
        report("enforcement overlay was removed from the page and re-mounted");
        return "remounted";
      }

      restores += 1;
      hooks.restoreIntegrity();
      report("enforcement overlay host was altered and its integrity was restored");
      return "restored";
    },

    stop() {
      stopped = true;
    },

    stats() {
      return { remounts, restores, reports, stopped };
    },
  };
}

