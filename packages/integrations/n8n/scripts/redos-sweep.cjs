/**
 * ReDoS sweep over every regex literal in localEngine.ts.
 *
 * The two catastrophic patterns found in this file were both found by accident —
 * one adversarial input happened to hit them. That is not a method. This runs
 * every regex in the file against a battery of near-miss shapes (long runs that
 * make a quantifier commit and never let it complete) and reports anything
 * whose cost is not effectively linear.
 *
 * Run: node scripts/redos-sweep.cjs
 */
const fs = require("fs");
const path = require("path");

const BUDGET_MS = Number(process.env.REDOS_BUDGET_MS || 250);
const source = fs.readFileSync(
  path.join(__dirname, "..", "nodes", "SoterGuard", "shared", "localEngine.ts"),
  "utf8",
);

// Each entry is a generator so the same shape can be measured at two sizes: a
// pattern that is linear costs ~2x from 30k to 60k, one that backtracks costs ~4x.
const shapes = {
  "word run": (n) => "a".repeat(n),
  "digit run": (n) => "1".repeat(n),
  "spaced digits": (n) => "1 ".repeat(n / 2),
  "upper run": (n) => "A".repeat(n),
  "at + dotted labels": (n) => "a".repeat(n / 4) + "@" + "b.".repeat(n / 4),
  "at + word run": (n) => "a".repeat(n / 2) + "@" + "b".repeat(n / 2),
  "dots and dashes": (n) => ".-".repeat(n / 2),
  "alnum dashes": (n) => "a-1".repeat(n / 3),
  "slashes and colons": (n) => "postgres://" + "a".repeat(n),
  "begin block": (n) => "-----BEGIN PRIVATE KEY-----x".repeat(n / 28),
  "words and spaces": (n) => "ignore all previous ".repeat(n / 20),
  "newline systems": (n) => "\nsystem: ".repeat(n / 9),
  "mixed punctuation": (n) => "a.b-c_d%e+f ".repeat(n / 12),
  "underscore run": (n) => "_".repeat(n),
  "base64ish": (n) => "eyJhbGciOiJIUzI1NiJ9".repeat(n / 20),
};

const regexes = [];
const lineRe = new RegExp("^\\s*(?:pattern:\\s*)?(/.*/[gimsuy]*),?\\s*$");
const lines = source.split("\n");
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(lineRe);
  if (!m) continue;
  let re;
  try {
    // eslint-disable-next-line no-eval
    re = eval(m[1]);
  } catch {
    continue;
  }
  if (re instanceof RegExp) regexes.push({ line: i + 1, re, text: m[1] });
}

function timeOnce(re, input) {
  const probe = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const started = process.hrtime.bigint();
  try {
    let match;
    let hits = 0;
    while ((match = probe.exec(input)) !== null) {
      hits += 1;
      if (probe.lastIndex === match.index) probe.lastIndex += 1;
      if (hits > 5000) break;
    }
  } catch {
    /* a pattern that throws is not a timing finding */
  }
  return Number(process.hrtime.bigint() - started) / 1e6;
}

// A single sample makes this gate flaky, and a flaky security gate is worse than
// no gate — it gets ignored. The bounded private-key rule costs O(n * 4000):
// linear with a large constant, so its 4x-input growth is genuinely ~4x, but on
// an 18ms baseline scheduler noise pushed it over a 6x threshold on roughly one
// run in three. Timing takes the minimum of several samples (noise only ever
// adds time) and the growth threshold sits at 10x, still well under the ~16x a
// truly quadratic pattern shows for a 4x input.
function timeBest(re, input, samples = 3) {
  let best = Infinity;
  for (let i = 0; i < samples; i++) best = Math.min(best, timeOnce(re, input));
  return best;
}

const GROWTH_LIMIT = Number(process.env.REDOS_GROWTH_LIMIT || 10);
// A gate that has been loosened to stop flapping must be shown to still fire.
// This is the UPI rule exactly as it was before the `{3,}` was bounded — a real
// catastrophic pattern that cost 39.7 seconds on a single 200,000-char item. The
// sweep applies its own criteria to it, at a size small enough to stay quick,
// and refuses to report a clean bill of health if its own thresholds miss it.
//
// The input is "a-1" repeated, not a uniform run of letters. That detail is the
// whole mechanism: the leading `\b` makes every interior position of "aaaa..."
// fail instantly, so a uniform run is linear and looks harmless. Alternating
// word and non-word characters puts a word boundary every couple of characters,
// and at each one the class consumes to the end of the input and then gives back
// every character looking for an "@" that is never there — O(n^2).
const CANARY = /\b[\w.-]{3,}@(?:oksbi|okhdfcbank|okicici|okaxis|paytm|ybl|ibl|axl|upi|apl)\b/;
const canarySmall = timeBest(CANARY, "a-1".repeat(1000), 1);
const canaryLarge = timeBest(CANARY, "a-1".repeat(4000), 1);
const canaryGrowth = canarySmall > 0 ? canaryLarge / canarySmall : 0;
const canaryCaught = canaryLarge > BUDGET_MS || canaryGrowth > GROWTH_LIMIT;

const findings = [];
for (const entry of regexes) {
  for (const [shapeName, build] of Object.entries(shapes)) {
    const small = timeBest(entry.re, build(15000));
    if (small < 5) continue; // nowhere near a problem at any size
    const large = timeBest(entry.re, build(60000));
    // 4x the input for ~4x the work is linear; a quadratic pattern shows ~16x.
    const growth = small > 0 ? large / small : 0;
    if (large > BUDGET_MS || growth > GROWTH_LIMIT) {
      findings.push({ line: entry.line, shapeName, small, large, growth, text: entry.text });
    }
  }
}

console.log(`${regexes.length} regex literals x ${Object.keys(shapes).length} adversarial shapes`);
console.log(
  `budget ${BUDGET_MS}ms at 60,000 chars, superlinear threshold ${GROWTH_LIMIT}x growth for a 4x input ` +
    `(best of 3 samples per measurement)\n`,
);

console.log(
  `canary (the UPI rule before its quantifier was bounded): ` +
    `3k=${canarySmall.toFixed(1)}ms  12k=${canaryLarge.toFixed(1)}ms  growth=${canaryGrowth.toFixed(1)}x  ` +
    `${canaryCaught ? "flagged — thresholds are live" : "MISSED"}\n`,
);

if (!canaryCaught) {
  console.error(
    "These thresholds no longer detect a known catastrophic pattern, so a clean\n" +
      "result here would mean nothing. Tighten REDOS_BUDGET_MS / REDOS_GROWTH_LIMIT.",
  );
  process.exit(1);
}

if (findings.length === 0) {
  console.log("no superlinear or over-budget pattern found");
  process.exit(0);
}

findings.sort((a, b) => b.large - a.large);
for (const finding of findings) {
  console.log(
    `line ${finding.line}  shape "${finding.shapeName}"  ` +
      `15k=${finding.small.toFixed(1)}ms  60k=${finding.large.toFixed(1)}ms  ` +
      `growth=${finding.growth.toFixed(1)}x`,
  );
  console.log(`  ${finding.text.slice(0, 150)}`);
}
console.log(`\n${findings.length} finding(s).`);
process.exit(1);
