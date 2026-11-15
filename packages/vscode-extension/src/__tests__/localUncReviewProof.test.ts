import "./phase2/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { localUncMetadata, UNC_REVIEW_ROOT, UNC_REVIEW_LOCAL, UNC_REVIEW_PATH } from "./localUncReviewFixture";
import * as stub from "./phase2/vscode-stub";
import { captureLocalUncReviewProof, localUncReviewFingerprint } from "../lifecycle/LocalUncReviewProof";

test("UNC-P01 proof requires two actual internal metadata rounds and retains exact original URI", t => {
    const f = localUncMetadata(t), proof = captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 7);
    assert(proof); assert(Object.isFrozen(proof)); assert.deepEqual(Object.keys(proof), []);
    assert.match(localUncReviewFingerprint(proof, UNC_REVIEW_ROOT, 7)!, /^[a-f0-9]{64}$/);
    for (const root of [UNC_REVIEW_LOCAL, UNC_REVIEW_PATH]) {
        assert.equal(f.state.reads.filter(file => file === root).length, 4);
        assert.equal(f.state.realpaths.filter(file => file === root).length, 2);
        assert.equal(f.state.handleReads.filter(file => file === root).length, 2);
    }
    assert.deepEqual(f.state.closes, f.state.opens);
    assert.equal(localUncReviewFingerprint(proof, "file:///D:/Synthetic-UNC-Review/workspace", 7), undefined);
    assert.equal(localUncReviewFingerprint(proof, UNC_REVIEW_ROOT, 8), undefined);
});

test("UNC-P02 hosts shares traversal streams device names aliases and malformed URI paths refuse before reads", t => {
    const f = localUncMetadata(t);
    for (const root of [
        "file://server/D$/work", "file://LOCALHOST/D$/work", "file://127.0.0.1/D$/work", "file://localhost./D$/work",
        "file://localhost/d$/work", "file://localhost/share/work", "file://localhost/D$/", "file://localhost/D$/a//b",
        "file://localhost/D$/a/../b", "file://localhost/D$/a/./b", "file://localhost/D$/a:stream", "file://localhost/D$/NUL.txt",
        "file://localhost/D$/COM1", "file://localhost/D$/a.", "file://localhost/D$/a ", "file://localhost/D$/SHORT~1",
        "file://localhost/D$/%2e%2e/b", "file://localhost/D$/a%2Fb", "file://localhost/D$/a\\b", "file://localhost/D$/a\u0000b",
    ]) assert.equal(captureLocalUncReviewProof(stub.Uri.parse(root) as unknown as vscode.Uri, 1), undefined, root);
    for (const field of ["query", "fragment"] as const) {
        const uri = f.uri(); Object.defineProperty(uri, field, { value: "unexpected" });
        assert.equal(captureLocalUncReviewProof(uri as unknown as vscode.Uri, 1), undefined);
    }
    assert.equal(f.state.reads.length, 0);
});

test("UNC-P03 URI proxies getters impostors and supplied proof metadata confer no authority", t => {
    const f = localUncMetadata(t); let touched = 0;
    const proxy = new Proxy(f.uri(), { get() { touched++; throw Error(); }, getPrototypeOf() { touched++; throw Error(); } });
    const getter = f.uri(); Object.defineProperty(getter, "authority", { get() { touched++; throw Error(); } });
    for (const uri of [proxy, getter, { scheme: "file", authority: "localhost", path: f.uri().path, fsPath: UNC_REVIEW_PATH }])
        assert.equal(captureLocalUncReviewProof(uri as unknown as vscode.Uri, 1), undefined);
    const forged = Object.create(null); Object.defineProperty(forged, "fingerprint", { get() { touched++; throw Error(); } });
    for (const token of [forged, { root: UNC_REVIEW_ROOT, dev: 37n, ino: 100n }, new Proxy(forged, { get() { touched++; throw Error(); } })])
        assert.equal(localUncReviewFingerprint(token, UNC_REVIEW_ROOT, 1), undefined);
    assert.equal(touched, 0); assert.equal(f.state.reads.length, 0);
});

test("UNC-P04 zero missing non-bigint and mismatched identity metadata never mint proof", t => {
    const f = localUncMetadata(t);
    for (const field of ["dev", "ino", "birthtimeNs"] as const) {
        for (const value of [0n, -1n, undefined, 1]) {
            f.state.changeHandleStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, [field]: value } : stat;
            assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
        }
        f.state.changeHandleStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, [field]: stat[field] + 1n } : stat;
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    }
});

