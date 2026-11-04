import * as vscode from "vscode";
import fs from "node:fs";
import { opendir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { SENSITIVE_FILE_GLOBS } from "@soterai/guard-core";
import { managedPathIdentity, managedRootIdentity } from "../terminal/ManagedOutputBinding";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { HistoryProfileJournal } from "../history-hooks/HistoryProfileJournal";
import { parseHookClientPin as parseCommitPin } from "../history-hooks/PreCommitHookText";
import { parseHookClientPin as parsePushPin } from "../history-hooks/PrePushHookText";
import { parseHookRecoveryReceipt as parseCommitReceipt } from "../history-hooks/PreCommitHookRestore";
import { parseHookRecoveryReceipt as parsePushReceipt } from "../history-hooks/PrePushHookRestore";
import type { RemovalAction, RemovalOwner } from "./RemovalCoordinator";

const ABSENT = Object.freeze({ state: "ABSENT" });
const PENDING = Object.freeze({ state: "PENDING" });
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hex = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const TERMINALS = Object.freeze({
    checkedPowerShell: ["soterai.lite.ps51.profile.v1", "SoterAI PowerShell 5.1 (checked commands)"],
    checkedCmd: ["soterai.lite.cmd.profile.v1", "SoterAI cmd (checked commands)"],
    checkedGitBash: ["soterai.lite.gitBash.profile.v1", "SoterAI Git Bash (checked commands)"],
});
const DEDICATED = Object.freeze({
    codexCli: ["codex-cli", "soterai.lite.codexCliAdapter.receipt.v1"],
    codexIde: ["codex-ide", "soterai.lite.codexIdeAdapter.receipt.v1"],
    geminiCli: ["gemini-cli", "soterai.lite.geminiCliAdapter.receipt.v1"],
});
const exact = (value: Record<string, unknown>, keys: string) => Object.keys(value).sort().join(",") === keys;

/** Copy bounded data descriptors only. Recovery hints must never invoke saved getters. */
function metadata(value: unknown): Record<string, unknown> {
    let nodes = 0, bytes = 0;
    const copy = (input: unknown, depth: number): unknown => {
        if (++nodes > 256 || depth > 8) throw Error();
        if (input === null || typeof input === "boolean") return input;
        if (typeof input === "number" && Number.isFinite(input)) return input;
        if (typeof input === "string") {
            bytes += Buffer.byteLength(input); if (input.length > 8192 || bytes > 32768) throw Error(); return input;
        }
        if (!input || typeof input !== "object" || types.isProxy(input)) throw Error();
        const array = Array.isArray(input), proto = Object.getPrototypeOf(input);
        if (array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto)) throw Error();
        const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
        if (keys.length > 128) throw Error();
        const output: Record<string, unknown> | unknown[] = array ? [] : Object.create(null);
        for (const key of keys) {
            if (typeof key !== "string" || !Object.hasOwn(descriptors[key], "value")) throw Error();
            if (array && key === "length") continue;
            if (!descriptors[key].enumerable || key.length > 256 || array && !/^(0|[1-9][0-9]*)$/.test(key)) throw Error();
            Object.defineProperty(output, key, { value: copy(descriptors[key].value, depth + 1), enumerable: true });
        }
        if (array && (output as unknown[]).length !== (input as unknown[]).length) throw Error();
        return output;
    };
    const result = copy(value, 0);
    if (!result || typeof result !== "object" || Array.isArray(result)) throw Error();
    return result as Record<string, unknown>;
}
function prior(value: unknown): boolean {
    const row = metadata(value);
    return row.present === false ? exact(row, "present") : row.present === true && exact(row, "present,value")
        && (row.value === null || typeof row.value === "string" && row.value.length <= 256 && !/[\x00-\x1f\x7f]/.test(row.value));
}
function hint(root: string, value: unknown): object {
    return Object.freeze({ state: "OWNED", schemaVersion: 1, root, receiptFingerprint: sha(JSON.stringify(value)) });
}

/** Read-only hints for known managed journals. Native undo retains all mutation authority.
 * Missing journals cannot discover unrecorded legacy changes. Config text and backup keys
 * are never read here; filesystem identities detect observed changes, not hostile races. */
