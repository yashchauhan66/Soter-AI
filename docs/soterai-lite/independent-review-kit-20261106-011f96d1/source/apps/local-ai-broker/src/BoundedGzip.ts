import { inflateRaw } from "node:zlib";

// Portable gzip CRC32; avoid requiring the newer optional node:zlib.crc32 API.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});
function crc32(data: Uint8Array): number {
    let value = 0xffffffff;
    for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
}

export class BoundedGzipError extends Error {
    constructor(readonly code: "gzip_invalid" | "gzip_limit" | "gzip_timeout") { super("Compressed request could not be safely decoded"); }
}
/** One complete, bounded gzip member. No partial output or policy authority. */
export async function decodeBoundedGzip(input: Uint8Array, options: { maxBytes?: number } = {}): Promise<Buffer> {
    const limit = options.maxBytes ?? 1_048_576;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_048_576 || !(input instanceof Uint8Array) || input.byteLength > limit) throw new BoundedGzipError("gzip_limit");
    const wire = Buffer.from(input), invalid = (): never => { throw new BoundedGzipError("gzip_invalid"); };
    if (wire.length < 18 || wire[0] !== 0x1f || wire[1] !== 0x8b || wire[2] !== 8 || wire[3] & 0xe0) return invalid();
    const flags = wire[3]; let offset = 10;
    const room = (count: number) => { if (offset + count > 4096 || offset + count > wire.length - 8) return invalid(); };
    if (flags & 4) { room(2); const length = wire.readUInt16LE(offset); offset += 2; room(length); offset += length; }
    for (const bit of [8, 16]) if (flags & bit) { while (true) { room(1); if (wire[offset++] === 0) break; } }
    if (flags & 2) { room(2); if ((crc32(wire.subarray(0, offset)) & 0xffff) !== wire.readUInt16LE(offset)) return invalid(); offset += 2; }
    room(0); if (wire.length - offset < 10) return invalid();
    const maxOutputLength = Math.min(limit, wire.length * 64);
    return new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const fail = (code: BoundedGzipError["code"]) => { if (settled) return; settled = true; clearTimeout(timer); reject(new BoundedGzipError(code)); };
        const timer = setTimeout(() => fail("gzip_timeout"), 1000);
        try {
            inflateRaw(wire.subarray(offset), { maxOutputLength, info: true }, (error, raw) => {
                if (settled) return;
                if (error) { fail("code" in error && error.code === "ERR_BUFFER_TOO_LARGE" ? "gzip_limit" : "gzip_invalid"); return; }
                try {
                    const decoded = raw as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
                    const output = decoded?.buffer, consumed = decoded?.engine?.bytesWritten;
                    if (!Buffer.isBuffer(output) || !Number.isSafeInteger(consumed) || consumed < 1 || offset + consumed + 8 !== wire.length) return fail("gzip_invalid");
                    if (output.length > maxOutputLength) return fail("gzip_limit");
                    const trailer = offset + consumed;
                    if (crc32(output) !== wire.readUInt32LE(trailer) || output.length !== wire.readUInt32LE(trailer + 4)) return fail("gzip_invalid");
                    settled = true; clearTimeout(timer); resolve(output);
                } catch { fail("gzip_invalid"); }
            });
        } catch { fail("gzip_invalid"); }
    });
}
