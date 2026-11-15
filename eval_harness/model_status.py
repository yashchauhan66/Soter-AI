"""Offline native-bundle availability inspection, not inference scoring or serving certification.

Only model/tokenizer/label/config bytes are parsed. Training weights and inventory
metadata are fingerprinted, never deserialized or used as evaluation datasets.
"""
from __future__ import annotations

import argparse
import csv
import gc
import hashlib
import io
import json
import os
import re
import tempfile
from collections import Counter
from pathlib import Path, PureWindowsPath

import onnx
from tokenizers import Tokenizer

from eval_harness.inference import (
    _REQUIRED_COMPONENTS,
    OnnxAdapter,
    _component_paths,
    _confined,
    _contract,
    _external_locations,
    _json_digest,
    _native_tokenizer,
    _signature,
)


def _fingerprint(path, name, data=None):
    if data is None:
        with path.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
            size = handle.tell()
    else:
        digest, size = hashlib.sha256(data).hexdigest(), len(data)
    return {'path': name, 'sha256': digest, 'bytes': size, 'consumption': 'inspection_only'}


def _json_bytes(data, name):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f'{name}: duplicate JSON key {key!r}')
            result[key] = value
        return result
    def scalars(value):
        if isinstance(value, str):
            if any('\ud800' <= character <= '\udfff' for character in value):
                raise ValueError('decoded metadata contains a non-scalar Unicode string')
        elif isinstance(value, float) and not -float('inf') < value < float('inf'):
            raise ValueError('decoded metadata contains a nonfinite number')
        elif isinstance(value, dict):
            for key, item in value.items():
                scalars(key)
                scalars(item)
        elif isinstance(value, list):
            for item in value:
                scalars(item)
    try:
        parsed = json.loads(data.decode('utf-8'), object_pairs_hook=unique,
                            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'nonfinite {value}')))
        # UTF-8 source bytes can still decode escaped isolated surrogates. Reject
        # before either inspection branch retains metadata; never normalize it.
        scalars(parsed)
        return parsed
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f'{name}: {exc}') from exc


