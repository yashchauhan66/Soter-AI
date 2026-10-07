"""CPU tests use tiny local teachers; no downloads or production artifacts."""
import hashlib
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import sys
import shutil
import unittest
from unittest.mock import patch
import uuid

import numpy as np
import torch
import torch.nn.functional as F
from transformers import BertConfig, BertTokenizer, DistilBertConfig

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
import soter_distill

spec = importlib.util.spec_from_file_location("trainer_under_test", ML / "train-soterllm-v14-fullft.py")
trainer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trainer)
torch.set_num_threads(1)


@contextmanager
def workspace_tempdir():
    # Windows 3.12 TemporaryDirectory applies restrictive ACLs that exclude the
    # sandbox account. Inherit the workspace ACL and verify cleanup containment.
    root = (ML.parents[1] / "artifacts" / "ml").resolve()
    root.mkdir(parents=True, exist_ok=True)
    path = root / (".test-soter-distill-" + uuid.uuid4().hex)
    path.mkdir()
    try:
        yield str(path)
    finally:
        resolved = path.resolve()
        if resolved.parent != root or not resolved.name.startswith(".test-soter-distill-"):
            raise RuntimeError("refusing cleanup outside the test workspace")
        shutil.rmtree(resolved)


def tiny_config():
    c = DistilBertConfig(vocab_size=1030, max_position_embeddings=64,
                        n_layers=2, n_heads=4, dim=32, hidden_dim=128,
                        dropout=0.0, attention_dropout=0.0)
    c._attn_implementation = "eager"
    return c


