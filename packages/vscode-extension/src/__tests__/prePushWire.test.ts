import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

// F26b test-first signed metadata protocol. In-memory synthetic keys only.
const first = generateKeyPairSync("ed25519"), other = generateKeyPairSync("ed25519");
const publicKey = first.publicKey.export({ format: "der", type: "spki" }).toString("base64");
const otherKey = other.publicKey.export({ format: "der", type: "spki" }).toString("base64");
const generation = "10000000-0000-4000-8000-000000000026", session = "20000000-0000-4000-8000-000000000026";
const nonce = "30000000-0000-4000-8000-000000000026", root = "C:\\synthetic-f26b-workspace";
const descriptor = { version: 1, root, generation, session, endpoint: "http://127.0.0.1:49123/pre-push",
    workerSha256: "a".repeat(64), runtimeSha256: "b".repeat(64) };
const descriptorBinding = { root, generation, workerSha256: descriptor.workerSha256, runtimeSha256: descriptor.runtimeSha256 };
const decision = { version: 1, root, generation, session, nonce, status: "ALLOW", transcriptSha256: "c".repeat(64), rootIdentity: "d".repeat(64) };
const decisionBinding = { root, generation, session, nonce };
const request = { version: 1, generation, session, nonce, transcript: Buffer.from("HEAD "+"1".repeat(40)+" refs/heads/main "+"0".repeat(40)+"\n").toString("base64url") };
const api = () => import("../history-hooks/PrePushWire");
const raw = (value: unknown) => Buffer.from(JSON.stringify(value));
function unavailable(value: unknown): void { assert.equal(value, undefined); }

