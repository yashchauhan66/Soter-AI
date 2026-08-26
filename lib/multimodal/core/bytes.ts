/**
 * Byte helpers for the multimodal parsers.
 *
 * Everything here works on `Uint8Array` rather than `Buffer` so the same parser
 * code runs in a Next.js route, an n8n worker and a browser content script. All
 * readers are bounds-checked and return null past the end instead of throwing,
 * because a malformed asset is an expected input, not an exception.
 */

const utf8 = new TextDecoder("utf-8", { fatal: false });
const latin1 = new TextDecoder("latin1", { fatal: false });
const utf16le = new TextDecoder("utf-16le", { fatal: false });
const utf16be = new TextDecoder("utf-16be", { fatal: false });

export function decodeUtf8(bytes: Uint8Array, start = 0, end = bytes.length): string {
  if (start >= end) return "";
  return utf8.decode(bytes.subarray(clamp(start, 0, bytes.length), clamp(end, 0, bytes.length)));
}

export function decodeLatin1(bytes: Uint8Array, start = 0, end = bytes.length): string {
  if (start >= end) return "";
  return latin1.decode(bytes.subarray(clamp(start, 0, bytes.length), clamp(end, 0, bytes.length)));
}

export function decodeUtf16(bytes: Uint8Array, start = 0, end = bytes.length): string {
  const slice = bytes.subarray(clamp(start, 0, bytes.length), clamp(end, 0, bytes.length));
  if (slice.length >= 2 && slice[0] === 0xff && slice[1] === 0xfe) return utf16le.decode(slice.subarray(2));
  if (slice.length >= 2 && slice[0] === 0xfe && slice[1] === 0xff) return utf16be.decode(slice.subarray(2));
  // No BOM: ID3v2.4 encoding 2 is defined as UTF-16BE without one.
  return utf16be.decode(slice);
}

