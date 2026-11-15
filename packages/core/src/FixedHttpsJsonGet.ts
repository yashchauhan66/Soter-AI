import { request as httpsRequest, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { isIP } from "node:net";

export interface FixedJsonGetRequest {
    readonly url: string;
    /** Host-only input: never serialize this request into a public result. */
    readonly bearerToken: string;
    readonly maxResponseBytes: number;
    readonly timeoutMs: number;
}
export interface FixedJsonGetResponse {
    readonly statusCode: number;
    readonly contentType: string;
    readonly contentEncoding: string;
    readonly body: Uint8Array;
}
export type FixedJsonGetTransport = (request: FixedJsonGetRequest, signal: AbortSignal) => Promise<FixedJsonGetResponse>;
const fail = (): Error => Error("Approved operation unavailable.");

/** Fixed HTTPS URL only. Query parameters, credentials, fragments, custom ports
 * and literal/localhost destinations are not part of this finite operation. */
export function fixedOperationUrl(value: unknown): string {
    if (typeof value !== "string" || !value || value.length > 2048 || /[\x00-\x20\x7f-\x9f\\]/u.test(value)) throw fail();
    let url: URL; try { url = new URL(value); } catch { throw fail(); }
    if (url.protocol !== "https:" || url.href !== value || url.username || url.password || url.search || url.hash || url.port
        || !url.hostname.includes(".") || isIP(url.hostname.replace(/^\[|\]$/g, "")) || url.hostname.endsWith(".")
        || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(url.hostname)) throw fail();
    return value;
}

type RequestFactory = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;
/** Native HTTPS does not follow redirects or inherit proxy environment settings.
 * No caller headers, DNS override, CA override, request body or retry is accepted. */
export function createFixedHttpsJsonGet(request: RequestFactory = httpsRequest): FixedJsonGetTransport {
    return async (input, signal) => {
        const url = new URL(fixedOperationUrl(input.url));
        if (typeof input.bearerToken !== "string" || !/^[A-Za-z0-9._~+/-]{16,4096}={0,2}$/.test(input.bearerToken)
            || !Number.isSafeInteger(input.maxResponseBytes) || input.maxResponseBytes < 1 || input.maxResponseBytes > 65536
            || !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 5000 || signal.aborted) throw fail();
        return new Promise<FixedJsonGetResponse>((resolve, reject) => {
            let owned: ClientRequest | undefined, response: IncomingMessage | undefined, settled = false;
            const chunks: Buffer[] = []; let bytes = 0;
            const finish = (value?: FixedJsonGetResponse) => {
                if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
                if (value) resolve(value); else { chunks.length = 0; response?.destroy(); owned?.destroy(); reject(fail()); }
            };
            const abort = () => finish();
            const timer = setTimeout(abort, input.timeoutMs); timer.unref?.();
            signal.addEventListener("abort", abort, { once: true });
            try {
                if (signal.aborted) { finish(); return; }
                owned = request(url, { method: "GET", headers: { Accept: "application/json", "Accept-Encoding": "identity", Authorization: "Bearer " + input.bearerToken },
                    agent: false, rejectUnauthorized: true, maxHeaderSize: 8192 }, incoming => {
                    response = incoming;
                    incoming.on("error", () => finish()); incoming.on("aborted", () => finish());
                    const type = incoming.headers["content-type"], encoding = incoming.headers["content-encoding"] ?? "identity";
                    const length = incoming.headers["content-length"];
                    if (incoming.statusCode !== 200 || typeof type !== "string" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)
                        || encoding !== "identity" || incoming.headers.location !== undefined
                        || length !== undefined && (typeof length !== "string" || !/^(?:0|[1-9]\d*)$/.test(length) || Number(length) > input.maxResponseBytes)) { finish(); return; }
                    incoming.on("data", (chunk: unknown) => {
                        if (settled) return;
                        if (!(chunk instanceof Uint8Array) || bytes + chunk.byteLength > input.maxResponseBytes) { finish(); return; }
                        bytes += chunk.byteLength; chunks.push(Buffer.from(chunk));
                    });
                    incoming.on("end", () => {
                        if (length !== undefined && bytes !== Number(length)) { finish(); return; }
                        finish(Object.freeze({ statusCode: 200, contentType: type, contentEncoding: "identity", body: Buffer.concat(chunks, bytes) }));
                    });
                    incoming.on("close", () => { if (!incoming.complete) finish(); });
                });
                owned.on("error", () => finish()); owned.end();
                if (settled) owned.destroy();
            } catch { finish(); }
        });
    };
}
