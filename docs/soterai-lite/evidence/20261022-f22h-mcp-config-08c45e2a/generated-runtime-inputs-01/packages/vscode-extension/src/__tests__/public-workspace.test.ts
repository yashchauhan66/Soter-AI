import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync, statSync, writeFileSync } from "node:fs";
import { developmentContract, localDevelopmentFields, syntheticEnvironment, syntheticFixture } from "../project-privacy/publication/DevelopmentContract";
import { canonicalDirectory, publicationRelativePath, validateNewDestination } from "../project-privacy/publication/PublicationPaths";
import { PublicationSession, MAX_PUBLIC_FILES, type PublicationCapture } from "../project-privacy/publication/PublicWorkspace";

let root: string;
let source: string;
beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "soterai-publication-unit-"));
    source = path.join(root, "source");
    await mkdir(source);
});
afterEach(async () => {
    const checked = path.resolve(root);
    assert.equal(path.dirname(checked), path.resolve(tmpdir()));
    assert.ok(path.basename(checked).startsWith("soterai-publication-unit-"));
    await rm(checked, { recursive: true, force: true });
});

const publicCapture = (relativePath = "src/index.ts"): PublicationCapture => ({ relativePath,
    revision: "synthetic-policy-1", identity: "synthetic-file-1", safeText: "export const greeting = 'public';\n", kind: "public-code" });
const envCapture = (): PublicationCapture => ({ relativePath: ".env", revision: "synthetic-policy-1",
    identity: "synthetic-env-1", safeText: "DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]", kind: "environment-schema",
    environmentNames: ["DATABASE_URL", "API_KEY"] });
function session(capture: (name: string) => Promise<PublicationCapture> = async name => publicCapture(name),
    enabled = () => true, now = () => 100): PublicationSession {
    return new PublicationSession(source, { capture, enabled, now });
}

test("synthetic contract accepts only finite presets and emits no runtime or original URL", () => {
    const contract = developmentContract([{ name: "DATABASE_URL", preset: "loopback-database" }, { name: "API_KEY", preset: "text" }]);
    assert.equal(contract.syntheticOnly, true);
    assert.equal(contract.automaticExecution, false);
    assert.match(syntheticEnvironment(contract), /127\.0\.0\.1/);
    assert.match(syntheticEnvironment(contract), /API_KEY=SOTERAI_SYNTHETIC_VALUE/);
    assert.doesNotMatch(syntheticEnvironment(contract), /original-private\.invalid/);
    assert.equal(JSON.parse(syntheticFixture()).syntheticOnly, true);
    assert.ok(Object.isFrozen(contract.fields));
    assert.throws(() => developmentContract([{ name: "X", preset: "original-private-value" as never }]));
    assert.throws(() => developmentContract([{ name: "X", preset: "text" }, { name: "X", preset: "integer" }]));
    assert.throws(() => developmentContract([{ name: undefined as never, preset: "text" }]));
    assert.throws(() => developmentContract([{ name: "VALUE\nPRIVATE", preset: "text" }]));
});

test("local development defaults derive only from approved names and use finite synthetic loopback examples", () => {
    const fields = localDevelopmentFields(["PORT", "DATABASE_URL", "API_URL", "API_KEY"]);
    assert.deepEqual(fields.map(field => field.preset), ["integer", "loopback-database", "loopback-url", "text"]);
    const example = syntheticEnvironment(developmentContract(fields));
    assert.match(example, /PORT=3000/);
    assert.match(example, /DATABASE_URL=postgresql:\/\/soterai_fixture:soterai_fixture@127\.0\.0\.1/);
    assert.match(example, /API_URL=http:\/\/127\.0\.0\.1:3000\/synthetic-only/);
    assert.match(example, /API_KEY=SOTERAI_SYNTHETIC_VALUE/);
    assert.throws(() => localDevelopmentFields(["NOT\nA_KEY"]));
});

