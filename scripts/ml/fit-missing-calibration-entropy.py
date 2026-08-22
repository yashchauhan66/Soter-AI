#!/usr/bin/env python3
"""
Fit the MISSING OOD entropy fields for an already-trained SoterLLM artifact.

WHY THIS IS NEEDED
  lib/ml/calibration.ts::labelSpaceUncertain reads ONE field and has no env
  override:

      const budget = calibration.ood.entropy_p95;
      return typeof budget === "number" && entropy(probs) > budget;

  train-soterllm-v12-transfer.py emitted only max_prob_p05 / max_prob_mean /
  suggested_abstain_max_prob. So every artifact that trainer produced (v8..v12)
  ships WITHOUT entropy_p95, and dropping one into ML_ONNX_CALIBRATION_PATH
  silently disables the label-space abstention path that v4/v7 have — the path
  that exists specifically to catch truncated long-document views where the model
  is binary-confident but splits its mass across attack labels. Measured cost of
  leaving it unset (the fixtures quoted in calibration.ts): a 40-clause benign
  contract escalates as DATA_EXFILTRATION_ATTEMPT at P(attack) 0.9971 and a
  40-step README as PROMPT_INJECTION at 0.9927. shouldAbstain's budget survives
  only because SOTERAI_ML_ABSTAIN_ENTROPY is set in .env; nothing backs up
  entropy_p95.

  The trainer has since been patched to emit all three fields, so v13+ needs none
  of this. This script exists for the artifacts already on disk.

THE SPLIT PROBLEM (read before trusting any number this prints)
  The right rows to fit on are the trainer's own calibration split. For v12 those
  rows are UNRECOVERABLE, and not because anything here is wrong:

      group_aware_split did `unique_groups = list(set(groups))`

  Python randomizes str hashing per process unless PYTHONHASHSEED is pinned, so
  set-iteration order — and therefore the seeded shuffle that follows — differs on
  every run. Re-running v12's exact loader over its exact six dataset files
  reproduces 144,332 rows and 126,126 groups (both byte-identical to
  dataset_manifest.json) but partitions them 115259/11676/17397 where the manifest
  recorded 115379/11561/17392. Same rows, same grouping, different partition.

  So this script does not pretend. It tries the exact reproduction; when that
  fails it makes you name a SUBSTITUTE reference distribution, prints what that
  substitute biases, and stamps the choice into calibration.json so nobody later
  reads a post-hoc percentile as a trainer-fitted one.

REFERENCE MODES (--reference)
  manifest-split         The real thing. Requires the reproduction to match the
                         manifest exactly; refuses to fit otherwise. Correct for
                         any artifact trained after the sorted() fix.
  deterministic-resplit  Same corpus, same fracs, same seed, order-stable
                         partition. BIAS: ~80% of these rows were in the trainer's
                         TRAIN split, where the model is overconfident, so entropy
                         runs low and the fitted p95 is TIGHTER than the truth.
                         A tighter budget means the gate abstains MORE — it costs
                         recall on truncated long inputs and cannot cause a false
                         positive. That is the safe direction to be wrong in.
  external-holdout       Percentiles from a pre-scored .npz (scripts/ml/
                         dump-model-probs.py), contaminated rows dropped. Rows the
                         model provably never trained on. BIAS: a different
                         distribution, and for v12's eval corpus only 4 of 14
                         classes appear, so entropy runs high and the fitted p95
                         is LOOSER than the truth — it lets more split-mass
                         through, which is the unsafe direction. Reported as an
                         upper bound, not a recommendation.

USAGE
  python scripts/ml/fit-missing-calibration-entropy.py --model-dir models/ml-classifier-v12
  python scripts/ml/fit-missing-calibration-entropy.py --model-dir models/ml-classifier-v12 \
      --external-npz artifacts/ml/probs-v12-crossdist-v3.npz
  # writing requires naming the substitute AND acknowledging the bound:
  python scripts/ml/fit-missing-calibration-entropy.py --model-dir models/ml-classifier-v12 \
      --reference deterministic-resplit --acknowledge-unrecoverable-split --write
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np


def group_key_for(text: str) -> str:
    """Must match train-soterllm-v12-transfer.py::group_key_for exactly."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def load_jsonl(file_paths, label_to_idx):
    """Byte-for-byte the trainer's loader (minus the --sample path)."""
    texts, labels, groups = [], [], []
    for fp in file_paths:
        path = Path(fp)
        if not path.exists():
            print(f"  [WARN] {fp} not found, skipping")
            continue
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                text = (obj.get("text") or "").strip()
                label_str = obj.get("label", "SAFE")
                if not text:
                    continue
                idx = label_to_idx.get(label_str)
                if idx is None:
                    for k, v in label_to_idx.items():
                        if k.upper() == str(label_str).upper():
                            idx = v
                            break
                if idx is None:
                    continue
                texts.append(text)
                labels.append(idx)
                groups.append(group_key_for(text))
    return texts, labels, groups


