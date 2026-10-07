#!/usr/bin/env python3
"""Paired, common-operating-point comparison. Diagnostic ML evidence, not a release gate.

Uses each exported HF tokenizer (including correct SEP after truncation), the same
rows/settings for each model, and native ORT CPU inference. Batched timings are
throughput, NEVER request latency. The separate paired batch-one probe reports
inference-only latency. No threshold is fitted to this evaluation set.
"""
import argparse
import gc
import hashlib
import json
import math
import os
import platform
import time
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ARMS = {
    "v14": "models/ml-classifier-v14",
    "v17-minilm": "models/ml-classifier-v17-minilm",
    "v17-multilingual": "models/ml-classifier-v17",
}
RELIABLE = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII",
            "SECRET", "RAG_POISONING", "ENCODING_OBFUSCATION", "MODEL_EXTRACTION",
            "TOOL_CALL_ABUSE"}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_rows(path):
    rows = []
    with Path(path).open(encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            r = json.loads(line)
            if not isinstance(r.get("text"), str) or not r["text"].strip() or not isinstance(r.get("label"), str):
                raise ValueError(f"{path}:{n}: missing text/label")
            rows.append(r)
    if not rows or not any(r["label"] == "SAFE" for r in rows) or not any(r["label"] != "SAFE" for r in rows):
        raise ValueError("Comparison requires both attacks and benign examples")
    return rows


def softmax(logits):
    x = np.asarray(logits, dtype=np.float64)
    x = x - x.max(axis=-1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)


def entropy(p):
    p = np.asarray(p, dtype=float)
    return -(p * np.log(np.maximum(p, 1e-30))).sum(axis=-1)


def decisions(probs, labels, content_lengths, calibration, extra_allowed=None):
    """Gate modes over cached probabilities.

    `extra_allowed` prices admitting labels that DEFAULT_INPUT_RELIABLE_LABELS currently
    discards on INPUT. When it is None the returned dict is byte-identical to before, so
    every existing caller and cached report is unaffected; when it is a set of label
    names, one additional key "shared_input_gate_with_extra" appears alongside the others.
    It exists so admission can be priced from cached probabilities instead of being
    reasoned about, and so the pricing runs through THIS decision layer rather than a
    second copy of it (see section 1.6 of V17-DECISION-AND-ULTRA-PLAN.md).
    """
    p = np.asarray(probs)
    safe = labels.index("SAFE")
    pred = p.argmax(axis=1)
    conf = p.max(axis=1)
    attack = 1 - p[:, safe]
    # Fixed settings, identical across all three models; rounded values reproduce
    # the backend -> augmentation boundary. This omits rules and semantic veto.
    common = ((pred != safe) & (entropy(np.stack([attack, 1 - attack], axis=1)) <= .4)
              & ((np.floor(conf * 1e4 + .5) / 1e4 >= .5)
                 | (np.floor(attack * 1e4 + .5) / 1e4 >= .85)))
    allowed = np.array([labels[i] in RELIABLE for i in pred])
    allowed_mte = np.array([labels[i] in RELIABLE | {"MULTI_TURN_ESCALATION"} for i in pred])
    truncation_ok = np.ones(len(p), dtype=bool)
    cutoff = calibration.get("ood", {}).get("entropy_p95")
    if cutoff is not None:
        truncation_ok = (np.asarray(content_lengths) <= 254) | (entropy(p) <= cutoff)
    modes = {
        "raw_argmax": pred != safe,
        "shared_attack_probability_0.90": attack >= .90,
        "shared_input_gate": common & allowed,
        "shared_input_gate_with_mte": common & allowed_mte,
        # Artifact-specific truncated-view entropy exists in deployed code. Keep
        # it separate from the fully common decision rule instead of concealing it.
        "input_gate_with_artifact_truncation": common & allowed & truncation_ok,
    }
    if extra_allowed:
        unknown = set(extra_allowed) - set(labels)
        if unknown:
            raise ValueError(f"extra_allowed names labels this artifact cannot emit: {sorted(unknown)}")
        widened = np.array([labels[i] in RELIABLE | set(extra_allowed) for i in pred])
        modes["shared_input_gate_with_extra"] = common & widened
    return modes


def wilson(k, n):
    if not n:
        return None
    z = 1.959963984540054
    p = k / n
    center = (p + z*z/(2*n)) / (1+z*z/n)
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / (1+z*z/n)
    return [center-half, center+half]


def metrics(truth, flags):
    truth, flags = np.asarray(truth, dtype=bool), np.asarray(flags, dtype=bool)
    a, b = int(truth.sum()), int((~truth).sum())
    tp, fp = int((truth & flags).sum()), int((~truth & flags).sum())
    return {"attacks": a, "benign": b, "tp": tp, "fn": a-tp, "fp": fp, "tn": b-fp,
            "recall": tp/a if a else None, "fpr": fp/b if b else None,
            "recall_wilson95": wilson(tp, a), "fpr_wilson95": wilson(fp, b)}


def percentile(values):
    return {"p50_ms": float(np.percentile(values, 50)), "p95_ms": float(np.percentile(values, 95)),
            "mean_ms": float(np.mean(values)), "samples": len(values)}


def run_arm(name, directory, rows, out, batch_size, threads, latency_samples):
    import onnxruntime as ort
    from tokenizers import Tokenizer

    directory = ROOT / directory
    model, tok_path = directory / "model.onnx", directory / "tokenizer_config/tokenizer.json"
    raw_labels = json.loads((directory / "labels.json").read_text())
    labels = [raw_labels[str(i)] for i in range(len(raw_labels))]
    calibration = json.loads((directory / "calibration.json").read_text())
    runtime = {"platform": platform.platform(), "processor": platform.processor(), "machine": platform.machine(),
               "logical_cpus": os.cpu_count(), "python": platform.python_version(), "onnxruntime": ort.__version__,
               "numpy": np.__version__, "provider": "CPUExecutionProvider"}
    if not set(r["label"] for r in rows) <= set(labels):
        raise ValueError(f"{name}: evaluation labels absent from model taxonomy")
    identity = {"model_sha256": sha(model), "tokenizer_sha256": sha(tok_path),
                "calibration_sha256": sha(directory / "calibration.json"),
                "rows_sha256": hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
                "labels": labels, "max_length": 256, "format_version": 2, "runtime": runtime,
                "batch_size": batch_size, "threads": threads, "latency_samples": latency_samples}
    cache = out / f"{name}-scores.json"
    if cache.exists():
        previous = json.loads(cache.read_text(encoding="utf-8"))
        if previous.get("identity") != identity or len(previous.get("probabilities", [])) != len(rows):
            raise ValueError(f"Stale/incomplete cache: {cache}; use a new output directory")
        print(f"{name}: verified cached scores", flush=True)
        return previous
    tokenizer = Tokenizer.from_file(str(tok_path))
    tokenizer.no_padding()
    tokenizer.no_truncation()
    content = tokenizer.encode_batch([r["text"] for r in rows], add_special_tokens=False)
    lengths = [len(e.ids) for e in content]
    cls, sep, pad, unk = [tokenizer.token_to_id(x) for x in ("[CLS]", "[SEP]", "[PAD]", "[UNK]")]
    if any(x is None for x in (cls, sep, pad, unk)):
        raise ValueError("Expected BERT WordPiece special tokens")
    encoded = [[cls] + e.ids[:254] + [sep] for e in content]
    unknown = [e.ids.count(unk) for e in content]
    del content
    options = ort.SessionOptions()
    options.intra_op_num_threads, options.inter_op_num_threads = threads, 1
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])

    def forward(indices, fixed=False):
        width = 256 if fixed else max(len(encoded[i]) for i in indices)
        ids = np.full((len(indices), width), pad, dtype=np.int64)
        mask = np.zeros_like(ids)
        for j, i in enumerate(indices):
            ids[j, :len(encoded[i])] = encoded[i]
            mask[j, :len(encoded[i])] = 1
        logits = session.run(["logits"], {"input_ids": ids, "attention_mask": mask})[0]
        if logits.shape != (len(indices), len(labels)) or not np.isfinite(logits).all():
            raise ValueError(f"{name}: invalid model logits")
        return softmax(logits)

    order = sorted(range(len(rows)), key=lambda i: len(encoded[i]))
    probabilities = np.zeros((len(rows), len(labels)), dtype=float)
    t0 = time.perf_counter()
    # Persist after each arm, so one interrupted arm cannot destroy other scores.
    for offset in range(0, len(order), batch_size):
        indices = order[offset:offset+batch_size]
        probabilities[indices] = forward(indices)
        if offset % (batch_size * 32) == 0:
            print(f"{name}: {min(offset+batch_size, len(order))}/{len(order)} ({time.perf_counter()-t0:.1f}s)", flush=True)
    throughput_seconds = time.perf_counter()-t0
    probe = np.linspace(0, len(order)-1, min(latency_samples, len(order)), dtype=int)
    probe = [order[int(i)] for i in probe]
    for i in probe[:3]:
        forward([i]); forward([i], fixed=True)
    fixed_ms, dynamic_ms = [], []
    max_delta, flips, batch_flips = 0.0, 0, 0
    batch_decisions = decisions(probabilities, labels, lengths, calibration)
    padding_gate_flips = {mode: 0 for mode in batch_decisions}
    batching_gate_flips = {mode: 0 for mode in batch_decisions}
    for j, i in enumerate(probe):
        result = {}
        for fixed in ((False, True) if j % 2 == 0 else (True, False)):
            started = time.perf_counter()
            result[fixed] = forward([i], fixed=fixed)[0]
            (fixed_ms if fixed else dynamic_ms).append((time.perf_counter()-started)*1000)
        max_delta = max(max_delta, float(np.max(np.abs(result[False]-result[True]))))
        flips += int(np.argmax(result[False]) != np.argmax(result[True]))
        batch_flips += int(np.argmax(result[False]) != np.argmax(probabilities[i]))
        dynamic_gate = decisions([result[False]], labels, [lengths[i]], calibration)
        fixed_gate = decisions([result[True]], labels, [lengths[i]], calibration)
        for mode in batch_decisions:
            padding_gate_flips[mode] += int(dynamic_gate[mode][0] != fixed_gate[mode][0])
            batching_gate_flips[mode] += int(dynamic_gate[mode][0] != batch_decisions[mode][i])
    data = {"identity": identity, "model_bytes": model.stat().st_size, "calibration": calibration,
            "probabilities": probabilities.tolist(), "content_lengths": lengths, "unknown_tokens": unknown,
            "scoring": {"batch_size": batch_size, "threads": threads, "seconds": throughput_seconds,
                        "note": "Batch throughput; not per-request latency."},
            "latency": {"fixed256": percentile(fixed_ms), "dynamic": percentile(dynamic_ms),
                        "measured_at_utc": datetime.now(timezone.utc).isoformat(), "runtime": runtime,
                        "padding_argmax_flips": flips, "batch_argmax_flips": batch_flips,
                        "padding_decision_flips": padding_gate_flips, "batching_decision_flips": batching_gate_flips,
                        "max_padding_probability_delta": max_delta,
                        "note": "CPU batch-one ONNX inference/feed allocation only; length-stratified diagnostic, concurrent host activity possible."}}
    temp = cache.with_suffix(".tmp")
    temp.write_text(json.dumps(data), encoding="utf-8")
    temp.replace(cache)
    del session
    gc.collect()
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/v18-comparison")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--latency-samples", type=int, default=40)
    parser.add_argument("--candidate-dir", type=Path, help="Optional trained student to compare with all three frozen baselines")
    args = parser.parse_args()
    if min(args.batch_size, args.threads, args.latency_samples) < 1:
        parser.error("batch-size, threads and latency-samples must be positive")
    rows = read_rows(args.rows)
    args.out.mkdir(parents=True, exist_ok=True)
    truth = np.array([r["label"] != "SAFE" for r in rows])
    report = {"rows": len(rows), "rows_file_sha256": sha(args.rows), "hardware": platform.platform(),
              "settings": {"binary_entropy_budget": .4, "confidence_floor": .5, "attack_probability_floor": .85,
                           "max_length": 256, "reliable_labels": sorted(RELIABLE)},
              "limitations": ["ML only: rules and semantic veto are excluded; these are not product recall/FPR.",
                              "Diagnostic development set; no threshold is calibrated here; not independent release evidence.",
                              "Source/family correlation limits row-level Wilson intervals; unknown language is not relabeled English.",
                              "Legacy score caches are not reused. Tokenization uses exported HF tokenizer and terminal SEP."],
              "arms": {}, "paired": {}}
    arms = dict(ARMS)
    if args.candidate_dir:
        arms["v18-candidate"] = str(args.candidate_dir)
    flags_by_arm = {}
    for name, directory in arms.items():
        data = run_arm(name, directory, rows, args.out, args.batch_size, args.threads, args.latency_samples)
        flags = decisions(data["probabilities"], data["identity"]["labels"], data["content_lengths"], data["calibration"])
        flags_by_arm[name] = flags
        summary = {k: data[k] for k in ("identity", "model_bytes", "scoring", "latency")}
        summary["metrics"] = {mode: metrics(truth, f) for mode, f in flags.items()}
        summary["truncated_rows"] = sum(n > 254 for n in data["content_lengths"])
        summary["unknown_token_rate"] = sum(data["unknown_tokens"]) / max(1, sum(data["content_lengths"]))
        summary["slices"] = {}
        for field, getter in (("language", lambda r:r.get("language") or r.get("lang") or "unknown"),
                              ("label", lambda r:r["label"]),
                              ("source", lambda r:r.get("_src") or r.get("_v18", {}).get("source_file") or r.get("source") or "unknown")):
            values = [getter(r) for r in rows]
            summary["slices"][field] = {}
            for value in sorted(set(values)):
                ix = np.array([i for i, v in enumerate(values) if v == value])
                summary["slices"][field][value] = metrics(truth[ix], flags["shared_input_gate"][ix])
                if field == "language":
                    token_count = sum(data["content_lengths"][int(i)] for i in ix)
                    unknown_count = sum(data["unknown_tokens"][int(i)] for i in ix)
                    summary["slices"][field][value].update({"content_tokens": token_count, "unknown_tokens": unknown_count,
                                                          "unknown_token_rate": unknown_count/max(1, token_count)})
        report["arms"][name] = summary
        (args.out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(name, json.dumps(summary["metrics"]), flush=True)
    names = list(arms)
    for i, a in enumerate(names):
        for b in names[i+1:]:
            report["paired"][f"{a}_vs_{b}"] = {}
            for mode in flags_by_arm[a]:
                af, bf = flags_by_arm[a][mode], flags_by_arm[b][mode]
                report["paired"][f"{a}_vs_{b}"][mode] = {
                    "attack_a_only": int((truth & af & ~bf).sum()), "attack_b_only": int((truth & bf & ~af).sum()),
                    "benign_a_only_flag": int((~truth & af & ~bf).sum()), "benign_b_only_flag": int((~truth & bf & ~af).sum())}
    (args.out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Complete: {args.out / 'report.json'}", flush=True)


if __name__ == "__main__":
    main()
