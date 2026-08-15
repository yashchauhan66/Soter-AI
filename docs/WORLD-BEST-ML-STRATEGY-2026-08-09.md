# How SoterAI's ML becomes genuinely "world best" — the real path (2026-08-09)

**Honesty first:** no team on Earth — not Lakera, not Palo Alto, not OpenAI — can
*guarantee* "the world's strongest model forever." What CAN be achieved is a
**defensible, witnessed #1**: (a) you beat every competitor on a public benchmark
with an independent witness, (b) your metrics are reproducible while theirs are
marketing claims, and (c) you solve attack classes no competitor solves at all.
That is the only *real* version of "world best." This doc is the engineering path
to it, grounded in files that exist in this repo today.

---

## T0 — The single highest-value move: WITNESSED PUBLIC BENCHMARK

Today every vendor's claim is self-measured (ours too: v7's 98.45% acc / 99.33%
attack recall is on our own group-aware corpus). Lakera's ">98%" is equally
unwitnessed. **The first vendor with an independently witnessed head-to-head
benchmark owns the word "best".**

Assets already in repo:
- `benchmarks/soterai-public-benchmark/` (Dockerfile + `run.mjs` + README)
- `scripts/witness/witnessed-benchmark.mjs`, `docs/security/witness-protocol.md`
- Frozen eval: `datasets/crossdist-eval-v3.jsonl` (22,681 leak-checked group keys)

Actions:
1. Put `ml-augmented-v8-lakera.jsonl`-trained model behind the public benchmark.
2. Run SAME corpus through: SoterAI, live Lakera API key, Meta PromptGuard-2,
   ProtectAI v2. Publish all four result sets with SHA256-pinned inputs/outputs.
3. Get one external party (any security researcher / SOC2 auditor already in
   `docs/soc2/`) to execute `witnessed-benchmark.mjs` on their own machine.
4. Publish the witnessed artifact → convert `docs/SOTERAI-vs-LAKERA-*` from
   "ours-verified vs theirs-marketed" into "both measured, ours witnessed."

**Until this ships, "world best" is unclaimable by anyone. After it ships, whoever
wins it IS best by definition. This is the whole game — do it first.**

## T1 — Real-attack data flywheel (why Lakera is actually strong)

Lakera's moat is not the model; it is **Gandalf** — a public game that has fed them
millions of real human attack attempts for years. Models trained only on synthetic
+ academic corpora plateau; real attacker creativity is the differentiator.

SoterAI equivalents to build (gap is mostly wiring, not research):
- Public honeypot: `app/playground/` + `app/demo-chatbot/` already exist. Add an
  "attack us" mode: every attack attempt is logged (with consent), labelled by
  the current model + rules, and queued for human spot-review.
- Opt-in extension telemetry: `packages/vscode-extension` + broker already see
  real traffic. Add a consent-flagged FN/FP report channel →
  `lib/threatintel/index.ts` → `datasets/threatintel-live.jsonl`.
- Both feed `scripts/ml/v8_lakera_parity_loop.py` (hooks already exist for
  `--seed-threats`).

Result: every month the corpus grows with attacks competitors have never seen.
This is how "best" is *kept*, not just reached.

## T2 — Adversarial self-play (automated red team vs your own model)

The strongest known method for pushing the two weakest classes
(JAILBREAK F1 0.969, PROMPT_INJECTION F1 0.972 — see
`docs/SOTERAI-vs-LAKERA-ML-MODEL-V7-2026-08-08.md` §1):

Loop (all pieces already in repo):
1. `scripts/ml/generate-adversarial-dataset.ts` — attacker generates novel attacks.
2. `scripts/ml/real-black-box-v7-test.cjs` — run them against current model.
3. Every BYPASS (= missed attack) becomes a labelled training row.
4. `scripts/ml/triage-crossdist-misses.ts` — cluster misses by family.
5. Rebuild corpus (`v8_self_improve_loop.py`) → retrain → re-attack.

Run weekly in CI. Target gate: **JAILBREAK + PROMPT_INJECTION F1 ≥ 0.99 on the
frozen eval, and ≥ 0.95 on attacks generated AFTER the training freeze** (the
second number is the one that prevents overfitting to your own generators).

## T3 — Model capacity: cascade, not one model

