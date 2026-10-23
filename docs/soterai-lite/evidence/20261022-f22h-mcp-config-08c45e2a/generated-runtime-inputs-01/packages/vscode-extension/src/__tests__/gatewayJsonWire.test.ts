import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer, request, type Server, type OutgoingHttpHeaders } from "node:http";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const TOKEN = "synthetic-f15a-data-" + "d".repeat(40), CONTROL = "synthetic-f15a-control-" + "c".repeat(40), ROUTE = "/v1/ai/openai-compatible/chat/completions";
const publicBody = '{"model":"synthetic","messages":[{"role":"user","content":"Public hello 🙂"}]}';
async function listen(server: Server) { await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); assert.ok(address && typeof address !== "string"); return `http://127.0.0.1:${address.port}`; }
async function close(server: Server) { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }); }
async function fixture(run: (url: string, wires: string[], stop: () => Promise<void>) => Promise<void>, extra = {}) {
    const wires: string[] = [], provider = createServer((req, res) => { const chunks: Buffer[] = []; req.on("data", c => chunks.push(c)); req.on("end", () => { wires.push(Buffer.concat(chunks).toString("utf8")); res.setHeader("content-type", "application/json"); res.end('{"choices":[{"message":{"content":"Public response"}}]}'); }); });
    const target = await listen(provider), broker = new BrokerServer({ token: TOKEN, controlToken: CONTROL, port: 0, openAIProviderUrl: target, providerApiKey: "synthetic-provider-no-account", ...extra });
    const { url } = await broker.start(); try { await run(url, wires, () => broker.stop()); } finally { await broker.stop(); await close(provider); }
}
function post(url: string, body: string | Buffer, type: string | null = "application/json", duplicates = false): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
        const data = Buffer.isBuffer(body) ? body : Buffer.from(body), headers = ["Host", new URL(url).host, "Authorization", "Bearer " + TOKEN, "Content-Length", String(data.length), ...(type === null ? [] : ["Content-Type", type]), ...(duplicates ? ["Content-Type", "text/plain"] : [])];
        // Node accepts the raw alternating header array; retain duplicate-header wire coverage.
        const req = request(url + ROUTE, { method: "POST", headers: headers as unknown as OutgoingHttpHeaders }, res => { let text = ""; res.on("data", c => { text += String(c); }); res.on("end", () => resolve({ status: res.statusCode ?? 0, text })); });
        req.on("error", reject); req.end(data);
    });
}
test("F15a-W01 real public JSON bytes reach loopback provider after complete decode", async () => fixture(async (url, wires) => { assert.equal((await post(url, publicBody)).status, 200); assert.equal(wires.length, 1); assert.ok(wires[0].includes("Public hello 🙂")); }));
for (const body of ['{"model":"discarded","model":"synthetic","messages":[{"role":"user","content":"Public"}]}', '{"model":"synthetic","messages":[{"role":"user","content":"Public","\\u0063ontent":"Other"}]}']) test("F15a-W02 duplicate decoded key never opens provider request", async () => fixture(async (url, wires) => { assert.ok((await post(url, body)).status >= 400); assert.deepEqual(wires, []); }));
for (const type of ["text/plain", "application/json; charset=latin1", "application/octet-stream"]) test("F15a-W03 unsupported media/charset " + type, async () => fixture(async (url, wires) => { assert.equal((await post(url, publicBody, type)).status, 415); assert.deepEqual(wires, []); }));
test("F15a-W03 nonempty body without media header refuses", async () => fixture(async (url, wires) => { assert.equal((await post(url, publicBody, null)).status, 415); assert.deepEqual(wires, []); }));
test("F15a-W04 duplicate media header refuses before forwarding", async () => fixture(async (url, wires) => { assert.equal((await post(url, publicBody, "application/json", true)).status, 415); assert.deepEqual(wires, []); }));
test("F15a-W05 format flag off refuses rather than legacy pass-through", async () => fixture(async (url, wires) => { assert.equal((await post(url, publicBody)).status, 503); assert.deepEqual(wires, []); }, { jsonBodies: false }));
test("F15a-W06 invalid UTF8/BOM/truncation never forwards a partial request", async () => fixture(async (url, wires) => { for (const input of [Buffer.concat([Buffer.from('{"x":"'), Buffer.from([0xc0, 0xaf]), Buffer.from('"}')]), Buffer.from('\ufeff' + publicBody), '{"messages":[']) assert.ok((await post(url, input)).status >= 400); assert.deepEqual(wires, []); }));
test("F15a-W07 recognized synthetic provider credential is withheld from actual receiver", async () => fixture(async (url, wires) => { const secret = "sk-proj-" + "SYNTHETIC_F15A_PROVIDER_SHAPE_ONLY".repeat(3), response = await post(url, JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: secret }] })); assert.ok(response.status >= 400 || wires.every(w => !w.includes(secret))); assert.ok(wires.every(w => !w.includes(secret))); }));
test("F15a-W08 body read deadline refuses an incomplete finite request before provider contact", async () => fixture(async (url, wires) => {
    const status = await new Promise<number>(resolve => {
        let settled = false; const done = (value: number) => { if (!settled) { settled = true; resolve(value); } };
        const req = request(url + ROUTE, { method: "POST", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json", "content-length": "500" } }, res => { res.resume(); res.once("end", () => done(res.statusCode ?? 0)); });
        req.on("error", () => done(0)); req.write('{"messages":[');
        const timer = setTimeout(() => { req.destroy(); done(0); }, 700);
        req.once("close", () => clearTimeout(timer));
    });
    assert.equal(status, 408); assert.deepEqual(wires, []);
}, { requestTimeoutMs: 100 }));
test("F15a-W09 broker shutdown while body is incomplete refuses its late complete request", async () => fixture(async (url, wires, stop) => {
    const data = Buffer.from(publicBody), half = Math.floor(data.length / 2); let req!: ReturnType<typeof request>;
    const response = new Promise<number>((resolve, reject) => { req = request(url + ROUTE, { method: "POST", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json", "content-length": String(data.length) } }, res => { res.resume(); res.once("end", () => resolve(res.statusCode ?? 0)); }); req.on("error", reject); req.write(data.subarray(0, half)); });
    await new Promise<void>(resolve => setTimeout(resolve, 40)); const stopping = stop(); req.end(data.subarray(half));
    const status = await response; await stopping; assert.ok(status >= 400); assert.deepEqual(wires, []);
}));
test("F15a-W10 client cancellation never forwards and leaves public broker health available", async () => fixture(async (url, wires) => {
    await new Promise<void>(resolve => { const req = request(url + ROUTE, { method: "POST", headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json", "content-length": "500" } }); req.on("error", () => undefined); req.once("close", resolve); req.write('{"messages":['); setTimeout(() => req.destroy(), 20); });
    assert.equal((await fetch(url + "/health")).status, 200); assert.deepEqual(wires, []);
}));
