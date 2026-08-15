/**
 * Sweep every rule for the defect class found in "Agent escalation or RCE attempt":
 * a short literal written WITHOUT word boundaries, which then matches inside
 * ordinary words.
 *
 * `rce` matched inside "source", "force", "resource"; `rag` inside "storage",
 * "average", "paragraph". Between them they produced 13 benign and 39 attack
 * fires — and the attack fires were spurious too, which is the dangerous half:
 * a rule with a healthy-looking attack fire rate that is not detecting anything.
 * Precision measurement cannot find these, because lift 7.5 looks merely mediocre
 * rather than broken.
 *
 * Rather than parse 349 regexes to find unbounded literals, this detects the
 * SIGNATURE empirically: a finding whose matched span begins or ends in the middle
 * of a word. That catches the whole class regardless of how the rule is written,
 * and reports the real English words each rule is colliding with.
 *
 * Reported on BENIGN rows: a mid-word match there is a false accusation with no
 * upside. (The same rules produce mid-word matches on attack rows, but those are
 * fake credit rather than fake blame, and are counted separately.)
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);

const W = /\w/;
type Hit = { benign: number; attack: number; words: Map<string, number> };
const hits = new Map<string, Hit>();

let scanned = 0;
for (const r of rows) {
  scanned++;
  let res;
  try { res = analyzeText(r.text); } catch { continue; }
  for (const fnd of res.findings ?? []) {
    // Offsets are only meaningful for raw-variant findings; normalized variants
    // report the whole span by design, so they cannot be checked this way.
    if (fnd.start === undefined || fnd.end === undefined) continue;
    if (fnd.end - fnd.start <= 0 || fnd.end > r.text.length) continue;
    if (fnd.start === 0 && fnd.end === r.text.length) continue;

    const before = fnd.start > 0 ? r.text[fnd.start - 1] : "";
    const after = fnd.end < r.text.length ? r.text[fnd.end] : "";
    const first = r.text[fnd.start], last = r.text[fnd.end - 1];
    const headMid = W.test(before) && W.test(first);
    const tailMid = W.test(after) && W.test(last);
    if (!headMid && !tailMid) continue;

    let h = hits.get(fnd.label);
    if (!h) { h = { benign: 0, attack: 0, words: new Map() }; hits.set(fnd.label, h); }
    if (isB(r.label)) h.benign++; else h.attack++;

    // The whole word the match landed inside, so the collision is legible.
    if (headMid) {
      let s = fnd.start; while (s > 0 && W.test(r.text[s - 1])) s--;
      let e = fnd.start; while (e < r.text.length && W.test(r.text[e])) e++;
      const w = r.text.slice(s, e).toLowerCase();
      if (w.length < 40) h.words.set(w, (h.words.get(w) ?? 0) + 1);
    }
    if (tailMid) {
      let s = fnd.end - 1; while (s > 0 && W.test(r.text[s - 1])) s--;
      let e = fnd.end; while (e < r.text.length && W.test(r.text[e])) e++;
      const w = r.text.slice(s, e).toLowerCase();
      if (w.length < 40) h.words.set(w, (h.words.get(w) ?? 0) + 1);
    }
  }
  if (scanned % 2000 === 0) process.stderr.write(`  ${scanned}/${rows.length}\r`);
}

const ranked = [...hits.entries()].sort((a, b) => (b[1].benign + b[1].attack) - (a[1].benign + a[1].attack));
console.log(`scanned ${scanned} rows; ${ranked.length} rules produced a mid-word match\n`);
console.log(" benign  attack  rule  <- English words it collided with");
for (const [label, h] of ranked) {
  const words = [...h.words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([w, n]) => `${w}(${n})`).join(" ");
  console.log(`${String(h.benign).padStart(7)} ${String(h.attack).padStart(7)}  ${label}\n           <- ${words}`);
}
