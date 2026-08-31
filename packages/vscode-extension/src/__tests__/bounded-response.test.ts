import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readBoundedResponseBody } from "../security/boundedResponse";

describe("bounded broker response reader", () => {
    it("reads a normal JSON response", async () => {
        const response = new Response('{"ok":true}', { headers: { "content-length": "11" } });
        assert.strictEqual(await readBoundedResponseBody(response, 64), '{"ok":true}');
    });

    it("rejects a declared oversized response before consuming it", async () => {
        const response = new Response("small", { headers: { "content-length": "999" } });
        await assert.rejects(() => readBoundedResponseBody(response, 32), /exceeds 32 bytes/);
    });

    it("rejects an oversized streamed response even without content-length", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(20));
                controller.enqueue(new Uint8Array(20));
                controller.close();
            },
        });
        await assert.rejects(() => readBoundedResponseBody(new Response(stream), 32), /exceeds 32 bytes/);
    });

    it("decodes a multibyte character split across chunks", async () => {
        const bytes = new TextEncoder().encode("safe 🔒 json");
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes.slice(0, 7));
                controller.enqueue(bytes.slice(7));
                controller.close();
            },
        });
        assert.strictEqual(await readBoundedResponseBody(new Response(stream), 64), "safe 🔒 json");
    });

    it("survives deterministic chunk-boundary fuzz without changing valid UTF-8", async () => {
        let state = 0x51a7e;
        const next = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0);
        const expected = "αβγ safe 🔒 boundary text 日本語".repeat(20);
        const bytes = new TextEncoder().encode(expected);
        for (let attempt = 0; attempt < 100; attempt++) {
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    let offset = 0;
                    while (offset < bytes.length) {
                        const width = 1 + (next() % 19);
                        controller.enqueue(bytes.slice(offset, offset + width));
                        offset += width;
                    }
                    controller.close();
                },
            });
            assert.strictEqual(await readBoundedResponseBody(new Response(stream), bytes.length), expected);
        }
    });
});