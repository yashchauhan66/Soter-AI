#!/usr/bin/env python3
"""
Honest out-of-distribution evaluation of SoterLLM v12 + head-to-head vs a runnable
external detector.

WHY THIS FILE EXISTS ALONGSIDE comprehensive-v11-test-5000.py
  That script GENERATES its own test data from templates written in the same file
  (`random.choice(templates).format(action=...)`). Those templates are the same
  shape as the ones in datasets/ml-augmented-v*.jsonl that v12 trained on, so the
  99.42% recall it prints is an in-distribution memorisation score, not a
  measurement of how v12 behaves on attacks it has never seen. It also cannot
  produce a false-positive rate that means anything, because its "safe" rows are
  templates too.

  This harness instead scores v12 on the frozen external corpora in
  datasets/crossdist-eval-v*.jsonl (Lakera gandalf, deepset/prompt-injections,
  TrustAIRLab in-the-wild jailbreaks, dolly/openorca benign) and, crucially,
  SUBTRACTS any eval row whose augmentation skeleton appears in v12's own
  training manifest. v12 trained on 601 external:gandalf rows, and the eval sets
  contain external:gandalf rows, so without that subtraction the "held-out"
  number is partly a train-on-test number.

  Metrics are reported three ways so a reader cannot be misled by whichever one
  gets quoted: ALL rows, CONTAMINATED rows (skeleton seen in training), and CLEAN
  rows (disjoint from training). The CLEAN pair is the honest headline.

LAKERA
  Lakera Guard is closed and API-only. There is no key in .env and nothing to
  download, so this script CANNOT and DOES NOT emit a Lakera number. What it can
  do is score an externally-runnable state-of-the-art detector on the SAME rows
  (--baseline protectai-v2 / pg2-86m). Any "we beat Lakera" sentence not backed
  by a real PINT submission or a live API key remains unsupported.

SCOPE BOUND FOR THE BASELINE
  PG2 and ProtectAI answer one question: "does this text try to override prior
  instructions?" They do not judge content harm. So the head-to-head is scored
  only on PROMPT_INJECTION / JAILBREAK / SYSTEM_PROMPT_LEAK_ATTEMPT / SAFE rows.
  Scoring them on PII or UNSAFE_OUTPUT rows would manufacture a flattering win.

USAGE
  python scripts/ml/eval-v12-honest.py --eval datasets/crossdist-eval-v3.jsonl
  python scripts/ml/eval-v12-honest.py --baseline protectai-v2 --limit 4000
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

MODEL_DIR_DEFAULT = Path("models/ml-classifier-v12")

ALL_LABELS = [
    "SAFE",
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT",
    "TOOL_CALL_ABUSE",
    "ENCODING_OBFUSCATION",
    "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION",
    "TOXICITY_HARASSMENT",
]

# The only labels an instruction-override detector can be fairly scored on.
OVERRIDE_SCOPE = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "SAFE"}

BASELINES = {
    "protectai-v2": "protectai/deberta-v3-base-prompt-injection-v2",
    # Meta's own repo is gated=manual. The gravitee-io mirror is the same weights
    # ungated, which is how PG2 was measured before (memory: pg2-86m via ungated
    # mirror). Named separately so a report can never imply we got Meta's gate.
    "pg2-86m-mirror": "gravitee-io/Llama-Prompt-Guard-2-86M-onnx",
    "pg2-86m": "meta-llama/Llama-Prompt-Guard-2-86M",
    "pg2-22m": "meta-llama/Llama-Prompt-Guard-2-22M",
}


def group_key_for(text: str) -> str:
    """Must match train-soterllm-v12-transfer.py::group_key_for exactly."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def read_jsonl(path: Path):
    rows = []
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


def build_training_skeletons(manifest_path: Path) -> tuple[set[str], list[str], int]:
    """Every group_key v12 could have seen, from its own dataset manifest."""
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    datasets = manifest.get("datasets", [])
    skeletons: set[str] = set()
    missing: list[str] = []
    rows_read = 0
    for rel in datasets:
        p = Path(rel)
        if not p.exists():
            missing.append(rel)
            continue
        with p.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                text = row.get("text")
                if isinstance(text, str) and text.strip():
                    skeletons.add(group_key_for(text))
                    rows_read += 1
    return skeletons, missing, rows_read


