import "./phase2/register.mjs";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import childProcess from "node:child_process";
import net from "node:net";
import type * as vscode from "vscode";
import type { RemovalAction, RemovalOwner } from "../lifecycle/RemovalCoordinator";
import * as stub from "./phase2/vscode-stub";

// TEST FIRST: synthetic metadata/settings/SecretStorage and retained temp files.
// No normal home/vendor profile, native runtime, real secret, decryption or cleanup.
// Inventory proves only known managed journals; absent journals do not prove that
// no unknown legacy/manual changes exist outside the declared recovery inventory.
interface ProbeModule {
    RecoveryInventory: new(context: vscode.ExtensionContext) => {
        probe(action: RemovalAction, owner: RemovalOwner): Promise<unknown>;
    };
}
const PRIVATE = "SYNTHETIC_ONLY_F32_INVENTORY_PRIVATE_54abf8";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const ALL: readonly RemovalAction[] = ["checkedPowerShell", "checkedCmd", "checkedGitBash", "secureEditorAssociation",
    "codexCli", "codexIde", "geminiCli", "preCommit", "prePush", "psReadLine", "cline", "claude", "legacyBroker", "legacyAIConfigs"];
const TERMINALS = [
    ["checkedPowerShell", "soterai.lite.ps51.profile.v1", "SoterAI PowerShell 5.1 (checked commands)"],
    ["checkedCmd", "soterai.lite.cmd.profile.v1", "SoterAI cmd (checked commands)"],
    ["checkedGitBash", "soterai.lite.gitBash.profile.v1", "SoterAI Git Bash (checked commands)"],
] as const;
const DEDICATED = [
    ["codexCli", "codex-cli", "soterai.lite.codexCliAdapter.receipt.v1"],
    ["codexIde", "codex-ide", "soterai.lite.codexIdeAdapter.receipt.v1"],
    ["geminiCli", "gemini-cli", "soterai.lite.geminiCliAdapter.receipt.v1"],
] as const;
const ASSOCIATIONS = "soterai.lite.secureEditor.association.v1:";
function state(value: unknown): string {
    assert(value && typeof value === "object"); return (value as { state: string }).state;
}
function absent(value: unknown): void { assert.deepEqual(value, { state: "ABSENT" }); }
function pending(value: unknown): void { assert.deepEqual(value, { state: "PENDING" }); }
function owned(value: unknown, root: string): string {
    assert(value && typeof value === "object"); const row = value as Record<string, unknown>;
    assert.deepEqual(Object.keys(row).sort(), ["receiptFingerprint", "root", "schemaVersion", "state"]);
    assert.equal(row.state, "OWNED"); assert.equal(row.schemaVersion, 1); assert.equal(row.root, root);
    assert.match(String(row.receiptFingerprint), /^[a-f0-9]{64}$/); safe(value); return String(row.receiptFingerprint);
}
function safe(value: unknown): void { assert(!JSON.stringify(value).includes(PRIVATE)); }
async function fixture(t: TestContext) {
    // Missing production capability remains a real dynamic-import baseline.
    const module = await import("../lifecycle/RecoveryInventory") as ProbeModule;
    const original = {
        mkdir: fs.mkdirSync.bind(fs), write: fs.writeFileSync.bind(fs), read: fs.readFileSync.bind(fs),
        open: fs.openSync.bind(fs), readdir: fs.readdirSync.bind(fs), symlink: fs.symlinkSync.bind(fs),
        asyncRead: fsp.readFile.bind(fsp), asyncOpen: fsp.open.bind(fsp), asyncReaddir: fsp.readdir.bind(fsp),
    };
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "soterai-f32-inventory-")));
    const root = path.join(directory, "workspace"), profile = path.join(directory, "profile");
    original.mkdir(root); original.mkdir(profile);
    stub.resetState(root);
    const context = stub.makeExtensionContext(profile), storage = context.globalStorageUri.fsPath;
    original.mkdir(storage, { recursive: true });
    const remote = Object.getOwnPropertyDescriptor(stub.env, "remoteName");
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    t.after(() => {
        context.subscriptions.forEach(item => item.dispose());
        if (remote) Object.defineProperty(stub.env, "remoteName", remote); else delete (stub.env as { remoteName?: string }).remoteName;
        // All synthetic files, profiles, journals and recovery fixtures are retained.
    });
    const owner: RemovalOwner = { root: stub.Uri.file(root).toString(), local: true, trusted: true, revision: 1 };
    const reads: string[] = [], enumerated: string[] = [], keys: string[] = [], expected = new Map<string, string>();
    const counts = { writes: 0, keyWrites: 0, children: 0, listeners: 0, commands: 0, ui: 0 };
    let fixtureIO = false;
    const fixtureOnly = <T>(operation: () => T): T => { fixtureIO = true; try { return operation(); } finally { fixtureIO = false; } };
    const canonical = (file: unknown) => file instanceof URL ? path.resolve(file.pathname) : path.resolve(String(file));
    const checkRead = (file: unknown) => {
        if (fixtureIO) return; // Test-owned setup/hash checks, never product probe IO.
        if (typeof file === "number") return;
        const target = canonical(file); reads.push(target);
        assert(target.startsWith(directory + path.sep), "Inventory attempted to read outside its synthetic fixture.");
        assert(["recovery.json", "psreadline-history-state-v1.json"].includes(path.basename(target)), "Inventory opened config/profile/other contents instead of metadata.");
    };
    t.mock.method(fs, "readFileSync", ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
        checkRead(file); return (original.read as (...args: unknown[]) => unknown)(file, ...args);
    }) as typeof fs.readFileSync);
    t.mock.method(fs, "openSync", ((file: fs.PathLike, ...args: unknown[]) => {
        checkRead(file); return (original.open as (...args: unknown[]) => unknown)(file, ...args);
    }) as typeof fs.openSync);
    t.mock.method(fsp, "readFile", (async (file: unknown, ...args: unknown[]) => {
        checkRead(file); return (original.asyncRead as (...args: unknown[]) => Promise<unknown>)(file, ...args);
    }) as typeof fsp.readFile);
    t.mock.method(fsp, "open", (async (file: unknown, ...args: unknown[]) => {
        checkRead(file); return (original.asyncOpen as (...args: unknown[]) => Promise<unknown>)(file, ...args);
    }) as typeof fsp.open);
    const checkDirectory = (file: unknown) => {
        const target = canonical(file); enumerated.push(target);
        assert(target === storage || target.startsWith(storage + path.sep), "Inventory enumerated an unowned normal profile.");
    };
    t.mock.method(fs, "readdirSync", ((file: fs.PathLike, ...args: unknown[]) => {
        checkDirectory(file); return (original.readdir as (...args: unknown[]) => unknown)(file, ...args);
    }) as typeof fs.readdirSync);
    t.mock.method(fsp, "readdir", (async (file: unknown, ...args: unknown[]) => {
        checkDirectory(file); return (original.asyncReaddir as (...args: unknown[]) => Promise<unknown>)(file, ...args);
    }) as typeof fsp.readdir);
    const noWrite = () => { counts.writes++; throw Error(PRIVATE); };
    for (const name of ["writeFileSync", "mkdirSync", "unlinkSync", "renameSync", "rmdirSync", "rmSync"] as const) t.mock.method(fs, name, noWrite as never);
    for (const name of ["writeFile", "mkdir", "unlink", "rename", "rmdir", "rm"] as const) t.mock.method(fsp, name, noWrite as never);
    const hookKey = (id: "preCommit" | "prePush") => "soterai." + id + ".record.v1." + sha(root.toLowerCase());
    t.mock.method(context.secrets, "get", async (key: string) => {
        keys.push(key); assert([hookKey("preCommit"), hookKey("prePush")].includes(key), "Inventory requested a signing key or encrypted config-backup key.");
        return context._inspect.secretStore.get(key);
    });
    t.mock.method(context.secrets, "store", async () => { counts.keyWrites++; throw Error(PRIVATE); });
    t.mock.method(context.secrets, "delete", async () => { counts.keyWrites++; throw Error(PRIVATE); });
    t.mock.method(context.globalState, "update", async () => noWrite());
    t.mock.method(context.workspaceState, "update", async () => noWrite());
    t.mock.method(childProcess, "spawn", (() => { counts.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(childProcess, "execFile", (() => { counts.children++; throw Error(PRIVATE); }) as never);
    t.mock.method(net.Server.prototype, "listen", (() => { counts.listeners++; throw Error(PRIVATE); }) as never);
    t.mock.method(stub.commands, "executeCommand", async () => { counts.commands++; throw Error(PRIVATE); });
    for (const name of ["showWarningMessage", "showInformationMessage", "showErrorMessage"] as const)
        t.mock.method(stub.window, name, async () => { counts.ui++; throw Error(PRIVATE); });
    const inventory = new module.RecoveryInventory(context as unknown as vscode.ExtensionContext);
    const write = (file: string, content: string) => {
        assert(file.startsWith(directory + path.sep)); fixtureOnly(() => {
            original.mkdir(path.dirname(file), { recursive: true }); original.write(file, content, { flag: "wx" });
        }); expected.set(file, sha(content)); return file;
    };
    const replace = (file: string, content: string) => { fixtureOnly(() => original.write(file, content)); expected.set(file, sha(content)); };
    const profileRecord = (id: "codexCli" | "codexIde" | "geminiCli", options: { live?: boolean; recovery?: boolean; root?: string; directory?: string } = {}) => {
        const family = DEDICATED.find(row => row[0] === id)!;
        const home = options.directory ?? path.join(storage, "adapter-sessions", family[1] + "-" + randomUUID());
        original.mkdir(home, { recursive: true });
        const receipt = { version: 1, owner: sha(home + owner.root), backup: "b".repeat(32), beforeDigest: sha("absent"), afterDigest: sha("present"),
            ...(id === "geminiCli" ? { settingsDigest: sha("settings"), environmentDigest: sha("environment") } : {}) };
        const saved = { version: 1, root: options.root ?? owner.root, profileDirectory: home, receipt };
        if (options.recovery !== false) write(path.join(home, "recovery.json"), JSON.stringify(saved));
        if (options.live !== false) {
            if (id === "geminiCli") { write(path.join(home, ".gemini", "settings.json"), PRIVATE); write(path.join(home, ".gemini", ".env"), PRIVATE); }
            else write(path.join(home, "config.toml"), PRIVATE);
        }
        return { home, saved, family };
    };
    const journal = (phase = "APPLIED") => JSON.stringify({ schemaVersion: 1, generation: randomUUID(), identity: sha("synthetic-profile-identity"),
        phase, existed: false, beforeDigest: sha(Buffer.alloc(0)), afterDigest: sha("synthetic-handler"), backupHandle: null }) + "\n";
    const hookRecord = (phase = "APPLIED", recordRoot = root) => {
        const generation = randomUUID(), publicKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "der" }).toString("base64");
        const pin = { version: 1, root: recordRoot, generation, publicKey, worker: path.join(storage, "pre-commit-client.js"),
            workerSha256: "a".repeat(64), runtime: path.join(storage, "synthetic-node.exe"), runtimeSha256: "b".repeat(64),
            descriptor: path.join(storage, "owner", generation, "descriptor.json"), systemRoot: "C:\\Windows" };
        const receipt = { version: 1, generation, root: recordRoot, hooksRelative: ".soterai-hooks", backup: "c".repeat(32),
            beforeDigest: "d".repeat(64), afterDigest: "e".repeat(64), originalPresent: false, mode: 0o755 };
        return JSON.stringify({ version: 1, pin: Buffer.from(JSON.stringify(pin)).toString("base64"), projectionFingerprint: "f".repeat(64), receipt, state: phase });
    };
    const unchanged = () => {
        assert.deepEqual(counts, { writes: 0, keyWrites: 0, children: 0, listeners: 0, commands: 0, ui: 0 });
        for (const [file, hash] of expected) assert.equal(fixtureOnly(() => sha(original.read(file))), hash, "Synthetic retained fixture bytes changed.");
        safe(stub.capturedText());
    };
    return { context, inventory, owner, root, directory, storage, counts, reads, enumerated, keys, write, replace, original,
        profileRecord, journal, hookKey, hookRecord, unchanged,
        probe: (id: RemovalAction, captured = owner) => inventory.probe(id, captured),
        setting: (name: string | null | undefined) => stub.state.configInspect.set("terminal.integrated.defaultProfile.windows", { workspaceValue: name }),
        associations: (value: Record<string, string>) => stub.state.configInspect.set("workbench.editorAssociations", { workspaceValue: value }),
    };
}

