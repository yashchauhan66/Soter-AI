/**
 * Audio parsers.
 *
 * Audio carries two distinct risks and they need separating. The first is text:
 * ID3 frames, Vorbis comments and MP4 tag atoms are metadata a model may read as
 * instructions, and those are fully recoverable from bytes. The second is the
 * waveform — speech an agent hears, or a carrier above human hearing — and that
 * is NOT recoverable from bytes. Where a codec would be required, the parser
 * says the audio was not transcribed instead of implying it was clean.
 */
import {
  decodeLatin1,
  decodeUtf8,
  decodeUtf16,
  extractPrintableRuns,
  readCString,
  startsWithAscii,
  tag,
  u16be,
  u16le,
  u32be,
  u32le,
} from "../bytes";
import { decodePcmMono, measureBandEnergy, readExtendedFloat80, type PcmFormat } from "../dsp";
import { ilstTagName, readIlstText, walkAtoms } from "../isobmff";
import { collectMarkupText } from "../xml";
import { emptyParseOutput, type AssetParseOutput } from "../types";
import { addEmbedded, addStream, bump, finding, type ParserContext } from "./shared";
import { applyIsoWalk } from "./image";

/**
 * Share of spectral energy above 17.5 kHz that marks a deliberate carrier. Music
 * and speech recordings put almost nothing there — the band is above most adult
 * hearing and the first thing every lossy codec discards.
 */
const ULTRASONIC_SHARE_THRESHOLD = 0.12;

export async function parseAudio(
  bytes: Uint8Array,
  format: string,
  ctx: ParserContext,
): Promise<AssetParseOutput> {
  switch (format) {
    case "mp3":
      return parseMp3(bytes, ctx);
    case "flac":
      return parseFlac(bytes, ctx);
    case "ogg":
    case "opus":
      return parseOgg(bytes, ctx);
    case "wav":
      return parseWav(bytes, ctx);
    case "aiff":
      return parseAiff(bytes, ctx);
    case "m4a":
    case "m4b":
    case "m4p":
      return parseMp4Audio(bytes, ctx, format);
    default:
      return parseOpaqueAudio(bytes, ctx, format);
  }
}

// ── MP3 / ID3 ──────────────────────────────────────────────────────────────

/** ID3v2 text frames worth recovering. Others are counted, not decoded. */
const ID3_TEXT_FRAMES: Record<string, string> = {
  TIT2: "title",
  TPE1: "artist",
  TALB: "album",
  TCOM: "composer",
  TCON: "genre",
  TCOP: "copyright",
  TENC: "encoder",
  TEXT: "lyricist",
  TIT3: "subtitle",
  TOLY: "original-lyricist",
  TPUB: "publisher",
  TSSE: "encoder-settings",
  TXXX: "user-defined",
  COMM: "comment",
  USLT: "lyrics",
  SYLT: "synchronised-lyrics",
  WXXX: "user-url",
  // v2.2 three-character equivalents.
  TT2: "title",
  TP1: "artist",
  TAL: "album",
  COM: "comment",
  ULT: "lyrics",
  TXX: "user-defined",
};

function parseMp3(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  markSpeechUnreadable(out, "MP3");

  const audioStart = readId3Tag(bytes, out, ctx);
  readId3v1(bytes, out, ctx);
  const frames = countMpegFrames(bytes, audioStart);
  out.stats.mpegFrames = frames.count;
  out.stats.audioBytes = frames.bytes;
  if (frames.count === 0) {
    out.structure = "partial";
    out.findings.push(
      finding(
        "MM_MALFORMED_STRUCTURE",
        "No MPEG audio frames found",
        "MEDIUM",
        "The file declares MP3 audio but contains no decodable MPEG frame headers, so it is a container around something that is not audio.",
        { location: "mp3:frames" },
      ),
    );
  }
  reportNonAudioBytes(out, bytes.length, out.stats.id3Bytes ?? 0, frames.bytes, "mp3");
  return out;
}

/**
 * Read an ID3v2 tag at the start of `bytes` and return where it ends, or 0 when
 * there is none. Shared by MP3 and by the WAV/AIFF chunks that embed a tag, so
 * neither of those inherits MP3's frame-level expectations.
 */
