import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { buildPrePushHookText, type HookClientPin } from "../history-hooks/PrePushHookText";
import { hookSnapshotDigest, type HookFileSnapshot, type HookRecoveryReceipt } from "../history-hooks/PrePushHookTransaction";
import { parseHookRecoveryReceipt } from "../history-hooks/PrePushHookRestore";
import { observeHookArtifact, hookArtifactIdentity } from "../history-hooks/PrePushClient";
import { signHookDescriptor, verifyHookDescriptor } from "../history-hooks/PrePushWire";

// TEST FIRST review regressions. Evaluate unchanged controller source in a
// private CJS wrapper. Only descriptor filesystem and canonical crypto/wire,
// hook text, transaction/restore implementations execute for real. Root/policy,
// discovery, hook capability, artifact identities and service are explicit
// doubles; no actual Git, child, listener, normal profile or fixture deletion.
const options = { skip: process.platform !== "win32" };
const FLAG = "soterai.lite.historyHooks.prePush", PROJECTION = "a".repeat(64), WORKER = "b".repeat(64), RUNTIME = "c".repeat(64);
const ORIGINAL = Buffer.from("#!/bin/sh\n# TEST_ONLY_F26B_BACKEND_PRIVATE_038ed7a4\nexit 7\n");
const sha = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");
const recordKey = (root: string) => "soterai.prePush.record.v1." + sha(root.toLowerCase());
const keyId = (generation: string) => "soterai.prePush.signing.v1." + generation;
const copy = (value: HookFileSnapshot): HookFileSnapshot => Object.freeze({ identity: value.identity, mode: value.mode, bytes: value.bytes === undefined ? undefined : Buffer.from(value.bytes) });
interface Outcome { readonly status: string }
interface Controller { resume(): Promise<Outcome>; restore(): Promise<Outcome>; status(): { readonly status: string }; current(value: unknown): boolean; dispose(): void }
interface ServiceOptions { root: string; generation: string; workerSha256: string; runtimeSha256: string; valid(): boolean; loadKey(): Promise<KeyObject | undefined> }
interface OwnershipRecord { version: 1; pin: string; projectionFingerprint: string; receipt: HookRecoveryReceipt; state: "APPLIED" }
function expected(pin: HookClientPin) { return { root: pin.root, generation: pin.generation, workerSha256: pin.workerSha256, runtimeSha256: pin.runtimeSha256 }; }
function signed(pin: HookClientPin, key: KeyObject, session: string): Buffer {
    const value = signHookDescriptor({ version: 1, ...expected(pin), session, endpoint: "http://127.0.0.1:42421/pre-push" }, key);
    assert(value, "Real canonical synthetic descriptor signing must succeed."); return value;
}
function frozen(value: Outcome): void { assert(Object.isFrozen(value)); assert.deepEqual(Reflect.ownKeys(value), ["status"]); }
async function absent(file: string): Promise<boolean> { try { await lstat(file); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return true; throw error; } }

