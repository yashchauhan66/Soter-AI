import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as stub from "./phase2/vscode-stub";
import { BoundarySnapshot, initializeBoundaryState, RULES_KEY, storedRules, updateRules, updateVersionedPolicy } from "../ai-boundary/BoundarySnapshot";
import { documentDigest, OMITTED, parseManualRules } from "../ai-boundary/policy";

const FLAG = "soterai.lite.versionedPolicy";
const privateText = "SYNTHETIC_F02_PRIVATE_NOTE_NOT_A_RECOGNIZED_TOKEN";
let root: string;
let context: ReturnType<typeof stub.makeExtensionContext>;
const uri = (relative: string) => stub.Uri.file(join(root, relative));
const key = () => stub.state.folders[0].uri.toString();
const policy = (sensitiveGlobs: string[] = [], paths: unknown[] = []) => ({ schemaVersion: 1, presets: [], rules: { paths, regions: [] }, sensitiveGlobs });
async function write(relative: string, text: string) { await mkdir(dirname(join(root, relative)), { recursive: true }); await writeFile(join(root, relative), text); }
beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "soterai-f02-boundary-"));
    stub.resetState(root); context = stub.makeExtensionContext(root);
    initializeBoundaryState(context.workspaceState as never);
    await write("public.txt", "Useful public control.");
    await write("memo.txt", privateText);
});
afterEach(async () => {
    mock.restoreAll(); context.subscriptions.forEach(item => item.dispose());
    const target = resolve(root); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("soterai-f02-boundary-"));
    await rm(target, { recursive: true, force: true });
});
test("F02-B01 new credential defaults withhold private bytes and preserve public near-match", async () => {
    await write(".config/gcloud/application_default_credentials.json", privateText);
    await write(".config/gcloud/application_default_credentials.schema.json", "Useful public control.");
    const snapshot = await BoundarySnapshot.load();
    assert.equal(await snapshot.read(uri(".config/gcloud/application_default_credentials.json") as never), OMITTED);
    assert.equal(snapshot.isSensitive(uri(".config/gcloud/application_default_credentials.json") as never), true);
    assert.equal(await snapshot.read(uri(".config/gcloud/application_default_credentials.schema.json") as never), "Useful public control.");
});
test("F02-B02 team denies and sensitivity survive deletion without removing ordinary manual rules", async () => {
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "previous.txt" }] }));
    await write(".soterai/team-policy.json", JSON.stringify(policy(["memo.txt"], [{ kind: "file", pattern: "team.txt" }])));
    let snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("team.txt") as never), true); assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true);
    await unlink(join(root, ".soterai/team-policy.json"));
    snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("team.txt") as never), true); assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true);
    assert.equal(snapshot.blocks(uri("previous.txt") as never), true); assert.equal(snapshot.blocks(uri("public.txt") as never), false);
});
test("F02-B03 unknown team schema fails closed for public content too", async () => {
    await write(".soterai/team-policy.json", JSON.stringify({ ...policy(), schemaVersion: 99 }));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.availableForRoot(stub.state.folders[0].uri as never), false);
    assert.equal(await snapshot.read(uri("public.txt") as never), OMITTED);
});
test("F02-B04 failed default enrollment prevents managed release and leaves no partial record", async () => {
    mock.method(context.workspaceState, "update", async () => { throw new Error("SYNTHETIC_STORAGE_FAILURE"); });
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.availableForRoot(stub.state.folders[0].uri as never), false);
    assert.equal(await snapshot.read(uri("public.txt") as never), OMITTED);
    assert.equal(context.workspaceState.get(RULES_KEY), undefined);
});
test("F02-B05 v2 envelope stays enforced with flag off while public control remains available", async () => {
    await context.workspaceState.update(RULES_KEY, { [key()]: { schemaVersion: 2, manual: { paths: [], regions: [] }, policy: policy(["memo.txt"]) } });
    stub.state.config.set(FLAG, false);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true); assert.equal(snapshot.blocks(uri("memo.txt") as never), true);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
    assert.throws(() => parseManualRules(context.workspaceState.get<Record<string, unknown>>(RULES_KEY)![key()]));
});
test("F02-B06 manual updates preserve accepted versioned policy sensitivity", async () => {
    await context.workspaceState.update(RULES_KEY, { [key()]: { schemaVersion: 2, manual: { paths: [], regions: [] }, policy: policy(["memo.txt"]) } });
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "new.txt" }] }));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true); assert.equal(snapshot.blocks(uri("new.txt") as never), true);
    assert.deepEqual(storedRules(key()).paths, [{ kind: "file", pattern: "new.txt" }]);
});
test("F02-B07 legacy project sensitive classification is retained on deletion and flag withdrawal", async () => {
    await write(".soterai/policy.json", JSON.stringify({ version: 1, protectedFiles: ["memo.txt"], sensitivePaths: ["notes/**"] }));
    let snapshot = await BoundarySnapshot.load(); assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true);
    await unlink(join(root, ".soterai/policy.json")); stub.state.config.set(FLAG, false);
    snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.isSensitive(uri("memo.txt") as never), true); assert.equal(snapshot.isSensitive(uri("notes/diary.txt") as never), true);
    assert.equal(snapshot.blocks(uri("public.txt") as never), false);
});
test("F02-B08 no-op reload retains exact revision and performs no redundant writes", async () => {
    const update = context.workspaceState.update; let writes = 0;
    mock.method(context.workspaceState, "update", async (name: string, value: unknown) => { writes++; await update(name, value); });
    const first = await BoundarySnapshot.load(); const afterFirst = writes;
    assert.ok(afterFirst > 0);
    const second = await BoundarySnapshot.load();
    assert.equal(writes, afterFirst); assert.equal(second.accessRevision(uri("public.txt") as never), first.accessRevision(uri("public.txt") as never));
});
test("F02-B09 existing NFD protected regions retain privacy with versioned setup withdrawn", async () => {
    stub.state.config.set(FLAG, false);
    const filename = "cafe\u0301.txt", text = "public:" + privateText + ":public";
    await write(filename, text);
    await updateRules(key(), current => ({ ...current, regions: [{ path: filename, digest: documentDigest(text), start: 7, end: 7 + privateText.length }] }));
    const snapshot = await BoundarySnapshot.load();
    const shared = snapshot.selection(uri(filename) as never, text, 0, text.length);
    assert.ok(!shared.includes(privateText)); assert.equal(shared, "public:" + OMITTED + ":public");
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
});
test("F02-B10 preset-only team policy expands and retains its declared sensitivity", async () => {
    await write(".soterai/team-policy.json", JSON.stringify({ ...policy(), presets: ["ci"] }));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.isSensitive(uri(".vscode/settings.json") as never), true);
    assert.equal(snapshot.blocks(uri(".github/workflows/ci.yml") as never), true);
    assert.equal(snapshot.blocks(uri("public.txt") as never), false);
});
test("F02-B11 combined envelope budget failure preserves prior readable policy on import", async () => {
    await updateRules(key(), current => ({ ...current, paths: Array.from({ length: 200 }, (_, i) => ({ kind: "file", pattern: `manual/${i}/` + "x".repeat(390) })) }));
    await BoundarySnapshot.load();
    const before = structuredClone(context.workspaceState.get(RULES_KEY));
    const added = policy(Array.from({ length: 230 }, (_, i) => `extra/${i}/` + "y".repeat(240)));
    await assert.rejects(updateVersionedPolicy(key(), added as never));
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), "Useful public control.");
});
test("F02-B12 post-migration manual addition validates the whole envelope before saving", async () => {
    stub.state.config.set(FLAG, false);
    const accepted = policy(Array.from({ length: 480 }, (_, i) => `accepted/${i}/` + "z".repeat(240)));
    await context.workspaceState.update(RULES_KEY, { [key()]: { schemaVersion: 2, manual: { paths: [], regions: [] }, policy: accepted } });
    const before = structuredClone(context.workspaceState.get(RULES_KEY));
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), "Useful public control.");
    await assert.rejects(updateRules(key(), current => ({ ...current, paths: Array.from({ length: 100 }, (_, i) => ({ kind: "file", pattern: `new/${i}/` + "w".repeat(240) })) })));
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), "Useful public control.");
});
test("F02-B13 migrating NFD file sensitivity and folder denies preserves their exact targets", async () => {
    const name = "cafe\u0301.txt", folder = "cafe\u0301-private";
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: name, sensitive: true }, { kind: "folder", pattern: folder }] }));
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri(name) as never), true); assert.equal(snapshot.isSensitive(uri(name) as never), true);
    assert.equal(snapshot.blocks(uri(folder + "/child.txt") as never), true);
    assert.equal(snapshot.blocks(uri("cafe-public/child.txt") as never), false);
});
test("F02-B14 new NFD manual saves under the v2 envelope still deny and classify their files", async () => {
    await BoundarySnapshot.load();
    await updateRules(key(), current => ({ ...current, paths: [{ kind: "file", pattern: "cafe\u0301-new.txt", sensitive: true }] }));
    stub.state.config.set(FLAG, false);
    const snapshot = await BoundarySnapshot.load();
    assert.equal(snapshot.blocks(uri("cafe\u0301-new.txt") as never), true); assert.equal(snapshot.isSensitive(uri("cafe\u0301-new.txt") as never), true);
    assert.equal(snapshot.blocks(uri("public.txt") as never), false);
});
test("F02-B15 import cannot accept a rule union that its portable schema cannot export", async () => {
    await updateRules(key(), current => ({ ...current, paths: Array.from({ length: 200 }, (_, i) => ({ kind: "file", pattern: `manual-${i}.txt` })) }));
    await BoundarySnapshot.load(); const before = structuredClone(context.workspaceState.get(RULES_KEY));
    await assert.rejects(updateVersionedPolicy(key(), policy([], Array.from({ length: 100 }, (_, i) => ({ kind: "file", pattern: `team-${i}.txt` }))) as never));
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before);
    assert.equal(await (await BoundarySnapshot.load()).read(uri("public.txt") as never), "Useful public control.");
});
test("F02-B16 new manual saves retain earlier team policy when the effective rule budget is full", async () => {
    await BoundarySnapshot.load(); await updateVersionedPolicy(key(), policy([], Array.from({ length: 100 }, (_, i) => ({ kind: "file", pattern: `team-${i}.txt` }))) as never);
    const before = structuredClone(context.workspaceState.get(RULES_KEY));
    await assert.rejects(updateRules(key(), current => ({ ...current, paths: Array.from({ length: 200 }, (_, i) => ({ kind: "file", pattern: `manual-${i}.txt` })) })));
    assert.deepEqual(context.workspaceState.get(RULES_KEY), before);
    const snapshot = await BoundarySnapshot.load(); assert.equal(snapshot.blocks(uri("team-99.txt") as never), true);
    assert.equal(await snapshot.read(uri("public.txt") as never), "Useful public control.");
});
