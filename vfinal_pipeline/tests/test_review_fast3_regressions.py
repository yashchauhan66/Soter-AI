"""Authorized review regressions: synthetic offline controls, never release evidence."""
import json
from pathlib import Path
import tempfile
import unittest

from test_pipeline import inputs, row
from vfinal_pipeline.common import canonical, digest
from vfinal_pipeline.data_build import build, load_split


def fixture(root, development=None, exposure=None, source_metadata=None):
    path = inputs(root, rows=development)
    spec = json.loads(path.read_bytes())
    if exposure is not None:
        raw = b''.join(canonical(r) + b'\n' for r in exposure)
        (root/'exposure.jsonl').write_bytes(raw)
        spec['sources'].append({'path': 'exposure.jsonl', 'sha256': digest(raw),
                                'bytes': len(raw), 'role': 'exposure', 'accepted': True,
                                'license': 'UNIT-ONLY', **(source_metadata or {})})
    path.write_bytes(canonical(spec))
    return path


class AuditQuarantine(unittest.TestCase):
    def test_policy_exposure_still_rejects_holdout_overlap(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exposed = {**row('x', 'FROZEN-CANARY-ZZZ'), 'target': 'policy'}
            path = fixture(root, exposure=[exposed])
            with self.assertRaisesRegex(ValueError, 'exposure'):
                build(path, root/'data')
            self.assertFalse((root/'data').exists())

    def test_quarantined_bridge_keeps_descendant_out_of_learning(self):
        for change in ({'label': None}, {'target': 'policy'}):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                dev = [row('d'+str(i), chr(65+i)*15) for i in range(12)]
                dev += [{**row('bridge', 'unlabeled bridge text'), 'parent_id': 'h', **change},
                        {**row('leaked', 'this descendant has different text'), 'parent_id': 'bridge'}]
                result = build(fixture(root, development=dev), root/'data')
                for split in ('train', 'validation', 'holdout'):
                    ids = [r['id'] for r in load_split(root/'data', result['identity'], split)]
                    self.assertNotIn('bridge', ids)
                    self.assertNotIn('leaked', ids)
                self.assertIn({'id': 'leaked', 'reason': 'holdout_connected'},
                              [{k: q[k] for k in ('id', 'reason')} for q in result['quarantine']])

    def test_missing_label_cannot_hide_invalid_audit_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dev = [row('d'+str(i), chr(65+i)*15) for i in range(12)]
            dev.append({**row('bridge', 'audit-only malformed parent'), 'label': None, 'parent_id': 17})
            with self.assertRaises(ValueError):
                build(fixture(root, development=dev), root/'data')


class TeacherExposure(unittest.TestCase):
    def test_fitted_exposure_cannot_enter_selection_validation(self):
        for partition in ('training', 'teacher_training'):
            with self.subTest(partition=partition), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                exposure = [{**row('x'+str(i), chr(65+i)*15),
                             'provenance': {'status': 'UNIT-ONLY', 'partition': partition,
                                            'candidate_identity': 'a'*64}} for i in range(12)]
                with self.assertRaisesRegex(ValueError, 'teacher.training'):
                    build(fixture(root, exposure=exposure), root/'data')

    def test_selection_exposure_is_not_fitted_training(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exposure = [row('x'+str(i), chr(65+i)*15) for i in range(12)]
            result = build(fixture(root, exposure=exposure, source_metadata={
                'candidate_identity': 'a'*64, 'partition': 'validation'}), root/'data')
            self.assertEqual(result['counts']['validation'], 3)

    def test_selection_requires_candidate_bound_partition_provenance(self):
        from unittest.mock import patch
        from vfinal_pipeline import experiment as api
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = build(fixture(root, exposure=[row('x', 'separate prior selection')],
                                   source_metadata={'candidate_identity': 'a'*64,
                                                    'partition': 'validation'}), root/'data')
            teacher = root/'teacher'
            teacher.mkdir()
            (teacher/'unit.txt').write_bytes(b'UNIT-ONLY no model')
            candidate = {'path': str(teacher), 'identity': api.bundle_identity(teacher)}
            config = {'data_dir': str(root/'data'), 'data_identity': result['identity'],
                      'max_length': 16, 'training': {'unit_only': True, 'batch_size': 4}}
            with patch.object(api, 'local_model', side_effect=AssertionError('must reject before loading')):
                with self.assertRaisesRegex(ValueError, 'candidate.*provenance'):
                    api.select_teacher(config, [candidate])


class TeacherSnapshot(unittest.TestCase):
    def test_selection_consumes_pinned_snapshot_during_source_swap(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from vfinal_pipeline import experiment as api
        for restore in (False, True):
            with self.subTest(restore=restore), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                data = build(fixture(root), root/'data')
                teacher = root/'teacher'
                teacher.mkdir()
                source = teacher/'unit.txt'
                original = b'PINNED UNIT-ONLY NOT A MODEL'
                source.write_bytes(original)
                expected = api.bundle_identity(teacher)
                observed = []

                class Tokenizer:
                    pad_token_id = 0

                    def __call__(self, texts, **kwargs):
                        return {'input_ids': [[1] for _ in texts]}

                def loader(path):
                    source.write_bytes(b'REPLACED UNIT-ONLY NOT A MODEL')
                    observed.append((Path(path)/'unit.txt').read_bytes())
                    return SimpleNamespace(config=SimpleNamespace(
                        id2label={0: 'SAFE', 1: 'PII'}, num_labels=2)), Tokenizer()

                def prediction(model, features, *args):
                    if restore:
                        source.write_bytes(original)
                    return [[0., 0.] for _ in features]  # Explicit injected scores, no inference.

                config = {'data_dir': str(root/'data'), 'data_identity': data['identity'],
                          'max_length': 16, 'training': {'unit_only': True, 'batch_size': 4}}
                with patch.object(api, 'local_model', loader), patch.object(api, 'predict', prediction):
                    selected = api.select_teacher(config, [{'path': str(teacher), 'identity': expected}])
                self.assertEqual(observed, [original])
                self.assertEqual(selected['selected']['identity'], expected)

    def test_distillation_consumes_snapshot_at_real_random_hf_load(self):
        import torch
        from transformers import BertConfig, BertForSequenceClassification, BertTokenizerFast
        from unittest.mock import patch
        from vfinal_pipeline import experiment as api
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            base = root/'base'
            base.mkdir()
            (base/'vocab.txt').write_text('[PAD]\n[UNK]\n[CLS]\n[SEP]\n[MASK]\na\nb\n', encoding='utf-8')
            BertTokenizerFast(vocab_file=str(base/'vocab.txt')).save_pretrained(base)
            torch.manual_seed(7)
            tiny = BertForSequenceClassification(BertConfig(vocab_size=7, hidden_size=8,
                num_hidden_layers=1, num_attention_heads=2, intermediate_size=16,
                id2label={0: 'SAFE', 1: 'PII'}, label2id={'SAFE': 0, 'PII': 1}))
            tiny.save_pretrained(base)
            teacher = root/'teacher'
            tiny.save_pretrained(teacher)
            BertTokenizerFast(vocab_file=str(base/'vocab.txt')).save_pretrained(teacher)
            expected = api.bundle_identity(teacher)
            dev = [row('d'+str(i), chr(65+i)*15, 'SAFE' if i % 2 else 'PII') for i in range(24)]
            data = build(fixture(root, development=dev), root/'data')
            config = {'data_dir': str(root/'data'), 'data_identity': data['identity'],
                      'base_dir': str(base), 'base_identity': api.bundle_identity(base),
                      'teacher_dir': str(teacher), 'teacher_identity': expected,
                      'max_length': 16, 'max_fpr': .5, 'gradient_checkpointing': False,
                      'training': {'unit_only': True, 'epochs': 1, 'batch_size': 4, 'accumulation': 2,
                                   'seed': 42, 'lr': .001, 'weight_decay': 0., 'alpha': .5,
                                   'temperature': 2., 'class_balance': True, 'checkpoint_every': 1,
                                   'mixed_precision': False}}
            real_loader, consumed = api.local_model, []

            def loader(path, labels=None):
                if labels is None:
                    # Alter the source at the actual loader boundary, not its private copy.
                    with torch.no_grad():
                        tiny.classifier.bias[0].add_(1.0)
                    tiny.save_pretrained(teacher)
                    consumed.append(api.bundle_identity(path))
                return real_loader(path, labels)

            with patch.object(api, 'local_model', loader):
                result = api.run(config, root/'run')
            self.assertTrue(result['complete'])
            self.assertEqual(consumed, [expected])
            self.assertFalse(result['release_ready'])


class WeightedAccumulation(unittest.TestCase):
    def test_effective_batch_gradient_matches_weighted_ce_and_separate_kl(self):
        import copy
        import random
        import torch
        import torch.nn.functional as functional
        from unittest.mock import patch
        from vfinal_pipeline import training as api

        class Tiny(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.head = torch.nn.Linear(1, 2)

            def forward(self, input_ids, attention_mask):
                return self.head((input_ids.float()*attention_mask).mean(1, keepdim=True)/10.)

        features = [{'input_ids': [i+1], 'attention_mask': [1]} for i in range(5)]
        labels = [0, 0, 0, 1, 0]
        teacher = [[.5, -.5], [.2, .1], [-.2, .7], [.1, .9], [1., -.1]]
        for size, accumulation in ((1, 4), (2, 2), (3, 2)):
            for alpha in (0., .5):
                with self.subTest(batch_size=size, accumulation=accumulation, alpha=alpha):
                    torch.manual_seed(13)
                    model = Tiny()
                    reference = copy.deepcopy(model)
                    captured = []
                    real_optimizer = torch.optim.AdamW

                    class RecordingAdamW(real_optimizer):
                        def step(self, *args, **kwargs):
                            captured.append([p.grad.detach().clone() for p in model.parameters()])
                            return super().step(*args, **kwargs)

                    config = {'epochs': 1, 'batch_size': size, 'accumulation': accumulation,
                              'seed': 42, 'lr': .01, 'weight_decay': 0., 'alpha': alpha,
                              'temperature': 2., 'class_balance': True, 'checkpoint_every': 1,
                              'pad_token_id': 0, 'model_identity': 'a'*64, 'data_identity': 'b'*64,
                              'mixed_precision': False, 'unit_only': True}
                    with tempfile.TemporaryDirectory() as tmp, patch.object(torch.optim, 'AdamW', RecordingAdamW):
                        result = api.train(model, features, labels, features, labels, teacher,
                                           config, Path(tmp)/'checkpoints')
                    chunks = [list(range(i, min(i+size, 5))) for i in range(0, 5, size)]
                    random.Random(42).shuffle(chunks)
                    optimizer = real_optimizer(reference.parameters(), lr=.01, weight_decay=0.)
                    count = torch.bincount(torch.tensor(labels)).float()
                    weights = count.sum()/(len(count)*count)
                    expected = []
                    for start in range(0, len(chunks), accumulation):
                        ix = [i for part in chunks[start:start+accumulation] for i in part]
                        optimizer.zero_grad()
                        values = reference(**api.batch(features, ix, 'cpu'))
                        ce = functional.cross_entropy(values, torch.tensor([labels[i] for i in ix]), weight=weights)
                        kl = functional.kl_div(functional.log_softmax(values/2., dim=-1),
                                               functional.softmax(torch.tensor(teacher)[ix]/2., dim=-1),
                                               reduction='batchmean')*4.
                        ((1-alpha)*ce+alpha*kl).backward()
                        torch.nn.utils.clip_grad_norm_(reference.parameters(), 1., error_if_nonfinite=True)
                        expected.append([p.grad.detach().clone() for p in reference.parameters()])
                        optimizer.step()
                    self.assertEqual(result['steps'], len(expected))
                    self.assertEqual(len(captured), len(expected))
                    for actual_step, expected_step in zip(captured, expected):
                        for actual, wanted in zip(actual_step, expected_step):
                            torch.testing.assert_close(actual, wanted, rtol=1e-5, atol=1e-7)
                    for actual, wanted in zip(model.parameters(), reference.parameters()):
                        torch.testing.assert_close(actual, wanted, rtol=1e-5, atol=1e-7)


def native_fixture(root, labels):
    path = fixture(root)
    spec = json.loads(path.read_bytes())
    spec['labels'] = labels
    spec['unit_only'] = False  # Admission-only synthetic input, never trained.
    path.write_bytes(canonical(spec))
    return path


class NativeAdmission(unittest.TestCase):
    def test_genuine_builder_requires_exact_native_label_order(self):
        native = json.loads((Path(__file__).resolve().parents[2]/'models/ml-classifier-v14/labels.json').read_bytes())
        labels = [native[str(i)] for i in range(len(native))]
        reordered = labels[:]
        reordered[1], reordered[4] = reordered[4], reordered[1]
        for invalid in (['SAFE', 'PII'], reordered):
            with self.subTest(labels=invalid), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                with self.assertRaisesRegex(ValueError, 'native.*label'):
                    build(native_fixture(root, invalid), root/'data')

    def test_genuine_run_rejects_unit_data_before_loading(self):
        from unittest.mock import patch
        from vfinal_pipeline import experiment as api
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = build(fixture(root), root/'data')
            base = root/'base'
            base.mkdir()
            (base/'config.json').write_bytes(b'{}')
            config = {'data_dir': str(root/'data'), 'data_identity': data['identity'],
                      'base_dir': str(base), 'base_identity': api.bundle_identity(base),
                      'max_length': 16, 'training': {'unit_only': False, 'seed': 42}}
            with patch.object(api, 'resources'), patch.object(api, 'local_model', side_effect=AssertionError('loader reached')):
                with self.assertRaisesRegex(ValueError, 'native.*label|UNIT-only'):
                    api.run(config, root/'run')

    def test_genuine_head_metadata_is_not_silently_relabelled(self):
        from unittest.mock import patch
        from vfinal_pipeline import experiment as api
        native = json.loads((Path(__file__).resolve().parents[2]/'models/ml-classifier-v14/labels.json').read_bytes())
        labels = [native[str(i)] for i in range(len(native))]
        for wrong in ('order', 'inverse', 'count', 'valid'):
            with self.subTest(metadata=wrong), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                data = build(native_fixture(root, labels), root/'data')
                base = root/'base'
                base.mkdir()
                head = {'architectures': ['BertForSequenceClassification'], 'id2label': dict(native),
                        'label2id': {label: i for i, label in enumerate(labels)}, 'num_labels': 14}
                if wrong == 'order':
                    head['id2label']['1'], head['id2label']['4'] = head['id2label']['4'], head['id2label']['1']
                elif wrong == 'inverse':
                    head['label2id']['PII'] = 1
                elif wrong == 'count':
                    head['num_labels'] = 2
                (base/'config.json').write_bytes(canonical(head))
                config = {'data_dir': str(root/'data'), 'data_identity': data['identity'],
                          'base_dir': str(base), 'base_identity': api.bundle_identity(base),
                          'max_length': 16, 'training': {'unit_only': False, 'seed': 42}}
                with patch.object(api, 'resources'), patch.object(api, 'local_model', side_effect=AssertionError('admitted-no-model')):
                    if wrong == 'valid':
                        with self.assertRaisesRegex(AssertionError, 'admitted-no-model'):
                            api.run(config, root/'run')
                    else:
                        with self.assertRaisesRegex(ValueError, 'head.*label'):
                            api.run(config, root/'run')


def gate_fixture(extra_language=False):
    """Synthetic caller declarations to reach numerical gates, NOT serving evidence."""
    from eval_harness.core import Case, REQUIRED_SLICES, cases_fingerprint
    from vfinal_pipeline.release_gate import default_contract
    rows = [row('gate'+str(i), 'UNIT-ONLY gate '+str(i), 'SAFE' if i < 200 else 'PII')
            for i in range(400)]
    if extra_language:
        rows.extend([{**row('hi-safe', 'UNIT-ONLY hindi benign'), 'language': 'hi'},
                     {**row('hi-risk', 'UNIT-ONLY hindi risk', 'PII'), 'language': 'hi'}])
    for record in rows:
        record['slices'] = list(REQUIRED_SLICES)
    contract = default_contract()
    contract.update(languages=['en'], bootstrap_samples=100)
    context = {'dataset_sha256': cases_fingerprint([Case.from_dict(r) for r in rows]),
               'hardware_id': 'UNIT-ONLY', 'preprocessing': 'exact', 'batch_size': 1,
               'runtime': 'unit', 'sequence_policy': 'unit', 'serving_path': 'cpu_service_local'}
    evidence: dict = {key: True for key in ('untouched_holdout', 'complete_exposure_audit',
                'semantic_duplicate_review', 'privacy_review', 'production_policy_regressions_fixed')}
    evidence['seed_runs'] = [{'seed': seed, 'genuine': True} for seed in (1, 2, 3)]
    for key in ('ablations', 'paths', 'latency_contexts'):
        evidence[key] = {name: {'passed': True} for name in contract['required_'+key]}
    evidence['end_to_end_p95_ms'] = 1.0
    arms = [{'name': name, 'model_identity': 'UNIT-ONLY-'+name, 'context': dict(context),
             'threshold': .5, 'case_ids': [r['id'] for r in rows],
             'scores': [.01 if r['label'] == 'SAFE' else .99 for r in rows],
             'latencies_ms': [1.0]*1000, 'evidence_class': 'genuine_real_serving',
             'memory_bytes': 1, 'size_bytes': 1, 'cold_load_ms': 1.0, 'evidence': evidence}
            for name in contract['required_models']]
    return rows, arms, contract


class LanguageCoverage(unittest.TestCase):
    def test_undeclared_language_blocks_criteria_without_rewriting_contract(self):
        from vfinal_pipeline.release_gate import evaluate
        rows, arms, contract = gate_fixture(extra_language=True)
        before = canonical(contract)
        result = evaluate(rows, arms, contract)
        self.assertFalse(result['criteria_pass'])
        self.assertFalse(result['release_ready'])
        self.assertEqual(canonical(contract), before)
        self.assertTrue(any('coverage' in failure or 'language' in failure for failure in result['failures']))
        for entry in result['master_table']:
            self.assertFalse(entry['metrics']['coverage_complete'])
            self.assertEqual(entry['metrics']['undeclared_language_ids'], ['hi-safe', 'hi-risk'])

    def test_declared_support_controls_and_complete_unit_fixture(self):
        from vfinal_pipeline.release_gate import evaluate
        rows, arms, contract = gate_fixture()
        complete = evaluate(rows, arms, contract)
        self.assertTrue(complete['criteria_pass'], complete['failures'])
        self.assertFalse(complete['release_ready'])
        for observed in (False, True):
            with self.subTest(under_supported_language_observed=observed):
                rows, arms, contract = gate_fixture(extra_language=observed)
                contract['languages'] = ['en', 'hi']
                before = canonical(contract)
                result = evaluate(rows, arms, contract)
                self.assertFalse(result['criteria_pass'])
                self.assertIn('language:hi: insufficient_support', result['failures'])
                self.assertEqual(canonical(contract), before)


class IndependentFprBaseline(unittest.TestCase):
    def test_requested_fpr_baseline_is_compared_outside_recall_list(self):
        from vfinal_pipeline.release_gate import evaluate
        for recall in (['v17-multilingual'], []):
            with self.subTest(recall_baselines=recall):
                rows, arms, contract = gate_fixture()
                contract['recall_baselines'] = recall
                before = canonical(contract)
                result = evaluate(rows, arms, contract)
                self.assertTrue(result['criteria_pass'], result['failures'])
                for comparison in result['comparisons'].values():
                    self.assertEqual(set(comparison['paired']),
                                     {'v14:fpr'} | {name+':recall' for name in recall})
                    self.assertEqual(comparison['paired']['v14:fpr']['point_delta'], 0.0)
                self.assertEqual(canonical(contract), before)
                self.assertFalse(result['release_ready'])

    def test_separate_fpr_baseline_regression_blocks_criteria(self):
        from vfinal_pipeline.release_gate import evaluate
        rows, arms, contract = gate_fixture()
        contract['recall_baselines'] = ['v17-multilingual']
        candidate = next(arm for arm in arms if arm['name'] == contract['candidate'])
        candidate['scores'][0] = .9  # One synthetic false positive; global FPR still below its limit.
        result = evaluate(rows, arms, contract)
        self.assertFalse(result['criteria_pass'])
        self.assertIn('overall: v14 fpr regression', result['failures'])
        self.assertGreater(result['comparisons']['overall']['paired']['v14:fpr']['point_delta'], 0)
        self.assertNotIn('overall: benign FPR gate failed', result['failures'])
        self.assertFalse(result['release_ready'])

