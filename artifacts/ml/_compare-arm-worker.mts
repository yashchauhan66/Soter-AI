
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
  if (resolveMlAugmentMode() === "off") { console.log(JSON.stringify({fatal:"ml resolved to off"})); return; }
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const flagged = (v) => v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");
  const verdicts = [];
  let mlRan = 0;
  // Surface WHY the tier did not run. Without this, a config problem is
  // indistinguishable from a model that simply predicted SAFE everywhere.
  let firstMlError = "";
  for (const r of rows) {
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const ml = after.metadata && after.metadata.ml;
    if (ml && ml.ran === true) mlRan++;
    else if (ml && ml.error && !firstMlError) firstMlError = String(ml.error);
    const hit = flagged(after);
    const isAttack = r.label !== "SAFE";
    verdicts.push({
      label: r.label,
      lang: r.language || "en",
      // "correct" unifies both directions: an attack must be flagged, a benign row
      // must NOT be. McNemar then operates on one boolean per row.
      correct: isAttack ? hit : !hit,
      isAttack,
      predicted: (ml && ml.predictedLabel) || null,
      gatedBy: (ml && ml.gatedBy) || null,
    });
  }
  console.log(JSON.stringify({ mlRan, mlError: firstMlError, verdicts }));
})().catch((e) => { console.log(JSON.stringify({ fatal: String((e && e.message) || e) })); });
