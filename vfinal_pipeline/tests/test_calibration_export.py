from pathlib import Path
import tempfile
import unittest
from test_pipeline import module


class CalibrationExport(unittest.TestCase):
    def test_validation_calibration_and_real_tiny_onnx_parity(self):
        api = module(self, 'calibration_export')
        import torch
        raw = [[4.0, -2.0], [-1.0, 2.0], [0.2, 0.3], [2.0, -1.0]]
        y = [0, 1, 0, 0]
        c = api.calibrate(raw, y, split='validation', model_identity='a'*64,
                          data_identity='b'*64, max_fpr=0.0)
        self.assertLessEqual(c['nll_after'], c['nll_before'] + 1e-12)
        self.assertEqual(c['fpr'], 0.0)
        self.assertFalse(c['release_ready'])
        with self.assertRaisesRegex(ValueError, 'validation'):
            api.calibrate(raw, y, split='holdout', model_identity='a'*64, data_identity='b'*64, max_fpr=0.0)
        with self.assertRaises(ValueError):
            api.calibrate([[float('nan'), 0]], [0], split='validation', model_identity='a'*64, data_identity='b'*64, max_fpr=0.0)
        class Tiny(torch.nn.Module):
            def forward(self, input_ids, attention_mask):
                x = (input_ids.float() * attention_mask).sum(1)
                return torch.stack((x, -x), 1)
        examples = [{'input_ids': torch.ones((b,s), dtype=torch.long),
                     'attention_mask': torch.ones((b,s), dtype=torch.long)} for b,s in [(1,2),(2,4),(1,7)]]
        with tempfile.TemporaryDirectory() as tmp:
            report = api.export_onnx(Tiny(), examples, c, Path(tmp)/'export', unit_only=True)
            self.assertEqual(len(report['parity']), 3)
            self.assertLess(report['max_absolute_error'], 1e-4)
            self.assertFalse(report['release_ready'])
            self.assertTrue((Path(tmp)/'export/model.onnx').is_file())


if __name__ == '__main__':
    unittest.main()
