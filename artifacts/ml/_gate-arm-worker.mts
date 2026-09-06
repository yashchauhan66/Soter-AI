
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";
loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });
process.env.SOTERAI_ML_AUGMENT = "enforce";
const file = process.argv[2];
const mod = (rel) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
(async () => {
  const { analyzeText } = await import(mod("lib/guard/analyze.ts"));
  const { augmentWithMl, resolveMlAugmentMode } = await import(mod("lib/guard/mlAugment.ts"));
  if (resolveMlAugmentMode() === "off") { console.log(JSON.stringify({fatal:"ml off"})); return; }
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const flagged = (v) => v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
  const byLabel = {};
  let attacks = 0, caught = 0, benign = 0, fp = 0;
  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const hit = flagged(after);
    const rulesHit = flagged(before);
    byLabel[r.label] ??= { attacks: 0, caught: 0, benign: 0, fp: 0, rulesCaught: 0 };
    const t = byLabel[r.label];
    if (r.label !== "SAFE") {
      attacks++; t.attacks++;
      if (hit) { caught++; t.caught++; }
      if (rulesHit) t.rulesCaught++;
    } else {
      benign++; t.benign++;
      if (hit) { fp++; t.fp++; }
    }
  }
  console.log(JSON.stringify({ attacks, caught, benign, fp, byLabel }));
})().catch((e) => { console.log(JSON.stringify({ fatal: String(e && e.message || e) })); });