test("F32-I01 inventory construction is inert without metadata reads keys writes or discovery", async t => {
    const f = await fixture(t); assert.equal(f.reads.length, 0); assert.equal(f.enumerated.length, 0); assert.equal(f.keys.length, 0); f.unchanged();
});

test("F32-I02 empty known journals and ordinary project settings establish scoped absence for all fixed actions", async t => {
    const f = await fixture(t); f.setting("Windows PowerShell"); f.associations({ "*.md": "default" });
    for (const id of ALL) absent(await f.probe(id));
    assert(f.keys.every(key => [f.hookKey("preCommit"), f.hookKey("prePush")].includes(key))); f.unchanged();
});

test("F32-I03 three exact terminal receipts bind owner and stable opaque fingerprints", async t => {
    const f = await fixture(t);
    for (const [id, key, name] of TERMINALS) {
        f.setting(name); f.context._inspect.workspaceStore.set(key, { schemaVersion: 1, root: f.owner.root, target: stub.ConfigurationTarget.Workspace,
            phase: "APPLIED", before: { present: false }, after: name });
        const first = owned(await f.probe(id), f.owner.root), second = owned(await f.probe(id), f.owner.root); assert.equal(first, second);
        f.context._inspect.workspaceStore.set(key, { schemaVersion: 1, root: f.owner.root, target: stub.ConfigurationTarget.Workspace,
            phase: "APPLIED", before: { present: true, value: null }, after: name });
        assert.notEqual(owned(await f.probe(id), f.owner.root), first);
    }
    f.unchanged();
});

