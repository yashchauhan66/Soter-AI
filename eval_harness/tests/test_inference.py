"""Offline adapter tests. All generated graphs are UNIT-ONLY, not Soter models."""
from __future__ import annotations

import importlib
import importlib.util
import json
import tempfile
from pathlib import Path

import numpy as np
import onnx
import pytest
from onnx import TensorProto, helper, numpy_helper
from tokenizers import Tokenizer, models, pre_tokenizers, processors

ROOT = Path(__file__).resolve().parents[2]
SCRATCH = Path('C:/Users/USER/AppData/Local/hermes/cache/scratch')
VOCAB = {'[PAD]': 0, '[UNK]': 1, '[CLS]': 2, '[SEP]': 3, 'hello': 4, 'risk': 5}


def _adapter():
    assert importlib.util.find_spec('eval_harness.inference') is not None, 'Native ONNX adapter is not implemented'
    return importlib.import_module('eval_harness.inference').OnnxAdapter


def _unit_bundle(directory):
    """Known token-dependent two-class graph; never a benchmark/model substitute."""
    directory.mkdir(parents=True, exist_ok=True)
    tokdir = directory / 'tokenizer_config'
    tokdir.mkdir()
    tokenizer = Tokenizer(models.WordLevel(VOCAB, unk_token='[UNK]'))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer.add_special_tokens(['[PAD]', '[UNK]', '[CLS]', '[SEP]'])
    tokenizer.post_processor = processors.TemplateProcessing(
        single='[CLS] $A [SEP]', special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
    tokenizer.enable_truncation(max_length=3)
    tokenizer.enable_padding(length=3, pad_id=0, pad_token='[PAD]')
    tokenizer.save(str(tokdir / 'tokenizer.json'))
    (tokdir / 'tokenizer_config.json').write_text(json.dumps({
        'model_max_length': 512, 'padding_side': 'right', 'truncation_side': 'right',
        'cls_token': '[CLS]', 'sep_token': '[SEP]', 'pad_token': '[PAD]', 'unk_token': '[UNK]'}), encoding='utf-8')
    (directory / 'labels.json').write_text(json.dumps({'0': 'ALERT', '1': 'CLEAR'}), encoding='utf-8')
    table = np.array([[0., 0.]] * 4 + [[2., -2.], [-2., 2.]], dtype=np.float32)
    nodes = [helper.make_node('Gather', ['word_embeddings.weight', 'input_ids'], ['embedded']),
             helper.make_node('Cast', ['attention_mask'], ['mask_float'], to=TensorProto.FLOAT),
             helper.make_node('Unsqueeze', ['mask_float', 'last_axis'], ['mask_3d']),
             helper.make_node('Mul', ['embedded', 'mask_3d'], ['masked']),
             helper.make_node('ReduceSum', ['masked', 'seq_axis'], ['logits'], keepdims=0)]
    graph = helper.make_graph(nodes, 'UNIT_ONLY_token_classifier', [
        helper.make_tensor_value_info('input_ids', TensorProto.INT64, ['batch', 'sequence']),
        helper.make_tensor_value_info('attention_mask', TensorProto.INT64, ['batch', 'sequence'])], [
        helper.make_tensor_value_info('logits', TensorProto.FLOAT, ['batch', 2])], [
        numpy_helper.from_array(table, 'word_embeddings.weight'),
        numpy_helper.from_array(np.array([2], dtype=np.int64), 'last_axis'),
        numpy_helper.from_array(np.array([1], dtype=np.int64), 'seq_axis')])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)], ir_version=8)
    onnx.checker.check_model(model, full_check=True)
    onnx.save(model, str(directory / 'model.onnx'))
    return directory


@pytest.fixture
def bundle():
    with tempfile.TemporaryDirectory(prefix='onnx-adapter-unit-', dir=SCRATCH) as name:
        yield _unit_bundle(Path(name) / 'bundle')


def test_native_logits_named_probabilities_labels_and_raw_text(bundle):
    adapter = _adapter()(bundle, max_length=8, threads=1, batch_size=2)
    texts = ['hello', 'risk', '']
    result = adapter.predict(texts)
    assert result['texts'] == texts
    assert result['labels'] == ['ALERT', 'CLEAR']
    expected = np.array([[2., -2.], [-2., 2.], [0., 0.]])
    expected = np.exp(expected - expected.max(axis=1, keepdims=True))
    expected /= expected.sum(axis=1, keepdims=True)
    np.testing.assert_allclose(result['probabilities'], expected, atol=1e-7)
    assert result['named_probabilities'] == [dict(zip(result['labels'], p)) for p in result['probabilities']]
    assert result['argmaxes'] == [0, 1, 0]
    assert result['predicted_labels'] == ['ALERT', 'CLEAR', 'ALERT']
    json.dumps(result, allow_nan=False)


def test_reports_actual_native_prefix_truncation_and_unknown_coverage(bundle):
    result = _adapter()(bundle, max_length=4, threads=1, batch_size=2).predict(
        ['  hello hello risk hello  ', 'unknown', ''])
    assert result['texts'][0] == '  hello hello risk hello  '
    first, unknown, empty = result['coverage']
    assert first['content_tokens'] == 4
    assert first['processed_content_tokens'] == 2
    assert first['special_tokens'] == 2
    assert first['processed_tokens'] == first['padded_length'] == 4
    assert first['truncated_tokens'] == 2 and first['truncated'] is True
    assert first['processed_token_range'] == [0, 2]
    assert first['unprocessed_token_ranges'] == [[2, 4]]
    assert first['processed_char_spans'] == [[2, 7], [8, 13]]
    assert unknown['unknown_content_tokens'] == unknown['processed_unknown_tokens'] == 1
    assert unknown['processed_content_tokens'] == 1
    assert empty['content_tokens'] == empty['processed_content_tokens'] == 0
    assert empty['processed_tokens'] == 2 and empty['truncated'] is False
    assert empty['unprocessed_token_ranges'] == []
    assert empty['coverage_kind'] == 'native_single_prefix_no_windows'
    # The native terminal SEP must survive truncation: the graph sees exactly two hellos.
    expected = np.exp([4., -4.]) / np.exp([4., -4.]).sum()
    np.testing.assert_allclose(result['probabilities'][0], expected, atol=1e-7)


@pytest.mark.parametrize(('name', 'value'), [
    ('max_length', True), ('max_length', 0), ('max_length', 1), ('max_length', -1), ('max_length', 4.5),
    ('threads', True), ('threads', 0), ('threads', -1), ('threads', '2'),
    ('batch_size', True), ('batch_size', 0), ('batch_size', -1), ('batch_size', 1.5)])
def test_settings_reject_invalid_lengths_threads_and_batches(bundle, name, value):
    with pytest.raises(ValueError, match=name):
        _adapter()(bundle, **{name: value})


@pytest.mark.parametrize('texts', ['hello', b'hello', None, {'text': 'hello'}, {'hello'},
                                 (text for text in ['hello']), [1], ['hello', None]])
def test_predict_requires_an_ordered_sequence_of_exact_strings(bundle, texts):
    adapter = _adapter()(bundle, max_length=8, threads=1)
    with pytest.raises(ValueError, match='texts'):
        adapter.predict(texts)


@pytest.mark.parametrize('raw_labels', [
    '{}', '{"0":"ALERT","2":"CLEAR"}', '{"00":"ALERT","1":"CLEAR"}',
    '{"0":"ALERT","01":"CLEAR"}', '{"0":"ALERT","1":"ALERT"}',
    '{"0":" ALERT","1":"CLEAR"}', '{"0":"alert","1":"CLEAR"}',
    '{"0":"","1":"CLEAR"}', '{"0":4,"1":"CLEAR"}', '["ALERT","CLEAR"]',
    '{"0":"ALERT","0":"CLEAR"}', '{"-1":"ALERT","0":"CLEAR"}'])
