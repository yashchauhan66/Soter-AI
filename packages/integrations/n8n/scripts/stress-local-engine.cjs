/**
 * Worst-case timing probe for the offline engine.
 *
 * The 54-item unit suite asserts behaviour on realistic inputs; it says nothing
 * about what a hostile or merely large input costs. n8n runs a node
 * synchronously inside the worker that owns the execution, so a single slow
 * item does not degrade — it stalls every other workflow on that worker. This
 * script measures the paths where that is possible and prints a plain table so
 * a regression is visible rather than inferred.
 *
 * Run: node scripts/stress-local-engine.cjs   (after `npm run test:unit`)
 */
const path = require("path");

const enginePath = path.join(__dirname, "..", "test-build", "nodes", "SoterGuard", "shared", "localEngine.js");
let engine;
try {
  engine = require(enginePath);
} catch {
  console.error("Compiled engine not found. Run `npm run test:unit` first (it emits test-build/).");
  process.exit(2);
}

const BUDGET_MS = Number(process.env.STRESS_BUDGET_MS || 2000);
const rows = [];
let failures = 0;

function time(label, budgetMs, fn) {
  const started = process.hrtime.bigint();
  let note = "";
  try {
    const out = fn();
    if (typeof out === "string") note = out;
  } catch (error) {
    note = `THREW ${error && error.message ? error.message : error}`;
  }
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const ok = ms <= budgetMs && !note.startsWith("THREW");
  if (!ok) failures += 1;
  rows.push({ label, ms, budgetMs, ok, note });
}

function repeatTo(unit, length) {
  let out = "";
  while (out.length < length) out += unit;
  return out.slice(0, length);
}

// ---------------------------------------------------------------------------
// analyzeLocal: the per-item cost every action pays.
// ---------------------------------------------------------------------------
const prose = "Please summarise the quarterly finance report and email the result to the team. ";
engine.analyzeLocal(repeatTo(prose, 2000)); // warm the regex/JIT paths

time("analyzeLocal prose 200k (input cap)", BUDGET_MS, () => {
  engine.analyzeLocal(repeatTo(prose, 200000));
});

// Adversarial shapes aimed at the quantifiers in the redaction rules. Each one
// is a near-miss: long enough to make the engine try, never completable.
time("analyzeLocal 100k digits (card rule)", BUDGET_MS, () => {
  engine.analyzeLocal("1".repeat(100000));
});
time("analyzeLocal 100k spaced digits (card rule)", BUDGET_MS, () => {
  engine.analyzeLocal(repeatTo("1 ", 100000));
});
time("analyzeLocal 60k local-part, no TLD (email rule)", BUDGET_MS, () => {
  engine.analyzeLocal(`${"a".repeat(30000)}@${"b".repeat(30000)}`);
});
time("analyzeLocal 60k dotted domain, no TLD (email rule)", BUDGET_MS, () => {
  engine.analyzeLocal(`${"a".repeat(20000)}@${repeatTo("b.", 40000)}`);
});
time("analyzeLocal 100k A-Z run (IBAN/PAN/GST rules)", BUDGET_MS, () => {
  engine.analyzeLocal(`AB12${"A".repeat(100000)}`);
});
time("analyzeLocal 20k unterminated BEGIN blocks (key rule)", BUDGET_MS, () => {
  engine.analyzeLocal(repeatTo("-----BEGIN PRIVATE KEY-----x", 200000));
});
time("analyzeLocal 200k combining marks (fold path)", BUDGET_MS, () => {
  engine.analyzeLocal(repeatTo("á̧̀", 200000));
});
time("analyzeLocal 200k invisible controls (fold path)", BUDGET_MS, () => {
  engine.analyzeLocal(repeatTo("i​g‌n‍o⁠r﻿e", 200000));
});

// ---------------------------------------------------------------------------
// compareEgressLocal: the only quadratic-shaped comparison in the engine.
// ---------------------------------------------------------------------------
// A 32-bit LCG stepped with Math.imul. Plain `state * 1103515245` exceeds 2^53
// and loses the low bits that carry the randomness, which collapses different
// seeds onto a shared short cycle — two "independent" 25k strings then share a
// long verbatim run and the no-overlap cases stop testing what they claim to.
function pseudoRandomText(length, seed) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz ";
  let out = "";
  let state = seed | 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) | 0;
    out += alphabet[((state >>> 16) & 0x7fff) % alphabet.length];
  }
  return out;
}

