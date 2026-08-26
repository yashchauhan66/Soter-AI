/**
 * Format identification from bytes, plus polyglot and declared-type checks.
 *
 * The caller's `declaredMimeType` and the file extension are treated as claims
 * to be verified, never as facts: an "image/png" upload whose bytes are a ZIP is
 * exactly the case this module exists to catch. Everything here is derived from
 * the content itself.
 */
import {
  asciiBytes,
  decodeLatin1,
  indexOfAscii,
  indexOfBytes,
  looksLikeText,
  startsWith,
  startsWithAscii,
  stripBom,
  tag,
} from "./bytes";
import type { MultimodalKind } from "./types";

export type SniffBasis = "magic" | "structure" | "text-heuristic" | "unknown";

export interface SniffResult {
  format: string;
  mimeType: string;
  kind: MultimodalKind;
  basis: SniffBasis;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const MATROSKA_MAGIC = [0x1a, 0x45, 0xdf, 0xa3] as const;
const ICO_MAGIC = [0x00, 0x00, 0x01, 0x00] as const;
const CUR_MAGIC = [0x00, 0x00, 0x02, 0x00] as const;
const BZIP2_MAGIC = [0x42, 0x5a, 0x68] as const;
const GZIP_MAGIC = [0x1f, 0x8b] as const;
const SEVEN_ZIP_MAGIC = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] as const;
const RAR_MAGIC = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] as const;
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd] as const;

/** ISO-BMFF brand -> (format, mime, kind). Covers the HEIF/AVIF image family and MP4 media. */
const FTYP_BRANDS: Record<string, [string, string, MultimodalKind]> = {
  avif: ["avif", "image/avif", "image"],
  avis: ["avif-sequence", "image/avif-sequence", "image"],
  heic: ["heic", "image/heic", "image"],
  heix: ["heic", "image/heic", "image"],
  heim: ["heic", "image/heic", "image"],
  heis: ["heic", "image/heic", "image"],
  hevc: ["heic-sequence", "image/heic-sequence", "image"],
  hevx: ["heic-sequence", "image/heic-sequence", "image"],
  mif1: ["heif", "image/heif", "image"],
  msf1: ["heif-sequence", "image/heif-sequence", "image"],
  "M4A ": ["m4a", "audio/mp4", "audio"],
  "M4B ": ["m4b", "audio/mp4", "audio"],
  "M4P ": ["m4p", "audio/mp4", "audio"],
  "qt  ": ["quicktime", "video/quicktime", "video"],
  M4V: ["m4v", "video/x-m4v", "video"],
  isom: ["mp4", "video/mp4", "video"],
  iso2: ["mp4", "video/mp4", "video"],
  iso4: ["mp4", "video/mp4", "video"],
  iso5: ["mp4", "video/mp4", "video"],
  iso6: ["mp4", "video/mp4", "video"],
  mp41: ["mp4", "video/mp4", "video"],
  mp42: ["mp4", "video/mp4", "video"],
  dash: ["mp4", "video/mp4", "video"],
  "3gp4": ["3gp", "video/3gpp", "video"],
  "3gp5": ["3gp", "video/3gpp", "video"],
};

/** Extension -> expected MIME, for the declared-vs-actual cross-check. */
const EXTENSION_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
  json: "application/json",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  aac: "audio/aac",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  amr: "audio/amr",
  mid: "audio/midi",
  midi: "audio/midi",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

