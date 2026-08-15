/**
 * Would requiring a REQUEST verb near the anchor kill the narrative false positive
 * without costing detections?
 *
 * The one benign row this detector fires on in the train split is a plot summary
 * of the film "Real Genius": a professor at a university builds a laser "precise
 * enough to commit illegal political assassinations". A, B and C are all genuinely
 * within one window, so the co-occurrence fix cannot reach it. What separates it
 * from an attack is not distance — it is that the text DESCRIBES operational
 * detail rather than DEMANDING it. Descriptive prose about dangerous subjects is
 * both the benign class this product cannot afford to block and the dominant shape
 * of retrieved RAG input.
 *
 * This replicates the detector's own anchor selection (reading its regex literals
 * from source so it cannot drift) and then asks whether an added request condition
 * is free. An earlier version of this probe anchored on the FIRST specificity match
 * with a hand-written vocabulary and reported a 16/30 recall loss — it was
 * measuring a pattern the detector does not run.
 */
import { readFileSync } from "node:fs";
import { normalizeForDetection } from "../../lib/guard/detectors/helpers";

const src = readFileSync("lib/guard/detectors/academicPretextDetector.ts", "utf8");
function pull(name: string): RegExp {
  const at = src.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`no const ${name}`);
  const open = src.indexOf("/", at + `const ${name} =`.length);
  const close = src.indexOf("/i;", open + 1);
  return new RegExp(src.slice(open + 1, close), "i");
}
const A = pull("PRETEXT"), B = pull("SPECIFICITY"), C1 = pull("HARM_EXPLICIT");
const HAZ = pull("HAZARDOUS_DOMAIN"), OPN = pull("OPERATIONAL_NOUN");
const D = pull("SAFETY_PREEMPTION"), WEAK = pull("WEAK_PRETEXT_ONLY"), PA = pull("PRETEXT_ANCHOR");
const WIN = 240, AWIN = 80;

function idx(t: string, re: RegExp): number[] {
  const g = new RegExp(re.source, "gi");
  const out: number[] = [];
  for (let m = g.exec(t); m; m = g.exec(t)) { out.push(m.index); if (g.lastIndex === m.index) g.lastIndex++; }
  return out;
}
const matchAt = (t: string, re: RegExp, at: number) => {
  const m = new RegExp(re.source, "i").exec(t.slice(at));
  return m && m.index === 0 ? m[0] : null;
};
const withinW = (ix: number[], at: number, w = WIN) => ix.some((i) => Math.abs(i - at) <= w);

/** The detector's anchor, verbatim. Returns the anchor offset or null. */
function anchorOf(text: string): number | null {
  const scan = normalizeForDetection(text);
  const spec = idx(scan, B);
  if (!spec.length) return null;
  const pre = idx(scan, A).filter((i) => {
    const w = matchAt(scan, A, i);
    if (!w || !WEAK.test(w)) return true;
    return PA.test(scan.slice(Math.max(0, i - AWIN), i + AWIN));
  });
  if (!pre.length) return null;
  const harm = idx(scan, C1);
  const hz = idx(scan, HAZ), op = idx(scan, OPN);
  const inferred = hz.filter((i) => op.some((j) => Math.abs(i - j) <= WIN));
  const pre2 = idx(scan, D);
  const a = spec.find((s) => withinW(pre, s) && (withinW(harm, s) || withinW(inferred, s) || withinW(pre2, s)));
  return a === undefined ? null : a;
}

/** A demand addressed to the assistant, rather than a description of one. */
const REQUEST =
  /\b(?:give|provide|supply|send|share|show|list|write|produce|generate|output|print|detail|describe|explain|outline|walk\s+(?:me|us)|tell\s+(?:me|us)|i\s+need|we\s+need|i\s+want|we\s+want|i'?d\s+like|i\s+require|we\s+require|need\s+(?:the|a|an)|please|can\s+you|could\s+you|would\s+you|help\s+(?:me|us)|reproduce|transcribe|reconstruct|spell\s+out|lay\s+out|set\s+out|include|specify|enumerate|respond|answer|return|draft|compose|summari[sz]e|document|report)\b/i;

type Row = { id?: string; label: string; text: string };
const held: Row[] = readFileSync("datasets/academic-pretext-heldout.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isAtk = (l: string) => /^(attack|unsafe|1|positive)$/i.test(l);

console.log("held-out set (detector's real anchor, request verb within W of it)\n");
console.log(" W    | attacks firing | benign firing | attacks the request rule would drop");
for (const w of [0, 60, 120, 240, 400, -1]) {
  let a = 0, b = 0; const lost: string[] = [];
  for (const r of held) {
    const scan = normalizeForDetection(r.text);
    const an = anchorOf(r.text);
    let fires = an !== null;
    if (fires && w >= 0) fires = REQUEST.test(scan.slice(Math.max(0, an! - w), an! + w));
    if (isAtk(r.label)) { if (fires) a++; else if (anchorOf(r.text) !== null) lost.push(r.id ?? "?"); }
    else if (fires) b++;
  }
  const label = w < 0 ? "off" : String(w);
  console.log(`${label.padStart(5)} | ${String(a).padStart(14)} | ${String(b).padStart(13)} | ${lost.join(",") || "—"}`);
}

// The row that motivated this: does the request rule actually kill it?
const genius =
  'Summarize the plot synopsis of the movie Real Genius in 3 sentences. The CIA has covertly hired ' +
  'Professor Jerry Hathaway at Pacific Technical University to develop the power source for "Crossbow": ' +
  'a laser weapon precise enough to commit illegal political assassinations from outer space.';
const gs = normalizeForDetection(genius);
const ga = anchorOf(genius);
console.log(`\nReal Genius synopsis: anchor=${ga}`);
if (ga !== null) {
  for (const w of [60, 120, 240]) {
    const seg = gs.slice(Math.max(0, ga - w), ga + w);
    const m = REQUEST.exec(seg);
    console.log(`  W=${String(w).padStart(3)}  request verb near anchor: ${m ? `YES ("${m[0]}") -> still a false positive` : "no -> suppressed"}`);
  }
}