function readId3Tag(bytes: Uint8Array, out: AssetParseOutput, ctx: ParserContext): number {
  if (!startsWithAscii(bytes, "ID3")) return 0;
  const version = bytes[3];
  const flags = bytes[5];
  const size = readSynchsafe(bytes, 6);
  if (size === null) {
    out.structure = "partial";
    return 0;
  }
  const tagEnd = Math.min(10 + size, bytes.length);
  out.stats.id3Version = version;
  out.stats.id3Bytes = size;
  if ((flags & 0x80) !== 0) {
    out.limitations.push(
      "The ID3 tag is unsynchronised, so frame boundaries were read as written and some tag text may have been missed.",
    );
  }
  let cursor = 10;
  // An extended header sits between the tag header and the first frame.
  if ((flags & 0x40) !== 0) {
    const extendedSize = version >= 4 ? readSynchsafe(bytes, cursor) : u32be(bytes, cursor);
    if (extendedSize !== null) cursor += extendedSize + (version >= 4 ? 0 : 4);
  }
  readId3Frames(bytes, cursor, tagEnd, version, out, ctx);
  if (size > 1024 * 1024) {
    out.findings.push(
      finding(
        "MM_EXCESSIVE_METADATA",
        "Oversized ID3 tag",
        "MEDIUM",
        `The ID3 tag is ${Math.round(size / 1024)} KB. A tag block that large is carrying payload rather than track information.`,
        { count: size, location: "id3v2" },
      ),
    );
  }
  return tagEnd;
}

function readId3Frames(
  bytes: Uint8Array,
  start: number,
  end: number,
  version: number,
  out: AssetParseOutput,
  ctx: ParserContext,
): void {
  const idLength = version <= 2 ? 3 : 4;
  const headerLength = version <= 2 ? 6 : 10;
  let cursor = start;
  let frames = 0;

  while (cursor + headerLength <= end && frames < 512) {
    const id = tag(bytes, cursor, idLength);
    if (!id || !/^[A-Z0-9]+$/.test(id)) break; // padding or garbage: stop cleanly
    let size: number | null;
    if (version <= 2) {
      size = ((bytes[cursor + 3] << 16) | (bytes[cursor + 4] << 8) | bytes[cursor + 5]) >>> 0;
    } else if (version >= 4) {
      size = readSynchsafe(bytes, cursor + 4);
    } else {
      size = u32be(bytes, cursor + 4);
    }
    if (size === null || size <= 0) break;
    const dataStart = cursor + headerLength;
    const dataEnd = Math.min(dataStart + size, end);
    if (dataStart >= end) break;
    frames += 1;

    const label = ID3_TEXT_FRAMES[id];
    if (label) {
      const text = readId3Text(bytes, dataStart, dataEnd, id);
      if (text) addStream(out, ctx, "metadata", `id3:${id}:${label}`, text);
    } else if (id === "APIC" || id === "PIC") {
      const art = readId3Picture(bytes, dataStart, dataEnd, id);
      if (art) addEmbedded(out, ctx, { bytes: art.bytes, origin: `id3:${id}`, declaredMimeType: art.mimeType });
      bump(out, "attachedPictures");
    } else if (id === "GEOB") {
      // A general encapsulated object is an arbitrary file inside the tag.
      const { text: mimeType, next } = readCString(bytes, dataStart + 1, dataEnd);
      addEmbedded(out, ctx, {
        bytes: bytes.subarray(Math.min(next + 2, dataEnd), dataEnd),
        origin: "id3:GEOB",
        declaredMimeType: mimeType || undefined,
      });
      out.findings.push(
        finding(
          "MM_EMBEDDED_OBJECT",
          "Encapsulated object in audio tag",
          "MEDIUM",
          `The ID3 tag carries a GEOB frame of ${dataEnd - dataStart} bytes: an arbitrary file embedded in the track metadata.`,
          { count: dataEnd - dataStart, location: "id3:GEOB" },
        ),
      );
    } else if (id === "PRIV") {
      const { text: owner, next } = readCString(bytes, dataStart, dataEnd);
      addStream(out, ctx, "metadata", `id3:PRIV:${slug(owner)}`, extractPrintableRuns(bytes.subarray(next, dataEnd), 8));
      bump(out, "privateFrames");
    } else {
      bump(out, "otherId3Frames");
    }

    cursor = dataStart + size;
  }
  out.stats.id3Frames = frames;
}

