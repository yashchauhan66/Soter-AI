#!/usr/bin/env python3
"""Compare measured Node runtime probability summaries with existing Python scores.

No model loading or inference. The Node report stores four-decimal confidence and
attack probability, not full distributions: this establishes summary/argmax/token
parity within that rounding precision, not exact full-probability equality.

Run: python scripts/ml/verify-v18-runtime-cache-parity.py
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARMS = {"v14": "v14", "v17-multilingual": "v17-multilingual", "v18-student": "v18-candidate"}


def sha(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(file):
    return json.loads(Path(file).read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", default="artifacts/ml/v18-runtime-verification-2026-09-20.json")
    parser.add_argument("--cache", default="artifacts/ml/v18-candidate-comparison")
    parser.add_argument("--out", default="artifacts/ml/v18-runtime-cache-parity-2026-09-20.json")
    args = parser.parse_args()
    runtime_path, cache_dir, out = [ROOT / value for value in (args.runtime, args.cache, args.out)]
    runtime = read(runtime_path)
    if runtime["status"] != "complete":
        raise ValueError("Runtime measurement is incomplete")
    rows_path = ROOT / runtime["sampling"]["source"]
    if sha(rows_path) != runtime["sampling"]["source_sha256"]:
        raise ValueError("Runtime source rows changed")
    rows = [json.loads(line) for line in rows_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    canonical_rows_sha = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    report = {"measured_at_utc": datetime.now(timezone.utc).isoformat(), "status": "pass",
              "runtime_report": str(runtime_path.relative_to(ROOT)), "runtime_sha256": sha(runtime_path),
              "script_sha256": sha(__file__), "runtime": runtime["runtime"],
              "scope": "Rounded confidence/attack-probability, argmax-label and content-token-count parity; no new inference",
              "tolerance": 0.0000501, "arms": {},
              "limitations": ["The Node report retains four-decimal summaries, not full probability vectors.",
                              "Python scores use batch 16 with two threads; Node measurements use batch one with one thread.",
                              "Parity does not measure end-to-end guard behavior or satisfy the model trust gate."]}
    probe_by_id = {p["id"]: p for p in runtime["sampling"]["probes"]}
    for arm_name, cache_name in ARMS.items():
        arm = runtime["arms"][arm_name]
        cache_path = cache_dir / f"{cache_name}-scores.json"
        cache = read(cache_path)
        identity = cache["identity"]
        if identity["rows_sha256"] != canonical_rows_sha or len(cache["probabilities"]) != len(rows):
            raise ValueError(f"{arm_name}: Python cache rows differ")
        for cache_key, artifact_key in [("model_sha256", "model.onnx"),
                                        ("tokenizer_sha256", "tokenizer_config/tokenizer.json"),
                                        ("calibration_sha256", "calibration.json")]:
            if identity[cache_key] != arm["artifact_sha256"][artifact_key]:
                raise ValueError(f"{arm_name}: {artifact_key} differs between runtimes")
        if identity["max_length"] != arm["max_length"]["value"]:
            raise ValueError(f"{arm_name}: max length differs")
        labels = identity["labels"]
        if list(read(ROOT / arm["directory"] / "labels.json").values()) != labels:
            raise ValueError(f"{arm_name}: label order differs")
        safe = labels.index("SAFE")
        comparisons = []
        for measurement in arm["measurements"]:
            probe = probe_by_id[measurement["id"]]
            index = probe["source_line"] - 1
            if hashlib.sha256(rows[index]["text"].encode()).hexdigest() != probe["text_sha256"]:
                raise ValueError(f"{arm_name}: row mapping changed")
            native = measurement["dynamic"]
            probs = cache["probabilities"][index]
            confidence, attack_probability = max(probs), 1 - probs[safe]
            label = labels[max(range(len(probs)), key=probs.__getitem__)]
            confidence_delta = abs(native["confidence"] - confidence)
            attack_delta = abs(native["attackProbability"] - attack_probability)
            token_match = native["contentTokens"] == cache["content_lengths"][index]
            matches = (native["rawLabel"] == label and token_match and
                       confidence_delta <= report["tolerance"] and attack_delta <= report["tolerance"])
            comparisons.append({"id": probe["id"], "matches": matches,
                                "argmax_label_matches": native["rawLabel"] == label,
                                "content_token_count_matches": token_match,
                                "confidence_absolute_delta": confidence_delta,
                                "attack_probability_absolute_delta": attack_delta})
        report["arms"][arm_name] = {"python_cache": str(cache_path.relative_to(ROOT)),
                                   "python_cache_sha256": sha(cache_path), "python_identity": identity,
                                   "samples": len(comparisons), "mismatches": sum(not c["matches"] for c in comparisons),
                                   "max_confidence_absolute_delta": max(c["confidence_absolute_delta"] for c in comparisons),
                                   "max_attack_probability_absolute_delta": max(c["attack_probability_absolute_delta"] for c in comparisons),
                                   "comparisons": comparisons}
    if any(arm["mismatches"] for arm in report["arms"].values()):
        report["status"] = "mismatch"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({name: {key: value for key, value in arm.items() if key in
                            {"samples", "mismatches", "max_confidence_absolute_delta", "max_attack_probability_absolute_delta"}}
                      for name, arm in report["arms"].items()}, indent=2))
    print(f"Saved {out.relative_to(ROOT)}")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
