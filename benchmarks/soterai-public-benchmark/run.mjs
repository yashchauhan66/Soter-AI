// Neutral same-corpus benchmark runner.
//
// Any vendor (or third party) implements ONE function `detect(text)` and points
// --adapter at it. The harness feeds the frozen corpus to every adapter the same
// way and reports: recall per category, recall per language, FP rate, p50/p95
// latency, and a SHA-256 hash of the corpus it actually read.
//
// Two things this file is careful about, because a vendor-run benchmark is worth
// nothing without them:
//
//   1. It reads the corpus from `attacks/` and `benign/` — the directories that
//      exist. The previous version read a `corpus/` directory with `attack-*`
//      prefixes that is not in the repository, so `node run.mjs` threw ENOENT and
//      no number in this folder can have been produced by it. Anything claiming
//      to be output of this harness before this commit is unverified.
//   2. It ships `adapters/always-allow.mjs` and `adapters/flag-everything.mjs`
//      as bounds. If always-allow does not score 0% recall, or flag-everything
//      does not score 100% recall and 100% FP, the harness is miscounting and
//      every other number it prints is void. `--self-test` checks exactly that.
//
// Usage:
//   node run.mjs                                    # default adapter, JSON to stdout
//   node run.mjs --adapter ./adapters/always-allow.mjs
//   node run.mjs --witness "Jane Doe, ACME Security"
//   node run.mjs --self-test                        # verify the harness itself
//   node run.mjs --out ../results/latest.json
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
    return acc;
  }, []),
);

const attackDir = join(here, "attacks");
const benignDir = join(here, "benign");

function loadJsonl(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

function pct(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/**
 * Loads the corpus in a fixed order.
 *
 * Sorted by filename, then rows in file order, so the corpus hash is a function
 * of content alone. Directory iteration order is not guaranteed across
 * filesystems, and a hash that varies by machine cannot prove two people ran the
 * same corpus.
 */
function loadCorpus() {
  const attackFiles = readdirSync(attackDir).filter((f) => f.endsWith(".jsonl")).sort();
  const benignFiles = readdirSync(benignDir).filter((f) => f.endsWith(".jsonl")).sort();
  if (!attackFiles.length) throw new Error(`No .jsonl files in ${attackDir}`);
  if (!benignFiles.length) throw new Error(`No .jsonl files in ${benignDir}`);
  return {
    attacks: attackFiles.map((file) => ({ category: file.replace(/\.jsonl$/, ""), rows: loadJsonl(join(attackDir, file)) })),
    benign: benignFiles.map((file) => ({ category: file.replace(/\.jsonl$/, ""), rows: loadJsonl(join(benignDir, file)) })),
  };
}

/** Per-language tallies, kept separately from the per-category ones. */
function tally(map, key, hit) {
  if (!key) return;
  const entry = map.get(key) ?? { cases: 0, hits: 0 };
  entry.cases += 1;
  if (hit) entry.hits += 1;
  map.set(key, entry);
}

function languageRows(map, hitField, rateField) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([language, entry]) => ({
      language,
      cases: entry.cases,
      [hitField]: entry.hits,
      [rateField]: +((entry.hits / entry.cases) * 100).toFixed(3),
    }));
}

/** The single place a verdict is read, so attacks and benign use one rule. */
function isFlagged(result) {
  return !!(result && (result.flagged || result.block || result.riskType));
}