class SoterV12:
    def __init__(self, model_dir: Path, apply_abstain: bool):
        import onnxruntime as ort
        from transformers import AutoTokenizer

        self.session = ort.InferenceSession(
            str(model_dir / "model.onnx"), providers=["CPUExecutionProvider"]
        )
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir / "tokenizer_config"))
        cal = json.loads((model_dir / "calibration.json").read_text(encoding="utf-8"))
        self.thresholds = cal.get("per_label_thresholds", {})
        self.abstain_floor = float(cal.get("ood", {}).get("suggested_abstain_max_prob", 0.0))
        self.apply_abstain = apply_abstain
        labels_path = model_dir / "labels.json"
        self.labels = list(ALL_LABELS)
        if labels_path.exists():
            parsed = json.loads(labels_path.read_text(encoding="utf-8"))
            if isinstance(parsed, list):
                self.labels = parsed
            elif isinstance(parsed, dict) and isinstance(parsed.get("labels"), list):
                self.labels = parsed["labels"]
            elif isinstance(parsed, dict):
                # Shipped format is {"0": "SAFE", "1": "PROMPT_INJECTION", ...}. This
                # MUST be honoured rather than falling back to ALL_LABELS: v7 has 9
                # labels, v12 has 14, and ALL_LABELS only happens to match v12. Using
                # the 14-label list for a 9-label model silently mislabels nothing
                # here (indices 0-8 agree) but would break any model whose order
                # differs, and it hides a real schema mismatch.
                self.labels = [parsed[k] for k in sorted(parsed, key=lambda x: int(x))]
        # A model whose output width disagrees with its label file is a
        # configuration error, not something to paper over with a fallback.
        out_width = self.session.get_outputs()[0].shape[-1]
        if isinstance(out_width, int) and out_width != len(self.labels):
            raise ValueError(
                f"{model_dir}: ONNX emits {out_width} logits but labels.json lists "
                f"{len(self.labels)} labels"
            )

    def predict_batch(self, texts: list[str]):
        enc = self.tokenizer(
            texts, padding=True, truncation=True, max_length=256, return_tensors="np"
        )
        logits = self.session.run(
            None,
            {
                "input_ids": enc["input_ids"].astype(np.int64),
                "attention_mask": enc["attention_mask"].astype(np.int64),
            },
        )[0]
        shifted = logits - logits.max(axis=1, keepdims=True)
        exp = np.exp(shifted)
        probs = exp / exp.sum(axis=1, keepdims=True)
        out = []
        for row in probs:
            idx = int(row.argmax())
            label = self.labels[idx] if idx < len(self.labels) else f"IDX_{idx}"
            conf = float(row[idx])
            abstained = False
            # Shipped decision rule (lib/ml/onnxBackend.ts): per-label threshold,
            # then the OOD abstention floor. Abstain is NOT a detection.
            if idx != 0:
                if conf < float(self.thresholds.get(label, 0.05)):
                    label, conf, idx = self.labels[0], float(row[0]), 0
            if self.apply_abstain and float(row.max()) < self.abstain_floor:
                abstained = True
            out.append((label, conf, abstained))
        return out


class HFBinaryBaseline:
    """Any HF sequence-classification injection detector: label 1 == attack."""

    def __init__(self, model_id: str):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        import torch

        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id)
        self.model.eval()
        self.model_id = model_id

    def predict_batch(self, texts: list[str], threshold: float = 0.5):
        enc = self.tokenizer(
            texts, padding=True, truncation=True, max_length=512, return_tensors="pt"
        )
        with self.torch.no_grad():
            logits = self.model(**enc).logits
        probs = self.torch.softmax(logits, dim=-1).cpu().numpy()
        attack_col = probs.shape[1] - 1
        return [(bool(p[attack_col] >= threshold), float(p[attack_col])) for p in probs]


