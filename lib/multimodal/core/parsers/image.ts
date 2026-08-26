/**
 * Raster image parsers.
 *
 * The threat these cover is not a corrupt pixel: it is text that a vision model
 * reads and a human never sees. So the priority order is metadata text first
 * (PNG tEXt/iTXt, JPEG EXIF and XMP, GIF comments), then structure (trailing
 * data, polyglot payloads, pixel budgets), and finally an honest statement that
 * the pixels themselves are unread until an OCR adapter runs.
 */
import {
  decodeLatin1,
  decodeUtf8,
  extractPrintableRuns,
  i32le,
  indexOfBytes,
  readCString,
  startsWith,
  startsWithAscii,
  tag,
  u16be,
  u16le,
  u32be,
  u32le,
} from "../bytes";
import { parseTiffExif, type ExifParseResult } from "../exif";
import { walkAtoms } from "../isobmff";
import { collectMarkupText } from "../xml";
import { emptyParseOutput, type AssetParseOutput } from "../types";
import { addEmbedded, addStream, bump, finding, ratio, type ParserContext } from "./shared";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_MAX_CHUNKS = 512;
/** Decoded-pixel budget above which an image is a decompression risk, not a picture. */
const PIXEL_BOMB_BYTES = 128 * 1024 * 1024;
const PIXEL_BOMB_RATIO = 500;

export async function parseImage(
  bytes: Uint8Array,
  format: string,
  ctx: ParserContext,
): Promise<AssetParseOutput> {
  switch (format) {
    case "png":
      return parsePng(bytes, ctx);
    case "jpeg":
      return parseJpeg(bytes, ctx);
    case "gif":
      return parseGif(bytes, ctx);
    case "webp":
      return parseWebp(bytes, ctx);
    case "bmp":
      return parseBmp(bytes);
    case "tiff":
      return parseTiff(bytes, ctx);
    case "ico":
      return parseIco(bytes, ctx);
    default:
      return parseIsoImage(bytes, ctx, format);
  }
}

// ── PNG ────────────────────────────────────────────────────────────────────

async function parsePng(bytes: Uint8Array, ctx: ParserContext): Promise<AssetParseOutput> {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  if (!startsWith(bytes, PNG_MAGIC)) {
    out.structure = "not-parsed";
    return out;
  }

  let offset = 8;
  let sawIhdr = false;
  let sawIend = false;
  let iendEnd = -1;
  let metadataBytes = 0;
  let chunkCount = 0;

  while (offset + 8 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = tag(bytes, offset + 4, 4);
    if (length === null || type === null) break;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_TRUNCATED_ASSET",
          "Truncated PNG chunk",
          "MEDIUM",
          `A PNG chunk declared ${length} bytes but the file ends before that. The remainder of the image was not inspected.`,
          { location: `png:${type}` },
        ),
      );
      out.limitations.push("The PNG chunk stream ended early, so any content after the break was not inspected.");
      break;
    }
    chunkCount += 1;
    if (chunkCount > PNG_MAX_CHUNKS) {
      out.structure = "partial";
      out.limitations.push(
        `The PNG has more than ${PNG_MAX_CHUNKS} chunks, so chunks after that point were not inspected.`,
      );
      break;
    }

    if (type === "IHDR" && length >= 13) {
      sawIhdr = true;
      out.width = u32be(bytes, dataStart) ?? undefined;
      out.height = u32be(bytes, dataStart + 4) ?? undefined;
      const bitDepth = bytes[dataStart + 8];
      const colorType = bytes[dataStart + 9];
      out.stats.bitDepth = bitDepth;
      out.stats.colorType = colorType;
      out.stats.interlaced = bytes[dataStart + 12] === 1 ? 1 : 0;
    } else if (type === "tEXt") {
      metadataBytes += length;
      const { text: keyword, next } = readCString(bytes, dataStart, dataEnd);
      addStream(out, ctx, "metadata", `png:tEXt:${safeKeyword(keyword)}`, decodeLatin1(bytes, next, dataEnd));
      bump(out, "textChunks");
    } else if (type === "zTXt") {
      metadataBytes += length;
      const { text: keyword, next } = readCString(bytes, dataStart, dataEnd);
      // Byte at `next` is the compression method; only 0 (zlib deflate) is defined.
      const compressed = bytes.subarray(next + 1, dataEnd);
      const text = await inflateText(compressed, ctx, false);
      if (text === null) {
        out.limitations.push(
          "A compressed PNG text chunk (zTXt) could not be decompressed, so its content was not analyzed.",
        );
      } else {
        addStream(out, ctx, "metadata", `png:zTXt:${safeKeyword(keyword)}`, text);
      }
      bump(out, "compressedTextChunks");
    } else if (type === "iTXt") {
      metadataBytes += length;
      await readItxt(bytes, dataStart, dataEnd, out, ctx);
      bump(out, "textChunks");
    } else if (type === "eXIf") {
      metadataBytes += length;
      applyExif(parseTiffExif(bytes.subarray(dataStart, dataEnd), 0), out, ctx, "png:eXIf");
    } else if (type === "IDAT") {
      bump(out, "idatChunks");
      bump(out, "idatBytes", length);
    } else if (type === "IEND") {
      sawIend = true;
      iendEnd = dataEnd + 4;
      break;
    } else {
      bump(out, "otherChunks");
      if (type === "iCCP" || type === "sPLT" || type === "pHYs" || type === "tIME") metadataBytes += length;
    }

    offset = dataEnd + 4;
  }

  if (!sawIhdr) {
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "PNG header chunk missing",
        "MEDIUM",
        "The file carries a PNG signature but no IHDR chunk, so it does not describe a decodable image.",
        { location: "png:IHDR" },
      ),
    );
  }
  if (!sawIend && out.structure === "parsed") {
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "PNG end marker missing",
        "LOW",
        "The PNG chunk stream has no IEND marker, so the file is either truncated or was assembled by hand.",
        { location: "png:IEND" },
      ),
    );
  }

  appendTrailingDataFinding(out, bytes.length, iendEnd, "png:IEND");
  appendMetadataVolumeFinding(out, metadataBytes, bytes.length);
  appendPixelBudgetFinding(out, bytes.length, 4);
  out.stats.metadataBytes = metadataBytes;
  out.stats.chunks = chunkCount;
  return out;
}

