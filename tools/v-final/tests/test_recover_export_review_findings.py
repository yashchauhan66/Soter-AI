"""UNIT-ONLY vertical regressions: native files, explicit no-model seams."""
import importlib.util
import json
import os
import subprocess
import sys
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.fixture
def recovery(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        'recovery_review_findings', Path(__file__).parents[1] / 'recover_export.py',
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    root = tmp_path / 'approved'
    root.mkdir()
    source = tmp_path / 'source'
    source.mkdir()
    monkeypatch.setattr(module, 'RECOVERY_ROOT', root)
    monkeypatch.setattr(module, 'load_metadata', lambda _: {})
    monkeypatch.setitem(sys.modules, 'torch', SimpleNamespace(set_num_threads=lambda _: None))
    return module, source, root / 'bundle'


def invoke(module, source, output):
    return module.main(['--source-dir', str(source), '--output-dir', str(output)])


def test_inner_export_notes_survive_wrapper_and_outer_record(recovery, monkeypatch, capsys):
    module, source, output = recovery
    primary = RuntimeError('UNIT-ONLY exporter rejected')
    primary.add_note('nested exporter provenance')
    loaded = {'info': {'source_weights_bytes': 1}, 'wrapper': None,
              'tokenizer': lambda *a, **k: {'input_ids': None, 'attention_mask': None}}

    def reject_export(*args, **kwargs):
        raise primary

    torch = SimpleNamespace(
        set_num_threads=lambda _: None, no_grad=nullcontext,
        export=SimpleNamespace(Dim=lambda *a, **k: None),
        onnx=SimpleNamespace(export=reject_export),
    )
    for name in ('numpy', 'onnx', 'onnxruntime', 'transformers'):
        monkeypatch.setitem(sys.modules, name, SimpleNamespace())
    monkeypatch.setitem(sys.modules, 'torch', torch)
    monkeypatch.setattr(module, 'load_model', lambda _: nullcontext(loaded))
    original_write = Path.write_text
    attempts = []

    def refuse_first_record(path, text, *args, **kwargs):
        if path == output / 'RECOVERY_FAILED.json':
            attempts.append(path)
            if len(attempts) == 1:
                raise PermissionError('UNIT-ONLY inner failure record denied')
        return original_write(path, text, *args, **kwargs)

    monkeypatch.setattr(Path, 'write_text', refuse_first_record)
    assert invoke(module, source, output) == 2
    stderr = capsys.readouterr().err
    failure = json.loads((output / 'RECOVERY_FAILED.json').read_bytes())
    assert len(attempts) == 2
    assert 'UNIT-ONLY exporter rejected' in stderr
    assert 'nested exporter provenance' in stderr
    assert 'UNIT-ONLY inner failure record denied' in stderr
    assert any('nested exporter provenance' in note for note in failure['notes'])
    assert any('UNIT-ONLY inner failure record denied' in note for note in failure['notes'])
    assert not (output / 'recovery_manifest.json').exists()


@pytest.mark.parametrize('errno', [5, 28])
def test_cleanup_oserror_preserves_primary_and_nested_notes(
    recovery, monkeypatch, capsys, tmp_path, errno,
):
    module, source, output = recovery
    (source / 'pytorch_model.bin').write_bytes(b'UNIT-ONLY not the approved checkpoint')
    snapshot_dir = tmp_path / 'private'
    snapshot_dir.mkdir()
    cleanup_error = OSError(errno, 'UNIT-ONLY private cleanup failed')
    cleanup_error.add_note('nested cleanup provenance')
    attempts = []

    def cleanup():
        attempts.append(True)
        if len(attempts) == 1:
            raise cleanup_error

    snapshot_type = module._SnapshotResult
    snapshot = snapshot_type(temporary=SimpleNamespace(name=str(snapshot_dir), cleanup=cleanup))
    monkeypatch.setattr(module, '_SnapshotResult', lambda: snapshot)
    monkeypatch.setattr(module, 'load_model', lambda path: module.load_state(path))
    try:
        assert invoke(module, source, output) == 2
        stderr = capsys.readouterr().err
        assert 'source SHA256 mismatch' in stderr
        assert 'UNIT-ONLY private cleanup failed' in stderr
        assert 'nested cleanup provenance' in stderr
        assert len(attempts) == 1, 'Non-sharing I/O errors must not be retried'
        assert not output.exists()
    finally:
        snapshot.close()


def stub_successful_consumption(module, monkeypatch):
    cleanup = []

    class Loaded:
        def __enter__(self):
            return {}

        def __exit__(self, *args):
            cleanup.append(True)

    def export(loaded, output, *, _owned_outputs):
        output.mkdir()
        _owned_outputs.add(output)
        return {'status': 'verified_serialization_recovery', 'verified': True,
                'source_sha256': 'UNIT-ONLY', 'model_sha256': 'UNIT-ONLY',
                'parity': {'max_abs_logit_difference': 0.0}, 'release_ready': False}

    monkeypatch.setattr(module, 'load_model', lambda _: Loaded())
    monkeypatch.setattr(module, 'export_bundle', export)
    return cleanup


@pytest.mark.parametrize('refuse_failure_record', [False, True])
def test_postwrite_publication_failure_never_retains_verified_status(
    recovery, monkeypatch, capsys, refuse_failure_record,
):
    module, source, output = recovery
    cleanup = stub_successful_consumption(module, monkeypatch)
    original_write = Path.write_text
    publication_attempts = []

    def fail_after_native_write(path, text, *args, **kwargs):
        if path == output / 'recovery_manifest.json':
            assert cleanup == [True]
            original_write(path, text, *args, **kwargs)
            publication_attempts.append(json.loads(path.read_bytes()))
            error = OSError('UNIT-ONLY native write completed, close rejected')
            error.add_note('nested publication provenance')
            raise error
        if path == output / 'RECOVERY_FAILED.json' and refuse_failure_record:
            raise PermissionError('UNIT-ONLY failure record refused')
        return original_write(path, text, *args, **kwargs)

    monkeypatch.setattr(Path, 'write_text', fail_after_native_write)
    assert invoke(module, source, output) == 2
    captured = capsys.readouterr()
    assert len(publication_attempts) == 1
    assert 'native write completed, close rejected' in captured.err
    assert 'nested publication provenance' in captured.err
    if refuse_failure_record:
        assert 'UNIT-ONLY failure record refused' in captured.err
        assert not (output / 'RECOVERY_FAILED.json').exists()
    else:
        failure = json.loads((output / 'RECOVERY_FAILED.json').read_bytes())
        assert failure['status'] == 'failed'
    assert 'verified_serialization_recovery' not in captured.out
    for path in output.glob('*.json'):
        status = json.loads(path.read_bytes())
        assert status.get('status') != 'verified_serialization_recovery'
        assert status.get('verified') is not True


@pytest.mark.parametrize('seam', ['load', 'publication', 'failure_record'])
def test_output_ancestor_replacement_is_prevented_before_any_write(
    recovery, monkeypatch, tmp_path, capsys, seam,
):
    assert os.name == 'nt', 'Native Windows anchoring regression'
    module, source, output = recovery
    stub_successful_consumption(module, monkeypatch)
    ancestor = output.parent
    outside = tmp_path / 'outside-approved'
    outside.mkdir()
    if seam != 'load':
        (outside / output.name).mkdir()
    (outside / 'sentinel.txt').write_bytes(b'UNIT-ONLY outside file must remain unchanged')
    before = {p.relative_to(outside).as_posix(): p.read_bytes()
              for p in outside.rglob('*') if p.is_file()}
    attempts, denials = [], []

    def replace_ancestor():
        attempts.append(True)
        try:
            ancestor.rename(tmp_path / 'moved-approved')
        except PermissionError as error:
            denials.append(error.winerror)
            return
        result = subprocess.run(
            [os.environ['COMSPEC'], '/c', 'mklink', '/J', str(ancestor), str(outside)],
            capture_output=True, text=True, check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert ancestor.is_junction()

    original_loader, original_export = module.load_model, module.export_bundle
    original_write = Path.write_text

    def loader(path):
        if seam == 'load':
            replace_ancestor()
        return original_loader(path)

    def export(*args, **kwargs):
        manifest = original_export(*args, **kwargs)
        if seam != 'publication':
            raise module.RecoveryError('UNIT-ONLY exporter failed')
        return manifest

    def write(path, text, *args, **kwargs):
        trigger = 'recovery_manifest.json' if seam == 'publication' else 'RECOVERY_FAILED.json'
        if seam != 'load' and path == output / trigger:
            replace_ancestor()
        return original_write(path, text, *args, **kwargs)

    monkeypatch.setattr(module, 'load_model', loader)
    monkeypatch.setattr(module, 'export_bundle', export)
    monkeypatch.setattr(Path, 'write_text', write)
    assert invoke(module, source, output) == (0 if seam == 'publication' else 2)
    capsys.readouterr()
    assert attempts == [True]
    after = {p.relative_to(outside).as_posix(): p.read_bytes()
             for p in outside.rglob('*') if p.is_file()}
    assert after == before, 'An unauthorized redirected write already occurred'
    assert denials == [32], 'The native ancestor replacement must be prevented, not detected later'
    assert not ancestor.is_junction()
    # Handles must be released when the transaction ends, including rejection.
    ancestor.rename(tmp_path / 'released-approved')


def test_interrupted_anchor_acquisition_releases_native_handles(recovery, monkeypatch, tmp_path):
    module, source, output = recovery
    guard = module._OutputGuard(output)
    original_pin = guard._pin
    cancellation = SystemExit(19)

    def interrupt(path, *args, **kwargs):
        original_pin(path, *args, **kwargs)
        if path == output.parent:
            raise cancellation

    monkeypatch.setattr(guard, '_pin', interrupt)
    monkeypatch.setattr(module, '_OutputGuard', lambda _: guard)
    try:
        with pytest.raises(SystemExit) as rejected:
            invoke(module, source, output)
        assert rejected.value is cancellation
        assert cancellation.code == 19
        output.parent.rename(tmp_path / 'released-after-interruption')
    finally:
        guard.__exit__(None, None, None)


def native_try_junction(path, target):
    """Real FSCTL_SET_REPARSE_POINT; return the native error, or zero."""
    import ctypes
    import struct
    from ctypes import wintypes

    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateFileW.argtypes = (wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                  wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE)
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
    kernel.CloseHandle.restype = wintypes.BOOL
    kernel.DeviceIoControl.argtypes = (wintypes.HANDLE, wintypes.DWORD, wintypes.LPVOID,
                                      wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD,
                                      ctypes.POINTER(wintypes.DWORD), wintypes.LPVOID)
    kernel.DeviceIoControl.restype = wintypes.BOOL
    handle = kernel.CreateFileW(str(path), 0x40000000, 7, None, 3, 0x02200000, None)
    if handle == ctypes.c_void_p(-1).value:
        return ctypes.get_last_error()
    try:
        substitute = ('\\??\\' + str(target)).encode('utf-16-le')
        display = str(target).encode('utf-16-le')
        payload = (struct.pack('<HHHH', 0, len(substitute), len(substitute) + 2, len(display))
                   + substitute + b'\0\0' + display + b'\0\0')
        raw = struct.pack('<IHH', 0xA0000003, len(payload), 0) + payload
        buffer, returned = ctypes.create_string_buffer(raw), wintypes.DWORD()
        success = kernel.DeviceIoControl(handle, 0x900A4, buffer, len(raw), None, 0,
                                         ctypes.byref(returned), None)
        return 0 if success else ctypes.get_last_error()
    finally:
        assert kernel.CloseHandle(handle)


def test_in_place_junction_and_output_replacement_blocked(recovery, monkeypatch, tmp_path):
    module, source, output = recovery
    stub_successful_consumption(module, monkeypatch)
    outside = tmp_path / 'outside'
    outside.mkdir()
    positive = tmp_path / 'positive-junction'
    positive.mkdir()
    assert native_try_junction(positive, outside) == 0
    assert positive.is_junction()
    positive.rmdir()
    original_export = module.export_bundle
    observed = []

    def export(*args, **kwargs):
        result = original_export(*args, **kwargs)
        observed.extend([native_try_junction(output.parent, outside),
                         native_try_junction(output, outside)])
        with pytest.raises(PermissionError) as denied:
            (output / '.recovery-directory-anchor').unlink()
        assert denied.value.winerror == 32
        with pytest.raises(PermissionError) as denied:
            output.rename(tmp_path / 'moved-output')
        assert denied.value.winerror == 32
        return result

    monkeypatch.setattr(module, 'export_bundle', export)
    assert invoke(module, source, output) == 0
    assert observed == [32, 145]
    assert not list(outside.iterdir())
    assert json.loads((output / 'recovery_manifest.json').read_bytes())['verified'] is True
    assert not list(output.glob('*.pending'))
    output.rename(output.with_name('released-output'))


def test_missing_parent_chain_is_anchored_and_released(recovery, monkeypatch):
    module, source, output = recovery
    stub_successful_consumption(module, monkeypatch)
    output = output.parent / 'new' / 'nested' / 'bundle'
    assert invoke(module, source, output) == 0
    output.parent.rename(output.parent.with_name('released-nested'))


def test_junction_inserted_before_anchor_is_rejected_without_write(
    recovery, monkeypatch, tmp_path, capsys,
):
    module, source, output = recovery
    outside = tmp_path / 'outside'
    outside.mkdir()

    def metadata(_):
        output.parent.rename(tmp_path / 'moved-approved')
        output.parent.mkdir()
        assert native_try_junction(output.parent, outside) == 0
        return {}

    monkeypatch.setattr(module, 'load_metadata', metadata)
    assert invoke(module, source, output) == 2
    assert 'link, junction or non-directory' in capsys.readouterr().err
    assert not list(outside.iterdir())
    output.parent.rmdir()


@pytest.mark.parametrize('seam', ['fsync', 'staged_close', 'replace'])
def test_staging_or_commit_refusal_leaves_only_nonverified_canonical_status(
    recovery, monkeypatch, capsys, seam,
):
    from contextlib import contextmanager

    module, source, output = recovery
    stub_successful_consumption(module, monkeypatch)
    attempts = []

    def reject(*args, **kwargs):
        attempts.append(seam)
        raise OSError('UNIT-ONLY staging or commit refused')

    if seam == 'staged_close':
        original = module.tempfile.NamedTemporaryFile

        @contextmanager
        def close_refused(*args, **kwargs):
            with original(*args, **kwargs) as stream:
                yield stream
            reject()

        monkeypatch.setattr(module.tempfile, 'NamedTemporaryFile', close_refused)
    else:
        monkeypatch.setattr(module.os, seam, reject)
    assert invoke(module, source, output) == 2
    assert attempts == [seam]
    assert 'UNIT-ONLY staging or commit refused' in capsys.readouterr().err
    status = json.loads((output / 'recovery_manifest.json').read_bytes())
    assert status['status'] == 'publication_pending'
    assert status['verified'] is False
    assert json.loads((output / 'RECOVERY_FAILED.json').read_bytes())['status'] == 'failed'
    assert len(list(output.glob('*.pending'))) == 1
