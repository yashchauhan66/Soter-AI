import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
const ticket = () => import("../agent/SealedBridgeTicket");
const connection = { endpoint: "http://127.0.0.1:12345/safe-read", token: "a".repeat(64), session: "f18abcde-1234-4123-8123-0123456789ab" };
function transform() {
    const key = randomBytes(32);
    return async (mode: "seal" | "open", input: Buffer): Promise<Buffer> => {
        if (mode === "seal") { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv), body = Buffer.concat([cipher.update(input), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]); }
        const decipher = createDecipheriv("aes-256-gcm", key, input.subarray(0, 12)); decipher.setAuthTag(input.subarray(12, 28)); return Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]);
    };
}
test("F18 sealed ticket round trip encrypts all private connection material", async () => {
    const { sealBridgeConnection, openBridgeTicket } = await ticket(), crypto = transform();
    const sealed = await sealBridgeConnection(connection, crypto); assert.ok(Buffer.isBuffer(sealed));
    assert.ok(!sealed!.includes(Buffer.from(connection.token))); assert.ok(!sealed!.includes(Buffer.from(connection.session))); assert.ok(!sealed!.includes(Buffer.from(connection.endpoint)));
    assert.deepEqual(await openBridgeTicket(sealed!, crypto), connection);
});
test("F18 corrupted ticket/wrong user key returns unavailable without private exceptions", async () => {
    const { sealBridgeConnection, openBridgeTicket } = await ticket(), crypto = transform(); const sealed = (await sealBridgeConnection(connection, crypto))!;
    const changed = Buffer.from(sealed); changed[changed.length - 3] ^= 1;
    assert.equal(await openBridgeTicket(changed, crypto), undefined); assert.equal(await openBridgeTicket(sealed, transform()), undefined);
});
test("F18 malformed, oversized and unknown ticket versions never call the decryptor", async () => {
    let calls = 0; const { openBridgeTicket } = await ticket();
    for (const value of [Buffer.alloc(0), Buffer.from("plain private connection"), Buffer.from("STF18v2:AAAA"), Buffer.alloc(16385, 65)]) assert.equal(await openBridgeTicket(value, async () => { calls++; return Buffer.alloc(0); }), undefined);
    assert.equal(calls, 0);
});
test("F18 decrypted connection schema refuses nonloopback, unknown fields and stale-format payloads", async () => {
    const { sealBridgeConnection, openBridgeTicket } = await ticket();
    assert.equal(await sealBridgeConnection({ ...connection, endpoint: "https://outside.invalid/safe-read" }, transform()), undefined);
    const valid = (await sealBridgeConnection(connection, transform()))!;
    for (const data of [{ version: 2, connection }, { version: 1, connection: { ...connection, raw: true } }, { version: 1, connection: { ...connection, endpoint: "https://outside.invalid/safe-read" } }, { version: 1, connection, approved: true }]) assert.equal(await openBridgeTicket(valid, async () => Buffer.from(JSON.stringify(data))), undefined);
});
test("F18 OS protection outage produces no ticket or echoed source capability", async () => {
    const { sealBridgeConnection, openBridgeTicket } = await ticket(); const fail = async () => { throw Error(connection.token); };
    assert.equal(await sealBridgeConnection(connection, fail), undefined); assert.equal(await openBridgeTicket(Buffer.from("STF18v1:YWJj"), fail), undefined);
});
test("F18 actual Windows CurrentUser DPAPI private pipe round trip", { skip: process.platform !== "win32", timeout: 15000 }, async () => {
    const { sealBridgeConnection, openBridgeTicket } = await ticket(); const sealed = await sealBridgeConnection(connection); assert.ok(sealed); assert.deepEqual(await openBridgeTicket(sealed!), connection);
});