def test_rejects_noncontiguous_or_mutated_native_label_tokens(bundle, raw_labels):
    (bundle / 'labels.json').write_text(raw_labels, encoding='utf-8')
    with pytest.raises(ValueError, match='labels'):
        _adapter()(bundle, max_length=8, threads=1)


def _externalize(bundle):
    (bundle / 'weights').mkdir()
    model = onnx.load(str(bundle / 'model.onnx'), load_external_data=False)
    onnx.save_model(model, str(bundle / 'model.onnx'), save_as_external_data=True,
                    all_tensors_to_one_file=True, location='weights/data.bin', size_threshold=64)
    return onnx.load(str(bundle / 'model.onnx'), load_external_data=False)


@pytest.mark.parametrize('location', [None, '../outside.bin', '/absolute.bin', 'C:/absolute.bin',
    'C:drive-relative.bin', r'C:\absolute.bin', r'\\server\share\weights', 'weights/../../outside.bin',
    r'weights\..\..\outside.bin', 'weights/data.bin:stream', ''])
def test_external_references_are_confined_before_any_runtime_load(bundle, monkeypatch, location):
    model = _externalize(bundle)
    if location is None:
        result = _adapter()(bundle, max_length=8, threads=1).predict(['hello'])
        assert result['argmaxes'] == [0]
        return
    tensor = next(t for t in model.graph.initializer if t.external_data)
    next(a for a in tensor.external_data if a.key == 'location').value = location
    (bundle / 'model.onnx').write_bytes(model.SerializeToString())
    module = importlib.import_module('eval_harness.inference')
    def forbidden_runtime(*args, **kwargs):
        pytest.fail('Unsafe external reference reached ORT before validation')
    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden_runtime)
    with pytest.raises(ValueError, match='external'):
        _adapter()(bundle, max_length=8, threads=1)


def test_real_onnx_checker_rejects_invalid_graph_before_runtime(bundle, monkeypatch):
    module = importlib.import_module('eval_harness.inference')
    model = onnx.load(str(bundle / 'model.onnx'), load_external_data=False)
    model.graph.node[0].op_type = 'THIS_IS_NOT_AN_ONNX_OPERATOR'
    (bundle / 'model.onnx').write_bytes(model.SerializeToString())
    calls = []
    checker = onnx.checker.check_model
    def check(*args, **kwargs):
        calls.append((args, kwargs))
        return checker(*args, **kwargs)
    def forbidden(*args, **kwargs):
        pytest.fail('Invalid ONNX graph reached ORT before real checking')
    monkeypatch.setattr(onnx.checker, 'check_model', check)
    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden)
    with pytest.raises(ValueError, match='ONNX checking'):
        _adapter()(bundle, max_length=8, threads=1)
    assert len(calls) == 1 and calls[0][1]['full_check'] is True


def _signature_fixture(bundle, names=('input_ids', 'attention_mask'), dtype=TensorProto.INT64,
                       shape=('batch', 'sequence'), output='logits', classes=2, output_dtype=TensorProto.FLOAT,
                       output_batch='batch'):
    values = np.zeros((output_batch if type(output_batch) is int else 1, classes),
                      dtype={TensorProto.FLOAT: np.float32, TensorProto.INT64: np.int64}[output_dtype])
    graph = helper.make_graph([helper.make_node('Identity', ['scores'], [output])], 'UNIT_ONLY_signature',
        [helper.make_tensor_value_info(name, dtype, list(shape)) for name in names],
        [helper.make_tensor_value_info(output, output_dtype, [output_batch, classes])],
        [numpy_helper.from_array(values, 'scores')])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)], ir_version=8)
    onnx.checker.check_model(model, full_check=True)
    onnx.save(model, str(bundle / 'model.onnx'))


@pytest.mark.parametrize('change', [
    {'names': ('token_ids', 'attention_mask')}, {'names': ('input_ids',)},
    {'names': ('input_ids', 'attention_mask', 'extra_input')}, {'dtype': TensorProto.FLOAT},
    {'names': ('inputs_embeds', 'attention_mask'), 'shape': ('batch', 'sequence', 384), 'dtype': TensorProto.FLOAT},
    {'shape': ('sequence',)}, {'shape': ('batch', 0)}, {'output': 'scores_out'},
    {'classes': 3}, {'output_dtype': TensorProto.INT64}, {'output_batch': 2}])
def test_unsupported_native_signatures_fail_before_ort(bundle, monkeypatch, change):
    _signature_fixture(bundle, **change)
    module = importlib.import_module('eval_harness.inference')
    def forbidden(*args, **kwargs):
        pytest.fail('Unsupported native signature reached ORT')
    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden)
    with pytest.raises(ValueError, match='signature'):
        _adapter()(bundle, max_length=8, threads=1)


@pytest.mark.parametrize('change', ['out_of_range_id', 'duplicate_id', 'negative_id', 'missing_post_processor',
    'wrong_cls_id', 'wrong_pad_token', 'left_padding', 'left_truncation', 'over_model_length'])
def test_native_tokenizer_contract_and_model_id_bounds_are_validated(bundle, monkeypatch, change):
    path = bundle / 'tokenizer_config/tokenizer.json'
    config_path = bundle / 'tokenizer_config/tokenizer_config.json'
    tokenizer, config = json.loads(path.read_text()), json.loads(config_path.read_text())
    if change == 'out_of_range_id': tokenizer['model']['vocab']['risk'] = 99
    if change == 'duplicate_id': tokenizer['model']['vocab']['hello'] = 5
    if change == 'negative_id': tokenizer['model']['vocab']['risk'] = -1
    if change == 'missing_post_processor': tokenizer['post_processor'] = None
    if change == 'wrong_cls_id': tokenizer['post_processor']['special_tokens']['[CLS]']['ids'] = [99]
    if change == 'wrong_pad_token': config['pad_token'] = '[PAD ]'
    if change == 'left_padding': config['padding_side'] = 'left'
    if change == 'left_truncation': config['truncation_side'] = 'left'
    path.write_text(json.dumps(tokenizer), encoding='utf-8')
    config_path.write_text(json.dumps(config), encoding='utf-8')
    module = importlib.import_module('eval_harness.inference')
    def forbidden(*args, **kwargs):
        pytest.fail('Invalid native tokenizer reached ORT')
    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden)
    with pytest.raises(ValueError, match='tokenizer|max_length'):
        _adapter()(bundle, max_length=513 if change == 'over_model_length' else 8, threads=1)


@pytest.mark.parametrize(('source', 'interpretation'), [
    (None, 'missing_no_calibration_claim'),
    ({'temperature': 0.5, 'notes': 'Temperature is ALREADY baked into the exported ONNX logits; do not divide again.'}, 'source_declares_baked_into_logits'),
    ({'temperature': 0.5, 'notes': 'Historical metadata; export application is unspecified.'}, 'unverified_no_calibration_claim')])
def test_calibration_interpretation_is_explicit_and_never_reapplied(bundle, source, interpretation):
    if source is not None:
        (bundle / 'calibration.json').write_text(json.dumps(source), encoding='utf-8')
    adapter = _adapter()(bundle, max_length=8, threads=1)
    result = adapter.predict(['hello'])
    expected = np.exp([2., -2.]) / np.exp([2., -2.]).sum()
    np.testing.assert_allclose(result['probabilities'][0], expected, atol=1e-7)
    calibration = adapter.identity['calibration']
    assert calibration['interpretation'] == interpretation
    assert calibration['source'] == source
    assert calibration['external_temperature_applications'] == 0
    assert calibration['thresholds_applied'] is False
    assert calibration['tenant_policy_certified'] is False


