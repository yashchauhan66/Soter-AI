// ── Agent Identity Fabric — Capability Engine ───────────────────────────────
// Parses, matches, and validates capability strings in the format:
//   <action>:<resource-path>[/<subresource>][?<key>=<value>&...]
// ────────────────────────────────────────────────────────────────────────────

import {
  CAPABILITY_ACTIONS,
  type CapabilityAction,
  type ParsedCapability,
  type CapabilityMatchOptions,
} from "./types";

// ── Parsing ──────────────────────────────────────────────────────────────────

const CAPABILITY_REGEX =
  /^(read|write|execute|admin|delegate|inspect|create|delete|modify):(\/(?:[^/?]*\/)*[^/?]*|[^/?][^?]*)(?:\/([^?/]+))?(?:\?(.+))?$/i;

/**
 * Parse a capability string into its structured components.
 * Returns `null` if the string is malformed.
 *
 * @example
 * parseCapability("read:workspace/docs/*")
 * // => { action: "read", resource: "workspace/docs/*", subresource: undefined, conditions: {} }
 *
 * parseCapability("execute:tool/gmail.send?sensitivity=high")
 * // => { action: "execute", resource: "tool/gmail.send", subresource: undefined, conditions: { sensitivity: "high" } }
 */
export function parseCapability(raw: string): ParsedCapability | null {
  const trimmed = raw.trim();
  const match = CAPABILITY_REGEX.exec(trimmed);
  if (!match) return null;

  const action = match[1].toLowerCase() as CapabilityAction;
  if (!(CAPABILITY_ACTIONS as readonly string[]).includes(action)) return null;

  const resource = match[2].replace(/^\//, "").toLowerCase();
  const subresource = match[3]?.toLowerCase();
  const conditions: Record<string, string> = {};
  if (match[4]) {
    for (const pair of match[4].split("&")) {
      const eqIndex = pair.indexOf("=");
      if (eqIndex > 0) {
        const key = decodeURIComponent(pair.slice(0, eqIndex)).trim().toLowerCase();
        const value = decodeURIComponent(pair.slice(eqIndex + 1)).trim().toLowerCase();
        if (key) conditions[key] = value;
      }
    }
  }
  return { action, resource, subresource, conditions };
}

/**
 * Normalize a capability string — parse it and re-serialize.
 * Returns `null` if the input is invalid.
 */
export function normalizeCapability(raw: string): string | null {
  const parsed = parseCapability(raw);
  if (!parsed) return null;
  return serializeCapability(parsed);
}

/**
 * Serialize a parsed capability back into its string form.
 */
export function serializeCapability(cap: ParsedCapability): string {
  let result = `${cap.action}:${cap.resource}`;
  if (cap.subresource) result += `/${cap.subresource}`;
  if (Object.keys(cap.conditions).length > 0) {
    const query = Object.entries(cap.conditions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    result += `?${query}`;
  }
  return result;
}

// ── Glob Matching ────────────────────────────────────────────────────────────

/**
 * Convert a capability glob pattern (supports `*` and `**`) into a RegExp.
 * - `*` matches anything except `/`
 * - `**` matches anything including `/`
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "@__DOUBLESTAR__@")
    .replace(/\*/g, "[^/]*")
    .replace(/@__DOUBLESTAR__@/g, ".*");
  return new RegExp(`^${escaped}$`);
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Check whether a single capability (the grant) satisfies a requested capability.
 *
 * Matching rules:
 * 1. Actions must match exactly (unless the grant action is "admin", which satisfies all)
 * 2. The grant resource pattern is matched as a glob against the request resource
 * 3. Subresources must match exactly (if both present)
 * 4. The grant conditions must be a superset of the request conditions
 *
 * @param grantedCap - The capability being granted (e.g. from a passport)
 * @param requestedCap - The capability being requested (e.g. for a tool call)
 * @param options - Matching behavior options
 */
export function capabilityMatches(
  grantedCap: string,
  requestedCap: string,
  options: CapabilityMatchOptions = {},
): boolean {
  const grant = parseCapability(grantedCap);
  const request = parseCapability(requestedCap);
  if (!grant || !request) return false;

  const { allowStrictToBroad = true, strictConditions = false } = options;

  // Admin action satisfies any requested action.
  if (grant.action !== "admin" && grant.action !== request.action) return false;

  // Resource glob matching.
  if (allowStrictToBroad) {
    // A specific granted resource must match the requested resource.
    if (!globToRegex(grant.resource).test(request.resource)) return false;
  } else {
    // Exact match.
    if (grant.resource !== request.resource) return false;
  }

  // Subresource matching (if specified in request).
  if (request.subresource) {
    // If the grant has a subresource, it must match.
    if (grant.subresource && grant.subresource !== request.subresource) return false;
    // If the grant doesn't specify a subresource, the action grants access to
    // all subresources of the given resource.
  }

  // Condition matching.
  if (strictConditions) {
    // Grant conditions must contain all request conditions.
    for (const [key, value] of Object.entries(request.conditions)) {
      if (grant.conditions[key] !== value) return false;
    }
  } else {
    // Any condition intersection is enough — if the grant has a condition that
    // matches, it's valid. If the request has conditions the grant doesn't,
    // it still matches (the grant is broader).
  }

  return true;
}

/**
 * Check whether any capability in a list satisfies a requested capability.
 */
export function hasCapability(
  grantedCapabilities: string[],
  requestedCapability: string,
  options: CapabilityMatchOptions = {},
): boolean {
  return grantedCapabilities.some((grant) =>
    capabilityMatches(grant, requestedCapability, options),
  );
}

// ── Intersection ─────────────────────────────────────────────────────────────

/**
 * Compute the intersection of two capability lists — the set of capabilities
 * that both lists agree on. Useful when delegating: the child's capabilities
 * cannot exceed the parent's.
 */
export function intersectCapabilities(
  parentCaps: string[],
  childCaps: string[],
): string[] {
  // Strategy: for each child capability, check if it is SUBSET of some parent
  // capability. We check both directions to ensure fidelity.
  const result: string[] = [];

  for (const child of childCaps) {
    const childParsed = parseCapability(child);
    if (!childParsed) continue;

    // A child capability is valid if there exists a parent capability that
    // matches it (child ⊆ parent).
    const hasParentCoverage = parentCaps.some((parent) => {
      const parentParsed = parseCapability(parent);
      if (!parentParsed) return false;
      // Check: parent action must match or be admin
      if (parentParsed.action !== "admin" && parentParsed.action !== childParsed.action) return false;
      // Check: parent resource glob must cover child resource
      if (!globToRegex(parentParsed.resource).test(childParsed.resource)) return false;
      // Check: parent conditions must not conflict
      for (const [key, value] of Object.entries(childParsed.conditions)) {
        if (parentParsed.conditions[key] && parentParsed.conditions[key] !== value) return false;
      }
      return true;
    });

    if (hasParentCoverage) {
      // Also check child doesn't exceed parent (reverse direction)
      const isWithin = parentCaps.some((parent) => {
        // The child's scope must be equal or narrower
        const parentParsed = parseCapability(parent);
        if (!parentParsed) return false;
        if (parentParsed.action !== "admin" && parentParsed.action !== childParsed.action) return false;
        // Check child is a subset of parent for the resource
        const childResource = childParsed.resource;
        const resourceCovered = globToRegex(parentParsed.resource).test(childResource);
        if (!resourceCovered) return false;
        // Child conditions cannot add restrictions that parent doesn't have
        for (const [key] of Object.entries(childParsed.conditions)) {
          if (!(key in parentParsed.conditions)) return false;
        }
        return true;
      });
      if (isWithin) result.push(child);
    }
  }
  return result;
}

// ── Capability Chain Validation ──────────────────────────────────────────────

export interface CapabilityChainNode {
  /** The passport JTI at this level. */
  jti: string;
  /** Capabilities granted at this level. */
  capabilities: string[];
  /** Delegation depth. */
  depth: number;
}

/**
 * Validate a chain of capability delegations. Each step must be a subset of
 * the previous step's capabilities.
 */
export function validateCapabilityChain(
  chain: CapabilityChainNode[],
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (chain.length === 0) {
    return { valid: false, violations: ["Capability chain is empty."] };
  }

  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1];
    const child = chain[i];

    if (child.depth <= parent.depth) {
      violations.push(
        `Chain violation at step ${i}: child depth (${child.depth}) must exceed parent depth (${parent.depth}).`,
      );
      continue;
    }

    // Check each child capability is covered by a parent capability.
    for (const childCap of child.capabilities) {
      const covered = parent.capabilities.some((parentCap) => {
        const childParsed = parseCapability(childCap);
        const parentParsed = parseCapability(parentCap);
        if (!childParsed || !parentParsed) return false;
        if (parentParsed.action !== "admin" && parentParsed.action !== childParsed.action) return false;
        return globToRegex(parentParsed.resource).test(childParsed.resource);
      });
      if (!covered) {
        violations.push(
          `Chain violation at step ${i}: capability "${childCap}" not covered by parent.`,
        );
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Deduplicate and sort a list of capability strings.
 */
export function normalizeCapabilities(caps: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cap of caps) {
    const normalized = normalizeCapability(cap);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result.sort();
}

/**
 * Check if a capability string is syntactically valid.
 */
export function isValidCapability(raw: string): boolean {
  return parseCapability(raw) !== null;
}
