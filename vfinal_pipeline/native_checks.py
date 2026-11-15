"""Own-scope no-model tests, serialized with the shared Windows mutex."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

REPO = Path(__file__).resolve().parents[1]
EVIDENCE = REPO / 'artifacts/ml/v-final/offline-preparation/execution'
SCRATCH = Path('C:/Users/USER/AppData/Local/hermes/cache/scratch')


def pin(path):
    raw = path.read_bytes()
    return {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}


def source_pins():
    paths = list((REPO / 'vfinal_pipeline').rglob('*.py'))
    paths += list((REPO / 'vfinal_pipeline').rglob('*.ipynb'))
    paths += [REPO / 'eval_harness' / name for name in ('core.py', 'data.py')]
    return {p.relative_to(REPO).as_posix(): pin(p) for p in sorted(paths)}


def resources():
    free = shutil.disk_usage(str(REPO)).free
    assert free >= 933930572, 'disk floor unmet'
    import psutil
    return {'disk_free': free, 'ram_available': psutil.virtual_memory().available,
            'disk_floor': 933930572, 'genuine_ram_floor': 5368709120,
            'genuine_model_execution': False}


def main():
    label = sys.argv[1]
    assert label and all(c.isalnum() or c == '-' for c in label)
    assert Path.cwd() == REPO and sys.version_info[:2] == (3, 12)
    assert sys.dont_write_bytecode
    for key in ('TMPDIR', 'TMP', 'TEMP'):
        assert Path(os.environ[key]) == SCRATCH
    assert Path(tempfile.gettempdir()) == SCRATCH
    for key in ('PYTHONDONTWRITEBYTECODE', 'HF_HUB_OFFLINE', 'HUGGINGFACE_HUB_OFFLINE',
                'TRANSFORMERS_OFFLINE', 'HF_DATASETS_OFFLINE', 'PIP_NO_INDEX',
                'PYTEST_DISABLE_PLUGIN_AUTOLOAD'):
        assert os.environ[key] == '1', key
    assert os.environ['WANDB_MODE'] == 'offline'
    resources()
    run = EVIDENCE / 'runs' / label
    run.mkdir(parents=True, exist_ok=False)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.ReleaseMutex.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    mutex = kernel.CreateMutexW(None, False, 'Local\\SoterVFinalNativeUnitChecks')
    assert mutex
    acquired = False
    try:
        wait = kernel.WaitForSingleObject(mutex, 300000)
        assert wait in (0, 128), wait
        acquired = True
        measured = resources()
        before = source_pins()
        command = [sys.executable, '-B', '-m', 'unittest', 'discover', '-s',
                   'vfinal_pipeline/tests', '-p', 'test_*.py', '-v']
        started = time.time()
        with (run / 'stdout.bin').open('xb') as out, (run / 'stderr.bin').open('xb') as err:
            result = subprocess.run(command, cwd=REPO, env=os.environ.copy(),
                                    stdout=out, stderr=err, timeout=180)
        after = source_pins()
        assert before == after, 'source drift during tests'
        receipt = {'native_exit_code': result.returncode, 'command': command,
                   'cwd': str(REPO), 'resources': measured, 'seconds': time.time() - started,
                   'source_pins': before, 'source_stable': True,
                   'stdout': pin(run / 'stdout.bin'), 'stderr': pin(run / 'stderr.bin'),
                   'unit_fixtures_only': True, 'release_ready': False}
        (run / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        print(json.dumps({'run': str(run), 'native_exit_code': result.returncode}))
        print((run / 'stderr.bin').read_text(encoding='utf-8'))
        return result.returncode
    finally:
        if acquired:
            kernel.ReleaseMutex(mutex)
        kernel.CloseHandle(mutex)


if __name__ == '__main__':
    raise SystemExit(main())
