import assert from "node:assert/strict";
import test from "node:test";
import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BrokerCredentialError, createBrokerCredentialLoader, createTokenStorage, type TokenPermissions } from "../auth";

// Metadata adapters never invoke the real ACL inspector. All values below are
// synthetic; no user-profile credential files or production ACLs are touched.
const CLIENT = "synthetic-client-only-".repeat(3);
const CONTROL = "synthetic-controller-only-".repeat(3);
async function fixture(run: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "soterai-control-token-synthetic-"));
    try { await run(root); }
    finally {
        const resolved = path.resolve(root);
        assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
        assert.ok(path.basename(resolved).startsWith("soterai-control-token-synthetic-"));
        await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
}

test("A14 missing controller token: provisioning failure rejects instead of returning the existing client credential", { skip: process.platform !== "win32" }, async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        const protectedPaths: string[] = [];
        const validatedPaths: string[] = [];
        const load = createTokenStorage({
            validate: async target => { validatedPaths.push(target); },
            protectNew: async target => { protectedPaths.push(target); throw new Error("Synthetic controller provisioning denied"); },
        });
        await assert.rejects(load(root, "control-auth-token"), /Synthetic controller provisioning denied/);
        assert.deepEqual(protectedPaths, [controlPath]);
        assert.ok(!validatedPaths.includes(clientPath));
        assert.equal(await readFile(clientPath, "utf8"), CLIENT);
        assert.equal((await lstat(controlPath)).size, 0, "failed provisioning must not publish a controller token");
        assert.equal(await load(root, "auth-token"), CLIENT, "distinct client loading remains the positive control");
    });
});

test("A14 missing controller token: unavailable directory metadata denies creation and preserves the client control", { skip: process.platform !== "win32" }, async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        let protectionCalls = 0;
        const load = createTokenStorage({
            validate: async () => { throw new Error("Synthetic directory metadata unavailable"); },
            protectNew: async () => { protectionCalls++; },
        });
        await assert.rejects(load(root, "control-auth-token"), /Synthetic directory metadata unavailable/);
        await assert.rejects(lstat(controlPath), { code: "ENOENT" });
        assert.equal(protectionCalls, 0);
        assert.equal(await readFile(clientPath, "utf8"), CLIENT);
        const control = createTokenStorage({ validate: async () => {}, protectNew: async () => {} });
        assert.equal(await control(root, "auth-token"), CLIENT);
    });
});

test("A14 missing controller token: successful synthetic metadata provisioning remains distinct and persists", async () => {
    await fixture(async root => {
        await writeFile(path.join(root, "auth-token"), CLIENT, { mode: 0o600 });
        const protectedPaths: string[] = [];
        const permissions: TokenPermissions = { validate: async () => {}, protectNew: async target => { protectedPaths.push(target); } };
        const load = createTokenStorage(permissions);
        const controller = await load(root, "control-auth-token");
        assert.ok(controller.length >= 32);
        assert.notEqual(controller, CLIENT);
        assert.equal(await load(root, "control-auth-token"), controller);
        assert.equal(await load(root, "auth-token"), CLIENT);
        assert.deepEqual(protectedPaths, process.platform === "win32" ? [path.join(root, "control-auth-token")] : []);
    });
});

test("A14 existing controller token: successful metadata validation loads its own file without provisioning or client fallback", async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        await writeFile(controlPath, CONTROL, { mode: 0o600 });
        const validatedPaths: string[] = [];
        const load = createTokenStorage({ validate: async target => { validatedPaths.push(target); },
            protectNew: async () => { throw new Error("Existing tokens must never be provisioned"); } });
        assert.equal(await load(root, "control-auth-token"), CONTROL);
        assert.ok(!validatedPaths.includes(clientPath));
        if (process.platform === "win32") assert.equal(validatedPaths.filter(target => target === controlPath).length, 2);
        assert.equal(await load(root, "auth-token"), CLIENT);
    });
});

test("A14 existing controller token: metadata rejection does not rotate it or authenticate through the client file", { skip: process.platform !== "win32" }, async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        await writeFile(controlPath, CONTROL, { mode: 0o600 });
        const load = createTokenStorage({
            validate: async target => { if (target === controlPath) throw new Error("Synthetic existing-controller ACL denied"); },
            protectNew: async () => { throw new Error("Must not rotate existing authentication"); },
        });
        await assert.rejects(load(root, "control-auth-token"), /Synthetic existing-controller ACL denied/);
        assert.equal(await readFile(controlPath, "utf8"), CONTROL);
        assert.equal(await readFile(clientPath, "utf8"), CLIENT);
        assert.equal(await load(root, "auth-token"), CLIENT);
    });
});

