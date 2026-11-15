"""UNIT-ONLY transaction regressions: real NTFS files, stubbed model numerics."""
import hashlib
import json
import sys
from pathlib import Path

import pytest
import test_recover_export_descendant_paths as descendant_paths
from test_recover_export_descendant_paths import invoke

fixture = descendant_paths.fixture


@pytest.mark.parametrize('relative', ['model.onnx', 'model.onnx.data'])
@pytest.mark.parametrize('seam', ['checker', 'parity', 'canonical', 'replace'])
def test_native_bytes_are_frozen_before_consumption_through_commit(
    fixture, monkeypatch, capsys, relative, seam,
):
    module, source, output, _, _ = fixture
    target = output / relative
    exported = b'UNIT-ONLY exporter-owned native bytes'
    attempts = []
    python_attempts = []
    original_export = sys.modules['torch'].onnx.export

    def export(*args, **kwargs):
        original_export(*args, **kwargs)
        target.write_bytes(exported)

    def adversarial_writer():
        import ctypes
        from ctypes import wintypes

        try:
            target.write_bytes(b'UNIT-ONLY adversarial corruption')
        except PermissionError as error:
            python_attempts.append({'type': type(error).__name__, 'errno': error.errno,
                                    'winerror': error.winerror})
        else:
            python_attempts.append({'type': None, 'errno': 0, 'winerror': 0})
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateFileW.argtypes = (wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                      wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE)
        kernel.CreateFileW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel.CloseHandle.restype = wintypes.BOOL
        handle = kernel.CreateFileW(str(target), 0x40000000, 7, None, 3, 0, None)
        if handle == ctypes.c_void_p(-1).value:
            attempts.append(ctypes.get_last_error())
        else:
            attempts.append(0)
            assert kernel.CloseHandle(handle)

    monkeypatch.setattr(sys.modules['torch'].onnx, 'export', export)
    if seam == 'checker':
        monkeypatch.setattr(sys.modules['onnx'].checker, 'check_model',
                            lambda *a, **k: adversarial_writer())
    elif seam == 'parity':
        original_session = sys.modules['onnxruntime'].InferenceSession

        def session(*args, **kwargs):
            adversarial_writer()
            return original_session(*args, **kwargs)

        monkeypatch.setattr(sys.modules['onnxruntime'], 'InferenceSession', session)
    elif seam == 'canonical':
        original_write = Path.write_text

        def write(path, *args, **kwargs):
            if path == output / 'recovery_manifest.json':
                adversarial_writer()
            return original_write(path, *args, **kwargs)

        monkeypatch.setattr(Path, 'write_text', write)
    else:
        original_replace = module.os.replace

        def replace(*args, **kwargs):
            adversarial_writer()
            return original_replace(*args, **kwargs)

        monkeypatch.setattr(module.os, 'replace', replace)
    code = invoke(module, source, output)
    captured = capsys.readouterr()
    print(json.dumps({'seam': seam, 'relative': relative, 'native_errors': attempts,
                      'python_errors': python_attempts,
                      'exit': code, 'cli_stdout': captured.out, 'cli_stderr': captured.err}))
    assert attempts == [32], 'A real native write must be denied before changing consumed bytes'
    assert [row['type'] for row in python_attempts] == ['PermissionError']
    assert [row['errno'] for row in python_attempts] == [13]
    assert code == 0, captured.err
    manifest = json.loads((output / 'recovery_manifest.json').read_bytes())
    assert target.read_bytes() == exported
    rows = {row['path']: row for row in manifest['artifact_files']}
    assert rows[relative]['sha256'] == hashlib.sha256(exported).hexdigest()
    assert rows[relative]['bytes'] == len(exported)
    assert manifest['status'] == 'verified_serialization_recovery'
    output.rename(output.with_name('released-native-freeze'))


