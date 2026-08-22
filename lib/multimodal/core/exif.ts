/**
 * TIFF/EXIF IFD parser.
 *
 * This is a real directory walk, not a string search. It matters: EXIF tags are
 * binary (GPS lives in IFD 0x8825, not in a literal "GPS" string), and the text
 * fields that actually carry injected instructions — ImageDescription,
 * UserComment, the Windows XP* tags, an XMP packet — are only reachable by
 * following offsets. Every offset is bounds-checked against the buffer and every
 * loop is capped, because a hostile file's whole purpose is to make a parser
 * wander.
 */
import { decodeLatin1, decodeUtf16Le, u16be, u16le, u32be, u32le } from "./bytes";

export interface ExifTextField {
  /** Tag name, e.g. "ImageDescription". Safe to disclose; the value never is. */
  tag: string;
  text: string;
}

export interface ExifParseResult {
  textFields: ExifTextField[];
  /** True when a real GPS IFD carried latitude or longitude. */
  hasGpsCoordinates: boolean;
  /** How many GPS tags were present, for the finding count. */
  gpsFieldCount: number;
  width?: number;
  height?: number;
  orientation?: number;
  /** Number of IFDs walked, and total entries seen. Both are capped. */
  ifdCount: number;
  entryCount: number;
  /** True when an offset or count pointed outside the buffer. */
  malformed: boolean;
  /** True when a cap stopped the walk, so the parse is incomplete by design. */
  truncated: boolean;
}

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
  13: 4, // IFD
};

const TEXT_TAGS: Record<number, string> = {
  0x010d: "DocumentName",
  0x010e: "ImageDescription",
  0x010f: "Make",
  0x0110: "Model",
  0x0131: "Software",
  0x013b: "Artist",
  0x013c: "HostComputer",
  0x8298: "Copyright",
  0x9286: "UserComment",
  0xa004: "RelatedSoundFile",
  0xa420: "ImageUniqueID",
  0xa430: "CameraOwnerName",
  0xa433: "LensMake",
  0xa434: "LensModel",
  0x02bc: "XMLPacket",
  0x9c9b: "XPTitle",
  0x9c9c: "XPComment",
  0x9c9d: "XPAuthor",
  0x9c9e: "XPKeywords",
  0x9c9f: "XPSubject",
};

/** Tags whose value is UCS-2 little-endian regardless of the file's byte order. */
const UCS2_TAGS = new Set([0x9c9b, 0x9c9c, 0x9c9d, 0x9c9e, 0x9c9f]);

const EXIF_IFD_POINTER = 0x8769;
const GPS_IFD_POINTER = 0x8825;
const INTEROP_IFD_POINTER = 0xa005;

const MAX_IFDS = 12;
const MAX_ENTRIES = 4096;
const MAX_DEPTH = 3;
const MAX_TEXT_BYTES = 64 * 1024;

/**
 * Parse a TIFF header at `base` (0 for a .tif, 6 past "Exif\0\0" in a JPEG APP1,
 * 0 for a PNG eXIf chunk). Returns what it could read plus honest flags for what
 * it could not.
 */
export function parseTiffExif(bytes: Uint8Array, base = 0): ExifParseResult {
  const result: ExifParseResult = {
    textFields: [],
    hasGpsCoordinates: false,
    gpsFieldCount: 0,
    ifdCount: 0,
    entryCount: 0,
    malformed: false,
    truncated: false,
  };
  if (base + 8 > bytes.length) {
    result.malformed = true;
    return result;
  }
  const byteOrder = decodeLatin1(bytes, base, base + 2);
  const little = byteOrder === "II";
  if (!little && byteOrder !== "MM") {
    result.malformed = true;
    return result;
  }
  const magic = little ? u16le(bytes, base + 2) : u16be(bytes, base + 2);
  if (magic !== 0x2a) {
    result.malformed = true;
    return result;
  }
  const firstIfd = little ? u32le(bytes, base + 4) : u32be(bytes, base + 4);
  if (firstIfd === null || firstIfd < 8) {
    result.malformed = true;
    return result;
  }

  const visited = new Set<number>();
  let ifdOffset: number | null = firstIfd;
  while (ifdOffset !== null && ifdOffset !== 0) {
    if (result.ifdCount >= MAX_IFDS) {
      result.truncated = true;
      break;
    }
    if (visited.has(ifdOffset)) {
      // A self-referencing IFD chain is malformed, and the classic parser hang.
      result.malformed = true;
      break;
    }
    visited.add(ifdOffset);
    const next = readIfd(bytes, base, ifdOffset, little, result, 0, visited, false);
    ifdOffset = next;
  }
  return result;
}

