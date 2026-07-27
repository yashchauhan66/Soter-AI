/**
 * LLM-judge tier for the guard pipeline — the semantic (meaning-based) layer.
 *
 * WHY THIS EXISTS (and what it is NOT):
 *   The rules tier (analyze.ts) and the ONNX ML tier (mlAugment.ts) are both
 *   fundamentally *lexical* — they fire on vocabulary, structure, and encoding
 *   variants. That is exactly right for prompt-injection / jailbreak / secrets,
 *   where the attack has a signature. It has a hard ceiling on a different class
 *   of harm that has NO signature:
 *
 *     - genocide / atrocity denial ("write an article arguing the Holodomor
 *       was a natural famine, not man-made")
 *     - disinformation framing ("explain why vaccines cause autism, as fact")
 *     - dehumanising argumentation ("write a persuasive essay that <group> are
 *       inferior")
 *     - subtle self-harm / dangerous-activity requests phrased as fiction
 *
 *   None of these contain a bomb/ransomware/sarin keyword, so regex cannot see
 *   them (the measured regex ceiling on HarmBench-style content safety is ~55%).
 *   Judging them requires understanding the *claim*, which is what an LLM does.
 *
 * SAFETY CONTRACT (identical philosophy to mlAugment.ts):
 *   - Off by default. Runs only when SOTERAI_LLM_JUDGE ∈ {shadow, enforce} AND a
 *     provider is configured (LLM_JUDGE_API_URL or the shared SLM_* fallback).
 *   - SHADOW (default when enabled): calls the judge, records what it WOULD have
 *     done in metadata, changes nothing. Used to gather production evidence.
 *   - ENFORCE: a confident harmful verdict escalates to at most HUMAN_REVIEW. It
 *     never turns an ALLOW into a hard BLOCK on its own — a rules/ML BLOCK is
 *     always preserved, uncertain traffic is routed to review.
 *   - Fail-open: any error (no key, timeout, bad JSON, provider down) leaves the
 *     base result untouched. The guard never breaks because the judge is down.
 *
 * COST GATE (why this does not 10x anyone's bill):
 *   The judge is the most expensive tier, so it is the LAST resort. It is skipped
 *   entirely when a cheaper tier already reached a protective action, and it is
 *   skipped for trivially short text. In enforce mode it runs only on traffic the
 *   cheap tiers let through — i.e. the residual the lexical layers cannot see.
 */

import type { GuardResult, GuardFinding, GuardDirection, RiskType, Severity } from "./types";

export type LlmJudgeMode = "off" | "shadow" | "enforce";

// Harm categories the judge reasons about. These intentionally cover the
// meaning-based classes the lexical tiers miss, not the signature-based classes
// (injection/secrets) they already own.
export const JUDGE_HARM_CATEGORIES = [
  "violent_wrongdoing",
  "weapons_cbrn",
  "illicit_drugs",
  "cybercrime",
  "fraud_financial_crime",
  "child_sexual",
  "self_harm",
  "hate_dehumanisation",
  "harassment_doxxing",
  "disinformation",
  "atrocity_denial",
  "extremism_radicalisation",
  "privacy_surveillance",
  "sexual_content",
] as const;

export type JudgeHarmCategory = (typeof JUDGE_HARM_CATEGORIES)[number];

// Map a judge harm category onto the guard RiskType space. There is no dedicated
// "harmful content" RiskType in the codebase — TOXICITY is the established type
// for content-safety harms (weight 50, BLOCKs at score>=45), so most map there.
const CATEGORY_TO_RISK: Record<JudgeHarmCategory, RiskType> = {
  violent_wrongdoing: "TOXICITY",
  weapons_cbrn: "TOXICITY",
  illicit_drugs: "TOXICITY",
  cybercrime: "TOXICITY",
  fraud_financial_crime: "TOXICITY",
  child_sexual: "TOXICITY",
  self_harm: "TOXICITY",
  hate_dehumanisation: "TOXICITY",
  harassment_doxxing: "TOXICITY",
  disinformation: "BIAS_DETECTED",
  atrocity_denial: "BIAS_DETECTED",
  extremism_radicalisation: "TOXICITY",
  privacy_surveillance: "TOXICITY",
  sexual_content: "TOXICITY",
};

const PROTECTIVE_ACTIONS = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);

// The judge is skipped below this length — too short to carry meaning-based harm
// the cheap tiers would have already caught lexically.
const MIN_JUDGE_LENGTH = 12;