test("F32-I04 checked terminal names without receipts are ambiguous rather than absent", async t => {
    const f = await fixture(t); for (const [id, , name] of TERMINALS) { f.setting(name); pending(await f.probe(id)); } f.unchanged();
});

test("F32-I05 foreign malformed PREPARED and changed terminal metadata cannot erase recovery", async t => {
    const f = await fixture(t), [id, key, name] = TERMINALS[0]; f.setting(name);
    const base = { schemaVersion: 1, root: f.owner.root, target: stub.ConfigurationTarget.Workspace, phase: "APPLIED", before: { present: false }, after: name };
    for (const value of [{ ...base, root: stub.Uri.file(path.join(f.directory, "foreign")).toString() }, { ...base, schemaVersion: 99 }, { raw: PRIVATE }]) {
        f.context._inspect.workspaceStore.set(key, value); pending(await f.probe(id));
    }
    f.context._inspect.workspaceStore.set(key, { ...base, phase: "PREPARED" }); assert.notEqual(state(await f.probe(id)), "ABSENT");
    f.context._inspect.workspaceStore.set(key, base); f.setting("A changed owner profile"); pending(await f.probe(id)); f.unchanged();
});

test("F32-I06 secure-editor associations require both exact receipt and current owned mappings", async t => {
    const f = await fixture(t), key = ASSOCIATIONS + f.owner.root;
    f.associations({ "**/.env": "soterai.secureEditor", "**/.env.*": "soterai.secureEditor", "*.md": "default" });
    pending(await f.probe("secureEditorAssociation"));
    f.context._inspect.workspaceStore.set(key, { schemaVersion: 1, root: f.owner.root, target: stub.ConfigurationTarget.Workspace,
        before: { "**/.env": null, "**/.env.*": "default" } });
    owned(await f.probe("secureEditorAssociation"), f.owner.root);
    f.associations({ "**/.env": "other.owner", "**/.env.*": "soterai.secureEditor" }); pending(await f.probe("secureEditorAssociation")); f.unchanged();
});