test("A14 corrupt controller token: invalid content fails without client fallback while valid controller content succeeds", async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        await writeFile(controlPath, "invalid-synthetic", { mode: 0o600 });
        const load = createTokenStorage({ validate: async () => {}, protectNew: async () => {} });
        await assert.rejects(load(root, "control-auth-token"), /Invalid broker token file/);
        assert.equal(await readFile(controlPath, "utf8"), "invalid-synthetic");
        assert.equal(await load(root, "auth-token"), CLIENT);
        await writeFile(controlPath, CONTROL, { mode: 0o600 });
        assert.equal(await load(root, "control-auth-token"), CONTROL);
    });
});

test("A14 startup: missing controller provisioning fails with a safe explicit no-fallback error", { skip: process.platform !== "win32" }, async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        const provisionedPaths: string[] = [];
        const load = createBrokerCredentialLoader({ validate: async () => {},
            protectNew: async target => { provisionedPaths.push(target); throw new Error("Synthetic internal failure " + CLIENT); } });
        await assert.rejects(load(root), error => {
            assert.ok(error instanceof BrokerCredentialError);
            assert.equal(error.message, "Controller credential unavailable; broker startup denied. Client credentials are never a fallback.");
            assert.ok(!error.message.includes(CLIENT));
            return true;
        });
        assert.deepEqual(provisionedPaths, [controlPath]);
        assert.equal((await lstat(controlPath)).size, 0);
        assert.equal(await readFile(clientPath, "utf8"), CLIENT);
        const clientControl = createTokenStorage({ validate: async () => {}, protectNew: async () => {} });
        assert.equal(await clientControl(root, "auth-token"), CLIENT);
    });
});

test("A14 startup: a missing controller is successfully provisioned as a distinct persistent credential", async () => {
    await fixture(async root => {
        await writeFile(path.join(root, "auth-token"), CLIENT, { mode: 0o600 });
        const provisionedPaths: string[] = [];
        const load = createBrokerCredentialLoader({ validate: async () => {}, protectNew: async target => { provisionedPaths.push(target); } });
        const credentials = await load(root);
        assert.equal(credentials.token, CLIENT);
        assert.notEqual(credentials.controlToken, CLIENT);
        assert.ok(credentials.controlToken.length >= 32);
        assert.deepEqual(await load(root), credentials);
        assert.deepEqual(provisionedPaths, process.platform === "win32" ? [path.join(root, "control-auth-token")] : []);
    });
});

test("A14 startup: existing controller metadata failure is sanitized and never rotates either credential", { skip: process.platform !== "win32" }, async () => {
    await fixture(async root => {
        const clientPath = path.join(root, "auth-token");
        const controlPath = path.join(root, "control-auth-token");
        await writeFile(clientPath, CLIENT, { mode: 0o600 });
        await writeFile(controlPath, CONTROL, { mode: 0o600 });
        let denyControl = false;
        const load = createBrokerCredentialLoader({ validate: async target => {
            if (target === controlPath && denyControl) throw new Error("Synthetic metadata failure " + CONTROL);
        }, protectNew: async () => { throw new Error("Existing credentials must not be provisioned"); } });
        assert.deepEqual(await load(root), { token: CLIENT, controlToken: CONTROL });
        denyControl = true;
        await assert.rejects(load(root), error => {
            assert.ok(error instanceof BrokerCredentialError);
            assert.match(error.message, /startup denied.*never a fallback/);
            assert.ok(!error.message.includes(CONTROL));
            return true;
        });
        assert.equal(await readFile(clientPath, "utf8"), CLIENT);
        assert.equal(await readFile(controlPath, "utf8"), CONTROL);
    });
});

test("A14/A15 startup: disabling credential hardening withdraws startup before storage or permission access", async () => {
    await fixture(async root => {
        let calls = 0;
        const permissions: TokenPermissions = { validate: async () => { calls++; }, protectNew: async () => { calls++; } };
        const neverCreated = path.join(root, "no-storage-access");
        const supplied = { token: CLIENT, controlToken: CONTROL };
        await assert.rejects(createBrokerCredentialLoader(permissions, false)(neverCreated, supplied), /startup unavailable.*hardening is disabled/);
        assert.equal(calls, 0);
        await assert.rejects(lstat(neverCreated), { code: "ENOENT" });
        assert.deepEqual(await createBrokerCredentialLoader(permissions, true)(neverCreated, supplied), supplied);
        assert.equal(calls, 0);
        await assert.rejects(lstat(neverCreated), { code: "ENOENT" });
    });
});

test("A14 startup: identical supplied credentials are rejected while distinct supplied credentials remain usable", async () => {
    await fixture(async root => {
        const load = createBrokerCredentialLoader({ validate: async () => { throw new Error("Supplied credentials need no file read"); },
            protectNew: async () => { throw new Error("Supplied credentials need no provisioning"); } });
        await assert.rejects(load(root, { token: CLIENT, controlToken: CLIENT }), /must be distinct/);
        assert.deepEqual(await load(root, { token: CLIENT, controlToken: CONTROL }), { token: CLIENT, controlToken: CONTROL });
        await assert.rejects(lstat(path.join(root, "auth-token")), { code: "ENOENT" });
        await assert.rejects(lstat(path.join(root, "control-auth-token")), { code: "ENOENT" });
    });
});
