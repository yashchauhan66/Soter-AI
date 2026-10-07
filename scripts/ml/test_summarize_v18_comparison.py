"""Small score-only regressions; no model runtime or model weights needed."""
import importlib.util
import hashlib
import itertools
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("v18_summary", Path(__file__).with_name("summarize-v18-comparison.py"))
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)


class SummaryTests(unittest.TestCase):
    def test_exact_discordant_pair_counts(self):
        result = summary.paired_flags([True] * 6, [False] * 6)
        self.assertEqual(result["a_only_flagged"], 6)
        self.assertEqual(result["b_only_flagged"], 0)
        self.assertEqual(result["exact_mcnemar_pvalue_two_sided"], .03125)
        self.assertEqual(summary.paired_flags([True], [True])["exact_mcnemar_pvalue_two_sided"], 1)
        self.assertIsNone(summary.paired_flags([], [])["exact_mcnemar_pvalue_two_sided"])

    def test_matched_fpr_does_not_split_tied_scores(self):
        scorer = summary.scorer_module()
        result = summary.roc_diagnostic([True, True, False, False], [.9, .8, .8, .1], scorer.metrics)
        self.assertEqual(result["auc"], .875)
        for point in result["matched_fpr_descriptive"].values():
            self.assertEqual(point["threshold"], .9)
            self.assertEqual(point["tp"], 1)
            self.assertEqual(point["fp"], 0)
            self.assertEqual(point["recall"], .5)
        json.dumps(result, allow_nan=False)

    def test_no_finite_threshold_is_explicit_and_single_class_auc_is_undefined(self):
        scorer = summary.scorer_module()
        result = summary.roc_diagnostic([True, False], [.5, .5], scorer.metrics)
        self.assertEqual(result["auc"], .5)
        for point in result["matched_fpr_descriptive"].values():
            self.assertTrue(point["flag_none"])
            self.assertIsNone(point["threshold"])
            self.assertEqual(point["fp"], 0)
        self.assertIsNone(summary.roc_diagnostic([True], [.9], scorer.metrics)["auc"])

    def test_unknown_language_is_not_counted_as_english_or_non_english(self):
        slices = summary.language_slices([{"language": x} for x in ["en", "en-IN", "hi", "hinglish", "mixed", "unknown"]])
        self.assertEqual(int(slices["english"].sum()), 2)
        self.assertEqual(int(slices["non_english"].sum()), 3)
        self.assertEqual(int(slices["unknown"].sum()), 1)

    def test_incomplete_three_arm_reports_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing arms"):
            summary.require_complete({"arms": {"v14": {}, "v17-minilm": {}}})
        with self.assertRaisesRegex(ValueError, "missing paired"):
            summary.require_complete({"arms": {name: {} for name in summary.ARMS}, "paired": {}})

    def test_candidate_cannot_be_silently_omitted_or_partially_analyzed(self):
        with self.assertRaisesRegex(ValueError, "missing arms.*v18-candidate"):
            summary.require_complete({"arms": {name: {} for name in summary.ARMS}}, require_candidate=True)
        report = {"arms": {name: {} for name in (*summary.ARMS, summary.CANDIDATE)}, "paired": {
            f"{a}_vs_{b}": {mode: {} for mode in summary.MODES}
            for a, b in itertools.combinations(summary.ARMS, 2)}}
        with self.assertRaisesRegex(ValueError, "missing paired.*v18-candidate"):
            summary.require_complete(report)
        report["arms"]["unrecognized-model"] = {}
        with self.assertRaisesRegex(ValueError, "Unsupported comparison arms"):
            summary.require_complete(report)

    def test_completed_local_four_arm_comparison_is_fully_recomputed(self):
        directory = ROOT / "artifacts/ml/v18-candidate-comparison"
        if not (directory / "v18-candidate-scores.json").is_file():
            self.skipTest("local candidate diagnostic score cache not present")
        result = summary.analyze(directory, ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl", require_candidate=True)
        self.assertEqual(len(result["arms"]), 4)
        self.assertEqual(len(result["paired_common_points"]), 6)
        candidate = result["arms"][summary.CANDIDATE]
        metrics = candidate["slices"]["overall"]["common_points"]["shared_input_gate"]
        self.assertEqual(len(candidate["error_row_indices"]["shared_input_gate_false_negatives"]), metrics["fn"])
        self.assertEqual(len(candidate["error_row_indices"]["shared_input_gate_false_positives"]), metrics["fp"])
        json.dumps(result, allow_nan=False)

    def test_existing_first_two_caches_reproduce_reported_counts(self):
        directory = ROOT / "artifacts/ml/v18-balanced-comparison"
        if not (directory / "v17-minilm-scores.json").is_file():
            self.skipTest("local diagnostic score caches not present")
        scorer = summary.scorer_module()
        report = json.loads((directory / "report.json").read_text(encoding="utf-8"))
        rows = scorer.read_rows(ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl")
        truth = [row["label"] != "SAFE" for row in rows]
        for name in summary.ARMS[:2]:
            data = json.loads((directory / f"{name}-scores.json").read_text(encoding="utf-8"))
            flags = scorer.decisions(data["probabilities"], data["identity"]["labels"], data["content_lengths"], data["calibration"])
            for mode in summary.MODES:
                observed = scorer.metrics(truth, flags[mode])
                for count in ("attacks", "benign", "tp", "fn", "fp", "tn"):
                    self.assertEqual(observed[count], report["arms"][name]["metrics"][mode][count])

    def test_complete_mock_pipeline_and_stale_cache_rejection(self):
        scorer = summary.scorer_module()
        arms = (*summary.ARMS, summary.CANDIDATE)
        rows = [{"text": str(i), "label": "SAFE" if i % 2 == 0 else "PROMPT_INJECTION",
                 "language": "en" if i < 2 else "hi"} for i in range(4)]
        truth = summary.np.array([False, True, False, True])
        row_hash = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        report = {"rows": 4, "arms": {}, "paired": {}, "settings": {
            "binary_entropy_budget": .4, "confidence_floor": .5, "attack_probability_floor": .85,
            "max_length": 256, "reliable_labels": sorted(scorer.RELIABLE)}}
        flags = {}
        with tempfile.TemporaryDirectory(prefix="v18-summary-") as directory:
            directory = Path(directory)
            rows_path = directory / "rows.jsonl"
            rows_path.write_text("\n".join(json.dumps(r) for r in rows), encoding="utf-8")
            report["rows_file_sha256"] = summary.file_hash(rows_path)
            for name, attacks in zip(arms, ([.1, .9, .2, .8], [.2, .8, .1, .9], [.1, .95, .05, .9], [.4, .7, .1, .95])):
                data = {"identity": {"labels": ["SAFE", "PROMPT_INJECTION"], "rows_sha256": row_hash},
                        "probabilities": [[1-p, p] for p in attacks], "content_lengths": [20] * 4,
                        "calibration": {"ood": {}}}
                flags[name] = scorer.decisions(data["probabilities"], data["identity"]["labels"], [20] * 4, data["calibration"])
                report["arms"][name] = {"identity": data["identity"], "metrics": {
                    mode: scorer.metrics(truth, flags[name][mode]) for mode in summary.MODES}}
                (directory / f"{name}-scores.json").write_text(json.dumps(data), encoding="utf-8")
            for a, b in itertools.combinations(arms, 2):
                report["paired"][f"{a}_vs_{b}"] = {}
                for mode in summary.MODES:
                    af, bf = flags[a][mode], flags[b][mode]
                    report["paired"][f"{a}_vs_{b}"][mode] = {
                        "attack_a_only": int((truth & af & ~bf).sum()), "attack_b_only": int((truth & ~af & bf).sum()),
                        "benign_a_only_flag": int((~truth & af & ~bf).sum()), "benign_b_only_flag": int((~truth & ~af & bf).sum())}
            (directory / "report.json").write_text(json.dumps(report), encoding="utf-8")
            result = summary.analyze(directory, rows_path, expected_rows=4, require_candidate=True)
            self.assertEqual(len(result["arms"]), 4)
            self.assertEqual(len(result["paired_common_points"]), 6)
            self.assertIn("v17-multilingual_vs_v18-candidate", result["paired_common_points"])
            json.dumps(result, allow_nan=False)
            baseline_report = {**report, "arms": {k: v for k, v in report["arms"].items() if k in summary.ARMS},
                               "paired": {k: v for k, v in report["paired"].items() if summary.CANDIDATE not in k}}
            (directory / "report.json").write_text(json.dumps(baseline_report), encoding="utf-8")
            result = summary.analyze(directory, rows_path, expected_rows=4)
            self.assertEqual(len(result["arms"]), 3)
            self.assertEqual(len(result["paired_common_points"]), 3)
            self.assertEqual(result["slice_rows"], {"overall": 4, "english": 2, "non_english": 2, "unknown": 0})
            json.dumps(result, allow_nan=False)
            cache_path = directory / "v14-scores.json"
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            cache["identity"]["rows_sha256"] = "stale"
            cache_path.write_text(json.dumps(cache), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "cache identity"):
                summary.analyze(directory, rows_path, expected_rows=4)


if __name__ == "__main__":
    unittest.main()