test("publication paths reject traversal, Windows streams/device aliases and credential/history/policy outputs", () => {
    for (const value of ["../outside", "/outside", "src\\x", "x:stream", "NUL.txt", "src/CON", "src/file.",
        "src//x", ".git/config", ".codex/history.jsonl", ".ssh/id_ed25519", ".soterai/policy.json", ".npmrc",
        ".vscode/settings.json", ".git-credentials", ".bash_history", ".pgpass", "soterai-publication-manifest.json", "control-auth-token"]) {
        assert.throws(() => publicationRelativePath(value), value);
    }
    assert.equal(publicationRelativePath("src/application.ts"), "src/application.ts");
});

test("publication writes only selected safe saved content and synthetic fixtures to a new folder", async () => {
    await writeFile(path.join(source, "never-selected.txt"), "SYNTHETIC_PRIVATE_VALUE_NOT_SELECTED");
    const owner = session();
    const plan = await owner.prepare(["src/index.ts"]);
    const result = await owner.publish(plan, path.join(root, "public"));
    assert.equal(result.isolation, "NO ISOLATION");
    assert.equal(result.fileCount, 5);
    assert.equal(await readFile(path.join(result.destination, "src/index.ts"), "utf8"), publicCapture().safeText);
    const manifest = JSON.parse(await readFile(path.join(result.destination, "soterai-publication-manifest.json"), "utf8"));
    assert.equal(manifest.manifestSha256, plan.manifestSha256);
    const { manifestSha256, ...body } = manifest;
    assert.equal(createHash("sha256").update(JSON.stringify(body)).digest("hex"), manifestSha256);
    assert.ok(!JSON.stringify(manifest).includes(source));
    assert.ok(!(await readdir(result.destination)).includes("never-selected.txt"));
    assert.equal(await readFile(path.join(source, "never-selected.txt"), "utf8"), "SYNTHETIC_PRIVATE_VALUE_NOT_SELECTED");
});

test("environment publication copies no .env original and exports only explicitly approved names with synthetic examples", async () => {
    const owner = session(async () => envCapture());
    const plan = await owner.prepare([".env"], [{ name: "DATABASE_URL", preset: "loopback-database" }]);
    assert.ok(!JSON.stringify(plan).includes("API_KEY"));
    const result = await owner.publish(plan, path.join(root, "environment-public"));
    const filenames = await readdir(result.destination);
    assert.ok(!filenames.includes(".env"));
    const environment = await readFile(path.join(result.destination, ".env.example"), "utf8");
    assert.match(environment, /DATABASE_URL=postgresql:\/\/soterai_fixture/);
    assert.doesNotMatch(environment, /API_KEY/);
    assert.doesNotMatch(environment, /\[MASKED\]/);
});

test("synthetic fields absent from selected approved schema fail closed", async () => {
    await assert.rejects(session().prepare(["public.ts"], [{ name: "DATABASE_URL", preset: "text" }]), /selected environment/);
    await assert.rejects(session(async () => envCapture()).prepare([".env"], [{ name: "NOT_DECLARED", preset: "text" }]), /selected environment/);
});

test("source .env.example is schema-only and cannot collide with the synthetic generated output", async () => {
    const owner = session(async name => ({ ...envCapture(), relativePath: name }));
    const plan = await owner.prepare([".env.example"], [{ name: "API_KEY", preset: "text" }]);
    assert.equal(plan.entries.filter(entry => entry.path === ".env.example").length, 1);
    assert.equal(plan.entries.find(entry => entry.path === ".env.example")!.treatment, "synthetic-generated");
});

test("preparation bounds file inventory, text bytes, binary data and duplicate selections", async () => {
    await assert.rejects(session().prepare([]), /between 1 and 64/);
    await assert.rejects(session().prepare(Array.from({ length: MAX_PUBLIC_FILES + 1 }, (_, i) => `${i}.ts`)), /between 1 and 64/);
    await assert.rejects(session().prepare(["a.ts", "a.ts"]), /Duplicate/);
    if (process.platform === "win32") await assert.rejects(session().prepare(["a.ts", "A.ts"]), /Duplicate/);
    await assert.rejects(session(async name => ({ ...publicCapture(name), safeText: "x".repeat(65_537) })).prepare(["a.ts"]), /size/);
    await assert.rejects(session(async name => ({ ...publicCapture(name), safeText: "x\0value" })).prepare(["a.ts"]), /size/);
    await assert.rejects(session(async name => ({ ...publicCapture(name), safeText: "x".repeat(65_536) }))
        .prepare(Array.from({ length: 17 }, (_, i) => `${i}.ts`)), /size/);
});