const egressOut = pseudoRandomText(25000, 7);
const egressSrc = pseudoRandomText(25000, 991);

time("compareEgressLocal 25k vs 1 x 25k source (no overlap)", BUDGET_MS, () => {
  const result = engine.compareEgressLocal(egressOut, [{ id: "s1", content: egressSrc }]);
  return result.decision === "ALLOW" ? "" : `expected ALLOW, got ${result.decision}`;
});

time("compareEgressLocal 25k vs 10 x 25k sources (no overlap)", BUDGET_MS, () => {
  const sources = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, content: egressSrc }));
  engine.compareEgressLocal(egressOut, sources);
});

// Fixtures are built outside the timed blocks. Generating 200,000 characters one
// at a time costs a few hundred milliseconds by itself, and counting that as
// engine time overstated the 50-source case by roughly 4x.
const bigOut = pseudoRandomText(200000, 13);
const bigSrc = pseudoRandomText(200000, 4242);
const bigSources = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, content: bigSrc }));

time("compareEgressLocal 200k vs 50 x 200k sources (no overlap)", BUDGET_MS * 5, () => {
  const result = engine.compareEgressLocal(bigOut, bigSources);
  return result.decision === "ALLOW" ? "" : `THREW expected ALLOW, got ${result.decision}`;
});

// Protected source content does not pass through the node's 200,000-character item
// validation, so nothing upstream stops a PDF-extract node from handing over eight
// megabytes. Unbounded, the shingle stage allocates a distinct string per 8-word
// window: measured 2.8 s and 167 MB of heap for this one source, inside a worker
// that runs nodes synchronously. The engine's own slice is what keeps this at the
// cost of a 200,000-character source, and the budget here is what notices if that
// slice is ever removed.
const oversizeSrc = pseudoRandomText(8000000, 8080);

time("compareEgressLocal 8MB source is bounded, not proportional", BUDGET_MS, () => {
  const result = engine.compareEgressLocal(bigOut, [{ id: "huge", content: oversizeSrc }]);
  if (result.decision === "ALLOW") return "THREW a partly-compared source reported as clean";
  if (result.partiallyComparedSourceIds.length !== 1) return "THREW truncation not disclosed";
  return "";
});

// A leak must still be caught at scale — speed is worthless if it costs recall.
const buriedSecret = pseudoRandomText(200, 555);
const buriedSource = `${pseudoRandomText(100000, 21)}${buriedSecret}${pseudoRandomText(100000, 22)}`;
const buriedLeak = `${pseudoRandomText(90000, 31)}${buriedSecret}${pseudoRandomText(90000, 32)}`;

time("compareEgressLocal detects a 200-char verbatim run inside 200k", BUDGET_MS, () => {
  const result = engine.compareEgressLocal(buriedLeak, [{ id: "s1", content: buriedSource }]);
  if (result.decision !== "BLOCK") return `THREW verbatim leak not blocked (${result.decision})`;
  const hit = result.matchedSources.find((entry) => entry.kind === "verbatim");
  if (!hit || hit.overlap < 200) return `THREW verbatim overlap under-reported (${hit && hit.overlap})`;
  return "";
});

// The run sits past offset 20,000 on both sides — where the previous
// implementation truncated, and therefore could not have found it at all.
const lateSecret = pseudoRandomText(120, 777);
const lateSource = `${pseudoRandomText(60000, 41)}${lateSecret}${pseudoRandomText(1000, 42)}`;
const lateLeak = `${pseudoRandomText(60000, 51)}${lateSecret}${pseudoRandomText(1000, 52)}`;

time("compareEgressLocal detects a run past the old 20k truncation point", BUDGET_MS, () => {
  const result = engine.compareEgressLocal(lateLeak, [{ id: "s1", content: lateSource }]);
  return result.decision === "BLOCK" ? "" : `THREW leak past offset 20k not blocked (${result.decision})`;
});

time("compareEgressLocal detects an exact 40-char run (threshold edge)", BUDGET_MS, () => {
  const run = "TOTALLY-UNIQUE-PROTECTED-RUN-OF-40-CHARS";
  if (run.length !== 40) return `THREW fixture is ${run.length} chars, expected 40`;
  const result = engine.compareEgressLocal(`prefix ${run} suffix`, [
    { id: "s1", content: `document body ${run} more body` },
  ]);
  return result.decision === "BLOCK" ? "" : `THREW 40-char run not blocked (${result.decision})`;
});