export function extensionOf(fileName?: string): string {
  if (!fileName) return "";
  const clean = fileName.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

export function mimeForExtension(fileName?: string): string | null {
  const ext = extensionOf(fileName);
  return ext ? EXTENSION_MIME[ext] ?? null : null;
}

export function sniffFormat(bytes: Uint8Array): SniffResult {
  if (bytes.length === 0) return { format: "empty", mimeType: "application/octet-stream", kind: "unknown", basis: "unknown" };

  // --- Images -------------------------------------------------------------
  if (startsWith(bytes, PNG_MAGIC)) return { format: "png", mimeType: "image/png", kind: "image", basis: "magic" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { format: "jpeg", mimeType: "image/jpeg", kind: "image", basis: "magic" };
  if (startsWithAscii(bytes, "GIF87a") || startsWithAscii(bytes, "GIF89a")) {
    return { format: "gif", mimeType: "image/gif", kind: "image", basis: "magic" };
  }
  if (startsWithAscii(bytes, "BM") && bytes.length >= 14) {
    return { format: "bmp", mimeType: "image/bmp", kind: "image", basis: "magic" };
  }
  if (startsWithAscii(bytes, "II") && bytes[2] === 0x2a && bytes[3] === 0x00) {
    return { format: "tiff", mimeType: "image/tiff", kind: "image", basis: "magic" };
  }
  if (startsWithAscii(bytes, "MM") && bytes[2] === 0x00 && bytes[3] === 0x2a) {
    return { format: "tiff", mimeType: "image/tiff", kind: "image", basis: "magic" };
  }
  if (startsWith(bytes, ICO_MAGIC) || startsWith(bytes, CUR_MAGIC)) {
    return { format: "ico", mimeType: "image/x-icon", kind: "image", basis: "magic" };
  }

  // --- RIFF family (WEBP image, WAV audio, AVI video) ----------------------
  if (startsWithAscii(bytes, "RIFF") && bytes.length >= 12) {
    const form = tag(bytes, 8, 4);
    if (form === "WEBP") return { format: "webp", mimeType: "image/webp", kind: "image", basis: "magic" };
    if (form === "WAVE") return { format: "wav", mimeType: "audio/wav", kind: "audio", basis: "magic" };
    if (form === "AVI ") return { format: "avi", mimeType: "video/x-msvideo", kind: "video", basis: "magic" };
    return { format: "riff", mimeType: "application/octet-stream", kind: "unknown", basis: "magic" };
  }

  // --- ISO base media (MP4 / HEIF / AVIF) ---------------------------------
  if (tag(bytes, 4, 4) === "ftyp") {
    const brand = tag(bytes, 8, 4) ?? "";
    const known = FTYP_BRANDS[brand] ?? FTYP_BRANDS[brand.trimEnd()];
    if (known) return { format: known[0], mimeType: known[1], kind: known[2], basis: "magic" };
    return { format: "iso-bmff", mimeType: "application/mp4", kind: "video", basis: "magic" };
  }

  // --- Audio --------------------------------------------------------------
  if (startsWithAscii(bytes, "ID3")) return { format: "mp3", mimeType: "audio/mpeg", kind: "audio", basis: "magic" };
  if (startsWithAscii(bytes, "fLaC")) return { format: "flac", mimeType: "audio/flac", kind: "audio", basis: "magic" };
  if (startsWithAscii(bytes, "OggS")) {
    const isOpus = indexOfAscii(bytes.subarray(0, Math.min(bytes.length, 4096)), "OpusHead") !== -1;
    return { format: isOpus ? "opus" : "ogg", mimeType: isOpus ? "audio/opus" : "audio/ogg", kind: "audio", basis: "magic" };
  }
  if (startsWithAscii(bytes, "FORM") && (tag(bytes, 8, 4) === "AIFF" || tag(bytes, 8, 4) === "AIFC")) {
    return { format: "aiff", mimeType: "audio/aiff", kind: "audio", basis: "magic" };
  }
  if (startsWithAscii(bytes, "#!AMR")) return { format: "amr", mimeType: "audio/amr", kind: "audio", basis: "magic" };
  if (startsWithAscii(bytes, "MThd")) return { format: "midi", mimeType: "audio/midi", kind: "audio", basis: "magic" };
  // ADTS AAC and bare MP3 frames: require a valid layer/version nibble so we do
  // not claim audio for any file that happens to start with 0xFF.
  if (bytes[0] === 0xff && bytes.length > 4) {
    const b1 = bytes[1];
    if ((b1 & 0xf6) === 0xf0 || (b1 & 0xf6) === 0xf2) {
      return { format: "aac-adts", mimeType: "audio/aac", kind: "audio", basis: "magic" };
    }
    if ((b1 & 0xe0) === 0xe0 && (b1 & 0x18) !== 0x08 && (b1 & 0x06) !== 0x00) {
      return { format: "mp3", mimeType: "audio/mpeg", kind: "audio", basis: "magic" };
    }
  }

  // --- Video --------------------------------------------------------------
  if (startsWith(bytes, MATROSKA_MAGIC)) {
    const head = bytes.subarray(0, Math.min(bytes.length, 1024));
    const isWebm = indexOfAscii(head, "webm") !== -1;
    return {
      format: isWebm ? "webm" : "matroska",
      mimeType: isWebm ? "video/webm" : "video/x-matroska",
      kind: "video",
      basis: "magic",
    };
  }

  // --- Documents ----------------------------------------------------------
  if (startsWithAscii(bytes, "%PDF-")) return { format: "pdf", mimeType: "application/pdf", kind: "document", basis: "magic" };
  if (startsWith(bytes, OLE2_MAGIC)) return { format: "ole2", mimeType: "application/x-ole-storage", kind: "document", basis: "magic" };
  if (startsWithAscii(bytes, "{\\rtf")) return { format: "rtf", mimeType: "application/rtf", kind: "document", basis: "magic" };

  // --- ZIP-based containers ------------------------------------------------
  if (startsWithAscii(bytes, "PK")) {
    if (bytes[2] === 0x03 && bytes[3] === 0x04) return sniffZipContainer(bytes);
    // Empty (PK\x05\x06) or spanned (PK\x07\x08) archive: still a ZIP, no entries.
    if ((bytes[2] === 0x05 && bytes[3] === 0x06) || (bytes[2] === 0x07 && bytes[3] === 0x08)) {
      return { format: "zip", mimeType: "application/zip", kind: "archive", basis: "magic" };
    }
  }

  // --- Other archives / compressed streams --------------------------------
  if (startsWith(bytes, GZIP_MAGIC)) return { format: "gzip", mimeType: "application/gzip", kind: "archive", basis: "magic" };
  if (startsWith(bytes, BZIP2_MAGIC)) return { format: "bzip2", mimeType: "application/x-bzip2", kind: "archive", basis: "magic" };
  if (startsWith(bytes, SEVEN_ZIP_MAGIC)) return { format: "7z", mimeType: "application/x-7z-compressed", kind: "archive", basis: "magic" };
  if (startsWith(bytes, RAR_MAGIC)) return { format: "rar", mimeType: "application/vnd.rar", kind: "archive", basis: "magic" };
  if (startsWith(bytes, ZSTD_MAGIC)) return { format: "zstd", mimeType: "application/zstd", kind: "archive", basis: "magic" };

  // --- Text-shaped content -------------------------------------------------
  if (looksLikeText(bytes)) return sniffTextual(bytes);

  return { format: "unknown", mimeType: "application/octet-stream", kind: "unknown", basis: "unknown" };
}

/**
 * ZIP entry names decide which container this is. Names live in the local file
 * headers as plain bytes, so a bounded scan of the head identifies OOXML / ODF /
 * JAR without decompressing anything.
 */
function sniffZipContainer(bytes: Uint8Array): SniffResult {
  const head = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  if (indexOfAscii(head, "word/document.xml") !== -1 || indexOfAscii(head, "word/_rels/") !== -1) {
    return {
      format: "ooxml-docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      kind: "document",
      basis: "structure",
    };
  }
  if (indexOfAscii(head, "xl/workbook.xml") !== -1 || indexOfAscii(head, "xl/worksheets/") !== -1) {
    return {
      format: "ooxml-xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      kind: "document",
      basis: "structure",
    };
  }
  if (indexOfAscii(head, "ppt/presentation.xml") !== -1 || indexOfAscii(head, "ppt/slides/") !== -1) {
    return {
      format: "ooxml-pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      kind: "document",
      basis: "structure",
    };
  }
  const odf = indexOfAscii(head, "mimetypeapplication/vnd.oasis.opendocument.");
  if (odf !== -1) {
    const declared = decodeLatin1(head, odf + "mimetype".length, Math.min(head.length, odf + 120));
    const mimeType = declared.split(/[^a-zA-Z0-9./+-]/)[0] || "application/vnd.oasis.opendocument.text";
    return { format: "odf", mimeType, kind: "document", basis: "structure" };
  }
  if (indexOfAscii(head, "META-INF/MANIFEST.MF") !== -1) {
    return { format: "jar", mimeType: "application/java-archive", kind: "archive", basis: "structure" };
  }
  if (indexOfAscii(head, "[Content_Types].xml") !== -1) {
    return { format: "ooxml", mimeType: "application/vnd.openxmlformats-officedocument", kind: "document", basis: "structure" };
  }
  return { format: "zip", mimeType: "application/zip", kind: "archive", basis: "magic" };
}

function sniffTextual(bytes: Uint8Array): SniffResult {
  const head = decodeLatin1(bytes, 0, Math.min(bytes.length, 8192));
  const trimmed = stripBom(head).trimStart();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("<svg") || (lower.startsWith("<?xml") && lower.includes("<svg"))) {
    return { format: "svg", mimeType: "image/svg+xml", kind: "image", basis: "text-heuristic" };
  }
  if (lower.startsWith("<!doctype html") || lower.startsWith("<html") || lower.includes("<html")) {
    return { format: "html", mimeType: "text/html", kind: "document", basis: "text-heuristic" };
  }
  if (lower.startsWith("<?xml") || lower.startsWith("<")) {
    return { format: "xml", mimeType: "application/xml", kind: "document", basis: "text-heuristic" };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return { format: "json", mimeType: "application/json", kind: "text", basis: "text-heuristic" };
  }
  if (trimmed.startsWith("%PDF-")) {
    return { format: "pdf", mimeType: "application/pdf", kind: "document", basis: "magic" };
  }
  return { format: "text", mimeType: "text/plain", kind: "text", basis: "text-heuristic" };
}

export interface PolyglotSignal {
  /** Signature name, e.g. "zip-local-header". Never a byte sample. */
  signature: string;
  /** Byte offset where it was seen, useful for triage and safe to disclose. */
  offset: number;
}

const POLYGLOT_SIGNATURES: Array<{ name: string; needle: number[]; skipOwnHeader: boolean }> = [
  { name: "zip-local-header", needle: asciiBytes("PK"), skipOwnHeader: true },
  { name: "pdf-header", needle: asciiBytes("%PDF-"), skipOwnHeader: true },
  { name: "rar-header", needle: asciiBytes("Rar!"), skipOwnHeader: true },
  { name: "seven-zip-header", needle: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], skipOwnHeader: true },
  { name: "elf-header", needle: [0x7f, ...asciiBytes("ELF")], skipOwnHeader: true },
  { name: "windows-pe-header", needle: [...asciiBytes("PE"), 0x00, 0x00], skipOwnHeader: false },
  { name: "php-open-tag", needle: asciiBytes("<?php"), skipOwnHeader: false },
  { name: "html-script-tag", needle: asciiBytes("<script"), skipOwnHeader: false },
  { name: "wsh-scriptlet", needle: asciiBytes("<scriptlet"), skipOwnHeader: false },
  { name: "shell-shebang", needle: asciiBytes("#!/bin/"), skipOwnHeader: false },
];

