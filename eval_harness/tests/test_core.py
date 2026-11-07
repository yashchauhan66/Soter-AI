"""Deterministic tests for the evaluation contract; no model/network operations."""
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
CORE = ROOT / "eval_harness/core.py"

def load_core(test):
    test.assertTrue(CORE.is_file(), "Evaluation core implementation is missing")
    spec = importlib.util.spec_from_file_location("soter_eval_core_tests", CORE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module

class CaseTests(unittest.TestCase):
    def row(self):
        return {"id":"fixture.1","text":"Summarize  this note.","label":"SAFE",
                "target":"risk","gold_positive":False,"language":"en",
                "source":"unit-fixture","source_id":"row.1","license":"internal-test-only",
                "group_id":"fixture.family.1","slices":["benign_hard_negative"]}
    def test_invalid_case_metadata_is_rejected_without_coercion(self):
        core = load_core(self)
        variants = (("id", ""), ("text", ""), ("label", "safe"),
                    ("target", "untyped"), ("gold_positive", "false"),
                    ("slices", []), ("slices", "direct_injection"),
                    ("group_id", None), ("language", None))
        for field, value in variants:
            with self.subTest(field=field, value=value):
                row = self.row()
                row[field] = value
                with self.assertRaisesRegex(ValueError, "invalid case"):
                    core.Case.from_dict(row)

    def test_valid_case_preserves_exact_source_text_and_truth(self):
        core = load_core(self)
        row = self.row()
        case = core.Case.from_dict(row)
        self.assertEqual(case.text, row["text"])
        self.assertEqual(case.id, row["id"])
        self.assertIs(case.gold_positive, False)
        self.assertEqual(case.slices, ("benign_hard_negative",))
        self.assertEqual(case.group_id, "fixture.family.1")

class MetricTests(unittest.TestCase):
    def test_empty_metrics_identify_the_coverage_gap(self):
        core = load_core(self)
        result = core.binary_metrics([], [])
        self.assertIn("support_status", result, "Empty metrics need an explicit empty_slice status")
        self.assertEqual(result["support_status"], "empty_slice")
        self.assertEqual(result["n"], 0)
        for name in ("precision", "recall", "f1", "fpr", "fnr", "average_precision", "pr_auc_trapezoidal", "ece"):
            self.assertIsNone(result[name])
            self.assertEqual(result["undefined_reasons"][name], "empty_slice")

    def test_invalid_metric_inputs_are_rejected_without_coercion(self):
        core = load_core(self)
        good_y, good_p = [False, True], [0.1, 0.9]
        variants = (([False, True], [0.1], {}),
                    ([False, True], [[0.1, 0.9]], {}),
                    (["false", "true"], good_p, {}), ([0, 2], good_p, {}),
                    (good_y, ["0.1", "0.9"], {}),
                    (good_y, [float("nan"), 0.9], {}),
                    (good_y, [float("inf"), 0.9], {}),
                    (good_y, [-0.1, 0.9], {}), (good_y, [0.1, 1.1], {}),
                    (good_y, good_p, {"threshold": 1.1}),
                    (good_y, good_p, {"threshold": float("nan")}),
                    (good_y, good_p, {"threshold": True}),
                    (good_y, good_p, {"n_bins": 0}),
                    (good_y, good_p, {"n_bins": 3.5}),
                    (good_y, good_p, {"n_bins": True}))
        for truth, scores, options in variants:
            with self.subTest(truth=truth, scores=scores, options=options):
                with self.assertRaisesRegex(ValueError, "invalid metrics"):
                    core.binary_metrics(truth, scores, **options)

    def test_one_class_metrics_use_null_for_unidentifiable_rates(self):
        core = load_core(self)
        import warnings
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            try:
                negatives = core.binary_metrics([False, False], [0.1, 0.3])
                positives = core.binary_metrics([True, True], [0.8, 0.2])
            except (ZeroDivisionError, ValueError) as error:
                self.fail(f"Zero support must return null, not crash: {error}")
        self.assertEqual(caught, [])
        for key in ("recall", "fnr", "average_precision", "pr_auc_trapezoidal", "ece"):
            self.assertIsNone(negatives[key])
        for key in ("fpr", "average_precision", "pr_auc_trapezoidal", "ece"):
            self.assertIsNone(positives[key])
        self.assertEqual(negatives["undefined_reasons"]["recall"], "no_positive_support")
        self.assertEqual(positives["undefined_reasons"]["fpr"], "no_negative_support")

    def test_binary_metrics_match_independent_reference(self):
        import numpy as np
        from sklearn.metrics import precision_score, recall_score, f1_score
        from sklearn.metrics import average_precision_score, precision_recall_curve, auc
        core = load_core(self)
        self.assertTrue(hasattr(core, "binary_metrics"), "Binary metrics implementation is missing")
        truth = np.array([False, True, False, True, True, False])
        scores = np.array([0.05, 0.8, 0.6, 0.1, 0.9, 0.3])
        flags = scores >= 0.5
        result = core.binary_metrics(truth, scores)
        self.assertEqual(result["tp"], int((truth & flags).sum()))
        self.assertEqual(result["fp"], int((~truth & flags).sum()))
        self.assertEqual(result["fn"], int((truth & ~flags).sum()))
        self.assertEqual(result["tn"], int((~truth & ~flags).sum()))
        self.assertAlmostEqual(result["precision"], precision_score(truth, flags))
        self.assertAlmostEqual(result["recall"], recall_score(truth, flags))
        self.assertAlmostEqual(result["f1"], f1_score(truth, flags))
        self.assertAlmostEqual(result["fpr"], int((~truth & flags).sum()) / int((~truth).sum()))
        self.assertAlmostEqual(result["fnr"], int((truth & ~flags).sum()) / int(truth.sum()))
        self.assertAlmostEqual(result["average_precision"], average_precision_score(truth, scores))
        precision, recall, _ = precision_recall_curve(truth, scores)
        self.assertAlmostEqual(result["pr_auc_trapezoidal"], auc(recall, precision))
        # Independent decimal arithmetic avoids overlapping float lo+width edges.
        from decimal import Decimal, ROUND_FLOOR
        memberships = np.array([min(int((Decimal(str(float(value))) * 10)
            .to_integral_value(rounding=ROUND_FLOOR)), 9) for value in scores])
        masks = [memberships == index for index in range(10)]
        self.assertTrue(np.array_equal(np.array(masks).sum(axis=0), np.ones(len(scores))))
        expected_ece = sum(float(mask.mean()) * abs(float(truth[mask].mean() - scores[mask].mean()))
                           for mask in masks if mask.any())
        self.assertAlmostEqual(result["ece"], expected_ece)

class SourceContractTests(unittest.TestCase):
    def rich_row(self):
        row = CaseTests().row()
        row.update({
            "text": "Synthetic ID ZZ-000 twice: ZZ-000.\nDo not alter whitespace.",
            "label": "PII", "target": "policy", "gold_positive": False,
            "source_version": "fixture/v01 ", "source_label": "raw.Source-PII",
            "provenance": {"status": "declared", "origin": {"name": "synthetic", "checks": ["authored"]}},
            "license_status": "declared", "source_family": "synthetic.Fam-A ",
            "template_family": "template/001", "parent_id": "parent. 01",
            "variant_id": "variant.01", "near_duplicate_group": "dupe. 01",
            "family_metadata_trusted": True,
            "turns": [{"role": "system", "text": "Synthetic trusted instruction."},
                      {"role": "user", "text": "ZZ-000\r\n ZZ-000"}],
            "risk_positive": True, "injection_positive": False, "policy_positive": False,
            "policy_direction": "input",
            "trusted_policy_exceptions": [{"kind": "literal", "value": "ZZ-000", "authority": "synthetic-test-policy"}],
            "expected_effective_findings": [], "expected_action": "ALLOW",
            "expected_text": "Synthetic ID ZZ-000 twice: ZZ-000.\nDo not alter whitespace.",
            "text_assertions": [{"kind": "preserve", "value": "ZZ-000", "occurrences": 2}],
            "extensions": {"synthetic-note": {"tags": ["unit-only", "not-release"]}},
        })
        return row

    def test_source_policy_roundtrip_is_deeply_immutable(self):
        core = load_core(self)
        row = self.rich_row()
        case = core.Case.from_dict(row)
        self.assertTrue(hasattr(case, "to_dict"), "Source/policy metadata must round-trip, not silently disappear")
        saved = case.to_dict()
        for field, value in row.items():
            with self.subTest(field=field):
                self.assertEqual(saved[field], value)
        self.assertEqual([turn.role for turn in case.turns], ["system", "user"])
        row["turns"][1]["text"] = "caller changed it"
        row["provenance"]["origin"]["checks"].append("caller changed it")
        row["trusted_policy_exceptions"][0]["value"] = "caller changed it"
        saved["extensions"]["synthetic-note"]["tags"].append("output changed it")
        self.assertNotIn("caller changed it", repr(case.to_dict()))
        self.assertNotIn("output changed it", repr(case.to_dict()))
        with self.assertRaises((AttributeError, TypeError)):
            case.turns[0].text = "mutation"
        with self.assertRaises(TypeError):
            case.provenance["origin"]["new"] = "mutation"
        with self.assertRaises(TypeError):
            case.extensions["synthetic-note"]["tags"][0] = "mutation"
        restored = core.Case.from_dict(case.to_dict())
        self.assertEqual(restored.to_dict(), case.to_dict())


    def test_metadata_schema_rejects_coercion_and_unrecognized_fields(self):
        core = load_core(self)
        variants = (
            ("unexpected_metadata", "must not be silently dropped"),
            ("source_version", 1), ("source_label", []), ("source_family", ""),
            ("template_family", True), ("parent_id", 4), ("variant_id", False),
            ("near_duplicate_group", ["a"]), ("family_metadata_trusted", "true"),
            ("license_status", "VERIFIED"), ("provenance", ["not-an-object"]),
            ("risk_positive", "true"), ("injection_positive", 0), ("policy_positive", True),
            ("policy_direction", 1), ("expected_action", False), ("expected_text", 123),
            ("turns", [{"role": "user", "text": "synthetic", "dropped": "no"}]),
            ("trusted_policy_exceptions", [{"kind": "literal", "value": "ZZ-000"}]),
            ("expected_effective_findings", [{"type": "PII", "start": True, "end": 5}]),
            ("text_assertions", [{"kind": "preserve", "value": "ZZ-000", "occurrences": True}]),
            ("extensions", {"bad-number": float("nan")}),
            ("slices", ["robustness", "robustness"]),
        )
        for field, value in variants:
            with self.subTest(field=field, value=value):
                row = self.rich_row()
                row[field] = value
                with self.assertRaisesRegex(ValueError, "invalid case"):
                    core.Case.from_dict(row)
        row = self.rich_row()
        row["risk_positive"] = "true"
        with self.assertRaisesRegex(ValueError, "invalid case"):
            core.Case(**row)
        exact = self.rich_row()
        exact["source_label"] = " source.PII  "
        self.assertEqual(core.Case.from_dict(exact).source_label, " source.PII  ")


    def test_missing_metadata_is_unknown_without_flattening_turns(self):
        core = load_core(self)
        row = CaseTests().row()
        for field in ("language", "source", "source_id", "license", "group_id", "text"):
            del row[field]
        row["turns"] = [{"role": "user", "text": "Synthetic\r\nordered note."}]
        try:
            case = core.Case.from_dict(row)
        except ValueError as error:
            self.fail(f"Absent metadata must be an explicit gap, not invented or discarded: {error}")
        self.assertIsNone(case.text, "No synthetic flattened text may replace original turns")
        for field in ("language", "source", "source_id", "license", "group_id"):
            self.assertEqual(getattr(case, field), "unknown")
        for field in ("source_version", "source_label", "provenance", "source_family", "template_family"):
            self.assertIsNone(getattr(case, field))
        self.assertTrue(hasattr(case, "coverage_gaps"), "Missing lineage needs explicit coverage gaps")
        self.assertTrue({"language", "source", "source_id", "license", "source_version", "source_label", "provenance", "family_metadata"} <= set(case.coverage_gaps))
        restored = core.Case.from_dict(case.to_dict())
        self.assertEqual(restored.coverage_gaps, case.coverage_gaps)
        self.assertEqual(restored.turns[0].text, "Synthetic\r\nordered note.")
        without_text = CaseTests().row()
        del without_text["text"]
        with self.assertRaisesRegex(ValueError, "invalid case"):
            core.Case.from_dict(without_text)


    def test_authorized_policy_pair_never_changes_content_truth(self):
        core = load_core(self)
        allowed_row = self.rich_row()
        blocked_row = self.rich_row()
        blocked_row.update({"id": "fixture.unapproved", "gold_positive": True, "policy_positive": True,
                            "trusted_policy_exceptions": [], "expected_action": "REDACT",
                            "expected_text": allowed_row["text"].replace("ZZ-000", "[REDACTED]"),
                            "expected_effective_findings": [{"type": "PII", "value": "ZZ-000"}],
                            "text_assertions": [{"kind": "redact", "value": "ZZ-000"}]})
        allowed, blocked = core.Case.from_dict(allowed_row), core.Case.from_dict(blocked_row)
        self.assertTrue(hasattr(allowed, "truth_for"), "Risk, injection and effective policy truth need separate access")
        self.assertEqual((allowed.text, allowed.label, allowed.source_label), (blocked.text, blocked.label, blocked.source_label))
        for case in (allowed, blocked):
            self.assertIs(case.truth_for("risk"), True)
            self.assertIs(case.truth_for("injection"), False)
        self.assertIs(allowed.truth_for("policy"), False)
        self.assertIs(blocked.truth_for("policy"), True)
        legacy = core.Case.from_dict(CaseTests().row())
        self.assertIs(legacy.truth_for("risk"), False)
        self.assertIsNone(legacy.truth_for("policy"), "Do not infer effective policy truth from content labels")
        self.assertIsNone(legacy.truth_for("injection"))
        with self.assertRaisesRegex(ValueError, "invalid case"):
            legacy.truth_for("Policy")


    def test_effective_policy_assertions_detect_incomplete_redaction(self):
        core = load_core(self)
        self.assertTrue(hasattr(core, "check_policy_assertions"), "Policy expectations must be executable assertions")
        allowed = core.Case.from_dict(self.rich_row())
        result = core.check_policy_assertions(allowed, effective_findings=[], action="ALLOW", text=allowed.expected_text)
        self.assertTrue(result["passed"])
        self.assertEqual(result["mismatches"], [])
        self.assertIs(result["release_ready"], False)
        for actual in ({"effective_findings": [{"type": "PROMPT_INJECTION"}], "action": "ALLOW", "text": allowed.text},
                       {"effective_findings": [], "action": "BLOCK", "text": allowed.text},
                       {"effective_findings": [], "action": "ALLOW", "text": allowed.text.replace("ZZ-000", "[REDACTED]", 1)}):
            with self.subTest(actual=actual):
                self.assertFalse(core.check_policy_assertions(allowed, **actual)["passed"])
        row = self.rich_row()
        row.update({"gold_positive": True, "policy_positive": True, "trusted_policy_exceptions": [],
                    "expected_action": "REDACT", "expected_effective_findings": [{"type": "PII", "value": "ZZ-000"}],
                    "expected_text": row["text"].replace("ZZ-000", "[REDACTED]"),
                    "text_assertions": [{"kind": "redact", "value": "ZZ-000"}]})
        repeated = core.Case.from_dict(row)
        kwargs = {"effective_findings": [{"type": "PII", "value": "ZZ-000"}], "action": "REDACT"}
        self.assertTrue(core.check_policy_assertions(repeated, text=repeated.expected_text, **kwargs)["passed"])
        incomplete = core.check_policy_assertions(repeated, text=repeated.text.replace("ZZ-000", "[REDACTED]", 1), **kwargs)
        self.assertFalse(incomplete["passed"])
        self.assertIn("text_assertion.0", incomplete["mismatches"])
        missing = self.rich_row()
        missing.pop("expected_action")
        with self.assertRaisesRegex(ValueError, "unknown policy expectations"):
            core.check_policy_assertions(core.Case.from_dict(missing), effective_findings=[], action="ALLOW", text=allowed.text)


    def test_effective_findings_compare_extension_json_types_exactly(self):
        import copy
        core = load_core(self)
        row = self.rich_row()
        row["expected_effective_findings"] = [{"type": "PII", "advisory": True, "extensions": {"review_marker": 1}}]
        case = core.Case.from_dict(row)
        observed = copy.deepcopy(row["expected_effective_findings"])
        observed[0]["extensions"]["review_marker"] = True
        result = core.check_policy_assertions(case, effective_findings=observed, action="ALLOW", text=case.expected_text)
        self.assertFalse(result["passed"], "JSON boolean true must not silently equal expected numeric metadata 1")
        self.assertIn("effective_findings", result["mismatches"])
        correct = core.check_policy_assertions(case, effective_findings=row["expected_effective_findings"], action="ALLOW", text=case.expected_text)
        self.assertTrue(correct["passed"])
        self.assertIs(type(case.expected_effective_findings[0]["extensions"]["review_marker"]), int)
        self.assertFalse(correct["release_ready"])


class CoverageAggregationTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.scratch = Path("C:/Users/USER/AppData/Local/hermes/cache/scratch")
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), self.scratch.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-core-coverage-synthetic-", dir=self.scratch))
        print("SYNTHETIC_COVERAGE_FIXTURE_ROOT=" + str(self.work))

    def cases(self, core):
        rows = []
        definitions = (("aggregate.en.neg", "en", False, ["direct_injection", "benign_hard_negative", "robustness"]),
                       ("aggregate.en.pos", "en", True, ["direct_injection", "rare_recall", "robustness"]),
                       ("aggregate.hi.neg", "hi", False, ["multilingual_code_mixed", "benign_hard_negative"]),
                       ("aggregate.es.pos", "es", True, ["rare_recall"]))
        for identifier, language, positive, slices in definitions:
            row = CaseTests().row()
            row.update({"id": identifier, "text": "Synthetic distinct fixture " + identifier,
                        "language": language, "gold_positive": positive, "label": "PROMPT_INJECTION" if positive else "SAFE", "slices": slices})
            rows.append(row)
        return tuple(core.Case.from_dict(row) for row in rows)

    def score_fixture(self, core, cases, scores, reasons=None, target="risk"):
        import json
        row = {"case_ids": [case.id for case in cases], "scores": scores,
               "missing_reasons": reasons if reasons is not None else [None] * len(scores),
               "target": target, "model_identity": "synthetic-probability-fixture/not-a-model-run",
               "dataset_sha256": core.cases_fingerprint(cases), "score_contract": "target_probability/v1"}
        path = self.work / "synthetic-score-batch.json"
        with path.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(row, handle, ensure_ascii=False, allow_nan=False)
        return core.ScoreBatch.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def test_all_required_slices_and_declared_languages_retain_support(self):
        import json
        core = load_core(self)
        self.assertTrue(hasattr(core, "aggregate_metrics"), "Coverage aggregation must execute across ALL required slices")
        cases = self.cases(core)
        batch = self.score_fixture(core, cases, [0.1, 0.7, 0.2, 0.9])
        result = core.aggregate_metrics(cases, batch, target="risk", threshold=0.8,
                                        declared_languages=["hi", "en", "fr", "es"], expected_model_identity=batch.model_identity)
        self.assertEqual(tuple(result["slices"]), core.REQUIRED_SLICES)
        self.assertEqual(len(result["slices"]), 11)
        self.assertEqual(tuple(result["languages"]), ("hi", "en", "fr", "es"))
        self.assertEqual(result["ordered_ids"], [case.id for case in cases])
        self.assertEqual(result["dataset_sha256"], core.cases_fingerprint(cases))
        self.assertEqual(result["score_batch_sha256"], batch.sha256)
        self.assertEqual(result["target"], "risk")
        self.assertEqual(result["threshold"], 0.8)
        expected = core.binary_metrics([case.gold_positive for case in cases], batch.scores, threshold=0.8)
        for name in ("n", "tp", "fp", "tn", "fn", "fpr", "fnr", "precision", "recall", "ece", "average_precision", "pr_auc_trapezoidal"):
            self.assertEqual(result["overall"][name], expected[name])
        self.assertEqual(result["slices"]["direct_injection"]["support_status"], "both_classes")
        self.assertEqual(result["slices"]["rare_recall"]["support_status"], "one_class")
        self.assertIsNone(result["slices"]["rare_recall"]["fpr"])
        self.assertEqual(result["slices"]["rare_recall"]["undefined_reasons"]["fpr"], "no_negative_support")
        for name in ("precision", "recall", "f1", "fpr", "fnr", "average_precision", "pr_auc_trapezoidal", "ece"):
            self.assertIsNone(result["slices"]["indirect_injection"][name])
            self.assertEqual(result["slices"]["indirect_injection"]["undefined_reasons"][name], "empty_slice")
        self.assertEqual(result["languages"]["hi"]["overall"]["negatives"], 1)
        self.assertEqual(result["languages"]["en"]["overall"]["support_status"], "both_classes")
        self.assertEqual(result["languages"]["fr"]["overall"]["support_status"], "empty_slice")
        for language in result["languages"]:
            self.assertEqual(tuple(result["languages"][language]["slices"]), core.REQUIRED_SLICES)
        self.assertEqual(result["overall"]["n"], len(cases), "Multi-slice memberships must not double-count the overall cohort")
        self.assertFalse(result["coverage_complete"])
        self.assertFalse(result["release_ready"])
        report_path = self.work / "synthetic-coverage-report.json"
        report_path.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
        self.assertEqual(len(json.loads(report_path.read_text(encoding="utf-8"))["slices"]), 11)
        print("COVERAGE_REPORT_FIXTURE=" + str(report_path))

    def test_unknown_truth_and_unsupported_scores_are_explicit_coverage_gaps(self):
        core = load_core(self)
        allowed_row = SourceContractTests().rich_row()
        blocked_row = SourceContractTests().rich_row()
        blocked_row.update({"id": "aggregate.policy.blocked", "gold_positive": True, "policy_positive": True,
                            "trusted_policy_exceptions": [], "expected_action": "REDACT"})
        cases = (core.Case.from_dict(allowed_row), core.Case.from_dict(blocked_row), self.cases(core)[2])
        try:
            batch = self.score_fixture(core, cases, [0.1, None, 0.9],
                                       reasons=[None, "synthetic fixture unsupported target", None], target="policy")
        except ValueError as error:
            self.fail(f"Explicit null-with-reason scores must remain diagnostic coverage gaps, not fabricated predictions: {error}")
        result = core.aggregate_metrics(cases, batch, target="policy", threshold=0.5,
                                        declared_languages=["en", "hi", "fr"], expected_model_identity=batch.model_identity)
        coverage = result["overall"]["coverage"]
        self.assertEqual(coverage["case_count"], len(cases))
        self.assertEqual(coverage["evaluated_count"], 1)
        self.assertEqual(coverage["target_known_count"], 2)
        self.assertEqual(coverage["scored_count"], 2)
        self.assertEqual(coverage["missing_truth_ids"], [cases[2].id])
        self.assertEqual(coverage["missing_score_ids"], [cases[1].id])
        self.assertEqual(coverage["missing_score_reasons"], {cases[1].id: "synthetic fixture unsupported target"})
        self.assertEqual(coverage["declared_positive_cases"], 1)
        self.assertEqual(coverage["declared_negative_cases"], 1)
        self.assertEqual(coverage["status"], "incomplete")
        self.assertEqual(result["overall"]["n"], 1)
        self.assertEqual(result["overall"]["positives"], 0, "An unsupported positive cannot create a confusion-matrix row")
        self.assertEqual(result["overall"]["case_ids"], [case.id for case in cases])
        self.assertEqual(result["overall"]["evaluated_case_ids"], [cases[0].id])
        self.assertEqual(result["languages"]["hi"]["overall"]["n"], 0)
        self.assertEqual(result["languages"]["hi"]["overall"]["undefined_reasons"]["ece"], "no_evaluable_cases")
        self.assertEqual(result["languages"]["fr"]["overall"]["undefined_reasons"]["ece"], "empty_slice")
        self.assertEqual(tuple(result["slices"]), core.REQUIRED_SLICES)
        self.assertFalse(result["coverage_complete"])
        self.assertFalse(result["release_ready"])
        self.assertIsNone(batch.scores[1])
        self.assertIs(cases[0].truth_for("risk"), True)
        self.assertIs(cases[0].truth_for("injection"), False)
        self.assertIs(cases[0].truth_for("policy"), False)
        self.assertIs(cases[1].truth_for("policy"), True)
        self.assertEqual((cases[0].text, cases[0].label, cases[0].source_label), (cases[1].text, cases[1].label, cases[1].source_label))

    def test_score_batch_validation_and_identity_alignment_fail_closed(self):
        import copy
        import operator
        core = load_core(self)
        cases = self.cases(core)
        batch = self.score_fixture(core, cases, [0.1, 0.7, 0.2, 0.9])
        original = batch.to_dict()
        variants = []
        for score in (True, "0.5", [], {}, float("nan"), float("inf"), -0.1, 1.1, 10 ** 1000):
            row = copy.deepcopy(original)
            row["scores"][0] = score
            variants.append(row)
        for changes in ({"case_ids": [case.id for case in cases[:1]]}, {"case_ids": [cases[0].id] * len(cases)},
                        {"case_ids": [1] * len(cases)}, {"dataset_sha256": original["dataset_sha256"].upper()},
                        {"model_identity": 1}, {"target": "Risk"}, {"score_contract": "maximum_unrelated_confidence"},
                        {"unknown_field": "not silently dropped"}, {"missing_reasons": ["not missing", None, None, None]}):
            row = copy.deepcopy(original)
            row.update(changes)
            variants.append(row)
        for index, row in enumerate(variants):
            with self.subTest(invalid_batch=index):
                try:
                    with self.assertRaisesRegex(ValueError, "invalid score batch"):
                        core.ScoreBatch.from_dict(row)
                except (OverflowError, TypeError) as error:
                    self.fail(f"Malformed numeric/metadata types need explicit validation, not leaked conversion failures: {error}")
        for reason in (None, "", " ", True, ["unsupported"]):
            with self.subTest(invalid_missing_reason=reason):
                row = copy.deepcopy(original)
                row["scores"][0], row["missing_reasons"][0] = None, reason
                with self.assertRaisesRegex(ValueError, "invalid score batch"):
                    core.ScoreBatch.from_dict(row)
        def aggregate(cohort, scored=batch, **overrides):
            arguments = {"target": "risk", "threshold": 0.5, "declared_languages": ["en", "hi", "es"],
                         "expected_model_identity": batch.model_identity}
            arguments.update(overrides)
            return core.aggregate_metrics(cohort, scored, **arguments)
        with self.assertRaisesRegex(ValueError, "identity|order|alignment"):
            aggregate(tuple(reversed(cases)))
        for field, value in (("case_ids", list(reversed(original["case_ids"]))), ("dataset_sha256", "0" * 64)):
            row = copy.deepcopy(original)
            row[field] = value
            with self.assertRaisesRegex(ValueError, "identity|order|alignment"):
                aggregate(cases, core.ScoreBatch.from_dict(row))
        for overrides in ({"target": "policy"}, {"expected_model_identity": "wrong-fixture"},
                          {"declared_languages": ["en", "en"]}, {"declared_languages": "en"},
                          {"threshold": "0.5"}, {"threshold": True}, {"n_bins": True}):
            with self.subTest(invalid_settings=overrides), self.assertRaises(ValueError):
                aggregate(cases, **overrides)
        changed = cases[0].to_dict()
        changed["trusted_policy_exceptions"] = [{"kind": "literal", "value": "synthetic value", "authority": "trusted-test-owner"}]
        with self.assertRaisesRegex(ValueError, "identity|order|alignment"):
            aggregate((core.Case.from_dict(changed), *cases[1:]))
        self.assertEqual(core.Case.from_dict(changed).text, cases[0].text, "Policy-only changes still change case identity, never raw text")
        caller = copy.deepcopy(original)
        detached = core.ScoreBatch.from_dict(caller)
        caller["scores"][0] = 1.0
        caller["case_ids"].reverse()
        detached.to_dict()["scores"][0] = 0.0
        self.assertEqual(detached.to_dict(), original)
        with self.assertRaises((AttributeError, TypeError)):
            setattr(detached, "scores", ())  # noqa: B010 -- Exercise the frozen setter without narrowing the later tuple type to tuple[()].
        with self.assertRaises(TypeError):
            operator.setitem(detached.scores, 0, 0.0)

    def test_undeclared_and_unknown_languages_are_reported_without_dropping_rows(self):
        core = load_core(self)
        unknown = CaseTests().row()
        unknown.update({"id": "aggregate.unknown-language", "language": "unknown",
                        "text": "Synthetic language-unspecified fixture", "slices": ["benign_hard_negative", "multilingual_code_mixed"]})
        cases = (*self.cases(core), core.Case.from_dict(unknown))
        batch = self.score_fixture(core, cases, [0.1, 0.7, 0.2, 0.9, 0.1])
        result = core.aggregate_metrics(cases, batch, target="risk", threshold=0.5,
                                        declared_languages=["en", "hi", "fr"], expected_model_identity=batch.model_identity)
        self.assertIn("additional_language_metrics", result,
                      "Observed undeclared languages must be explicit reports, not silently dropped from the declared-language matrix")
        self.assertEqual(tuple(result["languages"]), ("en", "hi", "fr"))
        self.assertEqual(result["additional_languages"], ["es", "unknown"])
        self.assertEqual(result["undeclared_language_ids"], [cases[3].id, cases[4].id])
        self.assertEqual(tuple(result["additional_language_metrics"]), ("es", "unknown"))
        self.assertEqual(result["additional_language_metrics"]["es"]["overall"]["positives"], 1)
        self.assertEqual(result["additional_language_metrics"]["unknown"]["overall"]["negatives"], 1)
        for report in result["additional_language_metrics"].values():
            self.assertEqual(tuple(report["slices"]), core.REQUIRED_SLICES)
        self.assertIn("language", result["metadata_gaps_by_id"][cases[4].id])
        self.assertEqual(result["overall"]["n"], len(cases))
        self.assertEqual(cases[4].language, "unknown")
        self.assertFalse(result["coverage_complete"])
        self.assertFalse(result["release_ready"])




