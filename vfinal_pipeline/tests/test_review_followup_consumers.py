"""UNIT-only native consumer regressions; no pretrained models or downloads."""

import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from vfinal_pipeline import __main__ as cli
from vfinal_pipeline import calibration_export, experiment, packaging, training
from vfinal_pipeline.common import canonical, digest, identity


def fixture_root():
    parent = os.environ.get('VFINAL_FOLLOWUP_FIXTURES')
    return Path(tempfile.mkdtemp(prefix='consumer-', dir=parent))


def junction(link, target):
    result = subprocess.run(
        [os.environ.get('COMSPEC', 'C:/Windows/System32/cmd.exe'),
         '/d', '/c', 'mklink', '/J', str(link), str(target)],
        capture_output=True, check=True, timeout=30,
    )
    (fixture_root()/'junction-creation.txt').write_bytes(result.stdout+result.stderr)
    if not link.is_junction() or link.is_symlink():
        raise AssertionError('real native non-symlink junction required')


class PackageConsumers(unittest.TestCase):
    def test_source_junction_rejected_before_copy(self):
        root = fixture_root()
        source = root/'source'
        source.mkdir()
        (source/'MODEL_CARD.md').write_bytes(b'UNIT ONLY; not deployable')
        outside = root/'outside-source'
        outside.mkdir()
        sentinel = outside/'sentinel.txt'
        sentinel.write_bytes(b'SYNTHETIC OUTSIDE-SOURCE SENTINEL; no personal data')
        junction(source/'escape', outside)
        with self.assertRaisesRegex(ValueError, 'reparse|junction|link'):
            packaging.package(source, root/'bundle', {'release_ready': False})
        self.assertFalse((root/'bundle').exists())
        self.assertEqual(sentinel.read_bytes(), b'SYNTHETIC OUTSIDE-SOURCE SENTINEL; no personal data')

    def test_root_and_ancestor_junctions_rejected(self):
        root = fixture_root()
        source = root/'source'
        source.mkdir()
        (source/'MODEL_CARD.md').write_bytes(b'UNIT ONLY')
        outside = root/'outside'
        outside.mkdir()
        junction(root/'alias', source)
        junction(root/'redirect', outside)
        for name, src, dest in [
            ('source-root', root/'alias', root/'bundle-a'),
            ('destination-ancestor', source, root/'redirect'/'bundle-b'),
        ]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'reparse|junction|link'):
                packaging.package(src, dest, {'release_ready': False})
        self.assertEqual(list(outside.iterdir()), [])

    def test_verify_junction_rejected_before_read(self):
        root = fixture_root()
        source = root/'source'
        source.mkdir()
        (source/'MODEL_CARD.md').write_bytes(b'UNIT ONLY')
        (source/'payload').mkdir()
        (source/'payload/data').write_bytes(b'fixture payload')
        good = root/'good'
        report = packaging.package(source, good, {'release_ready': False})
        self.assertEqual(packaging.verify(good), report)
        bad = root/'bad'
        bad.mkdir()
        for path in good.iterdir():
            if path.is_file():
                shutil.copyfile(path, bad/path.name)
        junction(bad/'payload', good/'payload')
        with self.assertRaisesRegex(ValueError, 'reparse|junction|link'):
            packaging.verify(bad)
        junction(root/'bundle-alias', good)
        with self.assertRaisesRegex(ValueError, 'reparse|junction|link'):
            packaging.verify(root/'bundle-alias')

    def test_plain_package_membership_and_tamper_controls(self):
        root = fixture_root()
        source = root/'source'
        source.mkdir()
        (source/'MODEL_CARD.md').write_bytes(b'UNIT ONLY')
        (source/'weights.data').write_bytes(b'NOT MODEL WEIGHTS')
        good = root/'good'
        report = packaging.package(source, good, {'release_ready': False})
        self.assertEqual(packaging.verify(good), report)
        for mutation in ('tamper', 'extra', 'missing'):
            dest = root/mutation
            dest.mkdir()
            for path in good.iterdir():
                if mutation != 'missing' or path.name != 'weights.data':
                    shutil.copyfile(path, dest/path.name)
            if mutation == 'tamper':
                (dest/'weights.data').write_bytes(b'TAMPER')
            elif mutation == 'extra':
                (dest/'extra').write_bytes(b'EXTRA')
            with self.subTest(mutation=mutation), self.assertRaisesRegex(ValueError, 'pin|membership'):
                packaging.verify(dest)


