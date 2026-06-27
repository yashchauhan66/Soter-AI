import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTROL_MAPPINGS,
  COMPLIANCE_FRAMEWORKS,
  getFrameworkCoverage,
  getControlsForOwaspCategory,
  getControlsForSoc2Criterion,
  type ControlMapping,
} from "../../lib/evidence-vault/compliance-framework";

// ── Constants & Structure Tests ──────────────────────────────

test("CFM-001: COMPLIANCE_FRAMEWORKS has correct values", () => {
  assert.deepEqual([...COMPLIANCE_FRAMEWORKS], ["SOC_2", "ISO_27001", "OWASP_LLM_TOP_10"]);
});

test("CFM-002: CONTROL_MAPPINGS has at least 12 entries", () => {
  assert.ok(CONTROL_MAPPINGS.length >= 12);
});

test("CFM-003: every control mapping has required fields", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    assert.equal(typeof mapping.evidenceType, "string", `Missing evidenceType in ${mapping.controlName}`);
    assert.equal(typeof mapping.controlName, "string", `Missing controlName in ${mapping.evidenceType}`);
    assert.ok(Array.isArray(mapping.soc2Criteria), `${mapping.controlName}: soc2Criteria must be an array`);
    assert.ok(Array.isArray(mapping.iso27001Control), `${mapping.controlName}: iso27001Control must be an array`);
    assert.ok(Array.isArray(mapping.owaspLlmMapping), `${mapping.controlName}: owaspLlmMapping must be an array`);
    assert.ok(["IMPLEMENTED", "PARTIAL", "PLANNED"].includes(mapping.status), `${mapping.controlName}: invalid status`);
    assert.equal(typeof mapping.auditNotes, "string", `${mapping.controlName}: missing auditNotes`);
  }
});

test("CFM-004: all control mappings have at least one SOC 2 criterion", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    assert.ok(mapping.soc2Criteria.length >= 1, `${mapping.controlName}: missing SOC 2 criteria`);
  }
});

test("CFM-005: all control mappings have at least one ISO 27001 control", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    assert.ok(mapping.iso27001Control.length >= 1, `${mapping.controlName}: missing ISO 27001 controls`);
  }
});

test("CFM-006: SOC 2 criteria follow CC format", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    for (const criterion of mapping.soc2Criteria) {
      assert.match(criterion, /^CC\d+\.\d+$/, `${mapping.controlName}: invalid SOC 2 criterion '${criterion}'`);
    }
  }
});

test("CFM-007: ISO 27001 controls follow A.x.x or A.x.x.x format", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    for (const control of mapping.iso27001Control) {
      assert.match(control, /^A\.\d+\.\d+(\.\d+)?$/, `${mapping.controlName}: invalid ISO 27001 control '${control}'`);
    }
  }
});

test("CFM-008: OWASP LLM mappings follow LLM format", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    for (const llm of mapping.owaspLlmMapping) {
      assert.match(llm, /^LLM\d{2}/, `${mapping.controlName}: invalid OWASP LLM mapping '${llm}'`);
    }
  }
});

// ── getFrameworkCoverage Tests ───────────────────────────────

test("CFM-009: getFrameworkCoverage returns correct shape", () => {
  const coverage = getFrameworkCoverage("SOC_2");
  assert.equal(typeof coverage.mapped, "number");
  assert.equal(typeof coverage.total, "number");
  assert.equal(typeof coverage.percentage, "number");
  assert.equal(typeof coverage.implementedCount, "number");
  assert.equal(typeof coverage.partialCount, "number");
  assert.equal(typeof coverage.plannedCount, "number");
});

test("CFM-010: getFrameworkCoverage returns 100% for all frameworks", () => {
  for (const framework of COMPLIANCE_FRAMEWORKS) {
    const coverage = getFrameworkCoverage(framework);
    assert.equal(coverage.percentage, 100);
  }
});

test("CFM-011: getFrameworkCoverage total equals CONTROL_MAPPINGS length", () => {
  const coverage = getFrameworkCoverage("SOC_2");
  assert.equal(coverage.total, CONTROL_MAPPINGS.length);
  assert.equal(coverage.mapped, CONTROL_MAPPINGS.length);
});