class CaseUnicodeStringTests(unittest.TestCase):
    def test_case_factories_reject_surrogate_source_text(self):
        import hashlib
        import json

        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            for invalid_text in ("Synthetic isolated \ud800 text", "Synthetic isolated \udfff text"):
                row = CaseTests().row()
                row["text"] = invalid_text
                with self.subTest(public_entry=entry, text=repr(invalid_text)), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                    if entry == "from_dict":
                        core.Case.from_dict(row)
                    else:
                        core.Case(**row)
        row = CaseTests().row()
        row["id"] = " exact.😀.id \r\n"
        row["text"] = " \x00 \ud7ff \ue000 \ufffd 😀 \U0010ffff cafe\u0301 \r\n "
        for case in (core.Case.from_dict(row), core.Case(**row)):
            self.assertEqual(case.id, row["id"])
            self.assertEqual(case.text, row["text"])
            canonical = json.dumps(case.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8") + b"\n"
            self.assertEqual(core.cases_fingerprint((case,)), hashlib.sha256(canonical).hexdigest())


class TurnUnicodeStringTests(unittest.TestCase):
    def test_turn_factories_reject_surrogate_role_or_text(self):
        core = load_core(self)
        for field, invalid in (("role", "tool.\ud800"), ("text", "Synthetic isolated \udc00 turn")):
            for entry in ("from_dict", "constructor"):
                row = {"role": "tool", "text": "Synthetic ordered turn."}
                row[field] = invalid
                with self.subTest(field=field, public_entry=entry), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                    if entry == "from_dict":
                        core.Turn.from_dict(row)
                    else:
                        core.Turn(**row)
        exact = {"role": " tool.😀 \r\n", "text": " Synthetic\x00 cafe\u0301 😀 \r\n "}
        for turn in (core.Turn.from_dict(exact), core.Turn(**exact)):
            self.assertEqual(turn.to_dict(), exact)
            row = CaseTests().row()
            row.update({"text": None, "turns": (turn,)})
            case = core.Case(**row)
            self.assertIsNone(case.text)
            self.assertEqual(case.to_dict()["turns"], [exact])
            self.assertEqual(len(core.cases_fingerprint((case,))), 64)
        empty = core.Turn("tool", "")
        self.assertEqual(empty.to_dict(), {"role": "tool", "text": ""})


class MetadataUnicodeValueTests(unittest.TestCase):
    def test_nested_metadata_values_reject_surrogates_at_public_entries(self):
        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            row = CaseTests().row()
            row["extensions"] = {"nested": [{"value": "Synthetic \ud800 metadata"}]}
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                if entry == "from_dict":
                    core.Case.from_dict(row)
                else:
                    core.Case(**row)
        policy = core.Case.from_dict(SourceContractTests().rich_row())
        observed = [{"type": "PII", "extensions": {"nested": [{"value": "Synthetic \udc00 observation"}]}}]
        with self.subTest(public_entry="observed_policy_findings"), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
            core.check_policy_assertions(policy, effective_findings=observed, action="ALLOW", text=policy.expected_text)
        row = CaseTests().row()
        exact = " Synthetic\x00 cafe\u0301 😀 \r\n "
        row["extensions"] = {"nested": [{"empty": "", "exact": exact, "types": [None, True, 1, 1.0]}]}
        case = core.Case.from_dict(row)
        self.assertEqual(case.to_dict()["extensions"], row["extensions"])
        self.assertEqual(case.extensions["nested"][0]["exact"], exact)
        self.assertIs(type(case.extensions["nested"][0]["types"][1]), bool)
        self.assertIs(type(case.extensions["nested"][0]["types"][2]), int)
        self.assertIs(type(case.extensions["nested"][0]["types"][3]), float)
        row["extensions"]["nested"][0]["exact"] = "caller changed"
        self.assertEqual(case.extensions["nested"][0]["exact"], exact)
        self.assertEqual(len(core.cases_fingerprint((case,))), 64)


class MetadataUnicodeKeyTests(unittest.TestCase):
    def test_nested_mapping_keys_reject_surrogates_at_public_entries(self):
        from types import MappingProxyType

        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            row = CaseTests().row()
            row["extensions"] = MappingProxyType({"nested": (MappingProxyType({"\ud800": "Synthetic metadata"}),)})
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                if entry == "from_dict":
                    core.Case.from_dict(row)
                else:
                    core.Case(**row)
        policy = core.Case.from_dict(SourceContractTests().rich_row())
        observed = [{"type": "PII", "extensions": {"nested": [{"\udfff": "Synthetic observation"}]}}]
        with self.subTest(public_entry="observed_policy_findings"), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
            core.check_policy_assertions(policy, effective_findings=observed, action="ALLOW", text=policy.expected_text)
        exact_key = " exact.cafe\u0301.😀 \r\n"
        row = CaseTests().row()
        row["extensions"] = MappingProxyType({"": (MappingProxyType({exact_key: "exact value"}),)})
        case = core.Case(**row)
        self.assertEqual(case.to_dict()["extensions"], {"": [{exact_key: "exact value"}]})
        self.assertEqual(tuple(case.extensions[""][0]), (exact_key,))
        self.assertEqual(len(core.cases_fingerprint((case,))), 64)
        with self.assertRaises(TypeError):
            case.extensions[""][0][exact_key] = "mutation"


class ScoreCaseIdUnicodeTests(unittest.TestCase):
    def row(self):
        return {"case_ids": ["synthetic.score.id"], "scores": [0.1], "missing_reasons": [None],
                "target": "risk", "model_identity": "synthetic-probability-fixture/no-model-inference",
                "dataset_sha256": "0" * 64, "score_contract": "target_probability/v1"}

    def test_score_batch_factories_reject_surrogate_case_ids(self):
        import hashlib
        import json

        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            row = self.row()
            row["case_ids"] = ["synthetic.score.\ud800"]
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "invalid score batch.*Unicode scalars"):
                if entry == "from_dict":
                    core.ScoreBatch.from_dict(row)
                else:
                    core.ScoreBatch(**row)
        row = self.row()
        row.update({"case_ids": [" exact.id.😀 \r\n", "exact.id.😀"], "scores": [0.1, 0.2], "missing_reasons": [None, None]})
        for batch in (core.ScoreBatch.from_dict(row), core.ScoreBatch(**row)):
            self.assertEqual(batch.to_dict(), row)
            canonical = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
            self.assertEqual(batch.sha256, hashlib.sha256(canonical).hexdigest())
        row.update({"case_ids": [], "scores": [], "missing_reasons": []})
        empty = core.ScoreBatch.from_dict(row)
        self.assertEqual(empty.case_ids, ())
        self.assertEqual(len(empty.sha256), 64)