test("F32-I07 foreign and unknown editor-association receipts remain pending even with ordinary current mappings", async t => {
    const f = await fixture(t); f.associations({ "*.md": "default" }); absent(await f.probe("secureEditorAssociation"));
    f.context._inspect.workspaceStore.set(ASSOCIATIONS + f.owner.root, { schemaVersion: 99, root: PRIVATE });
    pending(await f.probe("secureEditorAssociation")); f.unchanged();
});

test("F32-I08 dedicated profiles recover from private metadata despite missing Mementos without opening config text", async t => {
    const f = await fixture(t); for (const [id] of DEDICATED) { f.profileRecord(id); owned(await f.probe(id), f.owner.root); }
    assert(f.reads.every(file => path.basename(file) === "recovery.json")); f.unchanged();
});

test("F32-I09 live dedicated configs without recovery and saved receipts with missing config stay pending", async t => {
    const f = await fixture(t); f.profileRecord("codexCli", { recovery: false }); pending(await f.probe("codexCli"));
    const profile = f.profileRecord("codexIde", { live: false }); f.context._inspect.globalStore.set(profile.family[2], profile.saved);
    pending(await f.probe("codexIde")); f.unchanged();
});

test("F32-I10 retained recovery after config removal is evidence rather than a live route when no Memento remains", async t => {
    const f = await fixture(t); for (const [id] of DEDICATED) { f.profileRecord(id, { live: false }); absent(await f.probe(id)); } f.unchanged();
});

