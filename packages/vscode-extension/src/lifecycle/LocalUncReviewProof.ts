import type * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { types } from "node:util";

declare const proofBrand: unique symbol;
export interface LocalUncReviewProof { readonly [proofBrand]: true }
interface ProofRecord { readonly root: string; readonly revision: number; readonly runtime: string; readonly fingerprint: string }
const proofs = new WeakMap<object, ProofRecord>();
const ordinary = (part: string) => !!part && part !== "." && part !== ".."
    && !/[\p{Cc}\p{Cf}\\/:*?"<>|%]/u.test(part) && !/[.\s]$/u.test(part) && !/~[0-9]/.test(part)
    && !/^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part);
function runtime(): string | undefined {
    if (process.platform !== "win32" || typeof process.versions.electron !== "string" || !process.versions.electron) return;
    return JSON.stringify([process.execPath, process.versions.electron, process.versions.node]);
}
function directoryIdentity(file: string): string {
    const pathIdentity = (stat: fs.BigIntStats) => {
        if (!stat.isDirectory() || stat.isSymbolicLink()
            || typeof stat.dev !== "bigint" || stat.dev < 0n
            || [stat.ino, stat.birthtimeNs].some(value => typeof value !== "bigint" || value <= 0n)) throw Error();
        return [stat.dev, stat.ino, stat.birthtimeNs].join(":");
    };
    const before = fs.lstatSync(file, { bigint: true }), beforeIdentity = pathIdentity(before);
    let fd: number | undefined;
    try {
        // Windows path stats can report dev=0. Only positive volume metadata
        // from this read-only directory handle can attest the namespace pair.
        fd = fs.openSync(file, fs.constants.O_RDONLY);
        const stat = fs.fstatSync(fd, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()
            || [stat.dev, stat.ino, stat.birthtimeNs].some(value => typeof value !== "bigint" || value <= 0n)
            || stat.ino !== before.ino || stat.birthtimeNs !== before.birthtimeNs) throw Error();
        const canonical = fs.realpathSync.native(file);
        if (typeof canonical !== "string" || path.win32.normalize(canonical) !== file
            || pathIdentity(fs.lstatSync(file, { bigint: true })) !== beforeIdentity) throw Error();
        return [stat.dev, stat.ino, stat.birthtimeNs].join(":");
    } finally { if (fd !== undefined) fs.closeSync(fd); }
}

/** Review only: actual extension-host metadata, never a replacement URI or native write grant.
 * Two bounded ancestry walks detect observed changes; synchronous filesystem calls cannot
 * guarantee a wall-clock timeout or eliminate every hostile namespace race. */
export function captureLocalUncReviewProof(uri: vscode.Uri, revision: number): LocalUncReviewProof | undefined {
    try {
        const sourceRuntime = runtime();
        if (!sourceRuntime || !Number.isSafeInteger(revision) || revision < 0 || !uri || types.isProxy(uri)) return;
        // Load the host API only when capturing UNC metadata; the pure coordinator's
        // ordinary drive-owner path does not need the VS Code runtime module.
        const { Uri } = require("vscode") as typeof vscode;
        // VS Code's public factories return its private cached Uri subclass.
        // Anchor to a trusted factory result, never an arbitrary subclass.
        const officialPrototype = Object.getPrototypeOf(Uri.parse("file:///C:/soterai-proof-marker"));
        if (!(uri instanceof Uri) || Object.getPrototypeOf(uri) !== officialPrototype) return;
        const fields = Object.getOwnPropertyDescriptors(uri);
        if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !Object.hasOwn(fields[key], "value"))
            || Object.hasOwn(fields, "toString") || Object.hasOwn(fields, "fsPath") || fields.scheme?.value !== "file" || fields.authority?.value !== "localhost"
            || fields.query?.value !== "" || fields.fragment?.value !== "") return;
        const uriPath = fields.path?.value;
        if (typeof uriPath !== "string" || uriPath.length > 8192 || !uriPath.startsWith("/")) return;
        const [share, ...parts] = uriPath.slice(1).split("/");
        if (!/^[A-Z]\$$/.test(share) || parts.length < 1 || parts.length > 64 || !parts.every(ordinary)) return;
        const root = uri.toString(), parsed = Uri.parse(root);
        if (root.length > 8192 || parsed.toString() !== root || parsed.scheme !== "file" || parsed.authority !== "localhost"
            || parsed.path !== uriPath || parsed.query || parsed.fragment) return;
        // Preserve the admitted uppercase share letter; Uri.file(drive).fsPath may
        // lowercase it and must never replace the original workspace namespace.
        const localRoot = `${share[0]}:\\`, uncRoot = `\\\\localhost\\${share}\\`;
        const localPath = path.win32.join(localRoot, ...parts), uncPath = path.win32.join(uncRoot, ...parts);
        if (uri.fsPath !== uncPath || path.win32.normalize(localPath) !== localPath || path.win32.normalize(uncPath) !== uncPath) return;
        const pairs = Array.from({ length: parts.length + 1 }, (_, index) => [
            path.win32.join(localRoot, ...parts.slice(0, index)), path.win32.join(uncRoot, ...parts.slice(0, index)),
        ] as const);
        const observe = () => JSON.stringify(pairs.map(([local, unc]) => {
            const localIdentity = directoryIdentity(local), uncIdentity = directoryIdentity(unc);
            if (localIdentity !== uncIdentity) throw Error();
            return [local, unc, localIdentity];
        }));
        const first = observe(), second = observe();
        if (first !== second || runtime() !== sourceRuntime) return;
        const fingerprint = createHash("sha256").update(JSON.stringify([root, revision, sourceRuntime, localPath, uncPath, first])).digest("hex");
        const proof = Object.freeze(Object.create(null)) as LocalUncReviewProof;
        proofs.set(proof, Object.freeze({ root, revision, runtime: sourceRuntime, fingerprint }));
        return proof;
    } catch { return; }
}

/** An arbitrary object, getter or proxy can never supply an observed fingerprint. */
export function localUncReviewFingerprint(proof: unknown, root: string, revision: number): string | undefined {
    if (!proof || typeof proof !== "object" || types.isProxy(proof)) return;
    const record = proofs.get(proof);
    return record && record.root === root && record.revision === revision && record.runtime === runtime() ? record.fingerprint : undefined;
}
