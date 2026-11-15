import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, realpath, writeFile, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createVaultAppArtifact, parseVaultAppArtifact, VAULT_APP_ARTIFACT_LIMITS } from "../../../core/src/VaultAppArtifact";
import { parseVaultAppDescriptor, type VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { artifactImports } from "../vault-runtime/ArtifactImports";
import { captureRuntimeArtifact, runtimeBinding } from "../vault-runtime/RuntimeBinding";
import { VaultAppJob } from "../vault-runtime/VaultAppJob";

const secret = "SYNTHETIC_ARTIFACT_SELECTED_VALUE_64f17a";
const placeholder = "[SOTERAI_PROTECTED_0123456789ABCDEF0123456789ABCDEF_0]";
const sha = (source: string) => createHash("sha256").update(source).digest("hex");
async function fixture(files: Record<string, string>) {
    const root = await mkdtemp(join(await realpath(tmpdir()), "soterai-artifact-"));
    for (const [name, source] of Object.entries(files)) {
        const target = join(root, name); await mkdir(join(target, ".."), { recursive: true }); await writeFile(target, source, { flag: "wx" });
    }
    await writeFile(join(root, ".env.synthetic"), `SELECTED=${placeholder}\n`, { flag: "wx" });
    return { root, program: join(root, "app.cjs") };
}
function descriptor(root: string, source: string): VaultAppDescriptor {
    return { schemaVersion: 2, id: randomUUID(), root, cwd: root, program: join(root, "app.cjs"), source: join(root, ".env.synthetic"),
        programDigest: sha(source), artifactDigest: captureRuntimeArtifact(root, join(root, "app.cjs")).digest,
        args: [], selections: [{ name: "SELECTED", placeholder }] };
}

test("artifact closure digest binds transitive CJS and JSON bytes, paths and import mappings", async () => {
    const source = "exports.start = () => process.stdout.write(require('./lib/helper.js').value);";
    const f = await fixture({ "app.cjs": source, "lib/helper.js": "exports.value = require('../data.json').value;", "data.json": '{"value":"public"}' });
    const first = captureRuntimeArtifact(f.root, f.program);
    assert.equal(first.modules.length, 3); assert.deepEqual(parseVaultAppArtifact(first), first);
    assert.equal(captureRuntimeArtifact(f.root, f.program).digest, first.digest);
    assert.ok(Object.isFrozen(first) && Object.isFrozen(first.modules) && first.modules.every(row => Object.isFrozen(row) && Object.isFrozen(row.imports)));
    const approved = descriptor(f.root, source); runtimeBinding(approved);
    await writeFile(join(f.root, "data.json"), '{"value":"substituted"}');
    assert.notEqual(captureRuntimeArtifact(f.root, f.program).digest, first.digest);
    assert.throws(() => runtimeBinding(approved));
});

test("actual child runs captured dependencies after post-capture entry/helper writes", { timeout: 6000 }, async () => {
    const source = "exports.start = () => new Promise(resolve => setTimeout(() => { process.stdout.write(require('./helper.cjs').value); resolve(); }, 25));";
    const f = await fixture({ "app.cjs": source, "helper.cjs": "exports.value = 'approved-public';" });
    const artifact = captureRuntimeArtifact(f.root, f.program), approved = descriptor(f.root, source);
    const job = new VaultAppJob({ descriptor: approved, artifact, values: { SELECTED: secret }, runtime: { executable: process.execPath, electron: false }, parentEnvironment: {} });
    await writeFile(f.program, "throw Error('replaced entry');"); await writeFile(join(f.root, "helper.cjs"), "exports.value = 'unreviewed';");
    await job.start(); const result = await job.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, "approved-public");
    assert.ok(!JSON.stringify(job).includes(source)); assert.ok(!JSON.stringify(result).includes(secret)); job.dispose();
});

test("actual child resolves circular modules and pinned pure builtins without package lookup", { timeout: 6000 }, async () => {
    const source = "exports.value = 'public'; exports.start = () => process.stdout.write(require('./helper.cjs').value + require('node:path').basename('/one/two'));";
    const f = await fixture({ "app.cjs": source, "helper.cjs": "exports.value = require('./app.cjs').value + '-';" });
    const artifact = captureRuntimeArtifact(f.root, f.program);
    const job = new VaultAppJob({ descriptor: descriptor(f.root, source), artifact, values: { SELECTED: secret },
        runtime: { executable: process.execPath, electron: false }, parentEnvironment: {} });
    await job.start(); const result = await job.completion;
    assert.equal(result.output.status, "COMPLETE"); assert.equal(result.output.stdout, "public-two"); job.dispose();
});

