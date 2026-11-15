from pathlib import Path
import tempfile
import unittest
from test_pipeline import module


class Packaging(unittest.TestCase):
    def test_quarantine_package_full_membership_and_tamper_rejection(self):
        api = module(self, 'packaging')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root/'source'
            source.mkdir()
            (source/'model.onnx').write_bytes(b'UNIT-ONLY bytes, NOT an ONNX graph')
            (source/'weights.data').write_bytes(b'external-fixture')
            (source/'MODEL_CARD.md').write_text('UNIT-ONLY. NOT RUN. Do not deploy.')
            report = api.package(source, root/'bundle', {'release_ready': False, 'criteria_pass': False})
            self.assertFalse(report['release_ready'])
            self.assertEqual(len(report['files']), 4)
            self.assertEqual(api.verify(root/'bundle'), report)
            (root/'bundle/weights.data').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'pin'):
                api.verify(root/'bundle')
            with self.assertRaisesRegex(ValueError, 'deployment'):
                api.package(source, root/'forbidden', {'release_ready': True})


if __name__ == '__main__':
    unittest.main()
