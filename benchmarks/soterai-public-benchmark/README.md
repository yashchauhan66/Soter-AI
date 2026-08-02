# SoterAI Public Benchmark Dataset

This dataset is maintained by SoterAI for public reproducibility of the Phase 9 benchmark.

- Total cases: 3200
- Attack cases: 2200
- Benign controls: 1000
- Source type: synthetic
- Real secrets: none
- Real personal data: none
- Customer data: none

The dataset is not independent third-party evidence. It is a transparent, self-authored regression and measurement corpus.

---

## Witness-friendly reproduction (added 2026-08-02)

Anyone can re-run this benchmark inside Docker and verify the hash:

```bash
docker build -t soterai-bench .
docker run --rm soterai-bench
```

The runner (`run.mjs`) feeds the **same frozen corpus** to any guard through a single `detect(text)` adapter and reports per-category recall, false-positive rate, p50/p95 latency and a SHA-256 `corpusHash`. `--witness "name,org"` tags the report with who ran it. Competitors and researchers are invited to point `--adapter` at their own detector — all adapters get identical inputs.

Result (SoterAI adapter, this repo, 2026-08-02): multilingual subset 150/150 attack recall, 0/300 benign FP (`artifacts/security/multilingual-eval-2026-08-02.json`).