export function decodeUtf16Le(bytes: Uint8Array, start = 0, end = bytes.length): string {
  return utf16le.decode(bytes.subarray(clamp(start, 0, bytes.length), clamp(end, 0, bytes.length)));
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function u8(bytes: Uint8Array, offset: number): number | null {
  return offset >= 0 && offset < bytes.length ? bytes[offset] : null;
}

export function u16be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

export function u16le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function u32be(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  // >>> 0 keeps the value unsigned; a leading byte >= 0x80 would otherwise go negative.
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function u32le(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

export function i16le(bytes: Uint8Array, offset: number): number | null {
  const value = u16le(bytes, offset);
  if (value === null) return null;
  return value >= 0x8000 ? value - 0x10000 : value;
}

export function i32le(bytes: Uint8Array, offset: number): number | null {
  const value = u32le(bytes, offset);
  if (value === null) return null;
  return value >= 0x80000000 ? value - 0x100000000 : value;
}

/** ASCII tag of `length` bytes, or null when out of bounds. Used for chunk/atom names. */
export function tag(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > bytes.length) return null;
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

export function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (offset + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

export function startsWithAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** First index of an ASCII needle at or after `from`, or -1. */
export function indexOfAscii(bytes: Uint8Array, needle: string, from = 0): number {
  if (needle.length === 0) return -1;
  const first = needle.charCodeAt(0);
  const limit = bytes.length - needle.length;
  for (let i = Math.max(0, from); i <= limit; i += 1) {
    if (bytes[i] !== first) continue;
    let matched = true;
    for (let j = 1; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

export function countAscii(bytes: Uint8Array, needle: string, limit = 64): number {
  let count = 0;
  let at = indexOfAscii(bytes, needle, 0);
  while (at !== -1 && count < limit) {
    count += 1;
    at = indexOfAscii(bytes, needle, at + needle.length);
  }
  return count;
}

/**
 * First index of a byte-sequence needle at or after `from`, or -1. Used for
 * signatures that are not printable ASCII (ELF's 0x7F, PE's trailing NULs).
 */
export function indexOfBytes(bytes: Uint8Array, needle: readonly number[], from = 0): number {
  if (needle.length === 0) return -1;
  const limit = bytes.length - needle.length;
  for (let i = Math.max(0, from); i <= limit; i += 1) {
    if (bytes[i] !== needle[0]) continue;
    let matched = true;
    for (let j = 1; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

/** ASCII codepoints of a literal, for building byte-sequence signatures. */
export function asciiBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
  return out;
}

/** Drop a leading UTF-8 BOM without embedding one in this file. */
export function stripBom(text: string): string {
  return text.length > 0 && text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) table[BASE64_ALPHABET.charCodeAt(i)] = i;
  // URL-safe aliases ('-' = 45, '_' = 95), so a data URI written that way decodes.
  table[45] = 62;
  table[95] = 63;
  return table;
})();

/**
 * Decode base64 without depending on `atob` or `Buffer`, so the same code path
 * works in a content script, an n8n worker and a route handler. Returns null on
 * malformed input rather than throwing, and refuses anything over `maxBytes`.
 */
export function decodeBase64(input: string, maxBytes = 32 * 1024 * 1024): Uint8Array | null {
  let clean = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 0x3d) break; // '=' padding ends the payload
    if (BASE64_LOOKUP[code] >= 0) clean += input[i];
    else if (code === 0x0a || code === 0x0d || code === 0x20 || code === 0x09) continue;
    else return null;
  }
  const outLength = Math.floor((clean.length * 3) / 4);
  if (outLength > maxBytes) return null;
  const out = new Uint8Array(outLength);
  let bits = 0;
  let value = 0;
  let position = 0;
  for (let i = 0; i < clean.length; i += 1) {
    value = (value << 6) | BASE64_LOOKUP[clean.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[position] = (value >> bits) & 0xff;
      position += 1;
    }
  }
  return position === outLength ? out : out.subarray(0, position);
}

/**
 * Printable ASCII runs of at least `minRun` characters, joined by newlines.
 * Used for metadata blobs whose internal format we do not parse (IPTC, MakerNote,
 * OLE streams): recovering the readable strings is enough to run text analysis,
 * and pretending we understood the container would be the dishonest option.
 */
export function extractPrintableRuns(
  bytes: Uint8Array,
  minRun = 8,
  maxTotal = 32 * 1024,
): string {
  const runs: string[] = [];
  let current = "";
  let total = 0;
  for (let i = 0; i < bytes.length && total < maxTotal; i += 1) {
    const byte = bytes[i];
    const printable = byte === 0x09 || byte === 0x0a || (byte >= 0x20 && byte <= 0x7e);
    if (printable) {
      current += String.fromCharCode(byte);
      continue;
    }
    if (current.length >= minRun) {
      runs.push(current);
      total += current.length;
    }
    current = "";
  }
  if (current.length >= minRun && total < maxTotal) runs.push(current);
  return runs.join("\n");
}

/** NUL-terminated latin1 string starting at `offset`, bounded by `end`. */
export function readCString(
  bytes: Uint8Array,
  offset: number,
  end = bytes.length,
): { text: string; next: number } {
  const stop = Math.min(end, bytes.length);
  let i = offset;
  while (i < stop && bytes[i] !== 0) i += 1;
  return { text: decodeLatin1(bytes, offset, i), next: i < stop ? i + 1 : stop };
}

/**
 * Replace control characters that carry no meaning for text analysis but do let
 * a payload survive naive filters. Written as a codepoint loop rather than a
 * regex so this file contains no literal control bytes of its own.
 *
 * Zero-width and bidi characters are counted by `countInvisibleCharacters`
 * before this runs, so collapsing them here loses no signal.
 */
export function sanitizeExtractedText(text: string, maxLength = 200_000): string {
  const trimmed = text.length > maxLength ? text.slice(0, maxLength) : text;
  let out = "";
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    const keepAsWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    const isControl = (code < 0x20 && !keepAsWhitespace) || code === 0x7f;
    out += isControl ? " " : char;
  }
  return out.replace(/ {3,}/g, "  ").trim();
}

const INVISIBLE_CODEPOINTS = [
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff, 0x00ad, 0x180e,
];

/** Count of zero-width / bidi-control codepoints, the classic metadata smuggling carrier. */
export function countInvisibleCharacters(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (INVISIBLE_CODEPOINTS.includes(code)) count += 1;
    // Variation selectors and tag characters, used to hide data inside "plain" text.
    else if (code >= 0xfe00 && code <= 0xfe0f) count += 1;
    else if (code >= 0xe0000 && code <= 0xe007f) count += 1;
  }
  return count;
}

/** True when the buffer looks like human-readable text rather than binary. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 4096): boolean {
  const limit = Math.min(bytes.length, sampleSize);
  if (limit === 0) return false;
  let printable = 0;
  for (let i = 0; i < limit; i += 1) {
    const byte = bytes[i];
    if (byte === 0) return false;
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80) {
      printable += 1;
    }
  }
  return printable / limit > 0.9;
}
