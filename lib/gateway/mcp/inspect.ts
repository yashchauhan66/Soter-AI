/**
 * Argument & result inspection for the MCP gateway.
 *
 * Reuses the existing deterministic guard pipeline (runInputGuard /
 * runOutputGuard + applyPolicy) — no second detection engine — and adds the
 * MCP-structural signals a flat text scan misses: filesystem scope, command
 * execution, network destination, and credential-bearing argument keys.
 *
 * Output is privacy-safe: raw matched content is never returned or logged;
 * only label-level finding summaries and already-redacted previews escape.
 */
import { runInputGuard } from "../../guard/inputGuard";
import { runOutputGuard } from "../../guard/outputGuard";
import { applyPolicy, DEFAULT_POLICY, type ResolvedPolicy } from "../../guard/policy";
import type { GuardResult, RiskType } from "../../guard/types";
import { createHash } from "node:crypto";

export interface StructuralSignals {
  /** Absolute/traversal filesystem paths referenced in the arguments. */
  filesystemPaths: string[];
  /** True if any path escapes the allowed roots (widened scope). */
  filesystemScopeViolation: boolean;
  /** Shell-style command strings referenced in the arguments. */
  commands: string[];
  /** Network destinations (host or url) referenced in the arguments. */
  destinations: string[];
  /** Argument keys that look credential-bearing. */
  credentialKeys: string[];
}

export interface InspectionEvidence {
  /** Label-level, privacy-safe (e.g. "SECRET_DETECTED:CRITICAL x2"). */
  findingSummaries: string[];
  categories: string[];
  reasonCodes: string[];
}

export interface ArgInspection {
  guard: GuardResult;
  structural: StructuralSignals;
  evidence: InspectionEvidence;
  /**
   * Redacted, still-structured arguments safe to forward when REDACTing.
   *
   * LAZY + memoized: building this re-runs the full output guard over every
   * string leaf, which on multi-KB arguments costs as much as the primary
   * scan. The overwhelmingly common decision is ALLOW, which forwards the
   * original arguments and never reads this — so it is computed only when a
   * caller actually needs it (REDACT/TRANSFORM forwarding, approval preview,
   * reviewable evidence). Accessing it repeatedly costs the same as once.
   */
  readonly redactedArgs: Record<string, unknown>;
  readonly redactedPreview: string;
}