def test_close_context_releases_native_session_and_rejects_all_later_predictions(bundle):
    import shutil
    import weakref

    _externalize(bundle)
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        reference = weakref.ref(adapter._session)
        empty = adapter.predict([])
        assert empty['texts'] == empty['probabilities'] == empty['coverage'] == []
        assert empty['labels'] == ['ALERT', 'CLEAR']
        assert adapter.predict(['hello'])['predicted_labels'] == ['ALERT']
    assert reference() is None
    adapter.close()  # Explicit close is idempotent after context cleanup.
    with pytest.raises(RuntimeError, match='closed'):
        adapter.predict([])
    with pytest.raises(RuntimeError, match='closed'):
        adapter.__enter__()
    # This test runs on Windows and must not leave native weight handles open.
    shutil.rmtree(bundle)
    assert not bundle.exists()


@pytest.mark.parametrize('has_calibration', [False, True])
def test_whole_bundle_identity_is_recomputable_stable_and_returned_with_prediction(bundle, has_calibration):
    import hashlib
    import shutil

    _externalize(bundle)
    (bundle / 'tokenizer_config/special_tokens_map.json').write_text('{"pad_token":"[PAD]"}', encoding='utf-8')
    (bundle / 'encoder_config.json').write_text('{"unit_only":true}', encoding='utf-8')
    if has_calibration:
        (bundle / 'calibration.json').write_text('{"temperature":0.5,"notes":"unspecified"}', encoding='utf-8')
    required = {'model.onnx', 'weights/data.bin', 'labels.json', 'tokenizer_config/tokenizer.json',
                'tokenizer_config/tokenizer_config.json', 'tokenizer_config/special_tokens_map.json',
                'encoder_config.json'} | ({'calibration.json'} if has_calibration else set())
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        identity = adapter.identity
        assert {item['path'] for item in identity['components']} == required
        assert identity['total_bytes'] == sum((bundle / name).stat().st_size for name in required)
        for item in identity['components']:
            assert item['bytes'] == (bundle / item['path']).stat().st_size
            assert item['sha256'] == hashlib.sha256((bundle / item['path']).read_bytes()).hexdigest()
        calibration = identity['calibration']
        assert calibration['present'] is has_calibration
        assert calibration['sha256'] == (hashlib.sha256((bundle / 'calibration.json').read_bytes()).hexdigest()
                                         if has_calibration else None)
        assert ('calibration.json' in identity['absent_components']) is (not has_calibration)
        assert identity['runtime']['onnxruntime'] == importlib.import_module('onnxruntime').__version__
        assert set(identity['runtime']) >= {'python', 'numpy', 'onnx', 'onnxruntime', 'tokenizers', 'providers'}
        assert [item['name'] for item in identity['native_signature']['inputs']] == ['input_ids', 'attention_mask']
        assert identity['native_signature']['outputs'] == [
            {'name': 'logits', 'dtype': 'tensor(float)', 'shape': ['batch', 2]}]
        payload = {key: value for key, value in identity.items() if key != 'composite_sha256'}
        encoded = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')
        assert identity['composite_sha256'] == hashlib.sha256(encoded).hexdigest()
        assert adapter.predict(['hello'])['identity'] == identity
        identity['components'][0]['sha256'] = 'tampered by caller'
        assert adapter.identity['components'][0]['sha256'] != 'tampered by caller'
        expected = adapter.identity
    clone = bundle.parent / 'clone'
    shutil.copytree(bundle, clone)
    with _adapter()(clone, max_length=8, threads=1) as adapter:
        assert adapter.identity == expected


@pytest.mark.parametrize('external', [False, True])
def test_identity_binds_private_consumed_snapshot_even_when_all_original_inputs_are_substituted(bundle, monkeypatch, external):
    import hashlib

    if external:
        _externalize(bundle)
    (bundle / 'calibration.json').write_text('{"temperature":0.5,"notes":"unspecified"}', encoding='utf-8')
    names = ['model.onnx', 'labels.json', 'tokenizer_config/tokenizer.json',
             'tokenizer_config/tokenizer_config.json', 'calibration.json'] + (['weights/data.bin'] if external else [])
    expected_hashes = {name: hashlib.sha256((bundle / name).read_bytes()).hexdigest() for name in names}
    module = importlib.import_module('eval_harness.inference')
    native = module.ort.InferenceSession
    runtime_paths = []

    def substitute_originals_then_load(path, *args, **kwargs):
        runtime_paths.append(Path(path))
        if external:
            (bundle / 'weights/data.bin').write_bytes(bytes((bundle / 'weights/data.bin').stat().st_size))
        else:
            model = onnx.load(str(bundle / 'model.onnx'))
            table = next(tensor for tensor in model.graph.initializer if tensor.name == 'word_embeddings.weight')
            table.CopyFrom(numpy_helper.from_array(-numpy_helper.to_array(table), table.name))
            onnx.save(model, str(bundle / 'model.onnx'))
        (bundle / 'labels.json').write_text('{"0":"CLEAR","1":"ALERT"}', encoding='utf-8')
        (bundle / 'tokenizer_config/tokenizer.json').write_text('{}', encoding='utf-8')
        (bundle / 'tokenizer_config/tokenizer_config.json').write_text('{"padding_side":"left"}', encoding='utf-8')
        (bundle / 'calibration.json').write_text('{"temperature":99,"notes":"substituted"}', encoding='utf-8')
        return native(path, *args, **kwargs)

    monkeypatch.setattr(module.ort, 'InferenceSession', substitute_originals_then_load)
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        result = adapter.predict(['hello'])
        expected = np.exp([2., -2.]) / np.exp([2., -2.]).sum()
        np.testing.assert_allclose(result['probabilities'][0], expected, atol=1e-7)
        assert result['labels'] == ['ALERT', 'CLEAR']
        assert result['identity']['calibration']['source']['temperature'] == 0.5
        assert {item['path']: item['sha256'] for item in adapter.identity['components']} == expected_hashes
        captured_root = runtime_paths[0].parent
        assert captured_root != bundle and captured_root.is_relative_to(SCRATCH)
        for name, digest in expected_hashes.items():
            assert hashlib.sha256((captured_root / name).read_bytes()).hexdigest() == digest
    assert not captured_root.exists()  # Real Windows private model/external-weight cleanup.


@pytest.mark.parametrize('component', ['model.onnx', 'weights/data.bin', 'labels.json',
    'tokenizer_config/tokenizer.json', 'tokenizer_config/tokenizer_config.json', 'calibration.json'])
def test_changed_private_component_during_native_load_is_rejected_and_cleaned(bundle, monkeypatch, component):
    _externalize(bundle)
    (bundle / 'calibration.json').write_text('{"temperature":0.5}', encoding='utf-8')
    module = importlib.import_module('eval_harness.inference')
    native = module.ort.InferenceSession
    captured_roots = []

    def change_consumed_copy(path, *args, **kwargs):
        root = Path(path).parent
        captured_roots.append(root)
        target = root / component
        if component == 'model.onnx':
            model = onnx.load(str(target), load_external_data=False)
            model.doc_string = 'UNIT_ONLY substituted copy'
            target.write_bytes(model.SerializeToString())
        elif component == 'weights/data.bin':
            target.write_bytes(bytes(target.stat().st_size))
        else:
            target.write_bytes(target.read_bytes() + b'\n')
        return native(path, *args, **kwargs)

    monkeypatch.setattr(module.ort, 'InferenceSession', change_consumed_copy)
    with pytest.raises(ValueError, match='captured bundle identity changed'):
        _adapter()(bundle, max_length=8, threads=1)
    assert captured_roots and all(not root.exists() for root in captured_roots)


