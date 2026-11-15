import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanDirectory } from "../ci/scan";
import { githubSummary, publicCiSummary } from "../ci/report";
import { runCiCommand } from "../ci/command";
test("public reports preserve useful gate counts without filenames, values or injected report fields", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-summary-"));
    await fs.writeFile(path.join(root, "confidential-client.env"), "DB_PASSWORD=BlueMango7!");
    const report = await scanDirectory(root);
    report.findings[0].path = "PRIVATE_PATH\n::error::$() `[link](https://private.invalid)`";
    report.findings[0].fingerprint = "PRIVATE_FINGERPRINT";
    report.findings[0].ruleId = "PRIVATE_RULE\n::error::injection";
    const json = JSON.stringify(publicCiSummary(report)), markdown = githubSummary(report);
    for (const raw of ["BlueMango7!", "confidential-client", "PRIVATE_", "::error::", "$()", "private.invalid"]) {
        assert.ok(!json.includes(raw)); assert.ok(!markdown.includes(raw));
    }
    assert.match(markdown, /FINDINGS/); assert.equal(publicCiSummary(report).findingsByCategory.other, 1);
});
test("contradictory clean state and missing artifact cannot become a passing summary", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-summary-invalid-"));
    const empty = await scanDirectory(root, { mode: "artifact" });
    assert.equal(publicCiSummary(empty).status, "incomplete");
    assert.throws(() => publicCiSummary({ ...empty, status: "clean", diagnostics: [] }));
    assert.throws(() => publicCiSummary({ ...empty, scannedFiles: -1 }));
    const cancelled = await scanDirectory(root, {}, [], { signal: AbortSignal.abort() });
    assert.match(githubSummary(cancelled), /CANCELLED/);
});
test("new CLI report formats keep nonzero finding and incomplete exit codes", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-summary-cli-"));
    await fs.writeFile(path.join(root, "private.env"), "DB_PASSWORD=BlueMango7!");
    for (const format of ["github", "summary-json"]) {
        const output: string[] = [], deps = { cwd: root, out: (text: string) => output.push(text), err: (text: string) => output.push(text), readStdin: async () => "[]" };
        assert.equal(await runCiCommand(["scan", "--format", format], deps), 1);
        assert.ok(!output.join("").includes("private.env")); assert.ok(!output.join("").includes("BlueMango7!"));
        assert.equal(await runCiCommand(["scan", "--root", "missing", "--format", format], deps), 2);
    }
});
