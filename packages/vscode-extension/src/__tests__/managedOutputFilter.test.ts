import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as vscode from "vscode";
import { encryptVault } from "@soterai/guard-core";
import type { OutputResult } from "../../../core/src/StreamingOutputRedactor";
import { initializeBoundaryState, BoundarySnapshot, updateRules } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";
import * as stub from "./phase2/vscode-stub";

// Synthetic encrypted in-memory-planned vaults only. No original .env/source
// file is created, opened or decrypted. Unique D: fixtures are retained; the
// harness disposes its own subscriptions/filters and restores every API mock.
const FAKE = "F10 synthetic private output value É🔐/qZ9";
const LEGACY = "F10 synthetic legacy private output value kJ7";
const OTHER = "F10 other project public control value zQ4";
const KEY = Buffer.alloc(32, 0x71).toString("base64");
const KEY_ID = "soterai.vaultKey", VAULT = "soterai-vault.enc", MASK = "[REDACTED_SECRET_OUTPUT]";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
interface Filter { available(): boolean; push(channel: "stdout" | "stderr", bytes: Uint8Array): Readonly<{ status: "BUFFERED" | "WITHHELD" }>;
    finish(code: number): OutputResult; cancel(): void; dispose(): void }
type Factory = (root: vscode.Uri, enabled: () => boolean) => Promise<Filter>;
type Entry = Record<string, string>;
let directory: string, root: string, other: string, storage: string, context: ReturnType<typeof stub.makeExtensionContext>, manager: VaultManager;
let filters: Filter[], uiCalls: number, documentCalls: number, stores: number;
let secretEvents: stub.EventEmitter<{ key: string }>, configEvents: stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>, workspaceEvents: stub.EventEmitter<unknown>;
const rootUri = () => stub.Uri.file(root) as unknown as vscode.Uri;
const rootKey = () => stub.Uri.file(root).toString();
function method(): Factory {
    const value = (manager as unknown as { createManagedOutputFilter?: Factory }).createManagedOutputFilter;
    assert.equal(typeof value, "function", "F10 must implement the private managed-output factory."); return value!.bind(manager);
}
async function factory(enabled: () => boolean = () => true, uri: vscode.Uri = rootUri()): Promise<Filter> {
    const filter = await method()(uri, enabled); filters.push(filter);
    for (const key of ["available", "push", "finish", "cancel", "dispose"] as const) assert.equal(typeof filter[key], "function");
    return filter;
}
function entry(value: string, index = 0, binding: "current" | "legacy" | "other" = "current"): Entry {
    const result: Entry = { id: `f1051000-aabb-4cc0-8dd0-${String(index).padStart(12, "0")}`, key: "SECRET_" + index,
        type: "generic", originalFile: ".env.synthetic", placeholder: `[SOTERAI_PROTECTED_A3427B3646BA4D8482E5C5DFB5BA5DD1_${index}]`,
        createdAt: "2026-10-15T00:00:00.000Z", hash: sha(value), rawValue: value };
    if (binding !== "legacy") { const folder = binding === "other" ? other : root;
        result.root = stub.Uri.file(folder).toString(); result.source = stub.Uri.file(join(folder, ".env.synthetic")).toString(); result.replacementText = "'" + value + "'"; }
    return result;
}
async function install(entries: readonly Entry[], payload?: string): Promise<string> {
    context._inspect.secretStore.set(KEY_ID, KEY);
    const cipher = await encryptVault(payload ?? JSON.stringify({ version: 2, entries }), KEY);
    await writeFile(join(storage, VAULT), cipher); return cipher;
}
async function unavailable(work: () => Promise<unknown>): Promise<void> {
    await assert.rejects(work, error => { assert.ok(!(error instanceof assert.AssertionError), "Missing-feature assertions cannot count as a safe rejection.");
        assert.equal(String(error), "Error: Protected vault operation withheld. Encrypted recovery is retained; no plaintext rollback was performed."); return true; });
}
function safeMetadata(value: unknown, cipher?: string): void {
    const text = JSON.stringify(value) ?? "";
    for (const privateValue of [FAKE, LEGACY, KEY, sha(FAKE), Buffer.from(FAKE).toString("base64"), encodeURIComponent(FAKE), ...(cipher ? [cipher] : [])])
        assert.ok(!text.includes(privateValue));
    assert.doesNotMatch(text, /"(?:values|rawValue|registrations|cipher|ciphertext|sourceContent|key|valueHash)"\s*:/);
}
function push(filter: Filter, text: string, channel: "stdout" | "stderr" = "stdout", expected = "BUFFERED"): void {
    const result = filter.push(channel, Buffer.from(text)); assert.ok(Object.isFrozen(result)); assert.equal(result.status, expected); safeMetadata(result);
}
function complete(result: OutputResult, stdout: string, stderr = "", redacted = false, exitCode = 0): void {
    assert.ok(Object.isFrozen(result)); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, stdout); assert.equal(result.stderr, stderr);
    assert.equal(result.redacted, redacted); assert.equal(result.exitCode, exitCode);
}
function withheld(result: OutputResult): void {
    assert.ok(Object.isFrozen(result)); assert.equal(result.status, "WITHHELD"); assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
    assert.equal(result.redacted, false); assert.equal(typeof result.reason, "string"); safeMetadata(result);
}
function flag(name: string, enabled: boolean): void {
    stub.state.config.set("soterai." + name, enabled); stub.state.configInspect.set("soterai." + name, { globalValue: enabled, defaultValue: true });
    configEvents.fire({ affectsConfiguration: section => section === "soterai" || section === "soterai." + name });
}
beforeEach(async () => {
    const base = process.platform === "win32" ? "D:\\SoterAI-Lite-test-profiles" : tmpdir(); await mkdir(base, { recursive: true });
    directory = await mkdtemp(join(await realpath(base), "f10-output-filter-")); root = join(directory, "project"); other = join(directory, "other-project"); storage = join(directory, "storage");
    await mkdir(root); await mkdir(other); await mkdir(storage); stub.resetState(root);
    context = stub.makeExtensionContext(directory); context.globalStorageUri = stub.Uri.file(storage);
    filters = []; uiCalls = 0; documentCalls = 0; stores = 0;
    secretEvents = new stub.EventEmitter(); configEvents = new stub.EventEmitter(); workspaceEvents = new stub.EventEmitter();
    mock.method(context.secrets, "onDidChange", secretEvents.event as typeof context.secrets.onDidChange);
    mock.method(stub.workspace, "onDidChangeConfiguration", configEvents.event as typeof stub.workspace.onDidChangeConfiguration);
    mock.method(stub.workspace, "onDidChangeWorkspaceFolders", workspaceEvents.event as typeof stub.workspace.onDidChangeWorkspaceFolders);
    mock.method(context.secrets, "store", async () => { stores++; throw new Error("Output filtering must never create a key."); });
    for (const name of ["showWarningMessage", "showInformationMessage", "showErrorMessage"] as const)
        mock.method(stub.window, name, async () => { uiCalls++; return undefined; });
    mock.method(stub.workspace, "openTextDocument", async () => { documentCalls++; throw new Error("Original source documents must remain unopened."); });
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load();
    manager = new VaultManager(context as never); stub.resetSinks();
});
afterEach(() => {
    try {
        for (const filter of filters) filter.dispose(); for (const subscription of context.subscriptions) subscription.dispose();
        assert.equal(uiCalls, 0); assert.equal(documentCalls, 0); assert.equal(stores, 0);
        for (const sink of stub.sinks) { assert.ok(!sink.text.includes(FAKE)); assert.ok(!sink.text.includes(LEGACY)); assert.ok(!sink.text.includes(KEY)); }
    } finally { secretEvents.dispose(); configEvents.dispose(); workspaceEvents.dispose(); mock.restoreAll(); stub.resetState(); }
});