/** ID3 text frames start with an encoding byte: 0 latin1, 1 UTF-16+BOM, 2 UTF-16BE, 3 UTF-8. */
function readId3Text(bytes: Uint8Array, start: number, end: number, id: string): string {
  if (start >= end) return "";
  const encoding = bytes[start];
  let cursor = start + 1;
  // COMM and USLT carry a 3-byte language code plus a NUL-terminated descriptor.
  if (id === "COMM" || id === "USLT" || id === "COM" || id === "ULT") {
    cursor += 3;
    cursor = skipEncodedString(bytes, cursor, end, encoding);
  } else if (id === "TXXX" || id === "WXXX" || id === "TXX") {
    cursor = skipEncodedString(bytes, cursor, end, encoding);
  }
  if (cursor >= end) return "";
  const slice = bytes.subarray(cursor, end);
  if (encoding === 1 || encoding === 2) return decodeUtf16(slice).replace(/\0+/g, " ").trim();
  if (encoding === 3) return decodeUtf8(slice, 0, slice.length).replace(/\0+/g, " ").trim();
  return decodeLatin1(slice, 0, slice.length).replace(/\0+/g, " ").trim();
}

/** Advance past one NUL-terminated string in the frame's declared encoding. */
function skipEncodedString(bytes: Uint8Array, start: number, end: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < end; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2;
    }
    return end;
  }
  return readCString(bytes, start, end).next;
}

function readId3Picture(
  bytes: Uint8Array,
  start: number,
  end: number,
  id: string,
): { bytes: Uint8Array; mimeType?: string } | null {
  const encoding = bytes[start];
  let cursor = start + 1;
  let mimeType: string | undefined;
  if (id === "PIC") {
    // v2.2 uses a fixed 3-byte image format code instead of a MIME string.
    const code = tag(bytes, cursor, 3)?.toUpperCase();
    mimeType = code === "PNG" ? "image/png" : code === "JPG" ? "image/jpeg" : undefined;
    cursor += 3;
  } else {
    const mime = readCString(bytes, cursor, end);
    mimeType = mime.text || undefined;
    cursor = mime.next;
  }
  cursor += 1; // picture type
  cursor = skipEncodedString(bytes, cursor, end, encoding); // description
  if (cursor >= end) return null;
  return { bytes: bytes.subarray(cursor, end), mimeType };
}

function readId3v1(bytes: Uint8Array, out: AssetParseOutput, ctx: ParserContext): void {
  if (bytes.length < 128) return;
  const start = bytes.length - 128;
  if (!startsWithAscii(bytes, "TAG", start)) return;
  const fields = [
    ["title", 3, 33],
    ["artist", 33, 63],
    ["album", 63, 93],
    ["comment", 97, 127],
  ] as const;
  for (const [name, from, to] of fields) {
    const text = decodeLatin1(bytes, start + from, start + to).replace(/\0+/g, "").trim();
    if (text) addStream(out, ctx, "metadata", `id3v1:${name}`, text);
  }
  bump(out, "id3v1Tags");
}

/** Seven-bit-per-byte size field used throughout ID3v2. */
function readSynchsafe(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.length) return null;
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

const MPEG_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG_SAMPLE_RATES = [44100, 48000, 32000, 0];

/**
 * Walk MPEG frame headers to learn how much of the file is actually audio. The
 * gap between that and the file length is what a payload occupies.
 */