async function readItxt(
  bytes: Uint8Array,
  dataStart: number,
  dataEnd: number,
  out: AssetParseOutput,
  ctx: ParserContext,
): Promise<void> {
  const { text: keyword, next: afterKeyword } = readCString(bytes, dataStart, dataEnd);
  const compressionFlag = bytes[afterKeyword];
  const valueStart = afterKeyword + 2; // compression flag + compression method
  const { next: afterLanguage } = readCString(bytes, valueStart, dataEnd);
  const { next: afterTranslated } = readCString(bytes, afterLanguage, dataEnd);
  const payload = bytes.subarray(afterTranslated, dataEnd);
  const origin = `png:iTXt:${safeKeyword(keyword)}`;

  if (compressionFlag === 1) {
    const text = await inflateText(payload, ctx, false);
    if (text === null) {
      out.limitations.push(
        "A compressed PNG international text chunk (iTXt) could not be decompressed, so its content was not analyzed.",
      );
      return;
    }
    addStream(out, ctx, "metadata", origin, text);
    return;
  }

  const text = decodeUtf8(payload, 0, payload.length);
  // An iTXt keyword of "XML:com.adobe.xmp" carries an XMP packet: read its text
  // nodes rather than handing raw markup to the analyzer.
  addStream(out, ctx, "metadata", origin, looksLikeXml(text) ? collectMarkupText(text) : text);
}

// ── JPEG ───────────────────────────────────────────────────────────────────

const EXIF_PREFIX = "Exif";
const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/";
const XMP_EXTENSION_NAMESPACE = "http://ns.adobe.com/xmp/extension/";
const PHOTOSHOP_IRB = "Photoshop 3.0";