/**
 * Formats that legitimately contain other formats. Reporting a ZIP inside a
 * DOCX as a polyglot would be noise, so container formats are exempt from the
 * signatures they are made of.
 */
const CONTAINER_EXEMPTIONS: Record<string, string[]> = {
  "ooxml-docx": ["zip-local-header"],
  "ooxml-xlsx": ["zip-local-header"],
  "ooxml-pptx": ["zip-local-header"],
  ooxml: ["zip-local-header"],
  odf: ["zip-local-header"],
  zip: ["zip-local-header"],
  jar: ["zip-local-header"],
  pdf: ["pdf-header", "zip-local-header"],
  html: ["html-script-tag"],
  svg: ["html-script-tag"],
  xml: ["html-script-tag"],
  ole2: ["zip-local-header"],
  rtf: ["zip-local-header"],
  text: ["shell-shebang", "html-script-tag", "php-open-tag"],
  json: ["html-script-tag"],
};

/**
 * Look for a second file format hiding inside this one. Bounded to `maxScan`
 * bytes so a large upload cannot turn this into a quadratic scan.
 */
export function detectPolyglotSignals(bytes: Uint8Array, format: string, maxScan = 4 * 1024 * 1024): PolyglotSignal[] {
  const window = bytes.length > maxScan ? bytes.subarray(0, maxScan) : bytes;
  const exempt = CONTAINER_EXEMPTIONS[format] ?? [];
  const signals: PolyglotSignal[] = [];
  for (const { name, needle, skipOwnHeader } of POLYGLOT_SIGNATURES) {
    if (exempt.includes(name)) continue;
    // Starting at 1 skips the match that IS this file's own header.
    const at = indexOfBytes(window, needle, skipOwnHeader ? 1 : 0);
    if (at !== -1) signals.push({ signature: name, offset: at });
  }
  return signals;
}