class DistillationTests(unittest.TestCase):
    def test_slice_reuses_vocabulary_channels_and_selected_layer(self):
        teacher = trainer.SoterLLMv14("local", 14, dropout=0, encoder_config=tiny_config())
        config = soter_distill.compact_config(teacher.encoder.config, 16, 1)
        student = trainer.SoterLLMv14("local", 14, dropout=0, encoder_config=config)
        with torch.no_grad():
            teacher.encoder.transformer.layer[1].attention.q_lin.bias.fill_(0.125)
        facts = soter_distill.slice_teacher_into_student(teacher, student)
        channels = torch.linspace(0, 31, 16).round().long()
        self.assertEqual(facts["teacher_layer_indices"], [1])
        torch.testing.assert_close(student.encoder.embeddings.word_embeddings.weight,
                                   teacher.encoder.embeddings.word_embeddings.weight[:, channels])
        torch.testing.assert_close(student.encoder.transformer.layer[0].attention.q_lin.bias,
                                   torch.full((16,), 0.125))
        self.assertLess(sum(p.numel() for p in student.parameters()), sum(p.numel() for p in teacher.parameters()))
        self.assertEqual(student.encoder.config.vocab_size, teacher.encoder.config.vocab_size)
        b = soter_distill.compact_config(BertConfig(hidden_size=384, num_hidden_layers=6,
                                                  num_attention_heads=6), 192, 3)
        self.assertEqual((b.hidden_size, b.num_hidden_layers), (192, 3))
        with self.assertRaises(ValueError):
            soter_distill.compact_config(tiny_config(), 64, 1)

    def test_kl_has_temperature_squared_and_detaches_teacher(self):
        student = torch.tensor([[2., 0., -1.]], requires_grad=True)
        teacher = torch.tensor([[0., 2., -1.]], requires_grad=True)
        expected = F.kl_div(F.log_softmax(student / 3, -1), F.softmax(teacher / 3, -1),
                            reduction="batchmean") * 9
        actual = soter_distill.temperature_kl(student, teacher, 3)
        torch.testing.assert_close(actual, expected)
        actual.backward()
        self.assertIsNotNone(student.grad)
        self.assertIsNone(teacher.grad)

    def test_accumulation_tail_matches_reference_and_teacher_is_frozen(self):
        class Toy(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.weight = torch.nn.Parameter(torch.tensor([[0.2, -0.1], [-0.2, 0.1]]))

            def forward(self, ids, mask):
                logits = ids.float() @ self.weight
                return logits, logits[:, 1]

        batches = [(torch.tensor([[1., 0.]]), torch.ones(1, 2), torch.tensor([1])),
                   (torch.tensor([[0., 1.]]), torch.ones(1, 2), torch.tensor([0])),
                   (torch.tensor([[1., 1.]]), torch.ones(1, 2), torch.tensor([1]))]
        model, reference = Toy(), Toy()
        opt = torch.optim.SGD(model.parameters(), lr=0.1)
        schedule = torch.optim.lr_scheduler.LambdaLR(opt, lambda _: 1.)
        trainer.train_one_epoch(model, batches, opt, schedule, F.cross_entropy, torch.device("cpu"),
                                None, None, 2, 0, 100, None)
        ref_opt = torch.optim.SGD(reference.parameters(), lr=0.1)
        for window in (batches[:2], batches[2:]):
            ref_opt.zero_grad()
            sum(F.cross_entropy(reference(ids, mask)[0], labels) / len(window)
                for ids, mask, labels in window).backward()
            ref_opt.step()
        torch.testing.assert_close(model.weight, reference.weight)
        self.assertEqual(schedule.last_epoch, 2)
        teacher = Toy()
        before = teacher.weight.detach().clone()
        teacher.train()
        trainer.train_one_epoch(model, batches, opt, schedule, F.cross_entropy, torch.device("cpu"),
                                None, None, 2, 0, 100, 1, teacher=teacher)
        torch.testing.assert_close(teacher.weight, before)
        self.assertIsNone(teacher.weight.grad)
        self.assertFalse(teacher.training)

    def test_strict_labels_and_unicode_line_separators(self):
        with workspace_tempdir() as tmp:
            file = Path(tmp) / "data.jsonl"
            file.write_text(json.dumps({"text": "safe\u2028text", "label": "SAFE"}, ensure_ascii=False) + "\n", encoding="utf-8")
            self.assertEqual(trainer.load_jsonl([str(file)], {"SAFE": 0})[0], ["safe\u2028text"])
            for row in ({"text": "unlabelled"}, {"text": "unsupported", "label": "MEMORY_POISONING"}):
                file.write_text(json.dumps(row) + "\n", encoding="utf-8")
                with self.assertRaises(ValueError):
                    trainer.load_jsonl([str(file)], {"SAFE": 0})
            with self.assertRaises(ValueError):
                trainer.load_jsonl([str(Path(tmp) / "missing")], {"SAFE": 0})

    def test_split_rejects_hash_changes_overlaps_and_missing_rows(self):
        with workspace_tempdir() as tmp:
            data, split = Path(tmp) / "data", Path(tmp) / "split.json"
            data.write_text("four rows", encoding="utf-8")
            payload = {"dataset_sha256": hashlib.sha256(data.read_bytes()).hexdigest(),
                       "indices": {"train": [0], "calibration": [1], "validation": [2], "test": [3]}}
            split.write_text(json.dumps(payload), encoding="utf-8")
            parts, _ = soter_distill.load_prepared_split(split, [str(data)], 4)
            self.assertEqual(parts["test"], [3])
            for test_indices in ([2], []):
                payload["indices"]["test"] = test_indices
                split.write_text(json.dumps(payload), encoding="utf-8")
                with self.assertRaises(ValueError):
                    soter_distill.load_prepared_split(split, [str(data)], 4)
            data.write_text("changed", encoding="utf-8")
            with self.assertRaises(ValueError):
                soter_distill.load_prepared_split(split, [str(data)], 4)

    def test_missing_negative_calibration_is_reported(self):
        _, audit = trainer.fit_per_label_thresholds(np.array([[0.1, 0.9]]), np.array([1]),
                                                   2, 0.01, "legacy")
        self.assertEqual(audit["labels_without_negatives"], ["PROMPT_INJECTION"])

    def test_prepared_lineage_cannot_cross_partitions(self):
        with workspace_tempdir() as tmp:
            data, split = Path(tmp) / "data.jsonl", Path(tmp) / "split.json"
            rows = [{"text": f"row {i}", "label": "SAFE", "_v18": {
                "lineage_group_sha256": ("a" if i < 2 else chr(97 + i)) * 64}} for i in range(4)]
            data.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
            split.write_text(json.dumps({
                "method": "declared_lineage_and_normalized_text_connected_components_sha256_assignment",
                "dataset_sha256": hashlib.sha256(data.read_bytes()).hexdigest(),
                "indices": {"train": [0], "calibration": [1], "validation": [2], "test": [3]},
            }), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "lineage group"):
                soter_distill.load_prepared_split(split, [str(data)], 4)

    def test_local_student_train_export_reload_and_resume(self):
        with workspace_tempdir() as tmp:
            base = Path(tmp)
            teacher_dir, output = base / "teacher", base / "student"
            token_dir = teacher_dir / "tokenizer_config"
            token_dir.mkdir(parents=True)
            vocab = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"] + [f"##part{i}" for i in range(1025)]
            (token_dir / "vocab.txt").write_text("\n".join(vocab) + "\n", encoding="utf-8")
            # The positional vocabulary argument works with Transformers 4
            # (vocab_file) and 5 (vocab); v5 silently ignores vocab_file=.
            BertTokenizer(str(token_dir / "vocab.txt"), do_lower_case=False).save_pretrained(token_dir)
            config = tiny_config()
            teacher = trainer.SoterLLMv14("local", 14, dropout=0, encoder_config=config)
            torch.save(teacher.state_dict(), teacher_dir / "pytorch_model.bin")
            (teacher_dir / "encoder_config.json").write_text(config.to_json_string(), encoding="utf-8")
            (teacher_dir / "training_stats.json").write_text(json.dumps({"base_model": "local",
                "labels": trainer.ALL_LABELS, "architecture": {"dropout": 0.0}}), encoding="utf-8")
            (teacher_dir / "labels.json").write_text(json.dumps(dict(enumerate(trainer.ALL_LABELS))), encoding="utf-8")
            data = base / "corpus.jsonl"
            rows = [{"text": "example " + chr(97 + i) + " request", "label": trainer.ALL_LABELS[i % 2]}
                    for i in range(24)]
            data.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
            split = base / "split.json"
            split.write_text(json.dumps({"dataset_sha256": hashlib.sha256(data.read_bytes()).hexdigest(),
                "indices": {"train": list(range(12)), "calibration": list(range(12, 16)),
                            "validation": list(range(16, 20)), "test": list(range(20, 24))}}), encoding="utf-8")
            argv = ["trainer", "--teacher-dir", str(teacher_dir), "--student-hidden-size", "16",
                    "--student-layers", "1", "--output-dir", str(output), "--product-version", "v18-smoke",
                    "--train-datasets", str(data), "--split-file", str(split), "--epochs", "1",
                    "--batch-size", "2", "--grad-accum", "2", "--max-steps", "1", "--max-length", "32",
                    "--amp", "off", "--no-augment", "--checkpoint"]
            with patch.object(sys, "argv", argv):
                self.assertEqual(trainer.main(), 0)
            stats = json.loads((output / "training_stats.json").read_text())
            self.assertEqual(stats["product_version"], "v18-smoke")
            self.assertTrue(stats["onnx_parity"]["passed"])
            self.assertEqual(stats["architecture"]["hidden_size"], 16)
            self.assertTrue((output / "test_results.json").is_file())
            self.assertEqual(trainer.verify_only(output, 32), 0)
            # Completed resume must preserve the historical selected model.
            with patch.object(sys, "argv", argv + ["--resume"]):
                self.assertEqual(trainer.main(), 0)
            # These settings do not change tensor shapes, but do change the
            # training recipe. Refuse them before any resumed optimization.
            checkpoint_hash = soter_distill.file_sha256(output / "checkpoint.pt")
            for changed in (["--max-length", "16"], ["--dropout", "0.5"],
                            ["--max-grad-norm", "0.25"], ["--amp", "bf16"],
                            ["--grad-checkpoint"], ["--no-length-grouped"],
                            ["--length-mega-factor", "2"]):
                with self.subTest(changed=changed):
                    with patch.object(sys, "argv", argv + ["--resume"] + changed), \
                            patch.object(trainer, "train_one_epoch") as resumed_train:
                        with self.assertRaisesRegex(ValueError, "different/missing data or model signature"):
                            trainer.main()
                        resumed_train.assert_not_called()
                    self.assertEqual(soter_distill.file_sha256(output / "checkpoint.pt"), checkpoint_hash)

    def test_interrupted_checkpoint_preserves_previous_file(self):
        with workspace_tempdir() as tmp:
            path = Path(tmp) / "checkpoint.pt"
            soter_distill.atomic_torch_save({"epoch": 1}, path)
            with patch.object(torch, "save", side_effect=OSError("simulated disconnect")):
                with self.assertRaises(OSError):
                    soter_distill.atomic_torch_save({"epoch": 2}, path)
            self.assertEqual(torch.load(path, weights_only=True)["epoch"], 1)


if __name__ == "__main__":
    unittest.main()
