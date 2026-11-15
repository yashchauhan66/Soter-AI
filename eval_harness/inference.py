"""Offline native ONNX classifier adapter; no guard/tenant-policy decisions."""
from __future__ import annotations

import copy
import hashlib
import importlib.metadata
import json
import platform
import re
import tempfile
from pathlib import Path, PureWindowsPath

import numpy as np
import onnx
import onnxruntime as ort
from tokenizers import Tokenizer

_OPTIONAL_COMPONENTS = (
    'calibration.json', 'config.json', 'encoder_config.json', 'training_stats.json',
    'model.onnx.manifest.json', 'recovery_manifest.json', 'thresholds.json',
    'tokenizer_config/added_tokens.json', 'tokenizer_config/special_tokens_map.json',
    'tokenizer_config/vocab.txt', 'tokenizer_config/config.json',
    'tokenizer_config/chat_template.jinja',
)
_REQUIRED_COMPONENTS = ('model.onnx', 'labels.json', 'tokenizer_config/tokenizer.json',
                        'tokenizer_config/tokenizer_config.json')


def _json_digest(value):
    raw = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _component_paths(root, external):
    """The inference bundle excludes unconsumed training weights and datasets."""
    paths: set[str] = set(_REQUIRED_COMPONENTS)
    paths.update(path.relative_to(root).as_posix() for path in external)
    paths.update(name for name in _OPTIONAL_COMPONENTS if _confined(root, name).is_file())
    tokdir = _confined(root, 'tokenizer_config')
    if tokdir.is_dir():
        paths.update(path.relative_to(root).as_posix() for path in tokdir.rglob('*') if path.is_file())
    return sorted(paths)


def _components(root, external):
    external_names = {path.relative_to(root).as_posix() for path in external}
    result = []
    for name in _component_paths(root, external):
        path = _confined(root, name)
        role = ('onnx' if name == 'model.onnx' else 'external_weights' if name in external_names
                else 'labels' if name == 'labels.json' else 'native_tokenizer' if name in _REQUIRED_COMPONENTS
                else 'calibration_metadata' if name == 'calibration.json' else 'provenance_sidecar')
        with path.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
            size = handle.tell()
        result.append({'path': name, 'role': role, 'sha256': digest, 'bytes': size,
                       'consumption': 'native_runtime' if role in {'onnx', 'external_weights', 'labels', 'native_tokenizer'}
                                      else 'identity_only_no_runtime_override'})
    return result


def _runtime_signature(session):
    return {kind: [{'name': item.name, 'dtype': item.type, 'shape': list(item.shape)} for item in values]
            for kind, values in (('inputs', session.get_inputs()), ('outputs', session.get_outputs()))}


def _read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f'duplicate JSON key {key!r}')
            result[key] = value
        return result
    try:
        return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique,
                          parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'nonfinite {value}')))
    except (ValueError, OSError) as exc:
        raise ValueError(f'{path.name}: {exc}') from exc


def _tensors(message):
    """Traverse every protobuf tensor, including nested graphs/functions/sparse tensors."""
    if isinstance(message, onnx.TensorProto):
        yield message
    else:
        for field, value in message.ListFields():
            if field.type == field.TYPE_MESSAGE:
                for child in value if field.is_repeated else [value]:
                    yield from _tensors(child)


def _confined(root, location):
    parts = location.replace('\\', '/').split('/')
    if (not location or '\x00' in location or ':' in location or PureWindowsPath(location).anchor
            or location.startswith('/') or '..' in parts):
        raise ValueError(f'unsafe external/bundle reference {location!r}')
    path = (root / Path(*parts)).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f'out-of-directory external/bundle reference {location!r}')
    return path


def _external_locations(root, model):
    references = {}
    for tensor in _tensors(model):
        if tensor.data_location != onnx.TensorProto.EXTERNAL and not tensor.external_data:
            continue
        fields = {item.key: item.value for item in tensor.external_data}
        if tensor.data_location != onnx.TensorProto.EXTERNAL or len(fields) != len(tensor.external_data):
            raise ValueError('invalid external tensor metadata')
        location = fields.get('location', '')
        target = _confined(root, location)
        if not target.is_file():
            raise ValueError(f'missing external weights: {target}')
        name = Path(*location.replace('\\', '/').split('/')).as_posix()
        references[name] = target
    return sorted(references.items())


