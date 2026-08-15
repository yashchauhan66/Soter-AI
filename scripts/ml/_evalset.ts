/**
 * Shared loader for the cross-distribution eval sets, with the poison guard.
 *
 * WHY THIS IS SHARED AND NOT COPY-PASTED
 *   eval-crossdist.ts and diagnose-fpr.ts both read these files. If the guard
 *   lived in both, one copy would eventually be relaxed to "just get a number
 *   out" and the other would keep passing, which is the failure mode the guard
 *   exists to prevent.
 */
import { readFileSync } from "node:fs";

export type Row = { text: string; label: string; source?: string };

export function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

/**
 * Refuse to score a `-v1` eval set.
 *
 * They were built with `inthewild-regular` mapped to SAFE, which it is not:
 * that config means "not flagged as a jailbreak by the paper's own pipeline",
 * and it is scraped from the same forums as the jailbreaks. ~10k attacks carry
 * a SAFE label there, so the FPR it reports is mostly the guard being RIGHT.
 *
 * The filename is the obvious tell but not the reliable one — a file can be
 * copied or renamed. The `source` tag travels with the rows, so check that too.
 * A wrong number here is worse than no number: it is a confident answer about
 * whether we reached parity.
 */
export function loadEvalSet(path: string): Row[] {
  const rows: Row[] = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const reasons: string[] = [];
  if (/-v1\.jsonl$/.test(path)) {
    reasons.push("filename is a -v1 set (built with the bad regular->SAFE mapping)");
  }
  const tainted = rows.filter((r) => (r.source ?? "").includes("inthewild-regular")).length;
  if (tainted) {
    reasons.push(`${tainted} rows tagged external:inthewild-regular, which is an attack corpus`);
  }
  if (!reasons.length) return rows;

  console.error(`\n[FATAL] refusing to measure against ${path}`);
  for (const r of reasons) console.error(`  - ${r}`);
  console.error(`\nRebuild first:`);
  console.error(`  python scripts/ml/fetch-external-corpora.py --limit 6000 \\`);
  console.error(`      --out datasets/external-real-v2.jsonl \\`);
  console.error(`      --dedupe-against datasets/ml-augmented-v6.jsonl`);
  console.error(`  python scripts/ml/build-crossdist-eval.py \\`);
  console.error(`      --external datasets/external-real-v2.jsonl \\`);
  console.error(`      --train datasets/ml-augmented-v6.jsonl \\`);
  console.error(`      --eval-out datasets/crossdist-eval-v2.jsonl \\`);
  console.error(`      --train-out datasets/external-train-v2.jsonl\n`);
  process.exit(2);
}
