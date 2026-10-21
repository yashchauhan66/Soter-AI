import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, link, symlink, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateTier2LiteWorkspace, validatePublicPath, Tier2LiteInput } from "../tier2-lite/PublicWorkspace";
import { TIER2_LITE_COVERAGE } from "../tier2-lite/DevcontainerTemplate";

const baseImage = `example.invalid/reviewed-offline-image@sha256:${"0".repeat(64)}`;
async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "soter-tier2-lite-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "index.ts"), 'export const publicValue = "synthetic-public";\n');
    return root;
}
function input(root: string, overrides: Partial<Tier2LiteInput> = {}): Tier2LiteInput {
    return { enabled: true, sourceRoot: root, publicPaths: ["src/index.ts"], isProtected: () => false,
        reviewedBaseImage: baseImage, ...overrides };
}
async function cleanup(root: string) { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }

test("Tier-2-lite off/default withdraws generation before file or policy access", async () => {
    let calls = 0;
    const disabled = input(path.resolve("missing-tier2-fixture"), { enabled: undefined, isProtected: () => { calls++; return false; } });
    await assert.rejects(generateTier2LiteWorkspace(disabled), /disabled/);
    await assert.rejects(generateTier2LiteWorkspace({ ...disabled, enabled: false }), /disabled/);
    assert.equal(calls, 0);
});

test("explicit public selection omits synthetic secrets/history/cache and generates opaque placeholders without source writes", async () => {
    const root = await fixture();
    try {
        for (const directory of [".git", "node_modules", "history", "recovery", ".ssh"]) {
            await mkdir(path.join(root, directory)); await writeFile(path.join(root, directory, "private.txt"), "SYNTHETIC_DO_NOT_EXPORT");
        }
        await writeFile(path.join(root, ".env"), "FAKE_SECRET=SYNTHETIC_DO_NOT_EXPORT");
        const before = await readdir(root);
        const plan = await generateTier2LiteWorkspace(input(root, { placeholderCount: 2 }));
        assert.equal(plan.files.filter(file => file.kind === "PUBLIC").length, 1);
        assert.equal(plan.files.filter(file => file.kind === "PLACEHOLDER").length, 2);
        assert.ok(plan.files.every(file => !file.content.includes("SYNTHETIC_DO_NOT_EXPORT")));
        assert.equal(plan.manifest.coverage, TIER2_LITE_COVERAGE);
        assert.equal(plan.manifest.guarantees, "UNTESTED");
        assert.equal(plan.manifest.nativeAgents, "OUTSIDE_COVERAGE");
        assert.deepEqual(await readdir(root), before);
        for (const file of plan.files.filter(item => item.kind === "PLACEHOLDER")) {
            const placeholder = JSON.parse(file.content);
            assert.match(placeholder.placeholder, /^soterai:opaque:[0-9a-f-]{36}$/);
            assert.equal(placeholder.resolvableByAgent, false);
        }
    } finally { await cleanup(root); }
});

test("hidden, credential, home/history/recovery, Docker socket and ambiguous paths are never public selections", () => {
    for (const candidate of [".env", ".git/config", "src/.history/value", "home/file", "cache/file", "recovery/file",
        "node_modules/package.json", "docker.sock", "credentials.json", "key.pem", "../outside", "/absolute",
        "C:/Windows/file", "src\\index.ts", "src/*.ts", "src/index.ts:stream", "NUL", "src/file."]) {
        assert.throws(() => validatePublicPath(candidate), /rejects|Invalid/);
    }
    assert.equal(validatePublicPath("src/index.ts"), "src/index.ts");
});

test("unknown files, protected classifications and missing policy reject the entire snapshot", async () => {
    const root = await fixture();
    try {
        await assert.rejects(generateTier2LiteWorkspace(input(root, { publicPaths: ["src/missing.ts"] })), /canonicalized/);
        await assert.rejects(generateTier2LiteWorkspace(input(root, { isProtected: () => true })), /protected/);
        await assert.rejects(generateTier2LiteWorkspace(input(root, { isProtected: undefined })), /deny-policy/);
        await assert.rejects(generateTier2LiteWorkspace(input(root, { publicPaths: [] })), /Classify/);
    } finally { await cleanup(root); }
});

test("hardlinks and directory aliases cannot enter a public snapshot", async () => {
    const root = await fixture();
    try {
        await link(path.join(root, "src", "index.ts"), path.join(root, "linked.ts"));
        await assert.rejects(generateTier2LiteWorkspace(input(root, { publicPaths: ["linked.ts"] })), /Unsafe/);
        await symlink(path.join(root, "src"), path.join(root, "aliased"), process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(generateTier2LiteWorkspace(input(root, { publicPaths: ["aliased/index.ts"] })), /symbolic link|junction|alias/);
    } finally { await cleanup(root); }
});

test("policy changes and case collisions fail closed rather than return a partial snapshot", async () => {
    const root = await fixture();
    try {
        let decisions = 0;
        await assert.rejects(generateTier2LiteWorkspace(input(root, { isProtected: () => ++decisions > 2 })), /changed/);
        await assert.rejects(generateTier2LiteWorkspace(input(root, { publicPaths: ["src/index.ts", "src/INDEX.ts"] })), /collide/);
        await assert.rejects(generateTier2LiteWorkspace(input(root, { reviewedBaseImage: "example.invalid/image:latest" })), /pinned/);
    } finally { await cleanup(root); }
});

test("template has offline nonroot policy, no host binds or lifecycle hooks, and explicit live-attach gaps", async () => {
    const root = await fixture();
    try {
        const plan = await generateTier2LiteWorkspace(input(root));
        const config = JSON.parse(plan.files.find(file => file.relativePath === ".devcontainer/devcontainer.json")!.content);
        assert.equal(config.privileged, false); assert.equal(config.containerUser, "65532:65532");
        assert.equal(config.remoteUser, "65532"); assert.equal(config.userEnvProbe, "none");
        assert.deepEqual(config.mounts, []); assert.deepEqual(config.remoteEnv, {});
        assert.ok(config.runArgs.includes("--network=none")); assert.ok(config.runArgs.includes("--cap-drop=ALL"));
        assert.ok(config.runArgs.includes("--security-opt=no-new-privileges:true"));
        assert.match(config.workspaceMount, /type=volume$/); assert.ok(!JSON.stringify(config).includes("type=bind"));
        assert.ok(!JSON.stringify(config).includes("${localEnv:"));
        for (const key of ["initializeCommand", "postCreateCommand", "postStartCommand", "postAttachCommand"]) assert.equal(config[key], undefined);
        const settings = config.customizations.vscode.settings;
        assert.equal(settings["dev.containers.copyGitConfig"], false);
        assert.equal(settings["dev.containers.gitCredentialHelperConfigLocation"], "none");
        assert.equal(config.containerEnv.SSH_AUTH_SOCK, ""); assert.equal(config.containerEnv.GPG_AGENT_INFO, "");
        assert.equal(plan.manifest.forwardingPolicy.sshAgentForwarding, false);
        assert.equal(plan.manifest.forwardingPolicy.gpgAgentForwarding, false);
        assert.equal(plan.manifest.deployment.credentialForwardingAtAttach, "INCOMPLETE");
        assert.equal(plan.manifest.deployment.onlineMode, "INCOMPLETE_NOT_AVAILABLE");
        const second = await generateTier2LiteWorkspace(input(root));
        assert.notEqual(plan.runId, second.runId);
    } finally { await cleanup(root); }
});