test("F32-I11 foreign malformed and multiple dedicated live profiles cannot choose ownership by guesswork", async t => {
    const f = await fixture(t); f.profileRecord("codexCli", { root: stub.Uri.file(path.join(f.directory, "foreign")).toString() });
    pending(await f.probe("codexCli"));
    const corrupt = f.profileRecord("codexIde"); f.replace(path.join(corrupt.home, "recovery.json"), "{broken synthetic metadata"); pending(await f.probe("codexIde"));
    f.profileRecord("geminiCli"); f.profileRecord("geminiCli"); pending(await f.probe("geminiCli")); f.unchanged();
});

test("F32-I12 dedicated discovery is bounded and refuses linked profile directories", async t => {
    const f = await fixture(t);
    for (let i = 0; i < 33; i++) f.profileRecord("codexCli", { recovery: false }); pending(await f.probe("codexCli"));
    const actual = f.profileRecord("codexIde", { directory: path.join(f.directory, "retained-private-target") });
    const link = path.join(f.storage, "adapter-sessions", "codex-ide-" + randomUUID());
    f.original.symlink(actual.home, link, "junction"); pending(await f.probe("codexIde")); f.unchanged();
});

test("F32-I13 genuine local vscode-userdata storage works while foreign storage URI components refuse", async t => {
    const f = await fixture(t); f.profileRecord("codexCli");
    Object.defineProperty(f.context, "globalStorageUri", { configurable: true, value: stub.Uri.file(f.storage).with({ scheme: "vscode-userdata" }) });
    owned(await f.probe("codexCli"), f.owner.root);
    for (const uri of [stub.Uri.parse("vscode-userdata://foreign" + stub.Uri.file(f.storage).path), stub.Uri.file(f.storage).with({ scheme: "memfs" })]) {
        Object.defineProperty(f.context, "globalStorageUri", { configurable: true, value: uri }); pending(await f.probe("codexCli"));
    }
    f.unchanged();
});

test("F32-I14 either Gemini settings or environment presence prevents a false absent inventory", async t => {
    const f = await fixture(t);
    for (const name of ["settings.json", ".env"]) {
        const directory = path.join(f.storage, "adapter-sessions", "gemini-cli-" + randomUUID());
        f.write(path.join(directory, ".gemini", name), PRIVATE);
    }
    pending(await f.probe("geminiCli")); assert(!f.reads.some(file => /settings\.json$|\.env$/.test(file))); f.unchanged();
});

test("F32-I15 PSReadLine uses the actual checked metadata journal and ignores obsolete Memento authority", async t => {
    const f = await fixture(t); f.context._inspect.globalStore.set("soterai.lite.psReadLineHistory.receipt.v1", { rawProfile: PRIVATE });
    absent(await f.probe("psReadLine"));
    const file = f.write(path.join(f.storage, "psreadline-history-state-v1.json"), f.journal());
    const first = owned(await f.probe("psReadLine"), f.owner.root); f.replace(file, f.journal("RESTORING"));
    assert.notEqual(owned(await f.probe("psReadLine"), f.owner.root), first); f.unchanged();
});

test("F32-I16 malformed and over8KiB PSReadLine journals are pending without raw-profile reads", async t => {
    const f = await fixture(t), file = f.write(path.join(f.storage, "psreadline-history-state-v1.json"), "{broken");
    pending(await f.probe("psReadLine")); f.replace(file, "x".repeat(8193)); pending(await f.probe("psReadLine"));
    assert(f.reads.every(name => path.basename(name) === "psreadline-history-state-v1.json")); f.unchanged();
});

