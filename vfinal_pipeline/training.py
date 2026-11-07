"""Resumable dynamic-padding CE/KL training. No network or pretrained load here."""
import io
import math
from pathlib import Path
import random
from .checkpoint import Checkpoints, atomic
from .common import canonical, checked_token, identity


def batch(features, indices, device, pad_token_id=0):
    import torch
    width = max(len(features[i]['input_ids']) for i in indices)
    keys = features[indices[0]].keys()
    return {k: torch.tensor([features[i][k] + [pad_token_id if k == 'input_ids' else 0] *
                            (width - len(features[i][k])) for i in indices],
                           dtype=torch.long, device=device) for k in keys}


def logits(model, inputs):
    result = model(**inputs)
    return result if hasattr(result, 'shape') else result.logits


def predict(model, features, batch_size=16, pad_token_id=0):
    import torch
    device = next(model.parameters()).device
    model.eval()
    results = []
    with torch.no_grad():
        for start in range(0, len(features), batch_size):
            values = logits(model, batch(features, list(range(start, min(start + batch_size, len(features)))), device, pad_token_id))
            if values.ndim != 2 or not torch.isfinite(values).all():
                raise ValueError('invalid model logits')
            results.extend(values.float().cpu().tolist())
    return results


def train(model, features, labels, validation, validation_labels, teacher_logits,
          config, checkpoint_dir, *, stop_after_steps=None):
    import torch
    import torch.nn.functional as F
    for key in ('epochs', 'batch_size', 'accumulation', 'checkpoint_every'):
        if type(config[key]) is not int or config[key] <= 0:
            raise ValueError('positive integer training control required: ' + key)
    for key in ('model_identity', 'data_identity'):
        checked_token(config[key])
    if not features or not validation or len(features) != len(labels) or len(validation) != len(validation_labels):
        raise ValueError('nonempty aligned train/validation required')
    if not 0 <= config['alpha'] <= 1 or not math.isfinite(config['temperature']) or config['temperature'] <= 0:
        raise ValueError('invalid distillation controls')
    if any(type(y) is not int or y < 0 for y in labels + validation_labels):
        raise ValueError('integer class indices required')
    teacher = None if teacher_logits is None else torch.tensor(teacher_logits, dtype=torch.float32)
    if config['alpha'] and teacher is None:
        raise ValueError('distillation requires aligned train-only teacher logits')
    if teacher is not None and (teacher.ndim != 2 or len(teacher) != len(features) or not torch.isfinite(teacher).all()):
        raise ValueError('invalid teacher logits')
    contract = {'config': config, 'inputs': identity([features, labels, validation, validation_labels, teacher_logits])}
    store = Checkpoints(checkpoint_dir, contract)
    device = next(model.parameters()).device
    if config['mixed_precision'] and device.type != 'cuda':
        raise ValueError('mixed precision is CUDA-only; T4 uses float16')
    optimizer = torch.optim.AdamW(model.parameters(), lr=config['lr'], weight_decay=config['weight_decay'])
    scaler = torch.amp.GradScaler('cuda', enabled=config['mixed_precision'])
    state = {'epoch': 0, 'next_batch': 0, 'steps': 0, 'best_loss': float('inf'), 'history': []}
    torch.manual_seed(config['seed'])
    saved = store.load()
    if saved:
        payload = torch.load(io.BytesIO(saved[1]), map_location=device, weights_only=True)
        model.load_state_dict(payload['model'], strict=True)
        optimizer.load_state_dict(payload['optimizer'])
        scaler.load_state_dict(payload['scaler'])
        state = payload['state']
        torch.set_rng_state(payload['rng'].cpu())
        if device.type == 'cuda':
            torch.cuda.set_rng_state_all([x.cpu() for x in payload['cuda_rng']])
    weights = None
    if config['class_balance']:
        count = torch.bincount(torch.tensor(labels), minlength=max(labels + validation_labels) + 1).float()
        if (count == 0).any():
            raise ValueError('every class needs train support')
        weights = (count.sum() / (len(count) * count)).to(device)
    while state['epoch'] < config['epochs']:
        order = sorted(range(len(features)), key=lambda i: len(features[i]['input_ids']))
        chunks = [order[i:i + config['batch_size']] for i in range(0, len(order), config['batch_size'])]
        random.Random(config['seed'] + state['epoch']).shuffle(chunks)
        cursor = state['next_batch']
        while cursor < len(chunks):
            model.train()
            optimizer.zero_grad(set_to_none=True)
            end = min(cursor + config['accumulation'], len(chunks))
            total = sum(len(x) for x in chunks[cursor:end])
            # CE's weighted mean is over the effective batch, not each microbatch.
            targets = torch.tensor([labels[i] for part in chunks[cursor:end] for i in part], device=device)
            ce_denominator = total if weights is None else weights[targets].sum()
            for indices in chunks[cursor:end]:
                inputs = batch(features, indices, device, config['pad_token_id'])
                y = torch.tensor([labels[i] for i in indices], device=device)
                with torch.amp.autocast('cuda', dtype=torch.float16, enabled=config['mixed_precision']):
                    values = logits(model, inputs)
                    ce = F.cross_entropy(values.float(), y, weight=weights, reduction='sum') / ce_denominator
                    loss = ce
                    if teacher is not None and config['alpha']:
                        t = config['temperature']
                        kl = F.kl_div(F.log_softmax(values.float() / t, dim=-1),
                                      F.softmax(teacher[indices].to(device) / t, dim=-1), reduction='sum') * t * t / total
                        loss = (1 - config['alpha']) * ce + config['alpha'] * kl
                if not torch.isfinite(loss):
                    raise ValueError('nonfinite training loss')
                scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
            scaler.step(optimizer)
            scaler.update()
            cursor = end
            state['steps'] += 1
            state['next_batch'] = cursor
            best = False
            if cursor == len(chunks):
                values = torch.tensor(predict(model, validation, config['batch_size'], config['pad_token_id']))
                val_loss = F.cross_entropy(values, torch.tensor(validation_labels)).item()
                best = val_loss < state['best_loss']
                state['best_loss'] = min(state['best_loss'], val_loss)
                state['epoch'] += 1
                state['next_batch'] = 0
                state['history'].append({'epoch': state['epoch'], 'validation_nll': val_loss})
            stopping = stop_after_steps is not None and state['steps'] >= stop_after_steps
            if best or cursor == len(chunks) or state['steps'] % config['checkpoint_every'] == 0 or stopping:
                stream = io.BytesIO()
                torch.save({'model': model.state_dict(), 'optimizer': optimizer.state_dict(),
                            'scaler': scaler.state_dict(), 'state': state,
                            'rng': torch.get_rng_state(),
                            'cuda_rng': torch.cuda.get_rng_state_all() if device.type == 'cuda' else []}, stream)
                store.save(state['steps'], stream.getvalue(), best=best)
                atomic(Path(checkpoint_dir) / 'history.json', canonical(state['history']))
            if stopping:
                return {'complete': state['epoch'] == config['epochs'], 'steps': state['steps'],
                        'history': state['history'], 'unit_only': config['unit_only'], 'release_ready': False}
    return {'complete': True, 'steps': state['steps'], 'history': state['history'],
            'unit_only': config['unit_only'], 'release_ready': False}