test("F26b wire signs and verifies an exact owner descriptor", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey);
    assert(Buffer.isBuffer(signed)); assert.deepEqual(p.verifyHookDescriptor(signed!, publicKey, descriptorBinding), descriptor);
});
test("F26b wire descriptor signature requires the reviewed public key", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey)!;
    unavailable(p.verifyHookDescriptor(signed, otherKey, descriptorBinding));
});
test("F26b wire refuses changed descriptor fields without a fresh signature", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey)!;
    const parsed = JSON.parse(signed.toString()); parsed.payload.endpoint = "http://127.0.0.1:49124/pre-push";
    unavailable(p.verifyHookDescriptor(raw(parsed), publicKey, descriptorBinding));
});
test("F26b wire descriptor cannot select root installation worker or runtime", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey)!;
    for (const changed of [{ root: "C:\\another-synthetic-root" }, { generation: nonce }, { workerSha256: "e".repeat(64) }, { runtimeSha256: "e".repeat(64) }])
        unavailable(p.verifyHookDescriptor(signed, publicKey, { ...descriptorBinding, ...changed }));
});
test("F26b wire descriptors admit only exact loopback fixed-route URLs", async () => {
    const p = await api();
    for (const endpoint of ["http://localhost:49123/pre-push", "http://127.0.0.2:49123/pre-push", "https://127.0.0.1:49123/pre-push",
        "http://127.0.0.1:49123/other", "http://127.0.0.1:49123/pre-push?x=1", "http://127.0.0.1:49123/pre-push#x",
        "http://user@127.0.0.1:49123/pre-push", "http://127.0.0.1:0/pre-push", "http://127.0.0.1/pre-push"])
        unavailable(p.signHookDescriptor({ ...descriptor, endpoint }, first.privateKey));
});
test("F26b wire refuses malformed non-Ed25519 and noncanonical public keys", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey)!;
    const rsa = generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey.export({ format: "der", type: "spki" }).toString("base64");
    for (const key of ["", "not-a-key", rsa, publicKey + "\n", " " + publicKey]) unavailable(p.verifyHookDescriptor(signed, key, descriptorBinding));
});
test("F26b wire descriptor and decision signatures have different domains", async () => {
    const p = await api(), signed = p.signHookDescriptor(descriptor, first.privateKey)!;
    unavailable(p.verifyHookDecision(signed, publicKey, decisionBinding));
    unavailable(p.verifyHookDescriptor(p.signHookDecision(decision, first.privateKey)!, publicKey, descriptorBinding));
});
test("F26b wire signs and verifies each fixed decision status", async () => {
    const p = await api();
    for (const status of ["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"]) {
        const value = { ...decision, status }, signed = p.signHookDecision(value, first.privateKey)!;
        assert.deepEqual(p.verifyHookDecision(signed, publicKey, decisionBinding), value);
    }
});
test("F26b wire requires exact fresh nonce session root and generation", async () => {
    const p = await api(), signed = p.signHookDecision(decision, first.privateKey)!;
    for (const changed of [{ nonce: session }, { session: nonce }, { generation: nonce }, { root: "C:\\other" }])
        unavailable(p.verifyHookDecision(signed, publicKey, { ...decisionBinding, ...changed }));
});
test("F26b wire changed decision or index metadata cannot preserve a valid signature", async () => {
    const p = await api(), signed = p.signHookDecision(decision, first.privateKey)!;
    for (const changed of [{ status: "BLOCK" }, { transcriptSha256: "e".repeat(64) }, { rootIdentity: "e".repeat(64) }]) {
        const parsed = JSON.parse(signed.toString()); Object.assign(parsed.payload, changed);
        unavailable(p.verifyHookDecision(raw(parsed), publicKey, decisionBinding));
    }
});
test("F26b wire signed envelope is finite canonical JSON with no duplicate fields", async () => {
    const p = await api(), signed = p.signHookDecision(decision, first.privateKey)!;
    for (const input of [Buffer.concat([Buffer.from(" "), signed]), Buffer.concat([signed, Buffer.from("\n")]),
        Buffer.from(signed.toString().replace('"version":1', '"version":0,"version":1')),
        Buffer.from(signed.toString().replace('"status":"ALLOW"', '"status":"BLOCK","status":"ALLOW"')),
        Buffer.alloc(8193, 0x61), Buffer.from([0xff]), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), signed])])
        unavailable(p.verifyHookDecision(input, publicKey, decisionBinding));
});
test("F26b wire unknown envelope payload and binding fields refuse", async () => {
    const p = await api(); unavailable(p.signHookDecision({ ...decision, raw: "TEST_ONLY_PRIVATE" }, first.privateKey));
    unavailable(p.signHookDescriptor({ ...descriptor, approved: true }, first.privateKey));
    const signed = p.signHookDecision(decision, first.privateKey)!;
    const parsed = JSON.parse(signed.toString()); parsed.approved = true;
    unavailable(p.verifyHookDecision(raw(parsed), publicKey, decisionBinding));
    unavailable(p.verifyHookDecision(signed, publicKey, { ...decisionBinding, approved: true }));
});
test("F26b wire invalid schema versions status UUIDs and digests refuse", async () => {
    const p = await api();
    for (const changed of [{ version: 2 }, { version: "1" }, { status: "CLEAN" }, { nonce: "caller" }, { session: "caller" },
        { generation: "caller" }, { transcriptSha256: "c".repeat(63) }, { rootIdentity: "D".repeat(64) }])
        unavailable(p.signHookDecision({ ...decision, ...changed }, first.privateKey));
});
test("F26b wire refuses accessor and coercion payloads without reading their values", async () => {
    const p = await api(); let calls = 0;
    const forged = { ...decision }; Object.defineProperty(forged, "status", { enumerable: true, get() { calls++; throw Error("TEST_ONLY_PRIVATE"); } });
    unavailable(p.signHookDecision(forged, first.privateKey));
    unavailable(p.signHookDecision(new Proxy(decision, { get() { calls++; throw Error("TEST_ONLY_PRIVATE"); } }), first.privateKey));
    assert.equal(calls, 0);
});
test("F26b wire non-buffer and forged-buffer frames refuse without input traps", async () => {
    const p = await api(); let calls = 0;
    const forged = Object.create(Buffer.prototype); Object.defineProperty(forged, "length", { get() { calls++; throw Error("TEST_ONLY_PRIVATE"); } });
    for (const frame of [undefined, null, "{}", {}, forged, new Proxy(Buffer.from("{}"), { get() { calls++; throw Error("TEST_ONLY_PRIVATE"); } })])
        unavailable(p.verifyHookDecision(frame, publicKey, decisionBinding));
    assert.equal(calls, 0);
});
test("F26b request binds a complete canonical transcript including empty deletion-free input",async()=>{const p=await api();assert.deepEqual(p.parseHookRequest(raw(request),{generation,session}),request);const empty={...request,transcript:""};assert.deepEqual(p.parseHookRequest(raw(empty),{generation,session}),empty);});
test("F26b request refuses malformed base64url, malformed transcript and excess raw bytes",async()=>{const p=await api();for(const transcript of ["=", "a", Buffer.from("bad").toString("base64url"), Buffer.alloc(32769,65).toString("base64url")])unavailable(p.parseHookRequest(raw({...request,transcript}),{generation,session}));});
test("F26b request rejects session generation nonce root and approval overrides",async()=>{const p=await api();for(const patch of [{session:nonce},{generation:nonce},{nonce:"bad"},{root},{approved:true},{indexFile:".git/index"}])unavailable(p.parseHookRequest(raw({...request,...patch}),{generation,session}));});
test("F26b request requires canonical finite framing and exact fields",async()=>{const p=await api(),valid=raw(request);for(const frame of [Buffer.concat([valid,Buffer.from(" ")]),Buffer.from(valid.toString().replace('"version":1','"version":0,"version":1')),Buffer.alloc(49153,65),Buffer.from([255])])unavailable(p.parseHookRequest(frame,{generation,session}));});
test("F26b signatures cannot be adopted from the separate pre-commit domain",async()=>{const p=await api(),prior=await import("../history-hooks/PreCommitWire");const old=prior.signHookDescriptor({...descriptor,endpoint:"http://127.0.0.1:49123/pre-commit"},first.privateKey)!;unavailable(p.verifyHookDescriptor(old,publicKey,descriptorBinding));});