v7 = MiniLM-L6 (fast, 3.1ms p95, in-process). `soterai_training_pipeline.py`
already supports `--base-model microsoft/deberta-v3-base`. The real-world-best
architecture is a **cascade**:

- Tier 0: rules/regex (`packages/detectors/`) — free, instant.
- Tier 1: MiniLM ONNX (current v7) — 3ms, catches ~98.5%.
- Tier 2: DeBERTa-v3 fine-tune (train from `ml-augmented-v8-lakera.jsonl`,
  `--epochs 6`) — ~25ms, only for Tier-1 low-confidence or attack-suspect traffic.
  Deploy server-side or in the local broker (`apps/local-ai-broker/`).

Cascade ≈ +1.0–1.5 F1 on hard classes at near-zero latency cost, because Tier-2
only sees ~2–5% of traffic. This is the same pattern every major vendor uses;
nobody ships one small model and calls it best.

## T4 — Be the ONLY vendor, not just #1 of N (from your own roadmap)

`docs/SOTERAI-U1-U6-R1-R10-ROADMAP-2026-08-02.md` already proves: no tracked
competitor (Lakera/PANW/Cisco/HiddenLayer) ships:
- **U1** memory-poisoning write-gate + rollback (P0 in your repo)
- **U3** browser-DOM → tool-call injection adapter (P0)
- **U4** agent payment mandate-verify + escrow (P1)

A model that is #2 on text classification but the ONLY defence for the three 2026
headline attack classes is, in every buyer conversation, **#1 overall**. These are
already P0/P1 — ML roadmap and product roadmap converge here.

## T5 — Multilingual depth on the MODEL, not just the union

Verified today: 79-language union recall via detectors; ONNX model alone is
English-calibrated. Lakera claims "100+" (unwitnessed). To beat them durably:
- Extend `scripts/eval/eval-100lang.ts` slices into the training corpus:
  machine-translate the frozen TRAIN partition (never eval) into top-30 languages,
  keep group keys to preserve leakage guarantees.
- Gate: Hindi/Hinglish/transliteration slices (already flagged weak in
  `colab-train-bundle/package-manifest.json` blockers) ≥ 0.95 recall.

## T6 — Credibility stack (turns numbers into belief)

- SOC2 pack (`docs/soc2/`) — done, keep current.
- EU AI Act Annex-IV evidence template (`scripts/compliance/eu-ai-act-pack.mjs`) — R2 deadline.
- Signed artifacts (`scripts/ml/sign-model-artifact.ts`) — already exists; wire into every release.
- Public model card (`docs/SOTERLLM-MODEL-CARD.md`) — update per version with the
  witnessed benchmark numbers from T0.

---

## 4-week execution plan (solo-feasible)

| Week | Ship | Command / path |
|---|---|---|
| 1 | DeBERTa-v3 Tier-2 model trained on `ml-augmented-v8-lakera.jsonl` (Colab GPU, ~4-6h) | `python scripts/ml/soterai_training_pipeline.py --dataset datasets/ml-augmented-v8-lakera.jsonl --epochs 6 --base-model microsoft/deberta-v3-base` |
| 2 | Adversarial self-play loop v1 (T2) wired into CI | generate → black-box-test → triage → rebuild |
| 3 | Witnessed public benchmark vs Lakera + PromptGuard-2 on same corpus (T0) | `node benchmarks/soterai-public-benchmark/run.mjs` + `scripts/witness/witnessed-benchmark.mjs` |
| 4 | Playground honeypot live (T1) + U1 memory-write gate (T4) | `app/playground/` + `lib/guard` memory gate |

## Definition of done ("real mein best")

1. Witnessed benchmark: SoterAI ≥ all competitors on same frozen corpus, externally re-runnable.
2. Fresh-attack recall ≥ 0.95 on attacks generated after training freeze (anti-overfit proof).
3. Cascade live: Tier-1 3ms + Tier-2 hard-class arbitration.
4. Only-vendor coverage on U1/U3/U4.
5. Monthly flywheel: threatintel → corpus → retrain → re-witness.

When 1–5 are true, the claim "strongest AI-agent security model, independently
verified" is honest, current, and defensible — which is more than any competitor,
including Lakera, can say today.