def score(rows, preds) -> dict:
    """preds: list of bool 'flagged as attack'. rows carry the gold label."""
    attacks = [(r, p) for r, p in zip(rows, preds) if r["label"] != "SAFE"]
    safes = [(r, p) for r, p in zip(rows, preds) if r["label"] == "SAFE"]
    tp = sum(1 for _, p in attacks if p)
    fp = sum(1 for _, p in safes if p)
    per_label = defaultdict(lambda: [0, 0])
    for r, p in attacks:
        per_label[r["label"]][1] += 1
        if p:
            per_label[r["label"]][0] += 1
    return {
        "rows": len(rows),
        "attack_rows": len(attacks),
        "safe_rows": len(safes),
        "recall": (tp / len(attacks) * 100) if attacks else None,
        "fpr": (fp / len(safes) * 100) if safes else None,
        "detected": tp,
        "false_positives": fp,
        "per_label_recall": {
            k: {"detected": v[0], "total": v[1], "recall_pct": round(v[0] / v[1] * 100, 2)}
            for k, v in sorted(per_label.items())
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default=str(MODEL_DIR_DEFAULT))
    ap.add_argument("--eval", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--limit", type=int, default=0, help="0 = all rows")
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--baseline", default=None, choices=sorted(BASELINES), nargs="?")
    ap.add_argument("--apply-abstain", action="store_true",
                    help="honour the calibration OOD floor (abstain != detection)")
    ap.add_argument("--out", default="artifacts/ml/v12-honest-eval.json")
    args = ap.parse_args()

    model_dir = Path(args.model_dir)
    eval_path = Path(args.eval)
    if not (model_dir / "model.onnx").exists():
        print(f"ERROR: no model at {model_dir/'model.onnx'}", file=sys.stderr)
        return 1
    if not eval_path.exists():
        print(f"ERROR: no eval set at {eval_path}", file=sys.stderr)
        return 1

    print("=" * 78)
    print("SoterLLM v12 — honest out-of-distribution evaluation")
    print("=" * 78)

    rows = read_jsonl(eval_path)
    rows = [r for r in rows if isinstance(r.get("text"), str) and r.get("label") in ALL_LABELS]
    print(f"eval set        : {eval_path}  ({len(rows)} usable rows)")

    # ---- contamination check -------------------------------------------------
    manifest = model_dir / "dataset_manifest.json"
    train_skeletons, missing, train_rows = build_training_skeletons(manifest)
    print(f"train skeletons : {len(train_skeletons):,} unique (from {train_rows:,} rows)")
    if missing:
        print("  !! MISSING training files (contamination check is INCOMPLETE):")
        for m in missing:
            print(f"     - {m}")

    for r in rows:
        r["_skel"] = group_key_for(r["text"])
        r["_seen"] = r["_skel"] in train_skeletons

    if args.limit and len(rows) > args.limit:
        # Deterministic subsample that preserves the label mix.
        rng = np.random.RandomState(42)
        idx = rng.permutation(len(rows))[: args.limit]
        rows = [rows[i] for i in sorted(idx)]
        print(f"subsampled to   : {len(rows)} rows (seed 42)")

    clean = [r for r in rows if not r["_seen"]]
    dirty = [r for r in rows if r["_seen"]]
    print(f"contamination   : {len(dirty)} of {len(rows)} rows ({len(dirty)/max(1,len(rows))*100:.2f}%) "
          f"share a training skeleton -> excluded from the honest number")
    src = Counter(r.get("source", "?") for r in dirty)
    for k, v in src.most_common(8):
        print(f"    seen-in-training source: {v:6d}  {k}")

    # ---- v12 ----------------------------------------------------------------
    print("\n[1] scoring SoterLLM v12 ...")
    v12 = SoterV12(model_dir, apply_abstain=args.apply_abstain)
    preds: list[tuple[str, float, bool]] = []
    t0 = time.perf_counter()
    for i in range(0, len(rows), args.batch):
        preds.extend(v12.predict_batch([r["text"] for r in rows[i : i + args.batch]]))
        if i and i % (args.batch * 20) == 0:
            print(f"    {i}/{len(rows)}")
    elapsed = time.perf_counter() - t0
    throughput = len(rows) / elapsed if elapsed else 0.0
    print(f"    {len(rows)} rows in {elapsed:.1f}s  ({throughput:.1f} rows/s, "
          f"{elapsed/max(1,len(rows))*1000:.2f} ms/row)")

    flagged = [p[0] != "SAFE" and not p[2] for p in preds]
    abstained = sum(1 for p in preds if p[2])

    all_score = score(rows, flagged)
    clean_rows_idx = [i for i, r in enumerate(rows) if not r["_seen"]]
    dirty_rows_idx = [i for i, r in enumerate(rows) if r["_seen"]]
    clean_score = score([rows[i] for i in clean_rows_idx], [flagged[i] for i in clean_rows_idx])
    dirty_score = score([rows[i] for i in dirty_rows_idx], [flagged[i] for i in dirty_rows_idx])

    def show(name, s):
        r = "n/a" if s["recall"] is None else f"{s['recall']:.2f}%"
        f = "n/a" if s["fpr"] is None else f"{s['fpr']:.2f}%"
        print(f"  {name:<34} recall {r:>8}   FPR {f:>7}   "
              f"({s['attack_rows']} atk / {s['safe_rows']} safe)")

    print("\n  --- v12 results ---")
    show("ALL rows", all_score)
    show("CONTAMINATED (seen in training)", dirty_score)
    show("CLEAN (disjoint) <- HONEST", clean_score)
    if args.apply_abstain:
        print(f"  abstentions (OOD floor {v12.abstain_floor}): {abstained}")

    print("\n  per-label recall on CLEAN rows:")
    for k, v in clean_score["per_label_recall"].items():
        print(f"    {k:<32} {v['recall_pct']:6.2f}%  ({v['detected']}/{v['total']})")

    report = {
        "harness": "eval-v12-honest/v1",
        "model_dir": str(model_dir),
        "eval_set": str(eval_path),
        "eval_rows": len(rows),
        "contamination": {
            "training_skeletons": len(train_skeletons),
            "training_rows_read": train_rows,
            "missing_training_files": missing,
            "eval_rows_seen_in_training": len(dirty),
            "eval_rows_clean": len(clean),
            "seen_sources": dict(src),
        },
        "abstention_applied": bool(args.apply_abstain),
        "abstentions": abstained,
        "throughput_rows_per_s": round(throughput, 1),
        "ms_per_row": round(elapsed / max(1, len(rows)) * 1000, 2),
        "soterllm_v12": {"all": all_score, "contaminated": dirty_score, "clean": clean_score},
        "lakera": {
            "measured": False,
            "reason": "Lakera Guard is closed and API-only; no LAKERA_API_KEY present and "
                      "no downloadable weights exist. No Lakera number can be produced here.",
        },
    }

    # ---- external baseline on the SAME rows ---------------------------------
    if args.baseline:
        model_id = BASELINES[args.baseline]
        print(f"\n[2] scoring external baseline {model_id} on the same rows ...")
        scope_idx = [i for i, r in enumerate(rows) if r["label"] in OVERRIDE_SCOPE]
        scope_clean_idx = [i for i in scope_idx if not rows[i]["_seen"]]
        print(f"    in-scope rows (override-detection only): {len(scope_idx)} "
              f"({len(scope_clean_idx)} clean)")
        try:
            base = HFBinaryBaseline(model_id)
        except Exception as exc:  # noqa: BLE001 - network/gating/missing torch all land here
            print(f"    !! baseline unavailable: {type(exc).__name__}: {exc}")
            report["baseline"] = {"model": model_id, "measured": False, "error": str(exc)}
        else:
            bpred: dict[int, bool] = {}
            t0 = time.perf_counter()
            for i in range(0, len(scope_idx), args.batch):
                chunk = scope_idx[i : i + args.batch]
                res = base.predict_batch([rows[j]["text"] for j in chunk])
                for j, (hit, _p) in zip(chunk, res):
                    bpred[j] = hit
            b_elapsed = time.perf_counter() - t0
            b_scope = score([rows[i] for i in scope_idx], [bpred[i] for i in scope_idx])
            b_clean = score([rows[i] for i in scope_clean_idx], [bpred[i] for i in scope_clean_idx])
            v_scope = score([rows[i] for i in scope_idx], [flagged[i] for i in scope_idx])
            v_clean = score([rows[i] for i in scope_clean_idx],
                            [flagged[i] for i in scope_clean_idx])
            print("\n  --- head-to-head, SAME rows, override-detection scope only ---")
            show("v12   (all in-scope)", v_scope)
            show(f"{args.baseline} (all in-scope)", b_scope)
            show("v12   (CLEAN in-scope) <- HONEST", v_clean)
            show(f"{args.baseline} (CLEAN in-scope)", b_clean)
            print(f"  baseline throughput: {len(scope_idx)/max(1e-9,b_elapsed):.1f} rows/s")
            report["baseline"] = {
                "model": model_id,
                "measured": True,
                "scope_labels": sorted(OVERRIDE_SCOPE),
                "throughput_rows_per_s": round(len(scope_idx) / max(1e-9, b_elapsed), 1),
                "in_scope_all": b_scope,
                "in_scope_clean": b_clean,
                "v12_in_scope_all": v_scope,
                "v12_in_scope_clean": v_clean,
            }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nwrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