def _native_input_contract(bundle, dtypes=None, shape=('batch', 'sequence')):
    model = onnx.load(str(bundle / 'model.onnx'), load_external_data=False)
    for value in model.graph.input:
        value.CopyFrom(helper.make_tensor_value_info(value.name, (dtypes or {}).get(value.name, TensorProto.INT64), list(shape)))
    output = model.graph.output[0]
    output.CopyFrom(helper.make_tensor_value_info('logits', TensorProto.FLOAT, [shape[0], 2]))
    onnx.checker.check_model(model, full_check=True)
    onnx.save(model, str(bundle / 'model.onnx'))


@pytest.mark.parametrize(('id_type', 'mask_type'), [(TensorProto.INT32, TensorProto.INT32),
    (TensorProto.INT32, TensorProto.INT64), (TensorProto.INT64, TensorProto.INT32)])
def test_real_native_integer_feeds_follow_each_declared_input_dtype(bundle, monkeypatch, id_type, mask_type):
    _native_input_contract(bundle, {'input_ids': id_type, 'attention_mask': mask_type})
    with _adapter()(bundle, max_length=8, threads=1, batch_size=2) as adapter:
        native_run = adapter._session.run
        feeds = []

        def record(outputs, values):
            feeds.append({name: value.copy() for name, value in values.items()})
            return native_run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record)
        result = adapter.predict([' hello ', 'risk', ''])
        assert result['texts'] == [' hello ', 'risk', '']
        assert result['predicted_labels'] == ['ALERT', 'CLEAR', 'ALERT']
        assert len(feeds) == 2
        expected_types = {TensorProto.INT32: np.dtype('int32'), TensorProto.INT64: np.dtype('int64')}
        assert all(feed['input_ids'].dtype == expected_types[id_type] for feed in feeds)
        assert all(feed['attention_mask'].dtype == expected_types[mask_type] for feed in feeds)
        np.testing.assert_array_equal(feeds[0]['input_ids'], [[2, 4, 3], [2, 5, 3]])


def _native_type_embeddings(bundle):
    tokenizer_path = bundle / 'tokenizer_config/tokenizer.json'
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    tokenizer.post_processor = processors.TemplateProcessing(
        single='[CLS] $A:1 [SEP]', special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
    tokenizer.save(str(tokenizer_path))
    model = onnx.load(str(bundle / 'model.onnx'), load_external_data=False)
    model.graph.input.append(helper.make_tensor_value_info('token_type_ids', TensorProto.INT64, ['batch', 'sequence']))
    model.graph.initializer.append(numpy_helper.from_array(np.array([[0., 0.], [3., -3.]], dtype=np.float32),
                                                          'token_type_embeddings.weight'))
    model.graph.node.insert(1, helper.make_node('Gather', ['token_type_embeddings.weight', 'token_type_ids'], ['type_embedded']))
    model.graph.node.insert(2, helper.make_node('Add', ['embedded', 'type_embedded'], ['typed_embedded']))
    next(node for node in model.graph.node if node.op_type == 'Mul').input[0] = 'typed_embedded'
    onnx.checker.check_model(model, full_check=True)
    onnx.save(model, str(bundle / 'model.onnx'))


@pytest.mark.parametrize('type_dtype', [TensorProto.INT32, TensorProto.INT64])
def test_optional_native_token_types_are_real_tokenizer_values_not_blind_zeros(bundle, monkeypatch, type_dtype):
    _native_type_embeddings(bundle)
    _native_input_contract(bundle, {'token_type_ids': type_dtype})
    with _adapter()(bundle, max_length=4, threads=1, batch_size=3) as adapter:
        native_run = adapter._session.run
        feeds = []

        def record(outputs, values):
            feeds.append({name: value.copy() for name, value in values.items()})
            return native_run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record)
        texts = [' hello risk hello ', 'risk', '']
        result = adapter.predict(texts)
        expected = np.array([[6., -6.], [1., -1.], [0., 0.]])
        expected = np.exp(expected - expected.max(axis=1, keepdims=True))
        expected /= expected.sum(axis=1, keepdims=True)
        np.testing.assert_allclose(result['probabilities'], expected, atol=1e-7)
        np.testing.assert_array_equal(feeds[0]['token_type_ids'], [[0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]])
        assert feeds[0]['token_type_ids'].dtype == (np.dtype('int32') if type_dtype == TensorProto.INT32 else np.dtype('int64'))
        assert result['texts'] == texts and result['coverage'][0]['truncated_tokens'] == 1
        assert result['identity']['preprocessing']['view'] == 'native_single_prefix_no_windows'


@pytest.mark.parametrize('requested_batch', [2, 16])
def test_fixed_native_batch_one_runs_each_raw_text_in_order_without_fake_rows(bundle, monkeypatch, requested_batch):
    _native_input_contract(bundle, shape=(1, 'sequence'))
    with _adapter()(bundle, max_length=8, threads=1, batch_size=requested_batch) as adapter:
        native_run = adapter._session.run
        row_counts = []

        def record(outputs, values):
            row_counts.append(values['input_ids'].shape[0])
            return native_run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record)
        texts = ['risk', ' hello ', '']
        result = adapter.predict(texts)
        assert result['texts'] == texts
        assert row_counts == [1, 1, 1]
        assert result['predicted_labels'] == ['CLEAR', 'ALERT', 'ALERT']
        assert len(result['probabilities']) == len(result['coverage']) == len(texts)
        assert adapter.predict(())['probabilities'] == []


@pytest.mark.parametrize('batch_dimension', ['batch', 1])
def test_fixed_sequence_is_only_right_padding_not_a_different_prefix_view(bundle, monkeypatch, batch_dimension):
    _native_type_embeddings(bundle)
    _native_input_contract(bundle, {name: TensorProto.INT32 for name in ('input_ids', 'attention_mask', 'token_type_ids')},
                           shape=(batch_dimension, 8))
    with _adapter()(bundle, max_length=4, threads=1, batch_size=3) as adapter:
        native_run = adapter._session.run
        feeds = []

        def record(outputs, values):
            feeds.append({name: value.copy() for name, value in values.items()})
            return native_run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record)
        texts = ['  hello hello risk hello  ', 'unknown', '']
        result = adapter.predict(texts)
        assert result['texts'] == texts
        assert all(value.shape[1] == 8 for feed in feeds for value in feed.values())
        np.testing.assert_array_equal(feeds[0]['input_ids'][0], [2, 4, 4, 3, 0, 0, 0, 0])
        np.testing.assert_array_equal(feeds[0]['attention_mask'][0], [1, 1, 1, 1, 0, 0, 0, 0])
        np.testing.assert_array_equal(feeds[0]['token_type_ids'][0], [0, 1, 1, 0, 0, 0, 0, 0])
        first, unknown, empty = result['coverage']
        assert first['padded_length'] == unknown['padded_length'] == empty['padded_length'] == 8
        assert first['processed_tokens'] == 4 and first['content_tokens'] == 4
        assert first['processed_content_tokens'] == 2 and first['truncated_tokens'] == 2
        assert first['processed_char_spans'] == [[2, 7], [8, 13]]
        assert first['processed_token_range'] == [0, 2] and first['unprocessed_token_ranges'] == [[2, 4]]
        assert unknown['unknown_content_tokens'] == unknown['processed_unknown_tokens'] == 1
        assert empty['processed_tokens'] == 2 and empty['content_tokens'] == 0
        assert result['identity']['preprocessing']['max_length'] == 4
        expected = np.array([[10., -10.], [3., -3.], [0., 0.]])
        expected = np.exp(expected - expected.max(axis=1, keepdims=True))
        expected /= expected.sum(axis=1, keepdims=True)
        np.testing.assert_allclose(result['probabilities'], expected, atol=1e-7)


