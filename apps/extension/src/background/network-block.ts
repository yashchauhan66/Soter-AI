/**
 * SS-9 — a bounded, tab-scoped, network-layer deny window.
 *
 * Everything the guard enforced before this was a DOM gesture: `preventDefault()` on the
 * click or the Enter key, plus clearing a file input. That stops the *site's* submit path,
 * and RT-702 proves it does. It does nothing about the page issuing the request itself —
 * `fetch("/backend-api/conversation", { method: "POST", body: prompt })` from a hostile or
 * merely eager script needs no gesture and no button, so a `block` verdict was, at the
 * network layer, advisory.
 *
 * `declarativeNetRequest` closes exactly that hole, and only that hole. When a scan returns
 * `block` for a submit or an upload, a *session* rule is installed that denies mutating
 * requests from that one tab to that one host for a few seconds, then removes itself.
 *
 * Honest scope, because the difference matters:
 *
 *  - Covered: the page issuing its own request after (or during) a rendered block verdict —
 *    the replay window that DOM interception cannot reach.
 *  - Not covered: a request the guard never had a verdict for, because nothing it can
 *    observe preceded it. DNR conditions cannot read a request body, so there is no way to
 *    decide "block if this POST contains the prompt" declaratively.
 *  - Not covered: an already-open WebSocket or WebTransport session. DNR matches the
 *    handshake, not frames on an established connection.
 *
 * Three properties keep this from becoming a footgun. It is **tab-scoped**
 * (`condition.tabIds`), so the extension's own audit, scan and lineage POSTs — which the
 * service worker issues with tab id −1 — are never matched by its own rules. It is
 * **method-scoped** to `post`/`put`/`patch`, so the page's GETs for its own chunks, fonts
 * and polling keep working and the user does not see a broken site. And it is **bounded**:
 * a short TTL, a hard cap on concurrent rules, a timer plus a one-shot alarm to remove them,
 * and an orphan reclaim on every service-worker start, so no state can outlive the browser
 * session or a worker restart.
 *
 * The DNR surface is injected rather than imported, so the whole rule lifecycle is
 * unit-testable under `tsx --test` where no `chrome` global exists.
 */

/** How long a block verdict denies the page's own mutating requests to that host. */
export const NETWORK_BLOCK_TTL_MS = 3_000;
/** Reserved session-rule id range. Anything in it that we do not track is an orphan. */
export const NETWORK_BLOCK_RULE_ID_MIN = 9_000;
export const NETWORK_BLOCK_RULE_ID_MAX = 9_099;
/** Concurrent rule cap. Reached only under abuse; refusing to add more is the safe answer. */
export const NETWORK_BLOCK_MAX_ACTIVE = 8;
/** Mutating methods only: a page's own GETs must keep working during the window. */
export const NETWORK_BLOCK_METHODS = ["post", "put", "patch"] as const;
/** `ping` covers `navigator.sendBeacon`, which is a POST with no `fetch` involved. */
export const NETWORK_BLOCK_RESOURCE_TYPES = ["xmlhttprequest", "other", "ping"] as const;

export interface NetworkBlockRule {
  id: number;
  priority: number;
  action: { type: "block" };
  condition: {
    tabIds: number[];
    urlFilter: string;
    initiatorDomains?: string[];
    requestMethods: string[];
    resourceTypes: string[];
  };
}

/** The slice of `chrome.declarativeNetRequest` this needs, and nothing else. */
export interface DnrSessionRuleSurface {
  updateSessionRules(options: { addRules?: NetworkBlockRule[]; removeRuleIds?: number[] }): Promise<void>;
  getSessionRules(): Promise<Array<{ id: number }>>;
}

export type NetworkBlockReason =
  /** The browser exposes no session-rule API — an honest no-op, never a silent claim. */
  | "unsupported"
  /** Turned off by managed policy (`disableNetworkLayerEnforcement`). */
  | "disabled"
  /** No tab id, so the rule could not be scoped and was not installed. */
  | "no_tab"
  /** Not an http(s) URL, so there is nothing to scope a rule to. */
  | "unsupported_url"
  | "cap_reached"
  | "dnr_error";

export interface NetworkBlockOutcome {
  applied: boolean;
  reason?: NetworkBlockReason;
  ruleId?: number;
  host?: string;
  expiresAt?: number;
}

export interface NetworkBlockArmInput {
  tabId?: number;
  url: string;
  /** `false` when managed policy disables network-layer enforcement. */
  enabled?: boolean;
  ttlMs?: number;
}

export interface NetworkBlockDeps {
  /** `null`/absent means the platform does not support it; arming becomes a no-op. */
  dnr?: DnrSessionRuleSurface | null;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /**
   * Asks the platform to wake us up later to sweep. The in-process timer dies with the
   * service worker, so without this a rule could outlive its TTL until the next scan.
   */
  scheduleSweep?: (delayMs: number) => void;
  onEvent?: (message: string) => void;
}

export interface NetworkBlockGuard {
  arm(input: NetworkBlockArmInput): Promise<NetworkBlockOutcome>;
  /** Removes every rule whose TTL has passed. Returns how many were removed. */
  sweep(): Promise<number>;
  /**
   * Removes every rule in the reserved range this instance does not track — i.e. rules left
   * behind by a previous service-worker generation, which has no other way of being cleaned
   * up because the timers that owned them are gone.
   */
  reclaimOrphans(): Promise<number>;
  activeCount(): number;
  /** Test/diagnostic view of what is currently installed. */
  activeRuleIds(): number[];
}

interface ActiveRecord {
  ruleId: number;
  expiresAt: number;
  timer: unknown;
}

