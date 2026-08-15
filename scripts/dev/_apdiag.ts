/**
 * Which of A/B/C/D fails on each missed academic-pretext row?
 *
 * Reads the regex literals straight out of the detector source rather than
 * re-declaring them, so this diagnostic cannot drift from what actually runs.
 */
import { readFileSync } from "node:fs";
import { normalizeForDetection } from "../../lib/guard/detectors/helpers";

const src = readFileSync("lib/guard/detectors/academicPretextDetector.ts", "utf8");

function pull(name: string): RegExp {
  // const NAME =\n?  /.../i;   — take everything between the first / and /i;
  const at = src.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`no const ${name}`);
  const open = src.indexOf("/", at + `const ${name} =`.length);
  const close = src.indexOf("/i;", open + 1);
  if (open < 0 || close < 0) throw new Error(`unterminated literal for ${name}`);
  return new RegExp(src.slice(open + 1, close), "i");
}

const A = pull("PRETEXT");
const B = pull("SPECIFICITY");
const C1 = pull("HARM_EXPLICIT");
const HAZ = pull("HAZARDOUS_DOMAIN");
const OPN = pull("OPERATIONAL_NOUN");
const D = pull("SAFETY_PREEMPTION");
const WEAK = pull("WEAK_PRETEXT_ONLY");
const ANCHOR = pull("PRETEXT_ANCHOR");

type Row = { id: string; label: string; text: string };
const rows: Row[] = readFileSync("datasets/academic-pretext-heldout.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const target = only.length ? rows.filter((r) => only.includes(r.id)) : rows;

for (const r of target) {
  const scan = normalizeForDetection(r.text);
  const am = A.exec(scan);
  const aWord = am ? am[0] : null;
  const aOk = !!am && (!WEAK.test(aWord!) || ANCHOR.test(scan));
  const bOk = B.test(scan);
  const haz = HAZ.exec(scan);
  const opn = OPN.exec(scan);
  const c1 = C1.exec(scan);
  const cOk = !!c1 || (!!haz && !!opn);
  const dOk = D.test(scan);
  const fires = aOk && bOk && (cOk || dOk);

  const flag = (ok: boolean) => (ok ? "Y" : "-");
  console.log(
    `${r.id} ${r.label.padEnd(6)} A${flag(aOk)} B${flag(bOk)} C${flag(cOk)} D${flag(dOk)} => ${fires ? "FIRE" : "silent"}`
  );
  console.log(`   ${r.text.slice(0, 150)}`);
  console.log(
    `   A=${aWord ?? "none"}  C1=${c1 ? c1[0] : "none"}  haz=${haz ? haz[0] : "none"}  opn=${opn ? opn[0] : "none"}`
  );
}
