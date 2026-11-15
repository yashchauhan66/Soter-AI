import copy
import unittest
from test_pipeline import module, row
from eval_harness.core import Case, cases_fingerprint


class ReleaseGate(unittest.TestCase):
    def test_identical_context_incomplete_evidence_fails_closed(self):
        api = module(self, 'release_gate')
        rows = [row('r'+str(i), 'fixture '+str(i), 'SAFE' if i<2 else 'PII') for i in range(4)]
        cases = [Case.from_dict(r) for r in rows]
        context = {'dataset_sha256': cases_fingerprint(cases), 'hardware_id': 'UNIT-ONLY',
                   'preprocessing': 'exact', 'batch_size': 1, 'runtime': 'unit',
                   'sequence_policy': 'first512', 'serving_path': 'UNIT-ONLY'}
        arms = [{'name': n, 'model_identity': n, 'context': context, 'threshold': 0.5,
                 'scores': [0.1,0.2,0.8,0.9], 'case_ids': [c.id for c in cases],
                 'latencies_ms': [1.0,2.0], 'evidence_class': 'UNIT-ONLY'}
                for n in ['v14','v17-multilingual','other-a','other-b','v-final']]
        contract = api.default_contract()
        result = api.evaluate(rows, arms, contract)
        self.assertFalse(result['release_ready'])
        self.assertFalse(result['criteria_pass'])
        self.assertIn('insufficient_support', str(result['failures']))
        self.assertIn('UNIT-ONLY', str(result['failures']))
        self.assertEqual(len(result['master_table']), 5)
        changed = copy.deepcopy(arms)
        # Detach the candidate; deepcopy intentionally retains shared aliases.
        changed[-1]['context'] = {**context, 'hardware_id': 'different'}
        with self.assertRaisesRegex(ValueError, 'identical context'):
            api.evaluate(rows, changed, contract)
        with self.assertRaises(ValueError):
            api.evaluate(rows, arms[:-1], contract)
        interval = api.paired_interval([True, False, True, False], [0.9,0.1,0.9,0.1], [0.1,0.9,0.1,0.9],
                                       0.5, 0.5, 'recall', ['a','b','c','d'], 200, 42)
        self.assertEqual(interval['point_delta'], 1.0)
        self.assertGreater(interval['lower95'], 0)


if __name__ == '__main__':
    unittest.main()
