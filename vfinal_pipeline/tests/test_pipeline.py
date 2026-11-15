"""Synthetic mechanics only. No corpus/model/benchmark is executed here."""
import hashlib
import importlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def module(test, name):
    test.assertIsNotNone(importlib.util.find_spec('vfinal_pipeline.' + name),
                         'missing execution component: ' + name)
    return importlib.import_module('vfinal_pipeline.' + name)


def row(identifier, text, label='SAFE'):
    return {'id': identifier, 'text': text, 'label': label, 'target': 'risk',
            'gold_positive': label != 'SAFE', 'language': 'en', 'source': 'UNIT-ONLY',
            'source_id': identifier, 'license': 'UNIT-ONLY', 'license_status': 'verified',
            'source_version': 'fixture-1', 'source_family': identifier,
            'family_metadata_trusted': True, 'group_id': identifier,
            'provenance': {'status': 'synthetic-unit-only'},
            'slices': ['benign_hard_negative']}


def inputs(root, rows=None, holdout=None):
    rows = rows or [row('d' + str(i), chr(65 + i) * 15) for i in range(12)]
    holdout = holdout or [row('h', 'FROZEN-CANARY-ZZZ')]
    sources = []
    for name, records, role in [('dev', rows, 'development'), ('held', holdout, 'frozen_holdout')]:
        raw = b''.join(json.dumps(r).encode() + b'\n' for r in records)
        (root / (name + '.jsonl')).write_bytes(raw)
        sources.append({'path': name + '.jsonl', 'sha256': hashlib.sha256(raw).hexdigest(),
                        'bytes': len(raw), 'role': role, 'license': 'UNIT-ONLY',
                        'accepted': True})
    value = {'schema': 'vfinal-input/v1', 'accepted': True, 'sources': sources,
             'labels': ['SAFE', 'PII'], 'seed': 42, 'validation_fraction': 0.25,
             'near_jaccard': 0.8, 'max_candidate_pairs': 10000,
             'exposure_audit_complete': False}
    (root / 'input.json').write_text(json.dumps(value), encoding='utf-8')
    return root / 'input.json'


class DataWorkflow(unittest.TestCase):
    def test_build_pinned_reproducible_data_without_holdout_exposure(self):
        api = module(self, 'data_build')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = inputs(root)
            a = api.build(source, root / 'a')
            b = api.build(source, root / 'b')
            self.assertEqual(a, b)
            self.assertEqual(a['counts'], {'train': 9, 'validation': 3, 'holdout': 1})
            self.assertFalse(a['release_ready'])
            train = api.load_split(root / 'a', a['identity'], 'train')
            self.assertNotIn('h', [r['id'] for r in train])
            self.assertTrue((root / 'a/DATA_CARD.md').is_file())
            (root / 'dev.jsonl').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'pin'):
                api.build(source, root / 'c')


if __name__ == '__main__':
    unittest.main()