def _labels(raw):
    if (not isinstance(raw, dict) or not raw or set(raw) != {str(i) for i in range(len(raw))}
            or any(not isinstance(label, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', label) for label in raw.values())
            or len(set(raw.values())) != len(raw)):
        raise ValueError('labels.json: invalid contiguous exact native labels; no normalization')
    return [raw[str(i)] for i in range(len(raw))]


def _declared_metadata(root, labels, raw, components, max_length, problems):
    """Parse the same in-memory ONNX bytes that are hashed, with no source reopen."""
    path = _confined(root, 'model.onnx')
    data = path.read_bytes()
    components['model.onnx'] = _fingerprint(path, 'model.onnx', data)
    if not data:
        raise ValueError('model.onnx is empty (zero bytes), not a usable serialization')
    try:
        model = onnx.load_model_from_string(data)
    except Exception as exc:
        raise ValueError(f'model.onnx could not be parsed: {exc}') from exc
    del data
    signature = {'inputs': [_signature(value) for value in model.graph.input],
                 'outputs': [_signature(value) for value in model.graph.output]}
    for name, target in _external_locations(root, model):
        components[name] = _fingerprint(target, name)
    tokenizer = {'vocab_size': None, 'vocab_bound': None, 'model_max_length': None,
                 'word_embedding_bounds': [int(t.dims[0]) for t in model.graph.initializer
                                           if 'word_embeddings' in t.name and len(t.dims) == 2],
                 'position_embedding_bounds': [int(t.dims[0]) for t in model.graph.initializer
                                               if 'position_embeddings' in t.name and len(t.dims) == 2]}
    fixed_width = None
    if labels:
        try:
            _, _, _, fixed_width = _contract(model, labels)
        except ValueError as exc:
            problems.append(('unsupported' if 'unsupported' in str(exc) else 'error', str(exc)))
    if 'tokenizer_config/tokenizer.json' in raw:
        try:
            native = Tokenizer.from_str(raw['tokenizer_config/tokenizer.json'].decode('utf-8'))
            tokenizer['vocab_size'] = len(native.get_vocab(with_added_tokens=True))
        except Exception as exc:  # noqa: BLE001 - Isolate third-party tokenizer failures as explicit location reasons.
            problems.append(('error', f'tokenizer.json could not be loaded: {exc}'))
    if all(name in raw for name in _REQUIRED_COMPONENTS[2:]):
        # The validator consumes private exact copies of the already-fingerprinted bytes.
        with tempfile.TemporaryDirectory(prefix='onnx-status-tokenizer-') as name:
            copied = Path(name).resolve()
            (copied / 'tokenizer_config').mkdir()
            for relative in _REQUIRED_COMPONENTS[2:]:
                (copied / relative).write_bytes(raw[relative])
            try:
                _, _, verified = _native_tokenizer(copied, model, max_length, fixed_width)
                tokenizer.update(verified)
            except ValueError as exc:
                problems.append(('unsupported' if 'unsupported' in str(exc) or 'max_length' in str(exc) else 'error', str(exc)))
    return signature, tokenizer


def inspect_location(repository, source_row, *, max_length=256, threads=2):
    """Inspect one exact inventory row; usable means a loadable adapter, never a score."""
    row = dict(source_row)
    location = row.get('location')
    if type(location) is not str:
        raise ValueError('location must be an exact relative string')
    _inventory_token(location, 'location')
    repository_root = Path(repository).resolve()
    result = {'location': location, 'source_row': row, 'status': 'missing', 'reasons': [],
              'structural_availability': False, 'native_runtime_loaded': False, 'predictions_run': False,
              'scored_benchmarks': False, 'labels': None, 'tokenizer': {'vocab_size': None},
              'declared_signature': None, 'native_signature': None, 'identity': None,
              'observed_recorded_version': None, 'components': [], 'missing_components': [],
              'inspection_scope': 'offline_native_adapter_availability_not_scored_or_policy_certified'}
    components, raw, problems = {}, {}, []
    try:
        root = _confined(repository_root, location)
        directory_present = root.is_dir()
    except (OSError, ValueError) as exc:
        result.update(status='error', reasons=[f'inventory location filesystem check failed: {exc}'],
                      total_component_bytes=0)
        result['inspection_sha256'] = _json_digest(result)
        return result
    if not directory_present:
        result['reasons'] = ['inventory location directory is missing']
        return result
    consumed_names = {'labels.json', 'tokenizer_config/tokenizer.json', 'tokenizer_config/tokenizer_config.json',
                      'calibration.json', 'training_stats.json'}
    try:
        names = set(_component_paths(root, [])) | set(filter(None, row.get('metadata_files', '').split(';')))
        names.update(name for name in ('pytorch_model.bin', 'checkpoint.pt', 'model.onnx.data') if (root / name).is_file())
    except (OSError, ValueError) as exc:
        names = set()
        problems.append(('error', f'component enumeration failed: {exc}'))
    for name in sorted(names):
        try:
            path = _confined(root, name)
            if not path.is_file():
                continue
            if name in consumed_names:
                raw[name] = path.read_bytes()
                components[name] = _fingerprint(path, name, raw[name])
            elif name != 'model.onnx':
                components[name] = _fingerprint(path, name)
        except (OSError, ValueError) as exc:
            problems.append(('error', f'{name}: component inspection failed: {exc}'))
    missing = []
    for name in _REQUIRED_COMPONENTS:
        try:
            if not _confined(root, name).is_file():
                missing.append(name)
        except (OSError, ValueError) as exc:
            problems.append(('error', f'{name}: required component check failed: {exc}'))
    result['missing_components'] = missing
    problems.extend(('missing', f'missing native component: {name}') for name in missing)
    for name in consumed_names & raw.keys():
        try:
            parsed = _json_bytes(raw[name], name)
            if name == 'labels.json': result['labels'] = _labels(parsed)
            if name == 'training_stats.json' and isinstance(parsed, dict): result['observed_recorded_version'] = parsed.get('version')
            if name == 'tokenizer_config/tokenizer.json':
                tokenizer = Tokenizer.from_str(raw[name].decode('utf-8'))
                result['tokenizer']['vocab_size'] = len(tokenizer.get_vocab(with_added_tokens=True))
        except Exception as exc:  # noqa: BLE001 - Preserve per-record JSON/native-tokenizer failure reasons.
            problems.append(('error', str(exc)))
    if 'model.onnx' not in missing:
        try:
            result['declared_signature'], result['tokenizer'] = _declared_metadata(
                root, result['labels'], raw, components, max_length, problems)
        except Exception as exc:  # noqa: BLE001 - Isolate ONNX/metadata inspection failures with explicit reasons.
            problems.append(('missing' if 'missing external weights' in str(exc) else 'error', str(exc)))
    if not problems:
        try:
            with OnnxAdapter(root, max_length=max_length, threads=threads, batch_size=1) as adapter:
                identity = adapter.identity
                result.update(status='usable', structural_availability=True, native_runtime_loaded=True,
                              declared_signature=identity['declared_signature'],
                              native_signature=identity['native_signature'], identity=identity,
                              labels=identity['labels'], tokenizer=identity['tokenizer'])
                components.pop('training_stats.json', None)
                components.update({item['path']: item for item in identity['components']})
                result['observed_recorded_version'] = None
                captured_stats = next((item for item in identity['components'] if item['path'] == 'training_stats.json'), None)
                if captured_stats is not None:
                    assert adapter._snapshot is not None
                    copied = Path(adapter._snapshot.name) / 'training_stats.json'
                    exact = copied.read_bytes()
                    expected = captured_stats['sha256']
                    if hashlib.sha256(exact).hexdigest() != expected:
                        raise ValueError('training_stats.json identity changed during inspection')
                    stats = _json_bytes(exact, 'training_stats.json')
                    result['observed_recorded_version'] = stats.get('version') if isinstance(stats, dict) else None
            problems.append(('usable', 'verified native CPU adapter load/signature/bounds; no predictions or benchmarks run'))
        except Exception as exc:  # noqa: BLE001 - Native load/cleanup failures must become per-location reasons.
            problems.append(('unsupported' if 'unsupported' in str(exc) else 'error', str(exc)))
            result.update(structural_availability=False, native_runtime_loaded=False, native_signature=None, identity=None)
    if any(kind == 'error' for kind, _ in problems): result['status'] = 'error'
    elif any(kind == 'missing' for kind, _ in problems): result['status'] = 'missing'
    elif any(kind == 'unsupported' for kind, _ in problems): result['status'] = 'unsupported'
    result['reasons'] = [reason for _, reason in problems]
    result['components'] = [components[name] for name in sorted(components)]
    result['total_component_bytes'] = sum(item['bytes'] for item in result['components'])
    result['inspection_sha256'] = _json_digest(result)
    return result


def load_inventory(path, *, expected_count=24):
    """Read the exact CSV bytes and retain every row, including legacy copies."""
    data = Path(path).read_bytes()
    reader = csv.DictReader(io.StringIO(data.decode('utf-8'), newline=''))
    rows = list(reader)
    fields = {'location', 'role', 'has_model_onnx', 'model_onnx_bytes', 'has_pytorch_model_bin',
              'has_labels_json', 'recorded_version', 'metadata_files'}
    if reader.fieldnames is None or len(reader.fieldnames) != len(fields) or set(reader.fieldnames) != fields:
        raise ValueError('inventory schema has missing, extra or duplicate CSV headers')
    if type(expected_count) is not int or expected_count < 1:
        raise ValueError('expected_count must be a positive integer')
    if len(rows) != expected_count or len({row.get('location') for row in rows}) != expected_count:
        raise ValueError('inventory location count/duplicates disagree with requested exact count')
    for row in rows:
        if set(row) != fields or any(type(value) is not str for value in row.values()):
            raise ValueError('inventory schema contains missing/extra row cells')
        _inventory_token(row['location'], 'location')
        if not row['role']:
            raise ValueError('inventory role is empty')
        for flag in ('has_model_onnx', 'has_pytorch_model_bin', 'has_labels_json'):
            if row[flag] not in {'True', 'False'}:
                raise ValueError(f'inventory flag {flag} is not exact True/False')
        if row['model_onnx_bytes'] and re.fullmatch(r'[0-9]+', row['model_onnx_bytes']) is None:
            raise ValueError('inventory model_onnx_bytes is not a literal byte count')
        for name in row['metadata_files'].split(';') if row['metadata_files'] else []:
            _inventory_token(name, 'metadata file')
    return {'rows': rows, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def _inventory_token(value, kind):
    parts = value.replace('\\', '/').split('/')
    if (not value or value != value.strip() or PureWindowsPath(value).anchor or ':' in value or '\x00' in value
            or any(part in {'', '.', '..'} for part in parts)):
        raise ValueError(f'inventory {kind} token is unsafe/noncanonical; no repair: {value!r}')


def _records(path):
    if not Path(path).exists():
        return []
    return [_json_bytes(line, f'{path}:{number}') for number, line in
            enumerate(Path(path).read_bytes().splitlines(), 1) if line.strip()]


def append_status_batch(repository, inventory_path, jsonl_path, *, start=0, limit=4,
                        expected_count=24, max_length=256, threads=2):
    """Append each bounded inspection immediately; never hold concurrent sessions."""
    inventory = load_inventory(inventory_path, expected_count=expected_count)
    if type(start) is not int or start < 0 or start >= expected_count or type(limit) is not int or limit < 1:
        raise ValueError('invalid bounded start/limit')
    output = Path(jsonl_path)
    if output.resolve() == Path(inventory_path).resolve():
        raise ValueError('status output must not overwrite the source inventory')
    prior = _records(output)
    if any(record['source_csv_sha256'] != inventory['sha256'] for record in prior):
        raise ValueError('existing status batch uses a different source CSV identity')
    selected = inventory['rows'][start:start + limit]
    if {row['location'] for row in selected} & {record['location'] for record in prior}:
        raise ValueError('duplicate location batch; aggregate or choose an uncollected range')
    output.parent.mkdir(parents=True, exist_ok=True)
    appended = []
    for row in selected:
        result = inspect_location(repository, row, max_length=max_length, threads=threads)
        result['source_csv_sha256'] = inventory['sha256']
        result.pop('inspection_sha256', None)
        result['inspection_sha256'] = _json_digest(result)
        with output.open('a', encoding='utf-8', newline='\n') as handle:
            handle.write(json.dumps(result, sort_keys=True, ensure_ascii=False, allow_nan=False) + '\n')
            handle.flush()
            os.fsync(handle.fileno())
        appended.append(result)
        gc.collect()
    if _json_digest(_records(output)[-len(appended):]) != _json_digest(appended):
        raise ValueError('status batch read-back verification failed')
    return appended


def aggregate_status(inventory_path, jsonl_path, *, expected_count=24, json_path=None, csv_path=None):
    """Re-read, dedupe exact locations, reject conflicting records, and enforce coverage."""
    inventory = load_inventory(inventory_path, expected_count=expected_count)
    requested = {row['location']: row for row in inventory['rows']}
    records = _records(jsonl_path)
    unique = {}
    for record in records:
        location = record.get('location')
        if location not in requested or record.get('source_row') != requested[location]:
            raise ValueError('status location/exact source row disagrees with inventory')
        if record.get('source_csv_sha256') != inventory['sha256']:
            raise ValueError('status source CSV identity disagrees with inventory')
        payload = {key: value for key, value in record.items() if key != 'inspection_sha256'}
        if record.get('inspection_sha256') != _json_digest(payload):
            raise ValueError('status record identity/read-back corruption')
        if location in unique and unique[location] != record:
            raise ValueError('conflicting duplicate location records')
        unique[location] = record
    if set(unique) != set(requested) or len(unique) != expected_count:
        raise ValueError(f'missing inventory locations/count: collected {len(unique)} of {expected_count}')
    ordered = [unique[row['location']] for row in inventory['rows']]
    report = {'schema_version': 1, 'source_csv_sha256': inventory['sha256'], 'source_csv_bytes': inventory['bytes'],
              'summary': {'requested_locations': expected_count, 'collected_records': len(records),
                          'unique_locations': len(unique), 'duplicate_records': len(records) - len(unique),
                          'counts_by_status': dict(Counter(record['status'] for record in ordered)),
                          'locations_are_not_independent_trained_baselines': True,
                          'predictions_run': False, 'scored_benchmarks': False, 'phase2_complete': False,
                          'independently_reviewed': False, 'release_ready': False,
                          'production_trust_gate_compatibility_exercised': False}, 'locations': ordered}
    for path in (json_path, csv_path):
        if path is not None and Path(path).exists():
            raise ValueError(f'refusing to overwrite existing report: {path}')
    if json_path is not None:
        path = Path(json_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf-8') as handle:
            handle.write(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
        if _json_digest(_json_bytes(path.read_bytes(), str(path))) != _json_digest(report):
            raise ValueError('JSON status report read-back failed')
    if csv_path is not None:
        path = Path(csv_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        fields = ['location', 'role', 'status', 'reasons', 'recorded_version', 'observed_recorded_version',
                  'total_component_bytes', 'components', 'declared_signature', 'native_signature', 'labels',
                  'tokenizer', 'scored_benchmarks', 'source_csv_sha256']
        expected_csv = [fields]
        with path.open('x', encoding='utf-8', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            for record in ordered:
                flat = {key: record.get(key) for key in fields}
                flat.update(role=record['source_row']['role'], recorded_version=record['source_row']['recorded_version'])
                for key in ('reasons', 'components', 'declared_signature', 'native_signature', 'labels', 'tokenizer',
                            'observed_recorded_version'):
                    flat[key] = json.dumps(record[key], ensure_ascii=False, sort_keys=True, allow_nan=False)
                # Mirror the existing CSV writer contract after typed JSON projection.
                expected_csv.append(['' if flat[key] is None else str(flat[key]) for key in fields])
                writer.writerow(flat)
        try:
            with path.open(encoding='utf-8', newline='') as handle:
                saved = list(csv.reader(handle, strict=True))
        except (csv.Error, UnicodeError) as exc:
            raise ValueError('CSV status report exact projection/provenance read-back failed') from exc
        if saved != expected_csv:
            raise ValueError('CSV status report exact projection/provenance read-back failed')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    batch = commands.add_parser('batch', help='append a bounded sequential availability batch; no predictions')
    batch.add_argument('--repository', required=True)
    batch.add_argument('--start', type=int, default=0)
    batch.add_argument('--limit', type=int, default=4)
    batch.add_argument('--max-length', type=int, default=256)
    batch.add_argument('--threads', type=int, default=2)
    aggregate = commands.add_parser('aggregate', help='re-read and verify exact location coverage')
    aggregate.add_argument('--json', required=True)
    aggregate.add_argument('--csv', required=True)
    for command in (batch, aggregate):
        command.add_argument('--inventory', required=True)
        command.add_argument('--jsonl', required=True)
        command.add_argument('--expected-count', type=int, default=24)
    args = parser.parse_args(argv)
    try:
        if args.command == 'batch':
            records = append_status_batch(args.repository, args.inventory, args.jsonl, start=args.start,
                                          limit=args.limit, expected_count=args.expected_count,
                                          max_length=args.max_length, threads=args.threads)
            print(json.dumps({'appended': len(records), 'locations': [
                {'location': record['location'], 'status': record['status'], 'reasons': record['reasons']}
                for record in records]}, ensure_ascii=True, allow_nan=False))
        else:
            report = aggregate_status(args.inventory, args.jsonl, expected_count=args.expected_count,
                                      json_path=args.json, csv_path=args.csv)
            print(json.dumps(report['summary'], sort_keys=True, allow_nan=False))
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
