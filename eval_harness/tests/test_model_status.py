"""Offline structural status tests use UNIT-ONLY generated bundles, never datasets."""
from __future__ import annotations

import hashlib
import importlib
import importlib.util
import json
import tempfile
from pathlib import Path

import pytest
from onnx import TensorProto

from eval_harness.tests.test_inference import SCRATCH, _signature_fixture, _unit_bundle


def _status_module():
    assert importlib.util.find_spec('eval_harness.model_status') is not None, 'Offline status inspection is not implemented'
    return importlib.import_module('eval_harness.model_status')


def _row(location, role='unit_only'):
    return {'location': location, 'role': role, 'has_model_onnx': 'True', 'model_onnx_bytes': 'recorded_not_fresh',
            'has_pytorch_model_bin': 'False', 'has_labels_json': 'True', 'recorded_version': 'v14-not-renamed',
            'metadata_files': 'model.onnx;labels.json'}


@pytest.fixture
def directory():
    with tempfile.TemporaryDirectory(prefix='onnx-status-unit-', dir=SCRATCH) as name:
        yield _unit_bundle(Path(name) / 'unit-bundle')


@pytest.mark.parametrize('condition', ['usable', 'missing', 'unsupported', 'error'])
def test_inspection_reports_honest_structural_state_with_exact_row_and_component_hashes(directory, condition):
    if condition == 'missing':
        (directory / 'model.onnx').unlink()
    elif condition == 'unsupported':
        _signature_fixture(directory, names=('inputs_embeds', 'attention_mask'),
                           dtype=TensorProto.FLOAT, shape=('batch', 'sequence', 384))
    elif condition == 'error':
        (directory / 'model.onnx').write_bytes(b'')
    row = _row(directory.name)
    result = _status_module().inspect_location(directory.parent, row, max_length=8, threads=1)
    assert result['location'] == row['location'] and result['source_row'] == row
    assert result['status'] == condition and result['reasons']
    assert result['structural_availability'] is (condition == 'usable')
    assert result['predictions_run'] is result['scored_benchmarks'] is False
    assert result['labels'] == ['ALERT', 'CLEAR']
    assert result['tokenizer']['vocab_size'] == 6
    for component in result['components']:
        path = directory / component['path']
        assert component['sha256'] == hashlib.sha256(path.read_bytes()).hexdigest()
        assert component['bytes'] == path.stat().st_size
    assert result['observed_recorded_version'] is None
    assert result['source_row']['recorded_version'] == 'v14-not-renamed'
    if condition == 'usable':
        assert result['native_runtime_loaded'] is True
        assert result['native_signature']['outputs'] == [
            {'name': 'logits', 'dtype': 'tensor(float)', 'shape': ['batch', 2]}]
        assert result['tokenizer']['vocab_bound'] == 6
        assert result['identity']['composite_sha256']
    elif condition == 'unsupported':
        assert result['declared_signature']['inputs'][0]['name'] == 'inputs_embeds'
        assert result['native_runtime_loaded'] is False and result['identity'] is None
    json.dumps(result, allow_nan=False)


def test_inventory_batches_are_durable_re_read_and_counted_as_locations_not_trained_baselines(directory):
    import csv
    import shutil

    clone = directory.parent / 'legacy-copy'
    shutil.copytree(directory, clone)
    rows = [_row(directory.name, 'primary_unit_only'), _row(clone.name, 'duplicate_legacy_worktree')]
    for row in rows:
        row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'inventory.csv'
    with inventory.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    module = _status_module()
    jsonl = directory.parent / 'status.jsonl'
    assert len(module.append_status_batch(directory.parent, inventory, jsonl, start=0, limit=1,
                                         expected_count=2, max_length=8, threads=1)) == 1
    assert len(jsonl.read_text(encoding='utf-8').splitlines()) == 1
    assert len(module.append_status_batch(directory.parent, inventory, jsonl, start=1, limit=1,
                                         expected_count=2, max_length=8, threads=1)) == 1
    report_json, report_csv = directory.parent / 'report.json', directory.parent / 'report.csv'
    report = module.aggregate_status(inventory, jsonl, expected_count=2, json_path=report_json, csv_path=report_csv)
    assert report['summary']['requested_locations'] == report['summary']['unique_locations'] == 2
    assert report['summary']['collected_records'] == 2 and report['summary']['duplicate_records'] == 0
    assert report['summary']['counts_by_status'] == {'usable': 2}
    assert [record['location'] for record in report['locations']] == [row['location'] for row in rows]
    assert report['locations'][0]['identity']['bundle_sha256'] == report['locations'][1]['identity']['bundle_sha256']
    assert report['summary']['locations_are_not_independent_trained_baselines'] is True
    assert report['summary']['predictions_run'] is report['summary']['scored_benchmarks'] is False
    assert json.loads(report_json.read_text(encoding='utf-8')) == report
    with report_csv.open(newline='', encoding='utf-8') as handle:
        saved = list(csv.DictReader(handle))
    assert [row['location'] for row in saved] == [row['location'] for row in rows]
    assert all(row['scored_benchmarks'] == 'False' for row in saved)


@pytest.mark.parametrize('malformed', ['dot_location', 'traversal', 'absolute', 'empty_location',
    'invalid_flag', 'invalid_bytes', 'duplicate_header', 'missing_header', 'extra_header'])
def test_csv_row_tokens_and_schema_are_validated_without_repair_before_inspection(directory, malformed):
    import csv

    row = _row(directory.name)
    row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    fields = list(row)
    if malformed == 'dot_location': row['location'] += '/./'
    if malformed == 'traversal': row['location'] = '../outside'
    if malformed == 'absolute': row['location'] = 'C:/outside'
    if malformed == 'empty_location': row['location'] = ''
    if malformed == 'invalid_flag': row['has_model_onnx'] = 'true'
    if malformed == 'invalid_bytes': row['model_onnx_bytes'] = 'not-a-byte-count'
    if malformed == 'duplicate_header': fields.append('location')
    if malformed == 'missing_header': fields.remove('role'); row.pop('role')
    if malformed == 'extra_header': fields.append('unapproved'); row['unapproved'] = 'value'
    path = directory.parent / 'malformed.csv'
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(row)
    original = path.read_bytes()
    with pytest.raises(ValueError, match='inventory|location|schema|flag|bytes'):
        _status_module().load_inventory(path, expected_count=1)
    assert path.read_bytes() == original


def test_offline_cli_executes_bounded_batch_and_verified_aggregate(directory):
    import csv

    row = _row(directory.name)
    row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'cli-inventory.csv'
    with inventory.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    jsonl = directory.parent / 'cli-status.jsonl'
    report_json, report_csv = directory.parent / 'cli-report.json', directory.parent / 'cli-report.csv'
    module = _status_module()
    assert module.main(['batch', '--repository', str(directory.parent), '--inventory', str(inventory),
                        '--jsonl', str(jsonl), '--start', '0', '--limit', '1', '--expected-count', '1',
                        '--max-length', '8', '--threads', '1']) == 0
    assert module.main(['aggregate', '--inventory', str(inventory), '--jsonl', str(jsonl),
                        '--json', str(report_json), '--csv', str(report_csv), '--expected-count', '1']) == 0
    saved = json.loads(report_json.read_text(encoding='utf-8'))
    assert saved['summary']['unique_locations'] == 1 and saved['summary']['scored_benchmarks'] is False
    assert report_csv.exists()


def test_usable_signatures_bind_the_real_bundle_captured_after_preliminary_inspection(directory, monkeypatch):
    import weakref

    from eval_harness import inference
    from eval_harness.tests.test_inference import _native_input_contract

    model_b = _unit_bundle(directory.parent / 'model-b')
    _native_input_contract(model_b, {'input_ids': TensorProto.INT32, 'attention_mask': TensorProto.INT32})
    (directory / 'training_stats.json').write_text('{"version":"vA-raw-unchanged"}', encoding='utf-8')
    (model_b / 'training_stats.json').write_text('{"version":"vB-raw-unchanged"}', encoding='utf-8')
    (directory / 'inspection-only.txt').write_text('UNIT-ONLY inspection provenance', encoding='utf-8')
    with inference.OnnxAdapter(directory, max_length=8, threads=1) as adapter:
        identity_a = adapter.identity
    with inference.OnnxAdapter(model_b, max_length=8, threads=1) as adapter:
        identity_b = adapter.identity
    assert {item['dtype'] for item in identity_a['declared_signature']['inputs']} == {'INT64'}
    assert {item['dtype'] for item in identity_b['declared_signature']['inputs']} == {'INT32'}
    bytes_b = (model_b / 'model.onnx').read_bytes()
    hash_b = hashlib.sha256(bytes_b).hexdigest()
    module = _status_module()
    declare = module._declared_metadata
    capture = inference._capture_bundle
    native = inference.ort.InferenceSession
    preliminary, captured_roots, captured_hashes, consumers = [], [], [], []

    def inspect_a_then_replace(root, labels, raw, components, max_length, problems):
        declared = declare(root, labels, raw, components, max_length, problems)
        preliminary.append((declared[0], components['model.onnx'].copy()))
        (directory / 'model.onnx').write_bytes(bytes_b)
        (directory / 'training_stats.json').write_bytes((model_b / 'training_stats.json').read_bytes())
        return declared

    def capture_b(root):
        temporary, hashes = capture(root)
        captured_roots.append(Path(temporary.name))
        captured_hashes.append(hashes['model.onnx'][0])
        return temporary, hashes

    def load_real_session(path, *args, **kwargs):
        session = native(path, *args, **kwargs)
        consumers.append(weakref.ref(session))
        return session

    monkeypatch.setattr(module, '_declared_metadata', inspect_a_then_replace)
    monkeypatch.setattr(inference, '_capture_bundle', capture_b)
    monkeypatch.setattr(inference.ort, 'InferenceSession', load_real_session)
    row = _row(directory.name)
    row['metadata_files'] += ';inspection-only.txt'
    result = module.inspect_location(directory.parent, row, max_length=8, threads=1)
    assert len(preliminary) == len(captured_roots) == len(consumers) == 1
    assert preliminary[0][0] == identity_a['declared_signature']
    assert preliminary[0][1]['sha256'] != hash_b
    assert preliminary[0][1]['consumption'] == 'inspection_only'
    assert captured_hashes == [hash_b]
    assert all(not root.exists() for root in captured_roots)
    assert all(reference() is None for reference in consumers)
    assert result['status'] == 'usable' and result['native_runtime_loaded'] is True
    assert result['source_row'] == row
    assert result['source_row']['recorded_version'] == 'v14-not-renamed'
    assert result['source_row']['model_onnx_bytes'] == 'recorded_not_fresh'
    assert result['observed_recorded_version'] == 'vB-raw-unchanged'
    assert result['predictions_run'] is result['scored_benchmarks'] is False
    identity = result['identity']
    assert identity['declared_signature'] == identity_b['declared_signature']
    assert identity['native_signature'] == identity_b['native_signature']
    assert result['native_signature'] == identity['native_signature']
    assert result['labels'] == identity['labels'] and result['tokenizer'] == identity['tokenizer']
    components = {item['path']: item for item in result['components']}
    assert components['model.onnx']['sha256'] == hash_b
    assert components['inspection-only.txt']['consumption'] == 'inspection_only'
    assert components['inspection-only.txt']['sha256'] == hashlib.sha256((directory / 'inspection-only.txt').read_bytes()).hexdigest()
    assert all(components[item['path']] == item for item in identity['components'])
    payload = {key: value for key, value in result.items() if key != 'inspection_sha256'}
    assert result['inspection_sha256'] == inference._json_digest(payload)
    assert result['declared_signature'] == identity['declared_signature']


