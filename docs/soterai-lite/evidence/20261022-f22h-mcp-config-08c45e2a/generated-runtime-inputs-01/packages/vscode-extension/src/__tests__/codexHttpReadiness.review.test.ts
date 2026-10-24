import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from "node:http";
test("F20A-R01 rotation settles HTTP while asynchronous owner readiness remains pending", async t => {
    const { CodexHttpBridge } = await import("../adapters/CodexHttpBridge"); let release!: (value: boolean) => void, entered = false;
    const bridge = new CodexHttpBridge({ enabled: () => true, ready: async () => { entered = true; return new Promise<boolean>(r => release = r); }, read: async () => ({ status: "DENIED" }) });
    t.after(() => bridge.dispose()); const c = await bridge.start();
    const pending = new Promise<number>((resolve, reject) => { const req = request(c.endpoint, { method: "POST", agent: false, headers: { authorization: "Bearer " + c.token, "content-type": "application/json" } }, res => { res.resume(); res.on("end", () => resolve(res.statusCode!)); }); req.on("error", reject); req.end('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'); });
    for (let i = 0; i < 100 && !entered; i++) await new Promise(r => setTimeout(r, 5)); assert.equal(entered, true); bridge.rotate();
    let timer!: ReturnType<typeof setTimeout>;
    const observed = await Promise.race([pending, new Promise<"STILL_PENDING">(r => timer = setTimeout(() => r("STILL_PENDING"), 300))]);
    clearTimeout(timer); release(true); await pending; assert.equal(observed, 503);
});
