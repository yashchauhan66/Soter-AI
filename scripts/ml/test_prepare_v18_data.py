"""Leakage and record-integrity regression tests for the v18 data preparation."""
import importlib.util
import json
from pathlib import Path
import shutil
import unittest
import uuid

SPEC = importlib.util.spec_from_file_location("prepare_v18", Path(__file__).with_name("prepare-v18-data.py"))
prep = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(prep)


class DataPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp_parent = (prep.ROOT / "artifacts/ml/.v18-test-tmp").resolve()
        self.temp_parent.mkdir(parents=True, exist_ok=True)
        # Python's Windows TemporaryDirectory(mode=0700) strips sandbox access.
        self.root = self.temp_parent / uuid.uuid4().hex
        self.root.mkdir()

    def tearDown(self):
        self.root.resolve().relative_to(self.temp_parent)
        shutil.rmtree(self.root)

    def write(self, name, rows):
        path = self.root / name
        path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
        return path

    def test_unicode_line_separator_is_inside_one_record(self):
        path = self.write("rows.jsonl", [{"text": "Hello\u2028world\u2029again", "label": "SAFE", "language": "hi"}])
        rows = prep.read_rows(path)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["text"], "Hello\u2028world\u2029again")
        self.assertEqual(rows[0]["language"], "hi")

    def test_missing_unknown_and_duplicate_labels_fail_closed(self):
        for row in ({"text": "hello"}, {"text": "hello", "label": "safe"},
                    {"text": "", "label": "SAFE"}, {"text": "hello", "label": "SAFE", "language": None}):
            with self.subTest(row=row):
                with self.assertRaises(ValueError):
                    prep.read_rows(self.write("bad.jsonl", [row]))
        path = self.root / "duplicate.jsonl"
        path.write_text('{"text":"hello","label":"SAFE","label":"JAILBREAK"}\n', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate JSON key"):
            prep.read_rows(path)
        path.write_text('{"text":"hello","label":"SAFE","confidence":NaN}\n', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "non-JSON"):
            prep.read_rows(path)

    def test_source_or_broad_category_alone_does_not_join_rows(self):
        rows = prep.read_rows(self.write("source.jsonl", [
            {"text": "alpha task", "label": "SAFE", "source": "single-corpus", "category": "benign"},
            {"text": "beta request", "label": "SAFE", "source": "single-corpus", "category": "benign"},
        ]))
        self.assertFalse(prep.lineage_tokens(rows[0]) & prep.lineage_tokens(rows[1]))

    def test_explicit_translation_and_parent_ids_link_across_languages(self):
        rows = prep.read_rows(self.write("lineage.jsonl", [
            {"text": "alpha task", "label": "SAFE", "source": "corpus", "translation_group": "template-a", "id": "parent"},
            {"text": "किसी कार्य का वर्णन", "label": "SAFE", "source": "corpus", "translation_group": "template-a"},
            {"text": "beta variation", "label": "SAFE", "source": "corpus", "parent_id": "parent"},
        ]))
        self.assertTrue(prep.lineage_tokens(rows[0]) & prep.lineage_tokens(rows[1]))
        self.assertTrue(prep.lineage_tokens(rows[0]) & prep.lineage_tokens(rows[2]))

    def test_four_way_split_quarantines_entire_holdout_component_and_conflicts(self):
        # Alphabetic IDs avoid the intentionally number-insensitive lexical grouper.
        rows = [{"text": f"Independent token{chr(97 + i // 26)}{chr(97 + i % 26)} request", "label": "SAFE" if i % 2 else "JAILBREAK",
                 "source": "fixtures", "language": "en"} for i in range(160)]
        rows += [
            {"text": "Original family text", "label": "JAILBREAK", "source": "fixtures", "translation_group": "heldout-family"},
            {"text": "Different sibling translation", "label": "JAILBREAK", "source": "fixtures", "translation_group": "heldout-family", "language": "hi"},
            {"text": "Conflicting label text", "label": "SAFE"},
            {"text": "Conflicting label text", "label": "PROMPT_INJECTION"},
        ]
        train = self.write("train.jsonl", rows)
        holdout = self.write("holdout.jsonl", [{"text": "External sibling paraphrase", "label": "JAILBREAK", "source": "fixtures", "translation_group": "heldout-family"}])
        paths = [self.root / name for name in ("clean.jsonl", "splits.json", "report.json", "sampling.json")]
        report = prep.prepare_training([train], [holdout], *paths)
        clean = [json.loads(line) for line in paths[0].read_text(encoding="utf-8").split("\n") if line]
        split = json.loads(paths[1].read_text())
        sample = json.loads(paths[3].read_text())
        self.assertEqual(len(clean), 160)
        self.assertEqual(report["removed_rows"]["external_holdout_lineage"], 2)
        self.assertEqual(report["removed_rows"]["conflicting_labels"], 2)
        self.assertEqual(report["conflicting_normalized_text_groups"], 1)
        self.assertEqual(sorted(i for values in split["indices"].values() for i in values), list(range(len(clean))))
        self.assertTrue(all(size > 0 for size in split["counts"].values()))
        self.assertTrue(all(size == 0 for size in report["split_group_intersections"].values()))
        self.assertEqual(split["dataset_sha256"], prep.sha256_file(paths[0]))
        self.assertEqual(sample["train_indices"], split["indices"]["train"])
        self.assertEqual(len(sample["weights"]), len(sample["train_indices"]))
        self.assertFalse(sample["enabled_by_default"])

    def test_comparison_excludes_full_training_corpus_and_keeps_unknown_language(self):
        train = self.write("training.jsonl", [{"text": "Training secret", "label": "JAILBREAK"}])
        heldout = self.write("external.jsonl", [
            {"text": "Training secret", "label": "JAILBREAK"},
            {"text": "अलग उदाहरण", "label": "JAILBREAK", "language": "hi", "metadata": {"author": "fixture"}},
            {"text": "Novel safe sentence", "label": "SAFE"},
        ])
        report = prep.prepare_comparison([train], [heldout], self.root / "comparison.jsonl", per_class=2)
        self.assertEqual(report["training_group_overlap_after_filter"], 0)
        self.assertEqual(report["holdout_audit"][0]["training_group_overlap"], 1)
        self.assertEqual(report["selected_coverage"]["rows"], 2)
        self.assertIn("unknown", report["selected_coverage"]["languages"])
        self.assertEqual(report["selected_coverage"]["priority_language_gaps"]["en"]["rows"], 0)

    def test_balanced_selection_reserves_english_attacks_and_caps_pii(self):
        rows = []
        for lang in ("en", "hi", "ja", "ar"):
            for label, count in (("PII", 600), ("PROMPT_INJECTION", 100), ("JAILBREAK", 100), ("SAFE", 100)):
                for number in range(count):
                    rows.append({"text": f"{lang} {label} fixture {number}", "label": label,
                                 "language": lang, "source": f"provider-{number % 2}",
                                 "_v18": {"source_file": f"source-{number % 3}.jsonl"}})
        selected, audit = prep.balanced_comparison_sample(rows, per_class=200, seed=123)
        attacks = [row for row in selected if row["label"] != "SAFE"]
        benign = [row for row in selected if row["label"] == "SAFE"]
        self.assertEqual((len(attacks), len(benign)), (200, 200))
        self.assertEqual(sum(prep.language(row) == "en" for row in attacks), 100)
        self.assertEqual(sum(prep.language(row) != "en" for row in attacks), 100)
        self.assertLessEqual(sum(row["label"] == "PII" for row in attacks), 70)
        self.assertEqual(audit["attacks"]["total_shortfall"], 0)
        self.assertEqual(len({row["text"] for row in selected}), 400)
        again, _ = prep.balanced_comparison_sample(rows, per_class=200, seed=123)
        self.assertEqual([row["text"] for row in selected], [row["text"] for row in again])

    def test_balanced_selection_reports_shortfalls_without_relabeling_unknown(self):
        rows = [{"text": f"benign {number}", "label": "SAFE", "_v18": {"source_file": "sample.jsonl"}}
                for number in range(10)]
        for row in rows[:5]:
            row["language"] = "en"
        for row in rows[5:8]:
            row["language"] = "hi"
        rows.extend({"text": f"PII only {number}", "label": "PII", "language": "en",
                     "_v18": {"source_file": "sample.jsonl"}} for number in range(100))
        selected, audit = prep.balanced_comparison_sample(rows, per_class=10, seed=42)
        self.assertEqual(audit["benign"]["selected"], {"total": 10, "english": 5, "non_english": 3, "unknown": 2})
        self.assertEqual(audit["benign"]["non_english_quota_shortfall"], 2)
        self.assertEqual(audit["attacks"]["selected_pii_rows"], 3)
        self.assertEqual(audit["attacks"]["selected_pii_fraction"], 1.0)
        self.assertEqual(audit["attacks"]["total_shortfall"], 7)
        self.assertEqual(sum("language" not in row for row in selected), 2)


if __name__ == "__main__":
    unittest.main()