@pytest.mark.parametrize('relative', ['model.onnx', 'model.onnx.data'])
def test_outstanding_native_writer_rejects_before_checker(
    fixture, monkeypatch, capsys, relative,
):
    module, source, output, _, _ = fixture
    handles, checks = [], []
    original_export = sys.modules['torch'].onnx.export

    def export(*args, **kwargs):
        original_export(*args, **kwargs)
        handles.append((output / relative).open('r+b'))

    monkeypatch.setattr(sys.modules['torch'].onnx, 'export', export)
    monkeypatch.setattr(sys.modules['onnx'].checker, 'check_model',
                        lambda *a, **k: checks.append(True))
    try:
        code = invoke(module, source, output)
        captured = capsys.readouterr()
        print(json.dumps({'relative': relative, 'exit': code, 'checker_calls': checks,
                          'cli_stdout': captured.out, 'cli_stderr': captured.err}))
        assert code == 2, 'An outstanding writer must prevent validation, not race a final hash'
        assert checks == []
        assert 'WinError 32' in captured.err
        assert not (output / 'recovery_manifest.json').exists()
        assert json.loads((output / 'RECOVERY_FAILED.json').read_bytes())['status'] == 'failed'
    finally:
        for handle in handles:
            handle.close()
    output.rename(output.with_name('released-writer-rejection'))


@pytest.mark.parametrize('seam', ['staged_close', 'replace'])
def test_staging_source_identity_and_bytes_are_bound_to_manifest(
    fixture, monkeypatch, capsys, seam,
):
    from contextlib import contextmanager

    module, source, output, outside, _ = fixture
    sentinel = outside / 'sentinel.txt'
    sentinel_bytes = sentinel.read_bytes()
    attempts, computed = [], []
    original_export = module.export_bundle
    original_replace = module.os.replace

    def export(*args, **kwargs):
        manifest = original_export(*args, **kwargs)
        computed.append(json.dumps(manifest, indent=2, allow_nan=False).encode())
        return manifest

    def substitute(name):
        path = Path(name)
        before = path.stat()
        try:
            path.rename(path.with_suffix('.displaced'))
        except PermissionError as error:
            attempts.append({'denied': error.winerror})
        else:
            module.os.link(sentinel, path)
            attempts.append({'before': before.st_ino, 'after': path.stat().st_ino,
                             'nlink': path.stat().st_nlink})

    if seam == 'staged_close':
        original_temporary = module.tempfile.NamedTemporaryFile

        @contextmanager
        def temporary(*args, **kwargs):
            with original_temporary(*args, **kwargs) as stream:
                yield stream
            substitute(stream.name)

        monkeypatch.setattr(module.tempfile, 'NamedTemporaryFile', temporary)
    else:
        def replace(src, dst, *args, **kwargs):
            if Path(dst) == output / 'recovery_manifest.json' and not attempts:
                substitute(src)
            return original_replace(src, dst, *args, **kwargs)

        monkeypatch.setattr(module.os, 'replace', replace)
    monkeypatch.setattr(module, 'export_bundle', export)
    code = invoke(module, source, output)
    captured = capsys.readouterr()
    canonical = output / 'recovery_manifest.json'
    actual = canonical.read_bytes() if canonical.exists() else None
    print(json.dumps({'seam': seam, 'attempts': attempts, 'exit': code,
                      'cli_stdout': captured.out, 'cli_stderr': captured.err,
                      'canonical_hex': actual.hex() if actual is not None else None}))
    assert len(attempts) == 1
    assert sentinel.read_bytes() == sentinel_bytes
    assert len(computed) == 1
    if code == 0:
        assert actual == computed[0], 'Canonical publication consumed a substituted staging source'
    else:
        assert code == 2
        assert 'staging' in captured.err.lower()
        assert json.loads((output / 'RECOVERY_FAILED.json').read_bytes())['status'] == 'failed'
        if actual is not None:
            status = json.loads(actual)
            assert status.get('status') != 'verified_serialization_recovery'
            assert status.get('verified') is not True
    if 'nlink' in attempts[0]:
        assert attempts[0]['nlink'] == 2
        assert attempts[0]['before'] != attempts[0]['after']
        assert code == 2
    else:
        assert attempts[0]['denied'] == 32
    output.rename(output.with_name('released-staging-control'))