function countMpegFrames(bytes: Uint8Array, start: number): { count: number; bytes: number } {
  let cursor = start;
  let count = 0;
  let total = 0;
  let misses = 0;
  while (cursor + 4 <= bytes.length && count < 100_000 && misses < 4096) {
    if (bytes[cursor] !== 0xff || (bytes[cursor + 1] & 0xe0) !== 0xe0) {
      cursor += 1;
      misses += 1;
      continue;
    }
    const versionBits = (bytes[cursor + 1] >> 3) & 0x03;
    const layerBits = (bytes[cursor + 1] >> 1) & 0x03;
    const bitrateIndex = (bytes[cursor + 2] >> 4) & 0x0f;
    const sampleIndex = (bytes[cursor + 2] >> 2) & 0x03;
    const padding = (bytes[cursor + 2] >> 1) & 0x01;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) {
      cursor += 1;
      misses += 1;
      continue;
    }
    const isVersion1 = versionBits === 3;
    const bitrate = MPEG_BITRATES_V1_L3[bitrateIndex] * 1000 * (isVersion1 ? 1 : 0.5);
    const sampleRate = MPEG_SAMPLE_RATES[sampleIndex] / (isVersion1 ? 1 : versionBits === 2 ? 2 : 4);
    if (bitrate <= 0 || sampleRate <= 0) {
      cursor += 1;
      misses += 1;
      continue;
    }
    const frameLength = Math.floor(((isVersion1 ? 144 : 72) * bitrate) / sampleRate) + padding;
    if (frameLength < 8) {
      cursor += 1;
      misses += 1;
      continue;
    }
    count += 1;
    total += frameLength;
    cursor += frameLength;
  }
  return { count, bytes: total };
}

// ── FLAC ───────────────────────────────────────────────────────────────────

function parseFlac(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  markSpeechUnreadable(out, "FLAC");
  let cursor = 4;
  let last = false;
  let blocks = 0;
  let metadataBytes = 0;

  while (!last && cursor + 4 <= bytes.length && blocks < 128) {
    const header = bytes[cursor];
    last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const size = ((bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3]) >>> 0;
    const dataStart = cursor + 4;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) {
      out.structure = "partial";
      out.findings.push(
        finding(
          "MM_TRUNCATED_ASSET",
          "Truncated FLAC metadata block",
          "MEDIUM",
          `A FLAC metadata block declared ${size} bytes but the file ends first, so it was not inspected.`,
          { location: "flac:metadata" },
        ),
      );
      break;
    }
    blocks += 1;
    metadataBytes += size + 4;

    if (type === 0 && size >= 18) {
      out.stats.sampleRate = ((bytes[dataStart + 10] << 12) | (bytes[dataStart + 11] << 4) | (bytes[dataStart + 12] >> 4)) >>> 0;
      out.stats.channels = ((bytes[dataStart + 12] >> 1) & 0x07) + 1;
    } else if (type === 4) {
      readVorbisComment(bytes, dataStart, dataEnd, out, ctx, "flac");
    } else if (type === 6) {
      readFlacPicture(bytes, dataStart, dataEnd, out, ctx);
    } else if (type === 2) {
      // CUESHEET or an application block: readable strings only.
      addStream(out, ctx, "metadata", "flac:application", extractPrintableRuns(bytes.subarray(dataStart, dataEnd), 10));
    }
    cursor = dataEnd;
  }

  out.stats.metadataBlocks = blocks;
  out.stats.metadataBytes = metadataBytes;
  return out;
}

function readFlacPicture(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: AssetParseOutput,
  ctx: ParserContext,
): void {
  const mimeLength = u32be(bytes, start + 4) ?? 0;
  const mimeStart = start + 8;
  const mimeType = decodeLatin1(bytes, mimeStart, Math.min(mimeStart + mimeLength, end));
  const descLength = u32be(bytes, mimeStart + mimeLength) ?? 0;
  const dataLengthAt = mimeStart + mimeLength + 4 + descLength + 16;
  const dataLength = u32be(bytes, dataLengthAt) ?? 0;
  const dataStart = dataLengthAt + 4;
  if (dataLength > 0 && dataStart + dataLength <= end) {
    addEmbedded(out, ctx, {
      bytes: bytes.subarray(dataStart, dataStart + dataLength),
      origin: "flac:PICTURE",
      declaredMimeType: mimeType || undefined,
    });
  }
  bump(out, "attachedPictures");
}

// ── Ogg / Opus / Vorbis ────────────────────────────────────────────────────

