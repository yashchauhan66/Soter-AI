"""Atomic append-only checkpoint payloads + best/last pointers.

A single training writer is required. Drive rename guarantees vary: verify pins
on every read, retain periodic steps; never fall back silently from corruption.
"""
import os
from pathlib import Path
import uuid
from .common import canonical, captured, decode, identity, write_new


def atomic(path, raw):
    path = Path(path)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.partial')
    with temporary.open('xb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


class Checkpoints:
    def __init__(self, root, config):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.config_id = identity(config)
        contract = self.root / 'run.json'
        if contract.exists():
            if contract.read_bytes() != canonical(config):
                raise ValueError('checkpoint config/data/model identity changed')
        else:
            write_new(contract, canonical(config))

    def save(self, step, payload, *, best):
        if type(step) is not int or step < 0 or type(payload) is not bytes or type(best) is not bool:
            raise ValueError('invalid checkpoint payload/step')
        target = self.root / f'step-{step:09d}'
        staging = self.root / ('partial-' + uuid.uuid4().hex)
        staging.mkdir(exist_ok=False)
        descriptor = write_new(staging / 'state.bin', payload)
        descriptor['config_identity'] = self.config_id
        descriptor['step'] = step
        write_new(staging / 'manifest.json', canonical(descriptor))
        # A crash may have committed a step but not its pointer. Reuse exact bytes only.
        if target.exists():
            existing = decode((target / 'manifest.json').read_bytes())
            if existing != descriptor or captured(target, existing) != payload:
                raise ValueError('checkpoint step collision with different identity')
        else:
            os.rename(staging, target)
        pointer = {'path': target.name + '/manifest.json',
                   **{k: v for k, v in write_descriptor(canonical(descriptor)).items()}}
        atomic(self.root / 'last.json', canonical(pointer))
        if best:
            atomic(self.root / 'best.json', canonical(pointer))

    def load(self, which='last'):
        if which not in ('best', 'last'):
            raise ValueError('unknown checkpoint pointer')
        pointer = self.root / (which + '.json')
        if not pointer.exists():
            return None
        descriptor = decode(captured(self.root, decode(pointer.read_bytes())))
        if descriptor['config_identity'] != self.config_id:
            raise ValueError('checkpoint identity mismatch')
        step = descriptor['step']
        return step, captured(self.root / f'step-{step:09d}', descriptor)


def write_descriptor(raw):
    from .common import digest
    return {'sha256': digest(raw), 'bytes': len(raw)}