time("compareEgressLocal ignores a 38-char run (threshold edge)", BUDGET_MS, () => {
  // The run is measured after folding and includes whatever the surrounding
  // context happens to share. Padding both sides with a space would contribute
  // two more matched characters and push a 39-char fixture over the 40-char
  // threshold — which is correct behaviour, and why the run is bounded by
  // differing adjacent characters here instead.
  const run = "UNIQUE-PROTECTED-RUN-OF-THIRTY-EIGHT-C";
  if (run.length !== 38) return `THREW fixture is ${run.length} chars, expected 38`;
  const result = engine.compareEgressLocal(`zz${run}qq`, [{ id: "s1", content: `body${run}body` }]);
  const verbatim = result.matchedSources.some((entry) => entry.kind === "verbatim");
  return verbatim ? "THREW 38-char run reported as verbatim" : "";
});

// ---------------------------------------------------------------------------
// The email rule is the one pattern where the natural spelling backtracks
// catastrophically, so its recall is pinned here rather than trusted.
// ---------------------------------------------------------------------------
time("email rule still matches real address shapes", BUDGET_MS, () => {
  const shouldRedact = [
    "john.doe@example.com",
    "j@a.io",
    "first+tag@sub.domain.co.uk",
    "user_name-1%test@mail-server.example.org",
    "PRIYA.SHARMA@company.co.in",
    "a.b.c.d@deep.sub.domain.example.museum",
    "contact@xn--80ak6aa92e.com",
    "billing@192-168-1-1.nip.io",
  ];
  const missed = shouldRedact.filter((address) =>
    engine.redactLocal(`please write to ${address} today`).safeText.includes(address),
  );
  if (missed.length) return `THREW email rule missed ${missed.join(", ")}`;

  const shouldNotRedact = ["not.an.email@", "@example.com", "plain text with an @ sign", "price@ 40 dollars"];
  const overreached = shouldNotRedact.filter((text) => engine.redactLocal(text).safeText.includes("[REDACTED_EMAIL]"));
  return overreached.length ? `THREW email rule over-matched ${overreached.join(", ")}` : "";
});

time("UPI rule still matches real VPA shapes", BUDGET_MS, () => {
  const shouldRedact = ["priya.sharma@oksbi", "9876543210@ybl", "shop-1@paytm", "a_b.c@okhdfcbank"];
  const missed = shouldRedact.filter((vpa) => engine.redactLocal(`pay ${vpa} now`).safeText.includes(vpa));
  return missed.length ? `THREW UPI rule missed ${missed.join(", ")}` : "";
});

// ---------------------------------------------------------------------------
// The remaining local layers, at the input cap.
// ---------------------------------------------------------------------------
time("scoreRagDocumentLocal 200k document", BUDGET_MS, () => {
  engine.scoreRagDocumentLocal(repeatTo(prose, 200000), "doc-1", "email");
});
time("scoreRagDocumentLocal non-string source", BUDGET_MS, () => {
  engine.scoreRagDocumentLocal("hello", "doc-1", undefined);
  engine.scoreRagDocumentLocal("hello", "doc-1", 42);
  engine.scoreRagDocumentLocal("hello", "doc-1", null);
});
time("checkToolCallLocal 200k argument payload", BUDGET_MS, () => {
  engine.checkToolCallLocal("http_request", { body: repeatTo(prose, 200000) }, undefined);
});
time("redactLocal 200k mixed sensitive payload", BUDGET_MS, () => {
  const unit = "contact a.b@c.io or 415-555-0198, ssn 123-45-6789, card 4111111111111111. ";
  engine.redactLocal(repeatTo(unit, 200000));
});

// ---------------------------------------------------------------------------
const width = Math.max(...rows.map((row) => row.label.length));
console.log("");
console.log(`${"case".padEnd(width)}  ${"ms".padStart(9)}  ${"budget".padStart(7)}  result`);
console.log("-".repeat(width + 32));
for (const row of rows) {
  console.log(
    `${row.label.padEnd(width)}  ${row.ms.toFixed(1).padStart(9)}  ${String(row.budgetMs).padStart(7)}  ` +
      `${row.ok ? "ok" : "OVER BUDGET"}${row.note ? ` — ${row.note}` : ""}`,
  );
}
console.log("");
if (failures > 0) {
  console.error(`${failures} case(s) over budget or failing.`);
  process.exit(1);
}
console.log("all stress cases within budget");