test("F10-O01 absent vault permits useful empty-registry output without creating storage or a key", async () => {
    const before = await readdir(storage), filter = await factory(); assert.equal(filter.available(), true);
    push(filter, "Useful public output\n"); complete(filter.finish(0), "Useful public output\n");
    assert.deepEqual(await readdir(storage), before); assert.equal(context._inspect.secretStore.size, 0); safeMetadata(filter);
});

test("F10-O02 a safely absent storage directory remains absent during empty-registry filtering", async () => {
    storage = join(directory, "absent-storage"); context.globalStorageUri = stub.Uri.file(storage); manager = new VaultManager(context as never);
    const filter = await factory(); assert.equal(filter.available(), true); push(filter, "public"); complete(filter.finish(0), "public");
    await assert.rejects(() => readdir(storage), { code: "ENOENT" }); assert.equal(context._inspect.secretStore.size, 0);
});

test("F10-O03 real encrypted current registrations mask raw and every representative one-layer encoding", async () => {
    const cipher = await install([entry(FAKE)]);
    const forms = [FAKE, Buffer.from(FAKE).toString("base64"), Buffer.from(FAKE).toString("base64url"), Buffer.from(FAKE).toString("hex"),
        encodeURIComponent(FAKE), JSON.stringify(FAKE).replace("private", "\\u0070rivate")];
    for (const form of forms) {
        const filter = await factory(); assert.equal(filter.available(), true); safeMetadata(filter, cipher);
        push(filter, "before " + form + " after"); push(filter, "ordinary warning", "stderr");
        complete(filter.finish(0), MASK, MASK, true);
    }
    assert.equal(await readFile(join(storage, VAULT), "utf8"), cipher);
});

