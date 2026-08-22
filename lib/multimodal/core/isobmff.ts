/**
 * ISO base media file format (ISO-BMFF) atom walk.
 *
 * One walker serves three kinds: HEIC/AVIF images, M4A/M4B audio and MP4/MOV
 * video all use the same box tree. The interesting boxes for a security scan are
 * the metadata ones — `ilst` tag values, `Exif` items, `uuid` payloads (where
 * XMP lives) — plus `mdat`, whose size is how we tell a real media file from a
 * container wrapped around something else.
 *
 * Sizes in this format are attacker-controlled, so every branch treats a size of
 * 0, 1 (64-bit) or anything overrunning the parent as a malformed structure and
 * stops descending instead of trusting it.
 */
import { decodeLatin1, decodeUtf8, decodeUtf16, tag, u32be } from "./bytes";

export interface Atom {
  type: string;
  /** Absolute offset of the atom header. */
  offset: number;
  /** Total atom size including the header. */
  size: number;
  /** Absolute offset of the payload, after the size/type (and any 64-bit size). */
  payloadStart: number;
  payloadEnd: number;
  depth: number;
  /** Parent chain, e.g. ["moov", "udta", "meta"]. */
  path: string[];
}

export interface IsoBmffWalkResult {
  atomCount: number;
  malformed: boolean;
  truncated: boolean;
  /** Total bytes covered by top-level atoms; a gap means undeclared data. */
  coveredBytes: number;
  /** Sum of `mdat` payload sizes: the actual media payload. */
  mediaBytes: number;
  brands: string[];
}

/** Boxes whose payload is a list of child boxes rather than data. */
const CONTAINER_ATOMS = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "udta",
  "moof",
  "traf",
  "mvex",
  "edts",
  "dinf",
  "ilst",
  "meta",
  "iprp",
  "ipco",
  "iinf",
  "grpl",
  "mfra",
  "sinf",
  "schi",
  "----",
]);

const MAX_ATOMS = 4096;
const MAX_DEPTH = 8;

export function walkAtoms(
  bytes: Uint8Array,
  onAtom: (atom: Atom) => void,
  maxAtoms = MAX_ATOMS,
): IsoBmffWalkResult {
  const result: IsoBmffWalkResult = {
    atomCount: 0,
    malformed: false,
    truncated: false,
    coveredBytes: 0,
    mediaBytes: 0,
    brands: [],
  };
  walkRange(bytes, 0, bytes.length, 0, [], onAtom, result, maxAtoms);
  return result;
}

function walkRange(
  bytes: Uint8Array,
  start: number,
  end: number,
  depth: number,
  path: string[],
  onAtom: (atom: Atom) => void,
  result: IsoBmffWalkResult,
  maxAtoms: number,
): void {
  let cursor = start;
  while (cursor + 8 <= end) {
    if (result.atomCount >= maxAtoms) {
      result.truncated = true;
      return;
    }
    const declared = u32be(bytes, cursor);
    const type = tag(bytes, cursor + 4, 4);
    if (declared === null || type === null || !isPrintableType(type)) {
      result.malformed = true;
      return;
    }

    let payloadStart = cursor + 8;
    let size = declared;
    if (declared === 1) {
      // 64-bit size. The high word must be zero for any file we would accept,
      // since anything above 4 GiB is already past every byte cap we enforce.
      const high = u32be(bytes, cursor + 8);
      const low = u32be(bytes, cursor + 12);
      if (high === null || low === null || high !== 0) {
        result.malformed = true;
        return;
      }
      size = low;
      payloadStart = cursor + 16;
    } else if (declared === 0) {
      // "Extends to end of file", legal only for the last atom.
      size = end - cursor;
    }

    if (size < payloadStart - cursor || cursor + size > end) {
      result.malformed = true;
      return;
    }

    const payloadEnd = cursor + size;
    const atomPath = [...path, type];
    result.atomCount += 1;
    if (depth === 0) result.coveredBytes += size;
    if (type === "mdat") result.mediaBytes += payloadEnd - payloadStart;
    if (type === "ftyp") {
      for (let at = payloadStart; at + 4 <= payloadEnd && result.brands.length < 12; at += 4) {
        const brand = tag(bytes, at, 4)?.trim();
        if (brand && isPrintableType(brand) && !result.brands.includes(brand)) result.brands.push(brand);
      }
    }

    onAtom({ type, offset: cursor, size, payloadStart, payloadEnd, depth, path: atomPath });

    if (isContainer(type, path) && depth < MAX_DEPTH) {
      // `meta` carries a 4-byte version/flags header before its children in the
      // ISO layout, but QuickTime writes children immediately. Detect which by
      // testing whether a plausible child box starts at either position.
      const childStart = type === "meta" ? metaChildStart(bytes, payloadStart, payloadEnd) : payloadStart;
      walkRange(bytes, childStart, payloadEnd, depth + 1, atomPath, onAtom, result, maxAtoms);
    }

    cursor = payloadEnd;
  }
  // Any bytes left between `cursor` and `end` were claimed by no atom. The caller
  // compares `coveredBytes` against the file length to report that gap, so there
  // is nothing to record here.
}

