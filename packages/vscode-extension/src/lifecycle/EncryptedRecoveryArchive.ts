import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { vaultJson } from "../firewall/VaultStorage";

const PRODUCT = "soterai.soterai-ide-guard";
const MAX_FILE = 2 * 1024 * 1024, MAX_FILES = 1024, MAX_TOTAL = 64 * 1024 * 1024;
const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const GENERATION = new RegExp("^vault-generation-" + UUID + "\\.enc$");
const POINTER = /^vault-source-[a-f0-9]{32}\.json$/;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const spelling = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const unavailable = (): never => { throw Error("Encrypted recovery archive unavailable. Keep SoterAI installed and retain existing recovery files."); };
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
interface RecordFile { relative: string; bytes: number; sha256: string }
interface Manifest { schemaVersion: 1; sourceStorage: string; files: RecordFile[] }
interface Captured { row: RecordFile; data: Buffer; identity: string }
const identity = (stat: fs.Stats) => JSON.stringify([process.platform === "win32" ? 0 : stat.dev, stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs, stat.ctimeMs]);

/** The sibling belongs to the same editor profile but is outside VS Code's
 * extension-id deletion target. It contains ciphertext and fixed metadata only. */
export function recoveryArchiveRoot(storage: string): string {
    return path.join(path.dirname(storage), "soterai-recovery", hash(spelling(storage)), "snapshots");
}

/** No keys, decryption, source documents or arbitrary backup directories are
 * available here. Synchronous bounded copying keeps one extension-host turn;
 * the existing mutation lock excludes cooperating vault writers in other hosts.
 * Filesystem checks detect observed swaps, not hostile same-user OS races. */
export class EncryptedRecoveryArchive {
    constructor(private readonly context: vscode.ExtensionContext) {}