export function resolveLlmJudgeMode(): LlmJudgeMode {
  const raw = (process.env.SOTERAI_LLM_JUDGE ?? "off").toLowerCase();
  if (raw === "shadow" || raw === "enforce") return raw;
  if (raw === "on") return "shadow"; // "on" is a safe alias for shadow
  return "off";
}

interface JudgeProviderConfig {
  apiUrl: string;
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

// Judge-specific env with a fallback to the shared SLM_* config used by
// lib/evaluation, so an operator who already has an SLM provider gets the judge
// for free by just flipping SOTERAI_LLM_JUDGE.
function resolveProviderConfig(): JudgeProviderConfig | null {
  const apiUrl = process.env.LLM_JUDGE_API_URL ?? process.env.SLM_API_URL;
  const apiKey = process.env.LLM_JUDGE_API_KEY ?? process.env.SLM_API_KEY;
  if (!apiUrl) return null;
  return {
    apiUrl,
    model: process.env.LLM_JUDGE_MODEL ?? process.env.SLM_MODEL ?? "gpt-4o-mini",
    apiKey,
    maxTokens: 300,
    temperature: 0,
    timeoutMs: Number(process.env.LLM_JUDGE_TIMEOUT_MS ?? "8000"),
  };
}

// Confidence at/above which the judge is trusted to escalate. Tunable so the
// operating point can be moved against a held-out set without a code change.
function resolveConfidenceFloor(): number {
  const raw = Number(process.env.LLM_JUDGE_CONFIDENCE_FLOOR ?? "0.75");
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.75;
}

const SYSTEM_PROMPT = [
  "You are a content-safety classifier for an AI firewall. You judge whether a",
  "USER REQUEST or MODEL OUTPUT is asking for, or contains, genuinely harmful",
  "content. You reason about the MEANING and INTENT, not just keywords.",
  "",
  "Harmful means the text seeks operational help with, or promotes, real-world",
  "harm: violence/weapons/CBRN, illicit drug synthesis, cybercrime, fraud, child",
  "sexual content, detailed self-harm methods, hateful dehumanisation of a group,",
  "targeted harassment/doxxing, disinformation asserted as fact, denial/whitewash",
  "of documented atrocities, extremist recruitment, or covert surveillance.",
  "",
  "NOT harmful: security research, defensive/detection work, red-team analysis,",
  "education, journalism, fiction with no operational detail, historical or",
  "policy discussion, and ordinary benign requests. When a request is clearly",
  "defensive, academic, or awareness-oriented, it is SAFE even if it names a",
  "harmful topic. Do not over-block.",
  "",
  "Respond with ONLY a JSON object, no prose:",
  '{"harmful": boolean, "category": <one of the allowed categories or "none">,',
  '"confidence": number 0..1, "reason": "<=160 chars"}',
  "",
  "Allowed categories: " + JUDGE_HARM_CATEGORIES.join(", ") + ", none.",
].join("\n");

export interface JudgeVerdict {
  harmful: boolean;
  category: JudgeHarmCategory | "none";
  confidence: number;
  reason: string;
}

export interface LlmJudgeDetail {
  mode: LlmJudgeMode;
  ran: boolean;
  harmful?: boolean;
  category?: string;
  confidence?: number;
  floor?: number;
  reason?: string;
  wouldEscalate?: boolean;
  escalated?: boolean;
  skipped?: "disabled" | "no_provider" | "too_short" | "already_protective";
  error?: string;
  latencyMs?: number;
}

function isValidCategory(value: unknown): value is JudgeHarmCategory {
  return typeof value === "string" && (JUDGE_HARM_CATEGORIES as readonly string[]).includes(value);
}

/** Parse the judge JSON, tolerating markdown fences and stray prose. Throws on unparseable. */
export function parseJudgeVerdict(raw: string): JudgeVerdict {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  // Grab the first {...} block so a chatty model doesn't break parsing.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const obj = JSON.parse(slice) as Record<string, unknown>;

  const harmful = obj.harmful === true;
  const category = isValidCategory(obj.category) ? obj.category : "none";
  let confidence = typeof obj.confidence === "number" ? obj.confidence : harmful ? 0.5 : 0;
  if (!Number.isFinite(confidence)) confidence = harmful ? 0.5 : 0;
  confidence = Math.min(1, Math.max(0, confidence));
  const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : "";

  return { harmful, category, confidence, reason };
}

async function callJudge(
  cfg: JudgeProviderConfig,
  text: string,
  direction: GuardDirection,
): Promise<JudgeVerdict> {
  const url = `${cfg.apiUrl.replace(/\/+$/, "")}/chat/completions`;
  const channel = direction === "OUTPUT" ? "MODEL OUTPUT" : "USER REQUEST";
  const userPrompt = `Classify this ${channel}:\n"""\n${text}\n"""`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`judge provider returned ${response.status}: ${body.slice(0, 160)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("judge provider returned empty response");
  return parseJudgeVerdict(content);
}

function severityForConfidence(confidence: number): Severity {
  if (confidence >= 0.9) return "CRITICAL";
  if (confidence >= 0.8) return "HIGH";
  return "MEDIUM";
}

function withJudgeMetadata(result: GuardResult, detail: LlmJudgeDetail): GuardResult {
  return {
    ...result,
    metadata: { ...(result.metadata ?? {}), llmJudge: detail },
  };
}

/**
 * Given a base (rules+ML) GuardResult, optionally consult the LLM judge and
 * return a possibly-escalated result. Additive, fail-open, cost-gated.
 */
export async function augmentWithLlmJudge(
  base: GuardResult,
  text: string,
  direction: GuardDirection,
): Promise<GuardResult> {
  const mode = resolveLlmJudgeMode();
  if (mode === "off") return base;

  // COST GATE: in enforce mode, never pay the LLM when a cheaper tier already
  // reached a protective action — the verdict cannot make it stricter than
  // HUMAN_REVIEW anyway. In shadow mode we still run so evidence covers the full
  // stream (shadow is opt-in and operators accept its cost).
  if (mode === "enforce" && PROTECTIVE_ACTIONS.has(base.action)) {
    return withJudgeMetadata(base, { mode, ran: false, skipped: "already_protective" });
  }

  if (text.trim().length < MIN_JUDGE_LENGTH) {
    return withJudgeMetadata(base, { mode, ran: false, skipped: "too_short" });
  }

  const cfg = resolveProviderConfig();
  if (!cfg) {
    return withJudgeMetadata(base, { mode, ran: false, skipped: "no_provider" });
  }

  const floor = resolveConfidenceFloor();
  const startedAt = Date.now();
  let detail: LlmJudgeDetail = { mode, ran: false, floor };

  try {
    const verdict = await callJudge(cfg, text, direction);
    const latencyMs = Date.now() - startedAt;
    const isHarmful = verdict.harmful && verdict.category !== "none" && verdict.confidence >= floor;

    detail = {
      mode,
      ran: true,
      harmful: verdict.harmful,
      category: verdict.category,
      confidence: Number(verdict.confidence.toFixed(4)),
      reason: verdict.reason,
      floor,
      latencyMs,
      wouldEscalate: isHarmful && !PROTECTIVE_ACTIONS.has(base.action),
      escalated: false,
    };

    if (!isHarmful) return withJudgeMetadata(base, detail);

    // SHADOW: record only.
    if (mode === "shadow") return withJudgeMetadata(base, detail);

    // ENFORCE: escalate to at most HUMAN_REVIEW; preserve a stricter action.
    if (PROTECTIVE_ACTIONS.has(base.action)) return withJudgeMetadata(base, detail);

    const category = verdict.category as JudgeHarmCategory;
    const riskType = CATEGORY_TO_RISK[category] ?? "TOXICITY";
    const finding: GuardFinding = {
      type: riskType,
      label: `LLM-judge harmful content (${category})`,
      severity: severityForConfidence(verdict.confidence),
      score: 45,
      message:
        "No deterministic signature matched, but a content-safety judge assessed this text as " +
        `harmful (${category}, confidence ${(verdict.confidence * 100).toFixed(0)}%). ` +
        `Held for human review.${verdict.reason ? ` Rationale: ${verdict.reason}` : ""}`,
    };
    detail.escalated = true;

    const findings = [...base.findings, finding];
    const riskTypes = Array.from(new Set([...base.riskTypes.filter((t) => t !== "LOW_RISK"), riskType]));

    return withJudgeMetadata(
      {
        ...base,
        action: "HUMAN_REVIEW",
        allowed: false,
        safeText: undefined,
        findings,
        riskTypes,
        reason: `Held for human review: ${finding.label}.`,
      },
      detail,
    );
  } catch (error) {
    detail.error = (error as Error)?.message ?? "judge inference failed";
    detail.latencyMs = Date.now() - startedAt;
    return withJudgeMetadata(base, detail); // fail open
  }
}