/**
 * Tag boxes inside `ilst` are named by the tag itself (`©nam`, `desc`, `----`),
 * so they cannot be listed — anything directly under `ilst` holds child boxes.
 */
function isContainer(type: string, path: string[]): boolean {
  return CONTAINER_ATOMS.has(type) || path[path.length - 1] === "ilst";
}

function metaChildStart(bytes: Uint8Array, payloadStart: number, payloadEnd: number): number {
  const withHeader = payloadStart + 4;
  if (looksLikeAtom(bytes, payloadStart, payloadEnd)) return payloadStart;
  if (looksLikeAtom(bytes, withHeader, payloadEnd)) return withHeader;
  return withHeader;
}

function looksLikeAtom(bytes: Uint8Array, offset: number, end: number): boolean {
  if (offset + 8 > end) return false;
  const size = u32be(bytes, offset);
  const type = tag(bytes, offset + 4, 4);
  return size !== null && type !== null && isPrintableType(type) && size >= 8 && offset + size <= end;
}

function isPrintableType(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    // 0xA9 is the copyright sign that prefixes QuickTime tag names ("©nam").
    if (code !== 0xa9 && (code < 0x20 || code > 0x7e)) return false;
  }
  return value.length > 0;
}

/** Human-readable name for an `ilst` tag atom, safe to disclose as a location. */
export function ilstTagName(type: string): string {
  const NAMES: Record<string, string> = {
    "©nam": "title",
    "©ART": "artist",
    "©alb": "album",
    "©cmt": "comment",
    "©gen": "genre",
    "©lyr": "lyrics",
    "©too": "encoder",
    "©wrt": "composer",
    "©day": "year",
    desc: "description",
    ldes: "long-description",
    covr: "cover-art",
    keyw: "keywords",
    "----": "custom",
  };
  return NAMES[type] ?? type.replace(/[^\x20-\x7e]/g, "");
}

/**
 * Text from an `ilst` value box (`data`). The 4-byte type code says whether the
 * payload is UTF-8 text (1), UTF-16 (2) or binary; only text codes are decoded,
 * so cover-art bytes never end up in a text stream.
 */
export function readIlstText(bytes: Uint8Array, payloadStart: number, payloadEnd: number): string | null {
  if (payloadStart + 8 > payloadEnd) return null;
  const typeCode = u32be(bytes, payloadStart);
  if (typeCode === null) return null;
  const valueStart = payloadStart + 8;
  if (valueStart >= payloadEnd) return null;
  if (typeCode === 1) return decodeUtf8(bytes, valueStart, payloadEnd).trim();
  if (typeCode === 2) return decodeUtf16(bytes, valueStart, payloadEnd).trim();
  if (typeCode === 4) return decodeLatin1(bytes, valueStart, payloadEnd).trim();
  return null;
}