function parseOgg(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  markSpeechUnreadable(out, "Ogg");
  let cursor = 0;
  let pages = 0;
  let audioBytes = 0;

  while (cursor + 27 <= bytes.length && pages < 4096) {
    if (!startsWithAscii(bytes, "OggS", cursor)) {
      if (pages === 0) {
        out.structure = "not-parsed";
        return out;
      }
      // Pages stopped: whatever follows is not part of the Ogg stream.
      break;
    }
    const segmentCount = bytes[cursor + 26];
    const segmentTableEnd = cursor + 27 + segmentCount;
    if (segmentTableEnd > bytes.length) {
      out.structure = "partial";
      break;
    }
    let payloadLength = 0;
    for (let i = 0; i < segmentCount; i += 1) payloadLength += bytes[cursor + 27 + i];
    const payloadStart = segmentTableEnd;
    const payloadEnd = Math.min(payloadStart + payloadLength, bytes.length);
    pages += 1;

    if (startsWithAscii(bytes, "OpusTags", payloadStart)) {
      readVorbisComment(bytes, payloadStart + 8, payloadEnd, out, ctx, "opus", false);
    } else if (bytes[payloadStart] === 0x03 && startsWithAscii(bytes, "vorbis", payloadStart + 1)) {
      readVorbisComment(bytes, payloadStart + 7, payloadEnd, out, ctx, "vorbis", true);
    } else if (startsWithAscii(bytes, "\x7fFLAC", payloadStart)) {
      bump(out, "oggFlacStreams");
    } else if (startsWithAscii(bytes, "OpusHead", payloadStart)) {
      out.stats.channels = bytes[payloadStart + 9] ?? 0;
      out.stats.sampleRate = u32le(bytes, payloadStart + 12) ?? 0;
    } else {
      audioBytes += payloadEnd - payloadStart;
    }
    cursor = payloadEnd;
  }

  out.stats.pages = pages;
  out.stats.audioBytes = audioBytes;
  if (cursor < bytes.length - 16) {
    out.findings.push(
      finding(
        "MM_TRAILING_DATA",
        "Data after the last Ogg page",
        "HIGH",
        `${bytes.length - cursor} bytes follow the final Ogg page. Data outside the page structure is never played and never decoded.`,
        { count: bytes.length - cursor, location: "ogg:pages" },
      ),
    );
  }
  return out;
}

/**
 * Vorbis comment block: a vendor string then length-prefixed "KEY=value" pairs.
 * Used by FLAC, Vorbis and Opus alike.
 */
function readVorbisComment(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: AssetParseOutput,
  ctx: ParserContext,
  origin: string,
  framingBit = false,
): void {
  const vendorLength = u32le(bytes, start) ?? 0;
  let cursor = start + 4 + vendorLength;
  const vendor = decodeUtf8(bytes, start + 4, Math.min(start + 4 + vendorLength, end));
  if (vendor.trim()) addStream(out, ctx, "metadata", `${origin}:vendor`, vendor);
  const count = u32le(bytes, cursor) ?? 0;
  cursor += 4;
  let read = 0;
  while (read < count && cursor + 4 <= end && read < 512) {
    const length = u32le(bytes, cursor) ?? 0;
    const fieldStart = cursor + 4;
    const fieldEnd = Math.min(fieldStart + length, end);
    if (fieldStart >= end || length <= 0) break;
    const field = decodeUtf8(bytes, fieldStart, fieldEnd);
    const equals = field.indexOf("=");
    if (equals > 0) {
      const key = field.slice(0, equals);
      const value = field.slice(equals + 1);
      if (key.toUpperCase() === "METADATA_BLOCK_PICTURE") {
        // Base64 cover art inside a comment field: counted, not decoded here.
        bump(out, "attachedPictures");
      } else {
        addStream(out, ctx, "metadata", `${origin}:${slug(key)}`, value);
      }
    }
    cursor = fieldStart + length;
    read += 1;
  }
  if (framingBit) cursor += 1;
  bump(out, "commentFields", read);
}

// ── WAV / AIFF (uncompressed: the waveform is readable) ────────────────────

