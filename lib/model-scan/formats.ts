/**
 * Model file format detection + minimal ZIP extraction.
 *
 * PyTorch `.pt/.bin/.pth` (and many HF artifacts) are ZIP archives whose
 * `data.pkl` entry is the real pickle. We parse local file headers and inflate
 * deflate entries with node:zlib so the pickle scanner sees the actual stream.
 */
import { inflateRawSync } from "node:zlib";

export type ModelFormat =
  | "pytorch-zip"
  | "pickle"
  | "safetensors"
  | "gguf"
  | "onnx"
  | "numpy-npy"
  | "hdf5-keras"
  | "zip-unknown"
  | "unknown";

export interface ZipEntry {
  name: string;
  data: Buffer | null; // null if we couldn't safely decompress
  method: number;
  compressedSize: number;
  uncompressedSize: number;
}

export function detectFormat(buf: Buffer, filename?: string): ModelFormat {
  const ext = (filename?.toLowerCase().split(".").pop()) ?? "";
  if (buf.length >= 4) {
    // ZIP: PK\x03\x04
    if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06)) {
      if (["pt", "pth", "bin", "ckpt"].includes(ext)) return "pytorch-zip";
      // peek: torch archives contain a data.pkl entry
      if (buf.includes(Buffer.from("data.pkl"))) return "pytorch-zip";
      return "zip-unknown";
    }
    // HDF5 / Keras: \x89HDF\r\n\x1a\n
    if (buf[0] === 0x89 && buf[1] === 0x48 && buf[2] === 0x44 && buf[3] === 0x46) return "hdf5-keras";
    // GGUF
    if (buf.toString("latin1", 0, 4) === "GGUF") return "gguf";
    // ONNX protobuf (no strong magic) — rely on extension
  }
  // safetensors: 8-byte LE header length then JSON
  if (ext === "safetensors" && isLikelySafetensors(buf)) return "safetensors";
  if (ext === "onnx") return "onnx";
  if (ext === "npy" && buf.toString("latin1", 0, 6) === "\x93NUMPY") return "numpy-npy";
  if (["pkl", "pickle", "joblib", "dat", "npy"].includes(ext)) return "pickle";
  if (ext === "safetensors") return "safetensors";
  // raw pickle proto marker
  if (buf.length >= 2 && buf[0] === 0x80 && buf[1] >= 1 && buf[1] <= 5) return "pickle";
  return "unknown";
}

export function isLikelySafetensors(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  const headerLen = Number(buf.readBigUInt64LE(0));
  if (headerLen <= 0 || headerLen + 8 > buf.length) return false;
  try {
    const json = buf.toString("utf8", 8, 8 + Math.min(headerLen, 1_000_000));
    return json.trimStart().startsWith("{");
  } catch {
    return false;
  }
}

/**
 * Parse ZIP local file headers. Handles stored (0) and deflate (8) with known
 * sizes. Returns entries; data is null when streaming/ZIP64/unsupported so the
 * caller can fall back to a raw byte scan.
 */
export function extractZipEntries(buf: Buffer, maxEntries = 4096): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let i = 0;
  while (i + 30 <= buf.length && entries.length < maxEntries) {
    const sig = buf.readUInt32LE(i);
    if (sig !== 0x04034b50) break; // not a local file header — stop (central dir follows)
    const flags = buf.readUInt16LE(i + 6);
    const method = buf.readUInt16LE(i + 8);
    let compSize = buf.readUInt32LE(i + 18);
    const uncompSize = buf.readUInt32LE(i + 22);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const nameStart = i + 30;
    const name = buf.toString("utf8", nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;

    const streaming = (flags & 0x08) !== 0; // sizes in data descriptor
    let data: Buffer | null = null;
    if (!streaming && compSize > 0 && dataStart + compSize <= buf.length) {
      const raw = buf.subarray(dataStart, dataStart + compSize);
      try {
        data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
      } catch {
        data = null;
      }
    }
    entries.push({ name, data, method, compressedSize: compSize, uncompressedSize: uncompSize });

    if (streaming || compSize === 0) {
      // Can't know the exact length — bail to avoid misaligned parsing.
      break;
    }
    i = dataStart + compSize;
  }
  return entries;
}
