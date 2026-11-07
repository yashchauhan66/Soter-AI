import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

// TEST FIRST: pure synthetic launcher/pin text, no shell or child execution.
const generation = "a1234567-1234-4567-8123-123456789abc";
const publicKey = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
const pin = { version: 1, root: "C:\\Synthetic Repo", generation, publicKey,
    worker: "C:\\Synthetic Extension\\pre-commit-client.js", workerSha256: "a".repeat(64),
    runtime: "C:\\Synthetic Code\\Code.exe", runtimeSha256: "b".repeat(64),
    descriptor: "C:\\Synthetic Profile\\pre-commit-endpoint.json", systemRoot: "C:\\Windows" };
const raw = (value: unknown = pin) => Buffer.from(JSON.stringify(value));
async function implementation() {
    const api = await import("../history-hooks/PreCommitHookText");
    assert.equal(typeof api.parseHookClientPin, "function"); assert.equal(typeof api.buildPreCommitHookText, "function"); return api;
}
test("F26a launcher pin is canonical frozen public metadata without filesystem authority", async () => {
    const api = await implementation(), value = api.parseHookClientPin(raw()); assert.deepEqual(value, pin); assert(Object.isFrozen(value));
});
test("F26a launcher creates fixed scrubbed absolute child invocation for an absent hook", async () => {
    const api = await implementation(), value = api.buildPreCommitHookText(undefined, raw()); assert(Buffer.isBuffer(value));
    const text = value.toString("utf8"); assert(text.startsWith("#!/bin/sh\n"));
    assert(text.includes("'C:/Program Files/Git/usr/bin/env.exe' -i"));
    assert(text.includes("'ELECTRON_RUN_AS_NODE=1'") && text.includes("'SystemRoot=C:\\Windows'"));
    assert(text.includes("'C:/Synthetic Code/Code.exe' 'C:/Synthetic Extension/pre-commit-client.js'"));
    assert(text.includes('"${GIT_INDEX_FILE-.git/index}"')); assert(text.includes(raw().toString("base64url")));
    assert(!/NODE_OPTIONS|NODE_PATH|PATH=|\$\(|`/.test(text)); assert(text.endsWith("exit 0\n"));
});
test("F26a launcher preserves supported original bytes after its unchanged shebang", async () => {
    const api = await implementation(), before = Buffer.from('#!/bin/sh\n# synthetic original\nprintf "%s\\n" "$@"\nexit 7\n');
    const after = api.buildPreCommitHookText(before, raw()); assert(Buffer.isBuffer(after));
    assert(after.subarray(after.length - before.length + 10).equals(before.subarray(10)));
    assert(after.toString().indexOf('printf "%s\\n" "$@"') === after.toString().lastIndexOf('printf "%s\\n" "$@"'));
    assert(after.toString().endsWith("exit 7\n")); assert(before.equals(Buffer.from('#!/bin/sh\n# synthetic original\nprintf "%s\\n" "$@"\nexit 7\n')));
});
test("F26a launcher safely quotes literal shell metacharacters in fixed reviewed paths", async () => {
    const api = await implementation(), changed = { ...pin, worker: "C:\\Owner's $(literal) `name`\\pre-commit-client.js" };
    const after = api.buildPreCommitHookText(undefined, raw(changed)); assert(Buffer.isBuffer(after));
    assert(after.toString().includes("'C:/Owner'\"'\"'s $(literal) `name`/pre-commit-client.js'"));
});
test("F26a launcher refuses unsupported interpreters CRLF BOM empty and binary originals", async () => {
    const api = await implementation();
    for (const before of [Buffer.alloc(0), Buffer.from("#!/bin/bash\nexit 0\n"), Buffer.from("#!/bin/sh -e\nexit 0\n"),
        Buffer.from("#!/usr/bin/env sh\n"), Buffer.from("#!/bin/sh\r\n"), Buffer.from("\uFEFF#!/bin/sh\n"),
        Buffer.from("#!/bin/sh\n\0"), Buffer.concat([Buffer.from("#!/bin/sh\n"), Buffer.from([0xff])])])
        assert.equal(api.buildPreCommitHookText(before, raw()), undefined);
});
test("F26a launcher refuses oversize and duplicate owned hook bodies rather than chaining itself", async () => {
    const api = await implementation(); assert.equal(api.buildPreCommitHookText(Buffer.from("#!/bin/sh\n"+"#".repeat(65536)), raw()), undefined);
    const once = api.buildPreCommitHookText(undefined, raw()); assert(Buffer.isBuffer(once));
    assert.equal(api.buildPreCommitHookText(once, raw()), undefined);
});
test("F26a launcher pins root generation and both artifact hashes with exact schemas", async () => {
    const api = await implementation();
    for (const change of [{version:2},{generation:"not-a-generation"},{workerSha256:"A".repeat(64)},{runtimeSha256:"short"},{unexpected:true},
        {root:"relative"},{root:"C:\\Synthetic Repo\\..\\Other"},{root:"\\\\server\\share"},{root:"C:\\Synthetic\nRepo"}])
        assert.equal(api.parseHookClientPin(raw({...pin,...change})),undefined);
    const missing = {...pin} as Record<string,unknown>; delete missing.publicKey; assert.equal(api.parseHookClientPin(raw(missing)),undefined);
});
test("F26a launcher refuses noncanonical JSON duplicates and malformed UTF8", async () => {
    const api = await implementation(), good = raw();
    for (const bytes of [Buffer.concat([Buffer.from("\uFEFF"),good]),Buffer.from(good.toString()+"\n"),Buffer.from('{"version":1,'+good.toString().slice(1)),
        Buffer.from("{}"), Buffer.from([0xff]), Buffer.alloc(12289,32)]) assert.equal(api.parseHookClientPin(bytes),undefined);
});
test("F26a launcher accepts only a canonical Ed25519 public key", async () => {
    const api = await implementation(), rsa = generateKeyPairSync("rsa",{modulusLength:1024}).publicKey.export({format:"der",type:"spki"}).toString("base64");
    for(const value of ["private",publicKey+"\n",publicKey.replace(/=+$/,""),rsa,""]) assert.equal(api.parseHookClientPin(raw({...pin,publicKey:value})),undefined);
});
test("F26a launcher refuses unsafe or noncanonical runtime worker descriptor and Windows paths", async () => {
    const api = await implementation();
    for(const field of ["runtime","worker","descriptor","systemRoot"]) for(const value of ["relative","C:relative","\\\\server\\share","C:\\safe\\..\\escape","C:\\unsafe\\file.","C:\\safe\\NUL.txt","C:\\safe\\x\u202e.js"])
        assert.equal(api.parseHookClientPin(raw({...pin,[field]:value})),undefined);
});
test("F26a launcher preserves caller buffers and does not invoke proxy or coercion inputs", async () => {
    const api = await implementation(), bytes = raw(), before = Buffer.from(bytes); let traps=0;
    const proxy = new Proxy({}, {get(){traps++;throw Error("Synthetic coercion forbidden");}});
    for(const value of [null,undefined,{},proxy,new Uint8Array(bytes),bytes.toString()]) assert.equal(api.parseHookClientPin(value as never),undefined);
    assert.equal(api.buildPreCommitHookText(proxy as never,bytes),undefined); assert.equal(traps,0); assert(bytes.equals(before));
});
test("F26a launcher rejects malformed pin without returning an original or partial prefix", async () => {
    const api = await implementation(), before = Buffer.from("#!/bin/sh\nexit 7\n");
    assert.equal(api.buildPreCommitHookText(before,Buffer.from("{}")),undefined); assert(before.equals(Buffer.from("#!/bin/sh\nexit 7\n")));
});
