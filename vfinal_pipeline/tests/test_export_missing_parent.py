"""UNIT-only native export destination regression; no pretrained weights."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from vfinal_pipeline import calibration_export
from vfinal_pipeline.common import identity


def fixture_root():
    return Path(tempfile.mkdtemp(prefix='export-parent-', dir=os.environ.get('VFINAL_EXPORT_PARENT_FIXTURES')))


def tiny_inputs():
    import torch

    class Tiny(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.head = torch.nn.Linear(2, 2)
            with torch.no_grad():
                self.head.weight.copy_(torch.tensor([[0.2, -0.1], [-0.3, 0.4]]))
                self.head.bias.copy_(torch.tensor([0.05, -0.02]))

        def forward(self, input_ids, attention_mask):
            mask = attention_mask.float()
            summed = (input_ids.float() * mask).sum(1)
            width = mask.sum(1)
            return self.head(torch.stack([summed / width, width], 1))

    examples = [
        {'input_ids': torch.tensor([[1, 2]]), 'attention_mask': torch.tensor([[1, 1]])},
        {'input_ids': torch.tensor([[1, 2, 3], [1, 0, 0]]),
         'attention_mask': torch.tensor([[1, 1, 1], [1, 0, 0]])},
        {'input_ids': torch.tensor([[1, 2, 3, 1]]), 'attention_mask': torch.tensor([[1, 1, 1, 1]])},
    ]
    calibration = calibration_export.calibrate(
        [[2., 0.], [0., 2.]], [0, 1], split='validation', model_identity='a' * 64,
        data_identity='b' * 64, max_fpr=0.5, fit_temperature=False,
    )
    return Tiny().eval(), examples, calibration


class ExportMissingParent(unittest.TestCase):
    def assert_export(self, destination):
        model, examples, calibration = tiny_inputs()
        self.assertEqual(sum(p.numel() for p in model.parameters()), 6)
        try:
            report = calibration_export.export_onnx(
                model, examples, calibration, destination, unit_only=True, quantize=False,
            )
        except FileNotFoundError as exc:
            self.fail(f'recursive export destination must be admitted: {exc}')
        self.assertTrue((destination / 'model.onnx').is_file())
        self.assertEqual(json.loads((destination / 'export.json').read_bytes()), report)
        self.assertEqual(report['unit_only'], True)
        self.assertFalse(report['release_ready'])
        self.assertEqual(report['pretrained_export'], 'NOT RUN')
        self.assertEqual([row['shape'] for row in report['parity']], [[1, 2], [2, 3], [1, 4]])
        self.assertLessEqual(report['max_absolute_error'], 1e-4)
        self.assertTrue(all(row['variant'] == 'fp32' for row in report['parity']))

    def test_real_tiny_export_creates_missing_intermediate_parents(self):
        root = fixture_root()
        destination = root / 'missing' / 'nested' / 'export'
        self.assertFalse(destination.parent.exists())
        self.assert_export(destination)
        self.assertTrue(destination.parent.is_dir())


    def test_real_tiny_export_with_existing_parent(self):
        root = fixture_root()
        self.assertTrue(root.is_dir())
        self.assert_export(root / 'export')


class AdmissionReached(RuntimeError):
    """No-model admission sentinel, not genuine export success."""


class StopBeforeModel:
    def __init__(self):
        self.reached = False

    def __len__(self):
        self.reached = True
        raise AdmissionReached('no-model admission reached')


def signed_calibration():
    value = {'split': 'validation', 'temperature': 1.0}
    return {**value, 'identity': identity(value)}


class ExportParentAdmission(unittest.TestCase):
    def check_floor(self, disk, ram, *, unit_only, admitted):
        # Simulated readings through the REAL resources helper. Never load a model.
        for layout in ('existing', 'missing', 'relative-missing'):
            with self.subTest(layout=layout):
                root = fixture_root()
                destination = root / 'export' if layout == 'existing' else root / 'missing' / 'nested' / 'export'
                if layout == 'relative-missing':
                    destination = Path(os.path.relpath(destination))
                examples = StopBeforeModel()
                error = AdmissionReached if admitted else ValueError
                message = 'no-model admission reached' if admitted else 'genuine model resource floor unmet'
                with (
                    patch('vfinal_pipeline.experiment.shutil.disk_usage', return_value=SimpleNamespace(free=disk)) as disk_usage,
                    patch('psutil.virtual_memory', return_value=SimpleNamespace(available=ram)) as memory,
                    self.assertRaisesRegex(error, message),
                ):
                    calibration_export.export_onnx(object(), examples, {}, destination, unit_only=unit_only)
                disk_usage.assert_called_once()
                measured = Path(disk_usage.call_args.args[0])
                self.assertEqual(measured.resolve(), root.resolve())
                self.assertTrue(measured.is_dir())
                memory.assert_called_once_with()
                self.assertEqual(examples.reached, admitted)
                self.assertEqual(list(root.iterdir()), [])

    def test_false_exact_floors_reach_no_model_sentinel(self):
        self.check_floor(933930572, 5368709120, unit_only=False, admitted=True)

    def test_false_below_disk_floor_rejected_without_mkdir(self):
        self.check_floor(933930571, 5368709120, unit_only=False, admitted=False)

    def test_false_below_ram_floor_rejected_without_mkdir(self):
        self.check_floor(933930572, 5368709119, unit_only=False, admitted=False)

    def test_literal_true_keeps_unit_admission_without_mkdir(self):
        self.check_floor(0, 0, unit_only=True, admitted=True)

    def test_strict_boolean_precedes_path_and_resources(self):
        class UnreadablePath:
            def __fspath__(self):
                raise AssertionError('path inspected before boolean admission')

        root = fixture_root()
        for value in ('false', '', 1, 0, [], {}, None):
            with (
                self.subTest(value=value),
                patch('vfinal_pipeline.experiment.resources') as resources,
                self.assertRaisesRegex(ValueError, 'boolean unit_only required'),
            ):
                calibration_export.export_onnx(object(), [], {}, UnreadablePath(), unit_only=value)
            resources.assert_not_called()
        self.assertEqual(list(root.iterdir()), [])

    def test_invalid_calibration_does_not_create_missing_parents(self):
        for mutation, message in (('split', 'validation calibration'), ('identity', 'calibration identity mismatch')):
            with self.subTest(mutation=mutation):
                root = fixture_root()
                calibration = signed_calibration()
                if mutation == 'split':
                    calibration['split'] = 'holdout'
                else:
                    calibration['temperature'] = 2.0
                with self.assertRaisesRegex(ValueError, message):
                    calibration_export.export_onnx(
                        object(), [None] * 3, calibration, root / 'missing' / 'export', unit_only=True,
                    )
                self.assertEqual(list(root.iterdir()), [])

    def test_insufficient_examples_do_not_create_missing_parents(self):
        root = fixture_root()
        with self.assertRaisesRegex(ValueError, 'three dynamic batch/sequence parity examples required'):
            calibration_export.export_onnx(
                object(), [None] * 2, signed_calibration(), root / 'missing' / 'export', unit_only=True,
            )
        self.assertEqual(list(root.iterdir()), [])

    def test_invalid_destinations_remain_rejected_without_writes(self):
        root = fixture_root()
        existing = root / 'existing'
        existing.mkdir()
        blocker = root / 'blocker'
        blocker.write_bytes(b'UNCHANGED UNIT SENTINEL')
        for name, destination in (
            ('existing-directory', existing),
            ('existing-file', blocker),
            ('file-ancestor', blocker / 'missing' / 'export'),
            ('invalid-parent', root / 'invalid\x00parent' / 'export'),
        ):
            with self.subTest(name=name), self.assertRaises((OSError, ValueError)):
                calibration_export.export_onnx(
                    object(), [None] * 3, signed_calibration(), destination, unit_only=True,
                )
            self.assertEqual(blocker.read_bytes(), b'UNCHANGED UNIT SENTINEL')
            self.assertEqual(list(existing.iterdir()), [])
            self.assertEqual(set(root.iterdir()), {existing, blocker})


if __name__ == '__main__':
    unittest.main()
