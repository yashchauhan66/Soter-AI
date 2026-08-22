/**
 * Multimodal scanning contract — shared by every surface (cloud API, n8n node,
 * browser extension, SDKs).
 *
 * Three rules govern everything in `lib/multimodal/core/`:
 *
 * 1. ZERO imports outside this directory. The browser extension bundles these
 *    files directly, so anything reaching into `lib/guard/*` or `node:*` would
 *    break the content-script build. Platform capabilities arrive as adapters.
 * 2. Findings carry type, label, severity and counts ONLY — never the matched
 *    bytes or text. A finding is a claim about a file, not a copy of it.
 * 3. What was not inspected is reported as not inspected. An image whose pixels
 *    were never rendered to text is `renderedText: "not-extracted"` with a
 *    limitation attached — never a clean bill of health.
 */

export type MultimodalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Broad handling class, chosen from the sniffed format rather than the caller's claim. */
export type MultimodalKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "archive"
  | "text"
  | "unknown";

export const MULTIMODAL_FINDING_TYPES = [
  // Container / structure
  "MM_FORMAT_MISMATCH",
  "MM_POLYGLOT_FILE",
  "MM_TRAILING_DATA",
  "MM_EMBEDDED_ARCHIVE",
  "MM_MALFORMED_STRUCTURE",
  "MM_TRUNCATED_ASSET",
  "MM_OVERSIZED_ASSET",
  "MM_DECOMPRESSION_BOMB",
  "MM_EXCESSIVE_METADATA",
  // Active content
  "MM_EMBEDDED_SCRIPT",
  "MM_EMBEDDED_OBJECT",
  "MM_EXTERNAL_REFERENCE",
  "MM_REMOTE_TEMPLATE",
  "MM_SPREADSHEET_FORMULA",
  // Text recovered from the asset, judged by the text analyzer
  "MM_METADATA_INSTRUCTION",
  "MM_RENDERED_INSTRUCTION",
  "MM_DOCUMENT_INSTRUCTION",
  "MM_METADATA_SECRET",
  "MM_DOCUMENT_SECRET",
  "MM_METADATA_PII",
  "MM_DOCUMENT_PII",
  "MM_TEXT_RISK",
  // Presentation tricks aimed at a vision model
  "MM_HIDDEN_TEXT",
  "MM_INVISIBLE_CHARACTERS",
  // Privacy
  "MM_GPS_METADATA",
  // Audio
  "MM_ULTRASONIC_BAND_ENERGY",
  // Honesty
  "MM_UNINSPECTABLE_SEGMENT",
  "MM_UNSUPPORTED_FORMAT",
] as const;

export type MultimodalFindingType = (typeof MULTIMODAL_FINDING_TYPES)[number];

export interface MultimodalFinding {
  type: MultimodalFindingType;
  /** Short human label for dashboards and node output. */
  label: string;
  severity: MultimodalSeverity;
  /** How many times the condition was observed. Never a sample of the content. */
  count: number;
  /**
   * Fixed explanatory sentence. Composed from constants and numbers only, so no
   * caller-supplied bytes can ever travel inside a finding.
   */
  detail: string;
  /** Where in the asset the condition was found, as a structural name (chunk/atom/part). */
  location?: string;
  /**
   * True when the condition is a statistical indicator rather than a decoded
   * fact. Advisory findings still surface, but they never drive a BLOCK alone.
   */
  advisory?: boolean;
}

/** Which class of recovered text a stream belongs to. Drives finding attribution. */
export type MultimodalTextChannel = "metadata" | "rendered" | "document-body";

export interface MultimodalTextStream {
  channel: MultimodalTextChannel;
  /** Structural origin, e.g. "png:tEXt", "exif:UserComment", "ocr", "pdf:text". */
  origin: string;
  text: string;
}

/** Verdict returned by the injected text analyzer. Mirrors the guard result, minus the text. */
export interface MultimodalTextVerdict {
  allowed: boolean;
  riskScore: number;
  riskTypes: string[];
  findingCount: number;
  primaryRiskType?: string;
}

export interface MultimodalOcrResult {
  text: string;
  /** 0-1. Providers that do not report one should omit it rather than invent 1. */
  confidence?: number;
  provider: string;
}

/**
 * Platform capabilities. Every one is optional; a missing adapter degrades
 * coverage and is disclosed in `limitations`, it never silently passes.
 */
export interface MultimodalAdapters {
  /**
   * Inflate a zlib (`raw: false`) or raw-deflate (`raw: true`) stream. Return
   * null when the stream cannot be safely decompressed. Node passes
   * `node:zlib`; browsers pass a `DecompressionStream` wrapper.
   */
  inflate?: (data: Uint8Array, raw: boolean, maxOutputBytes: number) => Promise<Uint8Array | null>;
  /** Render pixel or page text. Absent => `renderedText: "not-extracted"`. */
  ocr?: (input: { bytes: Uint8Array; mimeType: string; fileName?: string }) => Promise<MultimodalOcrResult | null>;
  /** Transcribe speech. Absent => audio speech content is reported as not transcribed. */
  transcribe?: (input: { bytes: Uint8Array; mimeType: string; fileName?: string }) => Promise<MultimodalOcrResult | null>;
  /** Judge recovered text. Absent => recovered text is reported as not judged. */
  analyzeText?: (
    text: string,
    channel: MultimodalTextChannel,
  ) => MultimodalTextVerdict | Promise<MultimodalTextVerdict>;
  /** Lowercase hex digest of the asset, for audit correlation. Optional. */
  hash?: (bytes: Uint8Array) => Promise<string | null>;
}