function parseWav(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  const declared = u32le(bytes, 4);
  const riffEnd = declared === null ? bytes.length : 8 + declared;
  let cursor = 12;
  let format: PcmFormat | null = null;
  let dataStart = -1;
  let dataEnd = -1;
  let guard = 0;

  while (cursor + 8 <= Math.min(bytes.length, riffEnd) && guard < 512) {
    guard += 1;
    const chunk = tag(bytes, cursor, 4);
    const size = u32le(bytes, cursor + 4);
    if (chunk === null || size === null) break;
    const payloadStart = cursor + 8;
    const payloadEnd = Math.min(payloadStart + size, bytes.length);

    if (chunk === "fmt ") {
      const formatTag = u16le(bytes, payloadStart) ?? 0;
      format = {
        channels: u16le(bytes, payloadStart + 2) ?? 0,
        sampleRate: u32le(bytes, payloadStart + 4) ?? 0,
        bitsPerSample: u16le(bytes, payloadStart + 14) ?? 0,
        float: formatTag === 3,
      };
      out.stats.sampleRate = format.sampleRate;
      out.stats.channels = format.channels;
      out.stats.formatTag = formatTag;
      // 0xFFFE is WAVE_FORMAT_EXTENSIBLE; the real tag is in the sub-format GUID.
      if (formatTag !== 1 && formatTag !== 3 && formatTag !== 0xfffe) {
        out.limitations.push(
          `The WAV audio uses compression format ${formatTag}, which this scanner cannot decode, so the waveform was not analyzed.`,
        );
      }
    } else if (chunk === "data") {
      dataStart = payloadStart;
      dataEnd = payloadEnd;
      out.stats.audioBytes = payloadEnd - payloadStart;
    } else if (chunk === "LIST") {
      readRiffList(bytes, payloadStart, payloadEnd, out, ctx);
    } else if (chunk === "id3 " || chunk === "ID3 ") {
      readNestedId3(bytes.subarray(payloadStart, payloadEnd), out, ctx, "wav");
    } else if (chunk === "_PMX" || chunk === "iXML") {
      addStream(out, ctx, "metadata", `wav:${chunk.trim()}`, collectMarkupText(decodeUtf8(bytes, payloadStart, payloadEnd)));
    }

    cursor = payloadStart + size + (size % 2);
  }

  if (format && dataStart >= 0) {
    analyzeWaveform(bytes.subarray(dataStart, dataEnd), format, out, false);
  } else {
    markSpeechUnreadable(out, "WAV");
  }
  if (riffEnd > 0 && riffEnd < bytes.length - 16) {
    out.findings.push(
      finding(
        "MM_TRAILING_DATA",
        "Data after the end of the RIFF container",
        "HIGH",
        `${bytes.length - riffEnd} bytes follow the declared end of the RIFF container and are not part of the audio.`,
        { count: bytes.length - riffEnd, location: "wav:RIFF" },
      ),
    );
  }
  return out;
}

/** RIFF INFO lists hold the human-readable tags in a WAV file. */
function readRiffList(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: AssetParseOutput,
  ctx: ParserContext,
): void {
  const listType = tag(bytes, start, 4);
  if (listType !== "INFO") return;
  let cursor = start + 4;
  let guard = 0;
  while (cursor + 8 <= end && guard < 128) {
    guard += 1;
    const key = tag(bytes, cursor, 4);
    const size = u32le(bytes, cursor + 4);
    if (key === null || size === null) break;
    const valueStart = cursor + 8;
    const valueEnd = Math.min(valueStart + size, end);
    const text = decodeLatin1(bytes, valueStart, valueEnd).replace(/\0+/g, "").trim();
    if (text) addStream(out, ctx, "metadata", `wav:INFO:${slug(key)}`, text);
    cursor = valueStart + size + (size % 2);
  }
}

