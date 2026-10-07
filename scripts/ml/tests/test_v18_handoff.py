"""Regression checks for the runnable Colab handoff (no GPU or downloads)."""
import ast
import argparse
import importlib.util
from pathlib import Path
import shutil
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("v18_launcher", ROOT / "scripts/ml/colab/run_v18_colab.py")
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.directory = ROOT / "artifacts/ml" / ("v18-handoff-test-" + uuid.uuid4().hex)
        self.directory.mkdir()

    def tearDown(self):
        # The directory was created by this test under the explicit workspace.
        if not self.directory.resolve().is_relative_to((ROOT / "artifacts/ml").resolve()):
            raise AssertionError("Unexpected test path")
        shutil.rmtree(self.directory)

    def test_interrupted_checkpoint_is_preserved(self):
        checkpoint = self.directory / "checkpoint.pt"
        checkpoint.write_bytes(b"existing training progress")
        with self.assertRaisesRegex(ValueError, "progress"):
            launcher.protect_output(self.directory, False)
        launcher.protect_output(self.directory, True)
        self.assertEqual(checkpoint.read_bytes(), b"existing training progress")

    def test_resume_requires_checkpoint(self):
        with self.assertRaisesRegex(ValueError, "missing"):
            launcher.protect_output(self.directory, True)
        launcher.protect_output(self.directory, False)

    def test_command_matches_real_trainer_parser(self):
        # Compile only the actual argument parser; loading torch is unnecessary.
        source = (ROOT / "scripts/ml/train-soterllm-v14-fullft.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        parser_function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "build_argparser")
        ns = {"argparse": argparse, "Path": Path, "DEFAULT_DATASETS": [], "PRODUCT_VERSION": "v14",
              "ENCODERS": {"mdistilbert": "distilbert-base-multilingual-cased"}, "MAX_LENGTH": 256}
        exec(compile(ast.Module(body=[parser_function], type_ignores=[]), "real-trainer-parser", "exec"), ns)
        cmd = launcher.command(self.directory, 5, 16, "fp16", True)
        args = ns["build_argparser"]().parse_args(cmd[2:])
        self.assertTrue(args.checkpoint)
        self.assertTrue(args.resume)
        self.assertEqual((args.student_hidden_size, args.student_layers, args.max_length), (384, 3, 256))
        self.assertEqual(args.batch_size * args.grad_accum, 64)


if __name__ == "__main__":
    unittest.main()