class ConsumerReached(RuntimeError):
    """Explicit no-model stop, never a claim of successful export."""


class StoppedExamples:
    def __len__(self):
        raise ConsumerReached('NO-MODEL examples consumption sentinel')


class ExportAdmission(unittest.TestCase):
    def make_spec(self, root, value):
        model = root/'not-a-model'
        model.mkdir(exist_ok=True)
        (model/'config.json').write_bytes(b'{"fixture": "NO MODEL"}')
        calibration = {'split': 'validation', 'model_identity': experiment.bundle_identity(model),
                       'data_identity': 'b'*64, 'temperature': 1.0}
        calibration['identity'] = identity(calibration)
        (root/'calibration.json').write_bytes(canonical(calibration))
        spec = {'model_dir': str(model), 'calibration': str(root/'calibration.json'),
                'unit_only': value, 'max_length': 16, 'quantize': False}
        path = root/'spec.json'
        path.write_bytes(canonical(spec))
        return path

    def test_cli_rejects_nonboolean_before_loader(self):
        root = fixture_root()
        for value in ('false', 1, 0, None, [], {}):
            spec = self.make_spec(root, value)
            with self.subTest(value=value), patch.object(
                experiment, 'local_model', side_effect=ConsumerReached('NO-MODEL loader sentinel'),
            ) as loader:
                with self.assertRaisesRegex(ValueError, 'boolean unit_only'):
                    cli.main(['export', str(spec), str(root/'output')])
                loader.assert_not_called()
            self.assertFalse((root/'output').exists())

    def test_direct_rejects_nonboolean_before_consumption(self):
        root = fixture_root()
        for value in ('false', 1, 0, None, [], {}):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'boolean unit_only'):
                calibration_export.export_onnx(None, StoppedExamples(), {}, root/'output', unit_only=value)
            self.assertFalse((root/'output').exists())

    def test_real_resource_admission_and_true_unit_control(self):
        root = fixture_root()
        measured = experiment.resources(root, True)
        (root/'real-resource-measurement.json').write_text(json.dumps(measured), encoding='utf-8')
        self.assertEqual(measured['ram_floor'], 5368709120)
        self.assertEqual(measured['disk_floor'], 933930572)
        below = measured['ram_available'] < measured['ram_floor'] or measured['disk_free'] < measured['disk_floor']
        for unit in (True, False):
            spec = self.make_spec(root, unit)
            expected = ValueError if not unit and below else ConsumerReached
            message = 'resource floor' if expected is ValueError else 'NO-MODEL'
            with self.subTest(unit_only=unit), patch.object(
                experiment, 'local_model', side_effect=ConsumerReached('NO-MODEL loader sentinel'),
            ) as loader:
                with self.assertRaisesRegex(expected, message):
                    cli.main(['export', str(spec), str(root/'output')])
                self.assertEqual(loader.call_count, int(expected is ConsumerReached))
            with self.subTest(direct_unit_only=unit), self.assertRaisesRegex(expected, message):
                calibration_export.export_onnx(None, StoppedExamples(), {}, root/'direct', unit_only=unit)
        self.assertFalse((root/'output').exists())
        self.assertFalse((root/'direct').exists())

    def test_false_enforces_unchanged_floor_with_low_ram_observation(self):
        root = fixture_root()
        spec = self.make_spec(root, False)
        # Deterministic low-RAM observation; resources() itself is real and unmodified.
        with patch('psutil.virtual_memory', return_value=SimpleNamespace(available=5368709119)):
            with patch.object(experiment, 'local_model', side_effect=ConsumerReached('NO-MODEL')) as loader:
                with self.assertRaisesRegex(ValueError, 'resource floor'):
                    cli.main(['export', str(spec), str(root/'output')])
                loader.assert_not_called()
            with self.assertRaisesRegex(ValueError, 'resource floor'):
                calibration_export.export_onnx(None, StoppedExamples(), {}, root/'direct', unit_only=False)


