"""Small strict JSON/identity primitives; no heavyweight imports or network."""
import hashlib
import json
import math
from pathlib import Path
import re


def canonical(value):
    def check(item):
        if type(item) is dict:
            for key, child in item.items():
                if type(key) is not str:
                    raise ValueError('JSON keys must be strings')
                check(key)
                check(child)
        elif type(item) is list:
            for child in item:
                check(child)
        elif type(item) is str:
            item.encode('utf-8', errors='strict')
        elif item is None or type(item) in (bool, int):
            pass
        elif type(item) is not float or not math.isfinite(item):
            raise ValueError('finite JSON scalars required')
    check(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def decode(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate JSON key')
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=pairs)
    canonical(value)
    return value


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def identity(value):
    return digest(canonical(value))


def checked_token(token):
    if type(token) is not str or re.fullmatch('[a-f0-9]{64}', token) is None:
        raise ValueError('invalid exact SHA256 pin')
    return token


def relative(root, name):
    if type(name) is not str or not name or '\\' in name:
        raise ValueError('portable relative path required')
    p = Path(name)
    if p.is_absolute() or p.drive or '..' in p.parts or ':' in name:
        raise ValueError('path traversal or absolute path refused')
    root = Path(root).resolve()
    result = (root / p).resolve()
    if not result.is_relative_to(root):
        raise ValueError('path escapes root')
    return result


def captured(root, descriptor):
    checked_token(descriptor['sha256'])
    if type(descriptor['bytes']) is not int or descriptor['bytes'] < 0:
        raise ValueError('invalid pin byte count')
    raw = relative(root, descriptor['path']).read_bytes()
    if len(raw) != descriptor['bytes'] or digest(raw) != descriptor['sha256']:
        raise ValueError('input pin mismatch: ' + descriptor['path'])
    return raw


def write_new(path, raw):
    with Path(path).open('xb') as stream:
        stream.write(raw)
        stream.flush()
    return {'path': Path(path).name, 'sha256': digest(raw), 'bytes': len(raw)}