def group_aware_split(groups, val_frac=0.12, cal_frac=0.08, seed=42):
    """The trainer's split with the order-stability fix (sorted, not list(set()))."""
    unique_groups = sorted(set(groups))
    rng = np.random.RandomState(seed)
    rng.shuffle(unique_groups)
    n = len(unique_groups)
    n_val = max(1, int(n * val_frac))
    n_cal = max(1, int(n * cal_frac))
    val_groups = set(unique_groups[:n_val])
    cal_groups = set(unique_groups[n_val:n_val + n_cal])
    train_groups = set(unique_groups[n_val + n_cal:])
    train_idx = [i for i, g in enumerate(groups) if g in train_groups]
    cal_idx = [i for i, g in enumerate(groups) if g in cal_groups]
    val_idx = [i for i, g in enumerate(groups) if g in val_groups]
    return train_idx, cal_idx, val_idx


def label_entropy(probs: np.ndarray) -> np.ndarray:
    """Natural-log entropy over the full label distribution (calibration.ts::entropy)."""
    p = np.clip(probs, 1e-12, 1.0)
    return -(probs * np.where(probs > 1e-12, np.log(p), 0.0)).sum(axis=1)


def binary_entropy(p_attack: np.ndarray) -> np.ndarray:
    """calibration.ts::binaryEntropy, vectorised. Max ln 2 = 0.6931 at p = 0.5."""
    p = np.clip(p_attack, 0.0, 1.0)
    out = np.zeros_like(p)
    mask = (p > 1e-12) & (p < 1 - 1e-12)
    pm = p[mask]
    out[mask] = -(pm * np.log(pm) + (1 - pm) * np.log(1 - pm))
    return out


def fit_from_probs(probs: np.ndarray) -> dict:
    h_label = label_entropy(probs)
    p_attack = 1.0 - probs[:, 0]          # index 0 is SAFE for every SoterLLM artifact
    h_binary = binary_entropy(p_attack)
    return {
        "entropy_mean": float(h_label.mean()),
        "entropy_p95": float(np.percentile(h_label, 95)),
        "binary_entropy_p95": float(np.percentile(h_binary, 95)),
    }


def score_texts(model_dir: Path, texts: list[str], batch: int) -> np.ndarray:
    import onnxruntime as ort
    from transformers import AutoTokenizer

    sess = ort.InferenceSession(str(model_dir / "model.onnx"),
                                providers=["CPUExecutionProvider"])
    tok = AutoTokenizer.from_pretrained(str(model_dir / "tokenizer_config"))
    chunks = []
    for i in range(0, len(texts), batch):
        enc = tok(texts[i : i + batch], padding=True, truncation=True,
                  max_length=256, return_tensors="np")
        logits = sess.run(None, {
            "input_ids": enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        })[0]
        sh = logits - logits.max(axis=1, keepdims=True)
        e = np.exp(sh)
        chunks.append(e / e.sum(axis=1, keepdims=True))
        if i and i % (batch * 40) == 0:
            print(f"    {i}/{len(texts)}")
    # Temperature is already baked into the exported ONNX logits, so these are the
    # same calibrated probabilities the trainer had in `cal_probs`.
    return np.concatenate(chunks, axis=0)


