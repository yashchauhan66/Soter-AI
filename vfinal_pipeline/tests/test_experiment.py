from pathlib import Path
import tempfile
import unittest
from test_pipeline import module, row, inputs


class Experiment(unittest.TestCase):
    def test_local_random_hf_train_calibrate_resume_and_mine(self):
        api = module(self, 'experiment')
        import torch
        from transformers import BertConfig, BertForSequenceClassification, BertTokenizerFast
        from vfinal_pipeline.data_build import build
        torch.set_num_threads(1)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = root/'base'
            base.mkdir()
            (base/'vocab.txt').write_text('[PAD]\n[UNK]\n[CLS]\n[SEP]\n[MASK]\na\nb\nc\nd\n', encoding='utf-8')
            BertTokenizerFast(vocab_file=str(base/'vocab.txt')).save_pretrained(base)
            torch.manual_seed(7)
            BertForSequenceClassification(BertConfig(vocab_size=9, hidden_size=8, num_hidden_layers=1,
                num_attention_heads=2, intermediate_size=16, num_labels=2)).save_pretrained(base)
            rows = [row('d'+str(i), chr(65+i)*15, 'SAFE' if i%2 else 'PII') for i in range(24)]
            data = build(inputs(root, rows=rows), root/'data')
            config = {'data_dir': str(root/'data'), 'data_identity': data['identity'],
                      'base_dir': str(base), 'base_identity': api.bundle_identity(base),
                      'max_length': 16, 'max_fpr': 0.5, 'gradient_checkpointing': False,
                      'teacher_dir': None, 'teacher_identity': None,
                      'training': {'epochs': 1, 'batch_size': 4, 'accumulation': 2, 'seed': 42,
                       'lr': 0.001, 'weight_decay': 0.0, 'alpha': 0.0, 'temperature': 2.0,
                       'class_balance': True, 'checkpoint_every': 1, 'mixed_precision': False, 'unit_only': True}}
            result = api.run(config, root/'run')
            self.assertTrue(result['complete'])
            self.assertEqual(api.run(config, root/'run'), result)
            self.assertTrue((root/'run/calibration.json').is_file())
            self.assertTrue((root/'run/best-model/config.json').is_file())
            mined = api.mine(config, root/'run/best-model', split='train')
            self.assertEqual(mined['split'], 'train')
            with self.assertRaisesRegex(ValueError, 'train'):
                api.mine(config, root/'run/best-model', split='holdout')
            self.assertFalse(result['release_ready'])
            selected = api.select_teacher(config, [{'path': str(root/'run/best-model'), 'identity': result['model_identity']}])
            self.assertEqual(selected['selection_split'], 'validation')
            distilled = {**config, 'teacher_dir': str(root/'run/best-model'), 'teacher_identity': result['model_identity'],
                         'training': {**config['training'], 'alpha': 0.5}}
            self.assertTrue(api.run(distilled, root/'distilled')['complete'])


if __name__ == '__main__':
    unittest.main()