function parseJpeg(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;

  let offset = 2;
  let metadataBytes = 0;
  let endOfImage = -1;
  let sawSof = false;
  let segments = 0;

  while (offset + 2 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Fill bytes are legal between segments; anything else means we are lost.
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_MALFORMED_STRUCTURE",
          "Unexpected byte in JPEG marker stream",
          "LOW",
          `The JPEG marker stream broke at offset ${offset}, so segments after that point were not inspected.`,
          { location: "jpeg:markers" },
        ),
      );
      break;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) {
      endOfImage = offset + 2;
      break;
    }

    const length = u16be(bytes, offset + 2);
    if (length === null || length < 2) {
      out.structure = "partial";
      break;
    }
    const segStart = offset + 4;
    const segEnd = offset + 2 + length;
    if (segEnd > bytes.length) {
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_TRUNCATED_ASSET",
          "Truncated JPEG segment",
          "MEDIUM",
          `A JPEG segment declared ${length} bytes but the file ends before that, so the rest of the image was not inspected.`,
          { location: `jpeg:${markerName(marker)}` },
        ),
      );
      break;
    }
    segments += 1;

    if (marker >= 0xe0 && marker <= 0xef) {
      metadataBytes += length;
      readJpegAppSegment(bytes, marker, segStart, segEnd, out, ctx);
    } else if (marker === 0xfe) {
      metadataBytes += length;
      addStream(out, ctx, "metadata", "jpeg:COM", decodeLatin1(bytes, segStart, segEnd));
      bump(out, "comments");
    } else if (isSofMarker(marker)) {
      sawSof = true;
      out.height = u16be(bytes, segStart + 1) ?? undefined;
      out.width = u16be(bytes, segStart + 3) ?? undefined;
      out.stats.components = bytes[segStart + 5] ?? 0;
      if (marker === 0xc2 || marker === 0xc6 || marker === 0xca || marker === 0xce) out.stats.progressive = 1;
    } else if (marker === 0xda) {
      // Entropy-coded scan data follows and has no length; the next marker we can
      // trust is the end-of-image, so jump to it directly.
      const eoi = indexOfBytes(bytes, [0xff, 0xd9], segEnd);
      endOfImage = eoi === -1 ? -1 : eoi + 2;
      if (eoi === -1) {
        out.structure = "partial";
        out.findings.push(
          finding(
            "MM_TRUNCATED_ASSET",
            "JPEG scan data has no end marker",
            "MEDIUM",
            "The compressed scan data runs to the end of the file with no end-of-image marker, so the image is truncated.",
            { location: "jpeg:SOS" },
          ),
        );
      }
      break;
    }

    offset = segEnd;
  }

  if (!sawSof) {
    out.structure = out.structure === "parsed" ? "partial" : out.structure;
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "JPEG frame header missing",
        "MEDIUM",
        "No start-of-frame segment was found, so the file does not describe a decodable JPEG image.",
        { location: "jpeg:SOF" },
      ),
    );
  }
  appendTrailingDataFinding(out, bytes.length, endOfImage, "jpeg:EOI");
  appendMetadataVolumeFinding(out, metadataBytes, bytes.length);
  appendPixelBudgetFinding(out, bytes.length, 3);
  out.stats.metadataBytes = metadataBytes;
  out.stats.segments = segments;
  return out;
}

function readJpegAppSegment(
  bytes: Uint8Array,
  marker: number,
  segStart: number,
  segEnd: number,
  out: AssetParseOutput,
  ctx: ParserContext,
): void {
  if (startsWithAscii(bytes, EXIF_PREFIX, segStart) && bytes[segStart + 4] === 0x00) {
    applyExif(parseTiffExif(bytes, segStart + 6), out, ctx, "jpeg:APP1:Exif");
    bump(out, "exifSegments");
    return;
  }
  if (startsWithAscii(bytes, XMP_NAMESPACE, segStart)) {
    const text = decodeUtf8(bytes, segStart + XMP_NAMESPACE.length + 1, segEnd);
    addStream(out, ctx, "metadata", "jpeg:APP1:XMP", collectMarkupText(text));
    bump(out, "xmpSegments");
    return;
  }
  if (startsWithAscii(bytes, XMP_EXTENSION_NAMESPACE, segStart)) {
    // Extended XMP is chunked across segments with a 40-byte header per part.
    const text = decodeUtf8(bytes, segStart + XMP_EXTENSION_NAMESPACE.length + 41, segEnd);
    addStream(out, ctx, "metadata", "jpeg:APP1:XMP-extension", collectMarkupText(text));
    bump(out, "xmpSegments");
    return;
  }
  if (startsWithAscii(bytes, PHOTOSHOP_IRB, segStart)) {
    // The IPTC block inside a Photoshop resource has its own binary layout; the
    // readable strings are enough for text analysis and claiming a full parse
    // would be a lie.
    addStream(out, ctx, "metadata", "jpeg:APP13:IPTC", extractPrintableRuns(bytes.subarray(segStart, segEnd), 6));
    bump(out, "iptcSegments");
    return;
  }
  if (startsWithAscii(bytes, "ICC_PROFILE", segStart)) {
    bump(out, "iccSegments");
    return;
  }
  if (startsWithAscii(bytes, "MPF", segStart)) {
    // Multi-picture format: extra full images live inside this JPEG.
    bump(out, "mpfSegments");
    out.limitations.push(
      "This JPEG declares a multi-picture (MPF) index, so additional embedded images exist that were not extracted.",
    );
    return;
  }
  if (marker === 0xe0) {
    bump(out, "jfifSegments");
    return;
  }
  // An unrecognised APPn segment is where a payload hides in plain sight. Its
  // readable strings go to the analyzer; its bytes never leave this function.
  const text = extractPrintableRuns(bytes.subarray(segStart, segEnd), 10);
  if (text) addStream(out, ctx, "metadata", `jpeg:APP${marker - 0xe0}`, text);
  bump(out, "unknownAppSegments");
}

