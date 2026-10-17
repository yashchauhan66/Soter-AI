import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type * as vscode from "vscode";
import { encryptVault } from "@soterai/guard-core";
import * as stub from "./phase2/vscode-stub";
import { initializeBoundaryState, BoundarySnapshot } from "../ai-boundary/BoundarySnapshot";
import { VaultManager } from "../firewall/VaultManager";
import type { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";

// Real synthetic ciphertext, metadata-only source bindings. Original source
// files intentionally do not exist, including the valid other-project control.
const PRIVATE = "synthetic-f10-binding-private-value-vQ8";
const OTHER = "synthetic-f10-other-project-output-control-X7";
const KEY = Buffer.alloc(32, 0x53).toString("base64");
let root: string, other: string, storage: string, context: ReturnType<typeof stub.makeExtensionContext>, manager: VaultManager;
let filters: ManagedOutputFilter[], documentReads: number;
type Entry = Record<string, string>;
const rootUri = () => stub.Uri.file(root) as unknown as vscode.Uri;
function entry(value: string, index = 0, folder = root): Entry {
    return { id: `f1051000-abcd-4def-8abc-${String(index).padStart(12, "0")}`, key: "SECRET_" + index,
        type: "generic", originalFile: ".env.synthetic", placeholder: `[SOTERAI_PROTECTED_C07F302E78DB4AF38CFCCAA3A5AA28B1_${index}]`,
        createdAt: "2026-10-16T00:00:00.000Z", hash: createHash("sha256").update(value).digest("hex"), rawValue: value,
        root: stub.Uri.file(folder).toString(), source: stub.Uri.file(join(folder, ".env.synthetic")).toString(), replacementText: "'" + value + "'" };
}
async function install(entries: Entry[]): Promise<void> {
    context._inspect.secretStore.set("soterai.vaultKey", KEY);
    await writeFile(join(storage, "soterai-vault.enc"), await encryptVault(JSON.stringify({ version: 2, entries }), KEY));
}
async function factory(): Promise<ManagedOutputFilter> {
    const filter = await manager.createManagedOutputFilter(rootUri(), () => true); filters.push(filter); return filter;
}
beforeEach(async () => {
    const fixture = await mkdtemp(join(tmpdir(), "soterai-f10-bindings-review-"));
    root = join(fixture, "project"); other = join(fixture, "other-project"); storage = join(fixture, "storage");
    await mkdir(root); await mkdir(other); await mkdir(storage); stub.resetState(root);
    context = stub.makeExtensionContext(fixture); context.globalStorageUri = stub.Uri.file(storage); filters = []; documentReads = 0;
    // The shared phase2 URI stub omits query/fragment parsing. Supply only that
    // missing API plumbing locally; all security decisions remain production.
    const parse = stub.Uri.parse.bind(stub.Uri);
    mock.method(stub.Uri, "parse", (value: string) => {
        const queryIndex = value.indexOf("?"), fragmentIndex = value.indexOf("#");
        const end = Math.min(...[queryIndex, fragmentIndex, value.length].filter(index => index >= 0));
        const uri = parse(value.slice(0, end));
        const query = queryIndex >= 0 && (fragmentIndex < 0 || queryIndex < fragmentIndex)
            ? value.slice(queryIndex + 1, fragmentIndex < 0 ? undefined : fragmentIndex) : "";
        const fragment = fragmentIndex < 0 ? "" : value.slice(fragmentIndex + 1), plain = uri.toString();
        Object.defineProperties(uri, { query: { value: query }, fragment: { value: fragment },
            toString: { value: () => plain + (queryIndex >= 0 && (fragmentIndex < 0 || queryIndex < fragmentIndex) ? "?" + query : "") + (fragmentIndex >= 0 ? "#" + fragment : "") } });
        return uri;
    });
    mock.method(stub.workspace, "openTextDocument", async () => { documentReads++; throw new Error("Metadata validation must not open a source document."); });
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); manager = new VaultManager(context as never); stub.resetSinks();
});
afterEach(() => {
    try {
        filters.forEach(filter => filter.dispose()); context.subscriptions.forEach(disposable => disposable.dispose());
        assert.equal(documentReads, 0); for (const sink of stub.sinks) assert.ok(!sink.text.includes(PRIVATE));
    } finally { mock.restoreAll(); }
});

const invalid = ["root-malformed", "root-non-file", "source-malformed", "source-outside-root", "source-authority", "source-query", "source-fragment", "other-root-mismatched-source"] as const;
for (const kind of invalid) {
    test(`F10-OR-${kind} complete malformed binding withholds instead of omitting a registry entry`, async () => {
        const record = entry(PRIVATE);
        if (kind === "root-malformed") record.root = "not-a-workspace-uri";
        if (kind === "root-non-file") record.root = "https://synthetic.invalid/project";
        if (kind === "source-malformed") record.source = "not-a-file-uri";
        if (kind === "source-outside-root") record.source = stub.Uri.file(join(other, ".env.synthetic")).toString();
        if (kind === "source-authority") record.source = "file://synthetic.invalid/share/.env.synthetic";
        if (kind === "source-query") record.source += "?synthetic=1";
        if (kind === "source-fragment") record.source += "#synthetic";
        if (kind === "other-root-mismatched-source") record.root = stub.Uri.file(other).toString();
        await install([record]);
        await assert.rejects(factory, error => {
            assert.ok(!(error instanceof assert.AssertionError));
            assert.equal(String(error), "Error: Protected vault operation withheld. Encrypted recovery is retained; no plaintext rollback was performed."); return true;
        });
        await assert.rejects(access(join(root, ".env.synthetic")), { code: "ENOENT" });
        await assert.rejects(access(join(other, ".env.synthetic")), { code: "ENOENT" });
    });
}

test("F10-OR-valid-other-root current registry masks while valid other-project metadata is excluded without source reads", async () => {
    await install([entry(PRIVATE), entry(OTHER, 1, other)]);
    const current = await factory(); assert.equal(current.push("stdout", Buffer.from(PRIVATE)).status, "BUFFERED");
    assert.equal(current.finish(0).stdout, "[REDACTED_SECRET_OUTPUT]");
    const excluded = await factory(); assert.equal(excluded.push("stdout", Buffer.from(OTHER)).status, "BUFFERED");
    const result = excluded.finish(0); assert.equal(result.status, "COMPLETE"); assert.equal(result.stdout, OTHER); assert.equal(result.redacted, false);
    await assert.rejects(access(join(root, ".env.synthetic")), { code: "ENOENT" });
    await assert.rejects(access(join(other, ".env.synthetic")), { code: "ENOENT" });
});
