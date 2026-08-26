/**
 * v0.2.0 — ML classifier hooks for the scan pipeline.
 *
 * The regex/keyword detectors in `packages/detectors` are fast and deterministic,
 * but they miss semantic patterns: paraphrased secrets, context-dependent PII,
 * and novel prompt-injection phrasings. This module provides two integration
 * points so an ML model can augment the rule-based scan without replacing it:
 *
 *  1. `classifyLocal(text)` — a synchronous, in-extension heuristic that runs on
 *     every scan. Today it ships lightweight statistical signals (entropy,
 *     token-density, injection n-gram scoring). It is designed to be swapped
 *     for a bundled ONNX / TFLite model later without changing the call site.
 *
 *  2. `classifyRemote(text, apiBaseUrl)` — an async call to the Soter backend
 *     `/api/v1/ml/classify` endpoint. The service worker invokes this after the
 *     local scan and merges the result. It is best-effort: a network failure or
 *     timeout never blocks the scan, it only means the ML signal is absent.
 *
 * Design constraints:
 *  - The ML layer can only *raise* the risk score / add findings. It can never
 *    downgrade a rule-based block, so a model regression cannot open a hole.
 *  - Raw text is only sent to the configured Soter backend, never to a third
 *    party. The privacy contract matches the existing audit/scan endpoints.
 *  - All outputs are bounded and validated before they touch the scan result.
 */

export interface MlClassification {
  /** 0–100 confidence that the text contains sensitive content. */
  riskScore: number;
  /** Data-type labels the model believes are present. */
  detectedDataTypes: string[];
  /** Human-readable reason, bounded to 200 chars for audit storage. */
  reason: string;
  /** Which classifier produced this result. */
  source: "local-heuristic" | "remote-model";
}

/* ------------------------------------------------------------------ *
 * 1. Local heuristic classifier
 * ------------------------------------------------------------------ */

/** Shannon entropy of a string; high entropy suggests secrets/keys/tokens. */
function shannonEntropy(text: string): number {
  if (!text.length) return 0;
  const freq = new Map<string, number>();
  for (const ch of text) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Prompt-injection n-gram scoring. These phrases are common in jailbreak and
 * injection attempts. This is a heuristic signal, not a definitive detector —
 * it feeds into the risk score alongside the regex layer.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, weight: 30, label: "prompt_injection" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions|prompts|rules|training)/i, weight: 30, label: "prompt_injection" },
  { pattern: /you\s+are\s+now\s+(a|an|in)\s+(dan|jailbreak|unrestricted|unfiltered)/i, weight: 35, label: "jailbreak" },
  { pattern: /system\s*:\s*(you|ignore|override|new\s+instructions)/i, weight: 20, label: "prompt_injection" },
  { pattern: /\b(do\s+anything\s+now|DAN\s+mode|developer\s+mode)\b/i, weight: 35, label: "jailbreak" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a|an)\s+(unrestricted|unfiltered|amoral)/i, weight: 25, label: "jailbreak" },
  { pattern: /reveal\s+(your|the)\s+(system\s+prompt|instructions|training\s+data)/i, weight: 20, label: "prompt_extraction" },
  { pattern: /what\s+(is|are)\s+your\s+(system\s+prompt|initial\s+instructions)/i, weight: 15, label: "prompt_extraction" },
  { pattern: /base64\s*(decode|encode)\s*(this|the\s+following)/i, weight: 10, label: "obfuscation" },
  { pattern: /\\u[0-9a-f]{4}\\u[0-9a-f]{4}\\u[0-9a-f]{4}/i, weight: 10, label: "obfuscation" },
];

/**
 * Local heuristic classification. Runs synchronously on every scan.
 * Returns a bounded, validated MlClassification.
 */
