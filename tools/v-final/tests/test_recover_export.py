"""Offline recovery tests; temporary fixtures use Hermes scratch only."""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import mmap
import os
import shutil
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import types
import unittest
import weakref
from unittest.mock import patch as observe_patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tools/v-final/recover_export.py"
RECOVERY_ROOT = ROOT / "artifacts/ml/v-final/phase1/v18-recovered"
SOURCE = ROOT / "models/ml-classifier-v18-candidate"


def cleanup_fixture(temporary):
    """Retry only transient Windows sharing violations, within a bounded wait."""
    for attempt, delay in enumerate((0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5, 2.0)):
        try:
            temporary.cleanup()
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(delay)


class SafetyTests(unittest.TestCase):
    def setUp(self):
        scratch = Path(os.environ["TMPDIR"])
        scratch.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="soter-recovery-", dir=scratch)
        self.addCleanup(cleanup_fixture, self.temporary)
        self.work = Path(self.temporary.name)

    def cli(self, source, output, *extra):
        self.assertTrue(SCRIPT.is_file(), "Recovery CLI has not been implemented")
        env = dict(os.environ, HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                   HF_HUB_DISABLE_TELEMETRY="1", PYTHONDONTWRITEBYTECODE="1",
                   OMP_NUM_THREADS="2", MKL_NUM_THREADS="2", TOKENIZERS_PARALLELISM="false")
        # Exercise main() in a subprocess, moving only its output safety boundary
        # to this test's scratch directory. Production defaults are asserted first.
        launcher = (
            "import importlib.util,sys; from pathlib import Path; "
            "s=importlib.util.spec_from_file_location('recovery_cli',sys.argv[1]); "
            "m=importlib.util.module_from_spec(s); s.loader.exec_module(m); "
            "assert m.RECOVERY_ROOT == Path(sys.argv[2]); "
            "m.RECOVERY_ROOT=Path(sys.argv[3]); "
            "raise SystemExit(m.main(sys.argv[4:]))"
        )
        return subprocess.run(
            [sys.executable, "-B", "-c", launcher, str(SCRIPT), str(RECOVERY_ROOT),
             str(self.work), "--source-dir", str(source),
             "--output-dir", str(output), *extra],
            cwd=ROOT, env=env, capture_output=True, text=True, timeout=600,
        )

    def test_transient_windows_fixture_lock_is_retried(self):
        self.assertIn("cleanup_fixture", globals(), "Bounded cleanup retry is missing")
        marker = self.work / "locked.txt"
        marker.write_bytes(b"temporary fixture only")
        handle = marker.open("rb")
        release = threading.Thread(target=lambda: (time.sleep(0.25), handle.close()))
        release.start()
        try:
            cleanup_fixture(self.temporary)
        finally:
            release.join()
        self.assertFalse(self.work.exists())

    def test_missing_source_is_rejected_without_creating_output(self):
        output = self.work / "output"
        result = self.cli(self.work / "missing", output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source directory does not exist", result.stderr.lower())
        self.assertFalse(output.exists())

    def module(self):
        self.assertTrue(SCRIPT.is_file())
        spec = importlib.util.spec_from_file_location("recover_export_under_test", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.RECOVERY_ROOT, RECOVERY_ROOT)
        module.RECOVERY_ROOT = self.work
        return module

    def test_invalid_state_is_rejected_with_weights_only_loading(self):
        import torch
        recovery = self.module()
        self.assertTrue(hasattr(recovery, "load_state"), "Safe state loading is missing")
        source = self.metadata_fixture()
        state_path = source / "pytorch_model.bin"
        variants = [
            (b"not a torch serialization", "weights_only"),
            ({"bad": object()}, "weights_only"),
            ({"bad": "not a tensor"}, "tensor mapping"),
            ({"bad": torch.tensor([float("nan")])}, "nonfinite"),
            ({"bad": torch.ones(1, dtype=torch.float64)}, "float32"),
        ]
        for value, message in variants:
            with self.subTest(message=message):
                if isinstance(value, bytes):
                    state_path.write_bytes(value)
                else:
                    torch.save(value, state_path)
                expected = hashlib.sha256(state_path.read_bytes()).hexdigest()
                with self.assertRaisesRegex(recovery.RecoveryError, message):
                    recovery.load_state(source, expected)

    def metadata_fixture(self):
        source = self.work / "source"
        source.mkdir(exist_ok=True)
        for relative in ("encoder_config.json", "training_stats.json", "labels.json",
                         "calibration.json", "tokenizer_config/tokenizer.json",
                         "tokenizer_config/tokenizer_config.json", "tokenizer_config/vocab.txt"):
            target = source / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / relative, target)
        (source / "pytorch_model.bin").write_bytes(b"not a state dictionary")
        return source

    def test_unpinned_optional_metadata_is_rejected(self):
        recovery = self.module()
        source = self.metadata_fixture()
        for relative in ("tokenizer_config/special_tokens_map.json",
                         "tokenizer_config/added_tokens.json", "thresholds.json"):
            with self.subTest(relative=relative):
                target = source / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('{"caller_supplied": true}', encoding="utf-8")
                try:
                    with self.assertRaisesRegex(recovery.RecoveryError,
                                                "unexpected source metadata"):
                        recovery.load_metadata(source)
                finally:
                    target.unlink()

    def test_cli_digest_override_cannot_replace_fixed_v18_identity(self):
        recovery = self.module()
        source = self.metadata_fixture()
        supplied = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        self.assertNotEqual(supplied, recovery.EXPECTED_WEIGHTS_SHA256)
        output = self.work / "output"
        result = self.cli(source, output, "--expected-source-sha256", supplied)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("expected source SHA256 must equal the fixed v18 digest", result.stderr)
        self.assertIn(recovery.EXPECTED_WEIGHTS_SHA256, result.stderr)
        self.assertNotIn("weights_only", result.stderr)
        self.assertFalse(output.exists())

    def test_cli_expected_digest_requires_exact_lowercase_hex(self):
        recovery = self.module()
        source = self.metadata_fixture()
        expected = recovery.EXPECTED_WEIGHTS_SHA256
        variants = (expected.upper(), " " + expected, expected + " ", expected + "\n",
                    expected[:-1], expected + "0", "g" + expected[1:])
        for supplied in variants:
            with self.subTest(supplied=supplied):
                output = self.work / "output"
                result = self.cli(source, output, "--expected-source-sha256", supplied)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("expected source SHA256 must be exactly 64 lowercase hex characters",
                              result.stderr)
                self.assertFalse(output.exists())

    def test_cli_default_and_explicit_fixed_digest_reach_source_verification(self):
        recovery = self.module()
        source = self.metadata_fixture()
        expected = recovery.EXPECTED_WEIGHTS_SHA256
        actual = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        self.assertNotEqual(actual, expected)
        for extra in ((), ("--expected-source-sha256", expected)):
            with self.subTest(extra=extra):
                output = self.work / "output"
                result = self.cli(source, output, *extra)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn(f"source SHA256 mismatch: expected {expected}, got {actual}",
                              result.stderr)
                self.assertNotIn("weights_only", result.stderr)
                self.assertFalse(output.exists())

    def test_saved_metadata_fingerprints_block_same_shape_architecture_drift(self):
        recovery = self.module()
        source = self.metadata_fixture()
        config_path = source / "encoder_config.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        config["n_heads"] = 12
        config_path.write_text(json.dumps(config), encoding="utf-8")
        with self.assertRaisesRegex(recovery.RecoveryError, "metadata fingerprint"):
            recovery.load_metadata(source)

    def test_invalid_metadata_is_rejected_without_creating_output(self):
        variants = [
            ("encoder_config.json", None, "invalid json"),
            ("encoder_config.json", {"model_type": "unknown"}, "model_type"),
            ("encoder_config.json", {"n_heads": 0}, "encoder configuration"),
            ("calibration.json", {"temperature": 0}, "temperature"),
            ("calibration.json", {"temperature": float("nan")}, "temperature"),
            ("calibration.json", {"temperature": "1.0"}, "temperature"),
            ("training_stats.json", {"product_version": "other"}, "v18-student-candidate"),
            ("training_stats.json", {"labels": ["WRONG"] * 14}, "label order"),
            ("labels.json", {"0": "OTHER"}, "label order"),
        ]
        for filename, updates, message in variants:
            with self.subTest(filename=filename, updates=updates):
                source = self.metadata_fixture()
                target = source / filename
                data = json.loads(target.read_text(encoding="utf-8"))
                if updates is None:
                    target.write_text("{invalid-json", encoding="utf-8")
                else:
                    data.update(updates)
                    target.write_text(json.dumps(data), encoding="utf-8")
                output = self.work / "output"
                result = self.cli(source, output)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr.lower())
                self.assertFalse(output.exists())

    def test_source_missing_required_files_is_rejected_before_output(self):
        source = self.work / "incomplete-source"
        source.mkdir()
        output = self.work / "output"
        result = self.cli(source, output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required source file is missing", result.stderr.lower())
        self.assertIn("pytorch_model.bin", result.stderr)
        self.assertFalse(output.exists())

    def test_protected_outputs_are_rejected_without_writing(self):
        existing = self.work / "existing"
        existing.mkdir()
        marker = existing / "original.txt"
        marker.write_bytes(b"leave this intact")
        output_file = self.work / "file.onnx"
        output_file.write_bytes(b"leave this intact too")
        cases = [
            (SOURCE, "overlaps source"),
            (SOURCE / "recovered", "overlaps source"),
            (SOURCE.parent, "overlaps source"),
            (ROOT / "tools/v-final/forbidden-output", "outside recovery subtree"),
            (existing, "output already exists"),
            (output_file, "output already exists"),
        ]
        for output, message in cases:
            with self.subTest(output=str(output)):
                result = self.cli(SOURCE, output)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr.lower())
        self.assertEqual(marker.read_bytes(), b"leave this intact")
        self.assertEqual(output_file.read_bytes(), b"leave this intact too")
        self.assertFalse((SOURCE / "recovered").exists())
        self.assertFalse((ROOT / "tools/v-final/forbidden-output").exists())