async function fixture(t: TestContext, settings: { descriptor?: "valid" | "tampered" | "absent"; missingKey?: boolean } = {}) {
    const container = await mkdtemp(join(tmpdir(), "soter-f26b-controller-backend-")), root = join(container, "repo"), profile = join(container, "profile");
    await mkdir(root); await mkdir(profile); stub.resetState(root);
    await mkdir(join(root, ".git")); await writeFile(join(root, ".git", "config"), "[core]\nrepositoryformatversion = 0\n", { flag: "wx" });
    const config = join(profile, "synthetic-global.gitconfig"); await writeFile(config, "# synthetic empty global\n", { flag: "wx" });
    const environment = Object.freeze({ HOME: profile, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1" });
    stub.state.configInspect.set(FLAG, { defaultValue: false, globalValue: true });
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    const context = stub.makeExtensionContext(profile), directory = join(context.globalStorageUri.fsPath, "pre-push");
    await mkdir(directory, { recursive: true });
    const worker = join(profile, "dist", "pre-commit-client.js"), runtime = process.execPath;
    function ownership(generation = randomUUID()) {
        const pair = generateKeyPairSync("ed25519"), privateRaw = (pair.privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64");
        const pin: HookClientPin = { version: 1, root, generation, publicKey: (pair.publicKey.export({ format: "der", type: "spki" }) as Buffer).toString("base64"),
            worker, workerSha256: WORKER, runtime, runtimeSha256: RUNTIME, descriptor: join(directory, generation + ".json"), systemRoot: "C:\\Windows" };
        const rawPin = Buffer.from(JSON.stringify(pin)), hook = buildPrePushHookText(ORIGINAL, rawPin); assert(hook);
        const before = { bytes: ORIGINAL, mode: 0o666 }, after = { bytes: hook, mode: 0o666 };
        const receipt: HookRecoveryReceipt = { version: 1, generation, root, hooksRelative: ".git/hooks", backup: "d".repeat(32), beforeDigest: hookSnapshotDigest(before),
            afterDigest: hookSnapshotDigest(after), originalPresent: true, originalMode: 0o666, mode: 0o666 };
        assert(parseHookRecoveryReceipt(receipt));
        const value: OwnershipRecord = { version: 1, pin: rawPin.toString("base64"), projectionFingerprint: PROJECTION, receipt, state: "APPLIED" };
        return { pair, pin, privateRaw, hook, receipt, raw: JSON.stringify(value) };
    }
    const saved = ownership(), replacement = ownership(), oldSession = randomUUID(), newSession = randomUUID();
    const priorSigned = signed(saved.pin, saved.pair.privateKey, oldSession);
    assert.equal(verifyHookDescriptor(priorSigned, saved.pin.publicKey, expected(saved.pin))?.session, oldSession);
    let prior = priorSigned;
    if (settings.descriptor === "tampered") {
        const envelope = JSON.parse(priorSigned.toString("utf8"));
        envelope.signature = (envelope.signature[0] === "A" ? "B" : "A") + envelope.signature.slice(1);
        prior = Buffer.from(JSON.stringify(envelope)); assert.equal(verifyHookDescriptor(prior, saved.pin.publicKey, expected(saved.pin)), undefined);
    }
    if (settings.descriptor !== "absent") await writeFile(saved.pin.descriptor, prior, { flag: "wx" });
    context._inspect.secretStore.set(recordKey(root), saved.raw);
    if (!settings.missingKey) context._inspect.secretStore.set(keyId(saved.pin.generation), saved.privateRaw);
    const secretWrites: { key: string; raw: string }[] = [], keyReads: string[] = [];
    const get = context.secrets.get.bind(context.secrets), store = context.secrets.store.bind(context.secrets);
    context.secrets.get = async id => { keyReads.push(id); return get(id); };
    context.secrets.store = async (id, raw) => { secretWrites.push({ key: id, raw }); await store(id, raw); };
    const control: { confirm?: () => void; retrieve?: () => void; confirmCalls: number; hookWrites: number; artifactCalls: number } = {
        confirmCalls: 0, hookWrites: 0, artifactCalls: 0,
    };
    const cell = { state: copy({ identity: "1".repeat(64), bytes: saved.hook, mode: 0o666 }) };
    const file = Object.freeze({ root, file: join(root, ".git", "hooks", "pre-push"), read: () => copy(cell.state),
        write: (before: HookFileSnapshot, bytes: Buffer | undefined, mode: number | undefined) => {
            if (before.identity !== cell.state.identity || hookSnapshotDigest(before) !== hookSnapshotDigest(cell.state)) return false;
            control.hookWrites++; cell.state = copy({ identity: String(control.hookWrites + 1).repeat(64), bytes, mode }); return true;
        } });
    class FakeService {
        live = true; started = false; closes = 0;
        constructor(readonly input: ServiceOptions) { services.push(this); }
        get available(): boolean { return this.live && this.started && this.input.valid(); }
        get busy(): boolean { return false; }
        async start(): Promise<Buffer | undefined> {
            const key = await this.input.loadKey(); if (!key || !this.input.valid() || !this.live) return undefined;
            this.started = true; return signed(saved.pin, key, newSession);
        }
        async close(): Promise<void> { this.closes++; this.live = false; }
    }
    const services: FakeService[] = [];
    class FakeDiscovery {
        readonly closed = Promise.resolve();
        readonly value = Object.freeze({ status: "COMPLETE", hooksRelative: ".git/hooks", fingerprint: PROJECTION });
        start() { return Promise.resolve(this.value); } canRelease(value: unknown) { return value === this.value; } withdraw() { /* no owned child */ }
    }
    class FakeBackups {
        async retrieve(handle: string): Promise<string> {
            assert.equal(handle, saved.receipt.backup); control.retrieve?.();
            return JSON.stringify({ version: 1, present: true, mode: 0o666, bytes: ORIGINAL.toString("base64") });
        }
    }
    t.mock.method(stub.window, "showWarningMessage", async (_message: string, ...rest: unknown[]) => {
        control.confirmCalls++; assert(rest.some(value => value && typeof value === "object" && (value as { modal?: boolean }).modal === true));
        control.confirm?.(); return rest[rest.length - 1] as string;
    });
    const sourceFile = resolve(__dirname, "../history-hooks/PrePushController.ts"), source = await readFile(sourceFile, "utf8"), localRequire = createRequire(sourceFile);
    const ts = localRequire("typescript") as typeof import("typescript");
    const compiled = ts.transpileModule(source, { fileName: sourceFile, reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    assert(!(compiled.diagnostics ?? []).some(value => value.category === ts.DiagnosticCategory.Error), "The unchanged real controller must transpile in the isolated test wrapper.");
    const realBinding = localRequire("../terminal/ManagedOutputBinding") as typeof import("../terminal/ManagedOutputBinding");
    const isolatedRequire = (id: string): unknown => {
        if (id === "vscode") return stub;
        if (id === "../ai-boundary/BoundarySnapshot") return { BoundarySnapshot: { load: async () => undefined } };
        if (id === "../terminal/ManagedOutputBinding") return { managedRootIdentity: () => "synthetic root identity", managedPolicyBinding: () => "synthetic policy",
            managedPathIdentity: realBinding.managedPathIdentity };
        if (id === "../broker/EncryptedBackupSink") return { EncryptedBackupSink: FakeBackups };
        if (id === "./CheckedOwnerHookContext") return { prepareCheckedOwnerHookContext: async () => Object.freeze({ root, environment, available: () => true }) };
        if (id === "./OwnerHookProtocol") return { buildOwnerHookEnvironment: () => environment };
        if (id === "./OwnerHookDiscovery") return { OwnerHookDiscovery: FakeDiscovery };
        if (id === "./CheckedPrePushHookFile") return { prepareCheckedPrePushHookFile: () => file };
        if (id === "./PrePushOwnerService") return { PrePushOwnerService: FakeService };
        if (id === "./PrePushFlags") return { prePushHooksEnabled: () => true };
        if (id === "./PrePushClient") return {
            observeHookArtifact: (target: string, cap: number, valid: () => boolean, body = false) => {
                if (target === worker || target === runtime) { control.artifactCalls++; assert(valid()); return Object.freeze({ stamp: target === worker ? "worker identity" : "runtime identity", digest: target === worker ? WORKER : RUNTIME }); }
                if (target.toLowerCase() === config.toLowerCase() || target.toLowerCase() === join(root, ".git", "config").toLowerCase()) return observeHookArtifact(target, cap, valid, body);
                assert.equal(target, saved.pin.descriptor); return observeHookArtifact(target, cap, valid, body);
            },
            hookArtifactIdentity: (target: string, cap: number) => {
                if (target === worker || target === runtime) return target === worker ? "worker identity" : "runtime identity";
                assert.equal(target, saved.pin.descriptor); return hookArtifactIdentity(target, cap);
            },
        };
        return localRequire(id);
    };
    const isolated: { exports: { PrePushController?: new (context: unknown) => Controller } } = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", compiled.outputText)(isolatedRequire, isolated, isolated.exports, sourceFile, dirname(sourceFile));
    const Constructor = isolated.exports.PrePushController; assert.equal(typeof Constructor, "function"); assert(Constructor);
    const controller = new Constructor(context);
    t.after(() => {
        controller.dispose(); context.subscriptions.forEach(value => value.dispose());
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as any).remoteName;
    });
    const replaceRecord = (replaceHook: boolean) => {
        context._inspect.secretStore.set(recordKey(root), replacement.raw);
        if (replaceHook) cell.state = copy({ identity: "4".repeat(64), bytes: replacement.hook, mode: 0o666 });
    };
    return { controller, context, root, saved, replacement, prior, oldSession, newSession, services, secretWrites, keyReads, control, cell, replaceRecord };
}

test("F26b real controller reviewed resume replaces a valid signed prior descriptor with a new signed session", options, async t => {
    const f = await fixture(t), outcome = await f.controller.resume();
    frozen(outcome); assert.equal(outcome.status, "RESUMED", "A matching signed prior descriptor must not prevent ordinary reviewed restart resume.");
    const raw = await readFile(f.saved.pin.descriptor), descriptor = verifyHookDescriptor(raw, f.saved.pin.publicKey, expected(f.saved.pin));
    assert(descriptor); assert.equal(descriptor.session, f.newSession); assert.notEqual(descriptor.session, f.oldSession);
    assert.equal(f.controller.status().status, "LIVE"); assert.equal(f.controller.current(outcome), true);
    assert.equal(f.control.confirmCalls, 1); assert.equal(f.control.hookWrites, 0); assert.equal(f.secretWrites.length, 0);
    assert(f.keyReads.includes(keyId(f.saved.pin.generation))); assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.saved.raw);
});

test("F26b real controller preserves a tampered prior descriptor and refuses resume rather than overwriting it", options, async t => {
    const f = await fixture(t, { descriptor: "tampered" }), outcome = await f.controller.resume();
    frozen(outcome); assert.equal(outcome.status, "UNAVAILABLE"); assert.equal(f.controller.current(outcome), false);
    assert((await readFile(f.saved.pin.descriptor)).equals(f.prior)); assert.notEqual(f.controller.status().status, "LIVE");
    assert.equal(f.control.hookWrites, 0); assert.equal(f.secretWrites.length, 0); assert(f.services.every(service => service.closes >= 1));
});

test("F26b real controller stale restore review preserves a newer generation record and edited hook", options, async t => {
    const f = await fixture(t); f.control.confirm = () => f.replaceRecord(true);
    const outcome = await f.controller.restore(); frozen(outcome);
    assert(["UNAVAILABLE", "INCOMPLETE"].includes(outcome.status));
    assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.replacement.raw, "Stale incomplete recovery must not erase another generation's exact root record.");
    assert(f.cell.state.bytes?.equals(f.replacement.hook)); assert.equal(f.control.hookWrites, 0);
    assert(!f.secretWrites.some(row => row.key === recordKey(f.root)), "A stale review cannot overwrite the newer recovery record.");
});

test("F26b real controller stale record after backup retrieval cannot be overwritten by rollback bookkeeping", options, async t => {
    const f = await fixture(t); f.control.retrieve = () => f.replaceRecord(false);
    const outcome = await f.controller.restore(); frozen(outcome);
    assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.replacement.raw, "A changed root record must survive the old operation's later durable save.");
    assert(["UNAVAILABLE", "INCOMPLETE"].includes(outcome.status)); assert.equal(f.controller.current(outcome), false);
    assert(!f.secretWrites.some(row => row.key === recordKey(f.root)), "Detecting a foreign record must refuse every subsequent stale record store.");
});

test("F26b real controller withdraws live status and result authority when its exact service becomes unavailable", options, async t => {
    // Start with absent descriptor so this lifecycle regression is independent
    // of the separate existing-descriptor verifier schema regression.
    const f = await fixture(t, { descriptor: "absent" }), outcome = await f.controller.resume();
    frozen(outcome); assert.equal(outcome.status, "RESUMED"); assert.equal(f.controller.current(outcome), true);
    assert.equal(f.controller.status().status, "LIVE"); assert.equal(f.services.length, 1);
    const descriptor = await readFile(f.saved.pin.descriptor); f.services[0].live = false;
    assert.notEqual(f.controller.status().status, "LIVE", "Closed or failed owned service cannot remain represented as a live owner.");
    assert.equal(f.controller.current(outcome), false, "A formerly resumed result loses publication authority with its actual service.");
    assert((await readFile(f.saved.pin.descriptor)).equals(descriptor)); assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.saved.raw);
    assert.equal(f.control.hookWrites, 0); assert.equal(f.secretWrites.length, 0);
});