export function classifyLocal(text: string): MlClassification {
  const detectedDataTypes: string[] = [];
  let riskScore = 0;
  const reasons: string[] = [];

  // Signal 1: high entropy suggests embedded secrets/keys
  const entropy = shannonEntropy(text.slice(0, 4000));
  if (entropy > 4.5 && text.length > 40) {
    riskScore += 15;
    detectedDataTypes.push("high_entropy_content");
    reasons.push("high entropy");
  }

  // Signal 2: prompt-injection / jailbreak n-grams
  for (const { pattern, weight, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      riskScore += weight;
      if (!detectedDataTypes.includes(label)) detectedDataTypes.push(label);
      reasons.push(label);
    }
  }

  // Signal 3: long base64-like blobs (potential exfiltration payload)
  const base64Blob = /[A-Za-z0-9+/=]{80,}/.test(text);
  if (base64Blob) {
    riskScore += 10;
    if (!detectedDataTypes.includes("encoded_payload")) detectedDataTypes.push("encoded_payload");
    reasons.push("encoded payload");
  }

  // Clamp and dedupe
  riskScore = Math.min(100, Math.max(0, Math.round(riskScore)));
  const reason = reasons.length ? `ML heuristic: ${reasons.slice(0, 3).join(", ")}`.slice(0, 200) : "";

  return {
    riskScore,
    detectedDataTypes: detectedDataTypes.slice(0, 10),
    reason,
    source: "local-heuristic",
  };
}

/* ------------------------------------------------------------------ *
 * 2. Remote ML classifier (best-effort, async)
 * ------------------------------------------------------------------ */

const REMOTE_TIMEOUT_MS = 3000;
const REMOTE_MAX_TEXT_CHARS = 8000;

/**
 * Calls the Soter backend ML classification endpoint. Best-effort: returns
 * `null` on any failure (network, timeout, non-200, malformed response) so
 * the caller can proceed with the local-only result.
 *
 * Privacy: text is truncated to REMOTE_MAX_TEXT_CHARS and only sent to the
 * configured Soter apiBaseUrl — never to a third party.
 */
export async function classifyRemote(
  text: string,
  apiBaseUrl: string,
  authToken?: string,
): Promise<MlClassification | null> {
  if (!apiBaseUrl) return null;
  const truncated = text.slice(0, REMOTE_MAX_TEXT_CHARS);
  if (truncated.trim().length < 10) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);

  try {
    const url = `${apiBaseUrl.replace(/\/$/, "")}/api/v1/ml/classify`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: truncated }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const body = await response.json() as Record<string, unknown>;

    // Validate and bound the response before trusting it
    const score = typeof body.riskScore === "number" && Number.isFinite(body.riskScore)
      ? Math.min(100, Math.max(0, Math.round(body.riskScore)))
      : 0;
    const types = Array.isArray(body.detectedDataTypes)
      ? body.detectedDataTypes.filter((t): t is string => typeof t === "string").slice(0, 10)
      : [];
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "";

    if (score === 0 && types.length === 0) return null;

    return {
      riskScore: score,
      detectedDataTypes: types,
      reason,
      source: "remote-model",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * 3. Merge helper
 * ------------------------------------------------------------------ */

/**
 * Merges an ML classification into a scan result's risk score and data types.
 * The ML layer can only RAISE the risk score and ADD findings — it can never
 * downgrade a rule-based decision. Returns the merged values.
 */
export function mergeMlIntoScan(
  baseRiskScore: number,
  baseDetectedDataTypes: string[],
  ml: MlClassification | null | undefined,
): { riskScore: number; detectedDataTypes: string[]; mlReason?: string } {
  if (!ml) return { riskScore: baseRiskScore, detectedDataTypes: baseDetectedDataTypes };
  const riskScore = Math.min(100, Math.max(baseRiskScore, ml.riskScore));
  const detectedDataTypes = Array.from(new Set([...baseDetectedDataTypes, ...ml.detectedDataTypes])).sort();
  return {
    riskScore,
    detectedDataTypes,
    mlReason: ml.reason || undefined,
  };
}