@pytest.mark.parametrize('change', ['input_dtype', 'missing_input', 'extra_input', 'duplicate_input',
    'input_rank', 'zero_width', 'conflicting_widths', 'output_name', 'output_dtype', 'output_classes',
    'output_batch', 'output_rank', 'fixed_to_dynamic'])
def test_real_ort_metadata_must_be_consistent_with_checked_native_signature(bundle, monkeypatch, change):
    from types import SimpleNamespace

    if change == 'fixed_to_dynamic':
        _native_input_contract(bundle, shape=(1, 8))
    module = importlib.import_module('eval_harness.inference')
    native = module.ort.InferenceSession
    roots = []

    def inconsistent_metadata(path, *args, **kwargs):
        session = native(path, *args, **kwargs)
        roots.append(Path(path).parent)
        inputs = [SimpleNamespace(name=value.name, type=value.type, shape=list(value.shape)) for value in session.get_inputs()]
        outputs = [SimpleNamespace(name=value.name, type=value.type, shape=list(value.shape)) for value in session.get_outputs()]
        if change == 'input_dtype': inputs[0].type = 'tensor(int32)'
        if change == 'missing_input': inputs.pop()
        if change == 'extra_input': inputs.append(SimpleNamespace(name='unexpected', type='tensor(int64)', shape=['batch', 'sequence']))
        if change == 'duplicate_input': inputs.append(inputs[0])
        if change == 'input_rank': inputs[0].shape = ['batch', 'sequence', 1]
        if change == 'zero_width': inputs[0].shape[1] = 0
        if change == 'conflicting_widths': inputs[0].shape[1], inputs[1].shape[1] = 4, 8
        if change == 'output_name': outputs[0].name = 'not_logits'
        if change == 'output_dtype': outputs[0].type = 'tensor(double)'
        if change == 'output_classes': outputs[0].shape[1] = 3
        if change == 'output_batch': outputs[0].shape[0] = 2
        if change == 'output_rank': outputs[0].shape = [2]
        if change == 'fixed_to_dynamic': inputs[0].shape[0] = None
        session.get_inputs = lambda: inputs
        session.get_outputs = lambda: outputs
        return session

    monkeypatch.setattr(module.ort, 'InferenceSession', inconsistent_metadata)
    with pytest.raises(ValueError, match='ORT.*signature|native.*signature'):
        _adapter()(bundle, max_length=4, threads=1)
    assert roots and all(not root.exists() for root in roots)


@pytest.mark.parametrize('bad_value', [float('nan'), float('inf'), -float('inf')])
def test_real_native_nonfinite_logits_fail_closed_even_after_an_earlier_valid_batch(bundle, bad_value):
    model = onnx.load(str(bundle / 'model.onnx'), load_external_data=False)
    table = next(tensor for tensor in model.graph.initializer if tensor.name == 'word_embeddings.weight')
    values = numpy_helper.to_array(table).copy()
    values[4, 0] = bad_value
    table.CopyFrom(numpy_helper.from_array(values, table.name))
    onnx.save(model, str(bundle / 'model.onnx'))
    with _adapter()(bundle, max_length=8, threads=1, batch_size=1) as adapter:
        assert adapter.predict(['risk'])['predicted_labels'] == ['CLEAR']
        with pytest.raises(ValueError, match='nonfinite native logits'):
            adapter.predict(['risk', 'hello'])


@pytest.mark.parametrize('rank', [0, 1, 3])
def test_native_runtime_output_rank_is_checked_before_softmax(bundle, monkeypatch, rank):
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        native_run = adapter._session.run

        def malformed(outputs, values):
            logits = native_run(outputs, values)[0]
            return [logits[0, 0] if rank == 0 else logits.ravel() if rank == 1 else logits[:, None, :]]

        monkeypatch.setattr(adapter._session, 'run', malformed)
        with pytest.raises(ValueError, match='native output rank'):
            adapter.predict(['hello', 'risk'])


@pytest.mark.parametrize('rows', [0, 1, 3])
def test_native_runtime_output_has_exactly_one_row_per_real_input(bundle, monkeypatch, rows):
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        native_run = adapter._session.run

        def malformed(outputs, values):
            logits = native_run(outputs, values)[0]
            return [logits[:rows] if rows < 2 else np.concatenate([logits, logits[:1]], axis=0)]

        monkeypatch.setattr(adapter._session, 'run', malformed)
        with pytest.raises(ValueError, match='native output row count'):
            adapter.predict(['hello', 'risk'])


@pytest.mark.parametrize('classes', [0, 1, 3])
def test_native_runtime_output_class_count_must_match_exact_native_labels(bundle, monkeypatch, classes):
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        native_run = adapter._session.run

        def malformed(outputs, values):
            logits = native_run(outputs, values)[0]
            return [logits[:, :classes] if classes < 2 else np.concatenate([logits, logits[:, :1]], axis=1)]

        monkeypatch.setattr(adapter._session, 'run', malformed)
        with pytest.raises(ValueError, match='native output class count'):
            adapter.predict(['hello', 'risk'])


@pytest.mark.parametrize('bad_value', [float('nan'), float('inf'), 0.0])
def test_nonfinite_probabilities_from_numeric_failure_are_never_returned(bundle, monkeypatch, bad_value):
    # Finite real logits cannot naturally cause this with stable softmax. Inject a
    # numeric-library failure only at exp, after a real native session has loaded.
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        monkeypatch.setattr(np, 'exp', lambda values: np.full_like(values, bad_value))
        with pytest.raises(ValueError, match='nonfinite native probabilities'):
            adapter.predict(['hello', 'risk'])


def _native_unknown_model(bundle, model_type, fallback):
    """Change only a UNIT-ONLY tokenizer's actual native fallback declaration."""
    path = bundle / 'tokenizer_config/tokenizer.json'
    tokenizer = Tokenizer.from_file(str(path))
    tokenizer.model = getattr(models, model_type)(VOCAB, unk_token=fallback)
    tokenizer.no_padding()
    tokenizer.no_truncation()
    tokenizer.save(str(path))
    return tokenizer


@pytest.mark.parametrize('model_type', ['WordLevel', 'WordPiece'])
@pytest.mark.parametrize(('native_unk', 'configured_unk'), [
    ('risk', '[UNK]'), ('[UNK]', 'risk'), ('risk', 'risk')])
def test_native_unknown_declarations_must_match_the_supported_exact_token(bundle, model_type, native_unk, configured_unk):
    native = _native_unknown_model(bundle, model_type, native_unk)
    config_path = bundle / 'tokenizer_config/tokenizer_config.json'
    config = json.loads(config_path.read_text(encoding='utf-8'))
    config['unk_token'] = configured_unk
    config_path.write_text(json.dumps(config), encoding='utf-8')
    assert native.get_vocab(with_added_tokens=True) == VOCAB
    assert json.loads((bundle / 'tokenizer_config/tokenizer.json').read_text())['model']['unk_token'] == native_unk
    assert native.encode('unseenunitword', add_special_tokens=False).ids == [VOCAB[native_unk]]
    with (
        pytest.raises(ValueError, match='tokenizer.*unk_token'),
        _adapter()(bundle, max_length=8, threads=1) as adapter,
    ):
        adapter.predict(['unseenunitword'])


