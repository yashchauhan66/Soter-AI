#!/usr/bin/env bash
# Post-v7 evaluation, in the order the results actually depend on each other.
#
# WHY A SCRIPT AND NOT FOUR MANUAL COMMANDS
#   Step 2 is a REGRESSION GATE. If it fails, the v7 model must not stay wired into
#   .env, and steps 3-4 must not run — publishing a cross-distribution or
#   vs-PG2 number for a model we would roll back is how a bad model gets quoted
#   later. Running these by hand invites reading past a failure.
#
# The env is pointed at v7 for the duration and restored on exit, so a failed gate
# cannot silently leave the new model live.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2

V7_DIR="models/ml-classifier-v7"
ART="artifacts/ml"
mkdir -p "$ART"

if [ ! -f "$V7_DIR/model.onnx" ]; then
  echo "[FATAL] $V7_DIR/model.onnx not found — training has not produced an artifact." >&2
  exit 2
fi

export ML_ONNX_MODEL_PATH="$V7_DIR/model.onnx"
export ML_ONNX_LABELS_PATH="$V7_DIR/labels.json"
export ML_ONNX_CALIBRATION_PATH="$V7_DIR/calibration.json"
echo "[env] ML tier -> $V7_DIR"

echo
echo "════ 0/4  Sign the v7 artifact so the supply-chain gate admits it ════"
# WHY THIS STEP CANNOT BE SKIPPED
#   lib/ml/onnxBackend.ts fails CLOSED on an unsigned model, and mlAugment then
#   fails OPEN — detection silently runs rules-only while SOTERAI_ML_AUGMENT is
#   "enforce". That exact combination shipped once (fixed 2026-08-01) and it does
#   not raise an error; it just quietly measures the wrong thing. Without this,
#   every number below would be the v4-era rules baseline wearing a v7 label.
#   Signing binds the artifact SHA-256, so the freshly trained file needs its own.
npx tsx scripts/ml/sign-model-artifact.ts \
    --model "$V7_DIR/model.onnx" \
    --source local-training \
    --builder-id soterai://local/v7-cpu || {
  echo "[FATAL] could not sign the v7 artifact — the gate would block it and the" >&2
  echo "        ML tier would silently not run. Refusing to measure." >&2
  exit 2
}

# Prove the tier is actually live before trusting a single downstream number.
# --require turns a "degraded" tier (configured but not loading) into exit 1,
# which is precisely the silent-rules-only condition we must not measure through.
npx tsx scripts/ml/check-ml-health.ts --require 2>&1 | tee "$ART/v7-ml-health.txt" || {
  echo "[FATAL] ML tier is degraded — configured but not loading. Every number below" >&2
  echo "        would be rules-only wearing a v7 label. Refusing to measure." >&2
  exit 2
}

echo
echo "════ 1/4  Core-hybrid regression gate (production analyzeText path) ════"
npx tsx scripts/guard-benchmark/run-honest-benchmark.ts 2>&1 | tee "$ART/v7-honest-benchmark.txt"

# Baseline measured 2026-08-07 with the deployed v4 on this same harness.
# Recall 98.15% (106/108), FPR 0.81% (9/1110). See COMPREHENSIVE-ML-TRAINING-PLAN §6.2.
python - "$ART/v7-honest-benchmark.txt" <<'PY'
import re, sys
txt = open(sys.argv[1], encoding="utf-8", errors="replace").read()
def grab(pat):
    # Anchored to line start: an unanchored "FPR:" also matches the
    # "Recall @ 1.00% FPR:  98.15%" headline row and reads RECALL as the FPR.
    # That misparse fails a clean model, and would equally hide a real FPR
    # regression behind a passing recall number.
    m = re.search(pat, txt, re.M)
    return float(m.group(1)) if m else None
recall = grab(r"^\s*Mitigation recall:\s*([\d.]+)%")
fpr    = grab(r"^\s*FPR:\s*([\d.]+)%")
BASE_RECALL, BASE_FPR = 98.15, 0.81
print(f"\n  gate: recall {recall}%  (baseline {BASE_RECALL}%)")
print(f"  gate: FPR    {fpr}%  (baseline {BASE_FPR}%)")
if recall is None or fpr is None:
    print("\n[FATAL] could not parse the benchmark output — refusing to call this a pass.")
    sys.exit(1)
# Tolerance: one attack in this 108-attack corpus is worth 0.93pp, so a strict
# >= would fail on a single flaky row. One attack of slack, no more.
if recall < BASE_RECALL - 0.95:
    print(f"\n[FATAL] CORE HYBRID REGRESSED {BASE_RECALL}% -> {recall}%. This is the v6 failure again.")
    print("        Do NOT wire v7 into .env. Roll back and diagnose before re-measuring.")
    sys.exit(1)
if fpr > BASE_FPR + 0.5:
    print(f"\n[FATAL] FPR REGRESSED {BASE_FPR}% -> {fpr}%. Benign traffic would be blocked.")
    sys.exit(1)
print("\n  [PASS] no core-hybrid regression — safe to report downstream numbers.")
PY
if [ $? -ne 0 ]; then
  echo
  echo "[STOP] Regression gate FAILED. Cross-distribution and PG2 numbers were NOT" >&2
  echo "       measured, because a model that fails this gate will not ship and its" >&2
  echo "       benchmark numbers should not enter the record." >&2
  exit 1
fi

echo
echo "════ 2/4  Cross-distribution recall/FPR (aggregate) ════"
npx tsx scripts/ml/eval-crossdist.ts --file datasets/crossdist-eval-v3.jsonl --limit 4000 \
  2>&1 | tee "$ART/v7-crossdist.txt"

echo
echo "════ 3/4  Cross-distribution BY LABEL + BY LANGUAGE (the honest split) ════"
npx tsx scripts/ml/eval-crossdist-bylabel.ts --file datasets/crossdist-eval-v3.jsonl --limit 4000 \
  2>&1 | tee "$ART/v7-crossdist-bylabel.txt"

echo
echo "════ 4/4  Head-to-head vs Meta Llama-Prompt-Guard-2-86M ════"
if python -c "from huggingface_hub import HfApi; HfApi().whoami()" >/dev/null 2>&1; then
  python scripts/ml/benchmark-vs-lakera.py \
      --eval datasets/crossdist-eval-v3.jsonl \
      --limit 4000 \
      --out "$ART/pg2-vs-soterllm-v7.json" 2>&1 | tee "$ART/v7-vs-pg2.txt"
else
  echo "[SKIP] Not logged in to Hugging Face; PG2 is a gated repo."
  echo "       Run:  huggingface-cli login       then re-run this script."
  echo "       (Accept the Llama 4 Community Licence on the model page first.)"
fi

echo
echo "Artifacts written to $ART/"
echo "NOTE: none of the above is a Lakera Guard measurement. Lakera is closed/API-only;"
echo "      the only honest SoterAI-vs-Lakera number comes from the PINT harness."