test("UNC-P05 unreadable metadata links junction ancestry canonical drive aliases and two-read swaps refuse", t => {
    const f = localUncMetadata(t);
    f.state.beforeRead = () => { throw Error("unavailable"); };
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    f.state.beforeRead = () => undefined;
    f.state.reads.length = 0;
    f.state.beforeRead = (file, count) => { if (file === UNC_REVIEW_PATH && count === 3) throw Error("second observation unavailable"); };
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    f.state.beforeRead = () => undefined;
    for (const parent of ["D:\\", "D:\\Synthetic-UNC-Review", "\\\\localhost\\D$\\", "\\\\localhost\\D$\\Synthetic-UNC-Review"]) {
        f.state.changeStat = (file, stat) => file === parent ? { ...stat, isSymbolicLink: () => true } : stat;
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined, parent);
    }
    f.state.changeStat = (_file, stat) => stat;
    f.state.canonical = file => file.replace(/^D:/, "C:");
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    f.state.canonical = file => file;
    f.state.reads.length = 0;
    f.state.beforeRead = (file, count) => { if (file === UNC_REVIEW_PATH && count === 3) f.state.generation++; };
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
});

test("UNC-P06 the proof is bound to actual Electron Windows runtime and identity refresh", t => {
    const f = localUncMetadata(t), uri = f.uri() as unknown as vscode.Uri;
    const first = captureLocalUncReviewProof(uri, 1); assert(first);
    f.state.generation++;
    const second = captureLocalUncReviewProof(uri, 1); assert(second);
    assert.notEqual(localUncReviewFingerprint(first, UNC_REVIEW_ROOT, 1), localUncReviewFingerprint(second, UNC_REVIEW_ROOT, 1));
    delete (process.versions as { electron?: string }).electron;
    assert.equal(localUncReviewFingerprint(first, UNC_REVIEW_ROOT, 1), undefined);
    assert.equal(captureLocalUncReviewProof(uri, 1), undefined);
});

test("UNC-P07 official cached factory prototypes work while caller subclasses and inherited getters refuse", t => {
    const f = localUncMetadata(t), originalParse = stub.Uri.parse.bind(stub.Uri);
    const cachedPrototype = Object.create(stub.Uri.prototype);
    t.mock.method(stub.Uri, "parse", (value: string) => Object.setPrototypeOf(originalParse(value), cachedPrototype));
    const genuine = f.uri(); assert(genuine instanceof stub.Uri); assert.notEqual(Object.getPrototypeOf(genuine), stub.Uri.prototype);
    assert(captureLocalUncReviewProof(genuine as unknown as vscode.Uri, 1));
    let touched = 0;
    const malicious = f.uri(); Object.setPrototypeOf(malicious, Object.create(cachedPrototype, {
        fsPath: { get() { touched++; throw Error(); } },
    }));
    assert.equal(captureLocalUncReviewProof(malicious as unknown as vscode.Uri, 1), undefined);
    assert.equal(touched, 0);
});

test("UNC-P08 Windows path device zero still requires a real positive matching read-only handle volume serial", t => {
    const f = localUncMetadata(t);
    // Fixture reproduces fresh Windows Node observations: lstat.dev=0, fstat.dev>0.
    const proof = captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1);
    assert(proof, "positive volume serial must come from actual read-only handle metadata");
    assert(f.state.handleReads.includes("D:\\")); assert(f.state.handleReads.includes("\\\\localhost\\D$\\"));
    assert.deepEqual(f.state.closes, f.state.opens);
    f.state.changeHandleStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, dev: 0n } : stat;
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    f.state.changeHandleStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, dev: 38n } : stat;
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
});

test("UNC-P09 unavailable open handle metadata or close refuses and releases every acquired handle", t => {
    const f = localUncMetadata(t);
    for (const stage of ["beforeOpen", "beforeFstat", "beforeClose"] as const) {
        const opens = f.state.opens.length, closes = f.state.closes.length;
        f.state[stage] = file => { if (file === UNC_REVIEW_PATH) throw Error("metadata unavailable"); };
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined, stage);
        assert(f.state.opens.length > opens, "must reach the tested metadata failure");
        assert.equal(f.state.closes.length - closes, f.state.opens.length - opens - (stage === "beforeOpen" ? 1 : 0));
        f.state[stage] = () => undefined;
    }
});

test("UNC-P10 surrounding path observations must match the opened directory inode birth and type", t => {
    const f = localUncMetadata(t);
    for (const field of ["ino", "birthtimeNs"] as const) {
        f.state.changeStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, [field]: stat[field] + 1n } : stat;
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined, field);
    }
    f.state.changeStat = (_file, stat) => stat;
    for (const override of [{ isDirectory: () => false }, { isSymbolicLink: () => true }]) {
        f.state.changeHandleStat = (file, stat) => file === UNC_REVIEW_PATH ? { ...stat, ...override } : stat;
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    }
    assert.deepEqual(f.state.closes, f.state.opens);
});

test("UNC-P11 swaps before open while the handle is read or before the final path stat refuse", t => {
    const f = localUncMetadata(t);
    for (const stage of ["beforeOpen", "beforeFstat"] as const) {
        f.state[stage] = file => { if (file === UNC_REVIEW_PATH) f.state.generation++; };
        assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined, stage);
        f.state[stage] = () => undefined;
    }
    f.state.beforeRead = (file, count) => { if (file === UNC_REVIEW_PATH && count % 2 === 0) f.state.generation++; };
    assert.equal(captureLocalUncReviewProof(f.uri() as unknown as vscode.Uri, 1), undefined);
    assert.deepEqual(f.state.closes, f.state.opens);
});
