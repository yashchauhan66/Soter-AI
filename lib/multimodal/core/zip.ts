/**
 * ZIP container walk.
 *
 * OOXML (docx/xlsx/pptx), ODF, JAR and EPUB are all ZIPs, so this is the entry
 * point for every office document. The walk reads directory records only — no
 * entry is decompressed until a caller asks for one, and then only through the
 * `inflate` adapter with an explicit output cap. That ordering is what makes
 * bomb detection possible: the declared uncompressed sizes are known before a
 * single byte is inflated.
 *
 * Two hostile shapes are handled explicitly rather than by exception:
 * a missing or lying central directory (fall back to scanning local headers),
 * and entry names that try to escape the container (reported, never resolved).
 */
import { decodeUtf8, decodeLatin1, indexOfBytes, u16le, u32le } from "./bytes";

export interface ZipEntry {
  /** Entry path as stored. Disclosed in findings as a location, so kept intact. */
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Offset of the local file header, or -1 when only the directory record was seen. */
  localHeaderOffset: number;
  /** True when a bit-1 flag or an encrypted-directory record marks this entry. */
  encrypted: boolean;
  /** True when the name is absolute or contains a parent traversal segment. */
  unsafeName: boolean;
  /** True when the name ends in "/" and the sizes are zero. */
  directory: boolean;
}

export interface ZipWalkResult {
  entries: ZipEntry[];
  /** How the entry list was recovered. "local-scan" means the directory was unusable. */
  basis: "central-directory" | "local-scan" | "none";
  totalCompressedSize: number;
  totalUncompressedSize: number;
  /** Sum of uncompressed over compressed, guarded against divide-by-zero. */
  compressionRatio: number;
  /** True when a record pointed outside the buffer or a signature was wrong. */
  malformed: boolean;
  /** True when an entry cap stopped the walk, so the list is incomplete by design. */
  truncated: boolean;
  /** Bytes between the start of the file and the first local header. */
  prefixBytes: number;
  /** Bytes after the end-of-central-directory record. */
  suffixBytes: number;
}

const LOCAL_HEADER_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const CENTRAL_HEADER_SIGNATURE = [0x50, 0x4b, 0x01, 0x02];
const EOCD_SIGNATURE = [0x50, 0x4b, 0x05, 0x06];
const ZIP64_EOCD_LOCATOR = [0x50, 0x4b, 0x06, 0x07];

const MAX_ENTRIES = 4096;
/** The EOCD comment field is 16 bits, so the record is never further back than this. */
const EOCD_SEARCH_WINDOW = 64 * 1024 + 22;

export function walkZip(bytes: Uint8Array, maxEntries = MAX_ENTRIES): ZipWalkResult {
  const result: ZipWalkResult = {
    entries: [],
    basis: "none",
    totalCompressedSize: 0,
    totalUncompressedSize: 0,
    compressionRatio: 0,
    malformed: false,
    truncated: false,
    prefixBytes: 0,
    suffixBytes: 0,
  };

  const firstLocal = indexOfBytes(bytes, LOCAL_HEADER_SIGNATURE, 0);
  result.prefixBytes = firstLocal === -1 ? 0 : firstLocal;

  const eocd = findEocd(bytes);
  if (eocd !== -1) {
    result.suffixBytes = Math.max(0, bytes.length - (eocd + 22 + (u16le(bytes, eocd + 20) ?? 0)));
    const fromDirectory = readCentralDirectory(bytes, eocd, maxEntries, result);
    if (fromDirectory) result.basis = "central-directory";
  }

  if (result.basis === "none") {
    // No usable directory: walk local headers instead. A truncated upload and a
    // deliberately corrupted directory both land here, and both still deserve a
    // parse rather than a shrug.
    scanLocalHeaders(bytes, maxEntries, result);
    if (result.entries.length > 0) result.basis = "local-scan";
  }

  for (const entry of result.entries) {
    result.totalCompressedSize += entry.compressedSize;
    result.totalUncompressedSize += entry.uncompressedSize;
  }
  result.compressionRatio =
    result.totalCompressedSize > 0 ? result.totalUncompressedSize / result.totalCompressedSize : 0;
  return result;
}

