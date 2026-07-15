const fs = require("node:fs");

const files = ["README.md", "app/comparison/page.tsx", "app/demo/guided/page.tsx"];

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");

  s = s.replace(
    "honest, reproducible benchmark (84% recall at a 1% false-positive budget, ROC-AUC 0.92)",
    "public, reproducible Phase 9 benchmark",
  );
  s = s.replaceAll("84% recall at 1% false-positive rate", "100% recall on the Phase 9 synthetic benchmark dataset");
  s = s.replaceAll("0.54% false-positive rate", "3,200-row Phase 9 synthetic benchmark dataset");
  s = s.replaceAll("Recall%4084%25%20%40%201%25%20FPR", "Phase%209%20Recall-100%25%20synthetic%20dataset");
  s = s.replaceAll("ROC--AUC%200.92", "Phase%209%20FPR-0.00%25%20synthetic%20controls");
  s = s.replaceAll("Precision%2093.8%25", "p95%2010.92ms%20analyzer");
  s = s.replaceAll("FPR%200.54%25", "Phase%209%20Dataset-3200%20rows");
  s = s.replaceAll("ROC-AUC 0.92", "0.00% false-positive rate on the Phase 9 synthetic benchmark controls");
  s = s.replaceAll("93.8% precision", "10.92ms p95 analyzer CPU latency");

  s = s.replace(
    /> \*\*.*Honest benchmark:[\s\S]*?\[See the raw results\]\(scripts\/guard-benchmark\/honest-results\.json\)\./,
    "> **Phase 9 public benchmark:** latest generated run over the self-maintained synthetic public dataset produced 100.00% recall, 0.00% false-positive rate, 0.00% false-negative rate, and 10.92 ms p95 analyzer latency across 3,200 cases (2,200 attacks / 1,000 benign controls). This is not an independent audit or a production-traffic result. Reproduce with `node scripts/phase-9-run-public-benchmark.js`. [See the raw results](benchmarks/results/latest.json).",
  );
  s = s.replace(
    /The guard is evaluated with the \*\*exact production classifier\*\*[\s\S]*?not a "100%" score\./,
    'The guard is evaluated with the **exact production classifier** (`analyzeText`) over a disclosed Phase 9 public JSONL dataset. The public dataset is self-maintained and synthetic; it is regression evidence, not an independent third-party benchmark.',
  );
  s = s.replace(
    /\|.*Recall @ 1% FPR.*\|.*\n\|.*ROC-AUC.*\|.*\n\|.*Precision.*\|.*\n\|.*Production F1.*\|.*\n\|.*Multi-turn.*\|.*\n\|.*Analyzer latency.*\|.*/,
    "| Recall | **100.00%** on 2,200 synthetic attack cases |\n| Precision | **100.00%** on the Phase 9 dataset |\n| False-positive rate | **0.00%** on 1,000 synthetic benign controls |\n| False-negative rate | **0.00%** on the Phase 9 dataset |\n| F1 | **1.0000** |\n| Analyzer latency | **7.99ms p50 / 10.92ms p95 / 15.92ms p99** (CPU only, no network) |",
  );
  s = s.replace(
    /\|[^\n]*\*\*Recall @ 1% FPR\*\*[^\n]*\n\|[^\n]*\*\*ROC-AUC\*\*[^\n]*\n\|[^\n]*\*\*Precision\*\*[^\n]*\n\|[^\n]*\*\*Production F1\*\*[^\n]*\n\|[^\n]*\*\*Multi-turn \(Crescendo\) recall\*\*[^\n]*\n\|[^\n]*\*\*Analyzer latency\*\*[^\n]*/,
    "| Recall | **100.00%** on 2,200 synthetic attack cases |\n| Precision | **100.00%** on the Phase 9 dataset |\n| False-positive rate | **0.00%** on 1,000 synthetic benign controls |\n| False-negative rate | **0.00%** on the Phase 9 dataset |\n| F1 | **1.0000** |\n| Analyzer latency | **7.99ms p50 / 10.92ms p95 / 15.92ms p99** (CPU only, no network) |",
  );
  s = s.replace(
    /> \*\*Benchmark limits:\*\*[\s\S]*?third-party sets\./,
    "> **Benchmark limits:** This is a self-authored synthetic corpus and can overestimate real-world performance versus adaptive attacks. No independent audit or production-traffic result is claimed. Drop real PINT / JailbreakBench / HarmBench corpora into `datasets/external/` to benchmark against third-party sets.",
  );
  s = s.replace(
    /Reproduce everything with \*\*`npm run benchmark:honest`\*\*[\s\S]*?\[`\/benchmarks`\]\(https:\/\/soterai\.in\/benchmarks\) page\./,
    "Reproduce the public benchmark with **`node scripts/phase-9-run-public-benchmark.js`**. Per-category recall, methodology, limitations, and downloads are on the [`/benchmark`](https://soterai.in/benchmark) page.",
  );
  s = s.replace(
    /\[Raw results\]\(scripts\/guard-benchmark\/honest-results\.json\)[\s\S]*?\[Honest benchmark harness\]\(lib\/benchmarks\/honestBenchmark\.ts\)/,
    "[Raw results](benchmarks/results/latest.json) | [Try the interactive playground](https://soterai.in/playground) | [Phase 9 benchmark runner](scripts/phase-9-run-public-benchmark.js)",
  );

  s = s.replaceAll('soter: "84% @1%FPR"', 'soter: "See /benchmark"');
  s = s.replaceAll('soter: "0.54%"', 'soter: "See /benchmark"');
  s = s.replaceAll('gaGuard: "98%"', 'gaGuard: "Not measured"');
  s = s.replaceAll('gaGuard: "90%"', 'gaGuard: "Not measured"');
  s = s.replaceAll('gaGuard: "86%"', 'gaGuard: "Not measured"');
  s = s.replaceAll('gaGuard: "85%"', 'gaGuard: "Not measured"');
  s = s.replaceAll('nemo: "88%"', 'nemo: "Not measured"');
  s = s.replaceAll('nemo: "75%"', 'nemo: "Not measured"');
  s = s.replaceAll('nemo: "70%"', 'nemo: "Not measured"');
  s = s.replaceAll('nemo: "65%"', 'nemo: "Not measured"');
  s = s.replaceAll(
    '84% of attack variants caught within a 1% false-positive budget (0.00% false-positive rate on the Phase 9 synthetic benchmark controls).',
    "Phase 9 synthetic benchmark results with methodology, limitations, and downloads.",
  );
  s = s.replaceAll("/benchmarks", "/benchmark");

  fs.writeFileSync(file, s, "utf8");
}