def _raise_cleanup_diagnostic(primary, cleanup):
    """Keep both failures visible without replacing cancellation identity or exit codes."""
    message = f'PRIMARY: {primary}; SECONDARY snapshot cleanup: {cleanup}'
    if not isinstance(primary, Exception):
        if isinstance(primary, BaseExceptionGroup):
            # Group str is message-backed; notes preserve its immutable payload.
            primary.add_note(message)
        else:
            primary.args = (message,)
        raise primary from cleanup
    if not isinstance(cleanup, Exception):
        if isinstance(cleanup, BaseExceptionGroup):
            cleanup.add_note(message)
        else:
            cleanup.args = (message,)
        raise cleanup from primary
    raise RuntimeError(message) from primary


def _capture_bundle(root):
    """Copy each source once into a private per-adapter directory, hashing those exact bytes.

    All later consumers read only that snapshot, never the mutable original bundle.
    At most one bounded streaming buffer is needed, even for external weight files.
    """
    temporary = tempfile.TemporaryDirectory(prefix='onnx-adapter-snapshot-')
    captured = Path(temporary.name).resolve()
    hashes = {}

    def capture(name):
        source = _confined(root, name)
        target = _confined(captured, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        size = 0
        with source.open('rb') as incoming, target.open('xb') as outgoing:
            while data := incoming.read(1024 * 1024):
                outgoing.write(data)
                digest.update(data)
                size += len(data)
        hashes[name] = (digest.hexdigest(), size)

    try:
        capture('model.onnx')
        try:
            model = onnx.load(str(captured / 'model.onnx'), load_external_data=False)
        except Exception as exc:
            raise ValueError(f'model.onnx could not be parsed: {exc}') from exc
        references = _external_locations(root, model)
        for name in _component_paths(root, [root / name for name, _ in references]):
            if name not in hashes:
                capture(name)
        return temporary, hashes
    except BaseException as primary:
        try:
            temporary.cleanup()
        except BaseException as cleanup:  # noqa: BLE001 - Re-raise cancellations with both failures.
            _raise_cleanup_diagnostic(primary, cleanup)
        raise


def _checked_model(root):
    path = _confined(root, 'model.onnx')
    try:
        model = onnx.load(str(path), load_external_data=False)
    except Exception as exc:
        raise ValueError(f'model.onnx could not be parsed: {exc}') from exc
    external = {target for _, target in _external_locations(root, model)}
    try:
        onnx.checker.check_model(str(path), full_check=True)
    except Exception as exc:
        raise ValueError(f'ONNX checking failed: {exc}') from exc
    return model, sorted(external)


def _signature(value):
    tensor = value.type.tensor_type
    return {'name': value.name, 'dtype': onnx.TensorProto.DataType.Name(tensor.elem_type),
            'shape': [d.dim_value if d.HasField('dim_value') else d.dim_param or None for d in tensor.shape.dim]}


def _contract(model, labels):
    inputs, outputs = [_signature(v) for v in model.graph.input], [_signature(v) for v in model.graph.output]
    return _contract_values(inputs, outputs, labels)


def _contract_values(inputs, outputs, labels):
    names = {item['name'] for item in inputs}
    if (len(names) != len(inputs) or not {'input_ids', 'attention_mask'} <= names
            or not names <= {'input_ids', 'attention_mask', 'token_type_ids'}):
        raise ValueError('unsupported native input signature; integer token IDs and attention_mask required')
    for item in inputs:
        if item['dtype'] not in ('INT32', 'INT64') or len(item['shape']) != 2:
            raise ValueError('unsupported native input signature dtype/rank')
        if any(type(d) is int and d <= 0 for d in item['shape']):
            raise ValueError('invalid native input signature dimensions')
    if (len(outputs) != 1 or outputs[0]['name'] != 'logits' or outputs[0]['dtype'] not in ('FLOAT', 'FLOAT16', 'DOUBLE')
            or len(outputs[0]['shape']) != 2 or outputs[0]['shape'][1] != len(labels)):
        raise ValueError('unsupported native output signature; logits [batch, native_labels] required')
    batches = {i['shape'][0] for i in inputs + outputs if type(i['shape'][0]) is int}
    widths = {i['shape'][1] for i in inputs if type(i['shape'][1]) is int}
    if batches - {1} or len(widths) > 1:
        raise ValueError('unsupported native signature fixed batch/sequence dimensions')
    return inputs, outputs, 1 if batches else None, next(iter(widths), None)


def _validated_runtime_signature(session, inputs, outputs, labels):
    """Compare the real ORT NodeArgs to the checked ONNX contract, not guessed feeds."""
    signature = _runtime_signature(session)
    dtypes = {'tensor(int32)': 'INT32', 'tensor(int64)': 'INT64', 'tensor(float)': 'FLOAT',
              'tensor(float16)': 'FLOAT16', 'tensor(double)': 'DOUBLE'}
    actual: dict[str, list[dict]] = {kind: [dict(item, dtype=dtypes.get(item['dtype'])) for item in signature[kind]]
              for kind in ('inputs', 'outputs')}
    try:
        _, _, fixed_batch, fixed_width = _contract_values(actual['inputs'], actual['outputs'], labels)
        for kind, declared in (('inputs', inputs), ('outputs', outputs)):
            by_name = {item['name']: item for item in actual[kind]}
            if set(by_name) != {item['name'] for item in declared}:
                raise ValueError('names differ from checked ONNX signature')
            for item in declared:
                native = by_name[item['name']]
                if native['dtype'] != item['dtype']:
                    raise ValueError(f'{item["name"]} dtype differs from checked ONNX signature')
                for expected, observed in zip(item['shape'], native['shape']):
                    if type(expected) is int and (type(observed) is not int or observed != expected):
                        raise ValueError(f'{item["name"]} dimension differs from checked ONNX signature')
    except ValueError as exc:
        raise ValueError(f'ORT native signature is inconsistent: {exc}') from exc
    return signature, fixed_batch, fixed_width


def _native_tokenizer(root, model, max_length, fixed_width):
    path = _confined(root, 'tokenizer_config/tokenizer.json')
    config = _read_json(_confined(root, 'tokenizer_config/tokenizer_config.json'))
    raw = _read_json(path)
    native = raw.get('model', {}) if isinstance(raw, dict) else {}
    vocab = native.get('vocab')
    if native.get('type') not in ('WordPiece', 'WordLevel') or not isinstance(vocab, dict) or not vocab:
        raise ValueError('unsupported native tokenizer model')
    if native.get('unk_token') != '[UNK]':
        raise ValueError('unsupported native tokenizer model unk_token; exact [UNK] required for coverage')
    if (any(type(i) is not int or i < 0 for i in vocab.values())
            or set(vocab.values()) != set(range(len(vocab)))):
        raise ValueError('tokenizer vocabulary has invalid, duplicate or noncontiguous IDs')
    if not isinstance(config, dict) or any(config.get(key, 'right') != 'right' for key in ('padding_side', 'truncation_side')):
        raise ValueError('unsupported native tokenizer padding/truncation; prefix view requires right sides')
    bounds = {int(t.dims[0]) for t in model.graph.initializer if 'word_embeddings' in t.name and len(t.dims) == 2}
    if len(bounds) != 1 or min(bounds) < 1:
        raise ValueError('unsupported tokenizer/model vocabulary bound; no reconstructable word embedding table')
    vocab_bound = next(iter(bounds))
    limits = [int(t.dims[0]) for t in model.graph.initializer if 'position_embeddings' in t.name and len(t.dims) == 2]
    config_limit = config.get('model_max_length')
    if config_limit is not None:
        if type(config_limit) is not int or config_limit < 2:
            raise ValueError('tokenizer model_max_length must be an integer >= 2')
        limits.append(config_limit)
    if fixed_width is not None:
        limits.append(fixed_width)
    if not limits or max_length > min(limits):
        raise ValueError('max_length exceeds or lacks a verified tokenizer/model sequence bound')
    try:
        tokenizer = Tokenizer.from_file(str(path))
    except Exception as exc:
        raise ValueError(f'tokenizer could not be loaded: {exc}') from exc
    full_vocab = tokenizer.get_vocab(with_added_tokens=True)
    if set(full_vocab.values()) != set(range(len(full_vocab))) or max(full_vocab.values()) >= vocab_bound:
        raise ValueError('tokenizer IDs exceed native model vocabulary bounds')
    specials = {}
    for key, token in (('cls_token', '[CLS]'), ('sep_token', '[SEP]'), ('pad_token', '[PAD]'), ('unk_token', '[UNK]')):
        if config.get(key, token) != token or tokenizer.token_to_id(token) is None:
            raise ValueError(f'tokenizer requires exact native {key} {token!r}')
        specials[token] = tokenizer.token_to_id(token)
    tokenizer.no_padding()
    tokenizer.no_truncation()
    empty = tokenizer.encode('')
    if (empty.ids != [specials['[CLS]'], specials['[SEP]']] or empty.special_tokens_mask != [1, 1]
            or empty.type_ids != [0, 0]):
        raise ValueError('unsupported native tokenizer post_processor special-token contract')
    processor = raw.get('post_processor', {})
    kind = processor.get('type') if isinstance(processor, dict) else None
    if kind == 'TemplateProcessing':
        single = processor.get('single')
        if (not isinstance(single, list) or len(single) != 3
                or single[0] != {'SpecialToken': {'id': '[CLS]', 'type_id': 0}}
                or single[2] != {'SpecialToken': {'id': '[SEP]', 'type_id': 0}}
                or set(single[1]) != {'Sequence'} or single[1]['Sequence'].get('id') != 'A'):
            raise ValueError('unsupported native tokenizer post_processor single-sequence contract')
    elif kind not in {'BertProcessing', 'RobertaProcessing'}:
        raise ValueError('unsupported native tokenizer post_processor single-sequence contract')
    return tokenizer, specials, {'model_max_length': min(limits), 'vocab_bound': vocab_bound,
                                 'vocab_size': len(full_vocab), 'model_type': native['type']}


def _calibration(root):
    path = _confined(root, 'calibration.json')
    source = _read_json(path) if path.exists() else None
    interpretation = 'missing_no_calibration_claim' if source is None else 'unverified_no_calibration_claim'
    notes = source.get('notes', '') if isinstance(source, dict) else ''
    # Recognize only the supported literal source declarations, not arbitrary prose
    # or proof that the exported graph numerically applies temperature.
    affirmative_notes = (
        'Temperature is ALREADY baked into the exported ONNX logits; do not divide again.',
        (
            'Temperature is ALREADY baked into the exported ONNX logits (OnnxWrapper divides before returning); '
            'do not divide again at inference. Thresholds and the OOD floor are applied in lib/ml/onnxBackend.ts. '
            'See threshold_audit.inert_thresholds for labels whose threshold cannot fail and what that does to the global floor.'
        ),
    )
    if isinstance(notes, str) and notes in affirmative_notes:
        interpretation = 'source_declares_baked_into_logits'
    return {'source': source, 'interpretation': interpretation, 'external_temperature_applications': 0,
            'thresholds_applied': False, 'tenant_policy_certified': False}


class OnnxAdapter:
    def __init__(self, directory, max_length=256, threads=2, batch_size=16):
        self._closed = True
        self._session = None
        self._snapshot = None
        for name, value, minimum in (('max_length', max_length, 2), ('threads', threads, 1), ('batch_size', batch_size, 1)):
            if type(value) is not int or value < minimum:
                raise ValueError(f'{name} must be an integer >= {minimum}')
        self.directory = Path(directory).resolve()
        self.max_length = max_length
        self.batch_size = batch_size
        try:
            self._snapshot, self._captured_hashes = _capture_bundle(self.directory)
            self._initialize(Path(self._snapshot.name).resolve(), max_length, threads)
        except BaseException as primary:
            try:
                self.close()
            except BaseException as cleanup:  # noqa: BLE001 - Re-raise cancellations with both failures.
                _raise_cleanup_diagnostic(primary, cleanup)
            raise

    def _initialize(self, root, max_length, threads):
        self._model, self._external = _checked_model(root)
        raw = _read_json(root / 'labels.json')
        if not isinstance(raw, dict) or not raw or set(raw) != {str(i) for i in range(len(raw))}:
            raise ValueError('labels.json must map contiguous exact IDs 0..N-1')
        if any(not isinstance(label, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]*', label) for label in raw.values()):
            raise ValueError('labels.json contains invalid native label tokens; no normalization is allowed')
        if len(set(raw.values())) != len(raw):
            raise ValueError('labels.json contains duplicate labels')
        self.labels = tuple(raw[str(i)] for i in range(len(raw)))
        self._inputs, self._outputs, self._fixed_batch, self._fixed_width = _contract(self._model, self.labels)
        self._tokenizer, specials, self._tokenizer_info = _native_tokenizer(
            root, self._model, max_length, self._fixed_width)
        self._full_tokenizer = Tokenizer.from_str(self._tokenizer.to_str())
        self._tokenizer.enable_truncation(max_length=max_length, direction='right', stride=0)
        self._pad, self._unk = specials['[PAD]'], specials['[UNK]']
        calibration = _calibration(root)
        components = _components(root, self._external)
        if {item['path']: (item['sha256'], item['bytes']) for item in components} != self._captured_hashes:
            raise ValueError('captured bundle identity changed before native loading')
        absent = sorted(name for name in _OPTIONAL_COMPONENTS if name not in {item['path'] for item in components})
        calibration.update({'present': 'calibration.json' not in absent,
                            'sha256': next((item['sha256'] for item in components if item['path'] == 'calibration.json'), None)})
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        self._session = ort.InferenceSession(str(root / 'model.onnx'),
                                             sess_options=options, providers=['CPUExecutionProvider'])
        signature, self._fixed_batch, self._fixed_width = _validated_runtime_signature(
            self._session, self._inputs, self._outputs, self.labels)
        if self._fixed_width is not None:
            if max_length > self._fixed_width:
                raise ValueError('max_length exceeds real ORT native signature sequence bound')
            self._tokenizer_info['model_max_length'] = min(self._tokenizer_info['model_max_length'], self._fixed_width)
        consumed = _components(root, self._external)
        if {item['path']: (item['sha256'], item['bytes']) for item in consumed} != self._captured_hashes:
            raise ValueError('captured bundle identity changed during native loading')
        self._identity = {
            'schema_version': 1, 'identity_kind': 'offline_native_inference_bundle_sha256_v1',
            'components': components, 'absent_components': absent,
            'total_bytes': sum(item['bytes'] for item in components),
            'bundle_sha256': _json_digest({'components': components, 'absent_components': absent}),
            'labels': list(self.labels), 'calibration': calibration,
            'declared_signature': {'inputs': self._inputs, 'outputs': self._outputs},
            'native_signature': signature, 'tokenizer': self._tokenizer_info,
            'preprocessing': {'view': 'native_single_prefix_no_windows', 'max_length': max_length,
                              'padding_side': 'right', 'truncation_side': 'right', 'stride': 0,
                              'raw_text_preserved': True, 'normalization': 'native_tokenizer_json_only'},
            'runtime': {'python': platform.python_version(), 'numpy': np.__version__, 'onnx': onnx.__version__,
                        'onnxruntime': ort.__version__, 'tokenizers': importlib.metadata.version('tokenizers'),
                        'providers': self._session.get_providers(), 'intra_op_threads': threads, 'inter_op_threads': 1},
        }
        self._identity['composite_sha256'] = _json_digest(self._identity)
        self._model = None  # ORT owns the loaded tensors; do not retain a second protobuf weight copy.
        self._closed = False

    @property
    def identity(self):
        """Return a copy so callers cannot mutate the adapter's reported identity."""
        return copy.deepcopy(self._identity)

    def close(self):
        """Release the native session; closing twice is harmless."""
        self._closed = True
        self._session = None
        self._model = None
        self._tokenizer = None
        self._full_tokenizer = None
        if self._snapshot is not None:
            self._snapshot.cleanup()
            self._snapshot = None

    def __enter__(self):
        if self._closed:
            raise RuntimeError('ONNX adapter is closed')
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self.close()
        except BaseException as cleanup:
            if exc_value is None:
                raise
            _raise_cleanup_diagnostic(exc_value, cleanup)

    def predict(self, texts):
        if self._closed or self._session is None or self._tokenizer is None or self._full_tokenizer is None:
            raise RuntimeError('ONNX adapter is closed')
        if not isinstance(texts, (list, tuple)) or any(type(text) is not str for text in texts):
            raise ValueError('texts must be a list or tuple of strings, preserving input order')
        texts = list(texts)
        probabilities = []
        coverage = []
        batch_size = 1 if self._fixed_batch == 1 else self.batch_size
        for start in range(0, len(texts), batch_size):
            encoded = self._tokenizer.encode_batch(texts[start:start + batch_size])
            if any(len(item.ids) > self.max_length for item in encoded):
                raise ValueError('native encoded length exceeds requested max_length; no predictions returned')
            full = self._full_tokenizer.encode_batch(texts[start:start + batch_size], add_special_tokens=False)
            width = self._fixed_width if self._fixed_width is not None else max(len(e.ids) for e in encoded)
            ids = np.full((len(encoded), width), self._pad, dtype=np.int64)
            mask = np.zeros_like(ids)
            types = np.zeros_like(ids)
            for index, item in enumerate(encoded):
                ids[index, :len(item.ids)] = item.ids
                mask[index, :len(item.ids)] = item.attention_mask
                types[index, :len(item.ids)] = item.type_ids
                content = [(token, span) for token, span, special in zip(item.ids, item.offsets, item.special_tokens_mask) if not special]
                reference = list(zip(full[index].ids, full[index].offsets))
                if content != reference[:len(content)]:
                    raise ValueError('native tokenizer content is not a genuine single prefix; no predictions returned')
                total, processed = len(full[index].ids), len(content)
                coverage.append({'content_tokens': total, 'processed_content_tokens': processed,
                    'special_tokens': sum(item.special_tokens_mask), 'processed_tokens': len(item.ids),
                    'padded_length': width, 'truncated_tokens': total - processed, 'truncated': total > processed,
                    'processed_token_range': [0, processed],
                    'unprocessed_token_ranges': [[processed, total]] if total > processed else [],
                    'processed_char_spans': [list(span) for _, span in content],
                    'unknown_content_tokens': full[index].ids.count(self._unk),
                    'processed_unknown_tokens': sum(token == self._unk for token, _ in content),
                    'coverage_kind': 'native_single_prefix_no_windows'})
            source_inputs = {'input_ids': ids, 'attention_mask': mask, 'token_type_ids': types}
            feed = {item['name']: source_inputs[item['name']].astype(
                        np.int32 if item['dtype'] == 'INT32' else np.int64, copy=False) for item in self._inputs}
            logits = np.asarray(self._session.run(['logits'], feed)[0], dtype=np.float64)
            if logits.ndim != 2:
                raise ValueError(f'incorrect native output rank: expected 2, got {logits.ndim}')
            if logits.shape[0] != len(encoded):
                raise ValueError(f'incorrect native output row count: expected {len(encoded)}, got {logits.shape[0]}')
            if logits.shape[1] != len(self.labels):
                raise ValueError(f'incorrect native output class count: expected {len(self.labels)}, got {logits.shape[1]}')
            if not np.isfinite(logits).all():
                raise ValueError('nonfinite native logits; no predictions returned')
            with np.errstate(over='ignore', under='ignore', invalid='ignore', divide='ignore'):
                values = np.exp(logits - logits.max(axis=1, keepdims=True))
                values /= values.sum(axis=1, keepdims=True)
            if not np.isfinite(values).all():
                raise ValueError('nonfinite native probabilities; no predictions returned')
            probabilities.extend(values.tolist())
        argmaxes = [int(np.argmax(p)) for p in probabilities]
        return {'texts': texts, 'labels': list(self.labels), 'probabilities': probabilities,
                'named_probabilities': [dict(zip(self.labels, p)) for p in probabilities],
                'argmaxes': argmaxes, 'predicted_labels': [self.labels[i] for i in argmaxes],
                'coverage': coverage, 'identity': self.identity}
