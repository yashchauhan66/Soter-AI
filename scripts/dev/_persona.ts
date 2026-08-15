/** Pick the token<->frame window on measured lift, not by guess. */
import { readFileSync } from "node:fs";
type Row = { text: string; label: string };
const rows: Row[] = readFileSync("datasets/external-train-v2.jsonl", "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as Row);
const isB = (l: string) => /^(benign|safe|0|negative)$/i.test(l);
const nb = rows.filter((r) => isB(r.label)).length, na = rows.length - nb;

const T = String.raw`\b(?:AIM|STAN|EvilGPT|BetaGPT)\b`;
const F = String.raw`\b(?:act(?:ing)?\s+as|you\s+are|you'?re|pretend|persona|roleplay|role[\s-]play|simulate|become|mode|jailbr(?:eak|oken)|stands?\s+for|from\s+now\s+on|respond\s+as|reply\s+as|answer\s+as)\b`;
const ANY = String.raw`[\s\S]`;

console.log("win |  ben  atk |   lift | verdict");
for (const w of [0, 40, 60, 80, 120, 160, 240, 400, 99999]) {
  const re = w === 0
    ? new RegExp(T, "i")
    : new RegExp(`${T}${ANY}{0,${w}}${F}|${F}${ANY}{0,${w}}${T}`, "i");
  let b = 0, a = 0;
  for (const r of rows) if (re.test(r.text)) { if (isB(r.label)) b++; else a++; }
  const lift = b === 0 ? Infinity : (a / na) / (b / nb);
  console.log(String(w).padStart(5), String(b).padStart(4), String(a).padStart(4),
    (lift === Infinity ? "   inf" : lift.toFixed(2).padStart(6)),
    "|", lift >= 10 ? "TRUSTED (acts alone)" : "demoted to advisory");
}
