/**
 * Review Mode: turn an engine response into marks on the visitor's own text.
 *
 * This file is pure (no React, no fetch) so it can be tested on its own.
 *
 * What the engine actually returns, checked against https://soterai.in on
 * 2026-11-09 and against lib/guard/types.ts:
 *
 *  - `start` / `end` are UTF-16 code unit offsets, the same as JavaScript string
 *    indices. `text.slice(start, end)` is correct for CJK, Devanagari, Arabic and
 *    emoji. Do not convert to code points.
 *  - `start` and `end` are optional. Some findings have neither.
 *  - Some findings cover the whole input (for example "(compact)" and
 *    "Obfuscated" variants report start 0, end = text length). Drawing one strike
 *    through the entire text says nothing, so those become text-level notes.
 *  - Many findings can describe the same span ("Instruction override" and
 *    "Instruction override (leet)"). They are merged into one mark.
 *  - PII findings carry no `matched` text. Review Mode never needs it: the span
 *    comes from the offsets and the text is the visitor's own.
 *  - A 429 response has the SAME shape as a real BLOCK (action BLOCK, risk type
 *    RATE_LIMIT). Callers must check the HTTP status first. See classifyResponse.
 */

export type GuardAction = 'ALLOW' | 'ALLOW_WITH_REDACTION' | 'REWRITE' | 'BLOCK' | 'HUMAN_REVIEW';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Direction = 'INPUT' | 'OUTPUT';

export interface Finding {
  type?: string;
  label: string;
  severity: Severity;
  score: number;
  message?: string;
  matched?: string;
  start?: number;
  end?: number;
  redactionToken?: string;
}

export interface AnalyzeResult {
  allowed: boolean;
  action: GuardAction;
  riskScore: number;
  reason?: string;
  findings?: Finding[];
  latencyMs?: number;
  redactedText?: string;
  safeText?: string;
  primaryRiskType?: string;
  riskTypes?: string[];
}

/** The verdict names shown to people. Order matters for the legend. */
export type Verdict = 'allow' | 'redact' | 'rewrite' | 'block' | 'review';

export const VERDICT_FOR_ACTION: Record<GuardAction, Verdict> = {
  ALLOW: 'allow',
  ALLOW_WITH_REDACTION: 'redact',
  REWRITE: 'rewrite',
  BLOCK: 'block',
  HUMAN_REVIEW: 'review',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  allow: 'ALLOW',
  redact: 'REDACT',
  rewrite: 'REWRITE',
  block: 'BLOCK',
  review: 'REVIEW',
};

/** What each verdict means in one plain sentence. Used by the legend and tooltips. */
export const VERDICT_MEANING: Record<Verdict, string> = {
  allow: 'Nothing to act on. The text goes through unchanged.',
  redact: 'The text goes through with the marked values replaced.',
  rewrite: 'The text goes through in a safer form.',
  block: 'The text does not go through.',
  review: 'The engine is unsure. A person should look before it goes through.',
};

/** Which verdict a single finding is drawn as. */
export function verdictForFinding(finding: Finding, action: GuardAction): Verdict {
  // Findings that carry a replacement token are redactions, whatever the overall
  // action turned out to be (a BLOCK can still include redacted spans).
  if (finding.redactionToken) return 'redact';
  if (action === 'ALLOW') return 'allow';
  if (action === 'ALLOW_WITH_REDACTION') return 'redact';
  return VERDICT_FOR_ACTION[action];
}

export interface Mark {
  /** Stable id for linking a mark to its margin note. */
  id: string;
  start: number;
  end: number;
  verdict: Verdict;
  /** The text under the mark, taken from the visitor's input. */
  text: string;
  /** Every finding that points at this span, highest score first. */
  findings: Finding[];
  /** Token shown on a redaction bar, if the engine gave one. */
  token?: string;
}

export interface Segment {
  kind: 'plain' | 'mark';
  text: string;
  mark?: Mark;
}

export interface Note {
  /** 1-based marker shown beside the mark and in the margin. */
  index: number;
  markId: string;
  verdict: Verdict;
  label: string;
  severity: Severity;
  score: number;
  message: string;
  /** Other labels merged into this note (for example the "(leet)" variants). */
  alsoFlaggedAs: string[];
}

export interface TextNote {
  verdict: Verdict;
  label: string;
  severity: Severity;
  score: number;
  message: string;
}

