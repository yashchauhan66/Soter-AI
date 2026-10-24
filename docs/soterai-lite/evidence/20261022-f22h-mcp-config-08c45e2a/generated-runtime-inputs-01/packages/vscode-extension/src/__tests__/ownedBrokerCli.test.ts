import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { brokerChildEnvironment } from "../security/childEnvironment";

// Actual local child + loopback only. No provider, token files, process signals or cleanup.
async function launch() {
    const session = randomUUID(), token = randomBytes(32).toString("base64url"), control = randomBytes(32).toString("base64url");
    const child = spawn(process.execPath, ["--import", "tsx", resolve(__dirname, "../../../../apps/local-ai-broker/src/cli.ts")], {
        env: { ...brokerChildEnvironment(process.env), SOTERAI_BROKER_SESSION: session, SOTERAI_BROKER_PORT: "0", SOTERAI_BROKER_TOKEN: token, SOTERAI_BROKER_CONTROL_TOKEN: control, SOTERAI_REQUIRE_CANARY_SYNC: "1" },
        windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let output = ""; child.stdout!.on("data", chunk => { if (output.length < 8192) output += String(chunk); }); child.stderr!.on("data", chunk => { if (output.length < 8192) output += String(chunk); });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    const ready = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("Owned CLI readiness deadline")), 10000);
        child.once("message", value => { clearTimeout(timer); resolve(value as Record<string, unknown>); });
        child.once("close", () => { clearTimeout(timer); reject(Error("Owned CLI exited before readiness")); });
        child.once("error", () => { clearTimeout(timer); reject(Error("Owned CLI spawn unavailable")); });
    }).catch(async error => { if (child.connected) child.disconnect(); await Promise.race([closed, new Promise(r => setTimeout(r, 2000))]); throw error; });
    assert.equal(ready.type, "SOTERAI_BROKER_READY"); assert.equal(ready.version, 1); assert.equal(ready.session, session); assert.ok(Number(ready.port) > 0);
    const url = `http://127.0.0.1:${ready.port}`;
    const request = (route: string, body?: unknown, auth = control, owner: string | undefined = session) => fetch(url + route, { method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json", ...(owner ? { "x-soterai-session": owner } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const stop = async () => { if (child.connected) child.send({ type: "SOTERAI_BROKER_STOP", version: 1, session }); await Promise.race([closed, new Promise<never>((_r, reject) => { const timer = setTimeout(() => reject(Error("STOP_UNCONFIRMED: retained child")), 4000); timer.unref(); })]); };
    return { child, session, token, control, ready, url, request, stop, closed, output: () => output };
}
test("F14-C01 real owned CLI binds atomically despite occupied legacy47321", async () => {
    const occupied = createServer(); let owned = false;
    await new Promise<void>((done, reject) => { occupied.once("error", (e: NodeJS.ErrnoException) => e.code === "EADDRINUSE" ? done() : reject(e)); occupied.listen(47321, "127.0.0.1", () => { owned = true; done(); }); });
    let child: Awaited<ReturnType<typeof launch>> | undefined;
    try { child = await launch(); assert.notEqual(child.ready.port, 47321); assert.equal((await child.request("/v1/lifecycle/status")).status, 200); }
    finally { await child?.stop(); if (owned) await new Promise<void>(done => occupied.close(() => done())); }
});
test("F14-C02 two actual windows own different bound ports and reject cross credentials", async () => {
    const a = await launch(); let b: Awaited<ReturnType<typeof launch>> | undefined;
    try { b = await launch(); assert.notEqual(a.ready.port, b.ready.port); assert.equal((await a.request("/version", undefined, b.control, b.session)).status, 401); assert.equal((await a.request("/version", undefined, a.control, b.session)).status, 403); }
    finally { await a.stop(); await b?.stop(); }
});
test("F14-C03 real initialization syncs canaries, restores strict mode, then closes without tokens in output", async () => {
    const f = await launch(); try {
        assert.equal((await f.request("/v1/canaries/sync", { canaries: [] })).status, 200);
        assert.equal((await f.request("/v1/safe-mode/enable", { level: "strict" })).status, 200);
        assert.equal(((await (await f.request("/v1/safe-mode/status")).json()) as { level: string }).level, "strict");
        assert.equal((await f.request("/v1/lifecycle/status", undefined, f.token)).status, 403);
    } finally { await f.stop(); }
    assert.ok(!f.output().includes(f.token)); assert.ok(!f.output().includes(f.control)); await assert.rejects(fetch(f.url + "/health"));
});
test("F14-C04 parent IPC disconnect exits its own real broker with drained pipes", async () => {
    const f = await launch();
    // Node22.16/Windows omits child close after parent-initiated IPC disconnect
    // (retained event diagnostic); observe actual exit and both EOFs here.
    // Production stop retains its stronger close+EOF barrier and never disconnects first.
    const exit = new Promise<void>(resolve => f.child.once("exit", code => { assert.equal(code, 0); resolve(); }));
    const out = new Promise<void>(resolve => f.child.stdout!.once("end", resolve));
    const err = new Promise<void>(resolve => f.child.stderr!.once("end", resolve));
    f.child.disconnect(); let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([Promise.all([exit, out, err]), new Promise<never>((_r, reject) => { timer = setTimeout(() => reject(Error("Disconnect completion unconfirmed")), 4000); })]); }
    finally { clearTimeout(timer); }
    await assert.rejects(fetch(f.url + "/health"));
});
