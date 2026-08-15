/**
 * What is v7 actually trained on? Needed before any v8 dataset decision.
 *
 * A miss is only "reachable by training data" in the useful sense if the shape is
 * UNDER-represented. If the model has already seen 20,000 rows of a label and still
 * misses it cross-distribution, the gap is diversity (paraphrase, obfuscation,
 * register), not volume — and adding another 5,000 same-template rows is a GPU job
 * that changes nothing. That distinction is the whole point of counting `source`
 * alongside `label`: `template:X` rows are generated from a small set of frames, so
 * 10k of them is not 10k of coverage.
 *
 * Streamed line-by-line: the file is 31.7 MB and readFileSync + split holds the whole
 * thing plus an array of every line at once.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { arg } from "./_evalset";

const file = arg("--file", "datasets/ml-augmented-v7.jsonl");

const byLabel = new Map<string, number>();
const bySource = new Map<string, number>();
const bySourceKind = new Map<string, number>();
const byLang = new Map<string, number>();
// Distinct texts per label: the gap between this and the row count is how much of a
// label is duplicate/near-duplicate augmentation rather than distinct coverage.
const distinct = new Map<string, Set<string>>();
let rows = 0;
let malformed = 0;

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

async function main() {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let r: { text?: string; label?: string; source?: string; language?: string };
    try { r = JSON.parse(line); } catch { malformed++; continue; }
    rows++;
    const label = r.label ?? "(none)";
    const source = r.source ?? "(none)";
    bump(byLabel, label);
    bump(bySource, source);
    // `template:PROMPT_INJECTION` and `template:JAILBREAK` are the same KIND of data;
    // the kind is what says how synthetic the corpus is.
    bump(bySourceKind, source.split(":")[0]);
    bump(byLang, r.language ?? "(none)");
    const set = distinct.get(label) ?? new Set<string>();
    // Normalised: case + whitespace differences are augmentation artefacts, not coverage.
    set.add((r.text ?? "").toLowerCase().replace(/\s+/g, " ").trim());
    distinct.set(label, set);
  }

  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
  const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);

  console.log(`${file}: ${rows} rows${malformed ? `, ${malformed} malformed (skipped)` : ""}\n`);

  console.log("BY LABEL  (distinct = unique normalised texts; the gap is duplicate augmentation)");
  console.log("   rows   distinct   dup%   label");
  for (const [label, n] of sorted(byLabel)) {
    const d = distinct.get(label)?.size ?? 0;
    console.log(
      `${String(n).padStart(7)}${String(d).padStart(11)}${pct(n - d, n).padStart(7)}   ${label}`,
    );
  }

  console.log("\nBY SOURCE KIND  (template: = generated from frames, not observed traffic)");
  for (const [k, n] of sorted(bySourceKind)) {
    console.log(`${String(n).padStart(7)}  ${pct(n, rows).padStart(5)}%  ${k}`);
  }

  console.log("\nBY LANGUAGE");
  for (const [k, n] of sorted(byLang)) console.log(`${String(n).padStart(7)}  ${pct(n, rows).padStart(5)}%  ${k}`);

  console.log("\nTOP 25 SOURCES");
  for (const [k, n] of sorted(bySource).slice(0, 25)) console.log(`${String(n).padStart(7)}  ${k}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