class SnapshotTests(unittest.TestCase):
    setUp = SafetyTests.setUp
    module = SafetyTests.module
    metadata_fixture = SafetyTests.metadata_fixture

    def test_checkpoint_substitution_and_post_mmap_mutation_are_isolated(self):
        import torch
        recovery = self.module()
        source = self.work / "source"
        source.mkdir()
        state_path = source / "pytorch_model.bin"
        expected_tensor = torch.tensor([1.0, 2.0])
        torch.save({"weight": expected_tensor}, state_path)
        expected_digest = hashlib.sha256(state_path.read_bytes()).hexdigest()
        replacement = self.work / "replacement.bin"
        torch.save({"weight": torch.tensor([9.0, 10.0])}, replacement)
        original_load = torch.load
        loaded_paths = []
        state = None

        def substitute_before_load(path, *args, **kwargs):
            loaded_paths.append(Path(path))
            self.assertTrue(kwargs.get("mmap"), "The real tiny load must use mmap")
            state_path.write_bytes(replacement.read_bytes())
            return original_load(path, *args, **kwargs)

        try:
            with observe_patch.object(torch, "load", side_effect=substitute_before_load):
                state, digest = recovery.load_state(source, expected_digest)
            self.assertTrue(torch.equal(state["weight"], expected_tensor),
                            "Checkpoint substitution reached the supposedly verified state")
            self.assertEqual(digest, expected_digest)
            self.assertNotEqual(loaded_paths[0], state_path)
            self.assertTrue(loaded_paths[0].is_file())
            before = recovery.state_sha256(state)
            original_bytes = state_path.read_bytes()
            needle = torch.tensor([9.0, 10.0]).numpy().tobytes()
            self.assertEqual(original_bytes.count(needle), 1)
            changed = torch.tensor([20.0, 30.0]).numpy().tobytes()
            with state_path.open("r+b") as stream:
                stream.seek(original_bytes.index(needle))
                stream.write(changed)
            self.assertIn(changed, state_path.read_bytes())
            self.assertTrue(torch.equal(state["weight"], expected_tensor),
                            "Mutation of the original after mmap changed consumed state")
            self.assertEqual(recovery.state_sha256(state), before)
        finally:
            if state is not None:
                if hasattr(state, "close"):
                    state.close()
                else:
                    state.clear()
        self.assertFalse(loaded_paths[0].parent.exists(),
                         "Successful tiny state consumption leaked its private snapshot")

    def test_metadata_parse_and_fingerprint_use_the_same_captured_bytes(self):
        recovery = self.module()
        source = self.metadata_fixture()
        target = source / "calibration.json"
        verified_bytes = target.read_bytes()
        changed = json.loads(verified_bytes.decode("utf-8"))
        changed["temperature"] = 2.0
        changed_bytes = json.dumps(changed).encode("utf-8")
        original_open = Path.open
        captures = []

        def substitute_then_restore(path, mode="r", *args, **kwargs):
            if path == target and mode.startswith("r") and not captures:
                captures.append(path)
                target.write_bytes(changed_bytes)
                with original_open(path, mode, *args, **kwargs) as stream:
                    payload = stream.read()
                target.write_bytes(verified_bytes)
                return io.BytesIO(payload) if "b" in mode else io.StringIO(payload)
            return original_open(path, mode, *args, **kwargs)

        with observe_patch.object(Path, "open", new=substitute_then_restore):
            with self.assertRaisesRegex(recovery.RecoveryError,
                                        "source metadata fingerprint mismatch: calibration.json"):
                recovery.load_metadata(source)
        self.assertEqual(captures, [target])
        self.assertEqual(target.read_bytes(), verified_bytes)

    def tiny_fixture(self):
        import torch
        source = self.metadata_fixture()
        torch.save({"weight": torch.tensor([1.0, 2.0])}, source / "pytorch_model.bin")
        digest = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        labels = json.loads((source / "training_stats.json").read_bytes())["labels"]

        class TinyModel(torch.nn.Module):
            def __init__(self, base_model, num_labels, **kwargs):
                super().__init__()
                self.weight = torch.nn.Parameter(torch.zeros(2))
                self.num_labels = num_labels

            def forward(self, input_ids, attention_mask):
                pooled = (input_ids * attention_mask).float().sum(dim=1) / 100000.0
                logits = (pooled[:, None] * self.weight[0] + self.weight[1]).expand(-1, self.num_labels)
                return logits, logits[:, 0]

        class TinyWrapper(torch.nn.Module):
            def __init__(self, model, temperature):
                super().__init__()
                self.model, self.temperature = model, temperature

            def forward(self, input_ids, attention_mask):
                return self.model(input_ids, attention_mask)[0] / self.temperature

        definitions = types.SimpleNamespace(ALL_LABELS=labels, SoterLLMv14=TinyModel,
                                            OnnxWrapper=TinyWrapper)
        return source, digest, definitions

    def test_tokenizer_and_export_ignore_mutated_original_sidecars(self):
        from transformers import AutoTokenizer
        recovery = self.module()
        source, digest, definitions = self.tiny_fixture()
        output = self.work / "tiny-bundle"
        original_tokenizer = AutoTokenizer.from_pretrained
        original_load_state = recovery.load_state
        tokenizer_paths, held_states = [], []
        loaded = None
        words = (source / "tokenizer_config/vocab.txt").read_text(encoding="utf-8").splitlines()
        old_word = next(word for word in words if word.startswith("[unused"))
        new_word = "mutated_original_only_token"

        def remember_state(*args, **kwargs):
            state, observed = original_load_state(*args, **kwargs)
            held_states.append(state)
            return state, observed

        def mutate_then_tokenize(path, *args, **kwargs):
            tokenizer_paths.append(Path(path))
            token_path = source / "tokenizer_config/tokenizer.json"
            tokenizer_json = json.loads(token_path.read_bytes())
            vocab = tokenizer_json["model"]["vocab"]
            vocab[new_word] = vocab.pop(old_word)
            token_path.write_text(json.dumps(tokenizer_json), encoding="utf-8")
            words[words.index(old_word)] = new_word
            (source / "tokenizer_config/vocab.txt").write_text("\n".join(words) + "\n", encoding="utf-8")
            for relative in recovery.EXPECTED_METADATA_SHA256:
                if relative not in ("tokenizer_config/tokenizer.json", "tokenizer_config/vocab.txt"):
                    target = source / relative
                    target.write_bytes(target.read_bytes() + b"\n ")
            (source / "tokenizer_config/special_tokens_map.json").write_text("{}", encoding="utf-8")
            (source / "thresholds.json").write_text("{}", encoding="utf-8")
            return original_tokenizer(path, *args, **kwargs)

        try:
            with observe_patch.object(recovery, "repository_definitions",
                                      return_value=(definitions, {"synthetic_fixture_only": True})), \
                    observe_patch.object(recovery, "load_state", side_effect=remember_state), \
                    observe_patch.object(AutoTokenizer, "from_pretrained", side_effect=mutate_then_tokenize):
                loaded = recovery.load_model(source, digest)
            manifest = recovery.export_bundle(loaded, output)
            actual = {relative: hashlib.sha256((output / relative).read_bytes()).hexdigest()
                      for relative in recovery.EXPECTED_METADATA_SHA256}
            self.assertEqual(actual, recovery.EXPECTED_METADATA_SHA256,
                             "Export copied sidecars from the changed original directory")
            self.assertEqual(manifest["status"], "verified_serialization_recovery")
            self.assertIn(old_word, loaded["tokenizer"].get_vocab())
            self.assertNotIn(new_word, loaded["tokenizer"].get_vocab())
            self.assertNotEqual(tokenizer_paths, [source / "tokenizer_config"])
            self.assertTrue(loaded.snapshot_dir.is_dir(), "Snapshot expired before export consumption")
            self.assertEqual({path.name for path in (loaded.snapshot_dir / "tokenizer_config").iterdir()},
                             {"tokenizer.json", "tokenizer_config.json", "vocab.txt"})
            self.assertFalse((loaded.snapshot_dir / "thresholds.json").exists())
            manifest_hashes = {item["path"]: item["sha256"] for item in manifest["artifact_files"]}
            self.assertEqual({key: manifest_hashes[key] for key in recovery.EXPECTED_METADATA_SHA256},
                             recovery.EXPECTED_METADATA_SHA256)
        finally:
            for state in held_states:
                state.clear()
            if loaded is not None:
                if hasattr(loaded, "close"):
                    loaded.close()
                else:
                    loaded.clear()
            for state in held_states:
                state.close()
        self.assertFalse(loaded.snapshot_dir.exists(), "Tiny export leaked its private snapshot")

    def test_each_exported_sidecar_must_match_its_existing_pin(self):
        recovery = self.module()
        source, digest, definitions = self.tiny_fixture()
        original_write = Path.write_bytes
        with observe_patch.object(recovery, "repository_definitions",
                                  return_value=(definitions, {"synthetic_fixture_only": True})):
            loaded = recovery.load_model(source, digest)
        snapshot_dir = loaded.snapshot_dir
        with loaded:
            for index, relative in enumerate(recovery.EXPECTED_METADATA_SHA256):
                with self.subTest(relative=relative):
                    output = self.work / f"corrupt-tiny-bundle-{index}"
                    target = output / relative
                    corrupted = []

                    def corrupt_after_write(path, payload):
                        written = original_write(path, payload)
                        if path == target:
                            with path.open("ab") as stream:
                                stream.write(b"\ncorrupted fixture destination")
                            corrupted.append(relative)
                        return written

                    with observe_patch.object(Path, "write_bytes", new=corrupt_after_write):
                        with self.assertRaisesRegex(recovery.RecoveryError,
                                                    f"exported metadata fingerprint mismatch: {relative}"):
                            recovery.export_bundle(loaded, output)
                    self.assertEqual(corrupted, [relative])
                    self.assertFalse((output / "recovery_manifest.json").exists())
                    failure = json.loads((output / "RECOVERY_FAILED.json").read_bytes())
                    self.assertEqual(failure["status"], "failed")
                    self.assertFalse(failure["release_ready"])
                    self.assertTrue(snapshot_dir.is_dir(), "Failure prematurely removed a live snapshot")
        self.assertFalse(snapshot_dir.exists(), "Failed tiny exports leaked their private snapshot")

    def test_failed_strict_assignment_releases_its_mapped_snapshot(self):
        import torch
        recovery = self.module()
        source, _, definitions = self.tiny_fixture()
        state_path = source / "pytorch_model.bin"
        torch.save({"weight": torch.tensor([1.0, 2.0]), "unexpected": torch.ones(1)}, state_path)
        digest = hashlib.sha256(state_path.read_bytes()).hexdigest()
        original_load_state = recovery.load_state
        temporaries, snapshot_dirs = [], []
        observed_error, removed_before_fixture_cleanup = None, False

        def remember_snapshot(*args, **kwargs):
            state, observed = original_load_state(*args, **kwargs)
            temporaries.append(state._temporary)
            snapshot_dirs.append(state.snapshot_dir)
            return state, observed

        try:
            with observe_patch.object(recovery, "repository_definitions",
                                      return_value=(definitions, {"synthetic_fixture_only": True})), \
                    observe_patch.object(recovery, "load_state", side_effect=remember_snapshot):
                try:
                    recovery.load_model(source, digest)
                except recovery.RecoveryError as exc:
                    observed_error = str(exc)
                    removed_before_fixture_cleanup = all(not path.exists() for path in snapshot_dirs)
                    # Test-only teardown cannot hide the recorded cleanup failure.
                    pending, seen = [exc], set()
                    while pending:
                        error = pending.pop()
                        if error is None or id(error) in seen:
                            continue
                        seen.add(id(error))
                        traceback.clear_frames(error.__traceback__)
                        pending.extend((error.__cause__, error.__context__))
        finally:
            for temporary in temporaries:
                cleanup_fixture(temporary)
        self.assertIsNotNone(observed_error, "Strict synthetic assignment unexpectedly succeeded")
        self.assertIn("strict state loading failed", observed_error,
                      "Snapshot cleanup replaced the strict-assignment diagnostic")
        self.assertTrue(removed_before_fixture_cleanup,
                        "Failed model consumption left its mapped private snapshot locked")

    def test_snapshot_cleanup_retries_windows_locks_on_success_and_failure(self):
        if os.name != "nt":
            self.skipTest("Actual Windows sharing violations require Windows")
        import torch
        recovery = self.module()
        for failure in (False, True):
            with self.subTest(consumer_failure=failure):
                source = self.work / f"lock-source-{failure}"
                source.mkdir()
                state_path = source / "pytorch_model.bin"
                torch.save({"weight": torch.ones(1)}, state_path)
                digest = hashlib.sha256(state_path.read_bytes()).hexdigest()
                state, _ = recovery.load_state(source, digest)
                snapshot_dir = state.snapshot_dir
                handle = (snapshot_dir / "pytorch_model.bin").open("rb")
                release_event = threading.Event()
                release = threading.Thread(target=lambda: (release_event.wait(10), handle.close()))
                original_cleanup = state._temporary.cleanup
                attempts, sharing_failures = [], []

                def observe_cleanup():
                    attempts.append(True)
                    try:
                        return original_cleanup()
                    except PermissionError:
                        sharing_failures.append(True)
                        release_event.set()
                        raise

                release.start()
                try:
                    with observe_patch.object(state._temporary, "cleanup", side_effect=observe_cleanup):
                        if failure:
                            with self.assertRaisesRegex(recovery.RecoveryError, "synthetic consumer failed"):
                                with state:
                                    self.assertTrue(snapshot_dir.is_dir())
                                    raise recovery.RecoveryError("synthetic consumer failed")
                        else:
                            with state:
                                self.assertEqual(state["weight"].item(), 1.0)
                                self.assertTrue(snapshot_dir.is_dir())
                finally:
                    release_event.set()
                    release.join(timeout=10)
                    handle.close()
                    state.close()
                self.assertFalse(release.is_alive())
                self.assertTrue(sharing_failures, "No actual Windows sharing violation was exercised")
                self.assertGreaterEqual(len(attempts), 2)
                self.assertLessEqual(len(attempts), 8)
                self.assertFalse(snapshot_dir.exists())
                self.assertTrue(state_path.is_file(), "Cleanup touched the original fixture")

    def test_persistent_windows_snapshot_lock_stops_at_eight_attempts(self):
        if os.name != "nt":
            self.skipTest("Actual Windows sharing violations require Windows")
        recovery = self.module()
        snapshot = recovery._SnapshotResult()
        snapshot_dir = snapshot.snapshot_dir
        marker = snapshot_dir / "held-fixture.txt"
        marker.write_bytes(b"private fixture only")
        handle = marker.open("rb")
        original_cleanup = snapshot._temporary.cleanup
        attempts, delays = [], []

        def observe_cleanup():
            attempts.append(True)
            return original_cleanup()

        try:
            with observe_patch.object(snapshot._temporary, "cleanup", side_effect=observe_cleanup), \
                    observe_patch.object(recovery.time, "sleep", side_effect=delays.append):
                with self.assertRaisesRegex(recovery.RecoveryError, "verified snapshot cleanup failed"):
                    snapshot.close()
            self.assertEqual(len(attempts), 8)
            self.assertEqual(delays, [0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5])
            self.assertTrue(marker.is_file(), "Persistent lock unexpectedly deleted its target")
        finally:
            handle.close()
            snapshot.close()
        self.assertFalse(snapshot_dir.exists())