function parseAiff(bytes: Uint8Array, ctx: ParserContext): AssetParseOutput {
  const out = emptyParseOutput();
  let cursor = 12;
  let format: PcmFormat | null = null;
  let dataStart = -1;
  let dataEnd = -1;
  let compressed = false;
  let guard = 0;

  while (cursor + 8 <= bytes.length && guard < 256) {
    guard += 1;
    const chunk = tag(bytes, cursor, 4);
    const size = u32be(bytes, cursor + 4);
    if (chunk === null || size === null) break;
    const payloadStart = cursor + 8;
    const payloadEnd = Math.min(payloadStart + size, bytes.length);

    if (chunk === "COMM") {
      const channels = u16be(bytes, payloadStart) ?? 0;
      const bits = u16be(bytes, payloadStart + 6) ?? 0;
      const rate = readExtendedFloat80(bytes, payloadStart + 8) ?? 0;
      format = { channels, sampleRate: Math.round(rate), bitsPerSample: bits, float: false };
      out.stats.sampleRate = format.sampleRate;
      out.stats.channels = channels;
      if (size >= 22) {
        const codec = tag(bytes, payloadStart + 18, 4);
        // AIFF-C names its codec here; "NONE" and "sowt" are still plain PCM.
        compressed = codec !== null && codec !== "NONE" && codec !== "sowt" && codec !== "twos";
        if (compressed) {
          out.limitations.push(
            "The AIFF audio is compressed with a codec this scanner cannot decode, so the waveform was not analyzed.",
          );
        }
      }
    } else if (chunk === "SSND") {
      // An 8-byte offset/blockSize header precedes the samples.
      dataStart = payloadStart + 8;
      dataEnd = payloadEnd;
      out.stats.audioBytes = Math.max(0, payloadEnd - dataStart);
    } else if (chunk === "NAME" || chunk === "AUTH" || chunk === "ANNO" || chunk === "(c) ") {
      const text = decodeLatin1(bytes, payloadStart, payloadEnd).replace(/\0+/g, "").trim();
      if (text) addStream(out, ctx, "metadata", `aiff:${chunk.trim()}`, text);
    } else if (chunk === "ID3 ") {
      readNestedId3(bytes.subarray(payloadStart, payloadEnd), out, ctx, "aiff");
    }

    cursor = payloadStart + size + (size % 2);
  }

  if (format && dataStart >= 0 && !compressed) {
    // AIFF samples are big-endian, unlike WAV.
    analyzeWaveform(bytes.subarray(dataStart, dataEnd), format, out, true);
  } else {
    markSpeechUnreadable(out, "AIFF");
  }
  return out;
}

/**
 * Measure the spectrum of uncompressed audio. This is the only place the scanner
 * can make a positive claim about what is *in* the sound rather than around it.
 */
function analyzeWaveform(
  data: Uint8Array,
  format: PcmFormat,
  out: AssetParseOutput,
  bigEndian: boolean,
): void {
  const samples = decodePcmMono(data, format, undefined, bigEndian);
  if (!samples) {
    markSpeechUnreadable(out, "audio");
    return;
  }
  const band = measureBandEnergy(samples, format.sampleRate);
  out.stats.analysisWindows = band.windows;
  if (band.windows === 0) {
    markSpeechUnreadable(out, "audio");
    return;
  }
  out.stats.highBandSharePercent = Math.round(band.highBandShare * 100);
  if (band.highBandShare >= ULTRASONIC_SHARE_THRESHOLD) {
    out.findings.push(
      finding(
        "MM_ULTRASONIC_BAND_ENERGY",
        "Energy concentrated above human hearing",
        "HIGH",
        `${Math.round(band.highBandShare * 100)}% of the measured spectral energy sits above ${Math.round(band.cutoffHz / 1000)} kHz, which listeners cannot hear and codecs normally discard. That band is the standard carrier for commands aimed at a device rather than a person.`,
        { count: Math.round(band.highBandShare * 100), location: "waveform" },
      ),
    );
  }
  // The waveform was measured, but measuring is not transcribing: what is said
  // in the audible band is still unknown without a transcription adapter.
  markSpeechUnreadable(out, "audio");
}

// ── MP4 audio ──────────────────────────────────────────────────────────────

function parseMp4Audio(bytes: Uint8Array, ctx: ParserContext, format: string): AssetParseOutput {
  const out = emptyParseOutput();
  markSpeechUnreadable(out, "MP4 audio");

  const walk = walkAtoms(bytes, (atom) => {
    const parent = atom.path[atom.path.length - 2] ?? "";
    const grandparent = atom.path[atom.path.length - 3] ?? "";
    if (atom.type === "data") {
      // Tag layout is ilst → <tag name> → data; a `data` box anywhere else is
      // some other format's box that happens to share the name.
      if (grandparent !== "ilst") return;
      const tagName = ilstTagName(parent);
      const text = readIlstText(bytes, atom.payloadStart, atom.payloadEnd);
      if (text) addStream(out, ctx, "metadata", `mp4:ilst:${slug(tagName)}`, text);
      else if (tagName === "cover-art") {
        addEmbedded(out, ctx, {
          // The 8-byte type/locale header precedes the image bytes.
          bytes: bytes.subarray(atom.payloadStart + 8, atom.payloadEnd),
          origin: "mp4:ilst:covr",
        });
      }
      bump(out, "tagAtoms");
    } else if (atom.type === "uuid") {
      const text = decodeUtf8(bytes, atom.payloadStart + 16, atom.payloadEnd);
      if (text.trimStart().startsWith("<")) addStream(out, ctx, "metadata", "mp4:uuid:XMP", collectMarkupText(text));
    } else if (atom.type === "free" || atom.type === "skip") {
      bump(out, "freeSpaceBytes", atom.payloadEnd - atom.payloadStart);
    }
  });

  applyIsoWalk(out, walk, bytes.length, format);
  reportFreeSpace(out, bytes.length);
  return out;
}

