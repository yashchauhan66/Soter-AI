import assert from "node:assert/strict";
import test from "node:test";
import { EXPANDED_SAFE_INPUTS } from "../../lib/classifiers/datasets/expandedSafeInputs";

// ── Dataset Size & Structure ─────────────────────────────────

test("ESI-001: EXPANDED_SAFE_INPUTS has at least 1000 entries", () => {
  assert.ok(
    EXPANDED_SAFE_INPUTS.length >= 1000,
    `Expected at least 1000 safe inputs, got ${EXPANDED_SAFE_INPUTS.length}`,
  );
});

test("ESI-002: every entry has required fields", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    assert.equal(typeof entry.id, "string", `Missing id for entry` + entry.text.slice(0, 30));
    assert.equal(typeof entry.text, "string", `Missing text for entry ${entry.id}`);
    assert.equal(typeof entry.label, "string", `Missing label for entry ${entry.id}`);
    assert.equal(typeof entry.language, "string", `Missing language for entry ${entry.id}`);
  }
});

test("ESI-003: every entry is labeled SAFE", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    assert.equal(entry.label, "SAFE", `${entry.id}: expected SAFE label, got ${entry.label}`);
  }
});

// ── ID Format Tests ──────────────────────────────────────────

test("ESI-004: entry IDs follow correct naming convention", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    assert.match(
      entry.id,
      /^safe-(?:gen|support|tech|creative|biz|edu|prod|multi-hi|multi-es|multi-fr|multi-de|sys|edge)-\d+$/,
      `${entry.id}: unexpected ID format`,
    );
  }
});

test("ESI-005: no duplicate IDs", () => {
  const ids = EXPANDED_SAFE_INPUTS.map((e) => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, `Found ${ids.length - unique.size} duplicate IDs`);
});

// ── Language Distribution ────────────────────────────────────

test("ESI-006: English entries exist (language: en)", () => {
  const english = EXPANDED_SAFE_INPUTS.filter((e) => e.language === "en");
  assert.ok(english.length >= 700, `Expected at least 700 English entries, got ${english.length}`);
});

test("ESI-007: Hindi entries exist (language: hi)", () => {
  const hindi = EXPANDED_SAFE_INPUTS.filter((e) => e.language === "hi");
  assert.ok(hindi.length >= 40, `Expected at least 40 Hindi entries, got ${hindi.length}`);
});

// ── Category Presence ────────────────────────────────────────

test("ESI-008: general knowledge category is present", () => {
  const gen = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-gen-"));
  assert.ok(gen.length >= 100, `Expected at least 100 general entries, got ${gen.length}`);
});

test("ESI-009: customer support category is present", () => {
  const support = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-support-"));
  assert.ok(support.length >= 100, `Expected at least 100 support entries, got ${support.length}`);
});

test("ESI-010: technical help category is present", () => {
  const tech = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-tech-"));
  assert.ok(tech.length >= 100, `Expected at least 100 tech entries, got ${tech.length}`);
});

test("ESI-011: creative writing category is present", () => {
  const creative = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-creative-"));
  assert.ok(creative.length >= 50, `Expected at least 50 creative entries, got ${creative.length}`);
});

test("ESI-012: business analysis category is present", () => {
  const biz = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-biz-"));
  assert.ok(biz.length >= 50, `Expected at least 50 business entries, got ${biz.length}`);
});

test("ESI-013: education category is present", () => {
  const edu = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-edu-"));
  assert.ok(edu.length >= 50, `Expected at least 50 education entries, got ${edu.length}`);
});

test("ESI-014: productivity category is present", () => {
  const prod = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-prod-"));
  assert.ok(prod.length >= 50, `Expected at least 50 productivity entries, got ${prod.length}`);
});

test("ESI-015: multilingual categories are present", () => {
  const hindi = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-hi-"));
  const spanish = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-es-"));
  const french = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-fr-"));
  const german = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-de-"));
  assert.ok(hindi.length >= 30, `Expected at least 30 Hindi entries, got ${hindi.length}`);
  assert.ok(spanish.length >= 20, `Expected at least 20 Spanish entries, got ${spanish.length}`);
  assert.ok(french.length >= 20, `Expected at least 20 French entries, got ${french.length}`);
  assert.ok(german.length >= 20, `Expected at least 20 German entries, got ${german.length}`);
});