def legacy_training(followup=False):
    base = Path(__file__).resolve().parents[2]/'artifacts/ml/v-final/review-fixes-fast4/resume-1'
    path = base/('pipeline-followup-1/baseline' if followup else 'baseline')/'vfinal_pipeline/training.py'
    expected = ('66134c49b3be0d14220f11e7413b05629061ef6e79fcbbab1ab358b767130dea' if followup else
                '20af7804d72cce4b208e4523329ab001f27a7ebafc401281c8498bd86049d282')
    if digest(path.read_bytes()) != expected:
        raise AssertionError('immutable legacy trainer source pin mismatch')
    spec = importlib.util.spec_from_file_location('vfinal_pipeline._unit_legacy_trainer', path)
    if spec is None or spec.loader is None:
        raise AssertionError('legacy module loader unavailable')
    old = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(old)
    return old


def tree_pins(root):
    return {p.relative_to(root).as_posix(): digest(p.read_bytes()) for p in root.rglob('*') if p.is_file()}


def tiny_training():
    import torch

    class Tiny(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.head = torch.nn.Linear(2, 2)
            with torch.no_grad():
                self.head.weight.copy_(torch.tensor([[.2, -.1], [-.15, .25]]))
                self.head.bias.copy_(torch.tensor([.1, -.2]))

        def forward(self, input_ids, attention_mask):
            z = (input_ids.float()*attention_mask).sum(1)/attention_mask.sum(1)/10.
            return self.head(torch.stack([z, z*z], 1))

    features = [{'input_ids': [i+1]*(i % 3+1), 'attention_mask': [1]*(i % 3+1)} for i in range(9)]
    labels = [0, 0, 0, 0, 0, 0, 0, 1, 1]
    teacher = [[.2*i-.5, .7-.13*i] for i in range(9)]
    config = {'epochs': 1, 'batch_size': 1, 'accumulation': 4, 'seed': 73,
              'lr': .007, 'weight_decay': .01, 'alpha': .35, 'temperature': 1.7,
              'class_balance': True, 'checkpoint_every': 1, 'pad_token_id': 0,
              'model_identity': 'a'*64, 'data_identity': 'b'*64, 'mixed_precision': False, 'unit_only': True}
    return Tiny, features, labels, teacher, config


def tiny_experiment(root):
    import torch
    from test_pipeline import inputs, row
    from transformers import (
        BertConfig,
        BertForSequenceClassification,
        BertTokenizerFast,
    )

    from vfinal_pipeline.data_build import build

    base = root/'base'
    base.mkdir()
    (base/'vocab.txt').write_text('[PAD]\n[UNK]\n[CLS]\n[SEP]\n[MASK]\na\nb\n', encoding='utf-8')
    BertTokenizerFast(vocab_file=str(base/'vocab.txt')).save_pretrained(base)
    torch.manual_seed(7)
    BertForSequenceClassification(BertConfig(vocab_size=7, hidden_size=8, num_hidden_layers=1,
        num_attention_heads=2, intermediate_size=16, num_labels=2)).save_pretrained(base)
    rows = [row('d'+str(i), chr(65+i)*15, 'SAFE' if i % 2 else 'PII') for i in range(24)]
    data = build(inputs(root, rows=rows), root/'data')
    return {'data_dir': str(root/'data'), 'data_identity': data['identity'],
            'base_dir': str(base), 'base_identity': experiment.bundle_identity(base),
            'max_length': 16, 'max_fpr': .5, 'gradient_checkpointing': False,
            'teacher_dir': None, 'teacher_identity': None,
            'training': {'epochs': 1, 'batch_size': 4, 'accumulation': 2, 'seed': 42,
                         'lr': .001, 'weight_decay': 0., 'alpha': 0., 'temperature': 2.,
                         'class_balance': True, 'checkpoint_every': 1, 'mixed_precision': False, 'unit_only': True}}


class ObjectiveResume(unittest.TestCase):
    def test_legacy_trainers_rejected_before_state_consumption(self):
        import torch

        root = fixture_root()
        model_type, features, labels, teacher, config = tiny_training()
        for followup in (False, True):
            with self.subTest(fixed_but_unversioned=followup):
                old = legacy_training(followup)
                folder = root/str(followup)
                old.train(model_type(), features, labels, features, labels, teacher, config, folder, stop_after_steps=1)
                before = tree_pins(folder)
                model = model_type()
                weights = {k: v.clone() for k, v in model.state_dict().items()}
                with patch.object(torch, 'load', side_effect=ConsumerReached('legacy state consumed')) as load:
                    with self.assertRaisesRegex(ValueError, 'identity|objective|version'):
                        training.train(model, features, labels, features, labels, teacher, config, folder)
                    load.assert_not_called()
                self.assertEqual(tree_pins(folder), before)
                for key, value in weights.items():
                    torch.testing.assert_close(model.state_dict()[key], value, rtol=0, atol=0)

    def test_versioned_current_resume_matches_fresh_exactly(self):
        import torch

        root = fixture_root()
        model_type, features, labels, teacher, config = tiny_training()
        full = model_type()
        expected = training.train(full, features, labels, features, labels, teacher, config, root/'fresh')
        training.train(model_type(), features, labels, features, labels, teacher, config, root/'resume', stop_after_steps=1)
        resumed = model_type()
        actual = training.train(resumed, features, labels, features, labels, teacher, config, root/'resume')
        self.assertEqual(actual, expected)
        for a, b in zip(full.parameters(), resumed.parameters()):
            torch.testing.assert_close(a, b, rtol=0, atol=0)
        contract = json.loads((root/'resume/run.json').read_bytes())
        self.assertEqual(contract.get('trainer_version'), 'vfinal-trainer/v2')
        self.assertEqual(contract.get('objective_version'), 'effective-batch-weighted-ce+sample-mean-kl/v1')
        self.assertEqual((root/'resume/run.json').read_bytes(), (root/'fresh/run.json').read_bytes())

    def test_experiment_best_reload_rejects_legacy_before_consumption(self):
        import torch

        root = fixture_root()
        config = tiny_experiment(root)
        old = legacy_training()
        consumed = []
        before = {}

        def legacy_train(*args, **kwargs):
            result = old.train(*args, **kwargs)
            before.update(tree_pins(root/'run/checkpoints'))
            guard = patch.object(torch, 'load', side_effect=ConsumerReached('legacy best state consumed'))
            consumed.append(guard.start())
            self.addCleanup(guard.stop)
            return result

        with patch.object(experiment, 'train', legacy_train), self.assertRaisesRegex(
            ValueError, 'identity|objective|version',
        ):
            experiment.run(config, root/'run')
        self.assertEqual(len(consumed), 1)
        consumed[0].assert_not_called()
        self.assertEqual(tree_pins(root/'run/checkpoints'), before)
        self.assertFalse((root/'run/best-model').exists())
        self.assertFalse((root/'run/calibration.json').exists())


def native_consumer_config(root, base):
    from test_review_fast3_regressions import native_fixture

    from vfinal_pipeline.data_build import NATIVE_LABELS, build

    data = build(native_fixture(root, list(NATIVE_LABELS)), root/'data')
    return {'data_dir': str(root/'data'), 'data_identity': data['identity'],
            'base_dir': str(base), 'base_identity': experiment.bundle_identity(base),
            'max_length': 16, 'gradient_checkpointing': False,
            'training': {'unit_only': False, 'seed': 42}}


class NativeHeadConsumers(unittest.TestCase):
    def test_encoder_declaration_cannot_hide_reused_wrong_head(self):
        import torch
        from safetensors.torch import load_file
        from transformers import AutoModelForSequenceClassification

        from vfinal_pipeline.data_build import NATIVE_LABELS

        root = fixture_root()
        sealed = Path(__file__).resolve().parents[2]/'artifacts/ml/v-final/review-fixes-fast4/resume-1/pipeline-independent-data-1/native-head-encoder-declaration'
        before = tree_pins(sealed)
        base = root/'base'
        shutil.copytree(sealed, base)
        labels = list(NATIVE_LABELS)
        stored = load_file(str(base/'model.safetensors'))
        # Independent native control: architecture text does not prevent real head reuse.
        unsafe = AutoModelForSequenceClassification.from_pretrained(
            str(base), local_files_only=True, trust_remote_code=False,
            num_labels=len(labels), id2label=dict(enumerate(labels)),
            label2id={label: i for i, label in enumerate(labels)},
        )
        self.assertTrue(torch.equal(unsafe.classifier.weight, stored['classifier.weight']))
        self.assertTrue(torch.equal(unsafe.classifier.bias, stored['classifier.bias']))
        original = json.loads((base/'config.json').read_bytes())
        self.assertNotEqual(original['id2label'], {str(i): label for i, label in enumerate(labels)})
        config = native_consumer_config(root, base)
        # Native admission plumbing only: no genuine run; stop before data preparation.
        with patch.object(experiment, 'resources'), patch.object(
            experiment, 'prepared', side_effect=ConsumerReached('unvalidated head reached preparation'),
        ) as prepared:
            with self.assertRaisesRegex(ValueError, 'head.*label'):
                experiment.run(config, root/'run')
            prepared.assert_not_called()
        self.assertEqual(tree_pins(sealed), before)
        self.assertEqual(tree_pins(base), before)
        self.assertFalse((root/'run/checkpoints').exists())

    def test_native_aligned_head_reused_without_remapping(self):
        import torch
        from safetensors.torch import load_file

        from vfinal_pipeline.data_build import NATIVE_LABELS

        root = fixture_root()
        sealed = Path(__file__).resolve().parents[2]/'artifacts/ml/v-final/review-fixes-fast4/resume-1/pipeline-independent-data-1/native-head-encoder-declaration'
        base = root/'base'
        shutil.copytree(sealed, base)
        labels = list(NATIVE_LABELS)
        metadata = json.loads((base/'config.json').read_bytes())
        metadata.update(id2label={str(i): label for i, label in enumerate(labels)},
                        label2id={label: i for i, label in enumerate(labels)})
        (base/'config.json').write_bytes(canonical(metadata))
        stored = load_file(str(base/'model.safetensors'))
        config = native_consumer_config(root, base)
        real_loader = experiment.local_model
        observed = []

        def loader(*args, **kwargs):
            model, tokenizer = real_loader(*args, **kwargs)
            observed.append(model)
            return model, tokenizer

        with patch.object(experiment, 'resources'), patch.object(experiment, 'local_model', loader), patch.object(
            experiment, 'prepared', side_effect=ConsumerReached('admitted tiny native head'),
        ), self.assertRaisesRegex(ConsumerReached, 'admitted tiny native head'):
            experiment.run(config, root/'run')
        self.assertEqual(len(observed), 1)
        self.assertTrue(torch.equal(observed[0].classifier.weight, stored['classifier.weight']))
        self.assertTrue(torch.equal(observed[0].classifier.bias, stored['classifier.bias']))
        self.assertEqual(observed[0].config.id2label, dict(enumerate(labels)))

    def test_real_encoder_initializes_native_head_safely(self):
        import torch
        from transformers import BertConfig, BertModel, BertTokenizerFast

        from vfinal_pipeline.data_build import NATIVE_LABELS

        root = fixture_root()
        base = root/'base'
        base.mkdir()
        (base/'vocab.txt').write_text('[PAD]\n[UNK]\n[CLS]\n[SEP]\n[MASK]\na\nb\n', encoding='utf-8')
        BertTokenizerFast(vocab_file=str(base/'vocab.txt')).save_pretrained(base)
        torch.manual_seed(11)
        encoder = BertModel(BertConfig(vocab_size=7, hidden_size=8, num_hidden_layers=1,
                                      num_attention_heads=2, intermediate_size=16))
        encoder.save_pretrained(base)
        config = native_consumer_config(root, base)
        real_loader = experiment.local_model
        observed = []

        def loader(*args, **kwargs):
            model, tokenizer = real_loader(*args, **kwargs)
            observed.append(model)
            return model, tokenizer

        with patch.object(experiment, 'resources'), patch.object(experiment, 'local_model', loader), patch.object(
            experiment, 'prepared', side_effect=ConsumerReached('admitted initialized encoder'),
        ), self.assertRaisesRegex(ConsumerReached, 'admitted initialized encoder'):
            experiment.run(config, root/'run')
        self.assertEqual(len(observed), 1)
        self.assertEqual(observed[0].classifier.out_features, len(NATIVE_LABELS))
        self.assertEqual(observed[0].config.id2label, dict(enumerate(NATIVE_LABELS)))
        for name, value in encoder.state_dict().items():
            torch.testing.assert_close(observed[0].bert.state_dict()[name], value, rtol=0, atol=0)