    async preserve(current: () => boolean): Promise<{ state: "preserved" }> {
        let releasingOwnedLock = false;
        const check = () => { if (!releasingOwnedLock && (!current() || !vscode.workspace.isTrusted || vscode.env.remoteName)) unavailable(); };
        const uri = this.context.globalStorageUri;
        if (!(uri instanceof vscode.Uri) || !["file", "vscode-userdata"].includes(uri.scheme) || uri.authority || uri.query || uri.fragment) unavailable();
        const source = uri.fsPath;
        if (!path.isAbsolute(source) || path.resolve(source) !== source || path.basename(source).toLowerCase() !== PRODUCT
            || /[\x00-\x1f\x7f]/.test(source) || process.platform === "win32" && (!/^[a-z]:\\/i.test(source) || source.slice(2).includes(":"))) unavailable();
        const root = recoveryArchiveRoot(source);
        const outsideProject = (directory: string) => {
            // Withdrawal cannot revoke cleanup of the exact lock we created.
            // Cleanup still checks every ancestor, the directory object and
            // the lock's exact bytes/identity; it never writes archive data.
            if (releasingOwnedLock) return;
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                if (folder.uri.scheme !== "file") unavailable();
                const relative = path.relative(spelling(folder.uri.fsPath), spelling(directory));
                if (!relative || !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep)) unavailable();
            }
        };
        const directory = (value: string, create = false): boolean => {
            check(); outsideProject(value);
            const absent: string[] = []; let cursor = value;
            while (true) {
                try {
                    const stat = fs.lstatSync(cursor);
                    if (!stat.isDirectory() || stat.isSymbolicLink() || spelling(fs.realpathSync(cursor)) !== spelling(cursor)) unavailable();
                } catch (error) {
                    if (!missing(error)) throw error;
                    absent.push(cursor);
                }
                if (path.dirname(cursor) === cursor) break;
                cursor = path.dirname(cursor);
            }
            if (create) for (const item of absent.reverse()) { check(); fs.mkdirSync(item, { mode: 0o700 }); }
            check(); return absent.length === 0 || create;
        };
        const read = (file: string): { data: Buffer; identity: string } => {
            directory(path.dirname(file)); check();
            const before = fs.lstatSync(file);
            if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > MAX_FILE) unavailable();
            const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
            try {
                if (identity(fs.fstatSync(descriptor)) !== identity(before)) unavailable();
                const data = Buffer.alloc(before.size); let offset = 0;
                while (offset < data.length) { const count = fs.readSync(descriptor, data, offset, data.length - offset, offset); if (!count) unavailable(); offset += count; }
                if (identity(fs.fstatSync(descriptor)) !== identity(before) || identity(fs.lstatSync(file)) !== identity(before)) unavailable();
                check(); return { data, identity: identity(before) };
            } finally { fs.closeSync(descriptor); }
        };
        const write = (file: string, data: Buffer): void => {
            directory(path.dirname(file), true); check();
            const descriptor = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
            try { fs.writeFileSync(descriptor, data); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
            if (!read(file).data.equals(data)) unavailable();
        };
        const snapshots = directory(root) ? fs.readdirSync(root) : [];
        if (snapshots.length > 128) unavailable();
        for (const name of snapshots) { if (!/^(?:[a-f0-9]{64}|partial-[a-f0-9-]{36})$/.test(name)) unavailable(); directory(path.join(root, name)); }
        if (!directory(source)) { if (snapshots.length) unavailable(); return { state: "preserved" }; }
        const lockFile = path.join(source, "vault-mutation.lock"), lock = Buffer.from(JSON.stringify({ schemaVersion: 1, pid: process.pid, nonce: randomUUID() }));
        directory(source); check();
        const lockParent = fs.lstatSync(source), lockParentIdentity = JSON.stringify([lockParent.ino, lockParent.birthtimeMs]);
        const descriptor = fs.openSync(lockFile, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
        let result: { state: "preserved" } | undefined;
        try {
            fs.writeFileSync(descriptor, lock); fs.fsyncSync(descriptor);
            const capture = (): Captured[] => {
                directory(source); const names = fs.readdirSync(source).sort(); if (names.length > 8192) unavailable();
                const relatives: string[] = [];
                for (const name of names) {
                    if (name === "vault-mutation.lock") continue;
                    if (name === "vault-pending.json" || /^write-.*\.enc$/i.test(name)) unavailable();
                    if (name === "soterai-vault.enc" || GENERATION.test(name) || POINTER.test(name)) relatives.push(name);
                    else if (/^vault-|^soterai-vault/i.test(name)) unavailable();
                    else if (name === "backups" || name === "config-backups") {
                        const legacy = path.join(source, name); directory(legacy);
                        const entries = fs.readdirSync(legacy); if (entries.length > MAX_FILES) unavailable();
                        for (const entry of entries) { if (!/^[a-f0-9]{32}\.enc$/.test(entry)) unavailable(); relatives.push(name + "/" + entry); }
                    }
                }
                if (relatives.length > MAX_FILES) unavailable();
                let total = 0;
                const files = relatives.sort().map(relative => {
                    const captured = read(path.join(source, relative)); total += captured.data.length;
                    if (total > MAX_TOTAL) unavailable();
                    const text = captured.data.toString("utf8");
                    if (relative.endsWith(".enc")) {
                        const decoded = Buffer.from(text, "base64");
                        // AES-GCM stores a 12-byte IV and 16-byte tag even for
                        // an empty original; that valid recovery has 28 bytes.
                        if (decoded.length < 28 || decoded.toString("base64") !== text) unavailable();
                    }
                    return { ...captured, row: { relative, bytes: captured.data.length, sha256: hash(captured.data) } };
                });
                for (const file of files.filter(file => POINTER.test(file.row.relative))) {
                    const pointer = vaultJson(file.data.toString("utf8")) as Record<string, unknown>;
                    if (!pointer || Array.isArray(pointer) || Object.keys(pointer).sort().join(",") !== "digest,id,root,schemaVersion,source"
                        || pointer.schemaVersion !== 1 || typeof pointer.id !== "string" || !(new RegExp("^" + UUID + "$" )).test(pointer.id)
                        || typeof pointer.source !== "string" || typeof pointer.root !== "string" || pointer.source.length > 8192 || pointer.root.length > 8192
                        || !pointer.source.startsWith("file:///") || !pointer.root.startsWith("file:///") || /[\x00-\x1f\x7f]/.test(pointer.source + pointer.root)
                        || file.row.relative !== "vault-source-" + hash(pointer.source).slice(0, 32) + ".json"
                        || files.find(row => row.row.relative === "vault-generation-" + pointer.id + ".enc")?.row.sha256 !== pointer.digest) unavailable();
                }
                return files;
            };
            const files = capture();
            if (!files.length) { if (snapshots.length) unavailable(); result = { state: "preserved" }; }
            else {
                const manifest: Manifest = { schemaVersion: 1, sourceStorage: spelling(source), files: files.map(file => file.row) };
                const manifestBytes = Buffer.from(JSON.stringify(manifest) + "\n"), id = hash(manifestBytes), destination = path.join(root, id);
                if (directory(destination)) {
                    if (!read(path.join(destination, "manifest.json")).data.equals(manifestBytes)) unavailable();
                    for (const file of files) if (!read(path.join(destination, "files", file.row.relative)).data.equals(file.data)) unavailable();
                } else {
                    const stage = path.join(root, "partial-" + randomUUID()); directory(stage, true);
                    for (const file of files) write(path.join(stage, "files", file.row.relative), file.data);
                    write(path.join(stage, "manifest.json"), manifestBytes);
                    if (JSON.stringify(capture().map(file => [file.row, file.identity])) !== JSON.stringify(files.map(file => [file.row, file.identity]))) unavailable();
                    directory(root); check(); fs.renameSync(stage, destination);
                }
                if (JSON.stringify(capture().map(file => [file.row, file.identity])) !== JSON.stringify(files.map(file => [file.row, file.identity]))) unavailable();
                if (!read(path.join(destination, "manifest.json")).data.equals(manifestBytes)) unavailable();
                for (const file of files) if (!read(path.join(destination, "files", file.row.relative)).data.equals(file.data)) unavailable();
                result = { state: "preserved" };
            }
        } finally {
            releasingOwnedLock = true;
            let ownedLock: { data: Buffer; identity: string } | undefined;
            try {
                // The O_EXCL descriptor is the creation authority, including
                // a failed/partial write or fsync. Never adopt a replacement.
                const stat = fs.fstatSync(descriptor);
                if (!stat.isFile() || stat.size > lock.length) unavailable();
                const data = Buffer.alloc(stat.size);
                if (fs.readSync(descriptor, data, 0, data.length, 0) !== data.length || !lock.subarray(0, data.length).equals(data)
                    || identity(fs.fstatSync(descriptor)) !== identity(stat)) unavailable();
                ownedLock = { data, identity: identity(stat) };
            } finally {
                try { fs.closeSync(descriptor); }
                finally {
                    try {
                        if (ownedLock) {
                            const parent = fs.lstatSync(source);
                            if (JSON.stringify([parent.ino, parent.birthtimeMs]) !== lockParentIdentity) unavailable();
                            const held = read(lockFile);
                            if (held.identity !== ownedLock.identity || !held.data.equals(ownedLock.data)) unavailable();
                            fs.unlinkSync(lockFile);
                        }
                    } finally { releasingOwnedLock = false; }
                }
            }
        }
        check(); if (!result) unavailable(); return result;
    }
}