function isSofMarker(marker: number): boolean {
  if (marker < 0xc0 || marker > 0xcf) return false;
  // C4 = Huffman tables, C8 = JPEG extensions, CC = arithmetic coding tables.
  return marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function markerName(marker: number): string {
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0}`;
  if (marker === 0xfe) return "COM";
  if (marker === 0xda) return "SOS";
  return `marker-0x${marker.toString(16)}`;
}

// ── GIF ────────────────────────────────────────────────────────────────────

function parseGif(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  if (bytes.length < 13) {
    out.structure = "not-parsed";
    return out;
  }
  out.width = u16le(bytes, 6) ?? undefined;
  out.height = u16le(bytes, 8) ?? undefined;
  const packed = bytes[10];
  let offset = 13;
  if ((packed & 0x80) !== 0) offset += 3 * 2 ** ((packed & 0x07) + 1);

  let frames = 0;
  let trailerEnd = -1;
  let guard = 0;
  while (offset < bytes.length && guard < 4096) {
    guard += 1;
    const block = bytes[offset];
    if (block === 0x3b) {
      trailerEnd = offset + 1;
      break;
    }
    if (block === 0x21) {
      const label = bytes[offset + 1];
      const { text, next } = readSubBlocks(bytes, offset + 2);
      offset = next;
      if (label === 0xfe) {
        addStream(out, ctx, "metadata", "gif:CommentExtension", text);
        bump(out, "comments");
      } else if (label === 0x01) {
        // A plain-text extension is drawn over the frame: this text is rendered,
        // not metadata, and a viewer may show it while a byte scan misses it.
        addStream(out, ctx, "rendered", "gif:PlainTextExtension", text.length > 13 ? text.slice(13) : text);
        bump(out, "plainTextExtensions");
      } else if (label === 0xff) {
        addStream(out, ctx, "metadata", "gif:ApplicationExtension", text);
        bump(out, "applicationExtensions");
      }
      continue;
    }
    if (block === 0x2c) {
      frames += 1;
      const localPacked = bytes[offset + 9] ?? 0;
      let cursor = offset + 10;
      if ((localPacked & 0x80) !== 0) cursor += 3 * 2 ** ((localPacked & 0x07) + 1);
      cursor += 1; // LZW minimum code size
      const { next } = readSubBlocks(bytes, cursor);
      offset = next;
      continue;
    }
    // Unknown block type: the stream is not a GIF beyond this point.
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "Unknown GIF block",
        "LOW",
        `An unrecognised block type was found at offset ${offset}, so the rest of the file was not inspected.`,
        { location: "gif:blocks" },
      ),
    );
    break;
  }

  out.stats.frames = frames;
  appendTrailingDataFinding(out, bytes.length, trailerEnd, "gif:trailer");
  appendPixelBudgetFinding(out, bytes.length, 4);
  return out;
}

/** GIF sub-block chains: a length byte then that many bytes, until a zero length. */
function readSubBlocks(bytes: Uint8Array, start: number, maxBytes = 64 * 1024): { text: string; next: number } {
  let offset = start;
  let text = "";
  let guard = 0;
  while (offset < bytes.length && guard < 1024) {
    guard += 1;
    const size = bytes[offset];
    if (size === 0) return { text, next: offset + 1 };
    const end = Math.min(offset + 1 + size, bytes.length);
    if (text.length < maxBytes) text += decodeLatin1(bytes, offset + 1, end);
    offset = end;
  }
  return { text, next: offset };
}

// ── WebP ───────────────────────────────────────────────────────────────────

function parseWebp(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  const declared = u32le(bytes, 4);
  if (declared === null || bytes.length < 16) {
    out.structure = "not-parsed";
    return out;
  }
  const riffEnd = 8 + declared;
  let offset = 12;
  let guard = 0;
  while (offset + 8 <= Math.min(bytes.length, riffEnd) && guard < 512) {
    guard += 1;
    const chunk = tag(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    if (chunk === null || size === null) break;
    const dataStart = offset + 8;
    const dataEnd = Math.min(dataStart + size, bytes.length);
    if (dataStart + size > bytes.length) {
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_TRUNCATED_ASSET",
          "Truncated WebP chunk",
          "MEDIUM",
          `WebP chunk ${chunk.trim()} declared ${size} bytes but the file ends first, so it was not inspected.`,
          { location: `webp:${chunk.trim()}` },
        ),
      );
      break;
    }

    if (chunk === "VP8X") {
      out.width = ((u32le(bytes, dataStart + 4) ?? 0) & 0xffffff) + 1;
      out.height = (((u32le(bytes, dataStart + 6) ?? 0) >> 8) & 0xffffff) + 1;
    } else if (chunk === "EXIF") {
      // Some encoders keep the JPEG-style "Exif\0\0" prefix here; most do not.
      const base = startsWithAscii(bytes, EXIF_PREFIX, dataStart) && bytes[dataStart + 4] === 0x00 ? dataStart + 6 : dataStart;
      applyExif(parseTiffExif(bytes.subarray(base, dataEnd), 0), out, ctx, "webp:EXIF");
    } else if (chunk === "XMP ") {
      addStream(out, ctx, "metadata", "webp:XMP", collectMarkupText(decodeUtf8(bytes, dataStart, dataEnd)));
    } else if (chunk === "ANMF") {
      bump(out, "frames");
    } else if (chunk === "ICCP") {
      bump(out, "iccChunks");
    }

    // Chunk payloads are padded to an even length.
    offset = dataStart + size + (size % 2);
  }

  if (riffEnd < bytes.length) appendTrailingDataFinding(out, bytes.length, riffEnd, "webp:RIFF");
  appendPixelBudgetFinding(out, bytes.length, 4);
  return out;
}

// ── BMP / TIFF / ICO ───────────────────────────────────────────────────────

function parseBmp(bytes: Uint8Array): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  if (bytes.length < 26) {
    out.structure = "not-parsed";
    return out;
  }
  const declaredSize = u32le(bytes, 2) ?? 0;
  // BITMAPINFOHEADER width and height are signed 32-bit; a negative height means
  // a top-down bitmap, so the magnitude is what matters for a pixel budget.
  out.width = Math.abs(i32le(bytes, 18) ?? 0) || undefined;
  out.height = Math.abs(i32le(bytes, 22) ?? 0) || undefined;
  out.stats.bitsPerPixel = u16le(bytes, 28) ?? 0;
  if (declaredSize > 0 && declaredSize < bytes.length) {
    appendTrailingDataFinding(out, bytes.length, declaredSize, "bmp:header-size");
  }
  appendPixelBudgetFinding(out, bytes.length, 4);
  return out;
}

function parseTiff(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  const exif = parseTiffExif(bytes, 0);
  applyExif(exif, out, ctx, "tiff:IFD");
  if (exif.malformed) {
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "Malformed TIFF directory",
        "MEDIUM",
        "A TIFF directory entry pointed outside the file, so part of the metadata could not be read.",
        { location: "tiff:IFD" },
      ),
    );
  }
  appendPixelBudgetFinding(out, bytes.length, 4);
  return out;
}

function parseIco(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  const count = u16le(bytes, 4) ?? 0;
  out.stats.icoEntries = count;
  if (count === 0 || count > 256) {
    out.structure = "partial";
    return out;
  }
  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    const size = u32le(bytes, entry + 8);
    const offset = u32le(bytes, entry + 12);
    if (size === null || offset === null || offset + size > bytes.length) {
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_MALFORMED_STRUCTURE",
          "Icon entry points outside the file",
          "MEDIUM",
          `Icon directory entry ${i + 1} points past the end of the file, so that image was not inspected.`,
          { location: `ico:entry${i + 1}` },
        ),
      );
      continue;
    }
    const slice = bytes.subarray(offset, offset + size);
    // A PNG-compressed icon entry is a complete PNG: scan it as an embedded asset
    // so its own metadata chunks are checked too.
    if (startsWith(slice, PNG_MAGIC)) {
      addEmbedded(out, ctx, { bytes: slice, origin: `ico:entry${i + 1}`, declaredMimeType: "image/png" });
    }
  }
  return out;
}

// ── HEIF / AVIF and other ISO-BMFF images ──────────────────────────────────

function parseIsoImage(bytes: Uint8Array, ctx: ParserContext, format: string): AssetParseOutput {
  const out = emptyParseOutput();
  out.hasUnreadableRenderedContent = true;
  let hasExifItem = false;
  let hasXmpItem = false;

  const walk = walkAtoms(bytes, (atom) => {
    if (atom.type === "ispe" && atom.payloadEnd - atom.payloadStart >= 12) {
      out.width = u32be(bytes, atom.payloadStart + 4) ?? out.width;
      out.height = u32be(bytes, atom.payloadStart + 8) ?? out.height;
    } else if (atom.type === "infe") {
      const text = decodeLatin1(bytes, atom.payloadStart, atom.payloadEnd);
      if (text.includes("Exif")) hasExifItem = true;
      if (text.includes("mime") || text.includes("xmp")) hasXmpItem = true;
      bump(out, "items");
    } else if (atom.type === "uuid") {
      // XMP in ISO-BMFF travels in a uuid box; its text nodes are readable.
      const text = decodeUtf8(bytes, atom.payloadStart + 16, atom.payloadEnd);
      if (looksLikeXml(text)) addStream(out, ctx, "metadata", "isobmff:uuid:XMP", collectMarkupText(text));
    }
  });

  applyIsoWalk(out, walk, bytes.length, format);
  if (hasExifItem) {
    out.limitations.push(
      "This container declares an EXIF metadata item, but HEIF item locations were not resolved, so that metadata text was not extracted or analyzed.",
    );
  }
  if (hasXmpItem) {
    out.limitations.push(
      "This container declares a MIME metadata item (typically XMP) that was not extracted, so its text was not analyzed.",
    );
  }
  appendPixelBudgetFinding(out, bytes.length, 4);
  return out;
}

/** Shared reporting for any ISO-BMFF walk: malformed boxes and undeclared bytes. */
export function applyIsoWalk(
  out: AssetParseOutput,
  walk: ReturnType<typeof walkAtoms>,
  byteLength: number,
  format: string,
): void {
  out.stats.atoms = walk.atomCount;
  out.stats.mediaBytes = walk.mediaBytes;
  if (walk.malformed) {
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "Malformed container box",
        "MEDIUM",
        `A ${format} box declared a size that does not fit its parent, so the walk stopped and later boxes were not inspected.`,
        { location: `${format}:boxes` },
      ),
    );
    out.limitations.push("The container box tree broke part way through, so content after that point was not inspected.");
  }
  if (walk.truncated) {
    out.structure = out.structure === "parsed" ? "partial" : out.structure;
    out.limitations.push("The container has more boxes than the parser inspects, so the remainder was not checked.");
  }
  const undeclared = byteLength - walk.coveredBytes;
  if (walk.coveredBytes > 0 && undeclared > 64) {
    out.findings.push(
      finding(
        "MM_TRAILING_DATA",
        "Data outside the container structure",
        "HIGH",
        `${undeclared} bytes are not claimed by any box in this container. Appended data is how a media file carries a second payload.`,
        { count: undeclared, location: `${format}:top-level` },
      ),
    );
  }
}

// ── Shared reporting ───────────────────────────────────────────────────────

function applyExif(exif: ExifParseResult, out: AssetParseOutput, ctx: ParserContext, origin: string): void {
  for (const field of exif.textFields) {
    const text = looksLikeXml(field.text) ? collectMarkupText(field.text) : field.text;
    addStream(out, ctx, "metadata", `${origin}:${field.tag}`, text);
  }
  if (exif.width && !out.width) out.width = exif.width;
  if (exif.height && !out.height) out.height = exif.height;
  if (exif.orientation !== undefined) out.stats.orientation = exif.orientation;
  bump(out, "exifTextFields", exif.textFields.length);
  bump(out, "exifEntries", exif.entryCount);

  if (exif.hasGpsCoordinates) {
    out.findings.push(
      finding(
        "MM_GPS_METADATA",
        "GPS coordinates in image metadata",
        "MEDIUM",
        `The image carries a GPS directory with ${exif.gpsFieldCount} fields including latitude or longitude. Sharing the file discloses where it was taken.`,
        { count: exif.gpsFieldCount, location: `${origin}:GPS` },
      ),
    );
  }
  if (exif.truncated) {
    out.limitations.push(
      "The metadata directory was larger than the parser walks, so some metadata fields were not read.",
    );
  }
}

function appendTrailingDataFinding(
  out: AssetParseOutput,
  byteLength: number,
  endOffset: number,
  location: string,
): void {
  if (endOffset <= 0 || endOffset >= byteLength) return;
  const extra = byteLength - endOffset;
  // A handful of padding bytes is common in real encoders; a payload is not.
  if (extra <= 16) return;
  out.findings.push(
    finding(
      "MM_TRAILING_DATA",
      "Data appended after the end of the image",
      extra > 1024 ? "HIGH" : "MEDIUM",
      `${extra} bytes follow the image's end marker. Appended data is not rendered, is not covered by the image structure, and is the standard way to smuggle a second file.`,
      { count: extra, location },
    ),
  );
  out.stats.trailingBytes = extra;
}

