"""Real synthetic JSONL/seal fixtures only; no model or release-corpus reads."""
import hashlib
import importlib
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "eval_harness/data.py"
SCRATCH = Path("C:/Users/USER/AppData/Local/hermes/cache/scratch")


def load_data(test):
    test.assertTrue(DATA.is_file(), "Strict evaluation data implementation is missing")
    return importlib.import_module("eval_harness.data")


def synthetic_row(identifier="synthetic.1", text="Synthetic harmless note.", family="synthetic.family.1"):
    return {"id": identifier, "text": text, "label": "SAFE", "target": "risk", "gold_positive": False,
            "language": "en", "source": "hand-authored-synthetic", "source_version": "fixture-v01",
            "source_id": identifier, "source_label": "source.safe", "license": "internal-test-only",
            "license_status": "declared", "provenance": {"status": "declared", "basis": "synthetic-unit-author"},
            "group_id": "legacy-not-an-independence-certificate", "source_family": family,
            "template_family": "template/" + family, "family_metadata_trusted": True,
            "slices": ["benign_hard_negative"]}


class SyntheticDataTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-core-data-synthetic-", dir=SCRATCH))
        print("SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def fixture(self, rows, name="synthetic.jsonl", newline=b"\n"):
        path = self.work / name
        payload = newline.join(json.dumps(row, ensure_ascii=False).encode("utf-8") for row in rows) + newline
        with path.open("xb") as handle:
            handle.write(payload)
        return path, payload

    def test_jsonl_import_binds_one_exact_payload_without_source_normalization(self):
        data = load_data(self)
        rows = [synthetic_row(" case. A ", "Synthetic  café\r\nदूसरी पंक्ति.", "family. A "),
                synthetic_row("case.A", "Synthetic \u200b fullwidth Ａ.", "family.A")]
        rows[1]["turns"] = [{"role": "user", "text": "Exact\nsynthetic turn"}, {"role": "assistant", "text": "Response  "}]
        path, payload = self.fixture(rows, newline=b"\r\n")
        imported = data.import_jsonl(path)
        self.assertEqual(imported.raw_bytes, payload)
        self.assertEqual(imported.raw_sha256, hashlib.sha256(payload).hexdigest())
        self.assertEqual(imported.ordered_ids, (" case. A ", "case.A"))
        self.assertEqual(tuple(case.text for case in imported.cases), tuple(row["text"] for row in rows))
        self.assertEqual(imported.cases[1].turns[1].text, "Response  ")
        self.assertEqual(imported.schema_identity, data.SCHEMA_IDENTITY)
        self.assertEqual(imported.importer_identity, data.IMPORTER_IDENTITY)
        self.assertTrue(imported.source_fingerprints, "Source identities and captured record bytes must be fingerprinted")
        path.write_bytes(b"mutable source changed after import\n")
        self.assertEqual(imported.raw_bytes, payload)
        self.assertEqual(imported.ordered_ids, (" case. A ", "case.A"))
        with self.assertRaises((AttributeError, TypeError)):
            imported.cases = ()
        self.assertIs(imported.release_ready, False)
        self.assertEqual(data.import_jsonl_bytes(payload).raw_sha256, imported.raw_sha256)


    def test_jsonl_rejects_malformed_records_and_duplicate_exact_ids(self):
        data = load_data(self)
        valid = json.dumps(synthetic_row(), ensure_ascii=False).encode("utf-8")
        invalid_payloads = (
            b"", b"\xff\n", b"\xef\xbb\xbf" + valid + b"\n", b"[]\n", b"null\n",
            valid + b"\n{\n", valid + b"\n\n", b" \n" + valid,
            valid + b"\n" + valid + b"\n",
            b'{"id":"wrong","id":"synthetic.1",' + valid[1:] + b"\n",
            valid[:-1] + b',"extensions":{"key":1,"key":2}}\n',
            valid[:-1] + b',"extensions":{"number":NaN}}\n',
            valid[:-1] + b',"extensions":{"number":Infinity}}\n',
            valid[:-1] + b',"extensions":{"number":1e400}}\n',
            valid[:-1] + b',"unknown_extra":"no silent drop"}\n',
        )
        for index, payload in enumerate(invalid_payloads):
            with self.subTest(index=index):
                path = self.work / f"invalid-{index}.jsonl"
                with path.open("xb") as handle:
                    handle.write(payload)
                with self.assertRaisesRegex(ValueError, "invalid JSONL"):
                    data.import_jsonl(path)
        duplicate_path, _ = self.fixture([synthetic_row(), synthetic_row()], name="duplicate-id.jsonl")
        with self.assertRaisesRegex(ValueError, "line 2.*duplicate case ID"):
            data.import_jsonl(duplicate_path)
        for payload in ("not-bytes", bytearray(valid), memoryview(valid)):
            with self.subTest(input_type=type(payload).__name__), self.assertRaisesRegex(ValueError, "captured bytes"):
                data.import_jsonl_bytes(payload)
        self.assertEqual(data.import_jsonl_bytes(valid).ordered_ids, ("synthetic.1",))


    def test_unknown_lineage_is_diagnostic_not_an_independence_claim(self):
        data = load_data(self)
        row = synthetic_row()
        for field in ("source_version", "source_label", "license", "license_status", "provenance",
                      "source_family", "template_family", "family_metadata_trusted", "language"):
            row.pop(field)
        path, payload = self.fixture([row], name="unknown-lineage.jsonl")
        imported = data.import_jsonl(path)
        self.assertTrue(hasattr(imported, "diagnostics"), "Unknown lineage/license need explicit diagnostic gaps")
        gaps = imported.diagnostics["coverage_gaps_by_id"][row["id"]]
        self.assertTrue({"source_version", "license", "provenance", "family_metadata", "language"} <= set(gaps))
        self.assertEqual(imported.cases[0].license, "unknown")
        self.assertIsNone(imported.cases[0].source_label)
        self.assertFalse(imported.diagnostics["independence_established"])
        self.assertFalse(imported.diagnostics["release_ready"])
        for claim in ("independence", "release"):
            with self.subTest(claim=claim):
                with self.assertRaisesRegex(ValueError, "not established"):
                    data.import_jsonl(path, claim=claim)
                with self.assertRaisesRegex(ValueError, "not established"):
                    data.import_jsonl_bytes(payload, claim=claim)
        with self.assertRaisesRegex(ValueError, "not established"):
            imported.assert_independence()
        with self.assertRaisesRegex(ValueError, "not established"):
            imported.assert_release_ready()
        for name in ("provenance", "semantic_near_duplicate", "lexical_near_duplicate", "embedding_near_duplicate",
                     "baseline_exposure", "teacher_exposure"):
            self.assertIn(imported.diagnostics["audits"][name], ("not_run", "not_established"))
        complete_path, _ = self.fixture([synthetic_row("declared.complete")], name="declared-complete.jsonl")
        with self.assertRaisesRegex(ValueError, "semantic_near_duplicate|teacher_exposure"):
            data.import_jsonl(complete_path, claim="independence")
        with self.assertRaisesRegex(ValueError, "invalid claim"):
            data.import_jsonl(complete_path, claim="Independent")


    def settings(self):
        return {"target": "risk", "threshold": 0.5, "seed": 17,
                "text_overlap_normalization": "NFKC-casefold-whitespace/v1", "languages": ["en", "hi"]}

    def test_new_destination_seal_load_binds_serialized_and_source_bytes(self):
        data = load_data(self)
        self.assertTrue(hasattr(data, "seal_dataset"), "Dataset sealing must write and verify real fixture files")
        path, original_bytes = self.fixture([synthetic_row("seal. A "), synthetic_row("seal.B", "Synthetic  second.", "family.B")])
        imported = data.import_jsonl(path)
        path.write_bytes(b"source path now holds different bytes\n")
        settings = self.settings()
        destination = self.work / "new-seal"
        sealed = data.seal_dataset(imported, destination, settings=settings)
        self.assertTrue((destination / "cases.jsonl").is_file())
        self.assertTrue((destination / "manifest.json").is_file())
        self.assertEqual((destination / "source.jsonl").read_bytes(), original_bytes)
        self.assertEqual(sealed.manifest_sha256, hashlib.sha256((destination / "manifest.json").read_bytes()).hexdigest())
        serialized = (destination / "cases.jsonl").read_bytes()
        self.assertEqual(sealed.raw_bytes, serialized)
        self.assertEqual(sealed.manifest["payload_sha256"], hashlib.sha256(serialized).hexdigest())
        self.assertEqual(tuple(sealed.manifest["ordered_ids"]), imported.ordered_ids)
        self.assertEqual(sealed.manifest["source_input"]["raw_sha256"], hashlib.sha256(original_bytes).hexdigest())
        self.assertEqual(sealed.manifest["schema_identity"], data.SCHEMA_IDENTITY)
        self.assertEqual(sealed.manifest["importer_identity"], data.IMPORTER_IDENTITY)
        self.assertEqual(sealed.manifest["grouping_identity"], data.GROUPING_IDENTITY)
        self.assertFalse(sealed.manifest["release_ready"])
        self.assertFalse(sealed.manifest["independence_established"])
        loaded = data.load_sealed(destination, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        self.assertEqual(loaded.ordered_ids, imported.ordered_ids)
        self.assertEqual([case.to_dict() for case in loaded.cases], [case.to_dict() for case in imported.cases])
        self.assertEqual(loaded.raw_bytes, serialized)
        settings["languages"].append("caller-mutated")
        self.assertNotIn("caller-mutated", sealed.manifest["settings"]["languages"])
        with self.assertRaises(TypeError):
            loaded.manifest["settings"]["target"] = "policy"
        with self.assertRaises(FileExistsError):
            data.seal_dataset(imported, destination, settings=self.settings())
        existing_empty = self.work / "existing-empty"
        existing_empty.mkdir()
        with self.assertRaises(FileExistsError):
            data.seal_dataset(imported, existing_empty, settings=self.settings())
        print("SEALED_FIXTURE=" + str(destination))
        print("SEALED_MANIFEST_SHA256=" + sealed.manifest_sha256)


    def test_seal_settings_are_strict_and_captured_before_io(self):
        from unittest.mock import patch
        data = load_data(self)
        path, _ = self.fixture([synthetic_row()], name="settings-source.jsonl")
        imported = data.import_jsonl(path)
        variants = ({}, {"target": "risk"})
        invalid = list(variants)
        for field, value in (("target", "Risk"), ("threshold", True), ("threshold", "0.5"),
                             ("threshold", float("nan")), ("threshold", 1.1), ("seed", "17"),
                             ("seed", True), ("languages", "en"), ("languages", ["en", "en"]),
                             ("languages", [None]), ("text_overlap_normalization", "nfkc-casefold-whitespace/v1"),
                             ("ece_bins", True)):
            settings = self.settings()
            settings[field] = value
            invalid.append(settings)
        for index, settings in enumerate(invalid):
            with self.subTest(index=index, settings=settings):
                destination = self.work / f"invalid-settings-{index}"
                with self.assertRaisesRegex(ValueError, "invalid seal settings"):
                    data.seal_dataset(imported, destination, settings=settings)
                self.assertFalse(destination.exists(), "Reject settings before creating any output")
        settings = self.settings()
        captured = json.loads(json.dumps(settings))
        real_write = data._write_exclusive
        def write_with_caller_mutation(path, payload):
            real_write(path, payload)
            settings["languages"].append("changed-during-io")
        with patch.object(data, "_write_exclusive", side_effect=write_with_caller_mutation):
            sealed = data.seal_dataset(imported, self.work / "captured-settings", settings=settings)
        self.assertEqual(list(sealed.manifest["settings"]["languages"]), captured["languages"])
        self.assertNotIn("changed-during-io", sealed.manifest["settings"]["languages"])


    def test_loading_refuses_incomplete_modified_or_extra_seal_inputs(self):
        from unittest.mock import patch
        data = load_data(self)
        path, _ = self.fixture([synthetic_row("bound.A"), synthetic_row("bound.B", "Second synthetic.", "family.B")], name="binding-source.jsonl")
        sealed = data.seal_dataset(data.import_jsonl(path), self.work / "valid-binding", settings=self.settings())
        original = self.work / "valid-binding"
        captured = {name: (original / name).read_bytes() for name in ("manifest.json", "cases.jsonl", "source.jsonl")}
        def copy_to(name):
            destination = self.work / name
            destination.mkdir()
            for filename, payload in captured.items():
                with (destination / filename).open("xb") as handle:
                    handle.write(payload)
            return destination
        missing = self.work / "missing-manifest"
        missing.mkdir()
        (missing / "cases.jsonl").write_bytes(captured["cases.jsonl"])
        with self.assertRaisesRegex(ValueError, "invalid seal"):
            data.load_sealed(missing, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        changes = (
            ("complete", False), ("release_ready", True), ("independence_established", True),
            ("schema_identity", "edited-schema"), ("importer_identity", "edited-importer"),
            ("grouping_identity", "row-random-is-not-independence"),
            ("ordered_ids", ["bound.B", "bound.A"]), ("n_cases", 2.0),
            ("payload_bytes", float(len(captured["cases.jsonl"]))),
            ("new_silent_metadata", "must reject"),
        )
        for index, (field, value) in enumerate(changes):
            with self.subTest(field=field):
                destination = copy_to(f"modified-manifest-{index}")
                manifest = json.loads(captured["manifest.json"])
                manifest[field] = value
                edited = json.dumps(manifest, ensure_ascii=False).encode("utf-8") + b"\n"
                (destination / "manifest.json").write_bytes(edited)
                with self.assertRaisesRegex(ValueError, "invalid seal"):
                    data.load_sealed(destination, expected_manifest_sha256=hashlib.sha256(edited).hexdigest(), expected_settings=self.settings())
        for index, field in enumerate(json.loads(captured["manifest.json"])):
            with self.subTest(missing_field=field):
                destination = copy_to(f"missing-field-{index}")
                manifest = json.loads(captured["manifest.json"])
                manifest.pop(field)
                edited = json.dumps(manifest).encode("utf-8")
                (destination / "manifest.json").write_bytes(edited)
                with self.assertRaisesRegex(ValueError, "invalid seal"):
                    data.load_sealed(destination, expected_manifest_sha256=hashlib.sha256(edited).hexdigest(), expected_settings=self.settings())
        for name in ("cases.jsonl", "source.jsonl", "manifest.json"):
            with self.subTest(edited_bytes=name):
                destination = copy_to("edited-" + name)
                (destination / name).write_bytes(captured[name] + b" ")
                with self.assertRaisesRegex(ValueError, "invalid seal"):
                    data.load_sealed(destination, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        reversed_order = copy_to("edited-record-order")
        (reversed_order / "cases.jsonl").write_bytes(b"".join(reversed(captured["cases.jsonl"].splitlines(keepends=True))))
        with self.assertRaisesRegex(ValueError, "invalid seal"):
            data.load_sealed(reversed_order, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        extra = copy_to("unbound-extra-file")
        (extra / "unbound-input.txt").write_bytes(b"synthetic unbound input")
        with self.assertRaisesRegex(ValueError, "invalid seal"):
            data.load_sealed(extra, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        settings = self.settings()
        settings["languages"].reverse()
        with self.assertRaisesRegex(ValueError, "settings mismatch"):
            data.load_sealed(original, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=settings)
        race = copy_to("capture-before-mutation")
        real_read, reads = Path.read_bytes, []
        def capture_then_mutate(file):
            payload = real_read(file)
            reads.append(file.name)
            if file == race / "source.jsonl":
                (race / "cases.jsonl").write_bytes(b"changed AFTER verified capture\n")
            return payload
        with patch.object(Path, "read_bytes", capture_then_mutate):
            loaded = data.load_sealed(race, expected_manifest_sha256=sealed.manifest_sha256, expected_settings=self.settings())
        self.assertEqual(loaded.raw_bytes, captured["cases.jsonl"])
        self.assertEqual(loaded.ordered_ids, ("bound.A", "bound.B"))
        self.assertCountEqual(reads, ["manifest.json", "cases.jsonl", "source.jsonl"])
        for name in reads:
            self.assertEqual(reads.count(name), 1, "Hashing and parsing must consume the same read, not reopen")


    def connected_rows(self):
        names = ["group.A", "group.B", "group.C", "group.D", "group.E", "group.F"]
        rows = [synthetic_row(name, "Synthetic distinct text " + name, "family." + name) for name in names]
        rows[1]["source_family"] = rows[0]["source_family"]
        rows[2].update({"parent_id": "group.B", "variant_id": "variant.C", "near_duplicate_group": "declared.CD"})
        rows[3].update({"near_duplicate_group": "declared.CD", "template_family": "global-template.DE"})
        rows[4]["template_family"] = "global-template.DE"
        rows[5]["source_family"] = rows[0]["source_family"] + " "
        return rows

    def test_connected_groups_preserve_transitive_family_parent_duplicate_links(self):
        data = load_data(self)
        self.assertTrue(hasattr(data, "group_cases"), "Grouping must compute connected components, not row-random IDs")
        path, _ = self.fixture(self.connected_rows(), name="connected.jsonl")
        cases = data.import_jsonl(path).cases
        grouping = data.group_cases(cases)
        self.assertEqual(grouping.components, (("group.A", "group.B", "group.C", "group.D", "group.E"), ("group.F",)))
        self.assertEqual(grouping.ordered_ids, tuple(case.id for case in cases))
        self.assertEqual(grouping.identity, data.GROUPING_IDENTITY)
        self.assertNotEqual(grouping.case_to_group["group.A"], grouping.case_to_group["group.F"])
        reversed_grouping = data.group_cases(tuple(reversed(cases)))
        self.assertEqual(reversed_grouping.components, grouping.components)
        self.assertEqual(dict(reversed_grouping.case_to_group), dict(grouping.case_to_group))
        self.assertNotEqual(reversed_grouping.input_sha256, grouping.input_sha256, "Identity must also retain source order")
        with self.assertRaises(TypeError):
            grouping.case_to_group["group.F"] = "mutated"
        with self.assertRaisesRegex(ValueError, "duplicate case ID"):
            data.group_cases((cases[0], cases[0]))
        for updates in ({"source_family": None, "template_family": None}, {"family_metadata_trusted": None},
                        {"family_metadata_trusted": False}, {"source_family": "unknown", "template_family": "unknown"}):
            with self.subTest(updates=updates):
                row = synthetic_row("unknown.family")
                row.update(updates)
                unknown_path, _ = self.fixture([row], name="unknown-family-" + str(len(list(self.work.iterdir()))) + ".jsonl")
                with self.assertRaisesRegex(ValueError, "trustworthy family metadata"):
                    data.group_cases(data.import_jsonl(unknown_path).cases)
        siblings = [synthetic_row("sibling.A", family="family.sibling.A"), synthetic_row("sibling.B", family="family.sibling.B")]
        for row in siblings:
            row["parent_id"] = "external.synthetic.parent"
        sibling_path, _ = self.fixture(siblings, name="siblings.jsonl")
        sibling_groups = data.group_cases(data.import_jsonl(sibling_path).cases)
        self.assertEqual(sibling_groups.components, (("sibling.A", "sibling.B"),))
        self.assertEqual(sibling_groups.unresolved_parent_ids, ("external.synthetic.parent",))
        report_path = self.work / "group-report.json"
        report_path.write_text(json.dumps(grouping.to_dict(), indent=2), encoding="utf-8")
        self.assertFalse(json.loads(report_path.read_text(encoding="utf-8"))["independence_established"])
        print("GROUP_REPORT_FIXTURE=" + str(report_path))


    def test_seeded_component_partitions_reject_connected_leakage(self):
        data = load_data(self)
        self.assertTrue(hasattr(data, "partition_cases"), "Partitions must assign connected components, not rows")
        path, _ = self.fixture(self.connected_rows(), name="partition-source.jsonl")
        cases = data.import_jsonl(path).cases
        proportions = {"diagnostic": 0.5, "validation": 0.5}
        plan = data.partition_cases(cases, proportions=proportions, seed=1729)
        again = data.partition_cases(cases, proportions=proportions, seed=1729)
        self.assertEqual(plan.to_dict(), again.to_dict())
        self.assertEqual(plan.seed, 1729)
        self.assertEqual(set(plan.partitions), {"diagnostic", "validation"})
        self.assertEqual(plan.ordered_ids, tuple(case.id for case in cases))
        locations = {identifier: partition for partition, ids in plan.partitions.items() for identifier in ids}
        self.assertEqual(len(locations), len(cases))
        self.assertEqual(len({locations[identifier] for identifier in ("group.A", "group.B", "group.C", "group.D", "group.E")}), 1)
        self.assertNotEqual(locations["group.A"], locations["group.F"])
        for partition, ids in plan.partitions.items():
            self.assertEqual(tuple(identifier for identifier in plan.ordered_ids if locations[identifier] == partition), ids)
        reversed_plan = data.partition_cases(tuple(reversed(cases)), proportions=proportions, seed=1729)
        reversed_locations = {identifier: partition for partition, ids in reversed_plan.partitions.items() for identifier in ids}
        self.assertEqual(reversed_locations, locations)
        with self.assertRaises(TypeError):
            plan.partitions["diagnostic"] = ()
        report_path = self.work / "partition-report.json"
        report_path.write_text(json.dumps(plan.to_dict(), indent=2), encoding="utf-8")
        persisted = json.loads(report_path.read_text(encoding="utf-8"))
        validated = data.validate_partitions(cases, persisted["partitions"], seed=persisted["seed"])
        self.assertTrue(validated["passed"])
        self.assertFalse(validated["independence_established"])
        self.assertFalse(validated["release_ready"])
        bad = {"diagnostic": ["group.A", "group.B", "group.C", "group.D"], "validation": ["group.E", "group.F"]}
        with self.assertRaisesRegex(ValueError, "connected component straddles"):
            data.validate_partitions(cases, bad, seed=1729)
        invalid_assignments = ({"diagnostic": ["group.A"], "validation": ["group.F"]},
                               {"diagnostic": list(plan.ordered_ids), "validation": ["group.A"]},
                               {"diagnostic": list(plan.ordered_ids) + ["foreign.synthetic.id"], "validation": []})
        for assignment in invalid_assignments:
            with self.subTest(assignment=assignment), self.assertRaisesRegex(ValueError, "partition coverage|duplicate assignment"):
                data.validate_partitions(cases, assignment, seed=1729)
        for seed in (True, "1729", 1.5):
            with self.subTest(seed=seed), self.assertRaisesRegex(ValueError, "seed"):
                data.partition_cases(cases, proportions=proportions, seed=seed)
        for weights in ({}, {"a": 0.2, "b": 0.2}, {"a": True, "b": False}, {"a": "0.5", "b": 0.5}):
            with self.subTest(weights=weights), self.assertRaisesRegex(ValueError, "proportions"):
                data.partition_cases(cases, proportions=weights, seed=1729)
        print("PARTITION_REPORT_FIXTURE=" + str(report_path))


    def test_exact_unicode_overlap_audits_run_positive_controls_and_fail_closed(self):
        import unicodedata
        data = load_data(self)
        self.assertTrue(hasattr(data, "audit_partitions"), "Exact and named Unicode-normalized overlap checks must execute")
        rows = [synthetic_row("exact.left", "Synthetic exact text.", "family.exact.left"),
                synthetic_row("normalized.left", "Synthetic\tＣＡＦＥ\u0301", "family.normalized.left"),
                synthetic_row("clean.left", "Synthetic only-left.", "family.clean.left"),
                synthetic_row("exact.right", "Synthetic exact text.", "family.exact.right"),
                synthetic_row("normalized.right", "synthetic café", "family.normalized.right"),
                synthetic_row("clean.right", "Synthetic only-right.", "family.clean.right")]
        path, _ = self.fixture(rows, name="unicode-overlap.jsonl")
        cases = data.import_jsonl(path).cases
        partitions = {"diagnostic": [case.id for case in cases[:3]], "validation": [case.id for case in cases[3:]]}
        report = data.audit_partitions(cases, partitions, seed=31415)
        self.assertFalse(report["passed"])
        self.assertEqual({(pair["left_id"], pair["right_id"]) for pair in report["exact_text_overlap"]}, {("exact.left", "exact.right")})
        self.assertEqual({(pair["left_id"], pair["right_id"]) for pair in report["normalized_text_overlap"]},
                         {("exact.left", "exact.right"), ("normalized.left", "normalized.right")})
        self.assertTrue(report["positive_controls"]["passed"])
        self.assertEqual(report["positive_controls"]["seed"], 31415)
        self.assertEqual(report["normalization"]["name"], data.TEXT_NORMALIZATION_IDENTITY)
        self.assertEqual(report["normalization"]["unicode_data_version"], unicodedata.unidata_version)
        self.assertFalse(report["independence_established"])
        self.assertFalse(report["release_ready"])
        self.assertEqual(cases[1].text, "Synthetic\tＣＡＦＥ\u0301", "Normalization is a named diagnostic view, never source mutation")
        with self.assertRaisesRegex(ValueError, "text overlap crosses partitions"):
            data.validate_partitions(cases, partitions, seed=31415)
        clean = data.audit_partitions((cases[2], cases[5]), {"diagnostic": ["clean.left"], "validation": ["clean.right"]}, seed=31415)
        self.assertTrue(clean["passed"])
        self.assertFalse(clean["independence_established"], "Unrun lexical/embedding/exposure audits still block independence")
        for name in ("lexical_near_duplicate", "embedding_near_duplicate", "baseline_exposure", "teacher_exposure"):
            self.assertIn(clean["audits"][name], ("not_run", "not_established"))
        cross = data.audit_overlap(cases[:3], cases[3:], seed=31415, reference_name="synthetic-fixture-exposure")
        self.assertFalse(cross["passed"])
        self.assertEqual(cross["reference_name"], "synthetic-fixture-exposure")
        self.assertEqual(len(cross["exact_text_overlap"]), 1)
        self.assertEqual(len(cross["normalized_text_overlap"]), 2)
        turns = [synthetic_row("turn.left", "Left original.", "family.turn.left"), synthetic_row("turn.right", "Right original.", "family.turn.right")]
        turns[0]["turns"] = [{"role": "tool", "text": "Synthetic shared turn"}]
        turns[1]["turns"] = [{"role": "user", "text": "Synthetic shared turn"}]
        turn_path, _ = self.fixture(turns, name="turn-overlap.jsonl")
        turn_report = data.audit_partitions(data.import_jsonl(turn_path).cases, {"diagnostic": ["turn.left"], "validation": ["turn.right"]}, seed=31415)
        self.assertFalse(turn_report["passed"])
        self.assertEqual(turn_report["exact_text_overlap"][0]["left_view"]["role"], "tool")
        self.assertEqual(turn_report["exact_text_overlap"][0]["right_view"]["role"], "user")
        with self.assertRaisesRegex(ValueError, "unknown named normalization"):
            data.audit_partitions(cases, partitions, seed=31415, normalization="nfkc-casefold-whitespace/v1")
        controls = data.run_overlap_controls(seed=31415)
        self.assertTrue(controls["exact_positive"])
        self.assertTrue(controls["unicode_normalized_positive"])
        self.assertTrue(controls["negative_control"])
        report_path = self.work / "overlap-report.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        self.assertEqual(json.loads(report_path.read_text(encoding="utf-8"))["seed"], 31415)
        print("OVERLAP_REPORT_FIXTURE=" + str(report_path))


    def test_seal_binds_computed_grouping_unicode_identity_and_partition_plan(self):
        data = load_data(self)
        path, _ = self.fixture(self.connected_rows(), name="grouped-seal-source.jsonl")
        imported = data.import_jsonl(path)
        settings = self.settings()
        settings["seed"] = 1729
        plan = data.partition_cases(imported.cases, proportions={"diagnostic": 0.5, "validation": 0.5}, seed=1729)
        self.assertIn("partition_plan", __import__("inspect").signature(data.seal_dataset).parameters,
                      "Sealing must bind and verify a real computed partition plan, not just descriptive settings")
        sealed = data.seal_dataset(imported, self.work / "grouped-seal", settings=settings, partition_plan=plan)
        self.assertEqual(sealed.manifest["grouping"]["status"], "computed_diagnostic")
        self.assertEqual(tuple(tuple(ids) for ids in sealed.manifest["grouping"]["assignment"]["components"]), plan.grouping.components)
        self.assertEqual(sealed.manifest["normalization"]["name"], data.TEXT_NORMALIZATION_IDENTITY)
        self.assertEqual(sealed.manifest["partition_plan"]["sha256"], plan.sha256)
        self.assertEqual(tuple(sealed.manifest["partition_plan"]["record"]["ordered_ids"]), imported.ordered_ids)
        loaded = data.load_sealed(self.work / "grouped-seal", expected_manifest_sha256=sealed.manifest_sha256, expected_settings=settings)
        self.assertEqual(loaded.manifest_sha256, sealed.manifest_sha256)
        self.assertFalse(loaded.release_ready)
        mismatched = self.settings()
        mismatched["seed"] = 99
        destination = self.work / "mismatched-plan-settings"
        with self.assertRaisesRegex(ValueError, "partition plan.*seed|seed.*partition plan"):
            data.seal_dataset(imported, destination, settings=mismatched, partition_plan=plan)
        self.assertFalse(destination.exists())
        original = self.work / "grouped-seal"
        tampered = self.work / "tampered-unicode-version"
        tampered.mkdir()
        for name in ("cases.jsonl", "source.jsonl"):
            (tampered / name).write_bytes((original / name).read_bytes())
        manifest = json.loads((original / "manifest.json").read_bytes())
        manifest["normalization"]["unicode_data_version"] = "unrecognized-runtime-version"
        payload = json.dumps(manifest).encode("utf-8")
        (tampered / "manifest.json").write_bytes(payload)
        with self.assertRaisesRegex(ValueError, "normalization identity mismatch"):
            data.load_sealed(tampered, expected_manifest_sha256=hashlib.sha256(payload).hexdigest(), expected_settings=settings)
        with self.assertRaises(TypeError):
            data.UNESTABLISHED_AUDITS["teacher_exposure"] = "established"
        print("GROUPED_SEAL_FIXTURE=" + str(original))

    def test_sealed_aggregation_consumes_verified_bytes_and_pinned_settings(self):
        from dataclasses import replace
        from unittest.mock import patch
        data = load_data(self)
        self.assertTrue(hasattr(data, "aggregate_sealed"),
                        "Metric aggregation must consume the verified seal bytes and their pinned target/settings")
        core = importlib.import_module("eval_harness.core")
        rows = [synthetic_row("integrated.neg", "Synthetic sealed benign fixture.", "integrated.family.neg"),
                synthetic_row("integrated.pos", "Synthetic sealed risk fixture.", "integrated.family.pos")]
        rows[1].update({"label": "PROMPT_INJECTION", "gold_positive": True})
        for row in rows:
            row["slices"] = list(core.REQUIRED_SLICES)
        source_path, source_payload = self.fixture(rows, name="synthetic-integration-source.jsonl")
        imported = data.import_jsonl(source_path)
        settings = self.settings()
        settings.update({"threshold": 0.8, "ece_bins": 5})
        plan = data.partition_cases(imported.cases, proportions={"diagnostic": 0.5, "validation": 0.5}, seed=settings["seed"])
        destination = self.work / "integrated-seal"
        sealed = data.seal_dataset(imported, destination, settings=settings, partition_plan=plan)
        self.assertEqual(core.cases_fingerprint(sealed.cases), sealed.manifest["payload_sha256"])
        score_row = {"case_ids": list(sealed.ordered_ids), "scores": [0.1, 0.7], "missing_reasons": [None, None],
                     "target": "risk", "model_identity": "synthetic-sealed-probability-fixture/not-model-inference",
                     "dataset_sha256": sealed.manifest["payload_sha256"], "score_contract": "target_probability/v1"}
        score_path = self.work / "synthetic-sealed-score-batch.json"
        score_path.write_text(json.dumps(score_row, allow_nan=False), encoding="utf-8")
        batch = core.ScoreBatch.from_dict(json.loads(score_path.read_bytes()))
        for name in ("cases.jsonl", "source.jsonl", "manifest.json"):
            (destination / name).write_bytes(b"path changed AFTER verified capture\n")
        source_path.write_bytes(b"caller source path also changed\n")
        with patch.object(Path, "read_bytes", side_effect=AssertionError("must not reopen mutable inputs after verified capture")):
            result = data.aggregate_sealed(sealed, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                           expected_settings=settings, expected_model_identity=batch.model_identity)
        self.assertEqual(result["threshold"], 0.8)
        self.assertEqual(result["ece_bins"], 5)
        self.assertEqual(result["target"], "risk")
        self.assertEqual(tuple(result["slices"]), core.REQUIRED_SLICES)
        self.assertEqual(tuple(result["languages"]), ("en", "hi"))
        self.assertEqual(result["languages"]["hi"]["overall"]["n"], 0)
        reference = core.binary_metrics([False, True], [0.1, 0.7], threshold=0.8, n_bins=5)
        for name in ("n", "tp", "fn", "tn", "fp", "ece"):
            self.assertEqual(result["overall"][name], reference[name])
        self.assertEqual(result["seal"]["manifest_sha256"], sealed.manifest_sha256)
        self.assertEqual(result["seal"]["source_input_sha256"], hashlib.sha256(source_payload).hexdigest())
        self.assertFalse(result["release_ready"])
        self.assertFalse(result["independence_established"])
        self.assertEqual(result["audits"]["teacher_exposure"], "not_established")
        with self.assertRaisesRegex(ValueError, "manifest.*fingerprint|manifest.*mismatch"):
            data.aggregate_sealed(sealed, batch, expected_manifest_sha256="0" * 64,
                                  expected_settings=settings, expected_model_identity=batch.model_identity)
        wrong_settings = dict(settings)
        wrong_settings["threshold"] = 0.5
        with self.assertRaisesRegex(ValueError, "settings mismatch"):
            data.aggregate_sealed(sealed, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                  expected_settings=wrong_settings, expected_model_identity=batch.model_identity)
        forged = replace(sealed, dataset=replace(sealed.dataset, raw_bytes=b"{}\n"))
        with self.assertRaisesRegex(ValueError, "invalid seal"):
            data.aggregate_sealed(forged, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                  expected_settings=settings, expected_model_identity=batch.model_identity)
        report_path = self.work / "synthetic-sealed-coverage-report.json"
        report_path.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
        self.assertEqual(json.loads(report_path.read_text(encoding="utf-8"))["seal"]["manifest_sha256"], sealed.manifest_sha256)
        print("SEALED_COVERAGE_REPORT_FIXTURE=" + str(report_path))

    def test_partition_order_survives_manifest_serialization(self):
        data = load_data(self)
        path, _ = self.fixture(self.connected_rows(), name="reverse-named-partition-order.jsonl")
        imported = data.import_jsonl(path)
        settings = self.settings()
        plan = data.partition_cases(imported.cases, proportions={"validation": 0.5, "diagnostic": 0.5}, seed=settings["seed"])
        self.assertEqual(tuple(plan.partitions), ("validation", "diagnostic"))
        try:
            sealed = data.seal_dataset(imported, self.work / "reverse-ordered-partition-seal", settings=settings, partition_plan=plan)
        except ValueError as error:
            self.fail(f"Canonical JSON object sorting must not erase the explicitly declared partition order: {error}")
        self.assertEqual(tuple(sealed.manifest["partition_plan"]["record"]["partition_order"]), ("validation", "diagnostic"))
        self.assertEqual(sealed.manifest["partition_plan"]["sha256"], plan.sha256)
        loaded = data.load_sealed(self.work / "reverse-ordered-partition-seal", expected_manifest_sha256=sealed.manifest_sha256,
                                  expected_settings=settings)
        self.assertEqual(loaded.manifest["partition_plan"]["sha256"], plan.sha256)
        source = self.work / "reverse-ordered-partition-seal"
        tampered = self.work / "tampered-declared-partition-order"
        tampered.mkdir()
        for name in ("cases.jsonl", "source.jsonl"):
            (tampered / name).write_bytes((source / name).read_bytes())
        manifest = json.loads((source / "manifest.json").read_bytes())
        manifest["partition_plan"]["record"]["partition_order"].reverse()
        payload = json.dumps(manifest, ensure_ascii=False).encode("utf-8")
        (tampered / "manifest.json").write_bytes(payload)
        with self.assertRaisesRegex(ValueError, "partition plan.*mismatch"):
            data.load_sealed(tampered, expected_manifest_sha256=hashlib.sha256(payload).hexdigest(), expected_settings=settings)

    def test_declared_source_family_connects_variants_across_versions(self):
        data = load_data(self)
        rows = [synthetic_row("versioned.parent", "Synthetic first-version family member.", "synthetic.versioned.family"),
                synthetic_row("versioned.variant", "Synthetic different-version family member.", "synthetic.versioned.family")]
        rows[0]["template_family"], rows[1]["template_family"] = "versioned.template.one", "versioned.template.two"
        rows[1]["source_version"] = "fixture-v02"
        path, _ = self.fixture(rows, name="synthetic-versioned-family.jsonl")
        imported = data.import_jsonl(path)
        grouping = data.group_cases(imported.cases)
        self.assertEqual(grouping.components, (("versioned.parent", "versioned.variant"),),
                         "A source version cannot sever an explicitly shared source-family lineage")
        self.assertEqual(imported.cases[0].source_version, "fixture-v01")
        self.assertEqual(imported.cases[1].source_version, "fixture-v02")
        self.assertEqual(grouping.to_dict()["source_family_namespace"], ["source", "source_family"])
        with self.assertRaisesRegex(ValueError, "connected component straddles"):
            data.validate_partitions(imported.cases, {"diagnostic": ["versioned.parent"], "validation": ["versioned.variant"]}, seed=17)
        self.assertFalse(grouping.to_dict()["independence_established"])

    def test_strict_jsonl_rejects_unpaired_surrogate_escapes(self):
        data = load_data(self)
        changes = ({"text": "Synthetic isolated \ud800 scalar"}, {"id": "synthetic.invalid.\udfff"},
                   {"turns": [{"role": "tool", "text": "Synthetic \udc00 turn"}]},
                   {"source": "synthetic.source.\ud800"},
                   {"provenance": {"status": "declared", "invalid_scalar": "\udc00"}},
                   {"extensions": {"\udfff": "synthetic metadata"}})
        for index, change in enumerate(changes):
            row = synthetic_row()
            row.update(change)
            payload = json.dumps(row, ensure_ascii=True).encode("ascii") + b"\n"
            path = self.work / f"invalid-unicode-scalar-{index}.jsonl"
            path.write_bytes(payload)
            with self.subTest(escaped_unicode_field=index), self.assertRaisesRegex(ValueError, "invalid JSONL line 1"):
                data.import_jsonl(path)
        valid = synthetic_row(text="Synthetic 😀 cafe\u0301 exact text.")
        payload = json.dumps(valid, ensure_ascii=True).encode("ascii") + b"\n"
        path = self.work / "valid-escaped-unicode-pair.jsonl"
        path.write_bytes(payload)
        imported = data.import_jsonl(path)
        self.assertEqual(imported.cases[0].text, valid["text"])
        self.assertEqual(imported.raw_bytes, payload)
        self.assertEqual(imported.raw_sha256, hashlib.sha256(payload).hexdigest())




class SealCapturedTypeTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-c6fb0ec8-core-cycle1-seal-object-", dir=SCRATCH))
        print("CYCLE1_SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def test_seal_rejects_type_changed_captured_case_before_output(self):
        from dataclasses import replace

        data = load_data(self)
        row = synthetic_row("cycle1.object.type", "Synthetic exact 😀 cafe\u0301  record.")
        row["expected_effective_findings"] = [
            {"type": "PII", "extensions": {"nested": [{"review_marker": 1}]}}
        ]
        payload = json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n"
        imported = data.import_jsonl_bytes(payload)
        changed = imported.cases[0].to_dict()
        changed["expected_effective_findings"][0]["extensions"]["nested"][0]["review_marker"] = True
        supplied = replace(imported, cases=(data.Case.from_dict(changed),))
        destination = self.work / "rejected-type-changed-object"
        with self.assertRaisesRegex(ValueError, "captured bytes and parsed cases disagree"):
            data.seal_dataset(supplied, destination, settings=SyntheticDataTests().settings())
        self.assertFalse(destination.exists())
        self.assertIs(type(imported.cases[0].expected_effective_findings[0]["extensions"]["nested"][0]["review_marker"]), int)
        valid = data.seal_dataset(imported, self.work / "valid-exact-object", settings=SyntheticDataTests().settings())
        self.assertEqual(valid.source_dataset.raw_bytes, payload)
        self.assertEqual(valid.cases[0].text, row["text"])
        self.assertIs(type(valid.cases[0].expected_effective_findings[0]["extensions"]["nested"][0]["review_marker"]), int)
        self.assertFalse(valid.release_ready)


class PinnedSealTypeTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-c6fb0ec8-core-cycle1-pinned-types-", dir=SCRATCH))
        print("CYCLE1_SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def test_pinned_seal_rejects_source_record_type_changes(self):
        data = load_data(self)
        core = importlib.import_module("eval_harness.core")
        settings = SyntheticDataTests().settings()
        row = synthetic_row(" cycle1.pinned.😀 ", "Synthetic exact cafe\u0301  source record.")
        row["expected_effective_findings"] = [
            {"type": "PII", "extensions": {"nested": [{"review_marker": 1}]}}
        ]
        source_bytes = json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n"
        original = data.seal_dataset(data.import_jsonl_bytes(source_bytes), self.work / "valid", settings=settings)
        changed = original.cases[0].to_dict()
        changed["expected_effective_findings"][0]["extensions"]["nested"][0]["review_marker"] = True
        changed_bytes = json.dumps(changed, ensure_ascii=False).encode("utf-8") + b"\n"
        changed_dataset = data.import_jsonl_bytes(changed_bytes)
        manifest = json.loads(original.manifest_bytes)
        manifest["payload_sha256"] = hashlib.sha256(changed_bytes).hexdigest()
        manifest["payload_bytes"] = len(changed_bytes)
        manifest["serialized_source_fingerprints"] = data._thaw_json(changed_dataset.source_fingerprints)
        manifest_bytes = json.dumps(manifest, ensure_ascii=False).encode("utf-8") + b"\n"
        pin = hashlib.sha256(manifest_bytes).hexdigest()
        destination = self.work / "internally-inconsistent-but-correctly-pinned"
        destination.mkdir()
        for name, payload in (("manifest.json", manifest_bytes), ("cases.jsonl", changed_bytes), ("source.jsonl", source_bytes)):
            with (destination / name).open("xb") as handle:
                handle.write(payload)
        captured = data.SealedDataset(changed_dataset, original.source_dataset, manifest_bytes, manifest)
        batch = core.ScoreBatch(changed_dataset.ordered_ids, (0.1,), (None,), "risk",
                                "cycle1.synthetic-probabilities/no-inference", core.cases_fingerprint(changed_dataset.cases))
        for entry in ("load_sealed", "aggregate_sealed"):
            with self.subTest(public_entry=entry), self.assertRaisesRegex(ValueError, "serialized cases differ from captured source"):
                if entry == "load_sealed":
                    data.load_sealed(destination, expected_manifest_sha256=pin, expected_settings=settings)
                else:
                    data.aggregate_sealed(captured, batch, expected_manifest_sha256=pin,
                                          expected_settings=settings, expected_model_identity=batch.model_identity)
        loaded = data.load_sealed(self.work / "valid", expected_manifest_sha256=original.manifest_sha256, expected_settings=settings)
        valid_batch = core.ScoreBatch(loaded.ordered_ids, (0.1,), (None,), "risk", batch.model_identity,
                                      core.cases_fingerprint(loaded.cases))
        result = data.aggregate_sealed(loaded, valid_batch, expected_manifest_sha256=loaded.manifest_sha256,
                                      expected_settings=settings, expected_model_identity=batch.model_identity)
        self.assertEqual(loaded.source_dataset.raw_bytes, source_bytes)
        self.assertEqual(loaded.cases[0].text, row["text"])
        self.assertIs(type(loaded.cases[0].expected_effective_findings[0]["extensions"]["nested"][0]["review_marker"]), int)
        self.assertEqual(result["overall"]["n"], 1)
        self.assertFalse(result["release_ready"])


class ExactUnknownParentTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-c6fb0ec8-core-cycle1-parent-alias-", dir=SCRATCH))
        print("CYCLE1_SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def test_partitions_refuse_to_separate_exact_unknown_parent(self):
        data = load_data(self)
        rows = [synthetic_row("unknown", "Synthetic known-parent exact text.", "cycle1.family.parent"),
                synthetic_row("cycle1.child", "Synthetic distinct child exact text.", "cycle1.family.child")]
        rows[1]["parent_id"] = "unknown"
        cases = tuple(data.Case.from_dict(row) for row in rows)
        split = {"diagnostic": ["unknown"], "validation": ["cycle1.child"]}
        with self.assertRaisesRegex(ValueError, "connected component straddles partitions"):
            data.validate_partitions(cases, split, seed=17)
        grouping = data.group_cases(cases)
        self.assertEqual(grouping.components, (("cycle1.child", "unknown"),))
        self.assertEqual(grouping.unresolved_parent_ids, ())
        report = data.audit_partitions(cases, split, seed=17)
        self.assertFalse(report["passed"])
        self.assertEqual(report["checks"]["connected_components"], "failed")
        self.assertEqual(report["component_leakage"][0]["case_ids"], ["cycle1.child", "unknown"])
        self.assertEqual(report["exact_text_overlap"], [])
        self.assertEqual(report["normalized_text_overlap"], [])
        plan = data.partition_cases(cases, proportions={"diagnostic": 0.5, "validation": 0.5}, seed=17)
        locations = {identifier: name for name, identifiers in plan.partitions.items() for identifier in identifiers}
        self.assertEqual(locations["unknown"], locations["cycle1.child"])
        source_bytes = b"".join(json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n" for row in rows)
        sealed = data.seal_dataset(data.import_jsonl_bytes(source_bytes), self.work / "exact-parent-seal",
                                   settings=SyntheticDataTests().settings(), partition_plan=plan)
        loaded = data.load_sealed(self.work / "exact-parent-seal", expected_manifest_sha256=sealed.manifest_sha256,
                                  expected_settings=SyntheticDataTests().settings())
        self.assertEqual(loaded.cases[0].id, "unknown")
        self.assertEqual(loaded.cases[1].parent_id, "unknown")
        self.assertEqual(loaded.source_dataset.raw_bytes, source_bytes)
        self.assertEqual(tuple(tuple(ids) for ids in loaded.manifest["grouping"]["assignment"]["components"]), grouping.components)
        self.assertEqual(data.group_cases((cases[1],)).unresolved_parent_ids, ("unknown",))
        absent = data.Case.from_dict(synthetic_row("cycle1.absent", "Synthetic no parent.", "cycle1.family.absent"))
        self.assertIsNone(absent.parent_id)
        self.assertEqual(data.group_cases((absent,)).unresolved_parent_ids, ())
        self.assertFalse(loaded.release_ready)
        self.assertFalse(report["release_ready"])


class ExactUnknownVariantTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-c6fb0ec8-core-cycle1-variant-alias-", dir=SCRATCH))
        print("CYCLE1_SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def test_unknown_variant_alias_remains_exact_and_connected(self):
        data = load_data(self)
        for scenario in ("accepted_case_id", "parent_reference", "shared_variant_alias"):
            rows = [synthetic_row("cycle1.owner", "Synthetic distinct variant owner.", "cycle1.variant.owner"),
                    synthetic_row("unknown" if scenario == "accepted_case_id" else "cycle1.linked",
                                  "Synthetic distinct linked node.", "cycle1.variant.linked")]
            rows[0]["variant_id"] = "unknown"
            if scenario == "parent_reference":
                rows[1]["parent_id"] = "unknown"
            elif scenario == "shared_variant_alias":
                rows[1]["variant_id"] = "unknown"
            with self.subTest(alias_relationship=scenario):
                cases = tuple(data.Case.from_dict(row) for row in rows)
                identifiers = tuple(case.id for case in cases)
                grouping = data.group_cases(cases)
                self.assertEqual(grouping.components, (tuple(sorted(identifiers)),))
                self.assertEqual(grouping.unresolved_parent_ids, ())
                split = {"diagnostic": [identifiers[0]], "validation": [identifiers[1]]}
                self.assertFalse(data.audit_partitions(cases, split, seed=17)["passed"])
                with self.assertRaisesRegex(ValueError, "connected component straddles partitions"):
                    data.validate_partitions(cases, split, seed=17)
                plan = data.partition_cases(cases, proportions={"diagnostic": 0.5, "validation": 0.5}, seed=17)
                source = b"".join(json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n" for row in rows)
                sealed = data.seal_dataset(data.import_jsonl_bytes(source), self.work / scenario,
                                           settings=SyntheticDataTests().settings(), partition_plan=plan)
                self.assertEqual(sealed.source_dataset.raw_bytes, source)
                self.assertEqual(sealed.cases[0].variant_id, "unknown")
                self.assertEqual(sealed.manifest["partition_plan"]["sha256"], plan.sha256)
                self.assertFalse(sealed.release_ready)
        rows = [synthetic_row("cycle1.exact.owner", "Synthetic exact alias owner.", "cycle1.exact.owner.family"),
                synthetic_row("unknown ", "Synthetic different exact spaced ID.", "cycle1.exact.spaced.family")]
        rows[0]["variant_id"] = "unknown"
        cases = tuple(data.Case.from_dict(row) for row in rows)
        grouping = data.group_cases(cases)
        self.assertEqual(len(grouping.components), 2)
        report = data.validate_partitions(cases, {"diagnostic": [cases[0].id], "validation": [cases[1].id]}, seed=17)
        self.assertTrue(report["passed"])
        self.assertEqual(cases[1].id, "unknown ")
        self.assertIsNone(cases[1].variant_id)
        self.assertFalse(report["independence_established"])


class CapturedObjectTypeProbeTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), SCRATCH.resolve())
        self.work = Path(tempfile.mkdtemp(prefix="soter-c6fb0ec8-core-cycle1-capture-probe-", dir=SCRATCH))
        print("CYCLE1_SYNTHETIC_FIXTURE_ROOT=" + str(self.work))

    def test_captured_object_checks_reject_boolean_integer_type_swaps(self):
        from dataclasses import replace

        data = load_data(self)
        core = importlib.import_module("eval_harness.core")
        settings = SyntheticDataTests().settings()
        for index, (source_value, substituted) in enumerate(((1, True), (True, 1), (0, False), (False, 0))):
            row = synthetic_row("cycle1.object.swap." + str(index), "Synthetic distinct typed capture " + str(index))
            row["extensions"] = {"nested": [{"marker": source_value}]}
            imported = data.import_jsonl_bytes(json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n")
            sealed = data.seal_dataset(imported, self.work / ("valid-" + str(index)), settings=settings)
            batch = core.ScoreBatch(sealed.ordered_ids, (0.1,), (None,), "risk", "cycle1.synthetic/no-inference",
                                    core.cases_fingerprint(sealed.cases))
            for field in ("dataset", "source_dataset"):
                supplied = getattr(sealed, field)
                changed = supplied.cases[0].to_dict()
                changed["extensions"]["nested"][0]["marker"] = substituted
                forged = replace(sealed, **{field: replace(supplied, cases=(data.Case.from_dict(changed),))})
                with self.subTest(supplied_capture=field, swap=index), self.assertRaisesRegex(ValueError, "supplied cases/records disagree"):
                    data.aggregate_sealed(forged, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                          expected_settings=settings, expected_model_identity=batch.model_identity)
            changed = imported.cases[0].to_dict()
            changed["extensions"]["nested"][0]["marker"] = substituted
            supplied = replace(imported, cases=(data.Case.from_dict(changed),))
            destination = self.work / ("rejected-" + str(index))
            with self.subTest(public_entry="seal_dataset", swap=index), self.assertRaisesRegex(ValueError, "captured bytes and parsed cases disagree"):
                data.seal_dataset(supplied, destination, settings=settings)
            self.assertFalse(destination.exists())
            self.assertIs(type(sealed.cases[0].extensions["nested"][0]["marker"]), type(source_value))
            valid = data.aggregate_sealed(sealed, batch, expected_manifest_sha256=sealed.manifest_sha256,
                                         expected_settings=settings, expected_model_identity=batch.model_identity)
            self.assertEqual(valid["overall"]["n"], 1)
            self.assertFalse(valid["release_ready"])


class OverlapReferenceScalarTests(unittest.TestCase):
    def test_reference_name_rejects_surrogates_without_changing_valid_reports(self):
        data = load_data(self)
        candidate_row = synthetic_row(" synthetic.candidate.\U0001f680 ", "Synthetic\x00 candidate cafe\u0301 \U0001f680\r\n ", "family.candidate")
        reference_row = synthetic_row("synthetic.reference", "Synthetic distinct reference.", "family.reference")
        candidate_row["extensions"] = {"flag": True, "marker": 1}
        captured = tuple(data.import_jsonl_bytes(json.dumps(row, ensure_ascii=False).encode("utf-8") + b"\n")
                         for row in (candidate_row, reference_row))
        candidates, references = (item.cases for item in captured)
        before = [(item.raw_bytes, item.raw_sha256,
                   json.dumps([case.to_dict() for case in item.cases], ensure_ascii=False, sort_keys=True,
                              separators=(",", ":"), allow_nan=False).encode("utf-8")) for item in captured]
        invalid = [json.loads('"' + "\\u" + value + '"') for value in ("d800", "dbff", "dc00", "dfff")]
        invalid += ["synthetic." + value + ".reference" for value in invalid]
        for name in invalid:
            with self.subTest(reference_name=repr(name)), self.assertRaisesRegex(ValueError, "invalid reference_name.*Unicode scalars"):
                data.audit_overlap(candidates, references, seed=31415, reference_name=name)
        for name in (None, True, 1, b"synthetic", "", " \r\n "):
            with self.subTest(reference_name_type=type(name).__name__), self.assertRaisesRegex(ValueError, "invalid reference_name.*exact nonempty string"):
                data.audit_overlap(candidates, references, seed=31415, reference_name=name)
        baseline = data.audit_overlap(candidates, references, seed=31415, reference_name="synthetic-valid-control")
        exact_names = (" synthetic.reference.\U0001f680 cafe\u0301 \r\n ", "synthetic.café", "synthetic.cafe\u0301",
                       "\x00\ud7ff\ue000\ufffd\U0010ffff")
        work = Path(tempfile.mkdtemp(prefix="soter-core-cycle2-reference-scalars-", dir=SCRATCH))
        for index, name in enumerate(exact_names):
            result = data.audit_overlap(candidates, references, seed=31415, reference_name=name)
            self.assertEqual(result["reference_name"], name)
            self.assertIs(type(result["reference_name"]), str)
            expected = {**baseline, "reference_name": name}
            payload = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8", errors="strict")
            self.assertEqual(payload, json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8"))
            self.assertTrue(result["passed"])
            self.assertTrue(result["positive_controls"]["synthetic_only"])
            self.assertIs(result["independence_established"], False)
            self.assertIs(result["release_ready"], False)
            report = work / f"reference-{index}.json"
            report.write_bytes(payload)
            decoded = json.loads(report.read_bytes().decode("utf-8", errors="strict"))
            self.assertEqual(decoded["reference_name"], name)
            self.assertEqual(json.dumps(decoded, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8"), payload)
        after = [(item.raw_bytes, item.raw_sha256,
                  json.dumps([case.to_dict() for case in item.cases], ensure_ascii=False, sort_keys=True,
                             separators=(",", ":"), allow_nan=False).encode("utf-8")) for item in captured]
        self.assertEqual(after, before)
        self.assertIs(candidates[0].gold_positive, False)
        self.assertIs(type(candidates[0].extensions["flag"]), bool)
        self.assertIs(type(candidates[0].extensions["marker"]), int)
        print("REFERENCE_SCALAR_REPORT_FIXTURE=" + str(work))


class DataDirectEntrypointTests(unittest.TestCase):
    def test_direct_script_executes_existing_late_regression(self):
        import os
        import re
        import subprocess
        import sys

        self.assertEqual(Path(tempfile.gettempdir()), SCRATCH)
        self.assertEqual(Path.cwd(), ROOT)
        self.assertTrue(sys.dont_write_bytecode)
        environment_values = {"TMPDIR": str(SCRATCH), "TMP": str(SCRATCH), "TEMP": str(SCRATCH),
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
        argv = [sys.executable, "-B", str(Path(__file__).resolve()), "-k", "SealCapturedTypeTests"]
        work = Path(tempfile.mkdtemp(prefix="soter-core-cycle2-data-guard-probe-", dir=SCRATCH))
        invocation = {"argv": argv, "cwd": str(ROOT), "environment": environment_values,
                      "source4_before": source4, "synthetic_only": True,
                      "expected_ids": ["eval_harness/tests/test_data.py::SealCapturedTypeTests::test_seal_rejects_type_changed_captured_case_before_output"]}
        (work / "invocation.json").write_text(json.dumps(invocation, sort_keys=True, indent=2), encoding="utf-8")
        completed = subprocess.run(argv, cwd=ROOT, env=environment, capture_output=True, timeout=120, check=False)
        (work / "stdout.bin").write_bytes(completed.stdout)
        (work / "stderr.bin").write_bytes(completed.stderr)
        text = (completed.stdout + b"\n" + completed.stderr).decode("utf-8", errors="strict")
        ran = re.findall(r"^Ran (\d+) tests? in ", text, re.MULTILINE)
        passed_lines = re.findall(r"^(test_\w+) \(__main__\.(\w+)\.[^)]+\) \.\.\. ok\r?$", text, re.MULTILINE)
        passed = sorted("eval_harness/tests/test_data.py::" + cls + "::" + method for method, cls in passed_lines)
        result = {"native_exit": completed.returncode, "ran_counts": ran, "passed_ids": passed,
                  "stdout_sha256": hashlib.sha256(completed.stdout).hexdigest(),
                  "stderr_sha256": hashlib.sha256(completed.stderr).hexdigest(),
                  "stdout_bytes": len(completed.stdout), "stderr_bytes": len(completed.stderr),
                  "ok_outcome": bool(re.search(r"^OK\r?$", text, re.MULTILINE)),
                  "skips": bool(re.search(r"\.\.\. skipped|OK \(skipped=", text))}
        (work / "result.json").write_text(json.dumps(result, sort_keys=True, indent=2), encoding="utf-8")
        print("DATA_GUARD_PROBE_EVIDENCE=" + str(work))
        self.assertEqual(completed.returncode, 0, text)
        self.assertEqual(passed, invocation["expected_ids"],
                         "direct data entrypoint must execute the existing late regression")
        self.assertEqual(ran, ["1"], text)
        self.assertTrue(result["ok_outcome"], text)
        self.assertFalse(result["skips"], text)
if __name__ == "__main__":
    unittest.main(verbosity=2)