class _NativeMappedConsumer:
    """Tiny fixture-only consumer with a real Windows deny-delete mapping."""

    def __init__(self, checkpoint, model, state):
        with checkpoint.open("rb") as stream:
            self.mapping = mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ)
        self.model, self.state = model, dict(state)

    def __del__(self):
        self.mapping.close()


def clear_fixture_error(error):
    """Test-only teardown, always after lifecycle outcomes were recorded."""
    pending, seen = [error], set()
    while pending:
        current = pending.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))
        traceback.clear_frames(current.__traceback__)
        pending.extend((current.__cause__, current.__context__))


class LifecycleTests(unittest.TestCase):
    setUp = SafetyTests.setUp
    module = SafetyTests.module
    metadata_fixture = SafetyTests.metadata_fixture
    tiny_fixture = SnapshotTests.tiny_fixture

    def test_strict_failure_releases_native_traceback_consumer(self):
        if os.name != "nt":
            self.skipTest("Actual mapped-consumer deletion requires Windows")
        import torch
        recovery = self.module()
        source, _, definitions = self.tiny_fixture()
        checkpoint = source / "pytorch_model.bin"
        torch.save({"weight": torch.tensor([1.0, 2.0]), "unexpected": torch.ones(1)}, checkpoint)
        digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        original_load_state = recovery.load_state
        original_strict = torch.nn.Module.load_state_dict
        temporaries, snapshot_dirs, consumers, native_denials = [], [], [], []
        error = None

        def remember_snapshot(*args, **kwargs):
            state, observed = original_load_state(*args, **kwargs)
            temporaries.append(state._temporary)
            snapshot_dirs.append(state.snapshot_dir)
            return state, observed

        def native_consumer_then_strict(model, state, *args, **kwargs):
            # Fault fixture: a real native mapping survives only in this finished
            # strict-load frame, alongside actual mmap-assigned model tensors.
            consumer = _NativeMappedConsumer(snapshot_dirs[0] / "pytorch_model.bin", model, state)
            consumers.append(weakref.ref(consumer))
            with self.assertRaises(PermissionError):
                (snapshot_dirs[0] / "pytorch_model.bin").unlink()
            native_denials.append(True)
            return original_strict(model, state, *args, **kwargs)

        try:
            with observe_patch.object(recovery, "repository_definitions",
                                      return_value=(definitions, {"synthetic_fixture_only": True})), \
                    observe_patch.object(recovery, "load_state", side_effect=remember_snapshot), \
                    observe_patch.object(torch.nn.Module, "load_state_dict", new=native_consumer_then_strict):
                try:
                    recovery.load_model(source, digest)
                except recovery.RecoveryError as caught:
                    error = caught
            observed = {
                "error": str(error), "cause_type": type(error.__cause__).__name__ if error else None,
                "snapshot_removed_before_test_teardown": all(not path.exists() for path in snapshot_dirs),
                "native_consumers_alive_before_test_teardown": [ref() is not None for ref in consumers],
                "real_windows_delete_denials": len(native_denials),
            }
            print("[native-strict-lifecycle] " + json.dumps(observed, sort_keys=True))
            self.assertIsNotNone(error, "Real strict assignment unexpectedly succeeded")
            self.assertEqual(native_denials, [True])
            self.assertIn("strict state loading failed", str(error),
                          "Native snapshot cleanup masked the primary strict-load diagnostic")
            self.assertIsInstance(error.__cause__, RuntimeError)
            self.assertIn("unexpected", str(error.__cause__))
            self.assertTrue(observed["snapshot_removed_before_test_teardown"])
            self.assertEqual(observed["native_consumers_alive_before_test_teardown"], [False])
            self.assertTrue(checkpoint.is_file(), "Cleanup touched the original tiny source")
        finally:
            # This cannot turn the recorded production failure into a passing test.
            for reference in consumers:
                consumer = reference()
                if consumer is not None:
                    consumer.mapping.close()
            consumer = None
            clear_fixture_error(error)
            for temporary in temporaries:
                cleanup_fixture(temporary)

    def test_export_failure_releases_native_traceback_consumer(self):
        if os.name != "nt":
            self.skipTest("Actual mapped-consumer deletion requires Windows")
        import torch
        recovery = self.module()
        source, digest, definitions = self.tiny_fixture()
        with observe_patch.object(recovery, "repository_definitions",
                                  return_value=(definitions, {"synthetic_fixture_only": True})):
            loaded = recovery.load_model(source, digest)
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "failed-native-export"
        consumers, native_denials = [], []
        error = None

        def fail_from_native_consumer(wrapper, inputs, model_path, **kwargs):
            # Explicit exporter-failure injection, not a fake Windows error:
            # this finished frame owns actual mapped weights and a native mmap.
            consumer = _NativeMappedConsumer(snapshot_dir / "pytorch_model.bin", wrapper.model,
                                             wrapper.model.state_dict())
            consumers.append(weakref.ref(consumer))
            self.assertTrue(torch.equal(consumer.state["weight"], torch.tensor([1.0, 2.0])))
            with self.assertRaises(PermissionError):
                (snapshot_dir / "pytorch_model.bin").unlink()
            native_denials.append(True)
            raise RuntimeError("synthetic native exporter consumer failed")

        try:
            with observe_patch.object(torch.onnx, "export", side_effect=fail_from_native_consumer):
                try:
                    with loaded:
                        recovery.export_bundle(loaded, output)
                except recovery.RecoveryError as caught:
                    error = caught
            failure = json.loads((output / "RECOVERY_FAILED.json").read_bytes())
            observed = {
                "error": str(error), "cause_type": type(error.__cause__).__name__ if error else None,
                "failure": failure, "snapshot_removed_before_test_teardown": not snapshot_dir.exists(),
                "native_consumers_alive_before_test_teardown": [ref() is not None for ref in consumers],
                "real_windows_delete_denials": len(native_denials),
            }
            print("[native-export-lifecycle] " + json.dumps(observed, sort_keys=True))
            self.assertIsNotNone(error)
            self.assertEqual(native_denials, [True])
            self.assertIn("ONNX export/verification failed: RuntimeError: synthetic native exporter consumer failed",
                          str(error), "Cleanup masked the primary exporter diagnostic")
            self.assertIsInstance(error.__cause__, RuntimeError)
            self.assertEqual(failure["status"], "failed")
            self.assertIn("synthetic native exporter consumer failed", failure["error"])
            self.assertFalse(failure["release_ready"])
            self.assertFalse((output / "recovery_manifest.json").exists())
            self.assertTrue(observed["snapshot_removed_before_test_teardown"])
            self.assertEqual(observed["native_consumers_alive_before_test_teardown"], [False])
            self.assertTrue((source / "pytorch_model.bin").is_file())
        finally:
            for reference in consumers:
                consumer = reference()
                if consumer is not None:
                    consumer.mapping.close()
            consumer = None
            clear_fixture_error(error)
            loaded.close()

    def test_strict_failure_preserves_diagnostic_when_external_lock_persists(self):
        if os.name != "nt":
            self.skipTest("Actual persistent sharing violations require Windows")
        import torch
        recovery = self.module()
        source, _, definitions = self.tiny_fixture()
        checkpoint = source / "pytorch_model.bin"
        torch.save({"weight": torch.tensor([1.0, 2.0]), "unexpected": torch.ones(1)}, checkpoint)
        digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        original_load_state, original_strict = recovery.load_state, torch.nn.Module.load_state_dict
        temporaries, snapshot_dirs, cleanup_patches, handles, consumers = [], [], [], [], []
        attempts, native_failures, delays = [], [], []
        error = None

        def remember_and_observe_snapshot(*args, **kwargs):
            state, observed = original_load_state(*args, **kwargs)
            temporaries.append(state._temporary)
            snapshot_dirs.append(state.snapshot_dir)
            original_cleanup = state._temporary.cleanup

            def observe_cleanup():
                attempts.append(True)
                try:
                    return original_cleanup()
                except PermissionError:
                    native_failures.append(True)
                    raise

            cleanup_patch = observe_patch.object(state._temporary, "cleanup", side_effect=observe_cleanup)
            cleanup_patches.append(cleanup_patch)
            cleanup_patch.start()
            return state, observed

        def strict_with_external_consumer(model, state, *args, **kwargs):
            consumer = _NativeMappedConsumer(snapshot_dirs[0] / "pytorch_model.bin", model, state)
            consumers.append(weakref.ref(consumer))
            # Explicit persistent lock remains outside all finished tracebacks.
            handles.append((snapshot_dirs[0] / "pytorch_model.bin").open("rb"))
            return original_strict(model, state, *args, **kwargs)

        try:
            with observe_patch.object(recovery, "repository_definitions",
                                      return_value=(definitions, {"synthetic_fixture_only": True})), \
                    observe_patch.object(recovery, "load_state", side_effect=remember_and_observe_snapshot), \
                    observe_patch.object(torch.nn.Module, "load_state_dict", new=strict_with_external_consumer), \
                    observe_patch.object(recovery.time, "sleep", side_effect=delays.append):
                try:
                    recovery.load_model(source, digest)
                except recovery.RecoveryError as caught:
                    error = caught
            observed = {
                "error": str(error), "notes": getattr(error, "__notes__", []),
                "cause_type": type(error.__cause__).__name__ if error else None,
                "native_traceback_consumers_alive_before_test_teardown": [ref() is not None for ref in consumers],
                "snapshot_locked_before_test_teardown": all(path.exists() for path in snapshot_dirs),
                "cleanup_attempts": len(attempts), "actual_windows_sharing_failures": len(native_failures),
            }
            print("[strict-primary-and-persistent-cleanup-failure] " + json.dumps(observed, sort_keys=True))
            self.assertIsNotNone(error)
            self.assertIn("strict state loading failed", str(error))
            self.assertIsInstance(error.__cause__, RuntimeError)
            self.assertIn("unexpected", str(error.__cause__))
            self.assertTrue(any("verified snapshot cleanup failed" in note for note in error.__notes__))
            self.assertEqual(len(attempts), 8)
            self.assertEqual(len(native_failures), 8)
            self.assertEqual(delays, [0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5])
            self.assertEqual(observed["native_traceback_consumers_alive_before_test_teardown"], [False])
            self.assertTrue(observed["snapshot_locked_before_test_teardown"])
            self.assertEqual(hashlib.sha256(checkpoint.read_bytes()).hexdigest(), digest)
        finally:
            for cleanup_patch in cleanup_patches:
                cleanup_patch.stop()
            for handle in handles:
                handle.close()
            for reference in consumers:
                consumer = reference()
                if consumer is not None:
                    consumer.mapping.close()
            consumer = None
            clear_fixture_error(error)
            for temporary in temporaries:
                cleanup_fixture(temporary)