test("F32-I17 valid live hook metadata is owned and completed ROLLED_BACK metadata is not a live grant", async t => {
    const f = await fixture(t);
    for (const id of ["preCommit", "prePush"] as const) {
        f.context._inspect.secretStore.set(f.hookKey(id), f.hookRecord()); owned(await f.probe(id), f.owner.root);
        f.context._inspect.secretStore.set(f.hookKey(id), f.hookRecord("ROLLED_BACK")); absent(await f.probe(id));
    }
    assert.deepEqual([...new Set(f.keys)].sort(), [f.hookKey("preCommit"), f.hookKey("prePush")].sort());
    assert.equal(f.reads.length, 0); f.unchanged();
});

test("F32-I18 undefined hook records establish scoped absence; malformed foreign records and key errors stay pending", async t => {
    const f = await fixture(t); absent(await f.probe("preCommit"));
    f.context._inspect.secretStore.set(f.hookKey("preCommit"), PRIVATE); pending(await f.probe("preCommit"));
    f.context._inspect.secretStore.set(f.hookKey("prePush"), f.hookRecord("APPLIED", path.join(f.directory, "foreign"))); pending(await f.probe("prePush"));
    t.mock.method(f.context.secrets, "get", async () => { throw Error(PRIVATE); }); pending(await f.probe("preCommit")); f.unchanged();
});

test("F32-I19 manual vendor receipts produce opaque hints while legacy backup presence stays pending", async t => {
    const f = await fixture(t);
    for (const id of ["cline", "claude"] as const) {
        f.context._inspect.globalStore.set("soterai.lite." + id + "Adapter.receipt.v1", { root: f.owner.root,
            receipt: { version: 1, owner: sha(f.owner.root), entries: [{ backup: "a".repeat(32), beforeDigest: sha("before"), afterDigest: sha("after") }] } });
        owned(await f.probe(id), f.owner.root);
    }
    f.context._inspect.globalStore.set("soterai.integration.lastBackup", { path: PRIVATE, backupPath: PRIVATE });
    f.context._inspect.globalStore.set("soterai.secureAllAI.backups", [{ path: PRIVATE, backupPath: PRIVATE }]);
    pending(await f.probe("legacyBroker")); pending(await f.probe("legacyAIConfigs"));
    assert.equal(f.reads.length, 0); assert.equal(f.keys.length, 0); f.unchanged();
});

test("F32-I20 stale foreign untrusted remote or multiple-root owner requests cannot inspect recovery", async t => {
    const f = await fixture(t); const candidates = [{ ...f.owner, root: stub.Uri.file(path.join(f.directory, "foreign")).toString() },
        { ...f.owner, local: false }, { ...f.owner, trusted: false }];
    for (const candidate of candidates) pending(await f.probe("codexCli", candidate));
    stub.state.isTrusted = false; pending(await f.probe("codexCli")); stub.state.isTrusted = true;
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: "ssh-remote" }); pending(await f.probe("codexCli"));
    Object.defineProperty(stub.env, "remoteName", { configurable: true, value: undefined });
    stub.state.folders.push({ uri: stub.Uri.file(path.join(f.directory, "second")), name: "second", index: 1 }); pending(await f.probe("codexCli"));
    assert.equal(f.reads.length, 0); assert.equal(f.enumerated.length, 0); assert.equal(f.keys.length, 0); f.unchanged();
});

test("F32-I21 folder or global checked-profile settings without a receipt remain pending in a one-folder workspace", async t => {
    const f = await fixture(t);
    for (const [id, , name] of TERMINALS) {
        for (const scope of ["workspaceFolderValue", "globalValue"] as const) {
            stub.state.configInspect.set("terminal.integrated.defaultProfile.windows", { workspaceValue: "Windows PowerShell", [scope]: name });
            pending(await f.probe(id));
        }
    }
    f.unchanged();
});

test("F32-I22 folder or global secure-editor associations cannot disappear from empty known recovery", async t => {
    const f = await fixture(t);
    for (const scope of ["workspaceFolderValue", "globalValue"] as const) {
        stub.state.configInspect.set("workbench.editorAssociations", { workspaceValue: { "*.md": "default" }, [scope]: { "**/.env": "soterai.secureEditor" } });
        pending(await f.probe("secureEditorAssociation"));
    }
    f.unchanged();
});