/** Reads one IFD, following sub-IFD pointers. Returns the next-IFD offset, or null. */
function readIfd(
  bytes: Uint8Array,
  base: number,
  ifdOffset: number,
  little: boolean,
  result: ExifParseResult,
  depth: number,
  visited: Set<number>,
  isGpsIfd: boolean,
): number | null {
  const start = base + ifdOffset;
  if (start + 2 > bytes.length) {
    result.malformed = true;
    return null;
  }
  const count = little ? u16le(bytes, start) : u16be(bytes, start);
  if (count === null || count === 0) return null;
  result.ifdCount += 1;
  const entriesEnd = start + 2 + count * 12;
  if (entriesEnd > bytes.length) {
    result.malformed = true;
    return null;
  }

  for (let i = 0; i < count; i += 1) {
    if (result.entryCount >= MAX_ENTRIES) {
      result.truncated = true;
      break;
    }
    result.entryCount += 1;
    const entry = start + 2 + i * 12;
    const tagId = (little ? u16le(bytes, entry) : u16be(bytes, entry)) ?? 0;
    const type = (little ? u16le(bytes, entry + 2) : u16be(bytes, entry + 2)) ?? 0;
    const valueCount = (little ? u32le(bytes, entry + 4) : u32be(bytes, entry + 4)) ?? 0;
    const typeSize = TYPE_SIZES[type];
    if (!typeSize) continue;
    const byteLength = typeSize * valueCount;
    if (byteLength < 0 || byteLength > bytes.length) {
      result.malformed = true;
      continue;
    }

    let valueStart: number;
    if (byteLength <= 4) {
      valueStart = entry + 8;
    } else {
      const pointer = little ? u32le(bytes, entry + 8) : u32be(bytes, entry + 8);
      if (pointer === null || base + pointer + byteLength > bytes.length) {
        result.malformed = true;
        continue;
      }
      valueStart = base + pointer;
    }

    if (isGpsIfd) {
      result.gpsFieldCount += 1;
      if (tagId === 0x0002 || tagId === 0x0004) result.hasGpsCoordinates = true;
      continue;
    }

    if (tagId === 0x0100 || tagId === 0xa002) {
      const value = readNumeric(bytes, valueStart, type, little);
      if (value !== null && value > 0) result.width = value;
      continue;
    }
    if (tagId === 0x0101 || tagId === 0xa003) {
      const value = readNumeric(bytes, valueStart, type, little);
      if (value !== null && value > 0) result.height = value;
      continue;
    }
    if (tagId === 0x0112) {
      const value = readNumeric(bytes, valueStart, type, little);
      if (value !== null) result.orientation = value;
      continue;
    }

    if (tagId === EXIF_IFD_POINTER || tagId === GPS_IFD_POINTER || tagId === INTEROP_IFD_POINTER) {
      if (depth + 1 > MAX_DEPTH) {
        result.truncated = true;
        continue;
      }
      const pointer = little ? u32le(bytes, entry + 8) : u32be(bytes, entry + 8);
      if (pointer === null || pointer === 0 || base + pointer + 2 > bytes.length) {
        result.malformed = true;
        continue;
      }
      if (visited.has(pointer)) continue;
      visited.add(pointer);
      readIfd(bytes, base, pointer, little, result, depth + 1, visited, tagId === GPS_IFD_POINTER);
      continue;
    }

    const name = TEXT_TAGS[tagId];
    if (!name) continue;
    const text = readTextValue(bytes, valueStart, byteLength, tagId, type, little);
    if (text) result.textFields.push({ tag: name, text });
  }

  const nextOffsetAt = entriesEnd;
  if (nextOffsetAt + 4 > bytes.length) return null;
  const next = little ? u32le(bytes, nextOffsetAt) : u32be(bytes, nextOffsetAt);
  return next === null || next === 0 ? null : next;
}

function readNumeric(bytes: Uint8Array, offset: number, type: number, little: boolean): number | null {
  if (type === 3 || type === 8) return little ? u16le(bytes, offset) : u16be(bytes, offset);
  if (type === 4 || type === 9 || type === 13) return little ? u32le(bytes, offset) : u32be(bytes, offset);
  if (type === 1 || type === 6 || type === 7) return offset < bytes.length ? bytes[offset] : null;
  return null;
}

function readTextValue(
  bytes: Uint8Array,
  offset: number,
  byteLength: number,
  tagId: number,
  type: number,
  little: boolean,
): string {
  const end = Math.min(offset + Math.min(byteLength, MAX_TEXT_BYTES), bytes.length);
  if (end <= offset) return "";

  if (UCS2_TAGS.has(tagId)) return trimNulls(decodeUtf16Le(bytes, offset, end));

  if (tagId === 0x9286) {
    // UserComment: an 8-byte character-code prefix decides the encoding. The
    // "UNICODE" case is UTF-16 in the file's byte order, which is why the JPEG
    // and TIFF paths must pass `little` through instead of guessing.
    const charset = decodeLatin1(bytes, offset, Math.min(offset + 8, end)).replace(/\0/g, "").trim();
    const valueStart = Math.min(offset + 8, end);
    if (charset.toUpperCase() === "UNICODE") {
      return trimNulls(little ? decodeUtf16Le(bytes, valueStart, end) : decodeUtf16Be(bytes, valueStart, end));
    }
    return trimNulls(decodeLatin1(bytes, valueStart, end));
  }

  if (type === 2 || type === 1 || type === 7) return trimNulls(decodeLatin1(bytes, offset, end));
  return "";
}

const utf16beDecoder = new TextDecoder("utf-16be", { fatal: false });
function decodeUtf16Be(bytes: Uint8Array, start: number, end: number): string {
  return utf16beDecoder.decode(bytes.subarray(start, end));
}

function trimNulls(text: string): string {
  return text.replace(/\0+$/g, "").trim();
}
