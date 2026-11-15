import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { test } from "node:test";
import { createFixedHttpsJsonGet } from "../../../core/src/FixedHttpsJsonGet";

const TOKEN = "synthetic-fixed-https-bearer-A17d91";
const input = { url: "https://api.operations.example/resource", bearerToken: TOKEN, maxResponseBytes: 65536, timeoutMs: 1000 };
class Response extends PassThrough {
    statusCode = 200;
    headers: Record<string, string | string[] | undefined> = { "content-type": "application/json" };
    complete = false;
    finish(body: string | Buffer): void { this.complete = true; this.end(body); }
}
class Request extends EventEmitter {
    destroyed = false; endCalls = 0; bodyArguments = 0;
    constructor(private readonly onEnd: () => void) { super(); }
    end(...args: unknown[]): this { this.endCalls++; this.bodyArguments += args.length; queueMicrotask(this.onEnd); return this; }
    destroy(): this { this.destroyed = true; return this; }
}
function fixture(deliver?: (response: Response) => void) {
    const response = new Response(), calls: Array<{ url: URL; options: RequestOptions; request: Request }> = [];
    const transport = createFixedHttpsJsonGet((url, options, callback) => {
        const request = new Request(() => { callback(response as unknown as IncomingMessage); deliver?.(response); });
        calls.push({ url, options, request }); return request as unknown as ClientRequest;
    });
    return { transport, response, calls };
}

test("native transport sends one exact TLS-verified GET with fixed headers and no body", async () => {
    const f = fixture(response => response.finish('{"state":"ready"}'));
    const result = await f.transport(input, new AbortController().signal);
    assert.equal(result.statusCode, 200); assert.equal(Buffer.from(result.body).toString(), '{"state":"ready"}');
    assert.equal(f.calls.length, 1); const call = f.calls[0]; assert.equal(call.url.href, input.url);
    assert.deepEqual(call.options.headers, { Accept: "application/json", "Accept-Encoding": "identity", Authorization: "Bearer " + TOKEN });
    assert.equal(call.options.method, "GET"); assert.equal(call.options.agent, false); assert.equal(call.options.rejectUnauthorized, true);
    assert.equal(call.options.maxHeaderSize, 8192); assert.equal(call.request.bodyArguments, 0);
});

test("redirects are rejected without a second request or credential forwarding", async () => {
    const f = fixture(); f.response.statusCode = 302; f.response.headers.location = "https://other.example/receive";
    await assert.rejects(f.transport(input, new AbortController().signal), error => !String(error).includes(TOKEN));
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].request.destroyed, true); assert.equal(f.response.destroyed, true);
});

for (const kind of ["declared-size", "streamed-size", "content-type", "compression", "length-mismatch", "status"] as const) {
    test(`native transport refuses ${kind} response`, async () => {
        const f = fixture(response => response.finish(kind === "streamed-size" ? Buffer.alloc(65537, 32) : "{}"));
        if (kind === "declared-size") f.response.headers["content-length"] = "65537";
        if (kind === "content-type") f.response.headers["content-type"] = "text/html";
        if (kind === "compression") f.response.headers["content-encoding"] = "gzip";
        if (kind === "length-mismatch") f.response.headers["content-length"] = "1";
        if (kind === "status") f.response.statusCode = 403;
        await assert.rejects(f.transport(input, new AbortController().signal)); assert.equal(f.calls.length, 1);
    });
}

test("caller cancellation destroys the owned request and discards partial bytes", async () => {
    const f = fixture(response => response.write('{"partial":')), controller = new AbortController();
    const work = f.transport(input, controller.signal); await new Promise<void>(done => setImmediate(done)); controller.abort();
    await assert.rejects(work); assert.equal(f.calls[0].request.destroyed, true); assert.equal(f.response.destroyed, true);
});

test("absolute deadline terminates a stalled response", { timeout: 1000 }, async () => {
    const f = fixture(), alive = setTimeout(() => {}, 200);
    try { await assert.rejects(f.transport({ ...input, timeoutMs: 20 }, new AbortController().signal)); assert.equal(f.calls[0].request.destroyed, true); }
    finally { clearTimeout(alive); }
});

test("unsafe destinations, header injection and pre-cancelled calls never create a request", async () => {
    const f = fixture();
    for (const override of [{ url: "http://api.operations.example/resource" }, { url: "https://127.0.0.1/resource" },
        { url: input.url + "?caller=override" }, { bearerToken: TOKEN + "\r\nX-Injected: true" }]) {
        await assert.rejects(f.transport({ ...input, ...override }, new AbortController().signal));
    }
    const controller = new AbortController(); controller.abort(); await assert.rejects(f.transport(input, controller.signal)); assert.equal(f.calls.length, 0);
});