function appendMetadataVolumeFinding(out: AssetParseOutput, metadataBytes: number, byteLength: number): void {
  if (metadataBytes < 64 * 1024) return;
  const share = ratio(metadataBytes, byteLength);
  if (share < 0.25) return;
  out.findings.push(
    finding(
      "MM_EXCESSIVE_METADATA",
      "Metadata dominates the file",
      "MEDIUM",
      `${metadataBytes} bytes of this ${byteLength}-byte file are metadata rather than image data. A file that is mostly metadata is usually carrying something other than a picture.`,
      { count: metadataBytes, location: "metadata" },
    ),
  );
}

/**
 * Pixel budget check. An image that decodes to hundreds of megabytes from a tiny
 * file is a denial-of-service payload aimed at whatever renders it next — a
 * thumbnailer, an OCR engine, a vision model.
 */
function appendPixelBudgetFinding(out: AssetParseOutput, byteLength: number, bytesPerPixel: number): void {
  const width = out.width ?? 0;
  const height = out.height ?? 0;
  if (width <= 0 || height <= 0) return;
  const decoded = width * height * bytesPerPixel;
  out.stats.decodedBytes = decoded;
  if (decoded < PIXEL_BOMB_BYTES) return;
  if (ratio(decoded, byteLength) < PIXEL_BOMB_RATIO) return;
  out.findings.push(
    finding(
      "MM_DECOMPRESSION_BOMB",
      "Image expands to an unsafe size when decoded",
      "HIGH",
      `The declared ${width}x${height} dimensions decode to roughly ${Math.round(decoded / (1024 * 1024))} MB from a ${byteLength}-byte file. Rendering it would exhaust memory in whatever processes it next.`,
      { count: Math.round(decoded / (1024 * 1024)), location: "dimensions" },
    ),
  );
}

async function inflateText(data: Uint8Array, ctx: ParserContext, raw: boolean): Promise<string | null> {
  if (!ctx.inflate || data.length === 0) return null;
  try {
    const out = await ctx.inflate(data, raw, Math.max(4096, ctx.budget.remaining * 4));
    return out ? decodeUtf8(out, 0, out.length) : null;
  } catch {
    return null;
  }
}

function looksLikeXml(text: string): boolean {
  const head = text.slice(0, 200).trimStart().toLowerCase();
  return head.startsWith("<?xml") || head.startsWith("<x:xmpmeta") || head.startsWith("<rdf:") || head.includes("<rdf:rdf");
}

function safeKeyword(keyword: string): string {
  // Keywords are disclosed as finding locations, so they are reduced to a short
  // printable slug rather than passed through.
  return keyword.replace(/[^A-Za-z0-9:._-]/g, "").slice(0, 40) || "unnamed";
}