class FinalizationTests(unittest.TestCase):
    setUp = SafetyTests.setUp
    module = SafetyTests.module
    metadata_fixture = SafetyTests.metadata_fixture
    tiny_fixture = SnapshotTests.tiny_fixture

    def tiny_loaded(self):
        recovery = self.module()
        source, digest, definitions = self.tiny_fixture()
        with observe_patch.object(recovery, "repository_definitions",
                                  return_value=(definitions, {"synthetic_fixture_only": True})):
            loaded = recovery.load_model(source, digest)
        return recovery, source, loaded

    def invoke_tiny_main(self, recovery, source, loaded, output):
        # Keep public identity validation intact. Only the private loader seam
        # returns a genuinely loaded tiny fixture, never a caller CLI override.
        self.assertEqual(recovery.EXPECTED_WEIGHTS_SHA256,
                         "166733d6004519b3548098cf53b51f649cf46e1b918f1013f2a886d1dfc9059f")
        stdout, stderr = io.StringIO(), io.StringIO()

        def fixture_loader(path):
            self.assertEqual(path, source)
            return loaded

        with observe_patch.object(recovery, "load_model", side_effect=fixture_loader), \
                redirect_stdout(stdout), redirect_stderr(stderr):
            code = recovery.main(["--source-dir", str(source), "--output-dir", str(output)])
        return code, stdout.getvalue(), stderr.getvalue()

    def test_cleanup_rejection_after_serialization_cannot_leave_verified_status(self):
        if os.name != "nt":
            self.skipTest("Actual cleanup-boundary sharing violations require Windows")
        recovery, source, loaded = self.tiny_loaded()
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "cleanup-rejected-bundle"
        source_digest = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        original_cleanup = loaded._temporary.cleanup
        handles, attempts, native_failures, delays, status_at_cleanup = [], [], [], [], []

        def persistent_native_lock_after_serialization():
            # Explicit cleanup-boundary fault injection after a REAL tiny ONNX
            # export/checker/ORT parity run. A real file consumer denies deletion.
            self.assertTrue((output / "model.onnx").is_file())
            if not handles:
                self.assertEqual({relative: hashlib.sha256((output / relative).read_bytes()).hexdigest()
                                  for relative in recovery.EXPECTED_METADATA_SHA256},
                                 recovery.EXPECTED_METADATA_SHA256)
                status_at_cleanup.append((output / "recovery_manifest.json").exists())
                handles.append((snapshot_dir / "pytorch_model.bin").open("rb"))
            attempts.append(True)
            try:
                return original_cleanup()
            except PermissionError:
                native_failures.append(True)
                raise

        try:
            with observe_patch.object(loaded._temporary, "cleanup",
                                      side_effect=persistent_native_lock_after_serialization), \
                    observe_patch.object(recovery.time, "sleep", side_effect=delays.append):
                code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
            final_path, failure_path = output / "recovery_manifest.json", output / "RECOVERY_FAILED.json"
            failure = json.loads(failure_path.read_bytes()) if failure_path.is_file() else None
            observed = {
                "cli_exit_code": code, "stderr": stderr,
                "verified_manifest_existed_at_cleanup": status_at_cleanup,
                "verified_manifest_before_test_teardown": final_path.exists(),
                "failure_manifest_before_test_teardown": failure,
                "snapshot_still_locked_before_test_teardown": snapshot_dir.exists(),
                "cleanup_attempts": len(attempts), "actual_windows_sharing_failures": len(native_failures),
                "retry_delays": delays,
            }
            print("[post-serialization-cleanup-rejection] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 2, stderr)
            self.assertIn("verified snapshot cleanup failed", stderr)
            self.assertEqual(len(attempts), 8)
            self.assertEqual(len(native_failures), 8)
            self.assertEqual(delays, [0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5])
            self.assertFalse(final_path.exists(), "Rejected CLI left a published verified recovery")
            self.assertIsNotNone(failure, "Cleanup rejection was not persisted as final failure")
            self.assertEqual(failure["status"], "failed")
            self.assertIn("verified snapshot cleanup failed", failure["error"])
            self.assertFalse(failure["release_ready"])
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout)
            self.assertTrue(snapshot_dir.exists(), "Persistent native lock was bypassed")
            self.assertEqual(hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest(),
                             source_digest)
        finally:
            # The failure/verified record assertions above occur while the real
            # lock is STILL held; fixture teardown cannot hide false final status.
            for handle in handles:
                handle.close()
            loaded.close()

    def test_persistent_cleanup_lock_preserves_primary_export_failure(self):
        if os.name != "nt":
            self.skipTest("Actual persistent sharing violations require Windows")
        import torch
        recovery, source, loaded = self.tiny_loaded()
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "primary-and-cleanup-failed"
        original_cleanup = loaded._temporary.cleanup
        handles, consumers, attempts, delays, native_failures = [], [], [], [], []
        primary_message = "synthetic primary exporter failure with persistent external consumer"

        def fail_with_owned_and_external_consumers(wrapper, inputs, model_path, **kwargs):
            consumer = _NativeMappedConsumer(snapshot_dir / "pytorch_model.bin", wrapper.model,
                                             wrapper.model.state_dict())
            consumers.append(weakref.ref(consumer))
            # Deliberate persistent boundary fault: unlike the finished-frame
            # consumer, this real native handle remains externally owned.
            handles.append((snapshot_dir / "pytorch_model.bin").open("rb"))
            raise RuntimeError(primary_message)

        def observe_persistent_cleanup():
            attempts.append(True)
            try:
                return original_cleanup()
            except PermissionError:
                native_failures.append(True)
                raise

        try:
            with observe_patch.object(torch.onnx, "export", side_effect=fail_with_owned_and_external_consumers), \
                    observe_patch.object(loaded._temporary, "cleanup", side_effect=observe_persistent_cleanup), \
                    observe_patch.object(recovery.time, "sleep", side_effect=delays.append):
                code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
            failure = json.loads((output / "RECOVERY_FAILED.json").read_bytes())
            observed = {
                "cli_exit_code": code, "stderr": stderr, "failure": failure,
                "snapshot_locked_before_test_teardown": snapshot_dir.exists(),
                "native_traceback_consumers_alive_before_test_teardown": [ref() is not None for ref in consumers],
                "actual_windows_sharing_failures": len(native_failures), "cleanup_attempts": len(attempts),
                "retry_delays": delays,
            }
            print("[primary-and-persistent-cleanup-failure] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 2, stderr)
            self.assertEqual(len(attempts), 8)
            self.assertEqual(len(native_failures), 8)
            self.assertEqual(delays, [0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5])
            self.assertIn(primary_message, stderr, "Persistent cleanup masked the primary CLI diagnostic")
            self.assertIn("verified snapshot cleanup failed", stderr)
            self.assertIn(primary_message, failure["error"])
            self.assertTrue(any("verified snapshot cleanup failed" in note for note in failure.get("notes", [])),
                            "Explicit finalization rejection was lost from the failure record")
            self.assertEqual(failure["status"], "failed")
            self.assertFalse(failure["release_ready"])
            self.assertFalse((output / "recovery_manifest.json").exists())
            self.assertTrue(snapshot_dir.exists(), "Persistent external consumer was bypassed")
            self.assertEqual(observed["native_traceback_consumers_alive_before_test_teardown"], [False])
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout)
        finally:
            for handle in handles:
                handle.close()
            for reference in consumers:
                consumer = reference()
                if consumer is not None:
                    consumer.mapping.close()
            consumer = None
            loaded.close()

    def test_unwritable_final_failure_record_preserves_cleanup_rejection(self):
        if os.name != "nt":
            self.skipTest("Actual cleanup-boundary sharing violations require Windows")
        recovery, source, loaded = self.tiny_loaded()
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "unwritable-final-failure-record"
        original_cleanup, original_write = loaded._temporary.cleanup, Path.write_text
        handles, attempts, native_failures, recording_denials = [], [], [], []
        code, stdout, stderr, escaped_error = None, "", "", None

        def persistently_locked_cleanup():
            self.assertTrue((output / "model.onnx").is_file())
            if not handles:
                handles.append((snapshot_dir / "pytorch_model.bin").open("rb"))
            attempts.append(True)
            try:
                return original_cleanup()
            except PermissionError:
                native_failures.append(True)
                raise

        def reject_failure_record(path, text, *args, **kwargs):
            if path == output / "RECOVERY_FAILED.json":
                # Explicit persistence fault injection, distinct from the real
                # native cleanup lock; never pretend a failure file was written.
                recording_denials.append(True)
                raise PermissionError("synthetic final failure record is unwritable")
            return original_write(path, text, *args, **kwargs)

        try:
            with observe_patch.object(loaded._temporary, "cleanup", side_effect=persistently_locked_cleanup), \
                    observe_patch.object(recovery.time, "sleep", return_value=None), \
                    observe_patch.object(Path, "write_text", new=reject_failure_record):
                try:
                    code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
                except Exception as error:
                    escaped_error = f"{type(error).__name__}: {error}"
            observed = {
                "cli_exit_code": code, "escaped_error": escaped_error, "stderr": stderr,
                "actual_windows_sharing_failures": len(native_failures), "cleanup_attempts": len(attempts),
                "recording_fault_injections": len(recording_denials),
                "verified_manifest_before_test_teardown": (output / "recovery_manifest.json").exists(),
                "failure_record_before_test_teardown": (output / "RECOVERY_FAILED.json").exists(),
                "snapshot_locked_before_test_teardown": snapshot_dir.exists(),
            }
            print("[unwritable-final-failure-record] " + json.dumps(observed, sort_keys=True))
            self.assertIsNone(escaped_error, "Failure-record error escaped and masked cleanup rejection")
            self.assertEqual(code, 2, stderr)
            self.assertIn("verified snapshot cleanup failed", stderr)
            self.assertIn("Failure record could not be written", stderr)
            self.assertIn("synthetic final failure record is unwritable", stderr)
            self.assertEqual(len(native_failures), 8)
            self.assertEqual(len(attempts), 8)
            self.assertEqual(recording_denials, [True])
            self.assertFalse((output / "recovery_manifest.json").exists())
            self.assertFalse((output / "RECOVERY_FAILED.json").exists(), "Persistence refusal was bypassed")
            self.assertTrue(snapshot_dir.exists(), "Persistent native consumer was bypassed")
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout)
        finally:
            for handle in handles:
                handle.close()
            loaded.close()

    def test_verified_manifest_follows_transient_native_cleanup(self):
        if os.name != "nt":
            self.skipTest("Actual transient sharing violations require Windows")
        recovery, source, loaded = self.tiny_loaded()
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "transient-cleanup-verified-bundle"
        original_cleanup = loaded._temporary.cleanup
        handles, attempts, native_failures, status_at_cleanup = [], [], [], []
        release_event = threading.Event()

        def release_native_consumer():
            if release_event.wait(15) and handles:
                handles[0].close()

        release = threading.Thread(target=release_native_consumer)

        def observe_transient_cleanup():
            self.assertTrue((output / "model.onnx").is_file())
            status_at_cleanup.append((output / "recovery_manifest.json").exists())
            if not handles:
                handles.append((snapshot_dir / "pytorch_model.bin").open("rb"))
            attempts.append(True)
            try:
                return original_cleanup()
            except PermissionError:
                native_failures.append(True)
                release_event.set()
                raise

        release.start()
        try:
            with observe_patch.object(loaded._temporary, "cleanup", side_effect=observe_transient_cleanup):
                code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
            manifest = json.loads((output / "recovery_manifest.json").read_bytes())
            summary = json.loads(stdout.splitlines()[-1])
            observed = {
                "cli_exit_code": code, "cleanup_attempts": len(attempts),
                "actual_windows_sharing_failures": len(native_failures),
                "verified_manifest_existed_during_cleanup": status_at_cleanup,
                "snapshot_removed_before_test_teardown": not snapshot_dir.exists(),
                "native_consumer_closed_before_test_teardown": handles[0].closed,
                "manifest_status": manifest["status"], "parity_cases": len(manifest["parity"]["cases"]),
            }
            print("[transient-cleanup-final-publication] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 0, stderr)
            self.assertGreaterEqual(len(attempts), 2)
            self.assertLessEqual(len(attempts), 8)
            self.assertTrue(native_failures, "No actual sharing violation was exercised")
            self.assertFalse(any(status_at_cleanup), "Final success was visible before required cleanup")
            self.assertFalse(snapshot_dir.exists())
            self.assertIsNone(loaded._temporary)
            self.assertTrue(handles[0].closed)
            self.assertEqual(manifest["status"], "verified_serialization_recovery")
            self.assertEqual(summary["status"], manifest["status"])
            self.assertEqual(manifest["temperature_applications"], 1)
            self.assertFalse(manifest["learned_parameter_changes"])
            self.assertTrue(manifest["onnx_checker_passed"])
            self.assertEqual(len(manifest["parity"]["cases"]), 4)
            self.assertTrue(all(item["allclose"] and item["argmax_equal"]
                                for item in manifest["parity"]["cases"]))
            self.assertFalse(manifest["release_ready"])
            self.assertFalse((output / "RECOVERY_FAILED.json").exists())
            self.assertEqual(hashlib.sha256((output / "model.onnx").read_bytes()).hexdigest(),
                             manifest["model_sha256"])
            self.assertEqual({relative: hashlib.sha256((output / relative).read_bytes()).hexdigest()
                              for relative in recovery.EXPECTED_METADATA_SHA256},
                             recovery.EXPECTED_METADATA_SHA256)
        finally:
            release_event.set()
            release.join(timeout=15)
            for handle in handles:
                handle.close()
            loaded.close()
        self.assertFalse(release.is_alive(), "Transient native consumer did not terminate")

    def test_publication_refusal_records_final_failure_after_cleanup(self):
        recovery, source, loaded = self.tiny_loaded()
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "publication-refused-bundle"
        original_write = Path.write_text
        publication_denials, cleanup_complete_at_publication = [], []

        def reject_final_publication(path, text, *args, **kwargs):
            if path == output / "recovery_manifest.json":
                # Explicit final-publication I/O fault injection; real tiny
                # serialization and native snapshot cleanup must precede it.
                cleanup_complete_at_publication.append(not snapshot_dir.exists() and loaded._temporary is None)
                publication_denials.append(True)
                raise PermissionError("synthetic final manifest publication refused")
            return original_write(path, text, *args, **kwargs)

        try:
            with observe_patch.object(Path, "write_text", new=reject_final_publication):
                code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
            failure = json.loads((output / "RECOVERY_FAILED.json").read_bytes())
            observed = {
                "cli_exit_code": code, "stderr": stderr, "failure": failure,
                "publication_fault_injections": len(publication_denials),
                "required_cleanup_completed_before_publication": cleanup_complete_at_publication,
                "verified_manifest_before_test_teardown": (output / "recovery_manifest.json").exists(),
                "snapshot_removed_before_test_teardown": not snapshot_dir.exists(),
            }
            print("[final-publication-refusal] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 2, stderr)
            self.assertEqual(publication_denials, [True])
            self.assertEqual(cleanup_complete_at_publication, [True])
            self.assertIn("recovery finalization failed: PermissionError", stderr)
            self.assertIn("synthetic final manifest publication refused", stderr)
            self.assertEqual(failure["status"], "failed")
            self.assertEqual(failure["error_type"], "PermissionError")
            self.assertIn("synthetic final manifest publication refused", failure["error"])
            self.assertFalse(failure["release_ready"])
            self.assertFalse((output / "recovery_manifest.json").exists())
            self.assertFalse(snapshot_dir.exists())
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout)
        finally:
            loaded.close()


class ModelTests(unittest.TestCase):
    # Reuse fixture helpers without inheriting duplicate safety tests.
    setUp = SafetyTests.setUp
    module = SafetyTests.module
    metadata_fixture = SafetyTests.metadata_fixture
    def test_exact_saved_model_loads_strictly_offline_with_temperature_once(self):
        import torch
        from transformers import AutoModel
        recovery = self.module()
        self.assertTrue(hasattr(recovery, "load_model"), "Offline repository model reconstruction is missing")
        torch.set_num_threads(2)
        calls = []
        original_load = torch.load
        original_strict = torch.nn.Module.load_state_dict
        def observe_load(*args, **kwargs):
            calls.append(("load", kwargs.copy()))
            return original_load(*args, **kwargs)
        def observe_strict(model, *args, **kwargs):
            calls.append(("strict", kwargs.copy()))
            return original_strict(model, *args, **kwargs)
        with observe_patch.object(torch, "load", side_effect=observe_load), observe_patch.object(
                torch.nn.Module, "load_state_dict", new=observe_strict), observe_patch.object(
                AutoModel, "from_pretrained", side_effect=AssertionError("Model downloads forbidden")):
            loaded = recovery.load_model(SOURCE)
        self.assertTrue(any(kind == "load" and args.get("mmap") is True for kind, args in calls),
                        "Low-memory mmap loading is missing")
        self.assertTrue(any(kind == "strict" and args.get("assign") is True for kind, args in calls),
                        "Strict non-copying state assignment is missing")
        self.assertEqual(loaded["model"].__class__.__name__, "SoterLLMv14")
        self.assertEqual(loaded["wrapper"].__class__.__name__, "OnnxWrapper")
        self.assertFalse(loaded["model"].training)
        self.assertEqual(loaded["info"]["state_tensors"], 68)
        self.assertEqual(loaded["info"]["state_elements"], 51810575)
        self.assertEqual(loaded["info"]["source_sha256"],
                         "166733d6004519b3548098cf53b51f649cf46e1b918f1013f2a886d1dfc9059f")
        self.assertEqual(loaded["info"]["source_state_sha256"], loaded["info"]["loaded_state_sha256"])
        self.assertTrue(loaded["info"]["all_source_tensors_equal_loaded"])
        self.assertTrue(any(kind == "load" and args.get("weights_only") is True
                            and args.get("map_location") == "cpu" for kind, args in calls))
        self.assertTrue(any(kind == "strict" and args.get("strict") is True for kind, args in calls))
        enc = loaded["tokenizer"](["What is the capital of France?"], return_tensors="pt")
        with torch.inference_mode():
            logits, attack = loaded["model"](enc["input_ids"], enc["attention_mask"])
            wrapped = loaded["wrapper"](enc["input_ids"], enc["attention_mask"])
        self.assertEqual(tuple(logits.shape), (1, 14))
        self.assertEqual(tuple(attack.shape), (1,))
        temperature = loaded["metadata"]["temperature"]
        self.assertEqual(temperature, 0.9668524298940052)
        self.assertEqual(loaded["wrapper"].temperature, temperature)
        self.assertTrue(torch.equal(wrapped, logits / temperature))
        self.assertFalse(torch.allclose(wrapped, logits / temperature / temperature, atol=1e-5))


class ExportTests(unittest.TestCase):
    setUp = SafetyTests.setUp
    cli = SafetyTests.cli
    module = SafetyTests.module

    def test_cli_exports_checked_logit_bundle_and_preserves_source(self):
        import numpy as np
        import onnx
        import onnxruntime as ort
        import torch
        recovery = self.module()
        torch.set_num_threads(2)
        expected = recovery.EXPECTED_WEIGHTS_SHA256
        output = self.work / "bundle"
        result = self.cli(SOURCE, output)
        self.assertEqual(result.returncode, 0, result.stderr[-10000:])
        self.assertTrue((output / "model.onnx").is_file(),
                        "CLI reported success without exporting an ONNX artifact")
        manifest = json.loads((output / "recovery_manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["status"], "verified_serialization_recovery")
        self.assertEqual(manifest["source_sha256"], expected)
        self.assertTrue(manifest["all_source_tensors_equal_loaded"])
        self.assertEqual(manifest["source_state_sha256"], manifest["loaded_state_sha256"])
        self.assertGreaterEqual(len(manifest["parity"]["cases"]), 4)
        self.assertLessEqual(manifest["parity"]["max_abs_logit_difference"], 0.001)
        self.assertTrue(manifest["onnx_checker_passed"])
        self.assertEqual(manifest["temperature_applications"], 1)
        self.assertFalse((output / "pytorch_model.bin").exists(), "Do not duplicate source weights")
        for relative in ("labels.json", "calibration.json", "encoder_config.json",
                         "tokenizer_config/tokenizer.json", "tokenizer_config/vocab.txt"):
            self.assertEqual((output / relative).read_bytes(), (SOURCE / relative).read_bytes())
        with (SOURCE / "pytorch_model.bin").open("rb") as stream:
            self.assertEqual(hashlib.file_digest(stream, "sha256").hexdigest(), expected)
        with (output / "model.onnx").open("rb") as stream:
            self.assertEqual(hashlib.file_digest(stream, "sha256").hexdigest(), manifest["model_sha256"])
        onnx.checker.check_model(str(output / "model.onnx"))
        opts = ort.SessionOptions()
        opts.intra_op_num_threads, opts.inter_op_num_threads = 2, 1
        session = ort.InferenceSession(str(output / "model.onnx"), sess_options=opts,
                                       providers=["CPUExecutionProvider"])
        self.assertEqual([(i.name, i.type) for i in session.get_inputs()],
                         [("input_ids", "tensor(int64)"), ("attention_mask", "tensor(int64)")])
        self.assertEqual([o.name for o in session.get_outputs()], ["logits"])
        loaded = recovery.load_model(SOURCE)
        cases = [
            (["What is the capital of France?"], False),
            (["What is the capital of France?"], True),
            (["Namaste, meri booking ka status kya hai?", "Summarize this support email."], False),
            (["Namaste, meri booking ka status kya hai?", "Summarize this support email."], True),
        ]
        for texts, fixed in cases:
            with self.subTest(batch=len(texts), fixed=fixed):
                batch = loaded["tokenizer"](texts, return_tensors="pt", truncation=True,
                                            max_length=256, padding="max_length" if fixed else True)
                feed = {name: batch[name].numpy().astype(np.int64, copy=False)
                        for name in ("input_ids", "attention_mask")}
                actual = session.run(["logits"], feed)[0]
                with torch.inference_mode():
                    reference = loaded["wrapper"](batch["input_ids"], batch["attention_mask"]).numpy()
                self.assertEqual(actual.shape, (len(texts), 14))
                np.testing.assert_allclose(actual, reference, atol=1e-4, rtol=1e-4)
                self.assertLessEqual(float(np.max(np.abs(actual-reference))), 0.001)




class ReviewedBlockerTests(unittest.TestCase):
    """Appended regressions for the three exact-hash manual-cycle-2 blockers."""

    setUp = SafetyTests.setUp
    module = SafetyTests.module
    metadata_fixture = SafetyTests.metadata_fixture
    tiny_fixture = SnapshotTests.tiny_fixture
    invoke_tiny_main = FinalizationTests.invoke_tiny_main

    def test_rejected_exclusive_creator_cannot_record_failure_in_winners_bundle(self):
        recovery = self.module()
        source, digest, definitions = self.tiny_fixture()
        output = self.work / "concurrently-created-bundle"
        with observe_patch.object(recovery, "repository_definitions",
                                  return_value=(definitions, {"synthetic_fixture_only": True})):
            winner_loaded = recovery.load_model(source, digest)
            rejected_loaded = recovery.load_model(source, digest)
        winner_ready, create_winner, winner_done = (
            threading.Event(), threading.Event(), threading.Event()
        )
        winner_outcome, rejected_error = {}, None
        original_mkdir = Path.mkdir

        def bundle_files():
            return {
                path.relative_to(output).as_posix(): {
                    "bytes": path.stat().st_size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
                for path in sorted(output.rglob("*")) if path.is_file()
            }

        def winning_invocation():
            try:
                recovery.validate_paths(source, output)
                winner_ready.set()
                self.assertTrue(create_winner.wait(180), "Concurrent creator was not released")
                winner_outcome["manifest"] = recovery._recover_bundle(source, output)
                winner_outcome["files_before_rejection"] = bundle_files()
            except recovery.RecoveryError as error:
                winner_outcome["error"] = str(error)
            finally:
                winner_done.set()

        winner = threading.Thread(target=winning_invocation, name="recovery-exclusive-winner")

        def fixture_loader(path):
            self.assertEqual(path, source)
            return winner_loaded if threading.current_thread() is winner else rejected_loaded

        def order_exclusive_creators(path, *args, **kwargs):
            if path == output and threading.current_thread() is not winner:
                # Synthetic scheduling only: both validations see no directory;
                # two native invocations then attempt the real exclusive mkdir.
                create_winner.set()
                self.assertTrue(winner_done.wait(180), "Winning invocation did not finish")
                self.assertIn("manifest", winner_outcome, winner_outcome)
                self.assertEqual(winner_outcome["manifest"]["status"],
                                 "verified_serialization_recovery")
            return original_mkdir(path, *args, **kwargs)

        try:
            with observe_patch.object(recovery, "load_model", side_effect=fixture_loader), \
                    observe_patch.object(Path, "mkdir", new=order_exclusive_creators):
                winner.start()
                self.assertTrue(winner_ready.wait(30), "Winning invocation did not validate")
                recovery.validate_paths(source, output)
                try:
                    recovery._recover_bundle(source, output)
                except recovery.RecoveryError as error:
                    rejected_error = str(error)
                winner.join(timeout=180)
            observed = {
                "synthetic_model_fixture_only": True,
                "synthetic_scheduling_real_concurrent_exclusive_creation": True,
                "winner_status": winner_outcome.get("manifest", {}).get("status"),
                "rejected_error": rejected_error,
                "winner_files_before_rejection": winner_outcome.get("files_before_rejection"),
                "files_after_rejection_before_test_teardown": bundle_files(),
                "failure_record_before_test_teardown": (output / "RECOVERY_FAILED.json").exists(),
                "winner_snapshot_removed_before_test_teardown": not winner_loaded.snapshot_dir.exists(),
                "rejected_snapshot_removed_before_test_teardown": not rejected_loaded.snapshot_dir.exists(),
            }
            print("[rejected-exclusive-creator] " + json.dumps(observed, sort_keys=True))
            self.assertFalse(winner.is_alive(), "Winning native invocation did not finish")
            self.assertIsNotNone(rejected_error, "The competing exclusive creator was not rejected")
            self.assertIn("FileExistsError", rejected_error)
            self.assertFalse((output / "RECOVERY_FAILED.json").exists(),
                             "Rejected exclusive creator wrote into another invocation's bundle")
            self.assertEqual(observed["files_after_rejection_before_test_teardown"],
                             observed["winner_files_before_rejection"],
                             "Rejected invocation changed the winning bundle's complete file set or bytes")
            self.assertTrue(observed["winner_snapshot_removed_before_test_teardown"])
            self.assertTrue(observed["rejected_snapshot_removed_before_test_teardown"])
        finally:
            create_winner.set()
            if winner.ident is not None:
                winner.join(timeout=180)
            winner_loaded.close()
            rejected_loaded.close()

    def test_checkpoint_sha_rejection_reaches_cli_with_persistent_native_deny_delete_lock(self):
        import ctypes
        from contextlib import contextmanager
        from ctypes import wintypes

        self.assertEqual(os.name, "nt", "This regression requires real Windows sharing semantics")
        recovery = self.module()
        source = self.metadata_fixture()
        output = self.work / "sha-rejected-output"
        source_digest = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        primary = f"source SHA256 mismatch: expected {recovery.EXPECTED_WEIGHTS_SHA256}, got {source_digest}"
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateFileW.argtypes = (
            wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
            wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
        )
        kernel32.CreateFileW.restype = wintypes.HANDLE
        kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel32.CloseHandle.restype = wintypes.BOOL
        original_snapshot, original_open = recovery._SnapshotResult, Path.open
        original_load_state = recovery.load_state
        temporaries, snapshot_dirs, snapshots, cleanup_patches = [], [], [], []
        handles, attempts, cleanup_denials, native_denials, delays, errors = [], [], [], [], [], []
        stdout, stderr = io.StringIO(), io.StringIO()

        def remember_snapshot(*args, **kwargs):
            snapshot = original_snapshot(*args, **kwargs)
            temporaries.append(snapshot._temporary)
            snapshot_dirs.append(snapshot.snapshot_dir)
            snapshots.append(weakref.ref(snapshot))
            original_cleanup = snapshot._temporary.cleanup

            def observe_native_cleanup():
                attempts.append(True)
                try:
                    return original_cleanup()
                except PermissionError as error:
                    cleanup_denials.append({"winerror": error.winerror, "error": str(error)})
                    raise

            cleanup_patch = observe_patch.object(snapshot._temporary, "cleanup",
                                                 side_effect=observe_native_cleanup)
            cleanup_patches.append(cleanup_patch)
            cleanup_patch.start()
            return snapshot

        @contextmanager
        def snapshot_writer_with_external_lock(path, mode, *args, **kwargs):
            with original_open(path, mode, *args, **kwargs) as stream:
                yield stream
            # Synthetic checkpoint fixture, genuine external native lock. The
            # handle is intentionally outside every production failure frame.
            # FILE_SHARE_READ | FILE_SHARE_WRITE explicitly omits SHARE_DELETE.
            handle = kernel32.CreateFileW(str(path), 0x80000000, 0x00000003,
                                          None, 3, 0x00000080, None)
            if handle == ctypes.c_void_p(-1).value:
                raise ctypes.WinError(ctypes.get_last_error())
            handles.append(handle)
            with self.assertRaises(PermissionError) as denied:
                path.unlink()
            native_denials.append({"winerror": denied.exception.winerror,
                                   "error": str(denied.exception)})

        def lock_copied_checkpoint(path, mode="r", *args, **kwargs):
            if mode == "xb" and path.name == "pytorch_model.bin" and path.parent in snapshot_dirs:
                return snapshot_writer_with_external_lock(path, mode, *args, **kwargs)
            return original_open(path, mode, *args, **kwargs)

        def observe_loader_rejection(*args, **kwargs):
            try:
                return original_load_state(*args, **kwargs)
            except recovery.RecoveryError as error:
                errors.append(error)
                raise

        try:
            with observe_patch.object(recovery, "_SnapshotResult", side_effect=remember_snapshot), \
                    observe_patch.object(Path, "open", new=lock_copied_checkpoint), \
                    observe_patch.object(recovery, "load_state", side_effect=observe_loader_rejection), \
                    observe_patch.object(recovery.time, "sleep", side_effect=delays.append), \
                    redirect_stdout(stdout), redirect_stderr(stderr):
                code = recovery.main(["--source-dir", str(source), "--output-dir", str(output)])
            observed = {
                "synthetic_checkpoint_fixture_only": True,
                "native_lock": "CreateFileW FILE_SHARE_READ|FILE_SHARE_WRITE; no FILE_SHARE_DELETE",
                "cli_exit_code": code, "stderr": stderr.getvalue(),
                "loader_error": str(errors[0]) if errors else None,
                "loader_notes": getattr(errors[0], "__notes__", []) if errors else [],
                "snapshot_locked_before_test_teardown": [path.exists() for path in snapshot_dirs],
                "snapshot_owner_alive_before_test_teardown": [ref() is not None for ref in snapshots],
                "external_native_handles_before_test_teardown": len(handles),
                "native_unlink_denials": native_denials,
                "cleanup_attempts": len(attempts), "actual_windows_cleanup_denials": cleanup_denials,
                "retry_delays": delays, "output_existed_before_test_teardown": output.exists(),
            }
            print("[sha-primary-persistent-native-lock] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 2, stderr.getvalue())
            self.assertEqual(len(errors), 1)
            self.assertEqual(len(handles), 1)
            self.assertEqual(len(native_denials), 1)
            self.assertEqual(native_denials[0]["winerror"], 32)
            self.assertEqual(len(attempts), 8)
            self.assertEqual(len(cleanup_denials), 8)
            self.assertEqual(delays, [0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5])
            self.assertEqual(observed["snapshot_locked_before_test_teardown"], [True])
            self.assertIn(primary, stderr.getvalue(),
                          "Persistent native cleanup replaced the checkpoint SHA rejection at the CLI")
            self.assertIn("Required private cleanup rejected", stderr.getvalue())
            self.assertIn("verified snapshot cleanup failed", stderr.getvalue())
            self.assertEqual(str(errors[0]), primary)
            self.assertTrue(any("Required private cleanup rejected" in note
                                for note in getattr(errors[0], "__notes__", [])))
            self.assertFalse(output.exists(), "SHA rejection created or contaminated an output")
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout.getvalue())
            self.assertEqual(hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest(),
                             source_digest)
        finally:
            # Release only after all native directory/error observations above.
            for cleanup_patch in cleanup_patches:
                cleanup_patch.stop()
            for handle in handles:
                self.assertTrue(kernel32.CloseHandle(handle))
            for error in errors:
                clear_fixture_error(error)
            errors.clear()
            for temporary in temporaries:
                cleanup_fixture(temporary)

    def test_final_publication_oserror_keeps_failure_record_refusal_notes_at_cli(self):
        recovery, source, loaded = FinalizationTests.tiny_loaded(self)
        snapshot_dir = loaded.snapshot_dir
        output = self.work / "publication-and-failure-record-refused"
        source_digest = hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest()
        primary = "synthetic final manifest publication OSError"
        refusal = "synthetic failure record persistence refused"
        original_write = Path.write_text
        publication_denials, recording_denials, cleanup_at_publication = [], [], []

        def reject_publication_and_failure_record(path, text, *args, **kwargs):
            if path == output / "recovery_manifest.json":
                # Two explicit synthetic I/O faults, after real tiny ONNX
                # serialization/checker/ORT parity and native snapshot cleanup.
                cleanup_at_publication.append(not snapshot_dir.exists() and loaded._temporary is None)
                publication_denials.append(True)
                raise OSError(primary)
            if path == output / "RECOVERY_FAILED.json":
                recording_denials.append(True)
                raise PermissionError(refusal)
            return original_write(path, text, *args, **kwargs)

        try:
            with observe_patch.object(Path, "write_text", new=reject_publication_and_failure_record):
                code, stdout, stderr = self.invoke_tiny_main(recovery, source, loaded, output)
            observed = {
                "synthetic_model_fixture_only": True,
                "synthetic_publication_and_failure_persistence_faults": True,
                "cli_exit_code": code, "stderr": stderr,
                "publication_fault_injections": len(publication_denials),
                "failure_record_fault_injections": len(recording_denials),
                "cleanup_complete_before_publication": cleanup_at_publication,
                "snapshot_removed_before_test_teardown": not snapshot_dir.exists(),
                "verified_manifest_before_test_teardown": (output / "recovery_manifest.json").exists(),
                "failure_record_before_test_teardown": (output / "RECOVERY_FAILED.json").exists(),
            }
            print("[final-publication-oserror-and-refused-record] " + json.dumps(observed, sort_keys=True))
            self.assertEqual(code, 2, stderr)
            self.assertEqual(publication_denials, [True])
            self.assertEqual(recording_denials, [True])
            self.assertEqual(cleanup_at_publication, [True])
            self.assertIn("recovery finalization failed: OSError", stderr)
            self.assertIn(primary, stderr)
            self.assertIn("Failure record could not be written", stderr,
                          "RecoveryError wrapping dropped the failure-record refusal from the CLI")
            self.assertIn(refusal, stderr)
            self.assertIn("[recovery detail]", stderr)
            self.assertFalse((output / "recovery_manifest.json").exists())
            self.assertFalse((output / "RECOVERY_FAILED.json").exists(), "Persistence refusal was bypassed")
            self.assertFalse(snapshot_dir.exists(), "Final publication ran before required cleanup")
            self.assertIsNone(loaded._temporary)
            self.assertNotIn('"status": "verified_serialization_recovery"', stdout)
            self.assertEqual(hashlib.sha256((source / "pytorch_model.bin").read_bytes()).hexdigest(),
                             source_digest)
        finally:
            loaded.close()


class DirectExecutionCoverageTests(unittest.TestCase):
    def test_direct_script_runs_every_late_reviewed_blocker(self):
        import re

        scratch = Path(os.environ["TMPDIR"]).resolve()
        self.assertEqual(Path(tempfile.gettempdir()).resolve(), scratch)
        for key in ("TMPDIR", "TMP", "TEMP"):
            self.assertEqual(Path(os.environ[key]).resolve(), scratch)
        env = dict(
            os.environ, TMPDIR=str(scratch), TMP=str(scratch), TEMP=str(scratch),
            PYTHONDONTWRITEBYTECODE="1", HF_HUB_OFFLINE="1",
            TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
            OMP_NUM_THREADS="2", MKL_NUM_THREADS="2", TOKENIZERS_PARALLELISM="false",
        )
        result = subprocess.run(
            [sys.executable, "-B", str(Path(__file__).resolve()),
             "-k", "ReviewedBlockerTests"],
            cwd=ROOT, env=env, check=False, capture_output=True, text=True, timeout=600,
        )
        transcript = result.stdout + result.stderr
        expected = (
            ("__main__.ReviewedBlockerTests."
             "test_checkpoint_sha_rejection_reaches_cli_with_persistent_native_deny_delete_lock"),
            ("__main__.ReviewedBlockerTests."
             "test_final_publication_oserror_keeps_failure_record_refusal_notes_at_cli"),
            ("__main__.ReviewedBlockerTests."
             "test_rejected_exclusive_creator_cannot_record_failure_in_winners_bundle"),
        )
        records = re.findall(
            r"(?ms)^test_\w+ \((__main__\.[^)]+)\) \.\.\. "
            r"(.*?)(?=^test_\w+ \(|^-{10,}$|\Z)",
            result.stderr,
        )
        self.assertCountEqual(
            [case_id for case_id, _ in records], expected,
            "Direct execution omitted original late tests:\n" + transcript,
        )
        self.assertCountEqual(
            [case_id for case_id, output in records
             if output.strip() and output.strip().splitlines()[-1] == "ok"],
            expected, transcript,
        )
        self.assertEqual(result.returncode, 0, transcript)
        self.assertRegex(result.stderr, r"(?m)^Ran 3 tests in [^\n]+$")
        self.assertRegex(result.stderr, r"(?m)^OK$")


if __name__ == "__main__":
    unittest.main(verbosity=2)