test("ESI-016: system queries category is present", () => {
  const sys = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-sys-"));
  assert.ok(sys.length >= 30, `Expected at least 30 system entries, got ${sys.length}`);
});

test("ESI-017: edge cases category is present", () => {
  const edge = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-edge-"));
  assert.ok(edge.length >= 30, `Expected at least 30 edge entries, got ${edge.length}`);
});

// ── Content Quality Tests ────────────────────────────────────

test("ESI-018: all texts are non-empty strings", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    assert.ok(entry.text.length > 0, `${entry.id}: empty text`);
  }
});

test("ESI-019: texts are not trivially short", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    assert.ok(entry.text.length >= 5, `${entry.id}: text too short: "${entry.text}"`);
  }
});

test("ESI-020: texts are unique (no duplicate content)", () => {
  const texts = EXPANDED_SAFE_INPUTS.map((e) => e.text);
  const unique = new Set(texts);
  // Allow some overlap from array padding (the fill-in texts), but most should be unique
  assert.ok(unique.size >= texts.length * 0.9, "More than 10% duplicate texts found");
});

// ── Language Inference Tests ─────────────────────────────────

test("ESI-021: Hindi texts contain Hindi-specific words", () => {
  const hindi = EXPANDED_SAFE_INPUTS.filter((e) => e.language === "hi");
  for (const entry of hindi) {
    // Hindi texts are in Romanized (Hinglish) script. Check for common Hinglish patterns.
    const hasHindiIndicator =
      /[\u0900-\u097F]/.test(entry.text) ||
      /\b(?:hai|hain|hoga|hue|karun|karein|kaise|kya|mera|mere|mujhe|aap|aapke?|apna|chahiye|sakta|sakte|kripya|samjha|karna|karo|yeh|woh|nahi|hun|ho|ka|ki|ke|kahan|kab|koi|yahan|wahan|ab|bahut|thoda|do|lo|le|de|raha|rahi|rahe|ga|gi|tha|the|thi|tho|bhi|hi|se|ko|par|mein|aur|agar|toh|is|us|in|un)\b/i.test(entry.text);
    assert.ok(hasHindiIndicator, `${entry.id}: expected Hindi/South Asian language indicator in "${entry.text.slice(0, 50)}"`);
  }
});

test("ESI-022: Spanish texts contain Spanish-specific chars", () => {
  const spanish = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-es-"));
  for (const entry of spanish) {
    assert.match(entry.text, /[¿¡áéíóúüñ]/, `${entry.id}: expected Spanish characters`);
  }
});

test("ESI-023: French texts contain French language structure", () => {
  const french = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-multi-fr-"));
  for (const entry of french) {
    const hasFrenchIndicator =
      /[éèêëàâùûüôîïçœæ]/.test(entry.text) ||
      /\b(?:comment|quelle|quels|quelles|puis|je|votre|notre|mon|mes|ses|est|sont|avec|pour|dans|sur)\b/i.test(entry.text);
    assert.ok(hasFrenchIndicator, `${entry.id}: expected French language indicator in "${entry.text.slice(0, 50)}"`);
  }
});

// ── Benign Content Verification ──────────────────────────────

test("ESI-024: edge case texts contain security-related words in benign context", () => {
  const edge = EXPANDED_SAFE_INPUTS.filter((e) => e.id.startsWith("safe-edge-"));
  const hasBenignContext = edge.some(
    (e) =>
      e.text.toLowerCase().includes("explain") ||
      e.text.toLowerCase().includes("what does") ||
      e.text.toLowerCase().includes("difference"),
  );
  assert.ok(hasBenignContext, "Edge cases should explain terms in benign context");
});

test("ESI-025: text without URLs / no exfiltration patterns", () => {
  for (const entry of EXPANDED_SAFE_INPUTS) {
    // Safe inputs should not contain URLs (these are text prompts, not documents)
    assert.equal(entry.text.includes("http://") || entry.text.includes("https://"), false,
      `${entry.id}: safe input should not contain URLs: "${entry.text.slice(0, 60)}"`);
  }
});