function parseOpaqueAudio(bytes: Uint8Array, ctx: ParserContext, format: string): AssetParseOutput {
  const out = emptyParseOutput();
  markSpeechUnreadable(out, format.toUpperCase());
  // No container walk exists for this format here, so only readable strings are
  // recovered and the structure is honestly reported as not parsed.
  out.structure = "not-parsed";
  const text = extractPrintableRuns(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)), 12);
  if (text) addStream(out, ctx, "metadata", `${format}:strings`, text);
  out.limitations.push(
    `The ${format.toUpperCase()} container is not parsed by this scanner, so only readable strings from the first 64 KB were analyzed.`,
  );
  return out;
}

// ── Shared ─────────────────────────────────────────────────────────────────

function markSpeechUnreadable(out: AssetParseOutput, label: string): void {
  out.hasUnreadableRenderedContent = true;
  const sentence = `Speech in this ${label} file was not transcribed, so anything spoken in it was not analyzed.`;
  if (!out.limitations.includes(sentence)) out.limitations.push(sentence);
}

/**
 * Read an ID3 tag carried inside another container (WAV's `id3 ` chunk, AIFF's
 * `ID3 ` chunk) into the host's output. A scratch output is used so the tag's
 * frames land in the host asset while MP3-only expectations — frame counting,
 * byte accounting — never apply to a file that is not an MP3.
 */
function readNestedId3(
  bytes: Uint8Array,
  out: AssetParseOutput,
  ctx: ParserContext,
  host: string,
): void {
  const scratch = emptyParseOutput();
  if (readId3Tag(bytes, scratch, ctx) === 0) return;
  for (const stream of scratch.streams) {
    out.streams.push({ ...stream, origin: `${host}:${stream.origin}` });
  }
  out.findings.push(...scratch.findings);
  out.embedded.push(...scratch.embedded);
  for (const limitation of scratch.limitations) {
    if (!out.limitations.includes(limitation)) out.limitations.push(limitation);
  }
}

/** Bytes belonging to neither the tag block nor the audio frames. */
function reportNonAudioBytes(
  out: AssetParseOutput,
  byteLength: number,
  metadataBytes: number,
  audioBytes: number,
  format: string,
): void {
  const accounted = metadataBytes + audioBytes;
  const unaccounted = byteLength - accounted;
  if (accounted === 0 || unaccounted <= 4096) return;
  if (unaccounted / byteLength < 0.2) return;
  out.findings.push(
    finding(
      "MM_TRAILING_DATA",
      "Bytes outside the audio and tag structure",
      "MEDIUM",
      `${unaccounted} of ${byteLength} bytes belong to neither the metadata tag nor a decodable audio frame.`,
      { count: unaccounted, location: `${format}:layout` },
    ),
  );
}

function reportFreeSpace(out: AssetParseOutput, byteLength: number): void {
  const free = out.stats.freeSpaceBytes ?? 0;
  if (free < 64 * 1024 || free / byteLength < 0.2) return;
  out.findings.push(
    finding(
      "MM_TRAILING_DATA",
      "Large free-space box in the container",
      "MEDIUM",
      `${free} bytes sit in free/skip boxes, which players ignore. A free box that large is a hiding place, not padding.`,
      { count: free, location: "mp4:free" },
    ),
  );
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40) || "field";
}

/** Exposed for the video parser, which shares the MP4 tag layout. */
export { markSpeechUnreadable, slug };

/** Exposed so the orchestrator can name the check in coverage text. */
export const ULTRASONIC_CUTOFF_HZ = 17_500;
