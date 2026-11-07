"""Local-only Hugging Face experiment driver. Callers explicitly stage models."""
import io
from contextlib import contextmanager
from pathlib import Path
import shutil
import tempfile
from .calibration_export import calibrate
from .checkpoint import Checkpoints, atomic
from .common import canonical, checked_token, decode, digest, identity
from .data_build import admit_labels, load_manifest, load_split, model_text
from .training import predict, train


def bundle_identity(directory):
    directory = Path(directory)
    files = sorted(p for p in directory.rglob('*') if p.is_file())
    if not files or any(p.is_symlink() for p in directory.rglob('*')):
        raise ValueError('nonempty symlink-free model bundle required')
    return identity({p.relative_to(directory).as_posix(): digest(p.read_bytes()) for p in files})


def resources(directory, unit_only):
    import psutil
    result = {'disk_free': shutil.disk_usage(str(directory)).free,
              'ram_available': psutil.virtual_memory().available,
              'disk_floor': 933930572, 'ram_floor': 5368709120}
    if not unit_only and (result['disk_free'] < result['disk_floor'] or result['ram_available'] < result['ram_floor']):
        raise ValueError('genuine model resource floor unmet: ' + str(result))
    return result


@contextmanager
def teacher_snapshot(directory, expected_identity):
    """Private read-only copy; verify captured bytes, never load mutable sources.

    Like the checkpoint store, the private temporary tree is single-writer owned;
    this isolates source replacement, not a hostile process controlling our user.
    """
    checked_token(expected_identity)
    directory = Path(directory)
    paths = sorted(directory.rglob('*'))
    if any(p.is_symlink() or p.is_junction() for p in [directory, *paths]):
        raise ValueError('teacher snapshot requires a link-free bundle')
    with tempfile.TemporaryDirectory(prefix='vfinal-teacher-') as tmp:
        snapshot = Path(tmp)
        pins = {}
        for path in paths:
            if path.is_file():
                raw = path.read_bytes()
                name = path.relative_to(directory)
                target = snapshot/name
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(raw)
                pins[name.as_posix()] = digest(raw)
                target.chmod(0o400)
        if not pins or identity(pins) != expected_identity or bundle_identity(snapshot) != expected_identity:
            raise ValueError('teacher snapshot identity mismatch')
        yield snapshot


def prepared(config, split, tokenizer):
    rows = load_split(config['data_dir'], config['data_identity'], split)
    manifest = load_manifest(config['data_dir'], config['data_identity'])
    encoded = tokenizer([model_text(r) for r in rows], truncation=True,
                        max_length=config['max_length'], padding=False)
    features = [{k: encoded[k][i] for k in encoded} for i in range(len(rows))]
    return rows, features, [manifest['labels'].index(r['label']) for r in rows]


def local_model(path, labels=None):
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(str(path), local_files_only=True, trust_remote_code=False)
    kwargs = {} if labels is None else {'num_labels': len(labels),
              'id2label': dict(enumerate(labels)), 'label2id': {x: i for i, x in enumerate(labels)}}
    model = AutoModelForSequenceClassification.from_pretrained(str(path), local_files_only=True,
                                                               trust_remote_code=False, **kwargs)
    return model, tokenizer


def native_head(path, labels):
    metadata = decode((Path(path)/'config.json').read_bytes())
    architectures = metadata.get('architectures')
    if not architectures or any(type(a) is not str for a in architectures):
        raise ValueError('classifier head architecture/label metadata required')
    if any('ForSequenceClassification' in a for a in architectures):
        expected_ids = {str(i): label for i, label in enumerate(labels)}
        expected_labels = {label: i for i, label in enumerate(labels)}
        if (canonical(metadata.get('id2label')) != canonical(expected_ids) or
                canonical(metadata.get('label2id')) != canonical(expected_labels) or
                canonical(metadata.get('num_labels', len(labels))) != canonical(len(labels))):
            raise ValueError('classifier head native label metadata mismatch; no silent relabeling')