class ScoreModelIdentityUnicodeTests(unittest.TestCase):
    def test_score_batch_factories_reject_surrogate_model_identity(self):
        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            row = ScoreCaseIdUnicodeTests().row()
            row["model_identity"] = "synthetic.model.\udfff"
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "invalid score batch.*Unicode scalars"):
                if entry == "from_dict":
                    core.ScoreBatch.from_dict(row)
                else:
                    core.ScoreBatch(**row)
        case = core.Case.from_dict(CaseTests().row())
        exact = " synthetic.model.😀 cafe\u0301 \r\n"
        row = ScoreCaseIdUnicodeTests().row()
        row.update({"case_ids": [case.id], "model_identity": exact, "dataset_sha256": core.cases_fingerprint((case,))})
        for batch in (core.ScoreBatch.from_dict(row), core.ScoreBatch(**row)):
            self.assertEqual(batch.model_identity, exact)
            self.assertEqual(batch.to_dict(), row)
            self.assertEqual(len(batch.sha256), 64)
            result = core.aggregate_metrics((case,), batch, target="risk", threshold=0.5,
                                            declared_languages=["en"], expected_model_identity=exact)
            self.assertEqual(result["model_identity"], exact)
            self.assertFalse(result["release_ready"])


class ScoreMissingReasonUnicodeTests(unittest.TestCase):
    def test_score_batch_factories_reject_surrogate_missing_reason(self):
        core = load_core(self)
        for entry in ("from_dict", "constructor"):
            row = ScoreCaseIdUnicodeTests().row()
            row.update({"scores": [None], "missing_reasons": ["Synthetic unsupported \ud800 target"]})
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "invalid score batch.*Unicode scalars"):
                if entry == "from_dict":
                    core.ScoreBatch.from_dict(row)
                else:
                    core.ScoreBatch(**row)
        case = core.Case.from_dict(CaseTests().row())
        exact = " synthetic unsupported 😀 cafe\u0301 \r\n"
        row = ScoreCaseIdUnicodeTests().row()
        row.update({"case_ids": [case.id], "scores": [None], "missing_reasons": [exact],
                    "dataset_sha256": core.cases_fingerprint((case,))})
        for batch in (core.ScoreBatch.from_dict(row), core.ScoreBatch(**row)):
            self.assertEqual(batch.to_dict(), row)
            self.assertEqual(batch.missing_reasons, (exact,))
            self.assertEqual(len(batch.sha256), 64)
            result = core.aggregate_metrics((case,), batch, target="risk", threshold=0.5,
                                            declared_languages=["en"], expected_model_identity=batch.model_identity)
            self.assertEqual(result["overall"]["coverage"]["missing_score_reasons"], {case.id: exact})
            self.assertEqual(result["overall"]["evaluated_case_ids"], [])
            self.assertFalse(result["release_ready"])


