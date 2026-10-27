import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

// Review the actual finite client's bundle without writing or evaluating it.
// No temporary artifact, product import, child authority or CWD assumption.
test("F26a minimal pre-commit client bundles the canonical index parser without owner Git or editor authority", async () => {
    const repo = resolve(__dirname, "../../../..");
    const entry = resolve(__dirname, "../history-hooks/preCommitClientMain.ts");
    const protocol = resolve(__dirname, "../history-hooks/PreCommitProtocol.ts");
    const forbidden = new Set([
        resolve(__dirname, "../security/SafeGit.ts"),
        resolve(__dirname, "../terminal/CheckedGitMetadata.ts"),
    ]);
    const built = await build({
        absWorkingDir: repo, entryPoints: [entry], write: false,
        bundle: true, platform: "node", format: "cjs", target: "node18",
        minify: true, metafile: true, sourcemap: false, logLevel: "silent",
        tsconfig: resolve(__dirname, "../../tsconfig.json"),
        // Keep a future editor import visible to the negative assertion instead
        // of disguising it as an unrelated unresolved-package build failure.
        external: ["vscode"],
    });
    const metadata = built.metafile;
    assert(metadata, "The exact client entry must produce inspectable bundle metadata.");
    assert(built.outputFiles?.length === 1 && built.outputFiles[0].contents.length > 0,
        "The review must inspect one actual nonempty in-memory client bundle.");
    const outputs = Object.values(metadata.outputs);
    assert(outputs.length === 1 && outputs[0].entryPoint !== undefined
        && resolve(repo, outputs[0].entryPoint) === entry,
        "The reviewed output must belong to the exact production client main entry.");
    const output = outputs[0];
    const externalAuthority = output.imports.some(imported => {
        const name = imported.path.replace(/^node:/, "");
        return imported.external && /^(?:vscode|child_process)(?:\/|$)/.test(name);
    });
    const ownerInput = Object.keys(metadata.inputs).some(input => forbidden.has(resolve(repo, input)))
        || Object.keys(output.inputs).some(input => forbidden.has(resolve(repo, input)));
    assert(!externalAuthority, "The minimal client bundle must not import vscode or child_process authority.");
    assert(!ownerInput, "The client closure must exclude SafeGit.ts and CheckedGitMetadata.ts, including side-effect retention.");
    const retained = (file: string) => Object.entries(output.inputs)
        .some(([input, contribution]) => resolve(repo, input) === file && contribution.bytesInOutput > 0);
    assert(retained(entry), "The production client entry must contribute to the actual output.");
    assert(retained(protocol), "The client must retain the canonical PreCommitProtocol staged-index parser.");
    // Never evaluate, import, print, persist or delete generated bundle bytes.
});
