import { brotliDecompress, constants, type BrotliOptions } from "node:zlib";

export class BoundedBrotliError extends Error {
    constructor(readonly code: "br_invalid" | "br_limit" | "br_timeout") { super("Compressed request could not be safely decoded"); }
}
/** One complete standard-window Brotli stream, before JSON/policy inspection. */
export async function decodeBoundedBrotli(input: Uint8Array, options: { maxBytes?: number } = {}): Promise<Buffer> {
    const limit = options.maxBytes ?? 1_048_576;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_048_576 || !(input instanceof Uint8Array) || input.byteLength > limit) throw new BoundedBrotliError("br_limit");
    const wire = Buffer.from(input);
    if (wire.length === 0) throw new BoundedBrotliError("br_invalid");
    const maxOutputLength = Math.min(limit, wire.length * 64);
    return new Promise<Buffer>((resolve, reject) => {
        let settled = false;
        const fail = (code: BoundedBrotliError["code"]) => { if (settled) return; settled = true; clearTimeout(timer); reject(new BoundedBrotliError(code)); };
        const timer = setTimeout(() => fail("br_timeout"), 1000);
        try {
            // The engine's info result is checked at runtime; never infer consumption.
            const config: BrotliOptions & { info: true } = { maxOutputLength, info: true, params: { [constants.BROTLI_DECODER_PARAM_LARGE_WINDOW]: 0 } };
            brotliDecompress(wire, config, (error, raw) => {
                if (settled) return;
                if (error) { fail("code" in error && error.code === "ERR_BUFFER_TOO_LARGE" ? "br_limit" : "br_invalid"); return; }
                try {
                    const result = raw as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
                    if (!Buffer.isBuffer(result?.buffer) || !Number.isSafeInteger(result?.engine?.bytesWritten) || result.engine.bytesWritten !== wire.length) return fail("br_invalid");
                    if (result.buffer.length > maxOutputLength) return fail("br_limit");
                    settled = true; clearTimeout(timer); resolve(result.buffer);
                } catch { fail("br_invalid"); }
            });
        } catch { fail("br_invalid"); }
    });
}