class CaseUnicodeFieldProbeTests(unittest.TestCase):
    def test_all_case_string_fields_reject_scalars_without_source_repair(self):
        core = load_core(self)
        fields = ("id", "text", "label", "target", "language", "source", "source_id", "license", "group_id",
                  "source_version", "source_label", "license_status", "source_family", "template_family",
                  "parent_id", "variant_id", "near_duplicate_group", "policy_direction", "expected_action", "expected_text")
        for field in fields:
            for entry in ("from_dict", "constructor"):
                row = CaseTests().row()
                row[field] = "Synthetic invalid \udfff scalar"
                with self.subTest(field=field, public_entry=entry), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                    if entry == "from_dict":
                        core.Case.from_dict(row)
                    else:
                        core.Case(**row)
        row = CaseTests().row()
        flexible = tuple(field for field in fields if field not in ("label", "target", "license_status"))
        for field in flexible:
            row[field] = field + " exact.😀 cafe\u0301 \x00 \r\n"
        for case in (core.Case.from_dict(row), core.Case(**row)):
            for field in flexible:
                self.assertEqual(getattr(case, field), row[field])
                self.assertEqual(case.to_dict()[field], row[field])
            self.assertEqual(len(core.cases_fingerprint((case,))), 64)
        for entry in ("from_dict", "constructor"):
            row = CaseTests().row()
            row.update({"text": None, "turns": [{"role": "tool", "text": "Synthetic \ud800 turn"}]})
            with self.subTest(public_entry=entry, field="turns"), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                if entry == "from_dict":
                    core.Case.from_dict(row)
                else:
                    core.Case(**row)
        row = CaseTests().row()
        row.update({"provenance": {}, "extensions": {}})
        self.assertEqual(core.Case.from_dict(row).to_dict()["extensions"], {})


class PolicyUnicodeEntryProbeTests(unittest.TestCase):
    def test_policy_assertion_strings_reject_scalars_and_preserve_valid_unicode(self):
        import copy

        core = load_core(self)
        row = SourceContractTests().rich_row()
        exact = " Synthetic\x00 😀 cafe\u0301 exact policy text.\r\n "
        row.update({"expected_action": " ALLOW.😀 \r\n", "expected_text": exact,
                    "expected_effective_findings": [{"type": "PII", "value": "Synthetic 😀", "source": " exact.source.😀 ",
                                                     "action": " exact.advisory.😀 ", "advisory": True,
                                                     "extensions": {" nested.cafe\u0301.😀 ": [" exact.😀 "]}}],
                    "text_assertions": [{"kind": "equals", "value": exact}]})
        case = core.Case.from_dict(row)
        arguments = {"effective_findings": row["expected_effective_findings"], "action": row["expected_action"], "text": exact}
        self.assertTrue(core.check_policy_assertions(case, **arguments)["passed"])
        for field in ("action", "text"):
            changed = copy.deepcopy(arguments)
            changed[field] = "Synthetic \ud800 observation"
            with self.subTest(observed_field=field), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                core.check_policy_assertions(case, **changed)
        for field in ("type", "value", "source", "action"):
            changed = copy.deepcopy(arguments)
            changed["effective_findings"][0][field] = "Synthetic \udfff finding"
            with self.subTest(observed_finding_field=field), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                core.check_policy_assertions(case, **changed)
        records = (
            ("trusted_policy_exceptions", {"kind": "literal", "value": "ZZ-000", "authority": "synthetic-test-owner", "scope": "input", "entity_type": "PII"}),
            ("expected_effective_findings", {"type": "PII", "value": "ZZ-000", "source": "synthetic", "action": "REDACT"}),
            ("text_assertions", {"kind": "preserve", "value": "ZZ-000"}),
        )
        for name, template in records:
            for field in template:
                for entry in ("from_dict", "constructor"):
                    changed = SourceContractTests().rich_row()
                    changed[name] = [{**template, field: "Synthetic \udc00 expected value"}]
                    with self.subTest(expected_record=name, field=field, public_entry=entry), self.assertRaisesRegex(ValueError, "invalid case.*Unicode scalars"):
                        if entry == "from_dict":
                            core.Case.from_dict(changed)
                        else:
                            core.Case(**changed)
        result = core.check_policy_assertions(case, **arguments)
        self.assertTrue(result["passed"])
        self.assertFalse(result["release_ready"])
        self.assertEqual(case.expected_action, row["expected_action"])
        self.assertEqual(case.expected_text, exact)
        self.assertEqual(case.to_dict()["expected_effective_findings"], row["expected_effective_findings"])
        self.assertEqual(len(core.cases_fingerprint((case,))), 64)
        empty = SourceContractTests().rich_row()
        empty.update({"expected_text": "", "text_assertions": [{"kind": "equals", "value": ""}]})
        empty_case = core.Case.from_dict(empty)
        self.assertTrue(core.check_policy_assertions(empty_case, effective_findings=[], action="ALLOW", text="")["passed"])


