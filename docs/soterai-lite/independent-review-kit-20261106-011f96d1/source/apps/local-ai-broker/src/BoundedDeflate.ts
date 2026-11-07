import { inflate, type ZlibOptions } from "node:zlib";

export class BoundedDeflateError extends Error {
    constructor(readonly code: "deflate_invalid" | "deflate_limit" | "deflate_timeout") { super("Compressed request could not be safely decoded"); }
}
/** One complete zlib-wrapped deflate stream; raw streams/dictionaries refuse. */
export async function decodeBoundedDeflate(input: Uint8Array, options: { maxBytes?: number } = {}): Promise<Buffer> {
    const limit = options.maxBytes ?? 1_048_576;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_048_576 || !(input instanceof Uint8Array) || input.byteLength > limit) throw new BoundedDeflateError("deflate_limit");
    const wire = Buffer.from(input);
    if (wire.length < 6 || (wire[0] & 15) !== 8 || (wire[0] >>> 4) > 7 || ((wire[0] << 8) + wire[1]) % 31 !== 0 || wire[1] & 32) throw new BoundedDeflateError("deflate_invalid");
    const maxOutputLength = Math.min(limit, wire.length * 64);
    return new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const fail = (code: BoundedDeflateError["code"]) => { if (settled) return; settled = true; clearTimeout(timer); reject(new BoundedDeflateError(code)); };
        const timer = setTimeout(() => fail("deflate_timeout"), 1000);
        try {
            const config: ZlibOptions = { maxOutputLength, info: true };
            inflate(wire, config, (error, raw) => {
                if (settled) return;
                if (error) { fail("code" in error && error.code === "ERR_BUFFER_TOO_LARGE" ? "deflate_limit" : "deflate_invalid"); return; }
                try {
                    const result = raw as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
                    if (!Buffer.isBuffer(result?.buffer) || !Number.isSafeInteger(result?.engine?.bytesWritten) || result.engine.bytesWritten !== wire.length) return fail("deflate_invalid");
                    if (result.buffer.length > maxOutputLength) return fail("deflate_limit");
                    settled = true; clearTimeout(timer); resolve(result.buffer);
                } catch { fail("deflate_invalid"); }
            });
        } catch { fail("deflate_invalid"); }
    });
}
