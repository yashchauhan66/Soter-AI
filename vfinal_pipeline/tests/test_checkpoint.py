"""Checkpoint envelopes on tiny bytes, not PyTorch weights."""
from pathlib import Path
import tempfile
import unittest
from test_pipeline import module


class CheckpointWorkflow(unittest.TestCase):
    def test_verified_best_last_periodic_resume_and_identity_guard(self):
        api = module(self, 'checkpoint')
        config = {'data_identity': 'a' * 64, 'seed': 42, 'learning_rate': 0.001}
        with tempfile.TemporaryDirectory() as tmp:
            store = api.Checkpoints(Path(tmp), config)
            store.save(1, b'UNIT-only-rng-and-state-1', best=True)
            store.save(2, b'UNIT-only-rng-and-state-2', best=False)
            self.assertEqual(store.load('last'), (2, b'UNIT-only-rng-and-state-2'))
            self.assertEqual(store.load('best'), (1, b'UNIT-only-rng-and-state-1'))
            self.assertEqual(len(list(Path(tmp).glob('step-*'))), 2)
            with self.assertRaisesRegex(ValueError, 'identity'):
                api.Checkpoints(Path(tmp), dict(config, seed=43))
            (Path(tmp) / 'step-000000002/state.bin').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'pin'):
                store.load('last')


if __name__ == '__main__':
    unittest.main()
