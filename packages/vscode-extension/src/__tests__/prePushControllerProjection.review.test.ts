import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { prepareCheckedOwnerHookContext } from "../history-hooks/CheckedOwnerHookContext";
import { buildOwnerHookEnvironment } from "../history-hooks/OwnerHookProtocol";
import { buildPrePushHookText, type HookClientPin } from "../history-hooks/PrePushHookText";
import { hookSnapshotDigest } from "../history-hooks/PrePushHookTransaction";
import { observeHookArtifact, hookArtifactIdentity } from "../history-hooks/PrePushClient";
import { signHookDescriptor } from "../history-hooks/PrePushWire";

// Real unchanged controller, canonical signing, checked repository metadata,
// checked hook filesystem, and configuration files in retained synthetic dirs.
// Explicit doubles: policy/root workspace, artifact bytes, finite discovery,
// live listener, and encrypted backup storage. No Git/child/push/Code launch.
const options = { skip: process.platform !== "win32", timeout: 30000 };
const WORKER = "b".repeat(64), RUNTIME = "c".repeat(64), PROJECTION = "a".repeat(64);
const CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n hookspath = .git/hooks\n";
const sha = (raw: Uint8Array | string) => createHash("sha256").update(raw).digest("hex");
interface Outcome { status: string }
interface Controller { install(): Promise<Outcome>; resume(): Promise<Outcome>; status(): { status: string }; current(value: unknown): boolean; dispose(): void }
interface ServiceOptions { root: string; generation: string; workerSha256: string; runtimeSha256: string; valid(): boolean; loadKey(): Promise<KeyObject | undefined> }