function findEocd(bytes: Uint8Array): number {
  const from = Math.max(0, bytes.length - EOCD_SEARCH_WINDOW);
  let found = -1;
  let at = indexOfBytes(bytes, EOCD_SIGNATURE, from);
  // The comment may itself contain the signature, so the LAST match wins.
  while (at !== -1) {
    found = at;
    at = indexOfBytes(bytes, EOCD_SIGNATURE, at + 4);
  }
  return found;
}

function readCentralDirectory(
  bytes: Uint8Array,
  eocd: number,
  maxEntries: number,
  result: ZipWalkResult,
): boolean {
  const declaredCount = u16le(bytes, eocd + 10);
  const directorySize = u32le(bytes, eocd + 12);
  const directoryOffset = u32le(bytes, eocd + 16);
  if (declaredCount === null || directoryOffset === null || directorySize === null) {
    result.malformed = true;
    return false;
  }
  // Zip64 marks the 32-bit fields as saturated; the real values live in a record
  // we do not parse, so hand off to the local-header scan rather than guess.
  const zip64 =
    declaredCount === 0xffff ||
    directoryOffset === 0xffffffff ||
    directorySize === 0xffffffff ||
    indexOfBytes(bytes, ZIP64_EOCD_LOCATOR, Math.max(0, eocd - 20)) !== -1;
  if (zip64) return false;
  if (directoryOffset + directorySize > bytes.length) {
    result.malformed = true;
    return false;
  }

  let cursor = directoryOffset;
  const end = Math.min(bytes.length, directoryOffset + directorySize);
  let seen = 0;
  while (cursor + 46 <= end) {
    if (!signatureAt(bytes, cursor, CENTRAL_HEADER_SIGNATURE)) {
      result.malformed = true;
      break;
    }
    if (seen >= maxEntries) {
      result.truncated = true;
      break;
    }
    const flags = u16le(bytes, cursor + 8) ?? 0;
    const method = u16le(bytes, cursor + 10) ?? 0;
    const compressedSize = u32le(bytes, cursor + 20) ?? 0;
    const uncompressedSize = u32le(bytes, cursor + 24) ?? 0;
    const nameLength = u16le(bytes, cursor + 28) ?? 0;
    const extraLength = u16le(bytes, cursor + 30) ?? 0;
    const commentLength = u16le(bytes, cursor + 32) ?? 0;
    const localOffset = u32le(bytes, cursor + 42) ?? 0;
    const nameStart = cursor + 46;
    if (nameStart + nameLength > end) {
      result.malformed = true;
      break;
    }
    const name = decodeEntryName(bytes, nameStart, nameStart + nameLength, flags);
    result.entries.push(buildEntry(name, method, compressedSize, uncompressedSize, localOffset, flags));
    seen += 1;
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  if (declaredCount > 0 && result.entries.length !== declaredCount && !result.truncated) {
    // A directory that promises more entries than it holds is itself a signal.
    result.malformed = true;
  }
  return result.entries.length > 0;
}

function scanLocalHeaders(bytes: Uint8Array, maxEntries: number, result: ZipWalkResult): void {
  let at = indexOfBytes(bytes, LOCAL_HEADER_SIGNATURE, 0);
  let seen = 0;
  while (at !== -1) {
    if (seen >= maxEntries) {
      result.truncated = true;
      break;
    }
    const flags = u16le(bytes, at + 6) ?? 0;
    const method = u16le(bytes, at + 8) ?? 0;
    const compressedSize = u32le(bytes, at + 18) ?? 0;
    const uncompressedSize = u32le(bytes, at + 22) ?? 0;
    const nameLength = u16le(bytes, at + 26) ?? 0;
    const nameStart = at + 30;
    if (nameStart + nameLength > bytes.length) {
      result.malformed = true;
      break;
    }
    const name = decodeEntryName(bytes, nameStart, nameStart + nameLength, flags);
    result.entries.push(buildEntry(name, method, compressedSize, uncompressedSize, at, flags));
    seen += 1;
    at = indexOfBytes(bytes, LOCAL_HEADER_SIGNATURE, nameStart + nameLength);
  }
}

function signatureAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (offset + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/** Bit 11 of the general-purpose flags means the name is UTF-8; otherwise CP437-ish. */
function decodeEntryName(bytes: Uint8Array, start: number, end: number, flags: number): string {
  return (flags & 0x0800) !== 0 ? decodeUtf8(bytes, start, end) : decodeLatin1(bytes, start, end);
}

function buildEntry(
  name: string,
  method: number,
  compressedSize: number,
  uncompressedSize: number,
  localHeaderOffset: number,
  flags: number,
): ZipEntry {
  const normalized = name.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return {
    name,
    compressionMethod: method,
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
    encrypted: (flags & 0x0001) !== 0,
    unsafeName:
      normalized.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalized) ||
      segments.includes("..") ||
      name.includes("\0"),
    directory: name.endsWith("/") && compressedSize === 0 && uncompressedSize === 0,
  };
}

/** Inflate adapter contract, mirrored from `MultimodalAdapters.inflate`. */
export type InflateFn = (data: Uint8Array, raw: boolean, maxOutputBytes: number) => Promise<Uint8Array | null>;

/**
 * Read one entry's bytes. Stored entries are sliced; deflated entries need the
 * adapter. Returns null when the data cannot be reached — a missing adapter, an
 * unsupported method, an encrypted entry — so the caller can disclose the gap
 * instead of treating an unreadable part as an empty one.
 */
export async function readZipEntry(
  bytes: Uint8Array,
  entry: ZipEntry,
  inflate: InflateFn | undefined,
  maxOutputBytes: number,
): Promise<Uint8Array | null> {
  if (entry.directory || entry.encrypted) return null;
  const dataStart = localDataOffset(bytes, entry);
  if (dataStart === null) return null;

  // A streamed entry writes zero into the local header and the real size into a
  // trailing data descriptor, so fall back to the next header rather than to 0.
  let available = entry.compressedSize;
  if (available <= 0) {
    const next = indexOfBytes(bytes, LOCAL_HEADER_SIGNATURE, dataStart);
    const central = indexOfBytes(bytes, CENTRAL_HEADER_SIGNATURE, dataStart);
    const boundary = [next, central].filter((value) => value > dataStart);
    available = (boundary.length > 0 ? Math.min(...boundary) : bytes.length) - dataStart;
  }
  if (available <= 0 || dataStart + available > bytes.length) return null;

  const slice = bytes.subarray(dataStart, dataStart + available);
  if (entry.compressionMethod === 0) {
    return slice.length > maxOutputBytes ? slice.subarray(0, maxOutputBytes) : slice;
  }
  if (entry.compressionMethod !== 8 || !inflate) return null;
  try {
    return await inflate(slice, true, maxOutputBytes);
  } catch {
    return null;
  }
}

function localDataOffset(bytes: Uint8Array, entry: ZipEntry): number | null {
  const header = entry.localHeaderOffset;
  if (header < 0 || !signatureAt(bytes, header, LOCAL_HEADER_SIGNATURE)) return null;
  const nameLength = u16le(bytes, header + 26);
  const extraLength = u16le(bytes, header + 28);
  if (nameLength === null || extraLength === null) return null;
  const start = header + 30 + nameLength + extraLength;
  return start <= bytes.length ? start : null;
}

/** True when the entry name matches one of the given path prefixes or suffixes. */
export function entryMatches(name: string, patterns: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((pattern) =>
    pattern.startsWith(".") ? lower.endsWith(pattern) : lower.startsWith(pattern),
  );
}

export const ZIP_ENTRY_CAP = MAX_ENTRIES;
