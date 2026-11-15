import * as vscode from "vscode";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { closeSync, fstatSync, ftruncateSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { managedPathIdentity, managedPolicyBinding, managedRootIdentity } from "../terminal/ManagedOutputBinding";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";
import { prepareCheckedOwnerHookContext } from "./CheckedOwnerHookContext";
import { OwnerHookDiscovery } from "./OwnerHookDiscovery";
import { buildOwnerHookEnvironment } from "./OwnerHookProtocol";
import { prepareCheckedPrePushHookFile, type CheckedPrePushHookFile } from "./CheckedPrePushHookFile";
import { hookArtifactIdentity, observeHookArtifact } from "./PrePushClient";
import { parseHookClientPin, type HookClientPin } from "./PrePushHookText";
import { PrePushHookTransaction, hookSnapshotDigest, type HookRecoveryReceipt, type HookRecoveryState, type HookFileSnapshot } from "./PrePushHookTransaction";
import { PrePushHookRestore, parseHookRecoveryReceipt } from "./PrePushHookRestore";
import { PrePushOwnerService } from "./PrePushOwnerService";
import { verifyHookDescriptor } from "./PrePushWire";
import { prePushHooksEnabled } from "./PrePushFlags";

type Status = "APPLIED" | "RESUMED" | "RESTORED" | "CANCELLED" | "UNAVAILABLE" | "ROLLED_BACK" | "INCOMPLETE";
type Outcome = Readonly<{ status: Status }>;
interface RecordValue { version: 1; pin: string; projectionFingerprint: string; receipt: HookRecoveryReceipt; state: HookRecoveryState }
interface Saved { value: Readonly<RecordValue>; raw: string; pin: Readonly<HookClientPin> }
interface Operation { root: vscode.Uri; valid(): boolean; live(): boolean; deadline: number }
interface HookProjection { hooksRelative: string; fingerprint: string; current(): boolean }
const result = (status: Status): Outcome => Object.freeze({ status });
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const recordKey = (root: string) => "soterai.prePush.record.v1." + sha(root.toLowerCase());
const keyId = (generation: string) => "soterai.prePush.signing.v1." + generation;
function key(raw: string | undefined, expected?: string): KeyObject | undefined {
    try {
        if (typeof raw !== "string" || raw.length > 256 || (expected !== undefined && raw !== expected)) return undefined;
        const bytes = Buffer.from(raw, "base64"); if (bytes.toString("base64") !== raw) return undefined;
        const value = createPrivateKey({ key: bytes, format: "der", type: "pkcs8" });
        return value.type === "private" && value.asymmetricKeyType === "ed25519" && (value.export({ format: "der", type: "pkcs8" }) as Buffer).equals(bytes) ? value : undefined;
    } catch { return undefined; }
}
function parseRecord(raw: string | undefined, root: string): Saved | undefined {
    try {
        if (typeof raw !== "string" || raw.length > 32768) return undefined;
        const value = JSON.parse(raw) as RecordValue;
        if (!value || JSON.stringify(value) !== raw || Object.keys(value).sort().join(",") !== "pin,projectionFingerprint,receipt,state,version"
            || value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.projectionFingerprint) || typeof value.pin !== "string"
            || !["PREPARED", "APPLIED", "ROLLED_BACK", "INCOMPLETE"].includes(value.state)) return undefined;
        const pinBytes = Buffer.from(value.pin, "base64"), pin = parseHookClientPin(pinBytes), receipt = parseHookRecoveryReceipt(value.receipt);
        if (!pin || !receipt || pinBytes.toString("base64") !== value.pin || pin.root !== root || receipt.root !== root || receipt.generation !== pin.generation) return undefined;
        return { value: Object.freeze({ ...value, receipt }), raw, pin };
    } catch { return undefined; }
}
function exactHook(value: HookFileSnapshot | undefined, receipt: HookRecoveryReceipt): value is HookFileSnapshot {
    return !!value && value.mode === receipt.mode && hookSnapshotDigest(value) === receipt.afterDigest;
}
function checkedDirectory(directory: string, valid: () => boolean): void {
    const missing: string[] = []; let current = directory;
    for (;;) {
        try { lstatSync(current); break; } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path.dirname(current) === current) throw Error();
            missing.push(current); current = path.dirname(current);
        }
    }
    const known = [{ directory: current, identity: managedPathIdentity(current, current, true) }];
    for (const next of missing.reverse()) {
        if (!valid() || known.some(item => managedPathIdentity(item.directory, item.directory, true) !== item.identity)) throw Error();
        mkdirSync(next); known.push({ directory: next, identity: managedPathIdentity(next, next, true) });
    }
    if (!valid() || known.some(item => managedPathIdentity(item.directory, item.directory, true) !== item.identity)) throw Error();
}
const environmentStamp = (environment: Readonly<NodeJS.ProcessEnv>) => JSON.stringify(Object.entries(environment).sort(([a], [b]) => a.localeCompare(b)));
/** Capture only the owner config search sources, not mutable refs/index/objects.
 * The supported system source must be explicit or disabled; an unknown compiled
 * default/system search layout cannot receive a lifetime projection claim. */