test("F26b real controller cannot replace a missing signing key while resuming retained ownership", options, async t => {
    const f = await fixture(t, { descriptor: "absent", missingKey: true }), outcome = await f.controller.resume();
    frozen(outcome); assert.equal(outcome.status, "UNAVAILABLE"); assert.equal(f.services.length, 0);
    assert.equal(await absent(f.saved.pin.descriptor), true); assert.equal(f.context._inspect.secretStore.get(keyId(f.saved.pin.generation)), undefined);
    assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.saved.raw); assert.equal(f.secretWrites.length, 0); assert.equal(f.control.hookWrites, 0);
});

// The two additive journal cases retain real synthetic AES-GCM ciphertext as
// well as descriptor files. FakeBackups remains an explicit retrieval seam:
// these assertions establish retention, not SecretStorage provider coverage.
async function retainedRecovery(f: Awaited<ReturnType<typeof fixture>>) {
    const { encryptVault, decryptVault, generateVaultKey } = await import("@soterai/guard-core");
    const backupKeyId = "soterai.configBackupKey.v1." + f.saved.pin.generation, backupKey = generateVaultKey();
    const payload = JSON.stringify({ version: 1, originalPath: join(f.root, ".git", "hooks", "pre-push"),
        content: JSON.stringify({ version: 1, present: true, mode: 0o666, bytes: ORIGINAL.toString("base64") }) });
    const ciphertext = await encryptVault(payload, backupKey), directory = join(f.context.globalStorageUri.fsPath, "config-backups"), file = join(directory, f.saved.receipt.backup + ".enc");
    await mkdir(directory, { recursive: true }); await writeFile(file, ciphertext, { flag: "wx" });
    f.context._inspect.secretStore.set(backupKeyId, backupKey);
    const previousJournal = "soterai.prePush.receipt.v1." + f.saved.pin.generation + "." + randomUUID();
    f.context._inspect.secretStore.set(previousJournal, f.saved.raw);
    const indexKey = "soterai.prePush.receipts.v1"; await f.context.globalState.update(indexKey, [previousJournal]);
    return { indexKey, previousJournal, assertRetained: async () => {
        const current = await readFile(file, "utf8"); assert.equal(current, ciphertext, "The retained encrypted backup must not be removed or rewritten by restoration.");
        assert.equal(await decryptVault(current, backupKey), payload); assert.equal(f.context._inspect.secretStore.get(backupKeyId), backupKey);
        assert.equal(f.context._inspect.secretStore.get(previousJournal), f.saved.raw, "Earlier private journal revision must remain byte exact.");
        const index = f.context.globalState.get<unknown>(indexKey); assert(Array.isArray(index)); assert(index.includes(previousJournal));
        assert(index.every(id => typeof id === "string" && /^soterai\.prePush\.receipt\.v1\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)),
            "Public discoverability index may contain only opaque generation/revision IDs.");
        const publicText = JSON.stringify(index);
        for (const value of [f.root, f.saved.pin.worker, f.saved.pin.descriptor, f.saved.pin.publicKey, f.saved.privateRaw, f.saved.receipt.backup, ORIGINAL.toString("utf8"), ORIGINAL.toString("base64"), backupKey])
            assert(!publicText.includes(value), "Public receipt index must not expose roots, pins, originals, backup handles or private keys.");
        return index as string[];
    } };
}

