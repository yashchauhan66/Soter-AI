/** Confirm every _rowlevel.ts edit anchor resolves before running the measurement. */
import { readFileSync } from "node:fs";

const B = "lib/guard/detectors/broadHarmfulContentDetector.ts";
const P = "lib/guard/detectors/promptInjectionDetector.ts";
const M = "lib/guard/detectors/modelSupplyChainDetector.ts";

const anchors: [string, string][] = [
  [B, '"black powder|acetone peroxide|pipe bomb|pressure cooker bomb|ied|car bomb|nail bomb|" +'],
  [B, '"(?:methamphetamine|meth|crystal meth|cocaine|crack cocaine|heroin|fentanyl|carfentanil|" +'],
  [B, '"(?:dox|doxx)(?:ing)?'],
  [P, ".{0,140}(?:mode|persona|no restrictions|"],
  [P, "|until it succeeds|iterate|mutate|rewrite the prompt|"],
  [M, "|postinstall|eval|exec)/i,"],
];

let bad = 0;
for (const [file, a] of anchors) {
  const ok = readFileSync(file, "utf8").includes(a);
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "MISS"}  ${file.split("/").pop()}  ${a.slice(0, 62)}`);
}
console.log(bad ? `\n${bad} anchor(s) missing — fix before measuring` : "\nall anchors resolve");
