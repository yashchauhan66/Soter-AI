import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("project creation completes with deterministic same-origin navigation", () => {
  const source = readFileSync("components/dashboard/NewProjectForm.tsx", "utf8");
  assert.match(source, /window\.location\.assign\("\/dashboard\/projects"\)/);
  assert.doesNotMatch(source, /router\.(?:push|refresh)/);
});
