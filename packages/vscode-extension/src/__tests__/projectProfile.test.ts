import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { detectProjectProfile } from "../project-journey/ProjectProfile";
test("project detection inspects fixed metadata without parsing config or exposing names/values", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-profile-"));
    await fs.writeFile(path.join(root, "package.json"), "not valid JSON; do not execute");
    await fs.writeFile(path.join(root, "tsconfig.json"), "private-config");
    await fs.writeFile(path.join(root, ".env.production"), "DB_PASSWORD=BlueMango7!");
    await fs.writeFile(path.join(root, "private-customer-name.txt"), "private");
    await fs.mkdir(path.join(root, ".git"));
    const result = await detectProjectProfile(root);
    assert.deepEqual(result, { label: "Node / TypeScript", environmentFiles: 1, git: true, node: true, incomplete: false });
    assert.ok(!JSON.stringify(result).includes(root)); assert.ok(!JSON.stringify(result).includes("BlueMango"));
});
test("unavailable and hardlinked project markers stay incomplete", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-profile-links-"));
    assert.equal((await detectProjectProfile(path.join(root, "missing"))).incomplete, true);
    await fs.writeFile(path.join(root, "original"), "private"); await fs.link(path.join(root, "original"), path.join(root, "package.json"));
    const result = await detectProjectProfile(root);
    assert.equal(result.node, false); assert.equal(result.incomplete, true);
});