@pytest.mark.parametrize('model_type', ['WordLevel', 'WordPiece'])
def test_supported_native_unknown_coverage_preserves_real_ids_and_prefix_counts(bundle, monkeypatch, model_type):
    native = _native_unknown_model(bundle, model_type, '[UNK]')
    text = 'hello unseenunitword risk unseenunitword'
    assert native.encode(text, add_special_tokens=False).ids == [4, 1, 5, 1]
    assert native.get_vocab(with_added_tokens=True) == VOCAB
    with _adapter()(bundle, max_length=4, threads=1) as adapter:
        run = adapter._session.run
        feeds = []

        def record(outputs, values):
            feeds.append(values['input_ids'].copy())
            return run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record)
        result = adapter.predict([text])
        coverage = result['coverage'][0]
        assert coverage['content_tokens'] == 4 and coverage['processed_content_tokens'] == 2
        assert coverage['unknown_content_tokens'] == 2 and coverage['processed_unknown_tokens'] == 1
        assert coverage['truncated_tokens'] == 2 and coverage['unprocessed_token_ranges'] == [[2, 4]]
        np.testing.assert_array_equal(feeds[0], [[2, 4, 1, 3]])
        expected = np.exp([2., -2.]) / np.exp([2., -2.]).sum()
        np.testing.assert_allclose(result['probabilities'][0], expected, atol=1e-7)
        assert result['identity']['tokenizer']['model_type'] == model_type


@pytest.mark.parametrize(('notes', 'interpretation'), [
    pytest.param('Temperature is ALREADY baked into the exported ONNX logits; do not divide again.',
                 'source_declares_baked_into_logits', id='original-affirmative'),
    pytest.param(
        'Temperature is ALREADY baked into the exported ONNX logits (OnnxWrapper divides before returning); '
        'do not divide again at inference. Thresholds and the OOD floor are applied in lib/ml/onnxBackend.ts. '
        'See threshold_audit.inert_thresholds for labels whose threshold cannot fail and what that does to the global floor.',
        'source_declares_baked_into_logits', id='recorded-wrapper-affirmative'),
    pytest.param('Temperature is not currently baked into the exported ONNX logits.',
                 'unverified_no_calibration_claim', id='explicit-negative'),
    pytest.param('Temperature has never been baked into the exported ONNX logits.',
                 'unverified_no_calibration_claim', id='negative-never'),
    pytest.param('Temperature may be baked into the exported ONNX logits.',
                 'unverified_no_calibration_claim', id='speculative'),
    pytest.param('If temperature is baked into the exported ONNX logits, do not divide again.',
                 'unverified_no_calibration_claim', id='conditional'),
    pytest.param("'Temperature is ALREADY baked into the exported ONNX logits; do not divide again.' is an unverified claim.",
                 'unverified_no_calibration_claim', id='quoted-unverified-claim'),
    pytest.param('Temperature is ALREADY baked into the exported ONNX logits; do not divide again. Export application is unverified.',
                 'unverified_no_calibration_claim', id='appended-uncertainty'),
    pytest.param(None, 'unverified_no_calibration_claim', id='unstructured-null'),
    pytest.param({'temperature': 'baked into ONNX logits'}, 'unverified_no_calibration_claim', id='unstructured-object'),
])
def test_calibration_notes_require_supported_literal_affirmatives_without_numeric_changes(bundle, notes, interpretation):
    texts = ['hello', 'risk', '', 'unseenunitword', 'hello risk']
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        baseline = adapter.predict(texts)
    source = {'temperature': 0.01, 'notes': notes, 'thresholds': [0.999, 0.001]}
    (bundle / 'calibration.json').write_text(json.dumps(source), encoding='utf-8')
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        result = adapter.predict(texts)
        np.testing.assert_array_equal(result['probabilities'], baseline['probabilities'])
        assert result['argmaxes'] == baseline['argmaxes']
        assert result['predicted_labels'] == baseline['predicted_labels']
        calibration = result['identity']['calibration']
        assert calibration['source'] == source
        assert calibration['external_temperature_applications'] == 0
        assert calibration['thresholds_applied'] is False and calibration['tenant_policy_certified'] is False
        assert calibration['interpretation'] == interpretation



def test_rejects_a_native_template_that_duplicates_a_after_empty_validation(bundle, monkeypatch):
    """Tiny UNIT-ONLY native graph/tokenizer: duplicated A must fail before ORT load."""
    path = bundle / 'tokenizer_config/tokenizer.json'
    tokenizer = Tokenizer.from_file(str(path))
    tokenizer.post_processor = processors.TemplateProcessing(
        single='[CLS] $A [SEP] $A', special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
    tokenizer.no_padding()
    tokenizer.no_truncation()
    assert tokenizer.encode('').ids == [2, 3]
    assert tokenizer.encode('').special_tokens_mask == [1, 1]
    text = 'hello risk risk hello'
    tokenizer.enable_truncation(max_length=4, direction='right', stride=0)
    assert tokenizer.encode(text).ids == [2, 4, 5, 3, 4, 5]
    tokenizer.save(str(path))
    module = importlib.import_module('eval_harness.inference')
    native_session = module.ort.InferenceSession
    loads = []

    def record_native_load(*args, **kwargs):
        loads.append(args[0])
        return native_session(*args, **kwargs)

    monkeypatch.setattr(module.ort, 'InferenceSession', record_native_load)
    with (
        pytest.raises(ValueError, match='unsupported native tokenizer post_processor single-sequence contract'),
        _adapter()(bundle, max_length=4, threads=1) as adapter,
    ):
        adapter.predict([text])
    assert loads == []


@pytest.mark.parametrize('fixed_padding', [False, True])
def test_runtime_encoded_length_cannot_exceed_requested_truncation_even_with_wider_padding(
        bundle, monkeypatch, fixed_padding):
    """UNIT-ONLY native-processor runtime fault; length is not the wider ONNX padding width."""
    if fixed_padding:
        _native_input_contract(bundle, shape=('batch', 8))
    with _adapter()(bundle, max_length=4, threads=1) as adapter:
        adapter._tokenizer.post_processor = processors.TemplateProcessing(
            single='[CLS] $A [SEP] $A', special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
        text = 'hello risk risk hello'
        assert adapter._tokenizer.encode(text).ids == [2, 4, 5, 3, 4, 5]
        assert adapter._full_tokenizer.encode(text, add_special_tokens=False).ids == [4, 5, 5, 4]
        run = adapter._session.run
        calls = []

        def record_native_run(outputs, values):
            calls.append(values['input_ids'].copy())
            return run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record_native_run)
        with pytest.raises(ValueError, match='native encoded length exceeds requested max_length'):
            adapter.predict([text])
        assert calls == []


@pytest.mark.parametrize('mismatch', ['ids', 'offsets'])
def test_native_content_must_match_the_genuine_prefix_before_any_batch_ort_call(bundle, monkeypatch, mismatch):
    """UNIT-ONLY native truncation-direction fault; offset-only non-prefixes also fail closed."""
    with _adapter()(bundle, max_length=4, threads=1, batch_size=2) as adapter:
        adapter._tokenizer.enable_truncation(max_length=4, direction='left', stride=0)
        text = 'hello hello risk risk' if mismatch == 'ids' else 'hello hello hello hello'
        encoded = adapter._tokenizer.encode(text)
        full = adapter._full_tokenizer.encode(text, add_special_tokens=False)
        content = [(token, span) for token, span, special in
                   zip(encoded.ids, encoded.offsets, encoded.special_tokens_mask) if not special]
        reference = list(zip(full.ids, full.offsets))
        assert len(encoded.ids) == adapter.max_length
        assert content != reference[:len(content)]
        if mismatch == 'offsets':
            assert [token for token, _ in content] == full.ids[:len(content)]
        run = adapter._session.run
        calls = []

        def record_native_run(outputs, values):
            calls.append(values['input_ids'].copy())
            return run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record_native_run)
        with pytest.raises(ValueError, match='native tokenizer content is not a genuine single prefix'):
            adapter.predict(['hello', text])
        assert calls == []