export interface ReviewModel {
  segments: Segment[];
  marks: Mark[];
  /** Margin notes, one per mark, in text order. */
  notes: Note[];
  /** Findings with no usable span, or that span the whole input. */
  textNotes: TextNote[];
  verdict: Verdict;
  action: GuardAction;
  riskScore: number;
  reason: string;
  /** True when the engine reported nothing and the action is ALLOW. */
  clean: boolean;
}

const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/** A span is usable if it is a real, in-bounds, non-empty slice of the text. */
export function hasUsableSpan(finding: Finding, textLength: number): boolean {
  const { start, end } = finding;
  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= textLength
  );
}

/**
 * A finding "covers the whole input" if it spans at least 95% of it and the text
 * is longer than a short phrase. Short inputs legitimately match end to end, so
 * those keep their mark.
 */
export function coversWholeText(finding: Finding, textLength: number): boolean {
  if (!hasUsableSpan(finding, textLength)) return false;
  if (textLength < 40) return false;
  const span = (finding.end as number) - (finding.start as number);
  return span / textLength >= 0.95;
}

/** Strongest verdict wins when findings overlap. Block beats redact beats the rest. */
const VERDICT_STRENGTH: Record<Verdict, number> = {
  allow: 0,
  review: 1,
  rewrite: 2,
  redact: 3,
  block: 4,
};

function byScoreDesc(a: Finding, b: Finding): number {
  return b.score - a.score || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
}

/**
 * Build the display model. `text` must be exactly the string that was sent.
 */
export function buildReview(text: string, result: AnalyzeResult): ReviewModel {
  const findings = result.findings ?? [];
  const action = result.action;
  const textLength = text.length;

  const spanned: Finding[] = [];
  const textLevel: Finding[] = [];
  for (const f of findings) {
    if (hasUsableSpan(f, textLength) && !coversWholeText(f, textLength)) spanned.push(f);
    else textLevel.push(f);
  }

  // Group findings that share the exact same span. Then merge spans that overlap.
  const bySpan = new Map<string, Finding[]>();
  for (const f of spanned) {
    const key = `${f.start}:${f.end}`;
    const list = bySpan.get(key);
    if (list) list.push(f);
    else bySpan.set(key, [f]);
  }

  type Range = { start: number; end: number; findings: Finding[] };
  const ranges: Range[] = [...bySpan.entries()]
    .map(([key, list]) => {
      const [s, e] = key.split(':').map(Number);
      return { start: s, end: e, findings: list.sort(byScoreDesc) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) {
      last.end = Math.max(last.end, r.end);
      last.findings = [...last.findings, ...r.findings].sort(byScoreDesc);
    } else {
      merged.push({ ...r, findings: [...r.findings] });
    }
  }

  const marks: Mark[] = merged.map((r, i) => {
    let verdict: Verdict = verdictForFinding(r.findings[0], action);
    for (const f of r.findings) {
      const v = verdictForFinding(f, action);
      if (VERDICT_STRENGTH[v] > VERDICT_STRENGTH[verdict]) verdict = v;
    }
    const token = r.findings.find((f) => f.redactionToken)?.redactionToken;
    return {
      id: `m${i}`,
      start: r.start,
      end: r.end,
      verdict,
      text: text.slice(r.start, r.end),
      findings: r.findings,
      token,
    };
  });

  const segments: Segment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, mark.start) });
    segments.push({ kind: 'mark', text: mark.text, mark });
    cursor = mark.end;
  }
  if (cursor < textLength) segments.push({ kind: 'plain', text: text.slice(cursor) });
  if (segments.length === 0) segments.push({ kind: 'plain', text });

  const notes: Note[] = marks.map((mark, i) => {
    const top = mark.findings[0];
    const topBase = baseLabel(top.label);
    const labels = [...new Set(mark.findings.slice(1).map((f) => baseLabel(f.label)))].filter((l) => l !== topBase);
    return {
      index: i + 1,
      markId: mark.id,
      verdict: mark.verdict,
      label: topBase,
      severity: top.severity,
      score: top.score,
      message: top.message ?? '',
      alsoFlaggedAs: labels,
    };
  });

  const textNotes: TextNote[] = dedupeByLabel(textLevel)
    .sort(byScoreDesc)
    .map((f) => ({
      verdict: verdictForFinding(f, action),
      label: f.label,
      severity: f.severity,
      score: f.score,
      message: f.message ?? '',
    }));

  return {
    segments,
    marks,
    notes,
    textNotes,
    verdict: VERDICT_FOR_ACTION[action],
    action,
    riskScore: result.riskScore,
    reason: result.reason ?? '',
    clean: findings.length === 0 && action === 'ALLOW',
  };
}

