import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const script = readFileSync("scripts/validate-strongest-local-release.ts", "utf8");

test("strongest local release gate is exposed as an npm script", () => {
  assert.equal(packageJson.scripts?.["validate:strongest-local"], "tsx scripts/validate-strongest-local-release.ts");
});

test("strongest local release gate keeps critical local verification steps mandatory", () => {
  for (const id of [
    "root-typecheck",
    "guard-core-test",
    "broker-test",
    "vscode-extension-test",
    "vscode-isolated-install",
    "manifest-permissions",
    "dependency-audit-high",
    "full-test-suite",
    "security-99-evidence-advisory",
    "security-100-evidence-advisory",
  ]) {
    assert.match(script, new RegExp(`id: "${id}"`));
  }
  assert.match(script, /required: true/g);
});

test("strongest local release gate reports claim eligibility without converting advisory evidence into a fake pass", () => {
  assert.match(script, /canClaim99Plus/);
  assert.match(script, /canClaim100/);
  assert.match(script, /does not replace external pentest/);
  assert.doesNotMatch(script, /validate:security-100:strict/);
});
