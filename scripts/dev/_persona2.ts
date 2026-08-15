/**
 * Per-token: does binding a persona name to an instruction frame help or cost?
 *
 * Each token is decided on its own numbers. "DAN" and "AIM" are not the same
 * problem just because both are jailbreak personas — one is a rare token that
 * discriminates on its own, the other is an ordinary English word.
 */
import { readFileSync } from "node:fs";

type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length;
const na = rows.length - nb;

const B = String.raw`\b`;
const W = String.raw`[\s\S]{0,120}`;
const F = String.raw`(?:act(?:ing)?\s+as|you\s+are|you'?re|pretend|persona|roleplay|role[\s-]play|simulate|become|mode|jailbr(?:eak|oken)|stands?\s+for|from\s+now\s+on|respond\s+as|reply\s+as|answer\s+as|enable|activate|enter)`;

function score(re: RegExp) {
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  const lift = b === 0 ? Infinity : (a / na) / (b / nb);
  return { b, a, lift };
}

const fmt = (x: { b: number; a: number; lift: number }) =>
  `${String(x.b).padStart(3)} ${String(x.a).padStart(4)} ${(x.lift === Infinity ? "inf" : x.lift.toFixed(1)).padStart(6)}`;

console.log("token         |  bare: ben  atk   lift  ->  framed: ben  atk   lift  | verdict");
for (const tok of ["DAN", "AIM", "STAN", "EvilGPT", "BetaGPT", "Uncensored AI", "Dev Mode On"]) {
  const t = tok.replace(/ /g, String.raw`\s+`);
  const bare = score(new RegExp(B + t + B, "i"));
  const fr = score(new RegExp(`${B}${t}${B}${W}${B}${F}${B}|${B}${F}${B}${W}${B}${t}${B}`, "i"));

  const bareOk = bare.lift >= 10;
  const frOk = fr.lift >= 10;
  let verdict: string;
  if (bare.a === 0 && fr.a === 0) verdict = "never fires here — no evidence either way";
  else if (bareOk && bare.a > fr.a) verdict = `KEEP BARE — frame would cost ${bare.a - fr.a} attacks`;
  else if (!bareOk && frOk) verdict = `FRAME IT — acting detections 0 -> ${fr.a}`;
  else if (bareOk) verdict = "bare already acts alone";
  else verdict = "still demoted even framed";
  console.log(`${tok.padEnd(13)} | ${fmt(bare)}  ->  ${fmt(fr)}  | ${verdict}`);
}