@pytest.mark.parametrize('kind', ['descriptor', 'native_handle'])
@pytest.mark.parametrize('primary', [False, True])
@pytest.mark.parametrize('record_refused', [False, True])
def test_required_output_close_failure_revokes_success_and_keeps_diagnostics(
    fixture, monkeypatch, capsys, kind, primary, record_refused,
):
    module, source, output, _, _ = fixture
    canonical = output / 'recovery_manifest.json'
    real_close = module.os.close
    original_exit = module._OutputGuard.__exit__
    original_commit = module._OutputGuard.commit_staged
    original_write = Path.write_text
    state = {'active': False, 'faults': 0, 'real_closes': 0}

    def fault():
        state['faults'] += 1
        error = OSError('UNIT-ONLY injected required output close rejection after real close')
        error.add_note('UNIT-ONLY nested close provenance')
        raise error

    def close(fd):
        result = real_close(fd)
        if state['active']:
            state['real_closes'] += 1
            if kind == 'descriptor' and not state['faults']:
                fault()
        return result

    def exit_guard(guard, *args):
        native_close = guard._kernel.CloseHandle

        def close_handle(handle):
            result = native_close(handle)
            assert result, 'The control must really close the native handle first'
            state['real_closes'] += 1
            if kind == 'native_handle' and not state['faults']:
                fault()
            return result

        monkeypatch.setattr(guard._kernel, 'CloseHandle', close_handle)
        state['active'] = True
        try:
            return original_exit(guard, *args)
        finally:
            state['active'] = False

    def commit(guard, *args, **kwargs):
        result = original_commit(guard, *args, **kwargs)
        assert json.loads(canonical.read_bytes())['status'] == 'verified_serialization_recovery'
        if primary:
            error = module.RecoveryError('UNIT-ONLY primary rejection after publication')
            error.add_note('UNIT-ONLY primary provenance')
            raise error
        return result

    def write(path, *args, **kwargs):
        if record_refused and path == output / 'RECOVERY_FAILED.json':
            raise PermissionError('UNIT-ONLY failure record I/O refused')
        return original_write(path, *args, **kwargs)

    monkeypatch.setattr(module.os, 'close', close)
    monkeypatch.setattr(module._OutputGuard, '__exit__', exit_guard)
    monkeypatch.setattr(module._OutputGuard, 'commit_staged', commit)
    monkeypatch.setattr(Path, 'write_text', write)
    escaped = None
    try:
        code = invoke(module, source, output)
    except OSError as error:
        escaped = str(error)
        code = None
    captured = capsys.readouterr()
    status = json.loads(canonical.read_bytes()) if canonical.exists() else None
    print(json.dumps({'kind': kind, 'primary': primary, 'record_refused': record_refused,
                      'injected': state, 'escaped': escaped, 'exit': code,
                      'canonical': status, 'cli_stdout': captured.out, 'cli_stderr': captured.err}))
    assert state['faults'] == 1
    assert state['real_closes'] > 1
    assert escaped is None
    assert code == 2
    assert not captured.out
    assert status is None or (status.get('status') != 'verified_serialization_recovery'
                              and status.get('verified') is not True)
    assert 'required output close rejection after real close' in captured.err
    assert 'nested close provenance' in captured.err
    if primary:
        assert 'primary rejection after publication' in captured.err
        assert 'primary provenance' in captured.err
    if record_refused:
        assert 'Failure record could not be written' in captured.err
        assert 'failure record I/O refused' in captured.err
        assert not (output / 'RECOVERY_FAILED.json').exists()
    else:
        failure = json.loads((output / 'RECOVERY_FAILED.json').read_bytes())
        assert failure['status'] == 'failed'
        assert failure['release_ready'] is False
        assert 'required output close rejection' in json.dumps(failure)
        if primary:
            assert 'primary rejection after publication' in failure['error']
    output.parent.rename(output.parent.with_name('released-after-close-fault'))