for (const source of ["import('./late.cjs')", "const path = './late.cjs'; require(path)", "require(`./late.cjs`)",
    "const alias = require; alias('./late.cjs')", "module.require('./late.cjs')", "require.resolve('./late.cjs')", "require('dependency')",
    "require('node:fs')", "require('node:net')", "require('node:https')", "require('node:module')", "require('node:child_process')",
    "require('./without-extension')", "require('./native.node')", "process.getBuiltinModule('module')", "eval('code')", "new Function('code')"] as const) {
    test(`unsupported dependency contract refuses ${source}`, () => { assert.throws(() => artifactImports(source)); });
}

test("comments and inert literals do not masquerade as runtime imports", () => {
    assert.deepEqual(artifactImports("// require(variable)\nconst text = \"import('./fake.cjs')\"; exports.start = () => text;"), []);
    assert.deepEqual(artifactImports("const value = require('./real.cjs'); exports.start = () => value;"), ["./real.cjs"]);
});

test("entry-only legacy approvals and missing closure identity are refused", async () => {
    const source = "exports.start = () => {};", f = await fixture({ "app.cjs": source }), approved = descriptor(f.root, source);
    assert.ok(parseVaultAppDescriptor(approved));
    assert.equal(parseVaultAppDescriptor({ ...approved, schemaVersion: 1 }), undefined);
    const { artifactDigest: _digest, ...legacy } = approved; assert.equal(parseVaultAppDescriptor(legacy), undefined);
    const artifact = captureRuntimeArtifact(f.root, f.program);
    const job = new VaultAppJob({ descriptor: { ...approved, artifactDigest: "0".repeat(64) }, artifact,
        values: { SELECTED: secret }, runtime: { executable: process.execPath, electron: false }, parentEnvironment: {} });
    assert.equal((await job.start()).state, "BLOCKED"); assert.equal((await job.completion).output.status, "WITHHELD");
});

test("out-of-root imports and hard-linked imported files are refused", async () => {
    const f = await fixture({ "app.cjs": "require('../outside.cjs');" }); assert.throws(() => captureRuntimeArtifact(f.root, f.program));
    await writeFile(f.program, "require('./linked.cjs');"); await writeFile(join(f.root, "original.cjs"), "exports.value = 'public';");
    await link(join(f.root, "original.cjs"), join(f.root, "linked.cjs")); assert.throws(() => captureRuntimeArtifact(f.root, f.program));
});

test("closure limits refuse the 65th module while accepting 64", async () => {
    const files: Record<string, string> = { "app.cjs": "require('./m1.cjs');" };
    for (let index = 1; index < VAULT_APP_ARTIFACT_LIMITS.modules; index++) files[`m${index}.cjs`] = index + 1 === VAULT_APP_ARTIFACT_LIMITS.modules ? "exports.value = 'public';" : `require('./m${index + 1}.cjs');`;
    const f = await fixture(files); assert.equal(captureRuntimeArtifact(f.root, f.program).modules.length, 64);
    await writeFile(join(f.root, "m63.cjs"), "require('./m64.cjs');"); await writeFile(join(f.root, "m64.cjs"), "exports.value = 'public';");
    assert.throws(() => captureRuntimeArtifact(f.root, f.program));
});

test("private artifact validation refuses altered bytes and accessors without evaluating them", () => {
    const valid = createVaultAppArtifact("app.cjs", [{ path: "app.cjs", kind: "commonjs", source: "exports.value = 'public';", imports: [] }]);
    assert.equal(parseVaultAppArtifact({ ...valid, modules: [{ ...valid.modules[0], source: "exports.value = 'changed';" }] }), undefined);
    let reads = 0; const hostile = { ...valid }; Object.defineProperty(hostile, "modules", { enumerable: true, get() { reads++; return valid.modules; } });
    assert.equal(parseVaultAppArtifact(hostile), undefined); assert.equal(reads, 0);
    assert.throws(() => createVaultAppArtifact("app.cjs", [...valid.modules, { path: "unreachable.cjs", kind: "commonjs", source: "", imports: [] }]));
});
