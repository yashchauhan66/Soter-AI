import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
async function fixture() { const module = await import("../adapters/GeminiCliRuntimePin"), root = await mkdtemp(join(tmpdir(), "soterai-f20c-pin-"));
    await writeFile(join(root, "public.js"), "PUBLIC"); return { module, root, entries: [{ relative: "public.js", bytes: 6, sha256: createHash("sha256").update("PUBLIC").digest("hex") }] }; }
test("F20C public runtime pin matches exact bytes and metadata stamps", async () => { const f = await fixture(), stamps = await f.module.verifyGeminiTree(f.root, f.entries); assert.equal(stamps.filter(s => !s.directory).length, 1); assert(stamps.some(s => s.directory)); assert.equal(await f.module.geminiStampsCurrent(stamps), true); await writeFile(join(f.root, "public.js"), "CHANGE"); assert.equal(await f.module.geminiStampsCurrent(stamps), false); await assert.rejects(f.module.verifyGeminiTree(f.root, f.entries)); });
test("F20C extra public file, missing file and directory substitution refuse", async () => { for (const variant of ["extra", "missing", "directory"]) { const f = await fixture(); if (variant === "extra") await writeFile(join(f.root, "new.js"), "PUBLIC"); if (variant === "missing") f.entries[0].relative = "missing.js"; if (variant === "directory") { await mkdir(join(f.root, "directory")); f.entries[0].relative = "directory"; } await assert.rejects(f.module.verifyGeminiTree(f.root, f.entries)); } });
test("F20C malformed pin paths and duplicate entries refuse without traversal", async () => { const f = await fixture(); for (const relative of ["../outside", "C:/outside", "a\\b", "./public.js"]) await assert.rejects(f.module.verifyGeminiTree(f.root, [{ ...f.entries[0], relative }])); await assert.rejects(f.module.verifyGeminiTree(f.root, [...f.entries, ...f.entries])); });
test("F20C shipped exact Gemini pin contains relative public names only", async () => { const f = await fixture(), pin = f.module.GEMINI_CLI_PIN; assert.equal(pin.version, "0.55.1"); assert.equal(pin.files.length, 463); assert.equal(pin.dependency.version, "4.0.2"); assert.equal(pin.node.version, "v22.16.0"); assert(!/Users[\\/]USER|AppData|[A-Z]:[\\/]/i.test(JSON.stringify(pin))); });
test("F20C installed package layout pins manifest plus complete bundle while leaving optional native packages outside verified route", async () => {
    const f = await fixture(); await mkdir(join(f.root, "bundle")); await writeFile(join(f.root, "bundle", "entry.js"), "PUBLIC"); await writeFile(join(f.root, "package.json"), "PUBLIC");
    // Unselected docs/optional addon trees are not imported or certified by this pin.
    await writeFile(join(f.root, "README.md"), "PUBLIC_DOC"); await mkdir(join(f.root, "node_modules"));
    const entries = [{ ...f.entries[0], relative: "package.json" }, { ...f.entries[0], relative: "bundle/entry.js" }];
    const stamps = await f.module.verifyGeminiPackage(f.root, entries); assert.equal(stamps.filter(s => !s.directory).length, 2);
    await writeFile(join(f.root, "bundle", "extra.js"), "PUBLIC"); await assert.rejects(f.module.verifyGeminiPackage(f.root, entries));
});
