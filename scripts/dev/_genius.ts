import { academicPretextDetector } from "../../lib/guard/detectors/academicPretextDetector";
import { readFileSync } from "node:fs";
const rows = readFileSync("datasets/external-train-v2.jsonl", "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as any);
for (const r of rows) if (/Real Genius/.test(r.text)) {
  console.log(r.label, "|", r.text.slice(0, 400).replace(/\s+/g, " "));
  console.log("findings:", JSON.stringify(academicPretextDetector(r.text).map((f) => [f.label, f.score])));
}
