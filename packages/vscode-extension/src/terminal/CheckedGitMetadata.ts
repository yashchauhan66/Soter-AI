import * as path from "node:path";
import { lstatSync, realpathSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { safeGitEnvironment } from "../security/SafeGit";

export const CHECKED_GIT_EXECUTABLE = "C:\\Program Files\\Git\\cmd\\git.exe";
export interface CheckedGitMetadata { readonly executable: string; readonly job: string; readonly environment: NodeJS.ProcessEnv; available(): boolean }
const prepared = new WeakSet<object>();
export function isCheckedGitMetadata(value: unknown): value is CheckedGitMetadata { return !!value && typeof value === "object" && prepared.has(value); }
export function supportsCheckedGitVersion(text: unknown): boolean { return typeof text === "string" && /^git version 2\.53\.0\.windows\.1(?:\r?\n)?$/.test(text); }
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
function identity(file: string, directory: boolean, installed = false): string {
    if (!path.isAbsolute(file) || file.startsWith("\\\\") || file.startsWith("//") || /[\x00-\x1f\x7f-\x9f]/.test(file) || !same(file, realpathSync(file))) throw new Error();
    let current = file;
    while (true) { if (lstatSync(current).isSymbolicLink()) throw new Error(); const parent = path.dirname(current); if (parent === current) break; current = parent; }
    const stat = lstatSync(file);
    if (directory ? !stat.isDirectory() : !stat.isFile() || !installed && stat.nlink !== 1) throw new Error();
    return JSON.stringify(directory ? [stat.ino, stat.birthtimeMs] : [stat.ino, stat.birthtimeMs, stat.size, stat.mtimeMs, stat.ctimeMs, stat.nlink]);
}
function bytes(file: string, max: number): Buffer {
    identity(file, false); if (lstatSync(file).size > max) throw new Error();
    const result = readFileSync(file); if (result.length > max) throw new Error(); return result;
}
function text(file: string, max: number): string {
    const result = new TextDecoder("utf-8", { fatal: true }).decode(bytes(file, max));
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(result)) throw new Error(); return result;
}
function names(directory: string, max: number): string[] { identity(directory, true); const values = readdirSync(directory).sort(); if (values.length > max) throw new Error(); return values; }
function validateConfig(config: string): void {
    let section = "", subsection = false, format = false, bare = false;
    for (const raw of config.split(/\r?\n/)) {
        const line = raw.trim(); if (!line || /^[#;]/.test(line)) continue;
        const header = /^\[([a-zA-Z][a-zA-Z0-9.-]*)(?: "([^"\\]+)")?\]$/.exec(line);
        if (header) { section = header[1].toLowerCase(); subsection = header[2] !== undefined; continue; }
        const entry = /^([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(.*)$/.exec(line);
        if (!entry || !section || /\\|[\r\n]/.test(entry[2]) || entry[2].length > 4096) throw new Error();
        const key = entry[1].toLowerCase(), value = entry[2];
        if (section === "core" && !subsection) {
            if (key === "repositoryformatversion") { if (value !== "0") throw new Error(); format = true; }
            else if (key === "bare") { if (value !== "false") throw new Error(); bare = true; }
            else if (["filemode", "logallrefupdates", "ignorecase", "symlinks", "precomposeunicode"].includes(key)) { if (!/^(?:true|false)$/.test(value)) throw new Error(); }
            else if (key === "autocrlf") { if (!/^(?:true|false|input)$/.test(value)) throw new Error(); }
            else if (!["hookspath", "fsmonitor", "pager", "attributesfile"].includes(key)) throw new Error();
        } else if (section === "filter" && subsection && ["clean", "smudge", "process", "required"].includes(key)) { /* Cached metadata never converts worktree content. */ }
        else if (section === "diff" && (subsection ? ["command", "textconv", "cachetextconv", "binary"] : ["external", "renames"]).includes(key)) { /* Fixed --no-ext-diff/--no-textconv/--no-renames. */ }
        else if (section === "credential" && ["helper", "interactive"].includes(key)) { /* No credential/network operation. */ }
        else if (section === "user" && !subsection && ["name", "email"].includes(key)) { /* Unused metadata, never emitted. */ }
        else if (section === "remote" && subsection && ["url", "fetch", "pushurl"].includes(key)) { /* Fixed protocol.allow=never. */ }
        else throw new Error();
    }
    if (!format || !bare) throw new Error();
}
function validateIndex(data: Buffer): void {
    if (data.length < 32 || data.toString("ascii", 0, 4) !== "DIRC" || ![2, 3].includes(data.readUInt32BE(4)) || data.readUInt32BE(8) > 10000) throw new Error();
    if (!createHash("sha1").update(data.subarray(0, -20)).digest().equals(data.subarray(-20))) throw new Error();
    let cursor = 12;
    for (let count = data.readUInt32BE(8); count > 0; count--) {
        const start = cursor; if (cursor + 62 >= data.length - 20) throw new Error();
        const flags = data.readUInt16BE(cursor + 60); if (flags & 0x4000 || (data.readUInt32BE(cursor + 24) & 0xf000) === 0x4000) throw new Error();
        const end = data.indexOf(0, cursor + 62); if (end < cursor + 62 || end - cursor - 62 > 4096 || end >= data.length - 20) throw new Error();
        cursor = start + Math.ceil((end + 1 - start) / 8) * 8;
    }
    while (cursor < data.length - 20) {
        if (cursor + 8 > data.length - 20 || !["TREE", "REUC"].includes(data.toString("ascii", cursor, cursor + 4))) throw new Error();
        cursor += 8 + data.readUInt32BE(cursor + 4); if (cursor > data.length - 20) throw new Error();
    }
    if (cursor !== data.length - 20) throw new Error();
}
function observe(root: string): string {
    const git = path.join(root, ".git"), observations: unknown[] = [identity(root, true), identity(CHECKED_GIT_EXECUTABLE, false, true), identity(git, true)];
    const top = names(git, 512);
    if (top.some(name => /^(?:commondir|config\.worktree|worktrees|shallow)$|^sharedindex\./i.test(name))) throw new Error();
    const config = text(path.join(git, "config"), 65536), head = text(path.join(git, "HEAD"), 1024);
    validateConfig(config);
    if (!/^(?:[0-9a-f]{40}|ref: refs\/heads\/[A-Za-z0-9_./-]+)\r?\n?$/.test(head) || /\.\.|\/\/|[/.]$/.test(head.trim())) throw new Error();
    observations.push(sha(config), sha(head), identity(path.join(git, "config"), false), identity(path.join(git, "HEAD"), false));
    if (existsSync(path.join(git, "index"))) { const index = bytes(path.join(git, "index"), 4 * 1024 * 1024); validateIndex(index); observations.push(identity(path.join(git, "index"), false), sha(index)); }
    else observations.push("no-index");
    const objects = path.join(git, "objects"), namespaces = names(objects, 258); observations.push(identity(objects, true), namespaces);
    let objectCount = 0;
    for (const name of namespaces) {
        if (["info", "pack"].includes(name)) continue;
        if (!/^[0-9a-f]{2}$/.test(name)) throw new Error();
        const namespace = path.join(objects, name);
        // Identity is checked before enumeration, so a junction target is never
        // enumerated. Inspect only ordinary object metadata, never body bytes.
        observations.push(identity(namespace, true));
        for (const object of names(namespace, 10000 - objectCount)) {
            if (++objectCount > 10000 || !/^[0-9a-f]{38}$/.test(object)) throw new Error();
            observations.push(name + object, identity(path.join(namespace, object), false));
        }
    }
    const info = path.join(objects, "info");
    if (existsSync(info)) { const entries = names(info, 0); observations.push(entries); }
    const pack = path.join(objects, "pack");
    if (existsSync(pack)) { const entries = names(pack, 1024); if (entries.some(name => !/^pack-[0-9a-f]{40}\.(?:pack|idx)$/.test(name))) throw new Error(); observations.push(entries.map(name => identity(path.join(pack, name), false))); }
    const repoInfo = path.join(git, "info");
    if (existsSync(repoInfo)) {
        observations.push(identity(repoInfo, true));
        for (const name of names(repoInfo, 32)) {
            if (name !== "exclude") throw new Error();
            observations.push(identity(path.join(repoInfo, name), false));
        }
    }
    identity(path.join(git, "refs"), true);
    if (existsSync(path.join(git, "refs", "replace"))) throw new Error();
    let remaining = 256;
    const refs = (directory: string): void => {
        observations.push(identity(directory, true));
        for (const name of names(directory, remaining)) {
            if (--remaining < 0) throw new Error();
            const file = path.join(directory, name), stat = lstatSync(file);
            if (stat.isDirectory()) refs(file);
            else { const value = text(file, 1024); if (!/^[0-9a-f]{40}\r?\n?$/.test(value)) throw new Error(); observations.push(name, identity(file, false), sha(value)); }
        }
    };
    refs(path.join(git, "refs"));
    if (existsSync(path.join(git, "packed-refs"))) observations.push(identity(path.join(git, "packed-refs"), false), sha(bytes(path.join(git, "packed-refs"), 1024 * 1024)));
    return sha(JSON.stringify(observations));
}
/** No Git process or repository include runs during preparation. Jobs are retained. */
export async function prepareCheckedGitMetadata(root: string, ambient: NodeJS.ProcessEnv, enabled: () => boolean): Promise<CheckedGitMetadata | undefined> {
    try {
        if (enabled() !== true) return undefined;
        const before = observe(root), job = await mkdtemp(path.join(tmpdir(), "soter-f10-git-job-"));
        await mkdir(path.join(job, "empty-hooks")); await writeFile(path.join(job, "empty.gitconfig"), "", { flag: "wx", mode: 0o600 });
        const minimal: NodeJS.ProcessEnv = {};
        for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) { const value = ambient[key]; if (value && path.isAbsolute(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value) && !value.startsWith("\\\\")) minimal[key] = value; }
        const environment = Object.freeze({ ...safeGitEnvironment(job, minimal), PATHEXT: ".EXE", GIT_CONFIG_SYSTEM: path.join(job, "empty.gitconfig"), GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_PROTOCOL_FROM_USER: "0" });
        const jobIdentity = identity(job, true), configIdentity = identity(path.join(job, "empty.gitconfig"), false), hooksIdentity = identity(path.join(job, "empty-hooks"), true);
        let live = true;
        const available = () => {
            if (!live) return false;
            try { live = enabled() === true && observe(root) === before && identity(job, true) === jobIdentity
                && identity(path.join(job, "empty.gitconfig"), false) === configIdentity && bytes(path.join(job, "empty.gitconfig"), 0).length === 0
                && identity(path.join(job, "empty-hooks"), true) === hooksIdentity && names(path.join(job, "empty-hooks"), 0).length === 0; }
            catch { live = false; }
            return live;
        };
        const descriptor = Object.freeze({ executable: CHECKED_GIT_EXECUTABLE, job, environment, available });
        if (!available()) return undefined; prepared.add(descriptor); return descriptor;
    } catch { return undefined; }
}