test("F26b real controller useful restore durably retains exact private journal and opaque public discoverability", options, async t => {
    const f = await fixture(t), retained = await retainedRecovery(f), outcome = await f.controller.restore(); frozen(outcome);
    assert.equal(outcome.status, "RESTORED"); assert.equal(f.controller.current(outcome), true);
    assert(f.cell.state.bytes?.equals(ORIGINAL)); assert.equal(f.cell.state.mode, 0o666); assert.equal(f.control.hookWrites, 1);
    const raw = f.context._inspect.secretStore.get(recordKey(f.root)); assert.equal(typeof raw, "string");
    const value = JSON.parse(raw!); assert.equal(value.state, "ROLLED_BACK"); assert.deepEqual(value.receipt, f.saved.receipt);
    assert.equal(value.pin, JSON.parse(f.saved.raw).pin); assert.equal(value.projectionFingerprint, PROJECTION);
    const journals = f.secretWrites.filter(row => row.key.startsWith("soterai.prePush.receipt.v1." + f.saved.pin.generation + "."));
    assert.equal(journals.length, 1, "Exactly one new private revision is sufficient for useful restoration.");
    assert.equal(journals[0].raw, raw); assert.equal(f.context._inspect.secretStore.get(journals[0].key), raw);
    assert.equal(f.context._inspect.secretStore.get("soterai.prePush.recovery.v1." + f.saved.pin.generation + ".ROLLED_BACK"), raw,
        "A fixed generation/state record keeps recovery discoverable if an opaque cross-window index update races.");
    assert.equal(f.secretWrites.filter(row => row.key === recordKey(f.root)).length, 1);
    const index = await retained.assertRetained(); assert.deepEqual(index, [retained.previousJournal, journals[0].key]);
    assert.equal(f.services.length, 0, "Explicit restoration must not start a signing service.");
});

