import assert from "node:assert/strict";
import { analyzeHygieneText } from "../../../../packages/vscode-extension/src/hygiene/HygieneAnalysis";
import { createVaultMigrationPlan } from "../../../../packages/vscode-extension/src/firewall/VaultMigrationPlan";
import { logContentViews } from "../../../../packages/vscode-extension/src/logs/LogContent";

const PRIVATE = "TEST_ONLY_F25_LOG_CONTROLLER_PRIVATE_2ed4b967";
const SOURCE = "Expected synthetic test failure\nAPI_KEY=" + PRIVATE + "\n    at public-test.cjs:7:3\n";
const text = JSON.stringify({ failure: { message: SOURCE }, file: "log-private-source.ts", sourceRoot: "../../private-reference" }) + "\n";
const parsed = logContentViews("test-results/failure.jsonl", text), key = Buffer.alloc(32, 25);
assert.equal(parsed.status, "ANALYZED");
const inputs = [{ source: "test-results/failure.jsonl/raw.txt", text }, ...parsed.views.map(view => ({ source: view.relativePath, text: view.text })),
    { source: "test-results/failure.jsonl/joined.txt", text: parsed.views.map(view => view.text).join("") }];
const rows = inputs.map((input, index) => {
    const plan = createVaultMigrationPlan(input.text, false, "10000000-0000-4000-8000-000000000025");
    const analysis = analyzeHygieneText({ ...input, environment: false }, key);
    return { index, view: index === 0 ? "RAW_SERIALIZED" : index === inputs.length - 1 ? "JOINED_SEMANTIC" : "DECODED_SEMANTIC",
        findings: analysis.findings.map(finding => ({ valueRef: finding.valueRef, kind: finding.kind, provider: finding.provider, line: finding.line })),
        candidates: plan.candidates.map(candidate => ({ exactRegistration: candidate.rawValue === PRIVATE, containsRegistration: candidate.rawValue.includes(PRIVATE),
            containsLiteralEscapeFraming: candidate.rawValue.includes("\\n"), length: candidate.rawValue.length, canonicalApiKeyLabel: candidate.key.toUpperCase() === "API_KEY" })) };
});
const report = { status: "ACTUAL_SYNTHETIC_CANONICAL_CANDIDATE_DIAGNOSTIC_NOT_PRODUCT_PASS", rows };
const output = JSON.stringify(report);assert(!output.includes(PRIVATE));assert(!output.includes(Buffer.from(PRIVATE).toString("base64")));console.log(output);