export interface MultimodalScanOptions {
  /** Reject assets larger than this before parsing. Default 25 MiB. */
  maxBytes?: number;
  /** Total recovered text handed to the analyzer per asset. Default 262144. */
  maxTextBytes?: number;
  /** How deep to follow embedded assets (album art, OOXML media). Default 2, max 3. */
  maxDepth?: number;
  /** Cap on embedded assets extracted per asset. Default 8. */
  maxEmbeddedAssets?: number;
  /**
   * Ask the OCR / transcription adapters for this asset. Default true when the
   * adapter exists. Set false for latency-sensitive paths; coverage then says so.
   */
  extractRenderedText?: boolean;
  /** Wall-clock budget for the adapters on one asset, in ms. Default 30000. */
  adapterTimeoutMs?: number;
}

export type CoverageState =
  | "analyzed"
  | "none-present"
  | "not-extracted"
  | "extraction-failed"
  | "not-applicable"
  | "not-judged";

export interface MultimodalCoverage {
  /** Did the byte-level parser walk the container successfully? */
  structure: "parsed" | "partial" | "not-parsed";
  /** Metadata and embedded text streams (EXIF, ID3, XMP, tEXt, OOXML parts). */
  metadataText: CoverageState;
  /** Pixel text (OCR), page text, or speech. */
  renderedText: CoverageState;
  /** Plain sentences naming everything this scan did not or could not check. */
  limitations: string[];
  /**
   * True only when the structure parsed, every text channel that applies was
   * both extracted and judged, and nothing was skipped for a budget.
   */
  fullyChecked: boolean;
}

export type MultimodalAction = "ALLOW" | "REVIEW" | "BLOCK";

export interface MultimodalAssetInput {
  /** Caller-chosen id echoed back, so batch results can be matched to inputs. */
  id?: string;
  fileName?: string;
  /** What the caller says it is. Cross-checked against the bytes, never trusted. */
  declaredMimeType?: string;
  bytes: Uint8Array;
  /**
   * Text the caller already has for this asset (an existing OCR run, a caption,
   * an alt attribute). Analyzed and disclosed as caller-supplied.
   */
  providedText?: string;
}

export interface MultimodalAssetResult {
  id: string;
  fileName?: string;
  byteLength: number;
  sha256?: string;
  declaredMimeType?: string;
  /** Format name from the bytes, e.g. "png", "mp3-id3", "ooxml-docx". */
  detectedFormat: string;
  detectedMimeType: string;
  kind: MultimodalKind;
  allowed: boolean;
  action: MultimodalAction;
  riskScore: number;
  riskTypes: string[];
  findings: MultimodalFinding[];
  /** Bytes of text recovered from the asset and handed to the analyzer. */
  analyzedTextLength: number;
  /** Per-channel verdicts from the analyzer. Absent channels were not judged. */
  textVerdicts: Partial<Record<MultimodalTextChannel, MultimodalTextVerdict>>;
  coverage: MultimodalCoverage;
  /** True when coverage is incomplete for any reason. */
  degraded: boolean;
  /** Results for assets found inside this one, e.g. album art, OOXML media. */
  embedded: MultimodalAssetResult[];
  reason: string;
  durationMs: number;
}

export interface MultimodalScanResult {
  allowed: boolean;
  action: MultimodalAction;
  riskScore: number;
  riskTypes: string[];
  assets: MultimodalAssetResult[];
  /** True when any asset in the batch was not fully checked. */
  degraded: boolean;
  /** Union of every asset limitation, de-duplicated. */
  limitations: string[];
  reason: string;
  durationMs: number;
}

export const SEVERITY_SCORE: Record<MultimodalSeverity, number> = {
  LOW: 12,
  MEDIUM: 38,
  HIGH: 68,
  CRITICAL: 92,
};
export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MAX_TEXT_BYTES = 256 * 1024;
export const DEFAULT_MAX_DEPTH = 2;
export const DEFAULT_MAX_EMBEDDED = 8;
export const DEFAULT_ADAPTER_TIMEOUT_MS = 30_000;

/** An asset found inside another asset: album art, an OOXML media part, an SVG data URI. */
export interface EmbeddedAsset {
  bytes: Uint8Array;
  /** Structural origin, e.g. "id3:APIC" or "ooxml:word/media/image1.png". */
  origin: string;
  declaredMimeType?: string;
  fileName?: string;
}

/**
 * What one format parser returns. The orchestrator turns this into an
 * `MultimodalAssetResult`; parsers never make ALLOW/BLOCK decisions themselves.
 */
export interface AssetParseOutput {
  structure: "parsed" | "partial" | "not-parsed";
  findings: MultimodalFinding[];
  streams: MultimodalTextStream[];
  embedded: EmbeddedAsset[];
  width?: number;
  height?: number;
  /** Counts only — never content. Surfaced for triage and tests. */
  stats: Record<string, number>;
  /**
   * True when this format carries content a byte parser cannot read (pixels,
   * speech, rasterised pages). Drives the `renderedText` coverage state when no
   * OCR or transcription adapter ran.
   */
  hasUnreadableRenderedContent: boolean;
  /** Sentences naming what this parser could not inspect. */
  limitations: string[];
}

export function emptyParseOutput(structure: AssetParseOutput["structure"] = "parsed"): AssetParseOutput {
  return {
    structure,
    findings: [],
    streams: [],
    embedded: [],
    stats: {},
    hasUnreadableRenderedContent: false,
    limitations: [],
  };
}