@pytest.mark.parametrize('kind', ['json', 'csv'])
def test_report_creation_race_preserves_real_sentinel_before_teardown_without_success(directory, monkeypatch, kind):
    import csv
    import threading

    module = _status_module()
    row = _row(directory.name)
    row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'race-inventory.csv'
    with inventory.open('x', newline='', encoding='utf-8') as handle:
        csv_writer = csv.DictWriter(handle, fieldnames=list(row))
        csv_writer.writeheader()
        csv_writer.writerow(row)
    jsonl = directory.parent / 'race-status.jsonl'
    module.append_status_batch(directory.parent, inventory, jsonl, limit=1, expected_count=1, max_length=8, threads=1)
    inputs = {path.name: path.read_bytes() for path in (inventory, jsonl)}
    target = directory.parent / f'raced-report.{kind}'
    sentinel = b'UNIT_ONLY protected concurrent-writer sentinel\r\n'
    begin, created = threading.Event(), threading.Event()
    writer_errors, boundary = [], []
    real_exists = Path.exists

    def concurrent_writer():
        try:
            if not begin.wait(5):
                raise RuntimeError('report existence boundary was not reached')
            with target.open('xb') as handle:
                handle.write(sentinel)
        except (OSError, RuntimeError) as exc:
            writer_errors.append(str(exc))
        finally:
            created.set()

    def exists_before_real_concurrent_creation(self):
        existed = real_exists(self)
        if self == target and not existed and not boundary:
            boundary.append(existed)
            begin.set()
            assert created.wait(5), 'concurrent writer did not finish before report creation'
            assert not writer_errors, writer_errors
        return existed

    thread = threading.Thread(target=concurrent_writer, name=f'unit-only-{kind}-report-writer')
    thread.start()
    monkeypatch.setattr(Path, 'exists', exists_before_real_concurrent_creation)
    returned, rejection = None, None
    try:
        returned = module.aggregate_status(inventory, jsonl, expected_count=1, **{f'{kind}_path': target})
    except (OSError, ValueError) as exc:
        rejection = exc
    finally:
        thread.join(5)
    # Read the actual protected file before ANY failing assertion or fixture cleanup.
    actual = target.read_bytes()
    assert not thread.is_alive() and not writer_errors
    assert boundary == [False]
    assert {path.name: path.read_bytes() for path in (inventory, jsonl)} == inputs
    assert actual == sentinel, 'report overwrote the real concurrent-created destination before teardown'
    assert returned is None, 'no-overwrite race must not return a successful report'
    assert isinstance(rejection, FileExistsError)