def run(config, output):
    import torch
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    resources(output, config['training']['unit_only'])
    if bundle_identity(config['base_dir']) != config['base_identity']:
        raise ValueError('base model bundle identity mismatch')
    manifest = load_manifest(config['data_dir'], config['data_identity'])
    admit_labels(manifest, config['training']['unit_only'])
    if not config['training']['unit_only']:
        native_head(config['base_dir'], manifest['labels'])
    if not 4 <= config['max_length'] <= 512:
        raise ValueError('MiniLM experiment requires max_length in [4,512]; long context is a separate gate')
    contract_path = output/'experiment.json'
    if contract_path.exists() and contract_path.read_bytes() != canonical(config):
        raise ValueError('experiment identity changed')
    atomic(contract_path, canonical(config))
    torch.manual_seed(config['training']['seed'])
    model, tokenizer = local_model(config['base_dir'], manifest['labels'])
    if config['gradient_checkpointing']:
        model.gradient_checkpointing_enable()
    train_rows, features, labels = prepared(config, 'train', tokenizer)
    _, val_features, val_labels = prepared(config, 'validation', tokenizer)
    teacher_logits = None
    if config['training']['alpha']:
        if not config['teacher_dir']:
            raise ValueError('pinned teacher required')
        with teacher_snapshot(config['teacher_dir'], config['teacher_identity']) as snapshot:
            teacher, teacher_tokenizer = local_model(snapshot)
            if [teacher.config.id2label[i] for i in range(teacher.config.num_labels)] != manifest['labels']:
                raise ValueError('teacher label order must match; no silent remapping')
            _, teacher_features, _ = prepared(config, 'train', teacher_tokenizer)
            teacher.eval()
            teacher_logits = predict(teacher, teacher_features, config['training']['batch_size'], teacher_tokenizer.pad_token_id)
            del teacher
    device = 'cuda' if config['training']['mixed_precision'] else 'cpu'
    if device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA required for selected mixed-precision experiment')
    model.to(device)
    cfg = {**config['training'], 'model_identity': config['base_identity'],
           'data_identity': config['data_identity'], 'pad_token_id': tokenizer.pad_token_id}
    if config.get('hard_negative_ids'):
        wanted = set(config['hard_negative_ids'])
        indices = [i for i, r in enumerate(train_rows) if r['id'] in wanted]
        if len(indices) != len(wanted):
            raise ValueError('hard-negative IDs must belong exclusively to train')
        features = features + [features[i] for i in indices]
        labels = labels + [labels[i] for i in indices]
        if teacher_logits is not None:
            teacher_logits = teacher_logits + [teacher_logits[i] for i in indices]
    result = train(model, features, labels, val_features, val_labels, teacher_logits, cfg, output/'checkpoints')
    contract = {'config': cfg, 'inputs': identity([features, labels, val_features, val_labels, teacher_logits])}
    saved = Checkpoints(output/'checkpoints', contract).load('best')
    if saved is None:
        raise ValueError('no best checkpoint')
    state = torch.load(io.BytesIO(saved[1]), map_location=device, weights_only=True)
    model.load_state_dict(state['model'], strict=True)
    model.cpu().eval()
    best_dir = output/'best-model'
    model.save_pretrained(best_dir, safe_serialization=True)
    tokenizer.save_pretrained(best_dir)
    trained_identity = bundle_identity(best_dir)
    val_logits = predict(model, val_features, cfg['batch_size'], cfg['pad_token_id'])
    calibration = calibrate(val_logits, val_labels, split='validation', model_identity=trained_identity,
                            data_identity=config['data_identity'], max_fpr=config['max_fpr'])
    atomic(output/'calibration.json', canonical(calibration))
    if bundle_identity(config['base_dir']) != config['base_identity']:
        raise ValueError('base bundle drift during experiment')
    result.update({'model_identity': trained_identity, 'calibration_identity': calibration['identity'],
                   'data_identity': config['data_identity'], 'holdout_accessed': False,
                   'trained_target': 'native_multiclass; policy separate'})
    atomic(output/'result.json', canonical(result))
    return result


def mine(config, model_dir, *, split='train'):
    if split != 'train':
        raise ValueError('mining is restricted to train; never validation or holdout')
    resources(Path(model_dir), config['training']['unit_only'])
    manifest = load_manifest(config['data_dir'], config['data_identity'])
    admit_labels(manifest, config['training']['unit_only'])
    if not config['training']['unit_only']:
        native_head(model_dir, manifest['labels'])
    model, tokenizer = local_model(model_dir)
    rows, features, labels = prepared(config, 'train', tokenizer)
    values = predict(model, features, config['training']['batch_size'], tokenizer.pad_token_id)
    mistakes = [{'id': r['id'], 'label': r['label'], 'predicted_index': max(range(len(p)), key=p.__getitem__)}
                for r, p, y in zip(rows, values, labels) if max(range(len(p)), key=p.__getitem__) != y]
    return {'split': 'train', 'model_identity': bundle_identity(model_dir),
            'data_identity': config['data_identity'], 'mistakes': mistakes,
            'text_retained_in_report': False, 'release_ready': False}


def select_teacher(config, candidates):
    import numpy as np
    from .calibration_export import probabilities
    scores = []
    manifest = load_manifest(config['data_dir'], config['data_identity'])
    admit_labels(manifest, config['training']['unit_only'])
    exposure = manifest.get('teacher_exposure', [])
    for candidate in candidates:
        declared = [r for r in exposure if r['candidate_identity'] == candidate['identity']]
        if (exposure and not declared) or (not config['training']['unit_only'] and (
                not manifest['exposure_audit_complete'] or not declared or
                not any(r['partition'] in ('training', 'teacher_training') for r in declared))):
            raise ValueError('teacher candidate training/partition provenance required')
        resources(Path(candidate['path']), config['training']['unit_only'])
        with teacher_snapshot(candidate['path'], candidate['identity']) as snapshot:
            if not config['training']['unit_only']:
                native_head(snapshot, manifest['labels'])
            model, tokenizer = local_model(snapshot)
            if [model.config.id2label[i] for i in range(model.config.num_labels)] != manifest['labels']:
                raise ValueError('teacher label alignment required')
            _, features, labels = prepared(config, 'validation', tokenizer)
            p = probabilities(predict(model, features, config['training']['batch_size'], tokenizer.pad_token_id))
            nll = float(-np.log(p[np.arange(len(labels)), labels].clip(1e-15)).mean())
            del model
        scores.append({**candidate, 'validation_nll': nll, 'exposure_provenance': declared,
                       'validation_sha256': manifest['files']['validation']['sha256']})
    if not scores:
        raise ValueError('accepted teacher candidates required')
    return {'selected': min(scores, key=lambda x: x['validation_nll']), 'scores': scores,
            'selection_split': 'validation', 'data_identity': config['data_identity'], 'release_ready': False}
