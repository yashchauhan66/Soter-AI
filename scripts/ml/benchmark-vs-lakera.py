#!/usr/bin/env python3
"""
Head-to-head: SoterLLM vs Meta Llama-Prompt-Guard-2 on OUR frozen eval set.

WHY THIS FILE, AND WHY IT REFUSES TO PRINT A LAKERA NUMBER
  docs/ml/FREE-MODELS-AND-DATA-SURVEY.md puts Meta PG2-86M at 97.5% recall @ 1% FPR
  and SoterAI at 73.2% @ 4.2%, then says the honest thing: those are different
  benchmarks, so the 24-point gap is not a measurement. This script closes that by
  running both models over the SAME rows.

  Lakera Guard cannot be added here. It is closed and API-only — there is nothing
  to download. So the comparison this file can make honestly is:

      SoterLLM  vs  Meta PG2   ON crossdist-eval-v2.jsonl   (real, measured here)
      SoterLLM  vs  Lakera     ON PINT                      (needs the PINT harness,
                                                              scripts/ml/soterai-pint-eval-v2.ts)

  PG2 is the usable stand-in for a state-of-the-art external detector: it is the
  model that beats Lakera's published posture on Meta's own numbers, and unlike
  Lakera it can be measured on our data. Any sentence of the form "we beat Lakera"
  that is not backed by a PINT run is unsupported, and this script will not emit one.

SCOPE CAVEAT THAT MUST SURVIVE INTO ANY WRITE-UP
  PG2 answers exactly one question: "does this text try to override prior
  instructions?" It does NOT judge content harm. So on our 9-label schema it is only
  comparable on PROMPT_INJECTION / JAILBREAK / SYSTEM_PROMPT_LEAK_ATTEMPT. Rows
  labelled UNSAFE_OUTPUT, PII, SECRET are OUT OF PG2'S SCOPE and are excluded from
  the head-to-head rather than counted as PG2 misses — scoring a model on a task its
  card explicitly disclaims would manufacture a flattering result.

LICENCE
  PG2 is gated by the Llama 4 Community Licence: free under 700M MAU, but any
  derived model name must be prefixed "Llama" and "Built with Llama" must be
  displayed. This script only EVALUATES PG2; it does not fine-tune or redistribute
  it, so no naming obligation attaches to SoterLLM from running this.

USAGE
  huggingface-cli login          # PG2 is a gated repo
  python scripts/ml/benchmark-vs-lakera.py \
      --eval datasets/crossdist-eval-v2.jsonl \
      --out artifacts/ml/pg2-vs-soterllm.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# PG2's own scope, per its model card. Anything outside this is not a fair PG2 row.
# The same bound applies to every detector this script can run: they all answer
# "is this an instruction-override attempt?", none of them judge content harm.
PG2_IN_SCOPE_LABELS = {
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "SAFE",
}

PG2_MODEL = "meta-llama/Llama-Prompt-Guard-2-86M"

# Externally-runnable stand-ins, in preference order. PG2 is the headline comparison,
# but it is `gated=manual` — Meta approves access by hand, so it can be unavailable for
# days. ProtectAI's DeBERTa detector is ungated and Apache-2.0, which makes it the
# baseline that can actually be measured today. Both answer the same narrow question,
# so both are scored on the same in-scope rows.
KNOWN_MODELS = {
    "pg2-86m": "meta-llama/Llama-Prompt-Guard-2-86M",
    "pg2-22m": "meta-llama/Llama-Prompt-Guard-2-22M",
    "protectai-v2": "protectai/deberta-v3-base-prompt-injection-v2",
}


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def resolve_licence(model_id: str) -> str:
    """Read the licence off the model's own card. Never guess it from the filename."""
    try:
        from huggingface_hub import HfApi

        card = getattr(HfApi().model_info(model_id), "card_data", None) or {}
        lic = (card.get("license") if hasattr(card, "get") else None) or None
        if lic:
            return f"{lic} (declared on the model card)"
    except Exception as exc:  # noqa: BLE001
        return f"UNVERIFIED — could not read model card ({type(exc).__name__}). Check before deriving."
    return "UNVERIFIED — model card declares no licence. Check before deriving."


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    pos = (len(s) - 1) * p
    lo, hi = int(pos), min(int(pos) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--eval", default="datasets/crossdist-eval-v2.jsonl")
    ap.add_argument("--out", default="artifacts/ml/pg2-vs-soterllm.json")
    ap.add_argument(
        "--model",
        default="pg2-86m",
        help=(
            "detector to score: a KNOWN_MODELS alias (" + ", ".join(KNOWN_MODELS) + ") "
            "or any HF repo id of a sequence-classification injection detector"
        ),
    )
    ap.add_argument("--limit", type=int, default=0, help="0 = all rows")
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=512, help="PG2 caps at 512")
    ap.add_argument(
        "--threshold",
        type=float,
        default=0.5,
        help="P(attack) above which PG2 is treated as flagging",
    )
    args = ap.parse_args()

    eval_path = Path(args.eval)
    if not eval_path.exists():
        print(f"[ERROR] {eval_path} not found. Run build-crossdist-eval.py first.", file=sys.stderr)
        return 2

    rows = read_jsonl(eval_path)
    if args.limit:
        rows = rows[: args.limit]

    scoped = [r for r in rows if r.get("label") in PG2_IN_SCOPE_LABELS]
    dropped = len(rows) - len(scoped)
    print(f"[load] {len(rows)} rows, {len(scoped)} in PG2 scope, {dropped} out of scope (excluded)")
    if not scoped:
        print("[ERROR] no in-scope rows", file=sys.stderr)
        return 1

    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError:
        print("[ERROR] pip install torch transformers", file=sys.stderr)
        return 2

    model_id = KNOWN_MODELS.get(args.model, args.model)
    print(f"[model] loading {model_id}")
    try:
        tok = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForSequenceClassification.from_pretrained(model_id)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] could not load {model_id}: {type(exc).__name__}: {exc}", file=sys.stderr)
        print(
            "\nIf this is a Llama-Prompt-Guard repo: it is gated=manual, so a valid\n"
            "`huggingface-cli login` is NOT sufficient — Meta must approve the request\n"
            "on the model page, which can take hours. Ungated alternative that measures\n"
            "the same thing today:  --model protectai-v2\n"
            "No partial result is written.",
            file=sys.stderr,
        )
        return 1
    model.eval()

    # The licence is resolved from the model's OWN card, not hardcoded. It used to be
    # a fixed "Llama 4 Community Licence" string, which was correct only for the PG2
    # repos this script was first written for — once --model accepted any repo id, the
    # Apache-2.0 ProtectAI run was stamped "eval only, no derivation" too. That is a
    # licence claim, and a wrong one in both directions: it forbids a distillation the
    # licence actually permits, and it would green-light one it does not. Read it.
    licence = resolve_licence(model_id)
    print(f"[model] licence={licence}")

    # Resolve the malicious index from the model's own config rather than assuming 1.
    id2label = {int(k): str(v) for k, v in (model.config.id2label or {}).items()}
    attack_idx = next(
        (i for i, name in id2label.items() if name.strip().upper() not in {"BENIGN", "LABEL_0", "SAFE"}),
        1,
    )
    print(f"[model] id2label={id2label} -> attack index {attack_idx}")

    latencies: list[float] = []
    scores: list[float] = []
    with torch.no_grad():
        for start in range(0, len(scoped), args.batch_size):
            batch = scoped[start : start + args.batch_size]
            enc = tok(
                [r["text"] for r in batch],
                padding=True,
                truncation=True,
                max_length=args.max_length,
                return_tensors="pt",
            )
            t0 = time.perf_counter()
            logits = model(**enc).logits
            dt_ms = (time.perf_counter() - t0) * 1000.0
            probs = torch.softmax(logits, dim=-1)[:, attack_idx]
            scores.extend(probs.tolist())
            latencies.extend([dt_ms / len(batch)] * len(batch))
            done = min(start + args.batch_size, len(scoped))
            print(f"\r[pg2] {done}/{len(scoped)}", end="", flush=True)
    print()

    tp = fp = tn = fn = 0
    missed: dict[str, int] = {}
    fp_by_source: dict[str, int] = {}
    for r, score in zip(scoped, scores):
        is_attack = r["label"] != "SAFE"
        flagged = score >= args.threshold
        src = str(r.get("source", "?"))
        if is_attack and flagged:
            tp += 1
        elif is_attack:
            fn += 1
            missed[src] = missed.get(src, 0) + 1
        elif flagged:
            fp += 1
            fp_by_source[src] = fp_by_source.get(src, 0) + 1
        else:
            tn += 1

    recall = tp / max(1, tp + fn)
    fpr = fp / max(1, fp + tn)
    precision = tp / max(1, tp + fp)

    print(f"\n{'=' * 66}")
    print(f"  {model_id.split('/')[-1]} on {eval_path.name}")
    print(f"{'=' * 66}")
    print(f"  scored     {len(scoped)} in-scope rows (excluded {dropped} out-of-scope)")
    print(f"  threshold  P(attack) >= {args.threshold}")
    print(f"  RECALL     {tp}/{tp + fn}  ({recall * 100:.1f}%)")
    print(f"  FPR        {fp}/{fp + tn}  ({fpr * 100:.1f}%)")
    print(f"  precision  {precision * 100:.1f}%")
    print(f"  latency    p50={percentile(latencies, 0.5):.1f}ms p95={percentile(latencies, 0.95):.1f}ms")
    if missed:
        print("\n  missed attacks by source:")
        for s, n in sorted(missed.items(), key=lambda x: -x[1])[:10]:
            print(f"    {s:34} {n}")
    if fp_by_source:
        print("\n  false positives by source:")
        for s, n in sorted(fp_by_source.items(), key=lambda x: -x[1])[:10]:
            print(f"    {s:34} {n}")

    report = {
        "model": model_id,
        "model_licence": licence,
        "eval_file": str(eval_path).replace("\\", "/"),
        "rows_total": len(rows),
        "rows_scored": len(scoped),
        "rows_excluded_out_of_pg2_scope": dropped,
        "threshold": args.threshold,
        "recall": recall,
        "fpr": fpr,
        "precision": precision,
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "latency_ms": {
            "p50": percentile(latencies, 0.5),
            "p95": percentile(latencies, 0.95),
            "p99": percentile(latencies, 0.99),
        },
        "missed_by_source": missed,
        "fp_by_source": fp_by_source,
        "comparability": {
            "vs_soterllm": "DIRECT — same rows, same threshold semantics",
            "vs_lakera_guard": (
                "NOT MEASURED. Lakera Guard is closed/API-only and cannot be run here. "
                "A Lakera comparison requires PINT (scripts/ml/soterai-pint-eval-v2.ts) "
                "and verification from opensource@lakera.ai. Do not infer one from this file."
            ),
            "pg2_scope": (
                "PG2 judges instruction-override only, not content harm. "
                "UNSAFE_OUTPUT/PII/SECRET rows were excluded, not counted as PG2 misses."
            ),
        },
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"\n[write] {out_path}")
    print(
        "\nNext, for the SoterLLM side on the SAME rows:\n"
        "  npx tsx scripts/ml/eval-crossdist.ts --file " + str(eval_path).replace("\\", "/")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