function configProjection(root: string, environment: Readonly<NodeJS.ProcessEnv>, live: () => boolean): (() => boolean) | undefined {
    try {
        const owner = buildOwnerHookEnvironment(process.env), expectedEnvironment = environmentStamp(environment);
        if (!owner || environmentStamp(owner) !== expectedEnvironment || !live()) return undefined;
        // An explicit HOME avoids assuming how an unbound vendor/Windows
        // fallback resolves USERPROFILE versus HOMEDRIVE/HOMEPATH.
        const files = [path.join(root, ".git", "config")], home = environment.HOME;
        if (environment.GIT_CONFIG_GLOBAL) files.push(environment.GIT_CONFIG_GLOBAL);
        else {
            if (!home) return undefined;
            files.push(path.join(home, ".gitconfig"), path.join(environment.XDG_CONFIG_HOME ?? path.join(home, ".config"), "git", "config"));
        }
        if (environment.GIT_CONFIG_NOSYSTEM !== "1") {
            if (!environment.GIT_CONFIG_SYSTEM) return undefined;
            files.push(environment.GIT_CONFIG_SYSTEM);
        }
        const unique = [...new Set(files.map(file => file.toLowerCase()))];
        const observe = (file: string): string => {
            try {
                const value = observeHookArtifact(file, 65536, live);
                return JSON.stringify(["file", value.stamp, value.digest]);
            } catch (error) {
                if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
                // lstat distinguishes absent paths from unsupported/dangling links.
                let cursor = file; const missing: string[] = [];
                for (;;) {
                    try { lstatSync(cursor); break; } catch (reason) {
                        if ((reason as NodeJS.ErrnoException)?.code !== "ENOENT" || path.dirname(cursor) === cursor) throw reason;
                        missing.push(cursor); cursor = path.dirname(cursor);
                    }
                }
                const parents: string[][] = [];
                for (let directory = cursor;;) {
                    const stat = lstatSync(directory, { bigint: true });
                    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory).toLowerCase() !== directory.toLowerCase()) throw Error();
                    parents.push([directory.toLowerCase(), stat.dev.toString(), stat.ino.toString(), stat.birthtimeNs.toString()]);
                    const parent = path.dirname(directory); if (parent === directory) break; directory = parent;
                }
                if (!live()) throw Error();
                return JSON.stringify(["absent", missing, parents]);
            }
        };
        const before = unique.map(observe); let active = true;
        const current = () => {
            if (!active) return false;
            try {
                const fresh = buildOwnerHookEnvironment(process.env);
                active = live() && !!fresh && environmentStamp(fresh) === expectedEnvironment
                    && unique.every((file, index) => observe(file) === before[index]) && live();
            } catch { active = false; }
            return active;
        };
        return current() ? current : undefined;
    } catch { return undefined; }
}

/** One local editor owns a cooperative opt-in hook. Constructor and status do
 * not recover keys or start an owner. Resume after editor restart is explicit. */
