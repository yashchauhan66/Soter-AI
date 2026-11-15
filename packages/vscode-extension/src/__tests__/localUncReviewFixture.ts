import "./phase2/register.mjs";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as stub from "./phase2/vscode-stub";

export const UNC_REVIEW_ROOT = "file://localhost/D$/Synthetic-UNC-Review/workspace";
export const UNC_REVIEW_LOCAL = "D:\\Synthetic-UNC-Review\\workspace";
export const UNC_REVIEW_PATH = "\\\\localhost\\D$\\Synthetic-UNC-Review\\workspace";

/** Synthetic internal FS observations only; no injectable production reader or proof mint. */
export function localUncMetadata(t: TestContext) {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    const electron = Object.getOwnPropertyDescriptor(process.versions, "electron");
    const fsPath = Object.getOwnPropertyDescriptor(stub.Uri.prototype, "fsPath")!;
    const native = Object.getOwnPropertyDescriptor(fs.realpathSync, "native");
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    Object.defineProperty(process.versions, "electron", { configurable: true, value: "synthetic-test-runtime" });
    Object.defineProperty(stub.Uri.prototype, "fsPath", { configurable: true, get(this: stub.Uri) {
        return this.authority ? `\\\\${this.authority}${this.path.replace(/\//g, "\\")}`
            : path.win32.normalize(/^\/[a-z]:/i.test(this.path) ? this.path.slice(1) : this.path);
    } });
    const state = { generation: 0n, reads: [] as string[], realpaths: [] as string[],
        opens: [] as string[], handleReads: [] as string[], closes: [] as string[],
        beforeRead: (_file: string, _count: number) => undefined as void,
        beforeOpen: (_file: string) => undefined as void,
        beforeFstat: (_file: string) => undefined as void,
        beforeClose: (_file: string) => undefined as void,
        changeStat: (_file: string, stat: fs.BigIntStats) => stat,
        changeHandleStat: (_file: string, stat: fs.BigIntStats) => stat,
        canonical: (file: string) => file };
    const identities = new Map<string, bigint>();
    const handles = new Map<number, { file: string; stat: fs.BigIntStats }>();
    let nextHandle = 10000;
    const statFor = (value: string, dev: bigint) => {
        const relative = value.replace(/^D:\\/, "").replace(/^\\\\localhost\\D\$\\/, "");
        if (!identities.has(relative)) identities.set(relative, BigInt(identities.size + 100));
        const root = value === UNC_REVIEW_LOCAL || value === UNC_REVIEW_PATH;
        return { dev, ino: identities.get(relative)! + (root ? state.generation : 0n), birthtimeNs: 123456789n,
            isDirectory: () => true, isSymbolicLink: () => false } as fs.BigIntStats;
    };
    t.mock.method(fs, "lstatSync", ((file: fs.PathLike, options?: unknown) => {
        assert.equal(typeof file, "string"); assert.deepEqual(options, { bigint: true });
        const value = String(file); state.reads.push(value);
        state.beforeRead(value, state.reads.filter(entry => entry === value).length);
        // Windows path observations can expose dev=0 despite a positive handle volume serial.
        return state.changeStat(value, statFor(value, 0n));
    }) as typeof fs.lstatSync);
    t.mock.method(fs, "openSync", ((file: fs.PathLike, flags: number, mode?: unknown) => {
        assert.equal(typeof file, "string"); assert.equal(flags, fs.constants.O_RDONLY); assert.equal(mode, undefined);
        const value = String(file); state.opens.push(value); state.beforeOpen(value);
        const fd = nextHandle++; handles.set(fd, { file: value, stat: statFor(value, 37n) }); return fd;
    }) as typeof fs.openSync);
    t.mock.method(fs, "fstatSync", ((fd: number, options: unknown) => {
        assert.deepEqual(options, { bigint: true });
        const handle = handles.get(fd); assert(handle); state.handleReads.push(handle.file); state.beforeFstat(handle.file);
        return state.changeHandleStat(handle.file, handle.stat);
    }) as typeof fs.fstatSync);
    t.mock.method(fs, "closeSync", (fd: number) => {
        const handle = handles.get(fd); assert(handle); state.closes.push(handle.file); handles.delete(fd); state.beforeClose(handle.file);
    });
    Object.defineProperty(fs.realpathSync, "native", { configurable: true, value: (file: fs.PathLike) => {
        assert.equal(typeof file, "string"); state.realpaths.push(String(file)); return state.canonical(String(file));
    } });
    t.after(() => {
        assert.equal(handles.size, 0, "every opened metadata handle must be closed");
        Object.defineProperty(process, "platform", platform);
        if (electron) Object.defineProperty(process.versions, "electron", electron);
        else delete (process.versions as { electron?: string }).electron;
        Object.defineProperty(stub.Uri.prototype, "fsPath", fsPath);
        if (native) Object.defineProperty(fs.realpathSync, "native", native);
        else delete (fs.realpathSync as { native?: unknown }).native;
    });
    return { state, uri: () => stub.Uri.parse(UNC_REVIEW_ROOT) };
}