/**
 * The engine reports one rule several times when it also fires on a normalised
 * copy of the text: "Instruction override", "Instruction override (leet)",
 * "Instruction override (compact)". To a reader those are one finding. This strips
 * the trailing variant tag. It only removes the known tags, so a label that
 * legitimately ends in brackets is left alone.
 */
export function baseLabel(label: string): string {
  return label.replace(/\s*\((?:leet|compact|generalized|unicode|spaced|reversed|base64)\)\s*$/i, '').trim();
}

function dedupeByLabel(list: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  // Input is sorted by caller; keep the first (highest score) per base label.
  for (const f of [...list].sort(byScoreDesc)) {
    const key = baseLabel(f.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...f, label: key });
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Talking to the engine
 * -------------------------------------------------------------------------- */

export type AnalyzeOutcome =
  | { kind: 'result'; result: AnalyzeResult; serverMs?: number; roundTripMs: number; remaining?: number; limit?: number }
  | { kind: 'rate-limited'; retryAfterSeconds: number; limit?: number }
  | { kind: 'rejected'; message: string }
  | { kind: 'unavailable'; message: string };

export interface RawResponseParts {
  status: number;
  body: unknown;
  retryAfter: string | null;
  remaining: string | null;
  limit: string | null;
  roundTripMs: number;
}

function toNumber(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isAnalyzeResult(body: unknown): body is AnalyzeResult {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.action === 'string' &&
    Object.hasOwn(VERDICT_FOR_ACTION, b.action) &&
    typeof b.riskScore === 'number' &&
    Number.isFinite(b.riskScore) &&
    b.riskScore >= 0 && b.riskScore <= 100 &&
    typeof b.allowed === 'boolean' &&
    (b.findings === undefined || (Array.isArray(b.findings) && b.findings.every((finding) => {
      if (!finding || typeof finding !== 'object') return false;
      const f = finding as Record<string, unknown>;
      return typeof f.label === 'string' && f.label.trim().length > 0 &&
        typeof f.score === 'number' && Number.isFinite(f.score) && f.score >= 0 && f.score <= 100 &&
        typeof f.severity === 'string' && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(f.severity) &&
        ['message', 'matched', 'redactionToken'].every((key) => f[key] === undefined || typeof f[key] === 'string');
    }))) &&
    ['reason', 'redactedText', 'safeText', 'primaryRiskType'].every((key) => b[key] === undefined || typeof b[key] === 'string') &&
    (b.latencyMs === undefined || (typeof b.latencyMs === 'number' && Number.isFinite(b.latencyMs) && b.latencyMs >= 0))
  );
}

/**
 * Decide what a response means. The HTTP status is checked BEFORE the body,
 * because the engine's 429 body is shaped like a real BLOCK verdict. Showing it
 * as one would tell a visitor their text was blocked when they had only run out
 * of requests.
 */
export function classifyResponse(parts: RawResponseParts): AnalyzeOutcome {
  const { status, body } = parts;

  if (status === 429) {
    const retry = toNumber(parts.retryAfter);
    return {
      kind: 'rate-limited',
      retryAfterSeconds: retry !== undefined && retry > 0 ? Math.ceil(retry) : 30,
      limit: toNumber(parts.limit),
    };
  }

  if (status === 400 || status === 413 || status === 415 || status === 422) {
    const message =
      body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : 'The request was not accepted.';
    return { kind: 'rejected', message };
  }

  if (status >= 500 || status === 0) {
    return { kind: 'unavailable', message: 'The engine could not be reached. Try again in a moment.' };
  }

  if (status === 200 && isAnalyzeResult(body)) {
    return {
      kind: 'result',
      result: body,
      serverMs: typeof body.latencyMs === 'number' ? body.latencyMs : undefined,
      roundTripMs: parts.roundTripMs,
      remaining: toNumber(parts.remaining),
      limit: toNumber(parts.limit),
    };
  }

  return { kind: 'unavailable', message: 'The engine returned a response this page does not understand.' };
}