test("F10-O04 long registrations preserve unrelated public Unicode/nonzero output", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "Useful É🔐 output\n"); push(filter, "public warning", "stderr");
    complete(filter.finish(17), "Useful É🔐 output\n", "public warning", false, 17);
});

test("F10-O05 any short private registration conservatively masks each nonempty completed channel", async () => {
    await install([entry("xy")]); const filter = await factory(); push(filter, "ordinary public output"); push(filter, "warning", "stderr");
    complete(filter.finish(0), MASK, MASK, true);
    const empty = await factory(); push(empty, "ordinary public output", "stderr"); complete(empty.finish(0), "", MASK, true);
});

test("F10-O06 short and whole-marker replacement collisions withhold instead of returning a private substring", async () => {
    for (const value of ["SECRET", "OUTPUT", MASK]) {
        await install([entry(value)]); const filter = await factory(); push(filter, value === MASK ? MASK : "public control"); withheld(filter.finish(0));
    }
});

test("F10-O07 all legacy/current-root values register while other-root values remain excluded", async () => {
    await install([entry(FAKE, 0), entry(LEGACY, 1, "legacy"), entry(OTHER, 2, "other")]);
    for (const value of [FAKE, LEGACY]) { const filter = await factory(); push(filter, value); complete(filter.finish(0), MASK, "", true); }
    const publicOther = await factory(); push(publicOther, OTHER); complete(publicOther.finish(0), OTHER); safeMetadata(publicOther);
});

test("F10-O08 partially bound entries are unavailable rather than silently omitted", async () => {
    for (const missing of ["root", "source"]) { const value = entry(FAKE); delete value[missing]; await install([value]); await unavailable(() => factory()); }
});

test("F10-O09 existing ciphertext with a missing or different existing key never regenerates a key", async () => {
    await install([entry(FAKE)]); context._inspect.secretStore.delete(KEY_ID); await unavailable(() => factory());
    context._inspect.secretStore.set(KEY_ID, Buffer.alloc(32, 0x72).toString("base64")); await unavailable(() => factory()); assert.equal(stores, 0);
});

for (const name of ["vault-pending.json", "vault-source-0123456789abcdef0123456789abcdef.json",
    "vault-generation-a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1.enc", "vault-mutation.lock", "write-a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1.enc", "vault-unknown-recovery.enc"]) {
    test(`F10-O10 absent current cipher with retained ${name} cannot downgrade to an empty registry`, async () => {
        await writeFile(join(storage, name), "synthetic retained recovery bytes", { flag: "wx" });
        await unavailable(() => factory()); assert.equal(await readFile(join(storage, name), "utf8"), "synthetic retained recovery bytes");
        assert.equal(context._inspect.secretStore.size, 0);
    });
}

test("F10-O11 pending recovery also blocks an otherwise valid encrypted current vault", async () => {
    const cipher = await install([entry(FAKE)]); await writeFile(join(storage, "vault-pending.json"), "{}"); await unavailable(() => factory());
    assert.equal(await readFile(join(storage, VAULT), "utf8"), cipher);
});