export class PrePushController implements vscode.Disposable {
    #listeners: vscode.Disposable[]; #disposed = false; #busy = false; #stopping = false; #epoch = 0;
    #service?: PrePushOwnerService; #discovery?: OwnerHookDiscovery; #closing: Promise<void> = Promise.resolve();
    #liveCheck?: () => boolean; #held?: Outcome; #heldCheck?: () => boolean;
    #poll?: ReturnType<typeof setInterval>; #activeKey?: { id: string; raw: string; service: PrePushOwnerService };
    constructor(private readonly context: vscode.ExtensionContext) {
        this.#listeners = [vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) this.withdraw(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.withdraw()), context.secrets.onDidChange(event => {
                const captured = this.#activeKey;
                if (!captured || event.key !== captured.id) return;
                // Final service signing independently reloads and compares this
                // key and the exact persisted record before every decision.
                void context.secrets.get(captured.id).then(raw => {
                    if (raw !== captured.raw && this.#activeKey === captured) this.withdraw();
                }, () => { if (this.#activeKey === captured) this.withdraw(); });
            })];
    }
    #root(): vscode.Uri {
        const folders = vscode.workspace.workspaceFolders;
        if (!vscode.workspace.isTrusted || vscode.env.remoteName || folders?.length !== 1) throw Error();
        const root = folders[0].uri;
        if (!(root instanceof vscode.Uri) || root.scheme !== "file" || root.authority || root.query || root.fragment) throw Error();
        return root;
    }
    #available(restore = false): boolean {
        try { this.#root(); return !this.#disposed && process.platform === "win32" && (restore || prePushHooksEnabled()); } catch { return false; }
    }
    status(): Readonly<{ status: "OWNER_REVIEW_REQUIRED" | "UNAVAILABLE" | "LIVE"; busy: boolean; scope: string }> {
        let live = false; try { live = !!this.#service && this.#liveCheck?.() === true; } catch { this.withdraw(); }
        return Object.freeze({ status: live ? "LIVE" : this.#available() ? "OWNER_REVIEW_REQUIRED" : "UNAVAILABLE", busy: this.#busy || this.#stopping || this.#service?.busy === true,
            scope: "Cooperative bounded pushed-history analysis with explicit or disabled system Git configuration; unsupported layouts are withheld. Owner absence blocks. Explicit reviewed restore remains available while disabled; deliberate bypass and final push races remain." });
    }
    current(value: unknown): boolean {
        if (!value || value !== this.#held || !this.#heldCheck) return false;
        try { if (this.#heldCheck()) return true; } catch { /* generic refusal */ }
        this.withdraw(); return false;
    }
    #stopService(): Promise<void> {
        clearInterval(this.#poll); this.#poll = undefined; this.#liveCheck = undefined; this.#activeKey = undefined;
        const service = this.#service; this.#service = undefined;
        if (service) {
            this.#stopping = true;
            const closing = Promise.all([this.#closing, service.close()]).then(() => undefined); this.#closing = closing;
            void closing.then(() => { if (this.#closing === closing) this.#stopping = false; });
        }
        return this.#closing;
    }
    withdraw(): void {
        this.#epoch++; this.#held = undefined; this.#heldCheck = undefined;
        this.#discovery?.withdraw(); void this.#stopService();
    }
    dispose(): void { this.#disposed = true; this.withdraw(); this.#listeners.forEach(listener => listener.dispose()); }
    #run(restore: boolean, work: (operation: Operation) => Promise<Outcome>): Promise<Outcome> {
        if (this.#busy || this.#stopping || !this.#available(restore)) return Promise.resolve(result("UNAVAILABLE"));
        this.#busy = true; this.#held = undefined; this.#heldCheck = undefined;
        const root = this.#root(), epoch = this.#epoch, deadline = performance.now() + 60000;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const action = (async () => {
            await BoundarySnapshot.load();
            const rootIdentity = managedRootIdentity(root), policy = managedPolicyBinding(root); let alive = true, last = performance.now();
            const live = () => {
                if (!alive) return false;
                try { alive = this.#available(restore) && this.#epoch === epoch && this.#root().toString() === root.toString()
                    && managedRootIdentity(root) === rootIdentity && managedPolicyBinding(root) === policy; } catch { alive = false; }
                return alive;
            };
            const valid = () => { const now = performance.now(); return Number.isFinite(now) && now >= last && (last = now) < deadline && live(); };
            if (!valid()) return result("UNAVAILABLE");
            return await work({ root, deadline, live, valid });
        })().catch(() => result("UNAVAILABLE")).finally(() => { clearTimeout(timer); this.#busy = false; });
        const timeout = new Promise<Outcome>(resolve => { timer = setTimeout(() => { this.withdraw(); resolve(result("UNAVAILABLE")); }, 60000); });
        return Promise.race([action, timeout]);
    }
    async #query(operation: Operation): Promise<Readonly<HookProjection> | undefined> {
        const context = await prepareCheckedOwnerHookContext(operation.root.fsPath, process.env, operation.valid);
        if (!context || !operation.valid()) return undefined;
        const current = configProjection(operation.root.fsPath, context.environment, operation.live);
        if (!current || !operation.valid()) return undefined;
        const discovery = new OwnerHookDiscovery({ context, valid: operation.valid, deadline: operation.deadline }); this.#discovery = discovery;
        try {
            const value = await discovery.start(); await discovery.closed;
            return value.status === "COMPLETE" && discovery.canRelease(value) && current() && operation.valid()
                ? Object.freeze({ hooksRelative: value.hooksRelative, fingerprint: value.fingerprint, current }) : undefined;
        } finally { if (this.#discovery === discovery) this.#discovery = undefined; }
    }
    #artifacts(valid: () => boolean): { worker: string; runtime: string; workerSha256: string; runtimeSha256: string; current(): boolean } {
        const worker = vscode.Uri.joinPath(this.context.extensionUri, "dist", "pre-commit-client.js").fsPath, runtime = process.execPath;
        const w = observeHookArtifact(worker, 2097152, valid), r = observeHookArtifact(runtime, 536870912, valid);
        return { worker, runtime, workerSha256: w.digest, runtimeSha256: r.digest,
            current: () => valid() && hookArtifactIdentity(worker, 2097152) === w.stamp && hookArtifactIdentity(runtime, 536870912) === r.stamp && valid() };
    }
    async #save(value: RecordValue, state: HookRecoveryState, holder: { raw?: string }): Promise<void> {
        const id = recordKey(value.receipt.root), previous = holder.raw;
        if (await this.context.secrets.get(id) !== previous) throw Error();
        const raw = JSON.stringify({ ...value, state });
        const fixed = "soterai.prePush.recovery.v1." + value.receipt.generation + "." + state;
        const retained = await this.context.secrets.get(fixed);
        if (retained !== undefined && retained !== raw) throw Error();
        if (retained === undefined) {
            await this.context.secrets.store(fixed, raw);
            if (await this.context.secrets.get(fixed) !== raw) throw Error();
        }
        if (await this.context.secrets.get(id) !== previous) throw Error();
        // Retain each private recovery revision separately, even if another
        // editor races the non-atomic SecretStorage active-record pointer.
        const journal = "soterai.prePush.receipt.v1." + value.receipt.generation + "." + randomUUID();
        if (await this.context.secrets.get(journal) !== undefined) throw Error();
        await this.context.secrets.store(journal, raw);
        if (await this.context.secrets.get(journal) !== raw) throw Error();
        const indexKey = "soterai.prePush.receipts.v1", priorIndex = this.context.globalState.get<unknown>(indexKey, []);
        if (!Array.isArray(priorIndex) || priorIndex.length >= 4096 || priorIndex.some(item => typeof item !== "string"
            || !/^soterai\.prePush\.receipt\.v1\.[a-f0-9-]{36}\.[a-f0-9-]{36}$/.test(item))) throw Error();
        await this.context.globalState.update(indexKey, [...priorIndex, journal]);
        if (await this.context.secrets.get(id) !== previous) throw Error();
        holder.raw = raw;
        await this.context.secrets.store(id, raw);
        if (await this.context.secrets.get(id) !== raw) throw Error();
    }
    #descriptor(pin: HookClientPin, bytes: Buffer, valid: () => boolean): void {
        const storage = this.context.globalStorageUri;
        // Desktop profile storage uses the local vscode-userdata mapping.
        // Keep native descriptor access limited to an ordinary local drive
        // with an exact URI/path round trip; physical ancestry checks follow.
        if (!["file", "vscode-userdata"].includes(storage.scheme) || vscode.env.remoteName
            || storage.authority || storage.query || storage.fragment || !path.isAbsolute(storage.fsPath)
            || !/^[a-z]:[\\/]/i.test(storage.fsPath)
            || vscode.Uri.file(storage.fsPath).path.toLowerCase() !== storage.path.toLowerCase()) throw Error();
        const relative = path.relative(pin.root, storage.fsPath);
        if (!relative || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)) throw Error();
        const directory = path.join(storage.fsPath, "pre-push");
        if (pin.descriptor !== path.join(directory, pin.generation + ".json")) throw Error();
        checkedDirectory(directory, valid); const directoryIdentity = managedPathIdentity(directory, directory, true);
        let fd: number | undefined;
        try {
            let before: ReturnType<typeof observeHookArtifact> | undefined;
            try { lstatSync(pin.descriptor); before = observeHookArtifact(pin.descriptor, 8192, valid, true); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            if (before && !verifyHookDescriptor(before.bytes, pin.publicKey, { root: pin.root, generation: pin.generation,
                workerSha256: pin.workerSha256, runtimeSha256: pin.runtimeSha256 })) throw Error();
            fd = openSync(pin.descriptor, before ? "r+" : "wx", 0o600);
            const stat = fstatSync(fd);
            if (!stat.isFile() || stat.nlink !== 1 || !valid() || managedPathIdentity(directory, directory, true) !== directoryIdentity
                || before && hookArtifactIdentity(pin.descriptor, 8192) !== before.stamp || lstatSync(pin.descriptor).ino !== stat.ino) throw Error();
            writeFileSync(fd, bytes); ftruncateSync(fd, bytes.length);
            closeSync(fd); fd = undefined;
            const observed = observeHookArtifact(pin.descriptor, 8192, valid, true);
            if (!observed.bytes?.equals(bytes) || managedPathIdentity(directory, directory, true) !== directoryIdentity || !valid()) throw Error();
        } finally { if (fd !== undefined) closeSync(fd); }
    }
    async #owner(pin: HookClientPin, valid: () => boolean, holder: { raw?: string }, privateRaw?: string): Promise<PrePushOwnerService> {
        await this.#stopService(); if (!valid()) throw Error();
        const signing = privateRaw ?? await this.context.secrets.get(keyId(pin.generation));
        const loaded = key(signing); if (!loaded || !signing || (createPublicKey(loaded).export({ format: "der", type: "spki" }) as Buffer).toString("base64") !== pin.publicKey || !valid()) throw Error();
        const service = new PrePushOwnerService({ root: pin.root, generation: pin.generation, workerSha256: pin.workerSha256,
            runtimeSha256: pin.runtimeSha256, valid, loadKey: async () => {
                const current = await this.context.secrets.get(keyId(pin.generation));
                if (holder.raw !== undefined && await this.context.secrets.get(recordKey(pin.root)) !== holder.raw) return undefined;
                return valid() ? key(current, signing) : undefined;
            } }); this.#service = service;
        try {
            const descriptor = await service.start(); if (!descriptor || !valid()) throw Error();
            this.#descriptor(pin, descriptor, valid);
            this.#activeKey = { id: keyId(pin.generation), raw: signing, service }; return service;
        } catch { if (this.#service === service) await this.#stopService(); else await service.close(); throw Error(); }
    }
    #publish(status: "APPLIED" | "RESUMED" | "RESTORED", check: () => boolean): Outcome {
        if (!check()) { this.withdraw(); return result("UNAVAILABLE"); }
        this.#held = result(status); this.#heldCheck = check;
        if (status !== "RESTORED") {
            this.#liveCheck = check;
            this.#poll = setInterval(() => { try { if (!check()) this.withdraw(); } catch { this.withdraw(); } }, 100); this.#poll.unref?.();
        }
        return this.#held;
    }
    install(): Promise<Outcome> { return this.#run(false, async operation => {
        const existing = await this.context.secrets.get(recordKey(operation.root.fsPath));
        if (existing !== undefined && parseRecord(existing, operation.root.fsPath)?.value.state !== "ROLLED_BACK" || !operation.valid()) return result("UNAVAILABLE");
        const projection = await this.#query(operation); if (!projection) return result("UNAVAILABLE");
        const file = prepareCheckedPrePushHookFile(operation.root.fsPath, projection.hooksRelative, operation.live), before = file?.read();
        if (!file || !before) return result("UNAVAILABLE");
        const artifacts = this.#artifacts(operation.live), generation = randomUUID();
        const transaction = new PrePushHookTransaction({ root: operation.root.fsPath, hooksRelative: projection.hooksRelative, generation,
            projectionFingerprint: projection.fingerprint, before, workerSha256: artifacts.workerSha256, runtimeSha256: artifacts.runtimeSha256 });
        let rawPin: Buffer | undefined, installed: HookRecoveryReceipt | undefined, preparedService: PrePushOwnerService | undefined;
        const holder: { raw?: string } = { raw: existing };
        const ownerValid = () => operation.live() && projection.current() && artifacts.current() && (!installed || exactHook(file.read(), installed));
        const outcome = await transaction.run({ current: () => operation.valid() && artifacts.current(), read: () => file.read(),
            confirm: async preview => (await vscode.window.showWarningMessage("Install the owning editor's pre-push guard?", { modal: true,
                detail: "Hook: " + preview.hookRelative + ". Existing supported shell body and mode are preserved with encrypted recovery. Full reachable branch history:32 commits,128 blobs,64KiB per blob,1MiB total,60 seconds. Commit messages and tags are outside this blob-only check. Unknown or unsupported data withholds pushes. Git system configuration must be explicit or disabled; unknown search layouts are refused. The owning editor must remain available; deliberate bypass and final push races remain. No registered-value guarantee." }, "Review and install")) === "Review and install",
            queryProjection: async () => {
                const projection = await this.#query(operation);
                return await this.context.secrets.get(recordKey(operation.root.fsPath)) === holder.raw ? projection?.fingerprint : undefined;
            },
            prepare: async () => {
                if (await this.context.secrets.get(recordKey(operation.root.fsPath)) !== holder.raw || !operation.valid()) return undefined;
                const pair = generateKeyPairSync("ed25519"), raw = (pair.privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64");
                if (!operation.valid() || await this.context.secrets.get(keyId(generation)) !== undefined) return undefined;
                await this.context.secrets.store(keyId(generation), raw);
                if (await this.context.secrets.get(keyId(generation)) !== raw || !operation.valid()) return undefined;
                rawPin = Buffer.from(JSON.stringify({ version: 1, root: operation.root.fsPath, generation, publicKey: (pair.publicKey.export({ format: "der", type: "spki" }) as Buffer).toString("base64"),
                    worker: artifacts.worker, workerSha256: artifacts.workerSha256, runtime: artifacts.runtime, runtimeSha256: artifacts.runtimeSha256,
                    descriptor: path.join(this.context.globalStorageUri.fsPath, "pre-push", generation + ".json"), systemRoot: process.env.SystemRoot ?? process.env.WINDIR }));
                const pin = parseHookClientPin(rawPin); if (!pin) return undefined;
                const service = await this.#owner(pin, ownerValid, holder, raw); preparedService = service;
                return { pin: rawPin, withdraw: async () => { if (this.#service === service) await this.#stopService(); else await service.close(); } };
            }, backups: new EncryptedBackupSink(this.context, { scope: generation }), write: (expected, bytes, mode) => file.write(expected, bytes, mode),
            save: async (receipt, state) => {
                if (!rawPin) throw Error();
                await this.#save({ version: 1, pin: rawPin.toString("base64"), projectionFingerprint: projection.fingerprint, receipt, state }, state, holder);
                if (state === "APPLIED") installed = receipt;
            } });
        if (outcome.status !== "APPLIED" || !installed) return outcome;
        return this.#publish("APPLIED", () => !!preparedService && this.#service === preparedService && preparedService.available && ownerValid());
    }); }
    resume(): Promise<Outcome> { return this.#run(false, async operation => {
        const saved = parseRecord(await this.context.secrets.get(recordKey(operation.root.fsPath)), operation.root.fsPath);
        if (!saved || saved.value.state !== "APPLIED" || !operation.valid()) return result("UNAVAILABLE");
        const projection = await this.#query(operation); if (!projection || projection.hooksRelative !== saved.value.receipt.hooksRelative || projection.fingerprint !== saved.value.projectionFingerprint) return result("UNAVAILABLE");
        const file = prepareCheckedPrePushHookFile(operation.root.fsPath, projection.hooksRelative, operation.live), before = file?.read(), artifacts = this.#artifacts(operation.live);
        if (!file || !exactHook(before, saved.value.receipt) || saved.pin.worker !== artifacts.worker || saved.pin.runtime !== artifacts.runtime
            || saved.pin.workerSha256 !== artifacts.workerSha256 || saved.pin.runtimeSha256 !== artifacts.runtimeSha256) return result("UNAVAILABLE");
        const action = "Resume reviewed owner";
        const choice = await vscode.window.showWarningMessage("Resume this editor as pre-push owner?", { modal: true,
            detail: "Hook: " + projection.hooksRelative + "/pre-push. Reuse the reviewed public pins, existing signing key and encrypted recovery. A new signed local session replaces the previous endpoint. Owner absence and unsupported proposed-history data withhold pushes; deliberate bypass remains." }, action);
        if (!operation.valid()) return result("UNAVAILABLE"); if (choice !== action) return result("CANCELLED");
        if ((await this.#query(operation))?.fingerprint !== projection.fingerprint
            || await this.context.secrets.get(recordKey(operation.root.fsPath)) !== saved.raw || file.read()?.identity !== before.identity || !operation.valid()) return result("UNAVAILABLE");
        const valid = () => operation.live() && projection.current() && artifacts.current() && exactHook(file.read(), saved.value.receipt);
        const service = await this.#owner(saved.pin, valid, { raw: saved.raw });
        return this.#publish("RESUMED", () => this.#service === service && service.available && valid());
    }); }
    restore(): Promise<Outcome> { return this.#run(true, async operation => {
        const saved = parseRecord(await this.context.secrets.get(recordKey(operation.root.fsPath)), operation.root.fsPath);
        if (!saved || saved.value.state === "ROLLED_BACK" || !operation.valid()) return result("UNAVAILABLE");
        const file: CheckedPrePushHookFile | undefined = prepareCheckedPrePushHookFile(operation.root.fsPath, saved.value.receipt.hooksRelative, operation.live);
        if (!file) return result("UNAVAILABLE");
        const holder = { raw: saved.raw };
        const backups = new EncryptedBackupSink(this.context, { scope: saved.pin.generation });
        const outcome = await new PrePushHookRestore(saved.value.receipt).run({ current: operation.valid, read: () => file.read(),
            confirm: async preview => (await vscode.window.showWarningMessage("Restore the original pre-push hook?", { modal: true,
                detail: "Hook: " + preview.hookRelative + ". Restore only exact owned bytes from encrypted recovery; preserve owner edits as incomplete. The selected hook is removed only if it was originally absent. Recovery records remain retained." }, "Review and restore")) === "Review and restore",
            backups: { retrieve: async handle => {
                if (await this.context.secrets.get(recordKey(operation.root.fsPath)) !== holder.raw) return null;
                const payload = await backups.retrieve(handle);
                return await this.context.secrets.get(recordKey(operation.root.fsPath)) === holder.raw ? payload : null;
            } }, withdraw: async () => {
                if (await this.context.secrets.get(recordKey(operation.root.fsPath)) !== holder.raw) throw Error();
                await this.#stopService();
            },
            save: (receipt, state) => this.#save({ ...saved.value, receipt }, state, holder), write: (expected, bytes, mode) => file.write(expected, bytes, mode) });
        if (outcome.status !== "RESTORED") return outcome;
        const digest = saved.value.receipt.beforeDigest;
        return this.#publish("RESTORED", () => operation.live() && (() => { const current = file.read(); return !!current && hookSnapshotDigest(current) === digest; })());
    }); }
}