/** True when two MIME types describe the same thing for our purposes. */
export function mimeTypesAgree(a: string, b: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().split(";")[0];
  const left = norm(a);
  const right = norm(b);
  if (left === right) return true;
  const ALIASES: Record<string, string[]> = {
    "image/jpeg": ["image/jpg", "image/pjpeg"],
    "image/x-icon": ["image/vnd.microsoft.icon", "image/ico"],
    "image/tiff": ["image/x-tiff"],
    "audio/wav": ["audio/x-wav", "audio/wave", "audio/vnd.wave"],
    "audio/mpeg": ["audio/mp3", "audio/mpeg3", "audio/x-mpeg-3"],
    "audio/mp4": ["audio/m4a", "audio/x-m4a"],
    "audio/flac": ["audio/x-flac"],
    "audio/midi": ["audio/x-midi"],
    "audio/aiff": ["audio/x-aiff"],
    "application/xml": ["text/xml"],
    "application/zip": ["application/x-zip-compressed", "multipart/x-zip"],
    "application/rtf": ["text/rtf"],
    "text/plain": ["text/markdown", "text/csv", "text/tab-separated-values", "application/json"],
    "application/json": ["text/plain", "text/json"],
    "text/csv": ["text/plain", "application/csv"],
    "video/quicktime": ["video/mov"],
  };
  if ((ALIASES[left] ?? []).includes(right)) return true;
  if ((ALIASES[right] ?? []).includes(left)) return true;
  return false;
}