def report(title: str, fitted: dict, n_rows: int, n_labels: int, bias: str) -> None:
    print(f"\n{title}  (n = {n_rows:,})")
    print(f"  entropy_mean       = {fitted['entropy_mean']:.6f}   "
          f"(max possible ln {n_labels} = {np.log(n_labels):.4f})")
    print(f"  entropy_p95        = {fitted['entropy_p95']:.6f}")
    print(f"  binary_entropy_p95 = {fitted['binary_entropy_p95']:.6f}   "
          f"(max possible ln 2 = {np.log(2):.4f})")
    print(f"  bias: {bias}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--reference", default="manifest-split",
                    choices=["manifest-split", "deterministic-resplit", "external-holdout"],
                    help="which rows to fit the percentiles on (see module docstring)")
    ap.add_argument("--external-npz", default=None,
                    help="probs .npz from scripts/ml/dump-model-probs.py; also fitted "
                         "as an upper-bound comparison whenever it is supplied")
    ap.add_argument("--acknowledge-unrecoverable-split", action="store_true",
                    help="required to --write a substitute reference for an artifact "
                         "whose real calibration split cannot be reproduced")
    ap.add_argument("--write", action="store_true",
                    help="patch calibration.json in place (a .bak is kept)")
    args = ap.parse_args()

    model_dir = Path(args.model_dir)
    manifest = json.loads((model_dir / "dataset_manifest.json").read_text(encoding="utf-8"))
    labels_map = json.loads((model_dir / "labels.json").read_text(encoding="utf-8"))
    all_labels = [labels_map[k] for k in sorted(labels_map, key=lambda x: int(x))]
    label_to_idx = {name: i for i, name in enumerate(all_labels)}
    cal = json.loads((model_dir / "calibration.json").read_text(encoding="utf-8"))

    print("=" * 78)
    print(f"fitting missing OOD entropy fields for {model_dir}")
    print("=" * 78)
    print(f"labels ({len(all_labels)}): {all_labels}")

    texts, labels, groups = load_jsonl(manifest["datasets"], label_to_idx)
    print(f"rows loaded     : {len(texts):,}   unique groups: {len(set(groups)):,}")

    seed = int(manifest.get("split", {}).get("seed", 42))
    train_idx, cal_idx, val_idx = group_aware_split(groups, 0.12, 0.08, seed)
    got = {"train": len(train_idx), "calibration": len(cal_idx), "validation": len(val_idx)}
    want = {k: int(v) for k, v in manifest["split"].items() if k in got}
    rows_match = len(texts) == int(manifest["rows_total"])
    groups_match = len(set(groups)) == int(manifest.get("groups_total", -1))
    split_match = got == want
    print(f"split reproduced: {got}")
    print(f"manifest says   : {want}")
    print(f"rows_total match: {rows_match}   groups_total match: {groups_match}   "
          f"split match: {split_match}")

    if not rows_match or not groups_match:
        print("\nERROR: the CORPUS itself does not reproduce (row or group count differs).")
        print("       The dataset files changed since training. Nothing here is salvageable;")
        print("       refusing to fit.")
        return 2

    if not split_match:
        print("\n--- the manifest split is UNRECOVERABLE for this artifact -------------")
        print("  Rows and grouping reproduce exactly; only the partition differs. Cause:")
        print("  group_aware_split used list(set(groups)), and Python randomizes str")
        print("  hashing per process, so the seeded shuffle saw a different order at")
        print("  training time than it can ever see again. The trainer is now fixed")
        print("  (sorted(set(...))), which makes v13+ reproducible — but v12's exact")
        print("  calibration rows are gone.")
        print("  Consequence: --reference manifest-split cannot be honoured here.")
        print("-" * 70)

    # ── Fit the chosen reference (plus the external bound when available) ──────
    n_labels = len(all_labels)
    external_fit = None
    if args.external_npz:
        z = np.load(args.external_npz, allow_pickle=True)
        ext_probs = z["probs"].astype(np.float64)
        clean = ~z["contaminated"] if "contaminated" in z.files else np.ones(len(ext_probs), bool)
        ext_probs = ext_probs[clean]
        ext_labels = [str(x) for x in z["labels"]] if "labels" in z.files else all_labels
        if len(ext_labels) != n_labels:
            print(f"\nERROR: --external-npz has {len(ext_labels)} labels, artifact has "
                  f"{n_labels}. Wrong model's dump.")
            return 2
        external_fit = fit_from_probs(ext_probs)
        report("external-holdout (contaminated rows dropped)", external_fit,
               len(ext_probs), n_labels,
               "LOOSER than truth — different distribution, and only the classes present "
               "in this corpus are exercised. Upper bound.")

    if args.reference == "manifest-split" and not split_match:
        print("\nERROR: --reference manifest-split requested but the split does not")
        print("       reproduce. A percentile fitted on the wrong rows would look")
        print("       authoritative and gate real traffic. Pick an explicit substitute:")
        print("         --reference deterministic-resplit   (tighter, safe direction)")
        print("         --reference external-holdout        (looser, unsafe direction)")
        return 2

    if args.reference == "external-holdout":
        if external_fit is None:
            print("\nERROR: --reference external-holdout needs --external-npz.")
            return 2
        chosen, chosen_n, chosen_desc = external_fit, int(clean.sum()), "external-holdout"
    else:
        cal_texts = [texts[i] for i in cal_idx]
        print(f"\nscoring {len(cal_texts):,} rows of the "
              f"{'reproduced calibration split' if split_match else 'deterministic re-split'} ...")
        probs = score_texts(model_dir, cal_texts, args.batch)
        chosen = fit_from_probs(probs)
        chosen_n = len(cal_texts)
        chosen_desc = "manifest-split" if split_match else "deterministic-resplit"
        report(f"{chosen_desc}", chosen, chosen_n, n_labels,
               "exactly the trainer's calibration rows" if split_match else
               "TIGHTER than truth — ~80% of these rows were in the trainer's train "
               "split, where the model is overconfident. Tighter = abstains more = "
               "costs recall on truncated inputs, cannot add a false positive.")

        # The two fields the trainer DID emit. On an exact reproduction these must
        # match; on a substitute reference they cannot, and the size of the gap is
        # the most direct evidence of how far the substitute is from the real split.
        repro_p05 = float(np.percentile(probs.max(axis=1), 5))
        repro_mean = float(probs.max(axis=1).mean())
        print("\ncross-check against the fields the trainer already wrote:")
        for name, repro in (("max_prob_p05", repro_p05), ("max_prob_mean", repro_mean)):
            shipped = cal["ood"].get(name)
            delta = abs(repro - shipped) if isinstance(shipped, (int, float)) else None
            verdict = "MATCH" if (delta is not None and delta < 1e-4) else "DIFFERS"
            print(f"  {name:<15} shipped {shipped!r:<22} reproduced {repro:.10f}  [{verdict}]")
            if verdict == "MATCH" and not split_match:
                print("     (matches despite a different partition — the two slices are "
                      "statistically alike)")
        if split_match:
            for name, repro in (("max_prob_p05", repro_p05), ("max_prob_mean", repro_mean)):
                shipped = cal["ood"].get(name)
                if not isinstance(shipped, (int, float)) or abs(repro - shipped) >= 1e-4:
                    print("     !! exact split reproduced but the trainer's own fields do "
                          "NOT — reproduction is unfaithful, refusing to write")
                    return 3

    if external_fit is not None and chosen_desc != "external-holdout":
        print(f"\nbracket on entropy_p95: {chosen['entropy_p95']:.6f} (chosen, tighter) .. "
              f"{external_fit['entropy_p95']:.6f} (external, looser)")

    if not args.write:
        print("\n(dry run — pass --write to patch calibration.json)")
        return 0

    if not split_match and not args.acknowledge_unrecoverable_split:
        print("\nERROR: refusing to write a substitute percentile without")
        print("       --acknowledge-unrecoverable-split. The field would be")
        print("       indistinguishable from a trainer-fitted one at read time.")
        return 2

    backup = model_dir / "calibration.json.bak"
    backup.write_text(json.dumps(cal, indent=2), encoding="utf-8")
    cal["ood"].update(chosen)
    # Provenance lives INSIDE the artifact: a reader six months from now must be
    # able to tell a post-hoc substitute percentile from a trainer-fitted one.
    cal["ood"]["entropy_fit_provenance"] = {
        "fitted_by": "scripts/ml/fit-missing-calibration-entropy.py",
        "reference": chosen_desc,
        "rows": chosen_n,
        "manifest_split_reproduced": bool(split_match),
        "bound": ("fitted on the trainer's own calibration split"
                  if split_match else
                  "SUBSTITUTE reference: the trainer's calibration split is "
                  "unrecoverable (list(set()) + per-process str hash randomization). "
                  "deterministic-resplit overlaps the train split, so this p95 is "
                  "TIGHTER than the truth: the gate abstains more than intended, "
                  "costing recall on truncated (>256-token) inputs and never adding "
                  "a false positive."),
        "external_upper_bound_entropy_p95": (
            external_fit["entropy_p95"] if external_fit else None),
    }
    cal["notes"] = (cal.get("notes", "") +
                    " OOD entropy fields fitted post-hoc by "
                    "scripts/ml/fit-missing-calibration-entropy.py; see "
                    "ood.entropy_fit_provenance for which rows and what that biases.")
    (model_dir / "calibration.json").write_text(json.dumps(cal, indent=2), encoding="utf-8")
    print(f"\nwrote {model_dir/'calibration.json'}  (backup at {backup})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