export class RecoveryInventory {
    constructor(private readonly context: vscode.ExtensionContext) {}
    private owner(captured: RemovalOwner): vscode.Uri {
        const row = metadata(captured), folders = vscode.workspace.workspaceFolders;
        if (row.local !== true || row.trusted !== true || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0
            || !vscode.workspace.isTrusted || vscode.env.remoteName || folders?.length !== 1) throw Error();
        const uri = folders[0].uri;
        if (!(uri instanceof vscode.Uri) || row.root !== uri.toString() || uri.scheme !== "file" || uri.authority || uri.query || uri.fragment
            || uri.path.split("/").some(part => part === "." || part === "..")) throw Error();
        managedRootIdentity(uri); return uri;
    }
    private storage(root: vscode.Uri): string {
        const uri = this.context.globalStorageUri, value = uri.fsPath;
        if (!(uri instanceof vscode.Uri) || !["file", "vscode-userdata"].includes(uri.scheme) || uri.authority || uri.query || uri.fragment
            || !/^[a-z]:\\/i.test(value) || path.resolve(value) !== value
            || vscode.Uri.file(value).path.toLowerCase() !== uri.path.toLowerCase()) throw Error();
        const relative = path.relative(root.fsPath, value);
        if (!relative || !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep)) throw Error();
        return value;
    }
    /** Stat-only presence through checked existing ancestry, including missing parents. */
    private presence(file: string, directory = false): { present: boolean; stamp: string } {
        let current = file, missing = false;
        for (let count = 0; count < 128; count++) {
            try {
                const stat = fs.lstatSync(current);
                if (!missing && current === file && !directory) {
                    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw Error();
                    const parent = path.dirname(file), identity = managedPathIdentity(parent, parent, true);
                    if (!same(fs.realpathSync(file), file)) throw Error();
                    return { present: true, stamp: JSON.stringify([identity, stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs]) };
                }
                const identity = managedPathIdentity(current, current, true);
                return { present: !missing, stamp: JSON.stringify([current.toLowerCase(), identity, missing]) };
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT" || path.dirname(current) === current) throw error;
                missing = true; current = path.dirname(current);
            }
        }
        throw Error();
    }
    private terminal(id: keyof typeof TERMINALS, root: vscode.Uri): object {
        const [key, name] = TERMINALS[id], raw = this.context.workspaceState.get(key);
        const inspected = vscode.workspace.getConfiguration("terminal.integrated", root).inspect("defaultProfile.windows");
        const current = inspected?.workspaceValue;
        if (raw === undefined) return [inspected?.workspaceFolderValue, current, inspected?.globalValue, inspected?.defaultValue].includes(name) ? PENDING : ABSENT;
        const row = metadata(raw);
        if (!exact(row, "after,before,phase,root,schemaVersion,target") || row.schemaVersion !== 1 || row.root !== root.toString()
            || row.target !== vscode.ConfigurationTarget.Workspace || !["APPLIED", "PREPARED"].includes(String(row.phase))
            || row.after !== name || !prior(row.before)) return PENDING;
        if (current !== name && !(row.phase === "PREPARED" && JSON.stringify(row.before) === JSON.stringify(current === undefined ? { present: false } : { present: true, value: current }))) return PENDING;
        return hint(root.toString(), row);
    }
    private associations(root: vscode.Uri): object {
        const patterns = SENSITIVE_FILE_GLOBS.filter(pattern => pattern.endsWith("/.env") || pattern.endsWith("/.env.*"));
        if (patterns.length !== 2) return PENDING;
        const raw = this.context.workspaceState.get("soterai.lite.secureEditor.association.v1:" + root.toString());
        const inspected = vscode.workspace.getConfiguration("workbench", root).inspect("editorAssociations");
        const current = metadata(inspected?.workspaceValue ?? {});
        if (raw === undefined) {
            const scopes = [inspected?.workspaceFolderValue, inspected?.workspaceValue, inspected?.globalValue, inspected?.defaultValue].map(value => metadata(value ?? {}));
            return scopes.some(scope => patterns.some(key => scope[key] === "soterai.secureEditor")) ? PENDING : ABSENT;
        }
        const row = metadata(raw), before = metadata(row.before);
        if (!exact(row, "before,root,schemaVersion,target") || row.schemaVersion !== 1 || row.root !== root.toString()
            || row.target !== vscode.ConfigurationTarget.Workspace || !exact(before, [...patterns].sort().join(","))
            || patterns.some(key => before[key] !== null && typeof before[key] !== "string" || current[key] !== "soterai.secureEditor")) return PENDING;
        return hint(root.toString(), row);
    }
    private savedProfile(value: unknown, root: vscode.Uri, directory: string, gemini: boolean): Record<string, unknown> {
        const row = metadata(value), receipt = metadata(row.receipt);
        if (!exact(row, "profileDirectory,receipt,root,version") || row.version !== 1 || row.root !== root.toString()
            || row.profileDirectory !== directory || receipt.version !== 1
            || !exact(receipt, gemini ? "afterDigest,backup,beforeDigest,environmentDigest,owner,settingsDigest,version" : "afterDigest,backup,beforeDigest,owner,version")
            || typeof receipt.owner !== "string" || !receipt.owner || receipt.owner.length > 256 || /[\x00-\x1f\x7f]/.test(receipt.owner)
            || typeof receipt.backup !== "string" || !/^[a-f0-9]{32}$/.test(receipt.backup)
            || !hex(receipt.beforeDigest) || !hex(receipt.afterDigest) || gemini && (!hex(receipt.settingsDigest) || !hex(receipt.environmentDigest))) throw Error();
        return row;
    }
    private async dedicated(id: keyof typeof DEDICATED, root: vscode.Uri): Promise<object> {
        const [family, key] = DEDICATED[id], base = path.join(this.storage(root), "adapter-sessions");
        const stored = this.context.globalState.get(key), initial = this.presence(base, true);
        if (!initial.present) return stored === undefined ? ABSENT : PENDING;
        const matcher = new RegExp("^" + family + "-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$");
        const names: string[] = []; let total = 0;
        const entries = await opendir(base);
        for await (const entry of entries) {
            if (++total > 256) throw Error();
            if (!matcher.test(entry.name)) continue;
            if (!entry.isDirectory() || entry.isSymbolicLink() || names.length >= 32) throw Error();
            names.push(entry.name);
        }
        if (this.presence(base, true).stamp !== initial.stamp) throw Error();
        let selected: Record<string, unknown> | undefined;
        for (const name of names.sort()) {
            const directory = path.join(base, name), stamp = this.presence(directory, true).stamp;
            const files = id === "geminiCli" ? [path.join(directory, ".gemini", "settings.json"), path.join(directory, ".gemini", ".env")] : [path.join(directory, "config.toml")];
            const configs = files.map(file => this.presence(file)), recovery = path.join(directory, "recovery.json"), record = this.presence(recovery);
            const live = configs.some(config => config.present);
            if (!record.present) { if (live || stored !== undefined && metadata(stored).profileDirectory === directory) return PENDING; continue; }
            const raw = await readBoundaryFile(path.parse(directory).root, recovery, 16384);
            const saved = this.savedProfile(JSON.parse(raw), root, directory, id === "geminiCli");
            if (this.presence(directory, true).stamp !== stamp || this.presence(recovery).stamp !== record.stamp
                || files.some((file, index) => this.presence(file).stamp !== configs[index].stamp)) throw Error();
            if (!live) { if (stored !== undefined && metadata(stored).profileDirectory === directory) return PENDING; continue; }
            if (selected) return PENDING;
            if (stored !== undefined && JSON.stringify(this.savedProfile(stored, root, directory, id === "geminiCli")) !== JSON.stringify(saved)) return PENDING;
            selected = saved;
        }
        if (stored !== undefined && !selected) return PENDING;
        return selected ? hint(root.toString(), selected) : ABSENT;
    }
    private async hook(id: "preCommit" | "prePush", root: vscode.Uri): Promise<object> {
        const raw = await this.context.secrets.get("soterai." + id + ".record.v1." + sha(root.fsPath.toLowerCase()));
        if (raw === undefined) return ABSENT;
        if (typeof raw !== "string" || raw.length > 32768) return PENDING;
        const value = metadata(JSON.parse(raw));
        if (!exact(value, "pin,projectionFingerprint,receipt,state,version") || JSON.stringify(value) !== raw || value.version !== 1
            || !hex(value.projectionFingerprint) || typeof value.pin !== "string" || !["PREPARED", "APPLIED", "ROLLED_BACK", "INCOMPLETE"].includes(String(value.state))) return PENDING;
        const pinBytes = Buffer.from(value.pin, "base64");
        const pin = id === "preCommit" ? parseCommitPin(pinBytes) : parsePushPin(pinBytes);
        const receipt = id === "preCommit" ? parseCommitReceipt(value.receipt) : parsePushReceipt(value.receipt);
        if (!pin || !receipt || pinBytes.toString("base64") !== value.pin || pin.root !== root.fsPath || receipt.root !== root.fsPath || pin.generation !== receipt.generation) return PENDING;
        return value.state === "ROLLED_BACK" ? ABSENT : hint(root.toString(), value);
    }
    async probe(id: RemovalAction, captured: RemovalOwner): Promise<unknown> {
        try {
            const root = this.owner(captured), identity = managedRootIdentity(root);
            let result: object;
            if (Object.hasOwn(TERMINALS, id)) result = this.terminal(id as keyof typeof TERMINALS, root);
            else if (id === "secureEditorAssociation") result = this.associations(root);
            else if (Object.hasOwn(DEDICATED, id)) result = await this.dedicated(id as keyof typeof DEDICATED, root);
            else if (id === "preCommit" || id === "prePush") result = await this.hook(id, root);
            else if (id === "psReadLine") {
                const row = new HistoryProfileJournal(this.storage(root)).read(); result = row === undefined ? ABSENT : hint(root.toString(), row);
            } else if (id === "cline" || id === "claude") {
                const raw = this.context.globalState.get("soterai.lite." + id + "Adapter.receipt.v1");
                if (raw === undefined) result = ABSENT;
                else { const row = metadata(raw); result = row.root === root.toString() && row.receipt ? hint(root.toString(), row) : PENDING; }
            } else if (id === "legacyBroker" || id === "legacyAIConfigs") {
                result = this.context.globalState.get(id === "legacyBroker" ? "soterai.integration.lastBackup" : "soterai.secureAllAI.backups") === undefined ? ABSENT : PENDING;
            } else result = PENDING;
            return managedRootIdentity(this.owner(captured)) === identity ? result : PENDING;
        } catch { return PENDING; }
    }
}