test("F10-O12 malformed strict vault schemas/JSON cannot return a partial usable registry", async () => {
    for (const payload of [JSON.stringify({ version: 9, entries: [entry(FAKE)] }), JSON.stringify({ version: 2, entries: [entry(FAKE)], env: {} }),
        '{"version":2,"version":2,"entries":[]}', JSON.stringify({ version: 2, entries: [{ ...entry(FAKE), rawValue: null }] })]) {
        await install([], payload); await unavailable(() => factory());
    }
});

for (const [label, values] of [
    ["one-value bytes", ["x".repeat(4097)]],
    ["unique registration count", Array.from({ length: 129 }, (_, index) => "F10 unique private registry " + index)],
    ["total registration bytes", [...Array.from({ length: 16 }, (_, index) => "A".repeat(4092) + String(index).padStart(4, "0")), "x"]],
    ["derived variant bytes", Array.from({ length: 13 }, (_, index) => "\u0001".repeat(4092) + String(index).padStart(4, "0"))],
] as const) {
    test(`F10-O13 ${label} exhaustion rejects the complete private registry`, async () => {
        await install(values.map((value, index) => entry(value, index))); await unavailable(() => factory());
    });
}

test("F10-O14 removing a captured cipher revokes permanently rather than falling back to an empty registry", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "useful buffered prefix");
    await rename(join(storage, VAULT), join(directory, "retained-moved-cipher.enc")); assert.equal(filter.available(), false);
    await install([entry(FAKE)]); assert.equal(filter.available(), false); push(filter, "later", "stdout", "WITHHELD"); withheld(filter.finish(0));
});

test("F10-O15 changed ciphertext revokes even when the existing key still decrypts it", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix");
    await install([entry(LEGACY)]); assert.equal(filter.available(), false); withheld(filter.finish(0));
});

test("F10-O16 late pending migration revokes a filter before any buffered prefix is released", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix");
    await writeFile(join(storage, "vault-pending.json"), "{}"); assert.equal(filter.available(), false); withheld(filter.finish(0));
});

test("F10-O17 key-change epoch revokes even if a later lookup would return the old key again", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix");
    secretEvents.fire({ key: KEY_ID }); assert.equal(filter.available(), false); withheld(filter.finish(0));
});

test("F10-O18 an existing raw policy-file edit revokes without relying on an owner-session event", async () => {
    await writeFile(join(root, ".aiignore"), "private-first.txt\n"); await BoundarySnapshot.load(); await install([entry(FAKE)]);
    const filter = await factory(); push(filter, "public prefix"); await writeFile(join(root, ".aiignore"), "private-second.txt\n");
    assert.equal(filter.available(), false); withheld(filter.finish(0));
});

test("F10-O19 saved effective policy drift revokes pending output", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix");
    await updateRules(rootKey(), rules => ({ ...rules, paths: [...rules.paths, { kind: "file", pattern: "private-added.txt", sensitive: true }] }));
    assert.equal(filter.available(), false); withheld(filter.finish(0));
});

test("F10-O20 loss of exact workspace membership revokes a filter", async () => {
    await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix");
    stub.state.folders = []; workspaceEvents.fire({}); assert.equal(filter.available(), false); withheld(filter.finish(0));
});

for (const name of ["lite.vaultMode", "lite.secretMatching", "lite.outputRedactor", "lite.ps51Terminal"]) {
    test(`F10-O21 ${name} withdrawal/re-enable is sticky for an already prepared filter`, async () => {
        await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix"); flag(name, false);
        assert.equal(filter.available(), false); flag(name, true); assert.equal(filter.available(), false); withheld(filter.finish(0));
        const fresh = await factory(); assert.equal(fresh.available(), true); push(fresh, "new public result"); complete(fresh.finish(0), "new public result");
    });
}

for (const action of ["cancel", "dispose"] as const) {
    test(`F10-O22 ${action} permanently withholds buffered output and cannot be replayed`, async () => {
        await install([entry(FAKE)]); const filter = await factory(); push(filter, "public prefix"); filter[action](); filter[action]();
        assert.equal(filter.available(), false); push(filter, "later", "stderr", "WITHHELD"); withheld(filter.finish(0)); withheld(filter.finish(0));
    });
}

