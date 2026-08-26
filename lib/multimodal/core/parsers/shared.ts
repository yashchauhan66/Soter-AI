/**
 * Helpers shared by every format parser.
 *
 * Parsers report structure and hand back recovered text; they never decide
 * ALLOW or BLOCK, and they never copy asset bytes into a finding. These helpers
 * make both properties easy to hold: `finding()` composes details from constants
 * and numbers, and `TextBudget` caps how much recovered text a single asset can
 * spend so one document cannot exhaust the analyzer for the rest of a batch.
 */
import { countInvisibleCharacters, sanitizeExtractedText } from "../bytes";
import type {
  AssetParseOutput,
  EmbeddedAsset,
  MultimodalFinding,
  MultimodalFindingType,
  MultimodalSeverity,
  MultimodalTextChannel,
} from "../types";
import type { InflateFn } from "../zip";

export interface ParserContext {
  /** Present only when the platform supplied a decompressor. */
  inflate?: InflateFn;
  /** Remaining text budget for this asset, shared across every stream. */
  budget: TextBudget;
  maxEmbeddedAssets: number;
}

/** Tracks how much recovered text an asset has spent. */
export class TextBudget {
  private spent = 0;

  constructor(private readonly limit: number) {}

  get remaining(): number {
    return Math.max(0, this.limit - this.spent);
  }

  get exhausted(): boolean {
    return this.remaining <= 0;
  }

  /** Reserve up to `length` bytes, returning how many the caller may use. */
  take(length: number): number {
    const allowed = Math.min(length, this.remaining);
    this.spent += allowed;
    return allowed;
  }
}

export function finding(
  type: MultimodalFindingType,
  label: string,
  severity: MultimodalSeverity,
  detail: string,
  options: { count?: number; location?: string; advisory?: boolean } = {},
): MultimodalFinding {
  return {
    type,
    label,
    severity,
    count: options.count ?? 1,
    detail,
    ...(options.location ? { location: options.location } : {}),
    ...(options.advisory ? { advisory: true } : {}),
  };
}

/**
 * Record recovered text against the asset's budget. Empty and whitespace-only
 * text is dropped, because an empty stream is not evidence of anything and would
 * only cost an analyzer call.
 */
export function addStream(
  out: AssetParseOutput,
  ctx: ParserContext,
  channel: MultimodalTextChannel,
  origin: string,
  rawText: string,
): void {
  if (!rawText) return;
  const clean = sanitizeExtractedText(rawText);
  if (clean.length < 2) return;
  if (ctx.budget.exhausted) {
    if (!out.limitations.some((line) => line.includes("text budget"))) {
      out.limitations.push(
        "Some recovered text was discarded because the per-asset text budget was reached, so it was not analyzed.",
      );
    }
    return;
  }
  const allowed = ctx.budget.take(clean.length);
  out.streams.push({ channel, origin, text: allowed < clean.length ? clean.slice(0, allowed) : clean });
  if (allowed < clean.length) {
    out.limitations.push(
      `Recovered text from ${origin} was truncated at the per-asset text budget, so the remainder was not analyzed.`,
    );
  }
}

export function addEmbedded(out: AssetParseOutput, ctx: ParserContext, asset: EmbeddedAsset): void {
  if (out.embedded.length >= ctx.maxEmbeddedAssets) {
    if (!out.limitations.some((line) => line.includes("embedded asset limit"))) {
      out.limitations.push(
        `The embedded asset limit of ${ctx.maxEmbeddedAssets} was reached, so later embedded files were not scanned.`,
      );
    }
    return;
  }
  if (asset.bytes.length === 0) return;
  out.embedded.push(asset);
}

export function bump(out: AssetParseOutput, key: string, by = 1): void {
  out.stats[key] = (out.stats[key] ?? 0) + by;
}

/**
 * Invisible-character check over one recovered string. Reported by the parser
 * rather than the orchestrator when the carrier is structural (a tag name, an
 * attribute), since only the parser knows where the text came from.
 */
export function invisibleCharacterFinding(text: string, location: string): MultimodalFinding | null {
  const count = countInvisibleCharacters(text);
  if (count < 4) return null;
  return finding(
    "MM_INVISIBLE_CHARACTERS",
    "Invisible characters in recovered text",
    count >= 24 ? "HIGH" : "MEDIUM",
    `${count} zero-width or bidirectional control characters were found in text recovered from ${location}. Such runs carry instructions a reviewer cannot see.`,
    { count, location },
  );
}

/** Ratio helper that never divides by zero. */
export function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}
