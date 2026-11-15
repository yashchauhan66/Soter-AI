"""UNIT-ONLY: real NTFS destinations; numerical/model dependencies are stubs."""
import hashlib
import importlib.util
import json
import os
import sys
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace as NS

import pytest
from test_recover_export_review_findings import native_try_junction


class Array:
    shape = (1, 14)

    def numpy(self):
        return self

    def astype(self, *args, **kwargs):
        return self

    def all(self):
        return True

    def argmax(self, *args, **kwargs):
        return self

    def __sub__(self, other):
        return self


class Session:
    def get_inputs(self):
        return [NS(name=n, type='tensor(int64)') for n in ('input_ids', 'attention_mask')]

    def get_outputs(self):
        return [NS(name='logits')]

    def run(self, *args, **kwargs):
        return [Array()]


@pytest.fixture
def fixture(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        'recovery_descendants', Path(__file__).parents[1] / 'recover_export.py',
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    approved, source, outside = (tmp_path / name for name in ('approved', 'source', 'outside'))
    for path in (approved, source, outside):
        path.mkdir()
    output = approved / 'bundle'
    sentinel = outside / 'sentinel.txt'
    sentinel.write_bytes(b'UNIT-ONLY outside sentinel')
    payloads = {rel: ('UNIT-ONLY ' + rel).encode() for rel in module.EXPECTED_METADATA_SHA256}
    monkeypatch.setattr(module, 'EXPECTED_METADATA_SHA256', {
        rel: hashlib.sha256(raw).hexdigest() for rel, raw in payloads.items()
    })
    loaded = {
        'info': {'source_weights_bytes': 1, 'source_state_sha256': hashlib.sha256().hexdigest(),
                 'source_sha256': 'UNIT-ONLY synthetic state'},
        'metadata': {'_verified_metadata': payloads, 'temperature': 1.0},
        'tokenizer': lambda *a, **k: {'input_ids': Array(), 'attention_mask': Array()},
        'wrapper': lambda *a: Array(), 'model': NS(state_dict=dict),
    }

    def export(wrapper, inputs, filename, **kwargs):
        Path(filename).write_bytes(b'UNIT-ONLY not an ONNX model')

    modules = {
        'torch': NS(set_num_threads=lambda _: None, no_grad=nullcontext, inference_mode=nullcontext,
                    export=NS(Dim=lambda *a, **k: None), onnx=NS(export=export), __version__='UNIT-ONLY'),
        'numpy': NS(int64='UNIT-ONLY', isfinite=lambda _: Array(), max=lambda _: 0.0,
                    abs=lambda x: x, array_equal=lambda *a: True,
                    testing=NS(assert_allclose=lambda *a, **k: None)),
        'onnx': NS(checker=NS(check_model=lambda *a, **k: None), __version__='UNIT-ONLY'),
        'onnxruntime': NS(SessionOptions=lambda: NS(), InferenceSession=lambda *a, **k: Session(),
                          __version__='UNIT-ONLY'),
        'transformers': NS(__version__='UNIT-ONLY'),
    }
    for name, value in modules.items():
        monkeypatch.setitem(sys.modules, name, value)
    monkeypatch.setattr(module, 'RECOVERY_ROOT', approved)
    monkeypatch.setattr(module, 'load_metadata', lambda _: {})
    monkeypatch.setattr(module, 'load_model', lambda _: nullcontext(loaded))
    return module, source, output, outside, loaded


def invoke(module, source, output):
    return module.main(['--source-dir', str(source), '--output-dir', str(output)])


def test_tokenizer_junction_inserted_at_creation_never_receives_sidecars(fixture, monkeypatch):
    module, source, output, outside, _ = fixture
    original_mkdir = Path.mkdir
    attempts = []

    def insert_junction(path, *args, **kwargs):
        result = original_mkdir(path, *args, **kwargs)
        if path == output / 'tokenizer_config' and not attempts:
            attempts.append(native_try_junction(path, outside))
        return result

    monkeypatch.setattr(Path, 'mkdir', insert_junction)
    code = invoke(module, source, output)
    observed = {'unit_only_mock_numerics': True, 'exit': code, 'junction_errors': attempts,
                'outside_files': sorted(p.name for p in outside.iterdir()),
                'canonical_exists': (output / 'recovery_manifest.json').exists()}
    print('[descendant-at-creation] ' + json.dumps(observed))
    assert attempts == [0], 'The native junction insertion must actually succeed before pinning'
    assert sorted(p.name for p in outside.iterdir()) == ['sentinel.txt'], 'Sidecars escaped confinement'
    assert (outside / 'sentinel.txt').read_bytes() == b'UNIT-ONLY outside sentinel'
    assert code == 2
    assert not (output / 'recovery_manifest.json').exists()
    assert json.loads((output / 'RECOVERY_FAILED.json').read_bytes())['status'] == 'failed'
    output.rename(output.with_name('released-bundle'))


@pytest.mark.parametrize('relative', [
    'model.onnx', 'model.onnx.data', 'encoder_config.json', 'training_stats.json',
    'labels.json', 'calibration.json', 'tokenizer_config/tokenizer.json',
    'tokenizer_config/tokenizer_config.json', 'tokenizer_config/vocab.txt',
    'recovery_manifest.json', 'RECOVERY_FAILED.json',
])
def test_preexisting_hardlink_destination_is_never_truncated(fixture, monkeypatch, relative):
    module, source, output, outside, _ = fixture
    sentinel = outside / 'sentinel.txt'
    target = output / relative
    original_mkdir = Path.mkdir
    inserted = []

    def plant_hardlink(path, *args, **kwargs):
        result = original_mkdir(path, *args, **kwargs)
        if path == output and not inserted:
            if target.parent != output:
                original_mkdir(target.parent)
            os.link(sentinel, target)
            inserted.append(target.stat().st_nlink)
        return result

    def native_writer(wrapper, inputs, filename, **kwargs):
        if relative == 'RECOVERY_FAILED.json':
            raise RuntimeError('UNIT-ONLY exporter failure')
        Path(filename).write_bytes(b'UNIT-ONLY native model destination')
        Path(str(filename) + '.data').write_bytes(b'UNIT-ONLY native external tensor destination')

    monkeypatch.setattr(Path, 'mkdir', plant_hardlink)
    monkeypatch.setattr(sys.modules['torch'].onnx, 'export', native_writer)
    code = invoke(module, source, output)
    print('[hardlink-destination] ' + json.dumps({'relative': relative, 'exit': code,
          'outside_bytes': sentinel.read_bytes().decode(), 'hardlink_counts': inserted}))
    assert inserted == [2], 'Exercise a real NTFS hardlink, not an injected I/O error'
    assert sentinel.read_bytes() == b'UNIT-ONLY outside sentinel', 'Outside hardlink was overwritten'
    assert code == 2
    output.rename(output.with_name('released-bundle'))


def test_pinned_descendants_block_native_swaps_while_real_writes_succeed(fixture, monkeypatch):
    """Already-GREEN control, not a historical behavioral RED claim."""
    module, source, output, outside, _ = fixture
    original_export = sys.modules['torch'].onnx.export
    original_open = module._OutputPath.open
    native_denials, python_denials, junction_denials = [], [], []

    def native_writer(*args, **kwargs):
        for name in ('model.onnx', 'model.onnx.data'):
            with pytest.raises(PermissionError) as denied:
                (output / name).rename(output / (name + '.swapped'))
            native_denials.append(denied.value.winerror)
        return original_export(*args, **kwargs)

    def guarded_open(path, mode='r', *args, **kwargs):
        stream = original_open(path, mode, *args, **kwargs)
        if mode.startswith('w'):
            try:
                with pytest.raises(PermissionError) as denied:
                    path.rename(path.with_name(path.name + '.swapped'))
                python_denials.append(denied.value.winerror)
                if path.parent == output / 'tokenizer_config':
                    junction_denials.append(native_try_junction(path.parent, outside))
            except BaseException:
                stream.close()
                raise
        return stream

    monkeypatch.setattr(sys.modules['torch'].onnx, 'export', native_writer)
    monkeypatch.setattr(module._OutputPath, 'open', guarded_open)
    assert invoke(module, source, output) == 0
    assert native_denials == [32, 32]
    assert python_denials == [32] * 8
    assert junction_denials == [32] * 3
    assert sorted(p.name for p in outside.iterdir()) == ['sentinel.txt']
    assert json.loads((output / 'recovery_manifest.json').read_bytes())['status'] == 'verified_serialization_recovery'
    for relative, expected in module.EXPECTED_METADATA_SHA256.items():
        assert hashlib.sha256((output / relative).read_bytes()).hexdigest() == expected
    output.rename(output.with_name('released-success'))


def test_interrupted_destination_open_releases_all_native_handles(fixture, monkeypatch):
    """Already-GREEN cancellation control on the new descriptor ownership seam."""
    module, source, output, _, _ = fixture
    cancellation = SystemExit(27)
    attempts = []

    def interrupt(*args, **kwargs):
        attempts.append(True)
        raise cancellation

    monkeypatch.setattr(module.os, 'fdopen', interrupt)
    with pytest.raises(SystemExit) as caught:
        invoke(module, source, output)
    assert caught.value is cancellation
    assert caught.value.code == 27
    assert attempts == [True]
    output.parent.rename(output.parent.with_name('released-after-cancellation'))


def test_staged_name_collision_does_not_write_through_outside_hardlink(fixture, monkeypatch):
    """Already-GREEN control: NamedTemporaryFile must skip occupied names."""
    module, source, output, outside, _ = fixture
    original_mkdir = Path.mkdir
    sentinel = outside / 'sentinel.txt'

    def plant_staging_collision(path, *args, **kwargs):
        result = original_mkdir(path, *args, **kwargs)
        if path == output:
            os.link(sentinel, output / '.recovery-collision.pending')
        return result

    monkeypatch.setattr(Path, 'mkdir', plant_staging_collision)
    monkeypatch.setattr(module.tempfile, '_get_candidate_names', lambda: iter(('collision', 'fresh')))
    assert invoke(module, source, output) == 0
    assert sentinel.read_bytes() == b'UNIT-ONLY outside sentinel'
    assert (output / '.recovery-collision.pending').read_bytes() == sentinel.read_bytes()
    assert not (output / '.recovery-fresh.pending').exists()
    assert json.loads((output / 'recovery_manifest.json').read_bytes())['status'] == 'verified_serialization_recovery'
