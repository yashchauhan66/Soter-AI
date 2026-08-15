/**
 * Not every mid-word match is a defect, and bounding all 28 flagged rules would
 * make detection WORSE while making the spans look tidier.
 *
 * Two different things were conflated by the sweep:
 *
 *   COLLISION   the pattern token lands inside an unrelated word.
 *               "meth" in "something", "ied" in "dried", "dox" in "unorthodox",
 *               "iterate" in "reiterate", "mode" in "model", "persona" in
 *               "personality". The fire carries no signal — a real defect.
 *
 *   INFLECTION  the pattern token is the stem and the extra characters are an
 *               ordinary English ending. "enable" in "enabled", "bypass" in
 *               "bypassing", "ignore" in "ignored", "hack" in "hacker".
 *               The fire is CORRECT; only the reported span is truncated.
 *               Bounding these would delete real detections.
 *
 * Discriminator: the colliding word must START with the token (interior and
 * suffix containment are always collisions), AND the remainder must be an
 * inflectional ending. That second half is what separates enable/enabled from
 * mode/model — both are prefix-containment, but "l" is not a suffix.
 *
 * Output sizes the real backlog: which of the remaining flagged rules actually
 * need a boundary, and which are already behaving.
 */
import { readFileSync } from "node:fs";

// Ordinary inflectional / derivational endings that preserve the stem's meaning.
// Deliberately conservative: anything not on this list counts as a collision, so
// the script over-reports work rather than silently clearing a broken rule.
const ENDINGS = [
  "s", "es", "d", "ed", "ing", "er", "ers", "or", "ors", "r", "rs",
  "ment", "ments", "ion", "ions", "y", "ies",
];

type Verdict = "COLLISION" | "INFLECTION";

export function classify(token: string, word: string): Verdict {
  const t = token.toLowerCase();
  const w = word.toLowerCase();
  if (w === t) return "INFLECTION"; // exact, not a mid-word hit at all
  if (!w.startsWith(t)) return "COLLISION"; // interior or suffix containment
  const rest = w.slice(t.length);
  if (ENDINGS.includes(rest)) return "INFLECTION";
  // Stem-doubling ("stop"+"ped") and e-drop ("make"+"ing") are still the lemma.
  if (/^([a-z])\1(ed|ing)$/.test(rest)) return "INFLECTION";
  return "COLLISION";
}

// The measured collisions from the 6,861-row sweep, as (rule, token, word, count).
// Kept as data so the classification is auditable against the numbers that
// produced it rather than re-derived from a fresh run.
const OBSERVED: { rule: string; token: string; words: [string, number][]; ben: number; atk: number }[] = [
  { rule: "Jailbreak persona override", token: "mode", ben: 2, atk: 64,
    words: [["personality", 34], ["model", 23], ["personal", 5], ["models", 2], ["modes", 1], ["postmodernism", 1]] },
  { rule: "Hinglish mode activation", token: "enable", ben: 0, atk: 27,
    words: [["enabled", 27]] },
  { rule: "Direct explosive construction inquiry", token: "ied", ben: 17, atk: 9,
    words: [["dried", 7], ["instructions", 5], ["died", 4], ["specified", 2], ["makes", 2], ["married", 2], ["building", 2], ["recipes", 2]] },
  { rule: "Direct drug synthesis inquiry", token: "meth", ben: 10, atk: 14,
    words: [["something", 6], ["methods", 5], ["cooking", 4], ["chemicals", 3], ["processes", 2]] },
  { rule: "Role-play bypass", token: "hack", ben: 1, atk: 8,
    words: [["bypassing", 5], ["hacker", 1], ["hacking", 1], ["hackerman", 1], ["hacked", 1]] },
  { rule: "Doxxing or targeted harassment", token: "dox", ben: 4, atk: 5,
    words: [["unorthodox", 3], ["paradoxical", 2], ["orthodox", 2], ["pseudodoxia", 2]] },
  { rule: "Adaptive jailbreak optimizer", token: "iterate", ben: 3, atk: 5,
    words: [["reiterate", 4], ["mutated", 2], ["mutates", 1], ["illiterate", 1]] },
  { rule: "Hinglish instruction override", token: "bypass", ben: 0, atk: 7,
    words: [["bypassing", 4], ["ignored", 3]] },
  { rule: "High-risk tool misuse", token: "create", ben: 1, atk: 5,
    words: [["conversationstyle", 2], ["created", 2]] },
  { rule: "Excessive agency request", token: "create", ben: 1, atk: 5,
    words: [["conversationstyle", 2], ["created", 2]] },
  { rule: "Illicit drug synthesis request", token: "meth", ben: 4, atk: 2,
    words: [["something", 2], ["extracting", 1]] },
  { rule: "Paraphrased drug synthesis request", token: "meth", ben: 0, atk: 5,
    words: [["something", 5]] },
  { rule: "Encoded instruction smuggling", token: "morse", ben: 0, atk: 4,
    words: [["remorse", 3], ["remorseless", 1]] },
];

const need: typeof OBSERVED = [];
const ok: typeof OBSERVED = [];

console.log("rule                                    token      ben  atk   collisions / inflections");
for (const o of OBSERVED) {
  const coll: [string, number][] = [];
  const infl: [string, number][] = [];
  for (const [w, n] of o.words) (classify(o.token, w) === "COLLISION" ? coll : infl).push([w, n]);
  const cN = coll.reduce((s, [, n]) => s + n, 0);
  const iN = infl.reduce((s, [, n]) => s + n, 0);
  (cN > 0 ? need : ok).push(o);
  console.log(
    `${o.rule.slice(0, 38).padEnd(40)}${o.token.padEnd(11)}${String(o.ben).padStart(3)}${String(o.atk).padStart(5)}   ` +
      `${String(cN).padStart(3)} [${coll.map(([w]) => w).slice(0, 4).join(",")}]  /  ` +
      `${String(iN).padStart(3)} [${infl.map(([w]) => w).slice(0, 3).join(",")}]`,
  );
}

console.log(`\nREAL BACKLOG (has true collisions): ${need.length} rules`);
for (const o of need) console.log(`  - ${o.rule}  (${o.ben} benign fires at stake)`);
console.log(`\nALREADY BEHAVING (inflection only, DO NOT bound): ${ok.length} rules`);
for (const o of ok) console.log(`  - ${o.rule}  (bounding would delete ${o.atk} real attack fires)`);

// Guard the discriminator itself against the cases that motivated it.
const CHECKS: [string, string, Verdict][] = [
  ["meth", "something", "COLLISION"],
  ["ied", "dried", "COLLISION"],
  ["dox", "unorthodox", "COLLISION"],
  ["iterate", "reiterate", "COLLISION"],
  ["mode", "model", "COLLISION"],      // prefix, but "l" is not an ending
  ["persona", "personality", "COLLISION"],
  ["morse", "remorse", "COLLISION"],
  ["enable", "enabled", "INFLECTION"],
  ["bypass", "bypassing", "INFLECTION"],
  ["ignore", "ignored", "INFLECTION"],
  ["hack", "hacker", "INFLECTION"],
  ["mode", "modes", "INFLECTION"],
];
let bad = 0;
for (const [t, w, want] of CHECKS) {
  const got = classify(t, w);
  if (got !== want) { bad++; console.log(`SELFCHECK FAIL ${t}/${w}: want ${want}, got ${got}`); }
}
console.log(`\ndiscriminator self-check: ${CHECKS.length - bad}/${CHECKS.length}`);
if (bad) process.exitCode = 1;
void readFileSync;
