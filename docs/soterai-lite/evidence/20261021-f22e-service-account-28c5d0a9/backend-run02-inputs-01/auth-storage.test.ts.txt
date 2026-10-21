import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, link, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createTokenStorage } from "../auth";
// File mechanics use a metadata adapter; no ACL changes outside the authorized broker objects.
const loadOrCreateBrokerToken = createTokenStorage({ validate: async () => {}, protectNew: async () => {} });

async function fixture(run: (root: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), "soterai-auth-synthetic-"));
    try { await run(root); } finally {
        const target = resolve(root);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("soterai-auth-synthetic-"));
        await rm(target, { recursive: true, force: true });
    }
}

test("client and controller credentials persist independently in private files", async () => {
    await fixture(async root => {
        const client = await loadOrCreateBrokerToken(root);
        const controller = await loadOrCreateBrokerToken(root, "control-auth-token");
        assert.notEqual(client, controller);
        assert.equal(await loadOrCreateBrokerToken(root), client);
        assert.equal(await loadOrCreateBrokerToken(root, "control-auth-token"), controller);
    });
});

test("invalid, oversized and hardlinked token files fail closed without overwriting the original", async () => {
    for (const content of ["broken", "x".repeat(513), "x".repeat(32) + "\nsecond-line"]) await fixture(async root => {
        const file = join(root, "auth-token");
        await writeFile(file, content, { mode: 0o600 });
        await assert.rejects(loadOrCreateBrokerToken(root));
        assert.equal(await readFile(file, "utf8"), content);
    });
    await fixture(async root => {
        const target = join(root, "original");
        const content = "synthetic-".repeat(8);
        await writeFile(target, content, { mode: 0o600 });
        await link(target, join(root, "auth-token"));
        await assert.rejects(loadOrCreateBrokerToken(root), /Unsafe/);
        assert.equal(await readFile(target, "utf8"), content);
    });
});

test("symlinked token files cannot redirect auth reads or creation", async t => {
    await fixture(async root => {
        const target = join(root, "original");
        await writeFile(target, "synthetic-".repeat(8), { mode: 0o600 });
        try { await symlink(target, join(root, "auth-token")); }
        catch (error) {
            if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") { t.skip("Windows file symlinks require permission"); return; }
            throw error;
        }
        await assert.rejects(loadOrCreateBrokerToken(root), /Unsafe/);
    });
});