def _cycle2_inventory_pair(directory):
    """Two tiny native UNIT-ONLY bundles, with a valid exact CSV for row isolation."""
    import csv

    later = _unit_bundle(directory.parent / 'later-unit-bundle')
    rows = [_row(directory.name), _row(later.name)]
    for row in rows:
        row['model_onnx_bytes'] = str((directory.parent / row['location'] / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'cycle2-inventory.csv'
    with inventory.open('x', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return inventory, directory.parent / 'cycle2-status.jsonl', rows


def test_location_labels_read_failure_is_a_durable_error_before_the_next_native_row(directory, monkeypatch):
    """UNIT-ONLY filesystem fault injection; the following row loads real tiny ORT."""
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    real_read = Path.read_bytes
    rejected = []

    def denied_labels(self):
        if self == directory / 'labels.json':
            rejected.append(self)
            raise PermissionError('UNIT-ONLY denied labels read')
        return real_read(self)

    monkeypatch.setattr(Path, 'read_bytes', denied_labels)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert rejected == [directory / 'labels.json']
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == ['labels.json: component inspection failed: UNIT-ONLY denied labels read']
    assert records[0]['identity'] is None and records[0]['native_runtime_loaded'] is False
    assert records[1]['identity'] is not None and records[1]['native_runtime_loaded'] is True
    assert [record['source_row'] for record in records] == rows
    assert module._records(jsonl) == records
    report = module.aggregate_status(inventory, jsonl, expected_count=2)
    assert [record['location'] for record in report['locations']] == [row['location'] for row in rows]
    assert report['summary']['counts_by_status'] == {'error': 1, 'usable': 1}
    assert report['summary']['release_ready'] is False


def test_location_component_enumeration_failure_does_not_skip_later_inventory_rows(directory, monkeypatch):
    """UNIT-ONLY enumeration fault; later row still uses native tokenizers and ORT."""
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    enumerate_components = module._component_paths
    rejected = []

    def denied_enumeration(root, external):
        if root == directory:
            rejected.append(root)
            raise PermissionError('UNIT-ONLY denied component enumeration')
        return enumerate_components(root, external)

    monkeypatch.setattr(module, '_component_paths', denied_enumeration)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert rejected == [directory]
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == ['component enumeration failed: UNIT-ONLY denied component enumeration']
    assert records[0]['native_runtime_loaded'] is False and records[0]['identity'] is None
    assert records[1]['native_runtime_loaded'] is True and records[1]['identity'] is not None
    assert [record['source_row'] for record in module._records(jsonl)] == rows
    assert module.aggregate_status(inventory, jsonl, expected_count=2)['summary']['unique_locations'] == 2


def test_required_component_confinement_failure_stays_an_error_record_with_next_row_coverage(directory, monkeypatch):
    """UNIT-ONLY confinement rejection injection; no unsafe path is opened or repaired."""
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    confined = module._confined
    diagnostic = "out-of-directory external/bundle reference 'labels.json'"
    rejected = []

    def rejected_labels(root, location):
        if root == directory and location == 'labels.json':
            rejected.append(location)
            raise ValueError(diagnostic)
        return confined(root, location)

    monkeypatch.setattr(module, '_confined', rejected_labels)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert rejected == ['labels.json', 'labels.json']
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == [f'labels.json: component inspection failed: {diagnostic}',
                                      f'labels.json: required component check failed: {diagnostic}']
    assert records[0]['native_runtime_loaded'] is False and records[0]['identity'] is None
    assert [record['source_row'] for record in module._records(jsonl)] == rows
    assert module.aggregate_status(inventory, jsonl, expected_count=2)['summary']['unique_locations'] == 2


@pytest.mark.parametrize('operation', ['resolve', 'is_dir'])
def test_location_directory_filesystem_failure_is_isolated_from_the_next_selected_row(directory, monkeypatch, operation):
    """UNIT-ONLY native-path access faults, without modifying any ACL or original."""
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    real_operation = getattr(Path, operation)
    rejected = []
    diagnostic = f'UNIT-ONLY denied location {operation}'

    def denied_location(self, *args, **kwargs):
        if self == directory:
            rejected.append(self)
            raise PermissionError(diagnostic)
        return real_operation(self, *args, **kwargs)

    monkeypatch.setattr(Path, operation, denied_location)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert rejected == [directory]
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == [f'inventory location filesystem check failed: {diagnostic}']
    assert records[0]['identity'] is None and records[0]['total_component_bytes'] == 0
    assert records[1]['native_runtime_loaded'] is True
    assert [record['source_row'] for record in module._records(jsonl)] == rows
    assert module.aggregate_status(inventory, jsonl, expected_count=2)['summary']['unique_locations'] == 2


@pytest.mark.parametrize('component', ['calibration.json', 'training_stats.json',
                                       'checkpoint.pt', 'tokenizer_config/inspection-only.txt'])
def test_component_read_or_fingerprint_fault_preserves_the_exact_error_and_next_row(directory, monkeypatch, component):
    """Additional GREEN controls for UNIT-ONLY reads/fingerprints; never deserialize weights."""
    target = directory / component
    target.write_bytes(b'{"version":"unit-only raw version"}')
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    real_open = Path.open
    rejected = []

    def denied_component(self, mode='r', *args, **kwargs):
        if self == target and mode == 'rb':
            rejected.append(self)
            raise PermissionError('UNIT-ONLY denied component bytes')
        return real_open(self, mode, *args, **kwargs)

    monkeypatch.setattr(Path, 'open', denied_component)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert rejected == [target]
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == [f'{component}: component inspection failed: UNIT-ONLY denied component bytes']
    assert component not in {item['path'] for item in records[0]['components']}
    assert records[0]['identity'] is None and records[1]['native_runtime_loaded'] is True
    assert [record['source_row'] for record in module._records(jsonl)] == rows
    assert module.aggregate_status(inventory, jsonl, expected_count=2)['summary']['unique_locations'] == 2


@pytest.mark.parametrize('location', ['../outside', '/absolute', 'C:drive-relative', '', None])
def test_top_level_invalid_location_rejection_is_not_converted_to_a_location_record(directory, location):
    """GREEN safety control: a caller's invalid top-level path remains a hard rejection."""
    with pytest.raises(ValueError, match='location|unsafe external/bundle reference'):
        _status_module().inspect_location(directory.parent, _row(location), max_length=8, threads=1)


def test_missing_location_directory_keeps_its_exact_missing_reason(directory, monkeypatch):
    """GREEN control of the existing missing-directory contract, without ORT loading."""
    module = _status_module()

    def forbidden(*args, **kwargs):
        pytest.fail('A missing inventory directory reached the native adapter')

    monkeypatch.setattr(module, 'OnnxAdapter', forbidden)
    row = _row('absent-unit-only-location')
    result = module.inspect_location(directory.parent, row, max_length=8, threads=1)
    assert result['status'] == 'missing'
    assert result['source_row'] == row and result['reasons'] == ['inventory location directory is missing']
    assert result['native_runtime_loaded'] is False and result['identity'] is None


def test_invalid_metadata_inventory_is_rejected_before_batch_inspection_or_publication(directory, monkeypatch):
    """GREEN exact-inventory control: no blanket per-row swallowing of source CSV errors."""
    import csv

    module = _status_module()
    row = _row(directory.name)
    row.update(model_onnx_bytes='0', metadata_files='labels.json;../outside.txt')
    inventory = directory.parent / 'invalid-metadata-inventory.csv'
    with inventory.open('x', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    original = inventory.read_bytes()
    jsonl = directory.parent / 'invalid-metadata-status.jsonl'

    def forbidden(*args, **kwargs):
        pytest.fail('Invalid top-level inventory reached per-location inspection')

    monkeypatch.setattr(module, 'inspect_location', forbidden)
    with pytest.raises(ValueError, match='inventory metadata file token is unsafe/noncanonical'):
        module.append_status_batch(directory.parent, inventory, jsonl, limit=1, expected_count=1)
    assert not jsonl.exists() and inventory.read_bytes() == original


@pytest.mark.parametrize(('transition', 'initially_present', 'captured_present'), [
    ('appears', False, True), ('disappears', True, False)])
def test_observed_version_presence_is_bound_to_captured_sidecar_not_preliminary_membership(
        directory, monkeypatch, transition, initially_present, captured_present):
    """UNIT-ONLY capture-boundary source race; loading/tokenization use actual native bytes."""
    from eval_harness import inference

    module = _status_module()
    sidecar = directory / 'training_stats.json'
    exact_version = ' v14 UNIT-ONLY / exact version \u03b1 '
    captured_bytes = json.dumps({'version': exact_version}, ensure_ascii=False).encode('utf-8') + b'\n'
    if initially_present:
        sidecar.write_bytes(b'{"version":"preliminary-only-version"}')
    declare = module._declared_metadata
    capture = inference._capture_bundle
    preliminary, roots, captured_hashes = [], [], []

    def change_presence_before_capture(root, labels, raw, components, max_length, problems):
        declared = declare(root, labels, raw, components, max_length, problems)
        preliminary.append('training_stats.json' in raw)
        if transition == 'appears':
            sidecar.write_bytes(captured_bytes)
        else:
            sidecar.unlink()
        return declared

    def record_capture_then_change_source(root):
        temporary, hashes = capture(root)
        roots.append(Path(temporary.name))
        captured_hashes.append(hashes.get('training_stats.json'))
        sidecar.write_bytes(b'{"version":"source-after-private-capture"}')
        return temporary, hashes

    monkeypatch.setattr(module, '_declared_metadata', change_presence_before_capture)
    monkeypatch.setattr(inference, '_capture_bundle', record_capture_then_change_source)
    row = _row(directory.name)
    result = module.inspect_location(directory.parent, row, max_length=8, threads=1)
    assert preliminary == [initially_present]
    assert len(roots) == 1 and not roots[0].exists()
    assert result['status'] == 'usable', result['reasons']
    assert result['source_row'] == row and result['source_row']['recorded_version'] == 'v14-not-renamed'
    assert result['native_runtime_loaded'] is True and result['predictions_run'] is result['scored_benchmarks'] is False
    identity = result['identity']
    components = {item['path']: item for item in result['components']}
    captured = {item['path']: item for item in identity['components']}
    assert ('training_stats.json' in captured) is captured_present
    assert ('training_stats.json' in components) is captured_present
    assert ('training_stats.json' in identity['absent_components']) is (not captured_present)
    assert result['observed_recorded_version'] == (exact_version if captured_present else None)
    if captured_present:
        assert captured_hashes == [(hashlib.sha256(captured_bytes).hexdigest(), len(captured_bytes))]
        assert components['training_stats.json'] == captured['training_stats.json']
    else:
        assert captured_hashes == [None]


def test_safe_inventory_location_resolving_outside_is_a_confined_error_record_not_a_skipped_row(directory, monkeypatch):
    """UNIT-ONLY resolution substitution models a location-specific link escape without ACL changes."""
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    module = _status_module()
    resolve = Path.resolve
    outside = directory.parent.parent / 'unit-only-not-opened-outside'
    observed = []

    def substituted_resolution(self, *args, **kwargs):
        if self == directory:
            observed.append(self)
            return outside
        return resolve(self, *args, **kwargs)

    monkeypatch.setattr(Path, 'resolve', substituted_resolution)
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert observed == [directory]
    assert [record['status'] for record in records] == ['error', 'usable']
    assert records[0]['reasons'] == [
        f"inventory location filesystem check failed: out-of-directory external/bundle reference {directory.name!r}"]
    assert records[0]['identity'] is None and records[0]['native_runtime_loaded'] is False
    assert records[1]['identity'] is not None and records[1]['native_runtime_loaded'] is True
    assert [record['source_row'] for record in module._records(jsonl)] == rows
    assert module.aggregate_status(inventory, jsonl, expected_count=2)['summary']['unique_locations'] == 2


def test_recorded_version_rejects_snapshot_bytes_that_no_longer_match_captured_identity(directory, monkeypatch):
    """GREEN UNIT-ONLY private-sidecar substitution after a real native adapter loads."""
    module = _status_module()
    source = directory / 'training_stats.json'
    original = b'{"version":"v14 exact source version"}'
    source.write_bytes(original)
    native_adapter = module.OnnxAdapter
    roots = []

    def changed_verified_sidecar(*args, **kwargs):
        adapter = native_adapter(*args, **kwargs)
        root = Path(adapter._snapshot.name)
        roots.append(root)
        copied = root / 'training_stats.json'
        copied.write_bytes(copied.read_bytes() + b'\n')
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', changed_verified_sidecar)
    result = module.inspect_location(directory.parent, _row(directory.name), max_length=8, threads=1)
    assert source.read_bytes() == original
    assert len(roots) == 1 and not roots[0].exists()
    assert result['status'] == 'error'
    assert result['reasons'] == ['training_stats.json identity changed during inspection']
    assert result['identity'] is None and result['native_runtime_loaded'] is result['structural_availability'] is False
    assert result['observed_recorded_version'] is None


def test_location_isolation_does_not_swallow_unexpected_programming_failures(directory, monkeypatch):
    """GREEN UNIT-ONLY unexpected-runtime fault, outside the scoped filesystem exception types."""
    module = _status_module()

    def unexpected(*args, **kwargs):
        raise RuntimeError('UNIT-ONLY unexpected enumeration programming failure')

    monkeypatch.setattr(module, '_component_paths', unexpected)
    with pytest.raises(RuntimeError, match='UNIT-ONLY unexpected enumeration programming failure'):
        module.inspect_location(directory.parent, _row(directory.name), max_length=8, threads=1)


def _manual_unicode_sources(directory, rows):
    """Retain exact tiny UNIT-ONLY fixture bytes, not model/checkpoint evidence."""
    return {(row['location'], path.relative_to(directory.parent / row['location']).as_posix()): path.read_bytes()
            for row in rows for path in (directory.parent / row['location']).rglob('*') if path.is_file()}


def _assert_manual_unicode_batch(directory, inventory, jsonl, rows, records, sources,
                                 exact_version, *, captured_first_stats=None):
    """Check actual row isolation, UTF-8 digests and complete durable readbacks."""
    import csv
    import io
    import os

    module = _status_module()

    def canonical(value):
        return json.dumps(value, sort_keys=True, separators=(',', ':'),
                          ensure_ascii=False, allow_nan=False).encode('utf-8')

    assert [record['location'] for record in records] == [row['location'] for row in rows]
    assert [record['status'] for record in records] == ['error', 'usable']
    assert canonical([record['source_row'] for record in records]) == canonical(rows)
    first, later = records
    assert first['reasons'] == ['training_stats.json: decoded metadata contains a non-scalar Unicode string']
    assert first['observed_recorded_version'] is None
    assert first['identity'] is None and first['native_signature'] is None
    assert first['native_runtime_loaded'] is first['structural_availability'] is False
    assert later['native_runtime_loaded'] is later['structural_availability'] is True
    assert later['identity'] is not None and later['native_signature'] == later['identity']['native_signature']
    assert canonical(later['observed_recorded_version']) == canonical(exact_version)
    assert type(later['observed_recorded_version']) is type(exact_version)
    for record in records:
        assert record['predictions_run'] is record['scored_benchmarks'] is False
        assert record['source_row']['recorded_version'] == 'v14-not-renamed'
        assert record['source_csv_sha256'] == hashlib.sha256(inventory.read_bytes()).hexdigest()
        payload = {key: value for key, value in record.items() if key != 'inspection_sha256'}
        assert record['inspection_sha256'] == hashlib.sha256(canonical(payload)).hexdigest()
        assert len(record['inspection_sha256']) == 64
        assert {item['path'] for item in record['components']} == {
            relative for location, relative in sources if location == record['location']}
        for item in record['components']:
            exact = (captured_first_stats if record is first and item['path'] == 'training_stats.json'
                     and captured_first_stats is not None else sources[(record['location'], item['path'])])
            assert item['sha256'] == hashlib.sha256(exact).hexdigest()
            assert item['bytes'] == len(exact)
    assert _manual_unicode_sources(directory, rows) == sources
    assert {key: hashlib.sha256(value).hexdigest() for key, value in _manual_unicode_sources(directory, rows).items()} == {
        key: hashlib.sha256(value).hexdigest() for key, value in sources.items()}
    assert canonical(module._records(jsonl)) == canonical(records)
    expected_jsonl = b''.join(json.dumps(record, sort_keys=True, ensure_ascii=False, allow_nan=False).encode('utf-8')
                              + b'\n' for record in records)
    assert jsonl.read_bytes() == expected_jsonl
    report_json = directory.parent / 'manual-unicode-report.json'
    report_csv = directory.parent / 'manual-unicode-report.csv'
    report = module.aggregate_status(inventory, jsonl, expected_count=2, json_path=report_json, csv_path=report_csv)
    assert canonical(report['locations']) == canonical(records)
    assert report['summary']['counts_by_status'] == {'error': 1, 'usable': 1}
    assert report['summary']['unique_locations'] == report['summary']['collected_records'] == 2
    assert report['summary']['duplicate_records'] == 0
    assert report['summary']['predictions_run'] is report['summary']['scored_benchmarks'] is False
    assert report['summary']['release_ready'] is report['summary']['independently_reviewed'] is False
    expected_json = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
    assert report_json.read_bytes() == expected_json.replace('\n', os.linesep).encode('utf-8')
    assert canonical(json.loads(report_json.read_bytes())) == canonical(report)
    fields = ['location', 'role', 'status', 'reasons', 'recorded_version', 'observed_recorded_version',
              'total_component_bytes', 'components', 'declared_signature', 'native_signature', 'labels',
              'tokenizer', 'scored_benchmarks', 'source_csv_sha256']
    expected_csv = io.StringIO(newline='')
    writer = csv.DictWriter(expected_csv, fieldnames=fields)
    writer.writeheader()
    expected_rows = []
    for record in records:
        flat = {key: record.get(key) for key in fields}
        flat.update(role=record['source_row']['role'], recorded_version=record['source_row']['recorded_version'])
        for key in ('reasons', 'components', 'declared_signature', 'native_signature', 'labels', 'tokenizer',
                    'observed_recorded_version'):
            flat[key] = json.dumps(record[key], ensure_ascii=False, sort_keys=True, allow_nan=False)
        writer.writerow(flat)
        expected_rows.append({key: '' if value is None else str(value) for key, value in flat.items()})
    assert report_csv.read_bytes() == expected_csv.getvalue().encode('utf-8')
    with report_csv.open(newline='', encoding='utf-8') as handle:
        assert list(csv.DictReader(handle)) == expected_rows
    assert _manual_unicode_sources(directory, rows) == sources


def test_escaped_surrogate_version_is_a_durable_metadata_error_before_the_next_native_row(directory, monkeypatch):
    """UNIT-ONLY RED seam: decoded invalid version must not abort the two-row batch."""
    invalid = b'{"version":"\\ud800"}\r\n'
    positive = b'{"version":" UNIT-ONLY \\ud83e\\udded e\\u0301 / \\ud83d\\ude00 v14 "}\r\n'
    exact_version = ' UNIT-ONLY \U0001f9ed e\u0301 / \U0001f600 v14 '
    (directory / 'training_stats.json').write_bytes(invalid)
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    later = directory.parent / rows[1]['location']
    (later / 'training_stats.json').write_bytes(positive)
    sources = _manual_unicode_sources(directory, rows)
    inventory_bytes = inventory.read_bytes()
    module = _status_module()
    native_adapter = module.OnnxAdapter
    loaded, snapshots = [], []

    def record_real_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        snapshots.append(Path(adapter._snapshot.name))
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', record_real_native_load)
    records = module.append_status_batch(directory.parent, inventory, jsonl, start=0, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert loaded == [later], 'invalid preliminary metadata must reject before native load; later row must actually load'
    assert len(snapshots) == 1 and snapshots[0].is_relative_to(SCRATCH) and not snapshots[0].exists()
    assert inventory.read_bytes() == inventory_bytes
    assert records[0]['components'][next(index for index, item in enumerate(records[0]['components'])
                                       if item['path'] == 'training_stats.json')]['consumption'] == 'inspection_only'
    _assert_manual_unicode_batch(directory, inventory, jsonl, rows, records, sources, exact_version)


def test_captured_surrogate_version_keeps_verified_byte_provenance_as_an_isolated_metadata_error(directory, monkeypatch):
    """Already-GREEN shared-boundary coverage: real UNIT-ONLY capture, not fabricated identity."""
    from eval_harness import inference

    initial = b'{"version":"preliminary exact e\\u0301"}\n'
    invalid = b'{"version":"\\udfff"}\r\n'
    positive = b'{"version":" \\ud83d\\ude80 e\\u0301 exact "}\n'
    exact_version = ' \U0001f680 e\u0301 exact '
    source = directory / 'training_stats.json'
    source.write_bytes(initial)
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    later = directory.parent / rows[1]['location']
    (later / 'training_stats.json').write_bytes(positive)
    sources = _manual_unicode_sources(directory, rows)
    inventory_bytes = inventory.read_bytes()
    module = _status_module()
    declare, capture, native_adapter = module._declared_metadata, inference._capture_bundle, module.OnnxAdapter
    preliminary, loaded, captured = [], [], []

    def declare_then_change_only_unit_sidecar(root, labels, raw, components, max_length, problems):
        declared = declare(root, labels, raw, components, max_length, problems)
        if root == directory:
            assert raw['training_stats.json'] == initial
            preliminary.append(json.loads(raw['training_stats.json'])['version'])
            source.write_bytes(invalid)
        return declared

    def capture_real_bytes_then_restore_unit_source(root):
        temporary, hashes = capture(root)
        snapshot = Path(temporary.name)
        exact = (snapshot / 'training_stats.json').read_bytes()
        captured.append((Path(root), snapshot, exact, hashes['training_stats.json']))
        for relative, (digest, size) in hashes.items():
            actual = (snapshot / relative).read_bytes()
            assert hashlib.sha256(actual).hexdigest() == digest and len(actual) == size
        if root == directory:
            assert source.read_bytes() == exact == invalid
            source.write_bytes(initial)  # Restore ONLY this generated fault-injection fixture.
        return temporary, hashes

    def record_real_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        return adapter

    monkeypatch.setattr(module, '_declared_metadata', declare_then_change_only_unit_sidecar)
    monkeypatch.setattr(inference, '_capture_bundle', capture_real_bytes_then_restore_unit_source)
    monkeypatch.setattr(module, 'OnnxAdapter', record_real_native_load)
    records = module.append_status_batch(directory.parent, inventory, jsonl, start=0, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert preliminary == ['preliminary exact e\u0301']
    assert loaded == [directory, later], 'both real tiny adapters must load before captured metadata is inspected'
    assert [item[0] for item in captured] == [directory, later]
    assert [item[2] for item in captured] == [invalid, positive]
    assert [item[3] for item in captured] == [(hashlib.sha256(exact).hexdigest(), len(exact))
                                            for exact in (invalid, positive)]
    assert all(snapshot.is_relative_to(SCRATCH) and not snapshot.exists() for _, snapshot, _, _ in captured)
    first_stats = next(item for item in records[0]['components'] if item['path'] == 'training_stats.json')
    assert first_stats['sha256'] == hashlib.sha256(invalid).hexdigest() != hashlib.sha256(initial).hexdigest()
    assert first_stats['consumption'] == 'identity_only_no_runtime_override'
    assert source.read_bytes() == initial and inventory.read_bytes() == inventory_bytes
    _assert_manual_unicode_batch(directory, inventory, jsonl, rows, records, sources, exact_version,
                                 captured_first_stats=invalid)


@pytest.mark.parametrize('invalid', [
    pytest.param(b'{"version":"\\udc00"}', id='isolated-low'),
    pytest.param(b'{"version":"before\\udbffafter"}', id='embedded-high'),
    pytest.param(b'{"version":"\\udc00\\ud800"}', id='reversed-pair'),
    pytest.param(b'{"version":["exact","\\ud800"]}', id='list-version'),
    pytest.param(b'{"version":{"nested":["\\udfff"]}}', id='nested-version-value'),
    pytest.param(b'{"version":{"\\ud800":"exact"}}', id='version-object-key'),
    pytest.param(b'["\\ud800"]', id='top-level-list'),
    pytest.param(b'{"version":"exact","notes":{"\\udfff":"unsafe"}}', id='other-metadata-key'),
])
def test_other_scalar_invalid_metadata_forms_remain_explicit_ordered_native_batch_errors(directory, invalid):
    """Already-GREEN coverage of the same decoded-metadata boundary, without extra fixes."""
    exact_version = ' exact \U0001f600 e\u0301 '
    (directory / 'training_stats.json').write_bytes(invalid)
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    later = directory.parent / rows[1]['location']
    (later / 'training_stats.json').write_bytes(
        json.dumps({'version': exact_version}, ensure_ascii=False, allow_nan=False).encode('utf-8') + b'\r\n')
    sources = _manual_unicode_sources(directory, rows)
    inventory_bytes = inventory.read_bytes()
    records = _status_module().append_status_batch(directory.parent, inventory, jsonl, start=0, limit=2,
                                                   expected_count=2, max_length=8, threads=1)
    assert inventory.read_bytes() == inventory_bytes
    _assert_manual_unicode_batch(directory, inventory, jsonl, rows, records, sources, exact_version)


@pytest.mark.parametrize('exact_version', [
    pytest.param(None, id='null'),
    pytest.param(True, id='boolean-true'),
    pytest.param(False, id='boolean-false'),
    pytest.param(1, id='integer-one'),
    pytest.param(1.5, id='float'),
    pytest.param(' v14 \U00010000 \U0010ffff e\u0301 ', id='valid-scalar-boundaries-and-combining'),
    pytest.param(['v14', True, 1, None, ' \U0001f680 e\u0301 '], id='list-with-exact-types'),
    pytest.param({' e\u0301 \U0001f600 ': [None, False, 1.5, 'exact']}, id='object-with-exact-key-and-types'),
])
def test_valid_decoded_version_values_types_and_unicode_remain_exact_in_native_batch_readbacks(directory, exact_version):
    """Already-GREEN positive controls: no normalization, coercion, repair or ASCII substitution."""
    (directory / 'training_stats.json').write_bytes(b'{"version":"\\ud800"}')
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    later = directory.parent / rows[1]['location']
    (later / 'training_stats.json').write_bytes(
        json.dumps({'version': exact_version}, ensure_ascii=False, allow_nan=False).encode('utf-8') + b'\r\n')
    sources = _manual_unicode_sources(directory, rows)
    inventory_bytes = inventory.read_bytes()
    records = _status_module().append_status_batch(directory.parent, inventory, jsonl, start=0, limit=2,
                                                   expected_count=2, max_length=8, threads=1)
    assert inventory.read_bytes() == inventory_bytes
    _assert_manual_unicode_batch(directory, inventory, jsonl, rows, records, sources, exact_version)


def _native_status_canonical(value):
    """Exact JSON values/types/text for the three reviewed native-status regressions."""
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=False, allow_nan=False).encode('utf-8')


@pytest.mark.parametrize('boundary', ['initial', 'captured-injection'])
@pytest.mark.parametrize('invalid', [
    pytest.param(b'{"version":1e400}\r\n', id='positive-overflow'),
    pytest.param(b'{"version":-1e400}\r\n', id='negative-overflow'),
    pytest.param(b'{"version":{"nested":[1e400]}}\r\n', id='nested-positive-overflow'),
    pytest.param(b'{"version":{"nested":[-1e400]}}\r\n', id='nested-negative-overflow'),
    pytest.param(b'{"version":"exact","notes":{"nested":[1e400]}}\r\n', id='other-metadata-overflow'),
    pytest.param(b'[null,{"nested":[-1e400]}]\r\n', id='top-level-list-overflow'),
])
def test_overflow_metadata_is_rejected_before_retention_and_the_following_native_row_is_durable(
        directory, monkeypatch, record_property, boundary, invalid):
    """Initial real files / synthetic captured-source injection; tiny native loads are real."""
    import csv
    import weakref

    from eval_harness import inference

    module = _status_module()
    initial = b'{"version":"preliminary exact e\\u0301"}\r\n'
    source = directory / 'training_stats.json'
    source.write_bytes(invalid if boundary == 'initial' else initial)
    inventory, jsonl, rows = _cycle2_inventory_pair(directory)
    later = directory.parent / rows[1]['location']
    exact_version = {' \U0001f600 e\u0301 ': [None, True, False, 1, 1.0, -1.5, 1e308, '', ' \U0001f680 e\u0301 ']}
    positive = json.dumps({'version': exact_version}, ensure_ascii=True, allow_nan=False).encode('utf-8') + b'\r\n'
    (later / 'training_stats.json').write_bytes(positive)
    sources = _manual_unicode_sources(directory, rows)
    inventory_bytes = inventory.read_bytes()
    declare, capture, native_adapter = module._declared_metadata, inference._capture_bundle, module.OnnxAdapter
    injected, captured, loaded, consumers = [], [], [], []

    def declare_then_inject_only_generated_source(root, labels, raw, components, max_length, problems):
        declared = declare(root, labels, raw, components, max_length, problems)
        if boundary == 'captured-injection' and root == directory:
            assert raw['training_stats.json'] == initial
            injected.append(Path(root))
            source.write_bytes(invalid)
        return declared

    def capture_actual_bytes_before_restore(root):
        temporary, hashes = capture(root)
        snapshot = Path(temporary.name)
        copies = []
        for relative, (digest, size) in hashes.items():
            exact = (snapshot / relative).read_bytes()
            assert hashlib.sha256(exact).hexdigest() == digest and len(exact) == size
            copies.append({'path': relative, 'sha256': digest, 'bytes': size, 'raw_hex': exact.hex()})
        captured.append({'root': str(root), 'snapshot': str(snapshot), 'files': copies})
        if boundary == 'captured-injection' and root == directory:
            assert source.read_bytes() == invalid
            source.write_bytes(initial)  # Restore only the generated fault-injection source.
        return temporary, hashes

    def record_real_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        return adapter

    monkeypatch.setattr(module, '_declared_metadata', declare_then_inject_only_generated_source)
    monkeypatch.setattr(inference, '_capture_bundle', capture_actual_bytes_before_restore)
    monkeypatch.setattr(module, 'OnnxAdapter', record_real_native_load)
    records, rejection = None, None
    try:
        records = module.append_status_batch(directory.parent, inventory, jsonl, start=0, limit=2,
                                             expected_count=2, max_length=8, threads=1)
    except ValueError as exc:
        rejection = str(exc)
    # These copied-byte observations are retained before native snapshot cleanup;
    # the native recorder also copies the actual fixture tree before fixture teardown.
    record_property('overflow_native_provenance', {
        'boundary': boundary, 'captured_fault_is_synthetic': boundary == 'captured-injection',
        'native_loads_are_real_UNIT_ONLY': True, 'invalid_raw_hex': invalid.hex(),
        'initial_source_raw_hex': (invalid if boundary == 'initial' else initial).hex(),
        'positive_raw_hex': positive.hex(), 'inventory_raw_hex': inventory_bytes.hex(),
        'loaded_roots': [str(root) for root in loaded], 'captured': captured,
        'batch_rejection': rejection, 'jsonl_exists': jsonl.exists()})
    assert rejection is None, f'nonfinite metadata must become a row error, not abort before the following row: {rejection}'
    assert [record['status'] for record in records] == ['error', 'usable']
    assert [record['location'] for record in records] == [row['location'] for row in rows]
    assert injected == ([directory] if boundary == 'captured-injection' else [])
    expected_loads = [directory, later] if boundary == 'captured-injection' else [later]
    assert loaded == expected_loads, 'the following row must really load; initial nonfinite data must not reach ORT'
    assert [Path(item['root']) for item in captured] == expected_loads
    assert all(Path(item['snapshot']).is_relative_to(SCRATCH) and not Path(item['snapshot']).exists() for item in captured)
    assert all(reference() is None for reference in consumers)
    first, following = records
    assert first['reasons'] == ['training_stats.json: decoded metadata contains a nonfinite number']
    assert first['observed_recorded_version'] is None
    assert first['identity'] is first['native_signature'] is None
    assert first['native_runtime_loaded'] is first['structural_availability'] is False
    assert following['native_runtime_loaded'] is following['structural_availability'] is True
    assert following['identity'] is not None
    assert following['native_signature'] == following['identity']['native_signature']
    assert _native_status_canonical(following['observed_recorded_version']) == _native_status_canonical(exact_version)
    assert type(following['observed_recorded_version']) is dict
    actual_values = next(iter(following['observed_recorded_version'].values()))
    assert [type(value) for value in actual_values] == [type(value) for value in next(iter(exact_version.values()))]
    for record in records:
        assert record['predictions_run'] is record['scored_benchmarks'] is False
        assert _native_status_canonical(record['source_row']) == _native_status_canonical(rows[records.index(record)])
        assert record['source_row']['recorded_version'] == 'v14-not-renamed'
        assert record['source_csv_sha256'] == hashlib.sha256(inventory_bytes).hexdigest()
        payload = {key: value for key, value in record.items() if key != 'inspection_sha256'}
        assert record['inspection_sha256'] == hashlib.sha256(_native_status_canonical(payload)).hexdigest()
        for component in record['components']:
            exact = (invalid if record is first and boundary == 'captured-injection' and component['path'] == 'training_stats.json'
                     else sources[(record['location'], component['path'])])
            assert component['sha256'] == hashlib.sha256(exact).hexdigest() and component['bytes'] == len(exact)
    first_stats = next(item for item in first['components'] if item['path'] == 'training_stats.json')
    assert first_stats['consumption'] == ('identity_only_no_runtime_override' if boundary == 'captured-injection' else 'inspection_only')
    for identity in (following['identity'],):
        payload = {key: value for key, value in identity.items() if key != 'composite_sha256'}
        assert identity['composite_sha256'] == hashlib.sha256(_native_status_canonical(payload)).hexdigest()
    assert source.read_bytes() == (invalid if boundary == 'initial' else initial)
    assert _manual_unicode_sources(directory, rows) == sources and inventory.read_bytes() == inventory_bytes
    saved = module._records(jsonl)
    assert _native_status_canonical(saved) == _native_status_canonical(records)
    expected_jsonl = b''.join(json.dumps(record, sort_keys=True, ensure_ascii=False, allow_nan=False).encode('utf-8')
                              + b'\n' for record in records)
    assert jsonl.read_bytes() == expected_jsonl
    report_json, report_csv = directory.parent / 'overflow-report.json', directory.parent / 'overflow-report.csv'
    report = module.aggregate_status(inventory, jsonl, expected_count=2, json_path=report_json, csv_path=report_csv)
    assert _native_status_canonical(json.loads(report_json.read_bytes())) == _native_status_canonical(report)
    assert _native_status_canonical(report['locations']) == _native_status_canonical(records)
    assert report['summary']['counts_by_status'] == {'error': 1, 'usable': 1}
    with report_csv.open(encoding='utf-8', newline='') as handle:
        csv_rows = list(csv.DictReader(handle))
    assert [row['location'] for row in csv_rows] == [row['location'] for row in rows]
    assert [row['recorded_version'] for row in csv_rows] == [row['recorded_version'] for row in rows]
    assert all(row['source_csv_sha256'] == hashlib.sha256(inventory_bytes).hexdigest() for row in csv_rows)
    assert _manual_unicode_sources(directory, rows) == sources and inventory.read_bytes() == inventory_bytes


def test_observed_versions_have_collision_free_exact_value_and_type_csv_roundtrips(
        directory, monkeypatch, record_property):
    """Actual UNIT-ONLY native reports; source CSV literals and every JSON value stay exact."""
    import csv
    import weakref

    from eval_harness import inference

    versions = [None, '', True, 'True', 1, '1', False, 1.0, ' exact \U0001f9ed e\u0301 ',
                {' e\u0301 \U0001f600 ': [None, False, 1, -0.0, '']}]
    bundles = [directory] + [_unit_bundle(directory.parent / f'csv-unit-bundle-{index}')
                             for index in range(1, len(versions))]
    rows = []
    for index, (bundle, version) in enumerate(zip(bundles, versions)):
        stats = {'version': version, 'notes': [None, True, 1, 1.0, ' e\u0301 \U0001f9ed ']}
        (bundle / 'training_stats.json').write_bytes(
            json.dumps(stats, ensure_ascii=False, allow_nan=False).encode('utf-8') + b'\r\n')
        row = _row(bundle.name, role=f'unit_only_exact_csv_type_{index}')
        row.update(model_onnx_bytes=str((bundle / 'model.onnx').stat().st_size),
                   recorded_version=f' UNIT-ONLY literal {index}: "True", null; e\u0301 \U0001f9ed ')
        rows.append(row)
    inventory = directory.parent / 'typed-version-inventory.csv'
    with inventory.open('x', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    inventory_bytes = inventory.read_bytes()
    sources = _manual_unicode_sources(directory, rows)
    module = _status_module()
    native_adapter, capture = module.OnnxAdapter, inference._capture_bundle
    loaded, consumers, captured = [], [], []

    def capture_actual_unit_bytes(root):
        temporary, hashes = capture(root)
        snapshot = Path(temporary.name)
        files = []
        for relative, (digest, size) in hashes.items():
            exact = (snapshot / relative).read_bytes()
            assert hashlib.sha256(exact).hexdigest() == digest and len(exact) == size
            assert exact == sources[(Path(root).name, relative)]
            files.append({'path': relative, 'sha256': digest, 'bytes': size, 'raw_hex': exact.hex()})
        captured.append({'root': str(root), 'snapshot': str(snapshot), 'files': files})
        return temporary, hashes

    def record_actual_unit_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        return adapter

    monkeypatch.setattr(inference, '_capture_bundle', capture_actual_unit_bytes)
    monkeypatch.setattr(module, 'OnnxAdapter', record_actual_unit_native_load)
    jsonl = directory.parent / 'typed-version-status.jsonl'
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=len(rows),
                                         expected_count=len(rows), max_length=8, threads=1)
    report_json, report_csv = directory.parent / 'typed-version-report.json', directory.parent / 'typed-version-report.csv'
    report = module.aggregate_status(inventory, jsonl, expected_count=len(rows), json_path=report_json, csv_path=report_csv)
    with report_csv.open(encoding='utf-8', newline='') as handle:
        csv_rows = list(csv.DictReader(handle))
    encoded = [row['observed_recorded_version'] for row in csv_rows]
    record_property('exact_typed_csv_provenance', {
        'native_loads_are_real_UNIT_ONLY': True, 'expected_versions': versions,
        'expected_version_types': [type(value).__name__ for value in versions],
        'saved_version_cells': encoded, 'collision_pairs': [encoded[a] == encoded[b] for a, b in ((0, 1), (2, 3), (4, 5))],
        'inventory_raw_hex': inventory_bytes.hex(), 'loaded_roots': [str(root) for root in loaded],
        'captured': captured, 'jsonl_raw_hex': jsonl.read_bytes().hex(),
        'report_json_raw_hex': report_json.read_bytes().hex(), 'report_csv_raw_hex': report_csv.read_bytes().hex()})
    assert loaded == bundles and len(captured) == len(rows)
    assert all(reference() is None for reference in consumers)
    assert all(Path(item['snapshot']).is_relative_to(SCRATCH) and not Path(item['snapshot']).exists() for item in captured)
    assert [record['status'] for record in records] == ['usable'] * len(rows)
    assert _native_status_canonical([record['source_row'] for record in records]) == _native_status_canonical(rows)
    assert _native_status_canonical([record['observed_recorded_version'] for record in records]) == _native_status_canonical(versions)
    assert [type(record['observed_recorded_version']) for record in records] == [type(value) for value in versions]
    assert _native_status_canonical(module._records(jsonl)) == _native_status_canonical(records)
    assert _native_status_canonical(report['locations']) == _native_status_canonical(records)
    assert _native_status_canonical(json.loads(report_json.read_bytes())) == _native_status_canonical(report)
    for record in records:
        assert record['native_runtime_loaded'] is record['structural_availability'] is True
        assert record['predictions_run'] is record['scored_benchmarks'] is False
        assert record['source_csv_sha256'] == hashlib.sha256(inventory_bytes).hexdigest()
        payload = {key: value for key, value in record.items() if key != 'inspection_sha256'}
        assert record['inspection_sha256'] == hashlib.sha256(_native_status_canonical(payload)).hexdigest()
        for component in record['components']:
            exact = sources[(record['location'], component['path'])]
            assert component['sha256'] == hashlib.sha256(exact).hexdigest() and component['bytes'] == len(exact)
    assert len(set(encoded)) == len(versions), 'CSV version cells collide across admitted exact JSON values/types'
    for version, cell in zip(versions, encoded):
        restored = json.loads(cell)
        assert _native_status_canonical(restored) == _native_status_canonical(version)
        assert type(restored) is type(version)
    assert [row['location'] for row in csv_rows] == [row['location'] for row in rows]
    assert [row['recorded_version'] for row in csv_rows] == [row['recorded_version'] for row in rows]
    assert [row['role'] for row in csv_rows] == [row['role'] for row in rows]
    assert all(row['source_csv_sha256'] == hashlib.sha256(inventory_bytes).hexdigest() for row in csv_rows)
    assert _manual_unicode_sources(directory, rows) == sources and inventory.read_bytes() == inventory_bytes


@pytest.mark.parametrize('boundary', ['jsonl-append', 'new-json-report'])
def test_generated_storage_bool_to_int_corruption_cannot_certify_a_status_readback(
        directory, monkeypatch, record_property, boundary):
    """Mutate actual generated storage, not a fabricated read result or original model."""
    import csv
    import weakref

    (directory / 'training_stats.json').write_bytes(b'{"version":false,"notes":"UNIT-ONLY exact e\\u0301"}\r\n')
    row = _row(directory.name)
    row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'readback-type-inventory.csv'
    with inventory.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    inventory_bytes = inventory.read_bytes()
    sources = _manual_unicode_sources(directory, [row])
    module = _status_module()
    native_adapter = module.OnnxAdapter
    loaded, consumers, snapshots = [], [], []

    def record_real_generated_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        snapshot = Path(adapter._snapshot.name)
        copies = []
        for item in adapter.identity['components']:
            exact = (snapshot / item['path']).read_bytes()
            assert exact == sources[(Path(root).name, item['path'])]
            assert item['sha256'] == hashlib.sha256(exact).hexdigest() and item['bytes'] == len(exact)
            copies.append({'path': item['path'], 'sha256': item['sha256'], 'bytes': item['bytes'], 'raw_hex': exact.hex()})
        snapshots.append({'path': str(snapshot), 'files': copies})
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', record_real_generated_native_load)
    jsonl = directory.parent / 'readback-type-status.jsonl'
    report_json = directory.parent / 'readback-type-report.json'
    clean_jsonl = None
    if boundary == 'new-json-report':
        clean = module.append_status_batch(directory.parent, inventory, jsonl, limit=1,
                                           expected_count=1, max_length=8, threads=1)
        assert clean[0]['observed_recorded_version'] is False
        clean_jsonl = jsonl.read_bytes()
    target = jsonl if boundary == 'jsonl-append' else report_json
    real_read = Path.read_bytes
    faults = []

    def change_actual_generated_file_before_returning_its_real_bytes(self):
        exact = real_read(self)
        if self == target and not faults:
            marker = b'"observed_recorded_version": false'
            assert exact.count(marker) == 1, 'fault must target the one real generated location record'
            changed = exact.replace(marker, b'"observed_recorded_version": 0', 1)
            self.write_bytes(changed)  # Only this test's private generated output is corrupted.
            actual = real_read(self)
            assert actual == changed and actual != exact
            faults.append({'path': str(self), 'original_raw_hex': exact.hex(), 'corrupted_raw_hex': actual.hex(),
                           'original_sha256': hashlib.sha256(exact).hexdigest(),
                           'corrupted_sha256': hashlib.sha256(actual).hexdigest()})
            return actual
        return exact

    monkeypatch.setattr(Path, 'read_bytes', change_actual_generated_file_before_returning_its_real_bytes)
    returned, rejection = None, None
    try:
        if boundary == 'jsonl-append':
            returned = module.append_status_batch(directory.parent, inventory, jsonl, limit=1,
                                                  expected_count=1, max_length=8, threads=1)
        else:
            returned = module.aggregate_status(inventory, jsonl, expected_count=1, json_path=report_json)
    except ValueError as exc:
        rejection = exc
    actual = real_read(target)
    saved = json.loads(actual)
    saved_record = saved if boundary == 'jsonl-append' else saved['locations'][0]
    payload = {key: value for key, value in saved_record.items() if key != 'inspection_sha256'}
    recomputed = hashlib.sha256(_native_status_canonical(payload)).hexdigest()
    record_property('generated_storage_type_fault_provenance', {
        'boundary': boundary, 'fault_is_synthetic_on_actual_generated_storage': True,
        'native_load_is_real_UNIT_ONLY': True, 'inventory_raw_hex': inventory_bytes.hex(),
        'loaded_roots': [str(root) for root in loaded], 'snapshots': snapshots, 'faults': faults,
        'actual_persisted_raw_hex': actual.hex(), 'saved_observed_version_type': type(saved_record['observed_recorded_version']).__name__,
        'saved_inspection_sha256': saved_record['inspection_sha256'], 'recomputed_inspection_sha256': recomputed,
        'returned_success': returned is not None, 'rejection': None if rejection is None else str(rejection)})
    assert len(faults) == 1 and loaded == [directory]
    assert all(reference() is None for reference in consumers)
    assert all(Path(item['path']).is_relative_to(SCRATCH) and not Path(item['path']).exists() for item in snapshots)
    assert type(saved_record['observed_recorded_version']) is int and saved_record['observed_recorded_version'] == 0
    assert saved_record['inspection_sha256'] != recomputed, 'persisted corruption must really invalidate the saved identity'
    assert _manual_unicode_sources(directory, [row]) == sources and inventory.read_bytes() == inventory_bytes
    if clean_jsonl is not None:
        assert real_read(jsonl) == clean_jsonl
    assert returned is None, 'type-corrupted generated storage must not be certified as a successful status readback'
    assert isinstance(rejection, ValueError), 'actual persisted false-to-zero corruption must be rejected'
    expected_reason = 'status batch read-back verification failed' if boundary == 'jsonl-append' else 'JSON status report read-back failed'
    assert str(rejection) == expected_reason


# CSV-integrity authorization: one actual assertion RED -> identical-body GREEN.
def test_csv_integrity_generated_false_to_integer_zero_is_rejected(
        directory, monkeypatch, record_property):
    """Corrupt only the actual new saved CSV before its real readback; native load is real."""
    import csv
    import io
    import weakref

    (directory / 'training_stats.json').write_bytes(b'{"version":false,"notes":"UNIT-ONLY e\\u0301"}\r\n')
    row = _row(directory.name)
    row['model_onnx_bytes'] = str((directory / 'model.onnx').stat().st_size)
    inventory = directory.parent / 'csv-integrity-inventory.csv'
    with inventory.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    inventory_bytes = inventory.read_bytes()
    sources = _manual_unicode_sources(directory, [row])
    module = _status_module()
    native_adapter = module.OnnxAdapter
    loaded, consumers, snapshots = [], [], []

    def observe_actual_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        snapshot = Path(adapter._snapshot.name)
        copies = []
        for item in adapter.identity['components']:
            exact = (snapshot / item['path']).read_bytes()
            assert exact == sources[(Path(root).name, item['path'])]
            assert item['sha256'] == hashlib.sha256(exact).hexdigest() and item['bytes'] == len(exact)
            copies.append({'path': item['path'], 'sha256': item['sha256'], 'bytes': item['bytes'], 'raw_hex': exact.hex()})
        snapshots.append({'path': str(snapshot), 'files': copies})
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', observe_actual_native_load)
    jsonl = directory.parent / 'csv-integrity-status.jsonl'
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=1,
                                         expected_count=1, max_length=8, threads=1)
    assert records[0]['observed_recorded_version'] is False
    clean_jsonl = jsonl.read_bytes()
    report_json, report_csv = directory.parent / 'csv-integrity-report.json', directory.parent / 'csv-integrity-report.csv'
    real_open = Path.open
    faults = []

    def corrupt_actual_saved_csv_before_real_open(self, mode='r', *args, **kwargs):
        if self == report_csv and mode == 'r' and not faults:
            original = self.read_bytes()
            saved = list(csv.reader(io.StringIO(original.decode('utf-8'), newline='')))
            column = saved[0].index('observed_recorded_version')
            assert len(saved) == 2 and saved[1][column] == 'false'
            changed_rows = [list(saved[0]), list(saved[1])]
            changed_rows[1][column] = '0'
            buffer = io.StringIO(newline='')
            csv.writer(buffer).writerows(changed_rows)
            self.write_bytes(buffer.getvalue().encode('utf-8'))
            actual = self.read_bytes()
            assert actual != original
            assert list(csv.reader(io.StringIO(actual.decode('utf-8'), newline=''))) == changed_rows
            faults.append({'path': str(self), 'original_raw_hex': original.hex(), 'corrupted_raw_hex': actual.hex(),
                           'original_sha256': hashlib.sha256(original).hexdigest(),
                           'corrupted_sha256': hashlib.sha256(actual).hexdigest()})
        return real_open(self, mode, *args, **kwargs)

    monkeypatch.setattr(Path, 'open', corrupt_actual_saved_csv_before_real_open)
    returned, rejection = None, None
    try:
        returned = module.aggregate_status(inventory, jsonl, expected_count=1, json_path=report_json, csv_path=report_csv)
    except ValueError as exc:
        rejection = str(exc)
    with real_open(report_csv, encoding='utf-8', newline='') as handle:
        persisted = list(csv.DictReader(handle))
    saved_version = json.loads(persisted[0]['observed_recorded_version'])
    source_unchanged = _manual_unicode_sources(directory, [row]) == sources and inventory.read_bytes() == inventory_bytes
    native_cleaned = all(reference() is None for reference in consumers)
    snapshots_cleaned = all(Path(item['path']).is_relative_to(SCRATCH) and not Path(item['path']).exists() for item in snapshots)
    record_property('csv_integrity_tdd_provenance', {
        'fault_is_synthetic_on_actual_new_CSV': True, 'native_load_is_real_UNIT_ONLY': True,
        'faults': faults, 'loaded_roots': [str(root) for root in loaded], 'snapshots': snapshots,
        'source_inventory_raw_hex': inventory_bytes.hex(), 'jsonl_raw_hex': jsonl.read_bytes().hex(),
        'json_report_raw_hex': report_json.read_bytes().hex(), 'csv_actual_raw_hex': report_csv.read_bytes().hex(),
        'saved_version_type': type(saved_version).__name__, 'saved_version': saved_version,
        'source_and_inventory_unchanged': source_unchanged, 'native_session_cleaned': native_cleaned,
        'private_snapshots_cleaned': snapshots_cleaned, 'returned_success': returned is not None, 'rejection': rejection})
    assert len(faults) == 1 and loaded == [directory]
    assert native_cleaned and snapshots_cleaned and source_unchanged
    assert jsonl.read_bytes() == clean_jsonl
    assert _native_status_canonical(module._records(jsonl)) == _native_status_canonical(records)
    assert _native_status_canonical(json.loads(report_json.read_bytes())['locations']) == _native_status_canonical(records)
    assert type(saved_version) is int and saved_version == 0
    assert returned is None, 'type-corrupted new generated CSV must not be certified as a successful status readback'
    assert rejection is not None and 'CSV status report' in rejection and 'read-back failed' in rejection


@pytest.mark.parametrize('fault', [
    pytest.param('column-' + column, id='postfix-already-green-column-' + column)
    for column in ('location', 'role', 'status', 'reasons', 'recorded_version', 'observed_recorded_version',
                   'total_component_bytes', 'components', 'declared_signature', 'native_signature', 'labels',
                   'tokenizer', 'scored_benchmarks', 'source_csv_sha256')
] + [
    pytest.param(fault, id='postfix-already-green-' + fault)
    for fault in ('header-duplicate', 'header-missing', 'header-extra', 'header-reordered',
                  'cell-malformed-quote', 'cell-malformed-json', 'cell-malformed-utf8',
                  'cell-missing', 'cell-extra', 'cell-reordered',
                  'rows-missing', 'rows-extra', 'rows-reordered', 'rows-blank-extra')
])
def test_csv_integrity_postfix_faults(directory, monkeypatch, record_property, fault):
    """Post-fix already-green controls, not additional REDs or another production cycle."""
    import csv
    import io
    import weakref

    second = _unit_bundle(directory.parent / 'csv-integrity-second-unit')
    versions = [False, {' exact \U0001f680 e\u0301 ': [None, '', True, 0, 1.0]}]
    bundles = [directory, second]
    rows = []
    for index, (bundle, version) in enumerate(zip(bundles, versions)):
        (bundle / 'training_stats.json').write_bytes(
            json.dumps({'version': version, 'notes': 'UNIT-ONLY e\u0301 \U0001f600'}, ensure_ascii=False,
                       allow_nan=False).encode('utf-8') + b'\r\n')
        row = _row(bundle.name, role=f' UNIT-ONLY role {index}: e\u0301 \U0001f600 ')
        row.update(model_onnx_bytes=str((bundle / 'model.onnx').stat().st_size),
                   recorded_version=f' UNIT-ONLY literal {index}: "False", null; e\u0301 \U0001f680 ')
        rows.append(row)
    inventory = directory.parent / 'postfix-fault-inventory.csv'
    with inventory.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    inventory_bytes = inventory.read_bytes()
    sources = _manual_unicode_sources(directory, rows)
    module = _status_module()
    native_adapter = module.OnnxAdapter
    loaded, consumers, snapshots = [], [], []

    def observe_actual_unit_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        snapshot = Path(adapter._snapshot.name)
        copies = []
        for item in adapter.identity['components']:
            exact = (snapshot / item['path']).read_bytes()
            assert exact == sources[(Path(root).name, item['path'])]
            assert item['sha256'] == hashlib.sha256(exact).hexdigest() and item['bytes'] == len(exact)
            copies.append({'path': item['path'], 'sha256': item['sha256'], 'bytes': item['bytes'], 'raw_hex': exact.hex()})
        snapshots.append({'path': str(snapshot), 'files': copies})
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', observe_actual_unit_load)
    jsonl = directory.parent / 'postfix-fault-status.jsonl'
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=2,
                                         expected_count=2, max_length=8, threads=1)
    assert [record['status'] for record in records] == ['usable', 'usable']
    clean_jsonl = jsonl.read_bytes()
    report_json, report_csv = directory.parent / 'postfix-fault-report.json', directory.parent / 'postfix-fault-report.csv'
    real_open = Path.open
    faults = []

    def corrupt_only_the_actual_new_csv(self, mode='r', *args, **kwargs):
        if self == report_csv and mode == 'r' and not faults:
            original = self.read_bytes()
            table = list(csv.reader(io.StringIO(original.decode('utf-8'), newline=''), strict=True))
            assert len(table) == 3 and len(table[0]) == 14
            if fault.startswith('column-'):
                field = fault.removeprefix('column-')
                column = table[0].index(field)
                previous = table[1][column]
                if field == 'observed_recorded_version':
                    assert previous == 'false'
                    changed = '0'
                elif field == 'total_component_bytes':
                    changed = str(int(previous) + 1)
                elif field == 'source_csv_sha256':
                    changed = '0' * 64
                elif field == 'scored_benchmarks':
                    assert previous == 'False'
                    changed = '0'
                elif field == 'components':
                    payload = json.loads(previous)
                    payload[0]['sha256'] = '0' * 64
                    payload[0]['bytes'] += 1
                    payload[0]['consumption'] = 'CSV_FAULT_not_source_provenance'
                    changed = json.dumps(payload, ensure_ascii=False, sort_keys=True, allow_nan=False)
                elif field in ('declared_signature', 'native_signature'):
                    payload = json.loads(previous)
                    payload['outputs'][0]['name'] = 'CSV_FAULT_not_native_signature'
                    changed = json.dumps(payload, ensure_ascii=False, sort_keys=True, allow_nan=False)
                elif field == 'labels':
                    changed = json.dumps(['ALERT', 'CSV_FAULT'], ensure_ascii=False)
                elif field == 'tokenizer':
                    payload = json.loads(previous)
                    payload['vocab_bound'] += 1
                    changed = json.dumps(payload, ensure_ascii=False, sort_keys=True, allow_nan=False)
                elif field == 'reasons':
                    changed = json.dumps(json.loads(previous) + ['CSV_FAULT_not_inspection'], ensure_ascii=False)
                else:
                    changed = previous + 'CSV_FAULT'
                assert changed != previous
                table[1][column] = changed
            elif fault == 'header-duplicate':
                table[0][1] = table[0][0]
            elif fault == 'header-missing':
                table[0].pop(1)
            elif fault == 'header-extra':
                table[0].append('CSV_FAULT_extra_header')
            elif fault == 'header-reordered':
                for row in table:
                    row[0], row[1] = row[1], row[0]
            elif fault == 'cell-malformed-json':
                table[1][table[0].index('observed_recorded_version')] = '{"invalid":'
            elif fault == 'cell-missing':
                table[1].pop(1)
            elif fault == 'cell-extra':
                table[1].append('CSV_FAULT_extra_cell')
            elif fault == 'cell-reordered':
                table[1][1], table[1][2] = table[1][2], table[1][1]
            elif fault == 'rows-missing':
                table.pop()
            elif fault == 'rows-extra':
                table.append(list(table[1]))
            elif fault == 'rows-reordered':
                table[1], table[2] = table[2], table[1]
            elif fault == 'rows-blank-extra':
                table.append([])
            else:
                assert fault in ('cell-malformed-quote', 'cell-malformed-utf8')
            buffer = io.StringIO(newline='')
            csv.writer(buffer).writerows(table)
            changed_raw = buffer.getvalue().encode('utf-8')
            if fault == 'cell-malformed-quote':
                changed_raw += b'"unterminated'
            elif fault == 'cell-malformed-utf8':
                changed_raw += b'\xff\r\n'
            assert changed_raw != original
            self.write_bytes(changed_raw)
            actual = self.read_bytes()
            assert actual == changed_raw
            faults.append({'path': str(self), 'fault': fault, 'original_raw_hex': original.hex(),
                           'corrupted_raw_hex': actual.hex(), 'original_sha256': hashlib.sha256(original).hexdigest(),
                           'corrupted_sha256': hashlib.sha256(actual).hexdigest()})
        return real_open(self, mode, *args, **kwargs)

    monkeypatch.setattr(Path, 'open', corrupt_only_the_actual_new_csv)
    returned, rejection = None, None
    try:
        returned = module.aggregate_status(inventory, jsonl, expected_count=2, json_path=report_json, csv_path=report_csv)
    except ValueError as exc:
        rejection = str(exc)
    source_unchanged = _manual_unicode_sources(directory, rows) == sources and inventory.read_bytes() == inventory_bytes
    native_cleaned = all(reference() is None for reference in consumers)
    snapshots_cleaned = all(Path(item['path']).is_relative_to(SCRATCH) and not Path(item['path']).exists() for item in snapshots)
    record_property('csv_integrity_postfix_fault_provenance', {
        'classification': 'post-fix already-green control; no additional RED claimed', 'fault': fault,
        'fault_is_synthetic_on_actual_new_CSV': True, 'native_loads_are_real_UNIT_ONLY': True,
        'faults': faults, 'loaded_roots': [str(root) for root in loaded], 'snapshots': snapshots,
        'inventory_raw_hex': inventory_bytes.hex(), 'jsonl_raw_hex': jsonl.read_bytes().hex(),
        'json_report_raw_hex': report_json.read_bytes().hex(), 'csv_actual_raw_hex': report_csv.read_bytes().hex(),
        'source_and_inventory_unchanged': source_unchanged, 'native_session_cleaned': native_cleaned,
        'private_snapshots_cleaned': snapshots_cleaned, 'returned_success': returned is not None, 'rejection': rejection})
    assert len(faults) == 1 and loaded == bundles and len(snapshots) == 2
    assert native_cleaned and snapshots_cleaned and source_unchanged
    assert jsonl.read_bytes() == clean_jsonl
    assert _native_status_canonical(module._records(jsonl)) == _native_status_canonical(records)
    assert _native_status_canonical(json.loads(report_json.read_bytes())['locations']) == _native_status_canonical(records)
    assert returned is None and rejection == 'CSV status report exact projection/provenance read-back failed'


def test_csv_integrity_postfix_exact_contract(directory, monkeypatch, record_property):
    """Post-fix already-green complete saved CSV contract, types/shapes, order and cleanup."""
    import csv
    import weakref

    text = ' exact \U0001f9ed e\u0301, "CSV"\r\n second line '
    versions = [None, '', False, True, 0, -7, -0.0, 1.5, '0', 'False', text,
                [None, '', False, 0, 1.0, text], {' e\u0301 \U0001f600 ': [None, True, False, 0, 1.0, text]}]
    metadata = [{'version': version, 'notes': [None, True, 1, 1.0, text]} for version in versions]
    metadata += [None, [], [None, False, 0, text], text, True, 17]
    expected_versions = versions + [None] * (len(metadata) - len(versions))
    bundles = [directory] + [_unit_bundle(directory.parent / f'csv-exact-unit-{index}') for index in range(1, len(metadata))]
    rows = []
    for index, (bundle, stats) in enumerate(zip(bundles, metadata)):
        (bundle / 'training_stats.json').write_bytes(
            json.dumps(stats, ensure_ascii=False, allow_nan=False).encode('utf-8') + b'\r\n')
        row = _row(bundle.name, role=f' UNIT-ONLY role {index}: e\u0301 \U0001f680 ')
        row.update(model_onnx_bytes=str((bundle / 'model.onnx').stat().st_size),
                   recorded_version='' if index == 0 else f' UNIT-ONLY source literal {index}: {text}')
        rows.append(row)
    # A missing generated UNIT-ONLY row exercises the unchanged non-JSON None -> empty-cell contract.
    missing = _row('csv-exact-missing-unit', role='unit_only_missing_no_native_load')
    missing.update(model_onnx_bytes='', recorded_version='')
    rows.append(missing)
    inventory = directory.parent / 'postfix-exact-inventory.csv'
    with inventory.open('x', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    inventory_bytes = inventory.read_bytes()
    sources = _manual_unicode_sources(directory, rows)
    module = _status_module()
    native_adapter = module.OnnxAdapter
    loaded, consumers, snapshots = [], [], []

    def observe_actual_exact_native_load(root, *args, **kwargs):
        adapter = native_adapter(root, *args, **kwargs)
        loaded.append(Path(root))
        consumers.append(weakref.ref(adapter._session))
        snapshot = Path(adapter._snapshot.name)
        copies = []
        for item in adapter.identity['components']:
            exact = (snapshot / item['path']).read_bytes()
            assert exact == sources[(Path(root).name, item['path'])]
            assert item['sha256'] == hashlib.sha256(exact).hexdigest() and item['bytes'] == len(exact)
            copies.append({'path': item['path'], 'sha256': item['sha256'], 'bytes': item['bytes'], 'raw_hex': exact.hex()})
        snapshots.append({'path': str(snapshot), 'files': copies})
        return adapter

    monkeypatch.setattr(module, 'OnnxAdapter', observe_actual_exact_native_load)
    jsonl = directory.parent / 'postfix-exact-status.jsonl'
    records = module.append_status_batch(directory.parent, inventory, jsonl, limit=len(rows),
                                         expected_count=len(rows), max_length=8, threads=1)
    report_json, report_csv = directory.parent / 'postfix-exact-report.json', directory.parent / 'postfix-exact-report.csv'
    report = module.aggregate_status(inventory, jsonl, expected_count=len(rows), json_path=report_json, csv_path=report_csv)
    fields = ['location', 'role', 'status', 'reasons', 'recorded_version', 'observed_recorded_version',
              'total_component_bytes', 'components', 'declared_signature', 'native_signature', 'labels',
              'tokenizer', 'scored_benchmarks', 'source_csv_sha256']
    json_fields = {'reasons', 'components', 'declared_signature', 'native_signature', 'labels', 'tokenizer',
                   'observed_recorded_version'}
    expected_cells = [fields]
    for row, record in zip(rows, records):
        cells = []
        for field in fields:
            if field in ('role', 'recorded_version'):
                cell = row[field]
            elif field in json_fields:
                cell = json.dumps(record[field], ensure_ascii=False, sort_keys=True, allow_nan=False)
            else:
                value = record.get(field)
                cell = '' if value is None else str(value)
            cells.append(cell)
        expected_cells.append(cells)
    with report_csv.open(encoding='utf-8', newline='') as handle:
        saved = list(csv.reader(handle, strict=True))
    assert saved == expected_cells
    observed_column = fields.index('observed_recorded_version')
    encoded = [row[observed_column] for row in saved[1:]]
    restored = [json.loads(cell) for cell in encoded]
    assert _native_status_canonical(restored) == _native_status_canonical(expected_versions + [None])
    assert [type(value) for value in restored] == [type(value) for value in expected_versions + [None]]
    assert len(set(encoded[:len(versions)])) == len(versions)
    assert encoded[0] == 'null' and encoded[1] == '""' and encoded[2] == 'false' and encoded[4] == '0'
    assert saved[-1][fields.index('total_component_bytes')] == ''
    assert saved[-1][fields.index('declared_signature')] == saved[-1][fields.index('labels')] == 'null'
    assert all(row[fields.index('scored_benchmarks')] == 'False' for row in saved[1:])
    assert all(row[fields.index('source_csv_sha256')] == hashlib.sha256(inventory_bytes).hexdigest() for row in saved[1:])
    assert _native_status_canonical([record['source_row'] for record in records]) == _native_status_canonical(rows)
    assert _native_status_canonical(report['locations']) == _native_status_canonical(records)
    assert _native_status_canonical(module._records(jsonl)) == _native_status_canonical(records)
    assert _native_status_canonical(json.loads(report_json.read_bytes())) == _native_status_canonical(report)
    assert [record['status'] for record in records] == ['usable'] * len(bundles) + ['missing']
    assert loaded == bundles and len(snapshots) == len(bundles)
    native_cleaned = all(reference() is None for reference in consumers)
    snapshots_cleaned = all(Path(item['path']).is_relative_to(SCRATCH) and not Path(item['path']).exists() for item in snapshots)
    source_unchanged = _manual_unicode_sources(directory, rows) == sources and inventory.read_bytes() == inventory_bytes
    for index, record in enumerate(records):
        assert record['predictions_run'] is record['scored_benchmarks'] is False
        payload = {key: value for key, value in record.items() if key != 'inspection_sha256'}
        assert record['inspection_sha256'] == hashlib.sha256(_native_status_canonical(payload)).hexdigest()
        for component in record['components']:
            exact = sources[(record['location'], component['path'])]
            assert component['sha256'] == hashlib.sha256(exact).hexdigest() and component['bytes'] == len(exact)
        if index < len(metadata):
            assert _native_status_canonical(json.loads(sources[(record['location'], 'training_stats.json')])) == _native_status_canonical(metadata[index])
    record_property('csv_integrity_postfix_exact_provenance', {
        'classification': 'post-fix already-green control; no additional RED claimed',
        'native_loads_are_real_UNIT_ONLY': True, 'version_types': [type(value).__name__ for value in versions],
        'metadata_source_shapes': [type(value).__name__ for value in metadata], 'saved_version_cells': encoded,
        'all_14_headers_and_all_ordered_cells_match_exact_contract': saved == expected_cells,
        'loaded_roots': [str(root) for root in loaded], 'snapshots': snapshots,
        'source_and_inventory_unchanged': source_unchanged, 'native_session_cleaned': native_cleaned,
        'private_snapshots_cleaned': snapshots_cleaned, 'inventory_raw_hex': inventory_bytes.hex(),
        'jsonl_raw_hex': jsonl.read_bytes().hex(), 'json_report_raw_hex': report_json.read_bytes().hex(),
        'csv_actual_raw_hex': report_csv.read_bytes().hex()})
    assert native_cleaned and snapshots_cleaned and source_unchanged