test("F10-O23 enabled false/throw and lost trust cannot downgrade private output protection", async () => {
    await install([entry(FAKE)]); await unavailable(() => factory(() => false)); await unavailable(() => factory(() => { throw new Error(FAKE); }));
    let enabled = true; const filter = await factory(() => enabled); push(filter, "public prefix"); enabled = false;
    assert.equal(filter.available(), false); enabled = true; withheld(filter.finish(0));
    stub.state.isTrusted = false; await unavailable(() => factory());
});

for (const action of ["cancel", "dispose"] as const) {
    test(`F10-O24 an enabled callback reentrantly calling ${action} cannot release final output`, async () => {
        await install([entry(FAKE)]); let armed = false; let filter: Filter;
        filter = await factory(() => { if (armed) { armed = false; filter[action](); } return true; });
        push(filter, "public prefix"); armed = true; withheld(filter.finish(0)); assert.equal(filter.available(), false);
    });
}

for (const change of ["pending", "ciphertext"] as const) {
    test(`F10-O25 ${change} drift during the second existing-key read is rechecked before filter return`, async () => {
        await install([entry(FAKE)]); const original = context.secrets.get.bind(context.secrets); let reads = 0, changed = false;
        mock.method(context.secrets, "get", async (key: string) => { const value = await original(key);
            if (key === KEY_ID && ++reads === 2) { changed = true; await writeFile(join(storage, change === "pending" ? "vault-pending.json" : VAULT), "synthetic late storage drift"); }
            return value;
        });
        await unavailable(() => factory()); assert.ok(changed);
    });
}

test("F10-O26 a configuration change while a key read is held cannot return a stale filter", async () => {
    await install([entry(FAKE)]); method(); const original = context.secrets.get.bind(context.secrets);
    let release!: () => void, entered!: () => void; const gate = new Promise<void>(done => { release = done; }), held = new Promise<void>(done => { entered = done; });
    mock.method(context.secrets, "get", async (key: string) => { const value = await original(key); entered(); await gate; return value; });
    const work = factory(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([held, work.then(() => { throw new Error("Expected an existing-key read before factory completion."); }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Bounded synthetic key-read wait expired.")), 2000); })]);
        flag("lite.ps51Terminal", false); release(); await unavailable(() => work);
    } finally { if (timer) clearTimeout(timer); release(); await work.catch(() => undefined); }
});

test("F10-O27 normal public output-file creation does not confuse directory mtime with identity", async () => {
    await install([entry(FAKE)]); const filter = await factory(); await writeFile(join(root, "public-app-output.txt"), "ordinary public output\n");
    assert.equal(filter.available(), true); push(filter, "useful public result"); complete(filter.finish(0), "useful public result");
});

test("F10-O28 roots must be the exact current local workspace folder without authority/query/fragment", async () => {
    await install([entry(FAKE)]);
    for (const uri of [stub.Uri.file(other), stub.Uri.file(join(root, "child")), stub.Uri.parse("vscode-remote://synthetic/project")])
        await unavailable(() => factory(() => true, uri as unknown as vscode.Uri));
    for (const field of ["authority", "query", "fragment"]) { const uri = stub.Uri.file(root); Object.defineProperty(uri, field, { value: "unreviewed" });
        await unavailable(() => factory(() => true, uri as unknown as vscode.Uri)); }
});

test("F10-O29 registry/filter progress serialization exposes no values, value hashes, key, cipher or source", async () => {
    const cipher = await install([entry(FAKE)]), filter = await factory(); safeMetadata(filter, cipher); push(filter, FAKE.slice(0, 12));
    safeMetadata(filter, cipher); filter.cancel(); safeMetadata(filter, cipher); withheld(filter.finish(0)); assert.equal(documentCalls, 0); assert.equal(uiCalls, 0);
});

test("F10-O30 invalid final UTF-8 and unsupported editing controls retain F08 whole-output withholding", async () => {
    await install([entry(FAKE)]);
    const invalid = await factory(); push(invalid, "public prefix"); invalid.push("stderr", Uint8Array.from([0xf0, 0x9f, 0x94])); withheld(invalid.finish(0));
    const editing = await factory(); push(editing, "public prefix"); editing.push("stdout", Buffer.from("\b")); withheld(editing.finish(0));
});