test("policy/source changes after review publish nothing", async () => {
    let changed = false;
    const owner = session(async name => ({ ...publicCapture(name), revision: changed ? "policy-2" : "policy-1" }));
    const plan = await owner.prepare(["src/index.ts"]);
    changed = true;
    const destination = path.join(root, "stale");
    await assert.rejects(owner.publish(plan, destination), /Source or policy changed/);
    assert.ok(!(await readdir(root)).includes("stale"));
});

test("same safe output with a changed original identity still invalidates approval", async () => {
    let identity = "original-hash-1";
    const owner = session(async () => ({ ...envCapture(), identity }));
    const plan = await owner.prepare([".env"], [{ name: "API_KEY", preset: "text" }]);
    identity = "original-hash-2";
    await assert.rejects(owner.publish(plan, path.join(root, "changed-value")), /Source or policy changed/);
});

test("revocation before or during preparation and disabled publication withhold output", async () => {
    const owner = session();
    const plan = await owner.prepare(["src/index.ts"]);
    owner.revoke();
    await assert.rejects(owner.publish(plan, path.join(root, "revoked")), /revoked/);
    await assert.rejects(session(undefined, () => false).prepare(["a.ts"]), /unavailable/);
    let enabled = true;
    const gated = session(undefined, () => enabled);
    const gatedPlan = await gated.prepare(["a.ts"]);
    enabled = false;
    await assert.rejects(gated.publish(gatedPlan, path.join(root, "disabled")), /unavailable/);
    let during!: PublicationSession;
    during = session(async name => { during.revoke(); return publicCapture(name); });
    await assert.rejects(during.prepare(["a.ts"]), /revoked during preparation/);
});

test("review expiration and replay cannot publish a second snapshot", async () => {
    let now = 1;
    const owner = session(undefined, undefined, () => now);
    const plan = await owner.prepare(["src/index.ts"]);
    now = plan.expiresAt + 1;
    await assert.rejects(owner.publish(plan, path.join(root, "expired")), /expired/);
    await assert.rejects(owner.publish(plan, path.join(root, "replay")), /already used/);
    const validOwner = session();
    const validPlan = await validOwner.prepare(["src/index.ts"]);
    await validOwner.publish(validPlan, path.join(root, "once"));
    await assert.rejects(validOwner.publish(validPlan, path.join(root, "twice")), /already used/);
});

test("publication rejects nonfinite, negative, unsafe and regressing clocks, including exact expiry", async () => {
    for (const now of [NaN, Infinity, -Infinity, -1, Number.MAX_VALUE]) {
        await assert.rejects(session(undefined, undefined, () => now).prepare(["src/index.ts"]), /clock/);
    }
    let now = 100;
    const owner = session(undefined, undefined, () => now);
    const plan = await owner.prepare(["src/index.ts"]);
    now = 99;
    await assert.rejects(owner.publish(plan, path.join(root, "regressing-clock")), /clock/);
    now = 100;
    const exact = session(undefined, undefined, () => now);
    const exactPlan = await exact.prepare(["src/index.ts"]);
    now = exactPlan.expiresAt;
    await assert.rejects(exact.publish(exactPlan, path.join(root, "exact-expiry")), /expired/);
    now = 100;
    const invalidAfter = session(undefined, undefined, () => now);
    const invalidAfterPlan = await invalidAfter.prepare(["src/index.ts"]);
    now = NaN;
    await assert.rejects(invalidAfter.publish(invalidAfterPlan, path.join(root, "invalid-after-review")), /clock/);
    assert.deepEqual(await readdir(root), ["source"]);
});