@pytest.mark.parametrize('template', ['[CLS] $A $A [SEP]', '[CLS] [SEP] $A',
                                      '$A [CLS] [SEP]', '[CLS] [SEP]', 'nested-duplicate-A'])
def test_other_empty_equivalent_processors_do_not_establish_the_supported_single_a_contract(bundle, monkeypatch, template):
    """GREEN native controls: zero A, duplicated A, misplaced boundaries, and unsupported nesting."""
    path = bundle / 'tokenizer_config/tokenizer.json'
    tokenizer = Tokenizer.from_file(str(path))
    single = '[CLS] $A [SEP] $A' if template == 'nested-duplicate-A' else template
    processor = processors.TemplateProcessing(single=single, special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
    tokenizer.post_processor = processors.Sequence([processor]) if template == 'nested-duplicate-A' else processor
    tokenizer.no_padding()
    tokenizer.no_truncation()
    assert tokenizer.encode('').ids == [2, 3]
    assert tokenizer.encode('').special_tokens_mask == [1, 1]
    tokenizer.save(str(path))
    module = importlib.import_module('eval_harness.inference')

    def forbidden(*args, **kwargs):
        pytest.fail('An unsupported single processor reached ORT')

    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden)
    with pytest.raises(ValueError, match='unsupported native tokenizer post_processor single-sequence contract'):
        _adapter()(bundle, max_length=4, threads=1)


@pytest.mark.parametrize('processor_kind', ['BertProcessing', 'RobertaProcessing'])
def test_native_single_a_boundary_processors_preserve_real_prefix_ids_offsets_and_unknown_counts(
        bundle, monkeypatch, processor_kind):
    """GREEN controls load/run real tiny native graphs; no serving or benchmark claim."""
    path = bundle / 'tokenizer_config/tokenizer.json'
    tokenizer = Tokenizer.from_file(str(path))
    tokenizer.post_processor = getattr(processors, processor_kind)(('[SEP]', 3), ('[CLS]', 2))
    tokenizer.no_padding()
    tokenizer.no_truncation()
    tokenizer.save(str(path))
    texts = ['  hello unseen risk hello  ', 'risk', '']
    reference = tokenizer.encode(texts[0], add_special_tokens=False)
    assert reference.ids == [4, 1, 5, 4]
    with _adapter()(bundle, max_length=4, threads=1, batch_size=2) as adapter:
        run = adapter._session.run
        feeds = []

        def record_native_run(outputs, values):
            feeds.append({name: value.copy() for name, value in values.items()})
            return run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record_native_run)
        result = adapter.predict(texts)
        assert result['texts'] == texts
        np.testing.assert_array_equal(feeds[0]['input_ids'], [[2, 4, 1, 3], [2, 5, 3, 0]])
        np.testing.assert_array_equal(feeds[0]['attention_mask'], [[1, 1, 1, 1], [1, 1, 1, 0]])
        coverage = result['coverage'][0]
        assert coverage['content_tokens'] == len(reference.ids) and coverage['processed_content_tokens'] == 2
        assert coverage['processed_char_spans'] == [list(span) for span in reference.offsets[:2]]
        assert coverage['unknown_content_tokens'] == coverage['processed_unknown_tokens'] == 1
        assert coverage['processed_token_range'] == [0, 2] and coverage['unprocessed_token_ranges'] == [[2, 4]]
        expected = np.exp([2., -2.]) / np.exp([2., -2.]).sum()
        np.testing.assert_allclose(result['probabilities'][0], expected, atol=1e-7)


def test_native_runtime_duplication_within_max_length_cannot_report_more_content_than_exists(bundle, monkeypatch):
    """GREEN UNIT-ONLY native-processor substitution; the genuine reference has only one A."""
    with _adapter()(bundle, max_length=8, threads=1) as adapter:
        adapter._tokenizer.post_processor = processors.TemplateProcessing(
            single='[CLS] $A [SEP] $A', special_tokens=[('[CLS]', 2), ('[SEP]', 3)])
        assert adapter._tokenizer.encode('hello').ids == [2, 4, 3, 4]
        assert adapter._full_tokenizer.encode('hello', add_special_tokens=False).ids == [4]
        run = adapter._session.run
        calls = []

        def record_native_run(outputs, values):
            calls.append(values['input_ids'].copy())
            return run(outputs, values)

        monkeypatch.setattr(adapter._session, 'run', record_native_run)
        with pytest.raises(ValueError, match='native tokenizer content is not a genuine single prefix'):
            adapter.predict(['hello'])
        assert calls == []


@pytest.mark.parametrize('declaration_fault', ['processor-not-mapping', 'single-not-list',
                                               'middle-not-sequence', 'middle-not-A'])
def test_single_processor_validation_branches_fail_closed_on_inconsistent_declarations(
        bundle, monkeypatch, declaration_fault):
    """GREEN UNIT-ONLY parsed-declaration substitution; native tokenizer bytes remain unmodified."""
    module = importlib.import_module('eval_harness.inference')
    read_json = module._read_json

    def inconsistent_declaration(path):
        raw = read_json(path)
        if Path(path).name == 'tokenizer.json':
            if declaration_fault == 'processor-not-mapping':
                raw['post_processor'] = 'UNIT-ONLY invalid processor mapping'
            elif declaration_fault == 'single-not-list':
                raw['post_processor']['single'] = None
            elif declaration_fault == 'middle-not-sequence':
                raw['post_processor']['single'][1] = {'SpecialToken': {'id': '[CLS]', 'type_id': 0}}
            else:
                raw['post_processor']['single'][1]['Sequence']['id'] = 'B'
        return raw

    def forbidden(*args, **kwargs):
        pytest.fail('Inconsistent processor declarations reached ORT')

    monkeypatch.setattr(module, '_read_json', inconsistent_declaration)
    monkeypatch.setattr(module.ort, 'InferenceSession', forbidden)
    with pytest.raises(ValueError, match='unsupported native tokenizer post_processor single-sequence contract'):
        _adapter()(bundle, max_length=4, threads=1)