/** `initiatorDomains` takes registrable domains; an IP literal or a bare host is rejected. */
function initiatorDomainFor(hostname: string): string[] | undefined {
  if (!hostname.includes(".")) return undefined;
  if (/^[\d.]+$/.test(hostname)) return undefined;
  return [hostname.toLowerCase()];
}

export function createNetworkBlockGuard(deps: NetworkBlockDeps = {}): NetworkBlockGuard {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const active = new Map<number, ActiveRecord>();

  const nextRuleId = (): number | null => {
    for (let id = NETWORK_BLOCK_RULE_ID_MIN; id <= NETWORK_BLOCK_RULE_ID_MAX; id += 1) {
      if (!active.has(id)) return id;
    }
    return null;
  };

  const remove = async (ruleIds: number[]) => {
    if (!ruleIds.length || !deps.dnr) return 0;
    for (const ruleId of ruleIds) {
      const record = active.get(ruleId);
      if (record) clearTimer(record.timer);
      active.delete(ruleId);
    }
    try {
      await deps.dnr.updateSessionRules({ removeRuleIds: ruleIds });
      return ruleIds.length;
    } catch (error) {
      // The local record is dropped either way: a rule we cannot account for must be
      // reclaimable by the orphan sweep rather than pinned by a stale in-memory entry.
      deps.onEvent?.(`network-block: failed to remove rules ${ruleIds.join(",")}: ${String(error)}`);
      return 0;
    }
  };

  const guard: NetworkBlockGuard = {
    async arm(input) {
      if (input.enabled === false) return { applied: false, reason: "disabled" };
      if (!deps.dnr) return { applied: false, reason: "unsupported" };

      let host: string;
      try {
        const parsed = new URL(input.url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return { applied: false, reason: "unsupported_url" };
        }
        host = parsed.hostname;
      } catch {
        return { applied: false, reason: "unsupported_url" };
      }

      // A rule with no tab id would apply to every tab, which is a far larger blast radius
      // than the decision justifies, so absence of a tab id fails *open* by design.
      if (typeof input.tabId !== "number" || input.tabId < 0) {
        return { applied: false, reason: "no_tab", host };
      }

      await guard.sweep();
      if (active.size >= NETWORK_BLOCK_MAX_ACTIVE) {
        deps.onEvent?.(`network-block: ${NETWORK_BLOCK_MAX_ACTIVE} rules already active; not arming another`);
        return { applied: false, reason: "cap_reached", host };
      }

      const ruleId = nextRuleId();
      if (ruleId === null) return { applied: false, reason: "cap_reached", host };

      const ttlMs = input.ttlMs ?? NETWORK_BLOCK_TTL_MS;
      const rule: NetworkBlockRule = {
        id: ruleId,
        priority: 1,
        action: { type: "block" },
        condition: {
          tabIds: [input.tabId],
          urlFilter: `||${host}/`,
          initiatorDomains: initiatorDomainFor(host),
          requestMethods: [...NETWORK_BLOCK_METHODS],
          resourceTypes: [...NETWORK_BLOCK_RESOURCE_TYPES],
        },
      };

      try {
        await deps.dnr.updateSessionRules({ addRules: [rule], removeRuleIds: [ruleId] });
      } catch (error) {
        deps.onEvent?.(`network-block: could not install rule ${ruleId}: ${String(error)}`);
        return { applied: false, reason: "dnr_error", host };
      }

      const expiresAt = now() + ttlMs;
      active.set(ruleId, {
        ruleId,
        expiresAt,
        timer: setTimer(() => void remove([ruleId]), ttlMs),
      });
      // Belt and braces: the timer above dies with the service worker, so the platform is
      // also asked to wake us. Whichever fires first removes the rule; the other no-ops.
      deps.scheduleSweep?.(ttlMs);
      deps.onEvent?.(`network-block: armed rule ${ruleId} for ${host} in tab ${input.tabId} (${ttlMs}ms)`);
      return { applied: true, ruleId, host, expiresAt };
    },

    async sweep() {
      const at = now();
      const expired = [...active.values()].filter((record) => record.expiresAt <= at).map((record) => record.ruleId);
      return remove(expired);
    },

    async reclaimOrphans() {
      if (!deps.dnr) return 0;
      try {
        const installed = await deps.dnr.getSessionRules();
        const orphans = installed
          .map((rule) => rule.id)
          .filter((id) => id >= NETWORK_BLOCK_RULE_ID_MIN && id <= NETWORK_BLOCK_RULE_ID_MAX && !active.has(id));
        if (!orphans.length) return 0;
        await deps.dnr.updateSessionRules({ removeRuleIds: orphans });
        deps.onEvent?.(`network-block: reclaimed ${orphans.length} orphaned rule(s) from a previous worker`);
        return orphans.length;
      } catch (error) {
        deps.onEvent?.(`network-block: orphan reclaim failed: ${String(error)}`);
        return 0;
      }
    },

    activeCount() {
      return active.size;
    },

    activeRuleIds() {
      return [...active.keys()].sort((left, right) => left - right);
    },
  };

  return guard;
}

/**
 * Adapts the live `chrome.declarativeNetRequest` if this browser exposes session rules.
 * Returns `null` when it does not, which makes the whole control an explicit no-op instead of
 * an unverifiable claim.
 */
export function chromeDnrSessionRules(): DnrSessionRuleSurface | null {
  const dnr = (globalThis as { chrome?: { declarativeNetRequest?: Partial<DnrSessionRuleSurface> } }).chrome
    ?.declarativeNetRequest;
  if (typeof dnr?.updateSessionRules !== "function" || typeof dnr?.getSessionRules !== "function") return null;
  return dnr as DnrSessionRuleSurface;
}
