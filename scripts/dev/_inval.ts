/**
 * The instruction-invalidation rule is a closed verb list.
 *
 *   /(?:previous|prior|original) (?:instructions?|rules?|...) (?:no longer apply|are void|...)/
 *
 * Row 450 says "all previous instructions do not apply" and is missed — the
 * concept is identical, the wording is not on the list. The concerning part is
 * that the row was still BLOCKED, by "Direct drug synthesis inquiry" matching
 * `meth` inside "something". Remove the substring bug and the gap is exposed.
 *
 * Two things to measure, on the corpus, before touching the rule:
 *   1. Does allowing an optional quantifier + a wider verb set catch row 450?
 *   2. What does that cost in benign fires? "no longer apply" is rare in ordinary
 *      prose, but "do not apply" appears in instructions, forms, and legal text
 *      ("these terms do not apply"), so it must be bound to the injection subject.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length;
const na = rows.length - nb;

const NOUN = String.raw`(?:instructions?|rules?|guidelines?|directives?|constraints?|configuration|messages?|prompts?)`;
const SUBJ = String.raw`(?:previous|prior|original|earlier|above|preceding|system|initial|former)`;

const CANDIDATES: [string, string][] = [
  ["current (closed verb list)",
    String.raw`${SUBJ}\s+${NOUN}\s+(?:no longer apply|are void|were a test|have been reset|are now void)`],
  ["+ quantifier, + negated-apply",
    String.raw`${SUBJ}\s+${NOUN}\s+(?:no longer apply|do(?:es)?\s+not\s+apply|don'?t\s+apply|are void|are no longer valid|were a test|have been reset|are now void|are cancell?ed|are revoked|are superseded|are overridden|are obsolete|no longer count|are irrelevant|are suspended)`],
  ["+ optional quantifier before noun",
    String.raw`(?:all|any)?\s*${SUBJ}\s+${NOUN}\s+(?:no longer apply|do(?:es)?\s+not\s+apply|don'?t\s+apply|are void|are no longer valid|were a test|have been reset|are now void|are cancell?ed|are revoked|are superseded|are overridden|are obsolete|no longer count|are irrelevant|are suspended)`],
  ["reversed order (verb first)",
    String.raw`(?:disregard|void|cancel|revoke|suspend|nullify)\s+(?:all\s+|any\s+)?${SUBJ}\s+${NOUN}`],
];

console.log("variant                              ben  atk     lift   row450   verdict");
const row450 = rows[450].text;
for (const [name, src] of CANDIDATES) {
  const re = new RegExp(src, "i");
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  const lift = b === 0 ? Infinity : (a / na) / (b / nb);
  const hits = re.test(row450);
  const trusted = lift >= 10 || b === 0;
  console.log(
    `${name.padEnd(36)}${String(b).padStart(4)}${String(a).padStart(5)}` +
    `${(lift === Infinity ? "inf" : lift.toFixed(1)).padStart(9)}   ${hits ? "HIT " : "miss"}    ` +
    (trusted ? "acts alone" : "WOULD BE DEMOTED"),
  );
}