test("revocation during the completion-manifest write never acknowledges successful preparation", async () => {
    const destination = path.join(root, "manifest-revoked");
    const manifestPath = path.join(destination, "soterai-publication-manifest.json");
    let scheduled = false;
    let owner!: PublicationSession;
    owner = session(undefined, undefined, () => {
        if (!scheduled && existsSync(manifestPath)) {
            scheduled = true;
            queueMicrotask(() => owner.revoke());
        }
        return 100;
    });
    const plan = await owner.prepare(["src/index.ts"]);
    await assert.rejects(owner.publish(plan, destination), /revoked/);
    assert.equal(scheduled, true);
    // A retained manifest is evidence only; its mere existence is not a successful command result.
    assert.ok(existsSync(destination));
});

test("completion-manifest content is verified after its write before acknowledging success", async () => {
    const destination = path.join(root, "manifest-changed");
    const manifestPath = path.join(destination, "soterai-publication-manifest.json");
    let changed = false;
    const owner = session(undefined, undefined, () => {
        if (!changed && existsSync(manifestPath) && statSync(manifestPath).size > 0) {
            changed = true;
            writeFileSync(manifestPath, "{}\n");
        }
        return 100;
    });
    const plan = await owner.prepare(["src/index.ts"]);
    await assert.rejects(owner.publish(plan, destination), /Completion manifest changed/);
    assert.equal(changed, true);
});

test("manifest copies and mutations are rejected; original plan data is immutable", async () => {
    const owner = session();
    const plan = await owner.prepare(["src/index.ts"]);
    assert.ok(Object.isFrozen(plan));
    assert.ok(Object.isFrozen(plan.entries));
    assert.ok(Object.isFrozen(plan.entries[0]));
    await assert.rejects(owner.publish({ ...plan, isolation: "NO ISOLATION" }, path.join(root, "copy")), /invalid/);
    assert.throws(() => { (plan.entries[0] as { path: string }).path = "outside.ts"; });
});

test("existing destinations, source children/ancestors and protected stores are never overwritten", async () => {
    const existing = path.join(root, "existing");
    await mkdir(existing);
    await writeFile(path.join(existing, "keep.txt"), "owner data");
    await assert.rejects(validateNewDestination(source, existing, []), /new folder/);
    await assert.rejects(validateNewDestination(source, path.join(source, "public"), []), /outside the source/);
    await assert.rejects(validateNewDestination(source, root, []), /outside the source/);
    const protectedStore = path.join(root, "protected-store");
    await mkdir(protectedStore);
    await assert.rejects(validateNewDestination(source, path.join(protectedStore, "public"), [protectedStore]), /protected storage/);
    assert.equal(await readFile(path.join(existing, "keep.txt"), "utf8"), "owner data");
});

test("junction or symlink output-parent aliases are rejected without a completion manifest", async t => {
    const outside = path.join(root, "actual");
    await mkdir(outside);
    const alias = path.join(root, "linked-parent");
    try { await symlink(outside, alias, process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") { t.skip("OS denied synthetic link creation; assertion untested."); return; }
        throw error;
    }
    await assert.rejects(canonicalDirectory(alias), /Linked|alias/);
    await assert.rejects(validateNewDestination(source, path.join(alias, "snapshot"), []), /Linked|alias/);
    assert.deepEqual(await readdir(outside), []);
});

test("changed policy after writing leaves an explicitly incomplete folder and no completion manifest", async () => {
    let captures = 0;
    const owner = session(async name => ({ ...publicCapture(name), revision: ++captures > 2 ? "changed" : "initial" }));
    const plan = await owner.prepare(["src/index.ts"]);
    const destination = path.join(root, "incomplete");
    await assert.rejects(owner.publish(plan, destination), /Source or policy changed/);
    assert.ok((await readdir(destination)).includes("src"));
    assert.ok(!(await readdir(destination)).includes("soterai-publication-manifest.json"));
});

test("source canonical root aliases are rejected during preparation", async t => {
    const alias = path.join(root, "source-alias");
    try { await symlink(source, alias, process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") { t.skip("OS denied synthetic link creation; assertion untested."); return; }
        throw error;
    }
    const owner = new PublicationSession(alias, { enabled: () => true, now: () => 0, capture: async name => publicCapture(name) });
    await assert.rejects(owner.prepare(["src/index.ts"]), /Linked|alias/);
});