async function fixture(t: TestContext, operation: "install" | "resume", settings: { absentGlobal?: boolean; defaultGlobal?: boolean; systemDisabled?: boolean; implicitSystem?: boolean; implicitHome?: boolean } = {}) {
    const container = await mkdtemp(join(tmpdir(), "soter-f26b-projection-")), root = join(container, "repo"), profile = join(container, "profile");
    await mkdir(join(root, ".git", "objects"), { recursive: true }); await mkdir(join(root, ".git", "refs", "heads"), { recursive: true });
    await mkdir(join(root, ".git", "hooks"), { recursive: true }); await mkdir(profile);
    const config = join(root, ".git", "config"), global = join(profile, "owner-global.gitconfig"), system = join(profile, "owner-system.gitconfig");
    await writeFile(config, CONFIG, { flag: "wx" }); await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
    if (!settings.absentGlobal) await writeFile(global, "", { flag: "wx" }); await writeFile(system, "", { flag: "wx" });
    stub.resetState(root); stub.state.configInspect.set("soterai.lite.historyHooks.prePush", { defaultValue: false, globalValue: true });
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName"); Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    const context = stub.makeExtensionContext(profile), worker = join(profile, "dist", "pre-commit-client.js"), runtime = process.execPath;
    const ambient: NodeJS.ProcessEnv = { HOME: profile, USERPROFILE: profile, GIT_CONFIG_GLOBAL: global, GIT_CONFIG_SYSTEM: system, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR };
    if (settings.defaultGlobal) delete ambient.GIT_CONFIG_GLOBAL;
    if (settings.systemDisabled) { delete ambient.GIT_CONFIG_SYSTEM; ambient.GIT_CONFIG_NOSYSTEM = "1"; }
    if (settings.implicitSystem) delete ambient.GIT_CONFIG_SYSTEM;
    if (settings.implicitHome) { delete ambient.HOME; delete ambient.GIT_CONFIG_GLOBAL; }
    const services: FakeService[] = []; let discoveries = 0;
    class FakeService {
        active = false; closes = 0; busy = false;
        constructor(readonly input: ServiceOptions) { services.push(this); }
        get available() { return this.active && this.input.valid(); }
        async start() {
            const key = await this.input.loadKey(); if (!key || !this.input.valid()) return undefined;
            this.active = true;
            return signHookDescriptor({ version: 1, root: this.input.root, generation: this.input.generation, session: randomUUID(),
                endpoint: "http://127.0.0.1:42123/pre-push", workerSha256: WORKER, runtimeSha256: RUNTIME }, key);
        }
        async close() { this.closes++; this.active = false; }
    }
    class FakeDiscovery {
        readonly closed = Promise.resolve(); readonly value = Object.freeze({ status: "COMPLETE", hooksRelative: ".git/hooks", fingerprint: PROJECTION });
        constructor(readonly input: { context: { available(): boolean }; valid(): boolean }) { discoveries++; }
        start() { assert(this.input.context.available() && this.input.valid()); return Promise.resolve(this.value); }
        canRelease(value: unknown) { return value === this.value && this.input.context.available() && this.input.valid(); }
        withdraw() { /* no owned child */ }
    }
    const backups = new Map<string, string>();
    class FakeBackups {
        async store(_path: string, raw: string) { const id = "d".repeat(32); backups.set(id, raw); return id; }
        async retrieve(id: string) { return backups.get(id) ?? null; }
    }
    if (operation === "resume") {
        const pair = generateKeyPairSync("ed25519"), generation = randomUUID();
        const pin: HookClientPin = { version: 1, root, generation, publicKey: (pair.publicKey.export({ format: "der", type: "spki" }) as Buffer).toString("base64"), worker,
            workerSha256: WORKER, runtime, runtimeSha256: RUNTIME, descriptor: join(context.globalStorageUri.fsPath, "pre-push", generation + ".json"), systemRoot: process.env.SystemRoot! };
        const rawPin = Buffer.from(JSON.stringify(pin)), hook = buildPrePushHookText(undefined, rawPin); assert(hook);
        await writeFile(join(root, ".git", "hooks", "pre-push"), hook, { flag: "wx", mode: 0o666 });
        const receipt = { version: 1, root, generation, hooksRelative: ".git/hooks", backup: "d".repeat(32), originalPresent: false, mode: 0o666,
            beforeDigest: hookSnapshotDigest({ bytes: undefined, mode: undefined }), afterDigest: hookSnapshotDigest({ bytes: hook, mode: 0o666 }) };
        context._inspect.secretStore.set("soterai.prePush.record.v1." + sha(root.toLowerCase()), JSON.stringify({ version: 1, pin: rawPin.toString("base64"), projectionFingerprint: PROJECTION, receipt, state: "APPLIED" }));
        context._inspect.secretStore.set("soterai.prePush.signing.v1." + generation, (pair.privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"));
    }
    t.mock.method(stub.window, "showWarningMessage", async (_message: string, ...rest: unknown[]) => rest.at(-1) as string);
    const file = resolve(__dirname, "../history-hooks/PrePushController.ts"), localRequire = createRequire(file), source = await readFile(file, "utf8");
    const ts = localRequire("typescript") as typeof import("typescript"), compiled = ts.transpileModule(source, { fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    const binding = localRequire("../terminal/ManagedOutputBinding") as typeof import("../terminal/ManagedOutputBinding");
    const isolatedRequire = (id: string): unknown => {
        if (id === "vscode") return stub;
        if (id === "../ai-boundary/BoundarySnapshot") return { BoundarySnapshot: { load: async () => undefined } };
        if (id === "../terminal/ManagedOutputBinding") return { managedRootIdentity: () => "fixture root", managedPolicyBinding: () => "fixture policy", managedPathIdentity: binding.managedPathIdentity };
        if (id === "../broker/EncryptedBackupSink") return { EncryptedBackupSink: FakeBackups };
        if (id === "./CheckedOwnerHookContext") return { prepareCheckedOwnerHookContext: (root: string, _ambient: NodeJS.ProcessEnv, enabled: () => boolean) => prepareCheckedOwnerHookContext(root, ambient, enabled) };
        if (id === "./OwnerHookProtocol") return { buildOwnerHookEnvironment: () => buildOwnerHookEnvironment(ambient) };
        if (id === "./OwnerHookDiscovery") return { OwnerHookDiscovery: FakeDiscovery };
        if (id === "./PrePushOwnerService") return { PrePushOwnerService: FakeService };
        if (id === "./PrePushClient") return {
            observeHookArtifact: (target: string, cap: number, valid: () => boolean, body = false) => {
                if (target === worker || target === runtime) { assert(valid()); return Object.freeze({ stamp: target === worker ? "fixture worker" : "fixture runtime", digest: target === worker ? WORKER : RUNTIME }); }
                return observeHookArtifact(target, cap, valid, body);
            },
            hookArtifactIdentity: (target: string, cap: number) => target === worker ? "fixture worker" : target === runtime ? "fixture runtime" : hookArtifactIdentity(target, cap),
        };
        return localRequire(id);
    };
    const isolated: { exports: { PrePushController?: new (context: unknown) => Controller } } = { exports: {} };
    new Function("require", "module", "exports", "__filename", "__dirname", compiled.outputText)(isolatedRequire, isolated, isolated.exports, file, dirname(file));
    assert(isolated.exports.PrePushController); const controller = new isolated.exports.PrePushController(context);
    t.after(() => { controller.dispose(); context.subscriptions.forEach(value => value.dispose()); if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as any).remoteName; });
    const outcome = await controller[operation]();
    if (settings.implicitSystem || settings.implicitHome) {
        assert.equal(outcome.status, "UNAVAILABLE"); assert.equal(services.length, 0); assert.equal(controller.current(outcome), false);
        return { root, profile, config, global, system, ambient, controller, outcome, service: undefined as unknown as FakeService, discoveries: () => discoveries };
    }
    assert.equal(outcome.status, operation === "install" ? "APPLIED" : "RESUMED"); assert.equal(controller.current(outcome), true);
    assert.equal(controller.status().status, "LIVE"); assert.equal(services.length, 1);
    return { root, profile, config, global, system, ambient, controller, outcome, service: services[0], discoveries: () => discoveries };
}

test("F26b published controller status reports an active owner scan as busy", options, async t => {
    const f = await fixture(t, "install"), before = f.discoveries();
    assert.equal(f.controller.status().status, "LIVE");
    assert.equal((f.controller.status() as { busy?: boolean }).busy, false);
    f.service.busy = true;
    assert.equal((f.controller.status() as { busy?: boolean }).busy, true, "A live private push scan is work owned by this controller.");
    f.service.busy = false;
    assert.equal((f.controller.status() as { busy?: boolean }).busy, false);
    assert.equal(f.discoveries(), before);
});

for (const operation of ["install", "resume"] as const) {
    test(`F26b ${operation} unchanged projection stays live without additional discovery children`, options, async t => {
        const f = await fixture(t, operation), before = f.discoveries();
        for (let i = 0; i < 3; i++) { assert(f.service.input.valid()); assert(f.controller.current(f.outcome)); }
        assert.equal(f.controller.status().status, "LIVE"); assert.equal(f.discoveries(), before);
    });
    test(`F26b ${operation} effective local hook path drift withdraws the published owner`, options, async t => {
        const f = await fixture(t, operation), before = f.discoveries(); await writeFile(f.config, CONFIG.replace(".git/hooks", ".other-hooks"));
        assert.equal(f.service.input.valid(), false, "A retained reviewed projection cannot recapture changed hook config as a fresh baseline.");
        assert.equal(f.controller.current(f.outcome), false); assert.notEqual(f.controller.status().status, "LIVE"); assert.equal(f.discoveries(), before);
    });
    test(`F26b ${operation} previously empty global config cannot gain a hidden owner override`, options, async t => {
        const f = await fixture(t, operation), before = f.discoveries(); await writeFile(f.global, "[core]\n hooksPath = .other-hooks\n");
        assert.equal(f.service.input.valid(), false); assert.equal(f.controller.current(f.outcome), false); assert.equal(f.discoveries(), before);
    });
    test(`F26b ${operation} previously empty system config cannot gain an owner override`, options, async t => {
        const f = await fixture(t, operation), before = f.discoveries(); await writeFile(f.system, "[core]\n hooksPath = .other-hooks\n");
        assert.equal(f.service.input.valid(), false); assert.equal(f.controller.current(f.outcome), false); assert.equal(f.discoveries(), before);
    });
    test(`F26b ${operation} ordinary future refs and object metadata do not revoke unchanged hook configuration`, options, async t => {
        const f = await fixture(t, operation), before = f.discoveries();
        await writeFile(join(f.root, ".git", "refs", "heads", "main"), "1".repeat(40) + "\n", { flag: "wx" });
        await mkdir(join(f.root, ".git", "objects", "11")); await writeFile(join(f.root, ".git", "objects", "11", "1".repeat(38)), "TEST_ONLY_OBJECT_METADATA", { flag: "wx" });
        assert(f.service.input.valid(), "The lifetime hook projection must not freeze repository refs/objects needed by future legitimate commits.");
        assert(f.controller.current(f.outcome)); assert.equal(f.discoveries(), before);
    });
    test(`F26b ${operation} absent explicit global source creation revokes reviewed absence`, options, async t => {
        const f = await fixture(t, operation, { absentGlobal: true });
        await writeFile(f.global, "[core]\n hooksPath = .other-hooks\n", { flag: "wx" });
        assert.equal(f.service.input.valid(), false); assert.equal(f.controller.current(f.outcome), false);
    });
    test(`F26b ${operation} HOME default source creation revokes reviewed absence`, options, async t => {
        const f = await fixture(t, operation, { defaultGlobal: true });
        await writeFile(join(f.profile, ".gitconfig"), "[core]\n hooksPath = .other-hooks\n", { flag: "wx" });
        assert.equal(f.service.input.valid(), false); assert.equal(f.controller.current(f.outcome), false);
    });
    test(`F26b ${operation} owner discovery environment drift cannot recapture a new source`, options, async t => {
        const f = await fixture(t, operation); f.ambient.GIT_CONFIG_GLOBAL = join(f.profile, "another-source.gitconfig");
        assert.equal(f.service.input.valid(), false); assert.equal(f.controller.current(f.outcome), false);
    });
    test(`F26b ${operation} explicitly disabled system configuration is a live supported projection`, options, async t => {
        const f = await fixture(t, operation, { systemDisabled: true });
        await writeFile(f.system, "[core]\n hooksPath = .unused-disabled-system\n");
        assert(f.service.input.valid()); assert(f.controller.current(f.outcome));
    });
    test(`F26b ${operation} unknown implicit system search layout refuses before owner startup`, options, async t => {
        const f = await fixture(t, operation, { implicitSystem: true }); assert.equal(f.discoveries(), 0);
    });
    test(`F26b ${operation} unbound Windows HOME fallback refuses before owner startup`, options, async t => {
        const f = await fixture(t, operation, { implicitHome: true }); assert.equal(f.discoveries(), 0);
    });
}