async function runAdapter(adapterPath, corpus) {
  // Named `adapterModule`, not `module`: assigning to the bare identifier
  // `module` shadows the CommonJS binding and trips
  // @next/next/no-assign-module-variable, which the linter treats as an error.
  const adapterModule = await import(new URL(adapterPath, `file://${here.replace(/\\/g, "/")}/`).href);
  if (typeof adapterModule.detect !== "function") {
    throw new Error(`${adapterPath} does not export a detect(text) function.`);
  }
  const { detect, adapterInfo } = adapterModule;

  const hash = createHash("sha256");
  const latencies = [];
  const attackLanguages = new Map();
  const benignLanguages = new Map();
  const attackCategories = [];
  const benignCategories = [];

  let attackCases = 0;
  let attackDetected = 0;
  let benignCases = 0;
  let falsePositives = 0;

  for (const group of corpus.attacks) {
    let detected = 0;
    for (const row of group.rows) {
      hash.update(row.text);
      const started = performance.now();
      const flagged = isFlagged(await detect(row.text));
      latencies.push(performance.now() - started);
      if (flagged) {
        detected += 1;
        attackDetected += 1;
      }
      attackCases += 1;
      tally(attackLanguages, row.language, flagged);
    }
    attackCategories.push({
      category: group.category,
      cases: group.rows.length,
      detected,
      recallPct: +((detected / group.rows.length) * 100).toFixed(2),
    });
  }

  for (const group of corpus.benign) {
    let fired = 0;
    for (const row of group.rows) {
      hash.update(row.text);
      const started = performance.now();
      const flagged = isFlagged(await detect(row.text));
      latencies.push(performance.now() - started);
      if (flagged) {
        fired += 1;
        falsePositives += 1;
      }
      benignCases += 1;
      tally(benignLanguages, row.language, flagged);
    }
    benignCategories.push({
      category: group.category,
      cases: group.rows.length,
      falsePositives: fired,
      fpRatePct: +((fired / group.rows.length) * 100).toFixed(3),
    });
  }

  // Precision and F1 are reported because recall alone is the number a vendor can
  // always make look good: the bundled flag-everything control scores 100%.
  const precision = attackDetected + falsePositives > 0 ? attackDetected / (attackDetected + falsePositives) : 0;
  const recall = attackCases > 0 ? attackDetected / attackCases : 0;

  return {
    adapter: adapterPath,
    adapterInfo: adapterInfo ?? null,
    corpusHash: hash.digest("hex"),
    attackCategories,
    benignCategories,
    perLanguage: {
      attacks: languageRows(attackLanguages, "detected", "recallPct"),
      benign: languageRows(benignLanguages, "falsePositives", "fpRatePct"),
    },
    totals: {
      attackCases,
      attackDetected,
      recallPct: +(recall * 100).toFixed(2),
      benignCases,
      falsePositives,
      fpRatePct: +((falsePositives / benignCases) * 100).toFixed(3),
      precisionPct: +(precision * 100).toFixed(2),
      f1Pct: precision + recall > 0 ? +(((2 * precision * recall) / (precision + recall)) * 100).toFixed(2) : 0,
      latencyMs: { p50: +pct(latencies, 50).toFixed(3), p95: +pct(latencies, 95).toFixed(3) },
    },
  };
}

const corpus = loadCorpus();

// --self-test proves the harness before anyone reads a product number out of it.
if (args["self-test"]) {
  const low = await runAdapter("./adapters/always-allow.mjs", corpus);
  const high = await runAdapter("./adapters/flag-everything.mjs", corpus);
  const checks = [
    ["always-allow recall is 0%", low.totals.recallPct === 0],
    ["always-allow FP rate is 0%", low.totals.fpRatePct === 0],
    ["flag-everything recall is 100%", high.totals.recallPct === 100],
    ["flag-everything FP rate is 100%", high.totals.fpRatePct === 100],
    ["both controls read the same corpus", low.corpusHash === high.corpusHash],
    ["corpus is non-empty", low.totals.attackCases > 0 && low.totals.benignCases > 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [label, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  console.log(
    JSON.stringify(
      {
        selfTest: failed.length === 0,
        corpusHash: low.corpusHash,
        attackCases: low.totals.attackCases,
        benignCases: low.totals.benignCases,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

const adapterPath = typeof args.adapter === "string" ? args.adapter : "./adapters/soterai-n8n-local.mjs";
const measured = await runAdapter(adapterPath, corpus);

const report = {
  benchmark: "soterai-public-benchmark",
  version: "2.0.0",
  runnerNote:
    "Self-authored synthetic corpus, run by the vendor unless --witness names someone else. Not independent validation. Read recallPct next to fpRatePct — the bundled flag-everything control scores 100% recall.",
  witness: typeof args.witness === "string" ? args.witness : null,
  environment: { node: process.version, platform: `${process.platform} ${process.arch}` },
  startedAt: new Date().toISOString(),
  ...measured,
  finishedAt: new Date().toISOString(),
};

const json = JSON.stringify(report, null, 2);
if (typeof args.out === "string") {
  const outPath = join(here, args.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${json}\n`, "utf8");
  console.error(`Wrote ${outPath}`);
}
console.log(json);
