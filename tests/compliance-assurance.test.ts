import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContinuousAssurance } from "../lib/compliance/assurance";

const now = new Date("2026-06-28T00:00:00.000Z");

test("continuous assurance distinguishes effective, stale, missing, and failed controls", () => {
  const evidence = [
    { id: "policy", evidenceType: "POLICY", controlName: "Policy", status: "PASS", createdAt: now },
    { id: "guard", evidenceType: "GUARD_DECISION", controlName: "Guard", status: "PASS", createdAt: now },
    { id: "redaction", evidenceType: "REDACTION", controlName: "Data", status: "PASS", createdAt: now },
    { id: "passport", evidenceType: "AGENT_PASSPORT", controlName: "Identity", status: "FAIL", createdAt: now },
    { id: "approval-old", evidenceType: "APPROVAL", controlName: "Approval", status: "PASS", createdAt: "2025-01-01T00:00:00.000Z" },
  ];
  const result = evaluateContinuousAssurance({ evidence, now, freshnessDays: 30 });
  assert.equal(result.overallStatus, "FAIL");
  assert.equal(result.controls.find((control) => control.id === "AI-CTRL-01")?.status, "PASS");
  assert.equal(result.controls.find((control) => control.id === "AI-CTRL-03")?.status, "FAIL");
  assert.ok(result.assuranceScore < 100);
  assert.match(result.disclaimer, /not legal advice/i);
});

test("continuous assurance does not represent framework mapping as certification", () => {
  const result = evaluateContinuousAssurance({ evidence: [], now });
  assert.equal(result.assuranceScore, 0);
  assert.ok(result.frameworkCoverage.EU_AI_ACT.references.includes("Article 12"));
  assert.equal(JSON.stringify(result).includes("certified"), false);
});
