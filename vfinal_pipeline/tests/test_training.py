"""Genuine tiny randomly initialized optimization; UNIT-ONLY, not Soter."""
from pathlib import Path
import tempfile
import unittest
from test_pipeline import module


class Training(unittest.TestCase):
    def test_distillation_resume_matches_uninterrupted_weights(self):
        api = module(self, 'training')
        import torch
        torch.set_num_threads(1)
        class Tiny(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.embedding = torch.nn.Embedding(16, 4)
                self.head = torch.nn.Linear(4, 2)
            def forward(self, input_ids, attention_mask):
                x = self.embedding(input_ids)
                x = (x * attention_mask.unsqueeze(-1)).sum(1) / attention_mask.sum(1, keepdim=True)
                return self.head(x)
        def new():
            torch.manual_seed(4)
            return Tiny()
        features = [{'input_ids': [1, i + 2], 'attention_mask': [1, 1]} for i in range(6)]
        labels = [0, 1, 0, 1, 0, 1]
        teacher = [[2.0, -1.0] if y == 0 else [-1.0, 2.0] for y in labels]
        config = {'epochs': 2, 'batch_size': 2, 'accumulation': 2, 'seed': 42,
                  'lr': 0.01, 'weight_decay': 0.0, 'alpha': 0.5, 'temperature': 2.0,
                  'class_balance': True, 'checkpoint_every': 1, 'pad_token_id': 0,
                  'model_identity': 'a' * 64, 'data_identity': 'b' * 64,
                  'mixed_precision': False, 'unit_only': True}
        with tempfile.TemporaryDirectory() as tmp:
            full, split = new(), new()
            a = api.train(full, features, labels, features, labels, teacher, config, Path(tmp) / 'full')
            partial = api.train(split, features, labels, features, labels, teacher, config, Path(tmp) / 'resume', stop_after_steps=1)
            self.assertFalse(partial['complete'])
            resumed = new()
            b = api.train(resumed, features, labels, features, labels, teacher, config, Path(tmp) / 'resume')
            self.assertTrue(b['complete'])
            self.assertEqual(a['steps'], b['steps'])
            self.assertEqual(a['history'], b['history'])
            for k, v in full.state_dict().items():
                torch.testing.assert_close(v, resumed.state_dict()[k], rtol=0, atol=0)
            self.assertTrue((Path(tmp) / 'resume/best.json').is_file())
            self.assertTrue((Path(tmp) / 'resume/last.json').is_file())
            self.assertFalse(b['release_ready'])
            with self.assertRaisesRegex(ValueError, 'identity'):
                api.train(new(), features, labels[::-1], features, labels, teacher, config, Path(tmp) / 'resume')


if __name__ == '__main__':
    unittest.main()