def _unit_cleanup_diagnostic_action(unit_root, monkeypatch, seam, primary, cleanup):
    "No model files/sessions: explicit snapshot failure injection, not a Windows lock."
    import weakref

    native = importlib.import_module("eval_harness.inference")
    status = importlib.import_module("eval_harness.model_status")
    assert status.OnnxAdapter is native.OnnxAdapter
    state = {"cleanup_calls": 0, "consumer_states": []}

    class Snapshot:
        name = str(unit_root / "private-no-model-snapshot")
        owner = staticmethod(lambda: None)

        def cleanup(self):
            state["cleanup_calls"] += 1
            owner = self.owner()
            if owner is not None:
                state["consumer_states"].append({
                    "closed": owner._closed,
                    "session_released": owner._session is None,
                    "model_released": owner._model is None,
                    "tokenizer_released": owner._tokenizer is None,
                    "full_tokenizer_released": owner._full_tokenizer is None})
            if cleanup is not None:
                raise cleanup

    snapshot = Snapshot()

    def forbidden_native_session(*args, **kwargs):
        pytest.fail("UNIT-ONLY diagnostic injection must not load a native session")

    monkeypatch.setattr(native.ort, "InferenceSession", forbidden_native_session)

    if seam in ("capture", "status-capture"):
        def reject_capture(*args):
            raise primary

        monkeypatch.setattr(native.tempfile, "TemporaryDirectory", lambda **kwargs: snapshot)
        monkeypatch.setattr(native, "_confined", reject_capture)
    else:
        monkeypatch.setattr(native, "_capture_bundle", lambda root: (snapshot, {}))

        class RejectingIdentity:
            def __deepcopy__(self, memo):
                raise primary

        def initialize(adapter, root, max_length, threads):
            snapshot.owner = weakref.ref(adapter)
            for name in ("_session", "_model", "_tokenizer", "_full_tokenizer"):
                setattr(adapter, name, object())
            adapter._closed = False
            adapter._identity = RejectingIdentity() if seam == "status-context-exit" else {}
            if seam in ("constructor", "status-constructor"):
                raise primary

        monkeypatch.setattr(native.OnnxAdapter, "_initialize", initialize)

    if seam.startswith("status-"):
        # Only structural preflight is synthetic; the real API/adapter/error publication run.
        required = {unit_root / name for name in native._REQUIRED_COMPONENTS}
        is_file = Path.is_file
        monkeypatch.setattr(Path, "is_file", lambda path: path in required or is_file(path))
        monkeypatch.setattr(status, "_component_paths", lambda root, external: [])
        monkeypatch.setattr(status, "_declared_metadata", lambda *args: ({}, {"vocab_size": 0}))

    def action():
        if seam.startswith("status-"):
            return status.inspect_location(unit_root.parent, {"location": unit_root.name},
                                           max_length=8, threads=1)
        if seam == "capture":
            return native._capture_bundle(unit_root)
        if seam == "constructor":
            return native.OnnxAdapter(unit_root, max_length=8, threads=1)
        with native.OnnxAdapter(unit_root, max_length=8, threads=1):
            if primary is not None:
                raise primary

    return action, state


@pytest.mark.parametrize("seam,kind", [
    (seam, "value") for seam in ("capture", "constructor", "context-exit", "status-capture",
                                "status-constructor", "status-context-exit")
] + [("capture", "oserror"), ("context-exit", "keyboard-primary"),
     ("context-exit", "system-exit-primary"), ("context-exit", "asyncio-primary"),
     ("context-exit", "keyboard-cleanup"), ("context-exit", "system-exit-cleanup")])
def test_primary_and_cleanup_diagnostic_text_is_observable(monkeypatch, seam, kind):
    "Desired behavior: str(exc)/actual API reasons retain BOTH simultaneous failures."
    import asyncio

    primary = ValueError(f"UNIT-ONLY primary {seam} rejection")
    cleanup = PermissionError(13, "UNIT-ONLY secondary snapshot cleanup rejection", "UNIT-ONLY/private")
    if kind == "oserror":
        primary = PermissionError(5, "UNIT-ONLY primary capture I/O rejection", "UNIT-ONLY/source")
    elif kind == "keyboard-primary":
        primary = KeyboardInterrupt("UNIT-ONLY primary cancellation")
    elif kind == "system-exit-primary":
        primary = SystemExit(7)
    elif kind == "asyncio-primary":
        primary = asyncio.CancelledError("UNIT-ONLY primary task cancellation")
    elif kind == "keyboard-cleanup":
        cleanup = KeyboardInterrupt("UNIT-ONLY cleanup cancellation")
    elif kind == "system-exit-cleanup":
        cleanup = SystemExit(9)
    primary_text, cleanup_text = str(primary), str(cleanup)
    cancellation = (primary if not isinstance(primary, Exception)
                    else cleanup if not isinstance(cleanup, Exception) else None)
    with tempfile.TemporaryDirectory(prefix="native-diagnostics-unit-only-", dir=SCRATCH) as name:
        unit_root = Path(name)
        with monkeypatch.context() as patch:
            action, state = _unit_cleanup_diagnostic_action(unit_root, patch, seam, primary, cleanup)
            record = None
            error = None
            if seam.startswith("status-"):
                record = action()
                message = "\n".join(record["reasons"])
            else:
                with pytest.raises(BaseException) as caught:
                    action()
                error = caught.value
                message = str(error)
            observation = {"kind": "NO-MODEL UNIT-ONLY explicit diagnostic fault injection",
                           "seam": seam, "failure_kind": kind, "primary_text": primary_text,
                           "cleanup_text": cleanup_text, "observable_message": message,
                           "exception_type": type(error).__name__ if error is not None else None,
                           "actual_status_API_record": record, "state_before_fixture_teardown": state,
                           "fixture_root": name, "model_files_created": 0, "native_sessions_loaded": 0}
            print("NATIVE_DIAGNOSTIC_UNIT_ONLY", json.dumps(observation))
            assert state["cleanup_calls"] == 1
            assert len(state["consumer_states"]) == (0 if seam in ("capture", "status-capture") else 1)
            assert all(all(row.values()) for row in state["consumer_states"])
            assert primary_text in message, "Primary rejection is absent from the observable diagnostic"
            assert cleanup_text in message, "Cleanup rejection is absent from the observable diagnostic"
            if cancellation is not None:
                assert error is cancellation
                if isinstance(cancellation, SystemExit):
                    assert cancellation.code == (7 if kind == "system-exit-primary" else 9)
            elif record is None:
                assert isinstance(error, Exception)
            if record is not None:
                assert record["status"] == "error"
                assert record["structural_availability"] is False
                assert record["native_runtime_loaded"] is False
                assert record["native_signature"] is record["identity"] is None
                assert record["predictions_run"] is record["scored_benchmarks"] is False


@pytest.mark.parametrize("seam", ["capture", "constructor", "context-exit"])
@pytest.mark.parametrize("kind", ["value", "keyboard", "system-exit", "asyncio"])
def test_cleanup_diagnostic_primary_without_cleanup_failure_is_unchanged(monkeypatch, seam, kind):
    "Already-green controls: successful cleanup neither swallows nor replaces a primary."
    import asyncio

    primary = {"value": ValueError("UNIT-ONLY normal rejection"),
               "keyboard": KeyboardInterrupt("UNIT-ONLY cancellation"),
               "system-exit": SystemExit(7), "asyncio": asyncio.CancelledError("UNIT-ONLY task")}[kind]
    original_text = str(primary)
    with tempfile.TemporaryDirectory(prefix="native-diagnostic-control-unit-only-", dir=SCRATCH) as name, monkeypatch.context() as patch:
        action, state = _unit_cleanup_diagnostic_action(Path(name), patch, seam, primary, None)
        with pytest.raises(BaseException) as caught:
            action()
        assert caught.value is primary
        assert str(caught.value) == original_text
        assert state["cleanup_calls"] == 1
        assert len(state["consumer_states"]) == (0 if seam in ("capture", "status-capture") else 1)
        assert all(all(row.values()) for row in state["consumer_states"])


@pytest.mark.parametrize("kind", ["permission", "keyboard", "system-exit"])
def test_cleanup_diagnostic_cleanup_only_error_is_unchanged(monkeypatch, kind):
    "Already-green controls: a normal context exit still propagates its cleanup-only error."
    cleanup = {"permission": PermissionError(13, "UNIT-ONLY cleanup-only rejection", "UNIT-ONLY/private"),
               "keyboard": KeyboardInterrupt("UNIT-ONLY cleanup cancellation"), "system-exit": SystemExit(9)}[kind]
    original_text = str(cleanup)
    with tempfile.TemporaryDirectory(prefix="native-diagnostic-control-unit-only-", dir=SCRATCH) as name, monkeypatch.context() as patch:
        action, state = _unit_cleanup_diagnostic_action(Path(name), patch, "context-exit", None, cleanup)
        with pytest.raises(BaseException) as caught:
            action()
        assert caught.value is cleanup
        assert str(caught.value) == original_text
        assert state["cleanup_calls"] == 1
        assert len(state["consumer_states"]) == 1
        assert all(all(row.values()) for row in state["consumer_states"])
