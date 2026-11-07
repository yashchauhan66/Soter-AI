import * as path from "node:path";
import { lstat, realpath, readdir, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { GEMINI_CLI_PIN } from "./GeminiCliPinData";
export { GEMINI_CLI_PIN };
export interface GeminiStamp { file: string; ino: number; dev: number; size: number; mtimeMs: number; directory: boolean }
interface Entry { relative: string; bytes: number; sha256: string }
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
async function stamp(file: string): Promise<GeminiStamp> {
    const s = await lstat(file);
    if (s.isSymbolicLink() || !s.isFile() && !s.isDirectory() || s.isFile() && s.nlink !== 1 || !same(await realpath(file), file)) throw Error("Gemini pin unavailable");
    return { file, ino: s.ino, dev: s.dev, size: s.size, mtimeMs: s.mtimeMs, directory: s.isDirectory() };
}
export async function geminiStampsCurrent(stamps: readonly GeminiStamp[]): Promise<boolean> {
    try { if (!stamps.length) return false; for (const old of stamps) if (JSON.stringify(old) !== JSON.stringify(await stamp(old.file))) return false; return true; } catch { return false; }
}
async function verifyFile(file: string, entry: Pick<Entry, "bytes" | "sha256">): Promise<GeminiStamp> {
    const before = await stamp(file); if (before.directory || before.size !== entry.bytes) throw Error("Gemini pin unavailable");
    const handle = await open(file, "r"), hash = createHash("sha256"); let size = 0;
    try {
        const opened = await handle.stat(); if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== before.ino || opened.size !== before.size) throw Error("Gemini pin unavailable");
        const buffer = Buffer.alloc(65536);
        while (true) { const { bytesRead } = await handle.read(buffer, 0, buffer.length, null); if (!bytesRead) break; size += bytesRead; if (size > entry.bytes) throw Error("Gemini pin unavailable"); hash.update(buffer.subarray(0, bytesRead)); }
        const after = await handle.stat(); if (after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.nlink !== 1) throw Error("Gemini pin unavailable");
    } finally { await handle.close(); }
    if (size !== entry.bytes || hash.digest("hex") !== entry.sha256 || !await geminiStampsCurrent([before])) throw Error("Gemini pin unavailable");
    return before;
}
/** Only public package trees are supplied by the installed-pin resolver. This
 * exported component also supports retained synthetic file-integrity tests. */
export async function verifyGeminiTree(base: string, entries: readonly Entry[]): Promise<GeminiStamp[]> {
    if (!path.isAbsolute(base) || !entries.length || entries.length > 1024) throw Error("Gemini pin unavailable");
    const expected = new Map<string, Entry>();
    for (const e of entries) {
        if (!e || !/^[A-Za-z0-9_@.-]+(?:\/[A-Za-z0-9_@.-]+)*$/.test(e.relative) || e.relative.split("/").some(p => p === "." || p === "..")
            || !Number.isSafeInteger(e.bytes) || e.bytes < 0 || e.bytes > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(e.sha256) || expected.has(e.relative)) throw Error("Gemini pin unavailable");
        expected.set(e.relative, e);
    }
    const stamps: GeminiStamp[] = [], files: string[] = [];
    async function walk(directory: string, prefix = ""): Promise<void> {
        const s = await stamp(directory); if (!s.directory || stamps.length + files.length > 2048) throw Error("Gemini pin unavailable"); stamps.push(s);
        const names = await readdir(directory); if (names.length > 1024) throw Error("Gemini pin unavailable");
        for (const name of names.sort()) { const relative = prefix + name, file = path.join(directory, name), current = await stamp(file);
            if (current.directory) { if (![...expected.keys()].some(p => p.startsWith(relative + "/"))) throw Error("Gemini pin unavailable"); await walk(file, relative + "/"); }
            else { if (!expected.has(relative)) throw Error("Gemini pin unavailable"); files.push(relative); }
        }
    }
    await walk(base); if (files.length !== expected.size) throw Error("Gemini pin unavailable");
    for (const name of files) stamps.push(await verifyFile(path.join(base, ...name.split("/")), expected.get(name)!));
    if (!await geminiStampsCurrent(stamps)) throw Error("Gemini pin unavailable"); return stamps;
}
/** The reviewed input index contains the manifest and entire bundle, not the
 * package's unselected docs/optional native-addon trees. Those remain outside
 * this verified JavaScript route; this function does not certify their code. */
export async function verifyGeminiPackage(base: string, entries: readonly Entry[]): Promise<GeminiStamp[]> {
    const manifest = entries.filter(e => e.relative === "package.json"), bundle = entries.filter(e => e.relative.startsWith("bundle/"));
    if (manifest.length !== 1 || !bundle.length || entries.length !== bundle.length + 1) throw Error("Gemini pin unavailable");
    const root = await stamp(base); if (!root.directory) throw Error("Gemini pin unavailable");
    const stamps = [root, await verifyFile(path.join(base, "package.json"), manifest[0]),
        ...await verifyGeminiTree(path.join(base, "bundle"), bundle.map(e => ({ ...e, relative: e.relative.slice(7) })))];
    if (!await geminiStampsCurrent(stamps)) throw Error("Gemini pin unavailable"); return stamps;
}
export async function verifyInstalledGeminiCli(): Promise<GeminiStamp[]> {
    if (process.platform !== "win32" || !process.env.APPDATA || !path.isAbsolute(process.env.APPDATA) || !process.env.ProgramFiles || !path.isAbsolute(process.env.ProgramFiles)) throw Error("Gemini pin unavailable");
    const base = path.join(process.env.APPDATA, "npm", "node_modules", "@google", "gemini-cli");
    const manifest = path.join(base, "package.json"), resolved = createRequire(manifest).resolve("picomatch/package.json"), dependency = path.dirname(resolved);
    const stamps = await verifyGeminiPackage(base, GEMINI_CLI_PIN.files);
    stamps.push(...await verifyGeminiTree(dependency, GEMINI_CLI_PIN.dependency.files));
    stamps.push(await verifyFile(path.join(process.env.ProgramFiles, "nodejs", "node.exe"), GEMINI_CLI_PIN.node));
    if (!await geminiStampsCurrent(stamps)) throw Error("Gemini pin unavailable"); return stamps;
}