class DeclaredLanguageScalarTests(unittest.TestCase):
    def test_declared_languages_reject_surrogates_without_changing_valid_reports(self):
        import json
        import tempfile

        core = load_core(self)
        exact = " en.\U0001f680 cafe\u0301 \r\n "
        row = CaseTests().row()
        row.update({"id": " synthetic.language.\U0001f680 ", "text": "Synthetic\x00 cafe\u0301 \U0001f680\r\n ",
                    "language": exact, "extensions": {"flag": True, "marker": 1}})
        cases = (core.Case.from_dict(row),)
        batch = core.ScoreBatch((cases[0].id,), (0.1,), (None,), "risk",
                                " synthetic-language-fixture/no-model-run.\U0001f680 ", core.cases_fingerprint(cases))
        before = json.dumps({"cases": [case.to_dict() for case in cases], "batch": batch.to_dict()},
                            ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
        invalid = [json.loads('"' + "\\u" + value + '"') for value in ("d800", "dbff", "dc00", "dfff")]
        invalid += ["synthetic." + value + ".language" for value in invalid]
        for language in invalid:
            for array_type in (list, tuple):
                languages = array_type((exact, language))
                with self.subTest(language=repr(language), array_type=array_type.__name__), self.assertRaisesRegex(ValueError, "invalid aggregation.*Unicode scalars"):
                    core.aggregate_metrics(cases, batch, target="risk", threshold=0.5,
                                           declared_languages=languages, expected_model_identity=batch.model_identity)
                self.assertEqual(languages, array_type((exact, language)))
        declared = [exact, "en", "unknown", "café", "cafe\u0301", "\x00\ud7ff\ue000\ufffd\U0010ffff"]
        work = Path(tempfile.mkdtemp(prefix="soter-core-cycle2-language-scalars-"))
        for array_type in (list, tuple):
            result = core.aggregate_metrics(cases, batch, target="risk", threshold=0.5,
                                            declared_languages=array_type(declared), expected_model_identity=batch.model_identity)
            self.assertEqual(result["declared_languages"], declared)
            self.assertEqual(list(result["languages"]), declared)
            self.assertTrue(all(type(language) is str for language in result["declared_languages"]))
            self.assertEqual(result["languages"][exact]["overall"]["case_ids"], [cases[0].id])
            self.assertEqual(result["overall"]["tn"], 1)
            self.assertEqual(result["dataset_sha256"], core.cases_fingerprint(cases))
            self.assertEqual(result["score_batch_sha256"], batch.sha256)
            self.assertEqual(result["model_identity"], batch.model_identity)
            self.assertIs(result["release_ready"], False)
            self.assertIs(cases[0].gold_positive, False)
            self.assertIs(type(cases[0].extensions["flag"]), bool)
            self.assertIs(type(cases[0].extensions["marker"]), int)
            payload = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8", errors="strict")
            report = work / (array_type.__name__ + ".json")
            report.write_bytes(payload)
            decoded = json.loads(report.read_bytes().decode("utf-8", errors="strict"))
            self.assertEqual(decoded["declared_languages"], declared)
            self.assertEqual(json.dumps(decoded, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8"), payload)
        after = json.dumps({"cases": [case.to_dict() for case in cases], "batch": batch.to_dict()},
                           ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.assertEqual(after, before)
        print("LANGUAGE_SCALAR_REPORT_FIXTURE=" + str(work))


class CoreDirectEntrypointTests(unittest.TestCase):
    def test_direct_script_executes_existing_late_regression(self):
        import hashlib
        import json
        import os
        import re
        import subprocess
        import sys
        import tempfile

        scratch = Path("C:/Users/USER/AppData/Local/hermes/cache/scratch")
        self.assertEqual(Path(tempfile.gettempdir()), scratch)
        self.assertEqual(Path.cwd(), ROOT)
        self.assertTrue(sys.dont_write_bytecode)
        environment_values = {"TMPDIR": str(scratch), "TMP": str(scratch), "TEMP": str(scratch),
                              "PYTHONDONTWRITEBYTECODE": "1", "HF_HUB_OFFLINE": "1",
                              "HUGGINGFACE_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
                              "HF_DATASETS_OFFLINE": "1", "PIP_NO_INDEX": "1",
                              "WANDB_MODE": "offline", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
                              "PYTHONPATH": str(ROOT), "PYTHONIOENCODING": "utf-8"}
        environment = dict(os.environ, **environment_values)
        files = ("eval_harness/core.py", "eval_harness/data.py",
                 "eval_harness/tests/test_core.py", "eval_harness/tests/test_data.py")
        source4 = {}
        for name in files:
            raw = (ROOT / name).read_bytes()
            source4[name] = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
        argv = [sys.executable, "-B", str(Path(__file__).resolve()), "-k", "CaseUnicodeStringTests"]
        work = Path(tempfile.mkdtemp(prefix="soter-core-cycle2-guard-probe-", dir=scratch))
        invocation = {"argv": argv, "cwd": str(ROOT), "environment": environment_values,
                      "source4_before": source4, "synthetic_only": True,
                      "expected_ids": ["eval_harness/tests/test_core.py::CaseUnicodeStringTests::test_case_factories_reject_surrogate_source_text"]}
        (work / "invocation.json").write_text(json.dumps(invocation, sort_keys=True, indent=2), encoding="utf-8")
        completed = subprocess.run(argv, cwd=ROOT, env=environment, capture_output=True, timeout=120, check=False)
        (work / "stdout.bin").write_bytes(completed.stdout)
        (work / "stderr.bin").write_bytes(completed.stderr)
        text = (completed.stdout + b"\n" + completed.stderr).decode("utf-8", errors="strict")
        ran = re.findall(r"^Ran (\d+) tests? in ", text, re.MULTILINE)
        passed_lines = re.findall(r"^(test_\w+) \(__main__\.(\w+)\.[^)]+\) \.\.\. ok\r?$", text, re.MULTILINE)
        passed = sorted("eval_harness/tests/test_core.py::" + cls + "::" + method for method, cls in passed_lines)
        result = {"native_exit": completed.returncode, "ran_counts": ran, "passed_ids": passed,
                  "stdout_sha256": hashlib.sha256(completed.stdout).hexdigest(),
                  "stderr_sha256": hashlib.sha256(completed.stderr).hexdigest(),
                  "stdout_bytes": len(completed.stdout), "stderr_bytes": len(completed.stderr),
                  "ok_outcome": bool(re.search(r"^OK\r?$", text, re.MULTILINE)),
                  "skips": bool(re.search(r"\.\.\. skipped|OK \(skipped=", text))}
        (work / "result.json").write_text(json.dumps(result, sort_keys=True, indent=2), encoding="utf-8")
        print("CORE_GUARD_PROBE_EVIDENCE=" + str(work))
        self.assertEqual(completed.returncode, 0, text)
        self.assertEqual(passed, invocation["expected_ids"],
                         "direct core entrypoint must execute the existing late regression")
        self.assertEqual(ran, ["1"], text)
        self.assertTrue(result["ok_outcome"], text)
        self.assertFalse(result["skips"], text)


class HundredBinECERegressionTests(unittest.TestCase):
    def test_reviewed_decimal_boundary_uses_separate_bins(self):
        core = load_core(self)
        result = core.binary_metrics([True, False], [0.289, 0.29], n_bins=100)
        self.assertAlmostEqual(result["ece"], 0.5005, places=15)




class MixedBooleanProbabilityRegressionTests(unittest.TestCase):
    def test_mixed_boolean_numeric_scores_are_rejected(self):
        core = load_core(self)
        with self.assertRaisesRegex(ValueError, "invalid metrics.*scores"):
            core.binary_metrics([False, True], [False, 0.9])




class CoreMetricsPostFixControlTests(unittest.TestCase):
    """Already-green post-fix controls, not additional RED/GREEN claims."""

    def setUp(self):
        import tempfile

        scratch = Path("C:/Users/USER/AppData/Local/hermes/cache/scratch")
        self.assertEqual(Path(tempfile.gettempdir()), scratch)
        self.assertEqual(Path.cwd(), ROOT)
        self.assertTrue(sys.dont_write_bytecode)
        self.work = Path(tempfile.mkdtemp(prefix="soter-core-metrics-post-fix-", dir=scratch))
        print("CORE_METRICS_POST_FIX_SYNTHETIC_ROOT=" + str(self.work))

    def observed_memberships(self, core, truth, scores, n_bins, threshold=0.5):
        import numpy as np

        captured = {}
        code = core.binary_metrics.__code__

        def capture(frame, event, _arg):
            if frame.f_code is code:
                if event == "return" and "bins" in frame.f_locals:
                    captured["bins"] = np.array(frame.f_locals["bins"], copy=True)
                return capture
            return None

        previous = sys.gettrace()
        try:
            sys.settrace(capture)
            result = core.binary_metrics(truth, scores, threshold=threshold, n_bins=n_bins)
        finally:
            sys.settrace(previous)
        self.assertIn("bins", captured, "Observe actual production membership, not just reference masks")
        return result, captured["bins"]

    def test_all_admitted_ece_bins_match_frozen_decimal_reference(self):
        import json
        from decimal import ROUND_FLOOR, Decimal

        import numpy as np

        core = load_core(self)
        report_path = self.work / "all-admitted-ece-bins.jsonl"
        with report_path.open("x", encoding="utf-8", newline="\n") as report:
            for n_bins in range(1, 1001):
                indices = {1, n_bins // 2, n_bins * 29 // 100, n_bins - 1}
                boundaries = [float(Decimal(index) / n_bins) for index in sorted(indices)
                              if 0 < index < n_bins]
                boundaries += [0.0, 0.1, 0.289, 0.29, 0.58, 1.0]
                values = {0.0, 1.0}
                for boundary in boundaries:
                    for value in (float(np.nextafter(boundary, -np.inf)), boundary,
                                  float(np.nextafter(boundary, np.inf))):
                        if 0 <= value <= 1:
                            values.add(value)
                scores = np.array(sorted(values), dtype=float)
                truth = np.array([index % 2 == 0 for index in range(len(scores))], dtype=bool)
                reference = np.array([min(int((Decimal(str(float(value))) * n_bins)
                    .to_integral_value(rounding=ROUND_FLOOR)), n_bins - 1) for value in scores])
                result, observed = self.observed_memberships(core, truth, scores, n_bins)
                with self.subTest(n_bins=n_bins):
                    self.assertTrue(np.array_equal(observed, reference),
                                    "Each decimal-string boundary and neighboring float must keep its declared bin")
                    masks = [observed == index for index in range(n_bins)]
                    memberships = np.array(masks).sum(axis=0)
                    self.assertTrue(np.array_equal(memberships, np.ones(len(scores))))
                    reference_masks = [reference == index for index in range(n_bins)]
                    expected_ece = sum(float(mask.mean()) * abs(float(truth[mask].mean() - scores[mask].mean()))
                                       for mask in reference_masks if mask.any())
                    self.assertAlmostEqual(result["ece"], expected_ece, places=15)
                    self.assertEqual(result["ece_bins"], n_bins)
                    self.assertEqual(result["threshold"], 0.5)
                    self.assertEqual(result["n"], len(scores))
                    self.assertEqual(result["positives"], int(truth.sum()))
                    self.assertEqual(result["negatives"], int((~truth).sum()))
                    self.assertEqual(result["support_status"], "both_classes")
                    self.assertEqual(result["tp"] + result["fp"] + result["fn"] + result["tn"], len(scores))
                report.write(json.dumps({"label": "already-green post-fix control", "n_bins": n_bins,
                                         "scores": scores.tolist(), "truth": truth.tolist(),
                                         "observed_bins": observed.tolist(), "frozen_reference_bins": reference.tolist(),
                                         "membership_counts": memberships.tolist(), "reference_ece": expected_ece,
                                         "actual_metrics": result}, sort_keys=True, allow_nan=False) + "\n")
        rows = [json.loads(line) for line in report_path.read_text(encoding="utf-8").splitlines()]
        self.assertEqual([row["n_bins"] for row in rows], list(range(1, 1001)))
        self.assertTrue(all(row["observed_bins"] == row["frozen_reference_bins"] for row in rows))
        print("POST_FIX_ECE_BIN_CONTROLS=" + str(len(rows)))

    def test_observable_probability_types_preserve_numeric_admission_and_provenance_limit(self):
        import json

        import numpy as np

        core = load_core(self)
        truth = [False, True]
        invalid = (
            ("python_false_float", [False, 0.9]),
            ("python_float_true", [0.1, True]),
            ("python_false_integer", [False, 1]),
            ("python_integer_true", [0, True]),
            ("python_all_booleans", [False, True]),
            ("tuple_boolean_float", (0.1, True)),
            ("numpy_false_mixed_list", [np.bool_(False), 0.9]),
            ("numpy_true_mixed_tuple", (0.1, np.bool_(True))),
            ("numpy_all_boolean_array", np.array([False, True], dtype=np.bool_)),
            ("object_dtype_python_boolean", np.array([False, 0.9], dtype=object)),
            ("object_dtype_numpy_boolean", np.array([0.1, np.bool_(True)], dtype=object)),
        )
        observations = []
        for name, scores in invalid:
            observed_types = [type(value).__name__ for value in np.asarray(scores, dtype=object).flat]
            with self.subTest(control=name), self.assertRaisesRegex(ValueError, "invalid metrics.*scores"):
                core.binary_metrics(truth, scores)
            observations.append({"control": name, "raw_observable_element_types": observed_types,
                                 "boolean_probability_rejected": True})
        numeric_object = np.array([0.125, 0.875], dtype=object)
        with self.assertRaisesRegex(ValueError, "invalid metrics.*scores"):
            core.binary_metrics(truth, numeric_object)
        observations.append({"control": "numeric_object_dtype_remains_unadmitted", "rejected": True})
        valid = (
            ("integer_list", [0, 1]), ("integer_tuple", (0, 1)),
            ("numpy_int32", np.array([0, 1], dtype=np.int32)),
            ("numpy_uint64", np.array([0, 1], dtype=np.uint64)),
            ("finite_float_list", [0.125, 0.875]), ("finite_float_tuple", (0.125, 0.875)),
            ("numpy_float16", np.array([0.125, 0.875], dtype=np.float16)),
            ("numpy_float32", np.array([0.125, 0.875], dtype=np.float32)),
            ("numpy_float64", np.array([0.125, 0.875], dtype=np.float64)),
        )
        for name, scores in valid:
            plain = np.asarray(scores).astype(float).tolist()
            reference = core.binary_metrics(truth, plain, n_bins=100)
            for labels in (truth, [0, 1], np.array([False, True]), np.array([0, 1], dtype=np.int8)):
                with self.subTest(control=name, truth_type=type(labels).__name__):
                    result = core.binary_metrics(labels, scores, n_bins=np.int64(100))
                    self.assertEqual(result, reference)
                    self.assertEqual((result["tp"], result["tn"], result["fp"], result["fn"]), (1, 1, 0, 0))
                    for key in ("precision", "recall", "f1", "average_precision", "pr_auc_trapezoidal"):
                        self.assertEqual(result[key], 1.0)
                    self.assertEqual((result["fpr"], result["fnr"]), (0.0, 0.0))
                    self.assertEqual(result["undefined_reasons"], {})
            observations.append({"control": name, "valid_integer_or_finite_float_admitted": True,
                                 "plain_numeric_scores": plain, "metrics": reference})
        # A plain numeric ndarray has already lost any original boolean provenance.
        # Its observable values remain admitted; this API cannot recover erased types.
        pre_coerced = (np.asarray([False, 0.9], dtype=float),
                       np.asarray([np.bool_(True), 0.1], dtype=np.float32))
        for scores in pre_coerced:
            result = core.binary_metrics(truth, scores)
            plain = scores.astype(float).tolist()
            self.assertEqual(result, core.binary_metrics(truth, plain))
            self.assertTrue(all(not isinstance(value, (bool, np.bool_))
                                for value in np.asarray(scores, dtype=object).flat))
            observations.append({"control": "pre_coerced_numeric_array_provenance_limit",
                                 "observable_dtype": str(scores.dtype), "plain_numeric_scores": plain,
                                 "admitted": True, "original_boolean_provenance_recoverable": False,
                                 "metrics": result})
        payload = json.dumps({"label": "already-green post-fix controls", "observations": observations},
                             sort_keys=True, allow_nan=False).encode("utf-8")
        path = self.work / "observable-probability-types.json"
        path.write_bytes(payload)
        self.assertEqual(path.read_bytes(), payload)

    def test_endpoints_and_undefined_support_keep_existing_semantics(self):
        import json
        import warnings

        import numpy as np

        core = load_core(self)
        observations = []
        for n_bins in (1, 2, 10, 100, 1000):
            for threshold in (0.0, 0.5, 1.0):
                with self.subTest(n_bins=n_bins, threshold=threshold):
                    result, bins = self.observed_memberships(core, [False, True], [0.0, 1.0], n_bins, threshold)
                    self.assertEqual(bins.tolist(), [0, n_bins - 1])
                    masks = np.array([bins == index for index in range(n_bins)])
                    self.assertTrue(np.array_equal(masks.sum(axis=0), [1, 1]))
                    self.assertEqual(result["ece"], 0.0)
                    self.assertEqual((result["n"], result["positives"], result["negatives"]), (2, 1, 1))
                    self.assertEqual((result["threshold"], result["ece_bins"]), (threshold, n_bins))
                    observations.append({"control": "endpoint_one_membership", "bins": bins.tolist(), "metrics": result})
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                empty = core.binary_metrics([], [], n_bins=n_bins)
                negatives = core.binary_metrics([False, False], [0.0, 1.0], n_bins=n_bins)
                positives = core.binary_metrics([True, True], [0.0, 1.0], n_bins=n_bins)
            self.assertEqual(caught, [])
            self.assertEqual(empty["support_status"], "empty_slice")
            self.assertEqual(empty["n"], 0)
            for key in ("precision", "recall", "f1", "fpr", "fnr", "average_precision", "pr_auc_trapezoidal", "ece"):
                self.assertIsNone(empty[key])
                self.assertEqual(empty["undefined_reasons"][key], "empty_slice")
            self.assertEqual(negatives["support_status"], "one_class")
            self.assertEqual(positives["support_status"], "one_class")
            for result in (negatives, positives):
                for key in ("average_precision", "pr_auc_trapezoidal", "ece"):
                    self.assertIsNone(result[key])
                    self.assertEqual(result["undefined_reasons"][key], "both_classes_required_for_comparable_target_metrics")
            self.assertIsNone(negatives["recall"])
            self.assertIsNone(negatives["fnr"])
            self.assertIsNone(positives["fpr"])
            self.assertEqual(negatives["undefined_reasons"]["recall"], "no_positive_support")
            self.assertEqual(positives["undefined_reasons"]["fpr"], "no_negative_support")
            observations.append({"control": "undefined_support", "n_bins": n_bins,
                                 "empty": empty, "negatives": negatives, "positives": positives})
        path = self.work / "endpoints-and-support.json"
        path.write_text(json.dumps({"label": "already-green post-fix controls", "observations": observations},
                                   sort_keys=True, allow_nan=False), encoding="utf-8")
        self.assertEqual(len(json.loads(path.read_bytes())["observations"]), 20)

    def test_aggregate_and_captured_seal_use_reviewed_hundred_bin_reference(self):
        import hashlib
        import importlib
        import json

        core = importlib.import_module("eval_harness.core")
        data = importlib.import_module("eval_harness.data")
        rows = []
        for identifier, positive in (("metrics100.positive", True), ("metrics100.negative", False)):
            row = CaseTests().row()
            row.update({"id": identifier, "text": "Synthetic distinct core metric fixture " + identifier,
                        "gold_positive": positive, "label": "PROMPT_INJECTION" if positive else "SAFE",
                        "slices": list(core.REQUIRED_SLICES)})
            rows.append(row)
        source = b"".join(json.dumps(row, sort_keys=True, allow_nan=False).encode("utf-8") + b"\n" for row in rows)
        (self.work / "synthetic-source.jsonl").write_bytes(source)
        imported = data.import_jsonl_bytes(source)
        cases = imported.cases
        batch = core.ScoreBatch(tuple(case.id for case in cases), (0.289, 0.29), (None, None), "risk",
                                "synthetic-core-metrics/no-inference-no-guard", core.cases_fingerprint(cases))
        settings = {"target": "risk", "threshold": 0.5, "seed": 17,
                    "text_overlap_normalization": "NFKC-casefold-whitespace/v1",
                    "languages": ["en", "empty"], "ece_bins": 100}
        expected = core.binary_metrics([True, False], batch.scores, n_bins=100)
        self.assertAlmostEqual(expected["ece"], 0.5005, places=15)
        aggregate = core.aggregate_metrics(cases, batch, target="risk", threshold=0.5,
                                           declared_languages=settings["languages"],
                                           expected_model_identity=batch.model_identity, n_bins=100)
        sealed = data.seal_dataset(imported, self.work / "synthetic-seal", settings=settings)
        sealed_result = data.aggregate_sealed(sealed, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                              expected_settings=settings, expected_model_identity=batch.model_identity)
        for result in (aggregate, sealed_result):
            self.assertEqual(result["ece_bins"], 100)
            self.assertEqual(result["threshold"], 0.5)
            self.assertEqual(result["ordered_ids"], [case.id for case in cases])
            self.assertEqual(tuple(result["slices"]), core.REQUIRED_SLICES)
            cohorts = [result["overall"], *result["slices"].values(), result["languages"]["en"]["overall"]]
            for cohort in cohorts:
                for field, value in expected.items():
                    self.assertEqual(cohort[field], value)
                self.assertAlmostEqual(cohort["ece"], 0.5005, places=15)
                self.assertEqual(cohort["coverage"]["evaluated_count"], 2)
            self.assertEqual(result["languages"]["empty"]["overall"]["support_status"], "empty_slice")
            self.assertIsNone(result["languages"]["empty"]["overall"]["ece"])
            self.assertFalse(result["release_ready"])
        self.assertFalse(sealed_result["independence_established"])
        manifest_raw = (self.work / "synthetic-seal/manifest.json").read_bytes()
        self.assertEqual(sealed_result["seal"]["manifest_sha256"], hashlib.sha256(manifest_raw).hexdigest())
        self.assertEqual(sealed.source_dataset.raw_bytes, source)
        path = self.work / "hundred-bin-aggregation-controls.json"
        path.write_text(json.dumps({"label": "already-green post-fix controls", "aggregate": aggregate,
                                   "aggregate_sealed": sealed_result}, sort_keys=True, allow_nan=False), encoding="utf-8")
        decoded = json.loads(path.read_bytes())
        self.assertAlmostEqual(decoded["aggregate_sealed"]["overall"]["ece"], 0.5005, places=15)
        self.assertFalse(decoded["aggregate_sealed"]["release_ready"])




class CoreFourDecimalContextRegressionTests(unittest.TestCase):
    def test_ece_decimal_membership_ignores_ambient_context(self):
        from decimal import Inexact, localcontext

        core = load_core(self)
        for trap_inexact in (False, True):
            with localcontext() as context:
                context.prec = 2
                context.traps[Inexact] = trap_inexact
                try:
                    result = core.binary_metrics([True, False], [0.289, 0.29], n_bins=100)
                except Inexact as error:
                    self.fail(f"Valid decimal-string probabilities cannot depend on ambient Inexact traps: {error}")
            self.assertEqual(result["ece"], 0.5005000000000001)
            self.assertEqual(result["support_status"], "both_classes")
            self.assertEqual(result["ece_bins"], 100)




class CoreFourContextFreeECEControlTests(unittest.TestCase):
    """Post-GREEN exhaustive admitted-bin controls, not a new TDD claim."""

    @staticmethod
    def context_free_decimal_oracle(scores, n_bins):
        # Parse decimal-string digits/exponents with integers only. This oracle
        # deliberately does not use production's Fraction or Decimal operations.
        result = []
        for value in scores:
            mantissa, separator, exponent_text = str(float(value)).lower().partition("e")
            integer_part, point, fractional_part = mantissa.partition(".")
            numerator = int(integer_part + fractional_part)
            exponent = (int(exponent_text) if separator else 0) - (len(fractional_part) if point else 0)
            if exponent >= 0:
                numerator *= 10 ** exponent
                denominator = 1
            else:
                denominator = 10 ** -exponent
            result.append(min(numerator * n_bins // denominator, n_bins - 1))
        return result

    def observe_actual_bins(self, core, truth, scores, n_bins):
        import numpy as np

        captured = {}
        code = core.binary_metrics.__code__

        def capture(frame, event, _arg):
            if frame.f_code is code:
                if event == "return" and "bins" in frame.f_locals:
                    captured["bins"] = np.array(frame.f_locals["bins"], copy=True)
                return capture
            return None

        previous = sys.gettrace()
        try:
            sys.settrace(capture)
            result = core.binary_metrics(truth, scores, n_bins=n_bins)
        finally:
            sys.settrace(previous)
        self.assertIn("bins", captured)
        return result, captured["bins"]

    def test_every_admitted_bin_count_all_boundaries_neighbors_and_contexts(self):
        import json
        import math
        import tempfile
        import warnings
        from decimal import Inexact, Rounded, localcontext
        from fractions import Fraction

        import numpy as np

        core = load_core(self)
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-context-free-ece-"))
        print("CORE_FOUR_CONTEXT_CONTROL_ROOT=" + str(work))
        report_path = work / "every-admitted-bin-count.jsonl"
        settings = (("default_precision", 28, False), ("precision_two", 2, False),
                    ("precision_one_traps_enabled", 1, True))
        coverage = []
        with report_path.open("x", encoding="utf-8", newline="\n") as report:
            for n_bins in range(1, 1001):
                boundaries = [float(Fraction(index, n_bins)) for index in range(n_bins + 1)]
                boundaries.extend((0.1, 0.289, 0.29, 0.58))
                values = {0.0, 1.0}
                for boundary in boundaries:
                    for value in (math.nextafter(boundary, -math.inf), boundary,
                                  math.nextafter(boundary, math.inf)):
                        if 0 <= value <= 1:
                            values.add(value)
                scores = np.array(sorted(values), dtype=float)
                truth = np.array([index % 2 == 0 for index in range(len(scores))], dtype=bool)
                reference = np.array(self.context_free_decimal_oracle(scores, n_bins), dtype=int)
                expected_ece = 0.0
                for index in range(n_bins):
                    mask = reference == index
                    if mask.any():
                        expected_ece += float(mask.mean()) * abs(float(truth[mask].mean() - scores[mask].mean()))
                observations = []
                for name, precision, traps in settings:
                    with self.subTest(n_bins=n_bins, decimal_context=name):
                        with localcontext() as context:
                            context.prec = precision
                            context.traps[Inexact] = traps
                            context.traps[Rounded] = traps
                            context.clear_flags()
                            before = (context.prec, context.rounding, dict(context.traps), dict(context.flags))
                            result, observed = self.observe_actual_bins(core, truth, scores, n_bins)
                            masks = np.array([observed == index for index in range(n_bins)], dtype=bool)
                            counts = masks.sum(axis=0)
                            self.assertEqual(observed.tolist(), reference.tolist())
                            self.assertEqual(counts.tolist(), [1] * len(scores))
                            self.assertEqual(observed[0], 0)
                            self.assertEqual(observed[-1], n_bins - 1)
                            self.assertEqual(result["ece"], expected_ece)
                            self.assertEqual(result["ece_bins"], n_bins)
                            self.assertEqual(result["n"], len(scores))
                            self.assertEqual(result["support_status"], "both_classes")
                            self.assertEqual(result["tp"] + result["fp"] + result["fn"] + result["tn"], len(scores))
                            endpoint_result, endpoint_bins = self.observe_actual_bins(core, [False, True], [0.0, 1.0], n_bins)
                            self.assertEqual(endpoint_bins.tolist(), [0, n_bins - 1])
                            self.assertEqual(endpoint_result["ece"], 0.0)
                            with warnings.catch_warnings(record=True) as caught:
                                warnings.simplefilter("always")
                                empty = core.binary_metrics([], [], n_bins=n_bins)
                                negatives = core.binary_metrics([False, False], [0.0, 1.0], n_bins=n_bins)
                                positives = core.binary_metrics([True, True], [0.0, 1.0], n_bins=n_bins)
                            self.assertEqual(caught, [])
                            self.assertEqual(empty["support_status"], "empty_slice")
                            for key in ("precision", "recall", "f1", "fpr", "fnr", "average_precision", "pr_auc_trapezoidal", "ece"):
                                self.assertIsNone(empty[key])
                                self.assertEqual(empty["undefined_reasons"][key], "empty_slice")
                            for cohort in (negatives, positives):
                                self.assertEqual(cohort["support_status"], "one_class")
                                for key in ("average_precision", "pr_auc_trapezoidal", "ece"):
                                    self.assertIsNone(cohort[key])
                                    self.assertEqual(cohort["undefined_reasons"][key], "both_classes_required_for_comparable_target_metrics")
                            self.assertIsNone(negatives["recall"])
                            self.assertIsNone(negatives["fnr"])
                            self.assertIsNone(positives["fpr"])
                            self.assertEqual(negatives["undefined_reasons"]["recall"], "no_positive_support")
                            self.assertEqual(positives["undefined_reasons"]["fpr"], "no_negative_support")
                            self.assertEqual((context.prec, context.rounding, dict(context.traps), dict(context.flags)), before)
                        observations.append({"name": name, "precision": precision, "Inexact_and_Rounded_traps": traps,
                                             "actual_bins": observed.tolist(), "membership_counts": counts.tolist(),
                                             "actual_metrics": result, "endpoint_metrics": endpoint_result,
                                             "endpoint_bins": endpoint_bins.tolist(), "empty": empty,
                                             "negative_only": negatives, "positive_only": positives,
                                             "ambient_context_unchanged": True})
                record = {"n_bins": n_bins, "all_rational_boundary_indices": list(range(n_bins + 1)),
                          "boundary_float_values": boundaries, "adjacent_float_recipe": "math.nextafter each boundary toward both infinities; retain [0,1]",
                          "scores": scores.tolist(), "truth": truth.tolist(), "oracle_bins": reference.tolist(),
                          "oracle_ece": expected_ece, "contexts": observations,
                          "label": "post-GREEN context-independent controls, not an additional RED/GREEN cycle"}
                report.write(json.dumps(record, sort_keys=True, allow_nan=False) + "\n")
                report.flush()
                coverage.append({"n_bins": n_bins, "contexts": [item["name"] for item in observations],
                                 "boundary_count": n_bins + 1, "admitted_score_count": len(scores)})
        self.assertEqual([row["n_bins"] for row in coverage], list(range(1, 1001)))
        self.assertTrue(all(row["contexts"] == [setting[0] for setting in settings] for row in coverage))
        (work / "executed-coverage.json").write_text(json.dumps({"executed": coverage, "n_bins_count": len(coverage),
                                                               "context_count_per_n_bins": len(settings)}, sort_keys=True), encoding="utf-8")
        with report_path.open(encoding="utf-8") as report:
            observed_rows = []
            for line in report:
                row = json.loads(line)
                self.assertEqual([item["name"] for item in row["contexts"]], [setting[0] for setting in settings])
                self.assertTrue(all(item["actual_bins"] == row["oracle_bins"] for item in row["contexts"]))
                self.assertTrue(all(item["membership_counts"] == [1] * len(row["scores"]) for item in row["contexts"]))
                observed_rows.append(row["n_bins"])
        self.assertEqual(observed_rows, list(range(1, 1001)))
        print("CORE_FOUR_EXECUTED_BIN_COUNTS=" + str(len(coverage)))




class CoreFourSourceSnapshotRegressionTests(unittest.TestCase):
    def test_checked_scores_use_one_stateful_array_snapshot(self):
        import json
        import tempfile

        import numpy as np

        core = load_core(self)

        class StatefulScores:
            def __init__(self):
                self.calls = []

            def __array__(self, dtype=None, copy=None):
                values = [0.1, 0.9] if not self.calls else [False, 0.9]
                result = np.array(values, dtype=dtype, copy=True)
                self.calls.append({"requested_dtype": str(dtype), "requested_copy": copy,
                                   "source_types": [type(value).__name__ for value in values],
                                   "source_values": values, "returned_dtype": str(result.dtype),
                                   "returned_values": result.tolist()})
                return result

        scores = StatefulScores()
        expected = core.binary_metrics([False, True], [0.1, 0.9])
        actual = core.binary_metrics([False, True], scores)
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-source-snapshot-"))
        print("CORE_FOUR_PROTOCOL_CONTROL_ROOT=" + str(work))
        (work / "stateful-source-snapshot.json").write_text(json.dumps({"calls": scores.calls, "expected": expected,
                                                                      "actual": actual}, sort_keys=True, allow_nan=False), encoding="utf-8")
        self.assertEqual(len(scores.calls), 1)
        self.assertEqual(actual, expected)




class CoreFourOneSnapshotControlTests(unittest.TestCase):
    """Post-GREEN source-protocol and existing admission controls."""

    def test_array_protocols_are_not_reinvoked_for_checked_and_consumed_values(self):
        import json
        import tempfile

        import numpy as np

        core = load_core(self)
        observations = []

        class DtypeDependentScores:
            def __init__(self, natural):
                self.natural = natural
                self.calls = []

            def __array__(self, dtype=None, copy=None):
                self.calls.append({"dtype": str(dtype), "copy": copy})
                if dtype is not None:
                    return np.array([False, 0.9], dtype=object)
                return self.natural.copy()

        for dtype in (np.int64, np.uint64, np.float16, np.float32, np.float64):
            values = [0, 1] if np.dtype(dtype).kind in "iu" else [0.125, 0.875]
            natural = np.array(values, dtype=dtype)
            source = DtypeDependentScores(natural)
            with self.subTest(protocol="dtype_dependent", dtype=str(natural.dtype)):
                actual = core.binary_metrics([False, True], source)
                expected = core.binary_metrics([False, True], natural.astype(float).tolist())
                self.assertEqual(actual, expected)
                self.assertEqual(len(source.calls), 1)
                self.assertEqual(source.calls[0]["dtype"], "None")
            observations.append({"kind": "dtype_dependent_numeric", "natural_dtype": str(natural.dtype),
                                 "calls": source.calls, "actual_metrics": actual, "expected_metrics": expected})
        for name, natural in (("boolean_dtype", np.array([False, True])),
                              ("mixed_boolean_object_dtype", np.array([False, 0.9], dtype=object)),
                              ("numeric_object_dtype_unsupported", np.array([0.125, 0.875], dtype=object)),
                              ("string_dtype", np.array(["0.125", "0.875"])),
                              ("complex_dtype", np.array([0.125, 0.875], dtype=complex)),
                              ("rank_two", np.array([[0.125, 0.875]])),
                              ("wrong_length", np.array([0.125])),
                              ("nonfinite", np.array([np.nan, 0.875])),
                              ("out_of_range", np.array([-0.125, 0.875]))):
            source = DtypeDependentScores(natural)
            with self.subTest(protocol="dtype_dependent_rejected", boundary=name), self.assertRaisesRegex(ValueError, "invalid metrics") as caught:
                core.binary_metrics([False, True], source)
            self.assertEqual(len(source.calls), 1)
            self.assertEqual(source.calls[0]["dtype"], "None")
            observations.append({"kind": name, "natural_dtype": str(natural.dtype), "calls": source.calls,
                                 "rejected": True, "reason": str(caught.exception)})

        class InterfaceScores:
            def __init__(self):
                self.calls = 0
                self.first = np.array([0.125, 0.875])
                self.second = np.array([0.0, 0.875])

            @property
            def __array_interface__(self):
                self.calls += 1
                return (self.first if self.calls == 1 else self.second).__array_interface__

        class StructScores:
            def __init__(self):
                self.calls = 0
                self.first = np.array([0.125, 0.875])
                self.second = np.array([0.0, 0.875])

            @property
            def __array_struct__(self):
                self.calls += 1
                return (self.first if self.calls == 1 else self.second).__array_struct__

        for provider in (InterfaceScores, StructScores):
            source = provider()
            with self.subTest(protocol=provider.__name__):
                actual = core.binary_metrics([False, True], source)
                expected = core.binary_metrics([False, True], [0.125, 0.875])
                self.assertEqual(source.calls, 1)
                self.assertEqual(actual, expected)
            observations.append({"kind": provider.__name__, "calls": source.calls,
                                 "actual_metrics": actual, "first_snapshot_metrics": expected,
                                 "protocol_property_not_invoked_by_admission_detection": True})
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-protocol-controls-"))
        print("CORE_FOUR_PROTOCOL_CONTROL_ROOT=" + str(work))
        (work / "array-protocols.json").write_text(json.dumps({"label": "post-GREEN controls", "observations": observations},
                                                            sort_keys=True, allow_nan=False), encoding="utf-8")

    def test_mixed_booleans_object_dtypes_and_erased_numpy_provenance_keep_boundaries(self):
        import json
        import tempfile

        import numpy as np

        core = load_core(self)
        rejected = (("python_bool_mixed", [False, 0.9]), ("numpy_bool_mixed", [np.bool_(True), 0.1]),
                    ("tuple_bool_mixed", (0.1, True)), ("all_bool", [False, True]),
                    ("all_bool_ndarray", np.array([False, True])),
                    ("object_bool", np.array([False, 0.9], dtype=object)),
                    ("object_numeric_unsupported", np.array([0.125, 0.875], dtype=object)),
                    ("string", ["0.125", "0.875"]), ("complex", [0.125 + 0j, 0.875 + 0j]),
                    ("nonfinite_nan", [float("nan"), 0.9]), ("nonfinite_inf", [float("inf"), 0.9]),
                    ("negative", [-0.1, 0.9]), ("above_one", [0.1, 1.1]),
                    ("rank_two", [[0.125, 0.875]]), ("scalar", 0.5), ("misaligned", [0.125]))
        observations = []
        for name, scores in rejected:
            with self.subTest(admission=name), self.assertRaisesRegex(ValueError, "invalid metrics") as caught:
                core.binary_metrics([False, True], scores)
            observations.append({"name": name, "rejected": True, "reason": str(caught.exception)})

        class RawSequence:
            def __init__(self, values):
                self.values = values
                self.accesses = []

            def __len__(self):
                return len(self.values)

            def __getitem__(self, index):
                self.accesses.append(index)
                return self.values[index]

        source = RawSequence([False, 0.9])
        with self.assertRaisesRegex(ValueError, "invalid metrics.*scores"):
            core.binary_metrics([False, True], source)
        observations.append({"name": "raw_sequence_mixed_bool", "rejected": True, "accesses": source.accesses})
        source = RawSequence([0.125, 0.875])
        actual = core.binary_metrics([False, True], source)
        self.assertEqual(actual, core.binary_metrics([False, True], [0.125, 0.875]))
        observations.append({"name": "raw_sequence_numeric", "admitted": True, "accesses": source.accesses, "metrics": actual})
        for scores in ([0, 1], (0, 1), [0.125, 0.875], (0.125, 0.875),
                       np.array([0, 1], dtype=np.uint64), np.array([0, 1], dtype=np.int32),
                       np.array([0.125, 0.875], dtype=np.float16), np.array([0.125, 0.875], dtype=np.float32),
                       np.array([0.125, 0.875], dtype=np.float64)):
            plain = np.asarray(scores).astype(float).tolist()
            with self.subTest(admission="numeric", type=type(scores).__name__):
                result = core.binary_metrics([False, True], scores)
                self.assertEqual(result, core.binary_metrics([False, True], plain))
                self.assertEqual((result["tp"], result["tn"], result["fp"], result["fn"]), (1, 1, 0, 0))
            observations.append({"name": "supported_numeric", "plain_scores": plain, "admitted": True, "metrics": result})
        for scores in (np.asarray([False, 0.9], dtype=float), np.asarray([np.bool_(True), 0.1], dtype=np.float32)):
            plain = scores.astype(float).tolist()
            result = core.binary_metrics([False, True], scores)
            self.assertEqual(result, core.binary_metrics([False, True], plain))
            observations.append({"name": "already_erased_numpy_provenance", "dtype": str(scores.dtype), "plain_scores": plain,
                                 "admitted": True, "original_boolean_provenance_recoverable": False, "metrics": result})
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-admission-controls-"))
        print("CORE_FOUR_PROTOCOL_CONTROL_ROOT=" + str(work))
        (work / "admission-and-provenance-limits.json").write_text(json.dumps({"label": "post-GREEN controls", "observations": observations},
                                                                           sort_keys=True, allow_nan=False), encoding="utf-8")




class CoreFourRealThresholdRegressionTests(unittest.TestCase):
    def test_finite_fraction_threshold_obeys_declared_real_admission(self):
        import json
        import tempfile
        from fractions import Fraction
        from numbers import Real

        core = load_core(self)
        threshold = Fraction(1, 2)
        self.assertIsInstance(threshold, Real)
        expected = core.binary_metrics([False, True], [0.1, 0.9], threshold=0.5)
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-real-threshold-"))
        print("CORE_FOUR_REAL_CONTROL_ROOT=" + str(work))
        try:
            actual = core.binary_metrics([False, True], [0.1, 0.9], threshold=threshold)
        except (TypeError, OverflowError) as error:
            (work / "fraction-threshold.json").write_text(json.dumps({"numerator": threshold.numerator, "denominator": threshold.denominator,
                                                                    "declared_Real": isinstance(threshold, Real), "expected": expected,
                                                                    "error_type": type(error).__name__, "error": str(error)}, sort_keys=True), encoding="utf-8")
            self.fail(f"Finite in-range Real threshold must not leak numpy predicate errors: {type(error).__name__}: {error}")
        (work / "fraction-threshold.json").write_text(json.dumps({"numerator": threshold.numerator, "denominator": threshold.denominator,
                                                                "expected": expected, "actual": actual}, sort_keys=True, allow_nan=False), encoding="utf-8")
        self.assertEqual(actual, expected)
        self.assertIs(type(actual["threshold"]), float)




class CoreFourRealThresholdControlTests(unittest.TestCase):
    def test_supported_real_controls_and_invalid_types_preserve_admission(self):
        import json
        import tempfile
        from decimal import Decimal
        from fractions import Fraction

        import numpy as np

        core = load_core(self)
        accepted = (0, 1, 0.5, Fraction(0, 1), Fraction(1, 1), Fraction(1, 3),
                    Fraction(10**400 - 1, 10**400), np.int64(0), np.int64(1),
                    np.float16(0.5), np.float32(0.375), np.float64(0.5))
        observations = []
        for threshold in accepted:
            with self.subTest(admitted_type=type(threshold).__name__, value=str(threshold)):
                actual = core.binary_metrics([False, True], [0.1, 0.9], threshold=threshold)
                expected = core.binary_metrics([False, True], [0.1, 0.9], threshold=float(threshold))
                self.assertEqual(actual, expected)
                self.assertIs(type(actual["threshold"]), float)
                json.dumps(actual, allow_nan=False)
            observations.append({"input_type": type(threshold).__name__, "input": str(threshold),
                                 "admitted": True, "threshold": actual["threshold"]})
        rejected = (True, False, np.bool_(True), "0.5", None, 0.5 + 0j, Decimal("0.5"),
                    np.array(0.5), float("nan"), float("inf"), float("-inf"),
                    np.float32("nan"), np.float64("inf"), -0.1, 1.1,
                    Fraction(-1, 2), Fraction(3, 2), 10**400, -(10**400),
                    Fraction(10**500, 3))
        for threshold in rejected:
            with self.subTest(rejected_type=type(threshold).__name__, value=str(threshold)), self.assertRaisesRegex(ValueError, "invalid metrics: threshold") as caught:
                core.binary_metrics([False, True], [0.1, 0.9], threshold=threshold)
            observations.append({"input_type": type(threshold).__name__, "input": str(threshold),
                                 "admitted": False, "reason": str(caught.exception)})
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-real-controls-"))
        print("CORE_FOUR_REAL_CONTROL_ROOT=" + str(work))
        (work / "real-control-admission.json").write_text(json.dumps({
            "label": "post-GREEN controls; not asserted to have been RED", "observations": observations},
            sort_keys=True, allow_nan=False), encoding="utf-8")



class CoreFourJSONControlsRegressionTests(unittest.TestCase):
    def test_accepted_numpy_outer_controls_are_plain_json_scalars(self):
        import json
        import tempfile

        import numpy as np

        core = load_core(self)
        cases = [core.Case.from_dict({"id": "json-control-" + str(index), "text": "UNIT-ONLY metric fixture " + str(index),
                                     "label": "PROMPT_INJECTION" if positive else "SAFE", "target": "risk",
                                     "gold_positive": positive, "language": "en", "slices": ["direct_injection"]})
                 for index, positive in enumerate((False, True))]
        batch = core.ScoreBatch([case.id for case in cases], [0.1, 0.9], [None, None], "risk",
                                "UNIT-ONLY-JSON-CONTROLS", core.cases_fingerprint(cases))
        common = {"target": "risk", "declared_languages": ["en"], "expected_model_identity": batch.model_identity}
        expected = core.aggregate_metrics(cases, batch, threshold=0.5, n_bins=10, **common)
        actual = core.aggregate_metrics(cases, batch, threshold=np.float32(0.5), n_bins=np.int64(10), **common)
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-json-controls-"))
        print("CORE_FOUR_JSON_CONTROL_ROOT=" + str(work))
        try:
            encoded = json.dumps(actual, sort_keys=True, allow_nan=False)
        except (TypeError, ValueError) as error:
            (work / "outer-controls.json").write_text(json.dumps({
                "threshold_type": type(actual["threshold"]).__name__, "bins_type": type(actual["ece_bins"]).__name__,
                "error_type": type(error).__name__, "error": str(error)}, sort_keys=True), encoding="utf-8")
            self.fail(f"Accepted aggregate controls must be plain native JSON scalars: {type(error).__name__}: {error}")
        self.assertEqual(encoded, json.dumps(expected, sort_keys=True, allow_nan=False))
        self.assertIs(type(actual["threshold"]), float)
        self.assertIs(type(actual["ece_bins"]), int)
        self.assertIs(type(actual["overall"]["threshold"]), float)
        self.assertIs(type(actual["overall"]["ece_bins"]), int)
        (work / "outer-controls.json").write_text(encoded, encoding="utf-8")



class CoreFourJSONControlAdmissionTests(unittest.TestCase):
    def test_empty_aggregation_validates_before_plain_scalar_projection(self):
        import json
        import tempfile
        from fractions import Fraction

        import numpy as np

        core = load_core(self)
        cases = []
        batch = core.ScoreBatch([], [], [], "risk", "UNIT-ONLY-EMPTY-CONTROLS", core.cases_fingerprint(cases))
        common = {"target": "risk", "declared_languages": ["en", "hi"], "expected_model_identity": batch.model_identity}
        observations = []
        for threshold, n_bins in ((np.float32(0.375), np.int64(10)), (np.float64(0.5), np.int32(1)),
                                  (Fraction(1, 3), np.int64(1000)), (1, 10), (0, np.uint16(2))):
            with self.subTest(admitted_threshold=str(threshold), admitted_bins=str(n_bins)):
                report = core.aggregate_metrics(cases, batch, threshold=threshold, n_bins=n_bins, **common)
                self.assertIs(type(report["threshold"]), float)
                self.assertIs(type(report["ece_bins"]), int)
                pending = [report]
                cohort_count = 0
                while pending:
                    item = pending.pop()
                    if isinstance(item, dict):
                        if "threshold" in item and "ece_bins" in item:
                            self.assertIs(type(item["threshold"]), float)
                            self.assertIs(type(item["ece_bins"]), int)
                            self.assertEqual(item["threshold"], float(threshold))
                            self.assertEqual(item["ece_bins"], int(n_bins))
                            cohort_count += 1
                        pending.extend(item.values())
                    elif isinstance(item, list):
                        pending.extend(item)
                encoded = json.dumps(report, sort_keys=True, allow_nan=False)
                self.assertEqual(json.loads(encoded), report)
                self.assertFalse(report["release_ready"])
            observations.append({"threshold": report["threshold"], "n_bins": report["ece_bins"],
                                 "control_records_checked": cohort_count, "admitted": True})
        rejected = ((True, 10), (np.bool_(False), 10), ("0.5", 10), (float("nan"), 10),
                    (float("inf"), 10), (10**400, 10), (Fraction(3, 2), 10),
                    (0.5, True), (0.5, np.bool_(True)), (0.5, 10.0), (0.5, np.float32(10)),
                    (0.5, Fraction(10, 1)), (0.5, "10"), (0.5, 0), (0.5, np.int64(1001)))
        for threshold, n_bins in rejected:
            with self.subTest(rejected_threshold=str(threshold), rejected_bins=str(n_bins)), self.assertRaisesRegex(ValueError, "invalid metrics") as caught:
                core.aggregate_metrics(cases, batch, threshold=threshold, n_bins=n_bins, **common)
            observations.append({"threshold_input": str(threshold), "bins_input": str(n_bins),
                                 "admitted": False, "reason": str(caught.exception)})
        work = Path(tempfile.mkdtemp(prefix="soter-core-four-json-admission-"))
        print("CORE_FOUR_JSON_CONTROL_ROOT=" + str(work))
        (work / "outer-and-nested-admission.json").write_text(json.dumps({
            "label": "post-GREEN controls; no fabricated RED", "observations": observations},
            sort_keys=True, allow_nan=False), encoding="utf-8")

if __name__ == "__main__":
    unittest.main(verbosity=2)
