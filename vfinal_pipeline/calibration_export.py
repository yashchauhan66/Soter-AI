"""Validation-only multiclass temperature/risk threshold; checked ONNX export."""
from pathlib import Path
from .common import canonical, checked_token, identity, write_new


def probabilities(values, temperature=1.0):
    import numpy as np
    a = np.asarray(values, dtype=float)
    if a.ndim != 2 or not len(a) or a.shape[1] < 2 or not np.isfinite(a).all():
        raise ValueError('finite nonempty multiclass logits required')
    if type(temperature) not in (int, float) or not 0 < temperature < float('inf'):
        raise ValueError('positive temperature required')
    a = a / temperature
    a -= a.max(axis=1, keepdims=True)
    a = np.exp(a)
    return a / a.sum(axis=1, keepdims=True)


def calibrate(values, labels, *, split, model_identity, data_identity, max_fpr, fit_temperature=True):
    import numpy as np
    if split != 'validation':
        raise ValueError('calibration requires validation only')
    checked_token(model_identity)
    checked_token(data_identity)
    p = probabilities(values)
    if len(labels) != len(p) or any(type(x) is not int or not 0 <= x < p.shape[1] for x in labels):
        raise ValueError('aligned integer labels required')
    if type(max_fpr) not in (int, float) or not 0 <= max_fpr < 1:
        raise ValueError('invalid max_fpr')
    y = np.asarray(labels)
    if not (y == 0).any() or not (y != 0).any():
        raise ValueError('validation needs benign and positive support')
    def nll(t):
        q = probabilities(values, float(t))
        return float(-np.log(q[np.arange(len(y)), y].clip(1e-15)).mean())
    if type(fit_temperature) is not bool:
        raise ValueError('boolean fit_temperature required')
    grid = np.unique(np.concatenate(([1.0], np.exp(np.linspace(-3, 3, 241))))) if fit_temperature else [1.0]
    t = float(min(grid, key=nll))
    risk = 1 - probabilities(values, t)[:, 0]
    options = []
    for threshold in np.unique(np.concatenate(([0., 1.], risk))):
        fpr = float((risk[y == 0] >= threshold).mean())
        recall = float((risk[y != 0] >= threshold).mean())
        if fpr <= max_fpr:
            options.append((recall, float(threshold), fpr))
    if not options:
        raise ValueError('no admitted validation operating point')
    recall, threshold, fpr = max(options)
    result = {'schema': 'vfinal-calibration/v1', 'split': split,
              'model_identity': model_identity, 'data_identity': data_identity,
              'validation_identity': identity([values, labels]), 'temperature': t,
              'threshold': threshold, 'max_fpr': max_fpr, 'fpr': fpr, 'recall': recall,
              'nll_before': nll(1.0), 'nll_after': nll(t),
              'temperature_search': 'exp(linspace(-3,3,241)) plus 1; NLL minimum' if fit_temperature else 'fixed-one ablation',
              'risk_contract': '1-softmax(logits/temperature)[SAFE=0]', 'release_ready': False}
    result['identity'] = identity(result)
    return result


def export_onnx(model, examples, calibration, destination, *, unit_only=False, quantize=False):
    import numpy as np
    import onnx
    import onnxruntime as ort
    import torch
    from .training import logits
    if len(examples) < 3:
        raise ValueError('three dynamic batch/sequence parity examples required')
    if calibration['split'] != 'validation':
        raise ValueError('validation calibration required')
    c = dict(calibration)
    if c.pop('identity') != identity(c):
        raise ValueError('calibration identity mismatch')
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    keys = list(examples[0])
    class Scaled(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.inner = model
        def forward(self, *args):
            return logits(self.inner, dict(zip(keys, args))) / calibration['temperature']
    wrapped = Scaled().cpu().eval()
    examples = [{k: v.cpu() for k, v in item.items()} for item in examples]
    path = destination / 'model.onnx'
    torch.onnx.export(wrapped, tuple(examples[0][k] for k in keys), str(path),
                      input_names=keys, output_names=['logits'], opset_version=17,
                      dynamic_axes={**{k: {0: 'batch', 1: 'sequence'} for k in keys},
                                    'logits': {0: 'batch'}}, dynamo=False)
    onnx.checker.check_model(str(path), full_check=True)
    variants = [('fp32', path, 1e-4)]
    if quantize:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        quantized = destination / 'model.int8.onnx'
        quantize_dynamic(str(path), str(quantized), weight_type=QuantType.QInt8)
        onnx.checker.check_model(str(quantized), full_check=True)
        variants.append(('int8', quantized, 0.05))
    parity = []
    for kind, file, tolerance in variants:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(file), sess_options=options, providers=['CPUExecutionProvider'])
        for example in examples:
            with torch.no_grad():
                expected = wrapped(*(example[k] for k in keys)).numpy()
            actual = session.run(None, {k: v.numpy() for k, v in example.items()})[0]
            if actual.shape != expected.shape or not np.isfinite(actual).all():
                raise ValueError('invalid ORT output')
            error = float(np.max(np.abs(actual - expected)))
            if error > tolerance or not np.array_equal(actual.argmax(1), expected.argmax(1)):
                raise ValueError('export parity failed: ' + kind)
            parity.append({'variant': kind, 'shape': list(example['input_ids'].shape), 'max_absolute_error': error})
    write_new(destination / 'calibration.json', canonical({**calibration,
              'export_temperature': 'baked_into_logits; do not apply again'}))
    result = {'schema': 'vfinal-export/v1', 'unit_only': unit_only, 'release_ready': False,
              'model_identity': calibration['model_identity'], 'calibration_identity': calibration['identity'],
              'parity': parity, 'max_absolute_error': max(x['max_absolute_error'] for x in parity),
              'serving_path': 'NOT RUN', 'pretrained_export': 'NOT RUN' if unit_only else 'EXPORTED_NOT_RELEASED'}
    write_new(destination / 'export.json', canonical(result))
    return result