test("F26b real controller journal-store race retains its private revision without overwriting a foreign root record", options, async t => {
    const f = await fixture(t), retained = await retainedRecovery(f), store = f.context.secrets.store.bind(f.context.secrets);
    let swapped = false, ownedJournal: string | undefined;
    f.context.secrets.store = async (id, raw) => {
        await store(id, raw);
        if (!swapped && id.startsWith("soterai.prePush.receipt.v1." + f.saved.pin.generation + ".")) {
            swapped = true; ownedJournal = id; f.replaceRecord(false);
        }
    };
    const outcome = await f.controller.restore(); frozen(outcome);
    assert(swapped && ownedJournal, "Fixture must cross the actual awaited private journal store boundary.");
    assert.equal(outcome.status, "INCOMPLETE"); assert.equal(f.controller.current(outcome), false);
    assert.equal(f.context._inspect.secretStore.get(recordKey(f.root)), f.replacement.raw, "The newer generation's root record must survive the old journal continuation.");
    assert.equal(f.secretWrites.filter(row => row.key === recordKey(f.root)).length, 0, "Never store the stale active-root pointer after detecting foreign ownership.");
    const journals = f.secretWrites.filter(row => row.key.startsWith("soterai.prePush.receipt.v1." + f.saved.pin.generation + "."));
    assert.equal(journals.length, 1, "Keep the owned private revision without another journal retry.");
    assert.equal(journals[0].key, ownedJournal); assert.equal(f.context._inspect.secretStore.get(ownedJournal), journals[0].raw);
    const value = JSON.parse(journals[0].raw); assert.equal(value.state, "ROLLED_BACK"); assert.deepEqual(value.receipt, f.saved.receipt);
    assert.equal(f.context._inspect.secretStore.get("soterai.prePush.recovery.v1." + f.saved.pin.generation + ".ROLLED_BACK"), journals[0].raw,
        "The fixed original-generation recovery state survives a foreign active-pointer race.");
    assert(f.cell.state.bytes?.equals(ORIGINAL)); assert.equal(f.control.hookWrites, 1);
    const index = await retained.assertRetained(); assert.deepEqual(index, [retained.previousJournal, ownedJournal]);
    assert.equal(f.services.length, 0);
});
