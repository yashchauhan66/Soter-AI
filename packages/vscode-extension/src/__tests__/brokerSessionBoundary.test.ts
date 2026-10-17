import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { BrokerServer } from "../../../../apps/local-ai-broker/src/BrokerServer";
const DATA = "synthetic-data-" + "d".repeat(40), CONTROL = "synthetic-control-" + "c".repeat(40);
async function fixture(run: (url: string, session: string) => Promise<void>) {
    const session = randomUUID(), server = new BrokerServer({ token: DATA, controlToken: CONTROL, port: 0, ...{ ownerSession: session } });
    const { url } = await server.start(); try { await run(url, session); } finally { await server.stop(); }
}
function request(url: string, route: string, token: string, session?: string) { return fetch(url + route, { headers: { authorization: "Bearer " + token, ...(session ? { "x-soterai-session": session } : {}) } }); }
test("F14-B01 lifecycle identity is controller authenticated and session bound", async () => fixture(async (url, session) => { const response = await request(url, "/v1/lifecycle/status", CONTROL, session); assert.equal(response.status, 200); assert.equal(((await response.json()) as { session: string }).session, session); }));
for (const [name, token, session] of [["no session", CONTROL, undefined], ["wrong session", CONTROL, randomUUID()], ["client token", DATA, undefined], ["wrong auth", "x".repeat(40), undefined]] as const) test(`F14-B02 ${name} cannot manage owned broker`, async () => fixture(async url => { const response = await request(url, "/v1/safe-mode/status", token, session); if (token === DATA) assert.equal(response.status, 200); else assert.equal(response.status, token === CONTROL ? 403 : 401); assert.ok((await request(url, "/v1/lifecycle/status", token, session)).status >= 400); }));
test("F14-B03 data credential never requires shared window state for allowed data routes", async () => fixture(async (url, session) => { assert.equal((await request(url, "/version", DATA)).status, 200); assert.equal((await request(url, "/version", CONTROL, session)).status, 200); }));
test("F14-B04 owner session is validated before any bind", async () => { for (const value of ["", "../private", "x".repeat(9000)]) assert.throws(() => new BrokerServer({ token: DATA, controlToken: CONTROL, port: 0, ...{ ownerSession: value } })); });
test("F14-B05 separate windows reject each other's session even with same synthetic controller", async () => fixture(async (url, session) => { assert.equal((await request(url, "/version", CONTROL, randomUUID())).status, 403); assert.equal((await request(url, "/version", CONTROL, session)).status, 200); }));