const PATH_RE = /(?:^|["'\s=:])((?:[A-Za-z]:\\|\/|\.\.[\\/]|~\/)[^"'\s]*)/g;
const COMMAND_KEYS = new Set(["command", "cmd", "exec", "shell", "script", "run", "argv"]);
const DEST_RE = /\b((?:https?|ftp|ssh|file):\/\/[^\s"'<>]+)/gi;
const HOST_RE = /\b((?:\d{1,3}\.){3}\d{1,3}|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?\b/gi;
const CREDENTIAL_KEY_RE = /(secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key|credential|bearer|auth)/i;
const INPUT_DETECTOR_VERSION = "guard-input.v2026-07-30.1";
const MAX_CLEAN_INPUT_CACHE_ENTRIES = 256;

interface CleanGuardTemplate extends Omit<
  GuardResult,
  "originalText" | "safeText" | "redactedText" | "findings"
> {
  findings: GuardResult["findings"];
  forwardsOriginal: boolean;
}

// Only zero-finding ALLOW templates enter this bounded LRU. Keys contain a
// SHA-256 digest plus policy/security context; values contain no prompt text,
// match text, secret, PII, or redacted content.
const CLEAN_INPUT_CACHE = new Map<string, CleanGuardTemplate>();

/** Test/diagnostic counters; never exposes cache keys or values. */
export function cleanInputCacheDiagnostics(): { size: number; maxEntries: number } {
  return { size: CLEAN_INPUT_CACHE.size, maxEntries: MAX_CLEAN_INPUT_CACHE_ENTRIES };
}

export function clearCleanInputCacheForTests(): void {
  CLEAN_INPUT_CACHE.clear();
}

function cleanCacheKey(
  serialized: string,
  policy: ResolvedPolicy,
  allowedRoots: string[] | undefined,
): string {
  const securityContext = JSON.stringify({
    detectorVersion: INPUT_DETECTOR_VERSION,
    detectionTier: process.env.SOTERAI_DETECTION_TIER ?? "hybrid",
    policy,
    allowedRoots: [...(allowedRoots ?? [])].map(normalizePath).sort(),
  });
  return createHash("sha256")
    .update(securityContext)
    .update("\0")
    .update(serialized)
    .digest("hex");
}

function getCleanGuard(key: string, text: string): GuardResult | undefined {
  const template = CLEAN_INPUT_CACHE.get(key);
  if (!template) return undefined;
  CLEAN_INPUT_CACHE.delete(key);
  CLEAN_INPUT_CACHE.set(key, template);
  const { forwardsOriginal, findings, ...rest } = template;
  return {
    ...rest,
    originalText: text,
    redactedText: undefined,
    safeText: forwardsOriginal ? text : undefined,
    findings: findings.map((finding) => ({ ...finding })),
  };
}

function rememberCleanGuard(key: string, guard: GuardResult): void {
  const cacheableRiskTypes = new Set<RiskType>(["LOW_RISK", "TOKEN_ABUSE"]);
  if (
    guard.redactedText !== undefined ||
    guard.findings.some((finding) => finding.matched !== undefined) ||
    guard.riskTypes.some((riskType) => !cacheableRiskTypes.has(riskType))
  ) {
    return;
  }
  const {
    originalText: _originalText,
    safeText: _safeText,
    redactedText: _redactedText,
    findings: _findings,
    ...template
  } = guard;
  CLEAN_INPUT_CACHE.set(key, {
    ...template,
    findings: guard.findings.map((finding) => ({ ...finding })),
    forwardsOriginal: guard.safeText === guard.originalText,
  });
  while (CLEAN_INPUT_CACHE.size > MAX_CLEAN_INPUT_CACHE_ENTRIES) {
    const oldest = CLEAN_INPUT_CACHE.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    CLEAN_INPUT_CACHE.delete(oldest);
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function walkStrings(value: unknown, visit: (key: string, s: string) => void, key = ""): void {
  if (typeof value === "string") {
    visit(key, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) walkStrings(v, visit, k);
  }
}

export function extractStructuralSignals(
  args: Record<string, unknown>,
  allowedRoots?: string[],
): StructuralSignals {
  const filesystemPaths = new Set<string>();
  const commands = new Set<string>();
  const destinations = new Set<string>();
  const credentialKeys = new Set<string>();
  const roots = (allowedRoots ?? []).map(normalizePath);

  walkStrings(args, (key, s) => {
    if (CREDENTIAL_KEY_RE.test(key)) credentialKeys.add(key);
    if (COMMAND_KEYS.has(key.toLowerCase())) commands.add(s.slice(0, 200));
    let m: RegExpExecArray | null;
    PATH_RE.lastIndex = 0;
    while ((m = PATH_RE.exec(s))) filesystemPaths.add(m[1]);
    DEST_RE.lastIndex = 0;
    while ((m = DEST_RE.exec(s))) destinations.add(m[1]);
    HOST_RE.lastIndex = 0;
    while ((m = HOST_RE.exec(s))) destinations.add(m[1]);
  });

  let filesystemScopeViolation = false;
  if (roots.length) {
    for (const p of filesystemPaths) {
      const np = normalizePath(p);
      if (np.includes("../") || !roots.some((r) => np.startsWith(r))) {
        filesystemScopeViolation = true;
        break;
      }
    }
  } else if ([...filesystemPaths].some((p) => normalizePath(p).includes("../"))) {
    filesystemScopeViolation = true;
  }

  return {
    filesystemPaths: [...filesystemPaths].slice(0, 20),
    filesystemScopeViolation,
    commands: [...commands].slice(0, 20),
    destinations: [...destinations].slice(0, 20),
    credentialKeys: [...credentialKeys].slice(0, 20),
  };
}

function summarizeFindings(guard: GuardResult): InspectionEvidence {
  const counts = new Map<string, number>();
  for (const f of guard.findings) {
    const k = `${f.type}:${f.severity}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const findingSummaries = [...counts.entries()].map(([k, n]) => (n > 1 ? `${k} x${n}` : k));
  return {
    findingSummaries,
    categories: [...new Set(guard.riskTypes as RiskType[])],
    reasonCodes: [],
  };
}

/** Serialize arguments deterministically (sorted keys) for scanning + fingerprints. */
export function canonicalStringify(value: unknown): string {
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return "[circular]";
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(walk);
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = walk((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(walk(value)) ?? "";
  } catch {
    return "[unserializable]";
  }
}

/** Rebuild redacted arguments by re-scanning each string leaf through the guard. */
function redactArgs(args: Record<string, unknown>, policy: ResolvedPolicy): Record<string, unknown> {
  const redactLeaf = (s: string): string => {
    const baseline = runOutputGuard(s);
    const res = applyPolicy(s, baseline, policy, "OUTPUT");
    return res.redactedText ?? res.safeText ?? s;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return redactLeaf(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(args) as Record<string, unknown>;
}

export function inspectArguments(
  args: Record<string, unknown>,
  opts: { allowedRoots?: string[]; policy?: ResolvedPolicy; serialized?: string } = {},
): ArgInspection {
  const policy = opts.policy ?? DEFAULT_POLICY;
  // Callers that already hold `canonicalStringify(args)` (the engine computes it
  // for the size bound and the args fingerprint) may pass it in to avoid a second
  // identical serialization of the same object. Same function, same input, same
  // string — the inspection result is unchanged.
  const serialized = opts.serialized ?? canonicalStringify(args);
  const cacheKey = cleanCacheKey(serialized, policy, opts.allowedRoots);
  let guard = getCleanGuard(cacheKey, serialized);
  if (!guard) {
    const baseline = runInputGuard(serialized);
    guard = applyPolicy(serialized, baseline, policy, "INPUT");
    rememberCleanGuard(cacheKey, guard);
  }
  const structural = extractStructuralSignals(args, opts.allowedRoots);
  const evidence = summarizeFindings(guard);

  if (structural.filesystemScopeViolation) evidence.reasonCodes.push("MCP_FILESYSTEM_SCOPE_VIOLATION");
  if (structural.commands.length) evidence.reasonCodes.push("MCP_COMMAND_EXECUTION");
  if (structural.destinations.length) evidence.reasonCodes.push("MCP_NETWORK_DESTINATION");
  if (structural.credentialKeys.length) evidence.reasonCodes.push("MCP_CREDENTIAL_ARGUMENT");

  // Redaction is deferred: see ArgInspection.redactedArgs. Memoized so that a
  // REDACT decision reading both `redactedArgs` and `redactedPreview` still
  // performs exactly one redaction pass.
  let memoArgs: Record<string, unknown> | undefined;
  let memoPreview: string | undefined;
  const getRedactedArgs = (): Record<string, unknown> => {
    if (memoArgs === undefined) memoArgs = redactArgs(args, policy);
    return memoArgs;
  };

  return {
    guard,
    structural,
    evidence,
    get redactedArgs() {
      return getRedactedArgs();
    },
    get redactedPreview() {
      if (memoPreview === undefined) memoPreview = canonicalStringify(getRedactedArgs()).slice(0, 500);
      return memoPreview;
    },
  };
}

export interface ResultInspection {
  guard: GuardResult;
  evidence: InspectionEvidence;
  redactedResult: unknown;
  redactedPreview: string;
}

/** Inspect an upstream tool result before it is released to the client. */
export function inspectResult(
  result: unknown,
  opts: { policy?: ResolvedPolicy } = {},
): ResultInspection {
  const policy = opts.policy ?? DEFAULT_POLICY;
  const serialized = canonicalStringify(result);
  const baseline = runOutputGuard(serialized);
  const guard = applyPolicy(serialized, baseline, policy, "OUTPUT");
  const evidence = summarizeFindings(guard);

  const redactLeaf = (s: string): string => {
    const b = runOutputGuard(s);
    const r = applyPolicy(s, b, policy, "OUTPUT");
    return r.redactedText ?? r.safeText ?? s;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return redactLeaf(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  const redactedResult = walk(result);
  return {
    guard,
    evidence,
    redactedResult,
    redactedPreview: canonicalStringify(redactedResult).slice(0, 500),
  };
}
