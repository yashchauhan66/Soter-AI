import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { OwnedBrokerLifecycle } from "../broker/OwnedBrokerLifecycle";

// Synthetic private IPC/HTTP test adapter. No child execution or PID signals.
function fixture(options: { ready?: (session: string) => unknown; stop?: boolean; initialize?: () => Promise<void>; prepare?: () => Promise<NodeJS.ProcessEnv>; startupMs?: number; fetchImpl?: typeof fetch } = {}) {
    let enabled = true, fingerprint = "policy-A", launches = 0, wireCalls = 0;
    const children: Array<EventEmitter & { stdout: PassThrough; stderr: PassThrough; connected: boolean; send: (message: unknown, callback?: (error: Error | null) => void) => boolean }> = [];
    const envs: NodeJS.ProcessEnv[] = [], messages: unknown[] = [], headers: Headers[] = [];
    const lifecycle = new OwnedBrokerLifecycle({ script: "/synthetic/broker.js", enabled: () => enabled, fingerprint: () => fingerprint,
        prepare: options.prepare ?? (async () => ({})), initialize: options.initialize ?? (async () => undefined), startupMs: options.startupMs ?? 40, stopMs: 12,
        launch: ((_executable: string, argv: readonly string[], opts: { env: NodeJS.ProcessEnv }) => {
            launches++; envs.push(opts.env); assert.deepEqual(argv, ["/synthetic/broker.js"]);
            const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), connected: true,
                send(message: unknown, callback?: (error: Error | null) => void) { messages.push(message); callback?.(null); if (options.stop !== false) setImmediate(() => finish(child)); return true; },
                kill() { assert.fail("Process signaling is prohibited."); },
            }); children.push(child);
            setImmediate(() => child.emit("message", options.ready ? options.ready(opts.env.SOTERAI_BROKER_SESSION!) : { type: "SOTERAI_BROKER_READY", version: 1, session: opts.env.SOTERAI_BROKER_SESSION, port: 49152 }));
            return child;
        }) as never,
        fetchImpl: options.fetchImpl ?? (async (_url, init) => {
            wireCalls++; const current = new Headers(init?.headers); headers.push(current);
            return Response.json({ session: current.get("x-soterai-session"), version: "0.2.0", ready: true });
        }),
    });
    return { lifecycle, children, envs, messages, headers, get launches() { return launches; }, get wireCalls() { return wireCalls; },
        disable() { enabled = false; }, drift() { fingerprint = "policy-B"; },
    };
}
function finish(child: EventEmitter & { stdout: PassThrough; stderr: PassThrough }): void { child.stdout.end(); child.stderr.end(); child.emit("close", 0, null); }
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("F14-L01 port0 and distinct private credentials never enter argv or snapshots", async () => {
    const f = fixture(); await f.lifecycle.start(); const env = f.envs[0]; assert.equal(env.SOTERAI_BROKER_PORT, "0");
    assert.ok(env.SOTERAI_BROKER_TOKEN!.length >= 32); assert.ok(env.SOTERAI_BROKER_CONTROL_TOKEN!.length >= 32); assert.notEqual(env.SOTERAI_BROKER_TOKEN, env.SOTERAI_BROKER_CONTROL_TOKEN);
    const json = JSON.stringify(f.lifecycle.snapshot()); assert.ok(!json.includes(env.SOTERAI_BROKER_TOKEN!)); assert.ok(!json.includes(env.SOTERAI_BROKER_CONTROL_TOKEN!)); await f.lifecycle.stop();
});
test("F14-L02 simultaneous start calls own one launch", async () => { const f = fixture(); await Promise.all([f.lifecycle.start(), f.lifecycle.start(), f.lifecycle.start()]); assert.equal(f.launches, 1); await f.lifecycle.stop(); });
test("F14-L03 independent window instances never reuse credentials or sessions", async () => { const a = fixture(), b = fixture(); await Promise.all([a.lifecycle.start(), b.lifecycle.start()]); for (const key of ["SOTERAI_BROKER_SESSION", "SOTERAI_BROKER_TOKEN", "SOTERAI_BROKER_CONTROL_TOKEN"]) assert.notEqual(a.envs[0][key], b.envs[0][key]); await Promise.all([a.lifecycle.stop(), b.lifecycle.stop()]); });
test("F14-L04 no port probe or shared token attachment before private ready", async () => { const f = fixture({ ready: () => null }); const run = f.lifecycle.start(); assert.equal(f.wireCalls, 0); await assert.rejects(run); assert.equal(f.wireCalls, 0); await f.lifecycle.stop(); });
for (const [name, value] of [["missing", null], ["array", []], ["wrong type", { type: "ready" }], ["wrong session", { type: "SOTERAI_BROKER_READY", version: 1, session: "wrong", port: 49152 }], ["unknown version", { type: "SOTERAI_BROKER_READY", version: 2, port: 49152 }], ["port zero", 0], ["port overflow", 65536], ["port string", "49152"], ["port float", 2.5], ["extra secret field", { token: "synthetic-untrusted-token" }]] as const) {
    test(`F14-L05 malformed READY ${name} withholds readiness`, async () => { const f = fixture({ ready: session => typeof value === "number" || typeof value === "string" ? { type: "SOTERAI_BROKER_READY", version: 1, session, port: value } : value }); await assert.rejects(f.lifecycle.start()); assert.equal(f.lifecycle.snapshot().state === "healthy", false); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
}
test("F14-L06 lifecycle identity uses separate controller token and exact session header", async () => { const f = fixture(); await f.lifecycle.start(); assert.equal(f.headers[0].get("authorization"), "Bearer " + f.envs[0].SOTERAI_BROKER_CONTROL_TOKEN); assert.equal(f.headers[0].get("x-soterai-session"), f.envs[0].SOTERAI_BROKER_SESSION); await f.lifecycle.stop(); });
test("F14-L07 initialization must complete before data credentials publish", async () => { let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); const f = fixture({ initialize: () => held }); const pending = f.lifecycle.start(); await tick(); await tick(); assert.throws(() => f.lifecycle.clientToken()); release(); await pending; assert.equal(f.lifecycle.clientToken(), f.envs[0].SOTERAI_BROKER_TOKEN); await f.lifecycle.stop(); });
test("F14-L08 initialization failure requests STOP and never publishes", async () => { const f = fixture({ initialize: async () => { throw Error("synthetic-private-value"); } }); await assert.rejects(f.lifecycle.start(), error => !String(error).includes("synthetic-private-value")); await tick(); assert.ok(f.messages.length > 0); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
test("F14-L09 disabled flag refuses before prepare or launch", async () => { const f = fixture(); f.disable(); await assert.rejects(f.lifecycle.start()); assert.equal(f.launches, 0); });
test("F14-L10 config drift refuses public requests and startup reuse", async () => { const f = fixture(); await f.lifecycle.start(); f.drift(); await assert.rejects(f.lifecycle.request("/version")); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
test("F14-L11 stop while prepare is held prevents late child launch", async () => { let release!: () => void; const held = new Promise<NodeJS.ProcessEnv>(resolve => { release = () => resolve({}); }); const f = fixture({ prepare: () => held }); const run = f.lifecycle.start(); await tick(); await f.lifecycle.stop(); release(); await assert.rejects(run); assert.equal(f.launches, 0); });
test("F14-L12 stop before READY cannot become healthy later", async () => { const f = fixture({ ready: () => null }); const run = f.lifecycle.start(); await tick(); const stop = f.lifecycle.stop(); await assert.rejects(run); await stop; assert.throws(() => f.lifecycle.clientToken()); });
test("F14-L13 unconfirmed stop retains ownership and blocks replacement", async () => { const f = fixture({ stop: false }); await f.lifecycle.start(); const result = await f.lifecycle.stop(); assert.equal(result.state, "STOP_UNCONFIRMED"); await assert.rejects(f.lifecycle.start()); assert.equal(f.launches, 1); finish(f.children[0]); await tick(); await f.lifecycle.stop(); });
test("F14-L14 exit without close and drained pipes is not release", async () => { const f = fixture({ stop: false }); await f.lifecycle.start(); f.children[0].emit("exit", 0, null); assert.equal((await f.lifecycle.stop()).state, "STOP_UNCONFIRMED"); assert.equal(f.launches, 1); finish(f.children[0]); await tick(); await f.lifecycle.stop(); });
test("F14-L15 close without both pipe EOF retains ownership", async () => { const f = fixture({ stop: false }); await f.lifecycle.start(); f.children[0].emit("close", 0, null); assert.equal((await f.lifecycle.stop()).state, "STOP_UNCONFIRMED"); f.children[0].stdout.end(); f.children[0].stderr.end(); await tick(); await f.lifecycle.stop(); });
test("F14-L16 completed restart changes session, port ownership and credentials", async () => { const f = fixture(); const first = await f.lifecycle.start(); await f.lifecycle.stop(); const next = await f.lifecycle.start(); assert.notEqual(first.session, next.session); assert.notEqual(f.envs[0].SOTERAI_BROKER_TOKEN, f.envs[1].SOTERAI_BROKER_TOKEN); assert.equal(f.launches, 2); await f.lifecycle.stop(); });
test("F14-L17 dispose prevents future starts without process signaling", async () => { const f = fixture(); await f.lifecycle.start(); await f.lifecycle.dispose(); await assert.rejects(f.lifecycle.start()); assert.throws(() => f.lifecycle.clientToken()); });
test("F14-L18 request refuses absolute URL/traversal/query/user header override", async () => { const f = fixture(); await f.lifecycle.start(); for (const route of ["https://fixture.invalid", "//fixture.invalid", "/../version", "/version?token=private"]) await assert.rejects(f.lifecycle.request(route)); await f.lifecycle.request("/version", { headers: { authorization: "Bearer wrong", "x-soterai-session": "wrong" } }); assert.equal(f.headers.at(-1)?.get("x-soterai-session"), f.envs[0].SOTERAI_BROKER_SESSION); await f.lifecycle.stop(); });
test("F14-L19 no raw child output or error text reaches state", async () => { const f = fixture(); await f.lifecycle.start(); f.children[0].stdout.write("synthetic-private-child-output"); f.children[0].stderr.write("synthetic-private-child-error"); assert.ok(!JSON.stringify(f.lifecycle.snapshot()).includes("synthetic-private")); await f.lifecycle.stop(); });
test("F14-L20 withdrawal invalidates credentials immediately", async () => { const f = fixture(); await f.lifecycle.start(); f.lifecycle.invalidate(); assert.throws(() => f.lifecycle.clientToken()); await assert.rejects(f.lifecycle.request("/version")); await f.lifecycle.stop(); });
test("F14-L21 stale child events cannot erase a newer generation", async () => { const f = fixture(); await f.lifecycle.start(); await f.lifecycle.stop(); await f.lifecycle.start(); f.children[0].emit("exit", 1); assert.equal(f.lifecycle.snapshot().state, "healthy"); await f.lifecycle.stop(); });
test("F14-L22 unexpected owned exit invalidates credentials and never adopts a listener", async () => { const f = fixture(); await f.lifecycle.start(); finish(f.children[0]); await tick(); assert.throws(() => f.lifecycle.clientToken()); await assert.rejects(f.lifecycle.request("/version")); assert.equal(f.launches, 1); });

for (const [name, body] of [["wrong session", { session: "wrong", version: "0.2.0", ready: true }], ["wrong version", { version: "99.0.0", ready: true }], ["not ready", { version: "0.2.0", ready: false }]] as const) test(`F14-L23 authenticated identity ${name} refuses startup`, async () => { const f = fixture({ fetchImpl: async (_url, init) => Response.json(Object.assign({ session: new Headers(init?.headers).get("x-soterai-session") }, body)) }); await assert.rejects(f.lifecycle.start()); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
test("F14-L24 outage invalidates owned endpoint without adopting another listener", async () => { let down = false; const f = fixture({ fetchImpl: async (_url, init) => { if (down) throw Error("synthetic-private-network-error"); return Response.json({ session: new Headers(init?.headers).get("x-soterai-session"), version: "0.2.0", ready: true }); } }); await f.lifecycle.start(); down = true; await assert.rejects(f.lifecycle.request("/version"), error => !String(error).includes("synthetic-private")); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
test("F14-L25 late response after withdrawal is withheld", async () => { let hold = false, release!: () => void; const f = fixture({ fetchImpl: async (_url, init) => { if (hold) await new Promise<void>(resolve => { release = resolve; }); return Response.json({ session: new Headers(init?.headers).get("x-soterai-session"), version: "0.2.0", ready: true }); } }); await f.lifecycle.start(); hold = true; const request = f.lifecycle.request("/version"); f.lifecycle.invalidate(); release(); await assert.rejects(request); await f.lifecycle.stop(); });
test("F14-L26 startup deadline with held initialization requests STOP and refuses late publication", async () => { let release!: () => void; const f = fixture({ startupMs: 25, initialize: () => new Promise<void>(resolve => { release = resolve; }) }); await assert.rejects(f.lifecycle.start()); release(); await tick(); assert.throws(() => f.lifecycle.clientToken()); await f.lifecycle.stop(); });
