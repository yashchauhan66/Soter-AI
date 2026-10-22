import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { build, type BuildOptions } from "esbuild";

test("F22g production parser bundle loads with every JSONC implementation inlined", async () => {
    const repo = resolve(__dirname, "../../../.."), base = await mkdtemp(join(tmpdir(), "soterai-f22g-parser-bundle-")), output = join(base, "editor-plan.cjs");
    const helper = resolve(__dirname, "../../scripts/parserBundleOptions.cjs"), load = createRequire(join(base, "loader.cjs"));
    // Before the fix, absent production options mean the existing Node default.
    // Loading that emitted bundle reproduces the actual unresolved UMD import.
    const parserOptions: BuildOptions = existsSync(helper) ? load(helper).parserBundleOptions(repo) : {};
    const result = await build({ absWorkingDir: repo, entryPoints: [resolve(__dirname, "../config-scanners/EditorSecretPlan.ts")], outfile: output,
        bundle: true, platform: "node", format: "cjs", target: "node18", minify: true, sourcemap: false, metafile: true,
        tsconfig: resolve(__dirname, "../../tsconfig.json"), logLevel: "silent", ...parserOptions });
    const planner = load(output), value = "TEST_ONLY_F22G_BUNDLED_PRIVATE_6b2a7e91", text = JSON.stringify({ env: { TOKEN: value }, "http.proxyAuthorization": "Basic " + value + "-proxy" });
    const plan = planner.createEditorSecretPlan(text, "editor-jsonc", "27000000-0000-4000-8000-000000000007");
    assert.equal(plan.candidates.length, 2); assert(!plan.maskedText.includes(value)); assert.equal(plan.restoreMode, "checkpoint");
    assert.equal(planner.createEditorSecretPlan(plan.maskedText, "editor-jsonc", "27000000-0000-4000-8000-000000000007").candidates.length, 0);
    const inputs = Object.keys(result.metafile!.inputs).filter(name => name.replaceAll("\\", "/").includes("node_modules/jsonc-parser/"));
    assert(inputs.some(name => name.replaceAll("\\", "/").endsWith("jsonc-parser/lib/esm/main.js")));
    assert(inputs.every(name => name.replaceAll("\\", "/").includes("jsonc-parser/lib/esm/")));
});