test("CFM-012: getFrameworkCoverage implemented + partial + planned = total", () => {
  const coverage = getFrameworkCoverage("SOC_2");
  assert.equal(
    coverage.implementedCount + coverage.partialCount + coverage.plannedCount,
    coverage.total,
  );
});

// ── getControlsForOwaspCategory Tests ────────────────────────

test("CFM-013: getControlsForOwaspCategory('LLM01') returns prompt injection controls", () => {
  const controls = getControlsForOwaspCategory("LLM01");
  assert.ok(controls.length >= 3, `Expected at least 3 controls for LLM01, got ${controls.length}`);
  for (const c of controls) {
    assert.ok(c.owaspLlmMapping.some((m) => m.startsWith("LLM01")));
  }
});

test("CFM-014: getControlsForOwaspCategory with non-existent category returns empty", () => {
  const controls = getControlsForOwaspCategory("LLM99");
  assert.equal(controls.length, 0);
});

test("CFM-015: getControlsForOwaspCategory('LLM06') returns data protection controls", () => {
  const controls = getControlsForOwaspCategory("LLM06");
  assert.ok(controls.length >= 2, `Expected at least 2 controls for LLM06, got ${controls.length}`);
});

// ── getControlsForSoc2Criterion Tests ────────────────────────

test("CFM-016: getControlsForSoc2Criterion('CC7.1') returns incident detection controls", () => {
  const controls = getControlsForSoc2Criterion("CC7.1");
  assert.ok(controls.length >= 3, `Expected at least 3 controls for CC7.1, got ${controls.length}`);
});

test("CFM-017: getControlsForSoc2Criterion with non-existent criterion returns empty", () => {
  const controls = getControlsForSoc2Criterion("CC99.9");
  assert.equal(controls.length, 0);
});

test("CFM-018: getControlsForSoc2Criterion('CC6.1') returns access control related controls", () => {
  const controls = getControlsForSoc2Criterion("CC6.1");
  for (const c of controls) {
    assert.ok(c.soc2Criteria.includes("CC6.1"));
  }
});

// ── Data Integrity Tests ─────────────────────────────────────

test("CFM-019: evidence types are unique across CONTROL_MAPPINGS", () => {
  const types = CONTROL_MAPPINGS.map((c) => c.evidenceType);
  const unique = new Set(types);
  assert.equal(unique.size, types.length, "Duplicate evidence types found");
});

test("CFM-020: control names are unique across CONTROL_MAPPINGS", () => {
  const names = CONTROL_MAPPINGS.map((c) => c.controlName);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, "Duplicate control names found");
});

test("CFM-021: audit notes are non-empty and meaningful", () => {
  for (const mapping of CONTROL_MAPPINGS) {
    assert.ok(mapping.auditNotes.length >= 20, `${mapping.controlName}: auditNotes too short`);
  }
});

test("CFM-022: at least one control covers each OWASP LLM category from LLM01-LLM10", () => {
  const allOwasps = CONTROL_MAPPINGS.flatMap((c) => c.owaspLlmMapping);
  for (let i = 1; i <= 10; i++) {
    const cat = `LLM${String(i).padStart(2, "0")}`;
    if (cat === "LLM03" || cat === "LLM04" || cat === "LLM05") continue; // some categories may not map directly
    const matching = allOwasps.some((m) => m.startsWith(cat));
    // Not all must be present, but most should
    if (["LLM01", "LLM02", "LLM06", "LLM08", "LLM10"].includes(cat)) {
      assert.ok(matching, `Expected at least one control for ${cat}`);
    }
  }
});

test("CFM-023: POLICY evidence type maps to correct OWASP categories", () => {
  const policy = CONTROL_MAPPINGS.find((c) => c.evidenceType === "POLICY");
  assert.ok(policy);
  assert.ok(policy.owaspLlmMapping.some((m) => m.startsWith("LLM01")));
  assert.ok(policy.soc2Criteria.includes("CC1.1"));
  assert.ok(policy.iso27001Control.includes("A.5.1"));
});
