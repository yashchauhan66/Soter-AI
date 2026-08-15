/**
 * Refine the mid-word sweep: which collisions are REAL, and what literal causes each?
 *
 * A match ending mid-word is not automatically a bug. "instruction" inside
 * "instructions" is an inflection and entirely intended. "persona" inside
 * "personality" is a different word. Both look identical to a boundary check, so
 * this prints the matched fragment beside the word that swallowed it and separates
 * the two: if the leftover characters are a plain English inflection (-s, -es,
 * -ed, -ing, -d, -ly), the match is fine; anything else is a substring collision.
 *
 * Only collisions are actionable. This is what says which `\b` is missing and
 * where, instead of leaving 42 rules to be inspected by hand.
 */
import { readFileSync } from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const W = /\w/;
const INFLECTION = /^(?:s|es|ed|d|ing|ings|er|ers|ly|'s)$/i;

type Ex = { frag: string; word: string; side: "head" | "tail" };
type Hit = { benign: number; attack: number; ex: Map<string, Ex & { n: number; benign: number }> };
const hits = new Map<string, Hit>();

const wordAround = (t: string, i: number) => {
  let s = i; while (s > 0 && W.test(t[s - 1])) s--;
  let e = i; while (e < t.length && W.test(t[e])) e++;
  return { s, e, w: t.slice(s, e) };
};

let n = 0;
for (const r of rows) {
  if (++n % 2000 === 0) process.stderr.write(`  ${n}/${rows.length}\r`);
  let res; try { res = analyzeText(r.text); } catch { continue; }
  for (const f of res.findings ?? []) {
    if (f.start === undefined || f.end === undefined) continue;
    if (f.end - f.start <= 0 || f.end > r.text.length) continue;
    if (f.start === 0 && f.end === r.text.length) continue;

    for (const side of ["head", "tail"] as const) {
      const at = side === "head" ? f.start : f.end - 1;
      const outside = side === "head" ? f.start - 1 : f.end;
      if (outside < 0 || outside >= r.text.length) continue;
      if (!W.test(r.text[outside]) || !W.test(r.text[at])) continue;

      const { s, e, w } = wordAround(r.text, at);
      if (w.length > 40) continue;
      // The part of the word the rule actually consumed.
      const frag = side === "head" ? r.text.slice(f.start, Math.min(e, f.end)) : r.text.slice(Math.max(s, f.start), f.end);
      const leftover = side === "head" ? r.text.slice(s, f.start) : r.text.slice(f.end, e);
      // A trailing inflection on an otherwise whole word is intended behaviour.
      if (side === "tail" && INFLECTION.test(leftover)) continue;
      if (side === "head" && leftover === "") continue;

      let h = hits.get(f.label);
      if (!h) { h = { benign: 0, attack: 0, ex: new Map() }; hits.set(f.label, h); }
      if (isB(r.label)) h.benign++; else h.attack++;
      const key = `${side}|${frag.toLowerCase()}|${w.toLowerCase()}`;
      const prev = h.ex.get(key);
      if (prev) { prev.n++; if (isB(r.label)) prev.benign++; }
      else h.ex.set(key, { frag, word: w, side, n: 1, benign: isB(r.label) ? 1 : 0 });
    }
  }
}

const ranked = [...hits.entries()].sort((a, b) => b[1].benign - a[1].benign || b[1].attack - a[1].attack);
console.log(`\n${ranked.length} rules have a TRUE substring collision (inflections excluded)\n`);
console.log(" benign  attack  rule");
for (const [label, h] of ranked) {
  console.log(`${String(h.benign).padStart(7)} ${String(h.attack).padStart(7)}  ${label}`);
  const ex = [...h.ex.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  for (const x of ex) console.log(`             "${x.frag}" inside "${x.word}"  x${x.n}${x.benign ? ` (${x.benign} benign)` : ""}`);
}
