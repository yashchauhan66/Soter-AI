"""Compact WordPiece students and checked, training-only knowledge distillation.

Channel slicing is an initialization heuristic, not a claim of retained accuracy.
The student keeps the multilingual vocabulary and must be trained, calibrated,
and evaluated independently before it can replace a production model.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import os
import re
from pathlib import Path

import torch
import torch.nn.functional as F
from transformers import AutoConfig


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_torch_save(payload, path: Path) -> None:
    """A disconnect during serialization must leave the last checkpoint intact."""
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("wb") as file:
        torch.save(payload, file)
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


def artifact_config(artifact_dir: Path, stats: dict):
    """Prefer exported architecture; older artifacts need only the HF config."""
    config_path = artifact_dir / "encoder_config.json"
    if config_path.is_file():
        data = json.loads(config_path.read_text(encoding="utf-8"))
        model_type = data.pop("model_type")
        return AutoConfig.for_model(model_type, **data)
    return AutoConfig.from_pretrained(
        artifact_dir if (artifact_dir / "config.json").is_file() else stats["base_model"]
    )


def compact_config(teacher_config, hidden_size: int, layers: int):
    if hidden_size <= 0 or layers <= 0:
        raise ValueError("student hidden size and layers must be positive")
    config = copy.deepcopy(teacher_config)
    if config.model_type == "distilbert":
        old_hidden, old_layers, old_heads = config.dim, config.n_layers, config.n_heads
        heads = hidden_size // 64 if hidden_size % 64 == 0 else math.gcd(hidden_size, old_heads)
        config.dim, config.n_layers, config.n_heads = hidden_size, layers, heads
        config.hidden_dim = 4 * hidden_size
    elif config.model_type == "bert":
        old_hidden, old_layers, old_heads = config.hidden_size, config.num_hidden_layers, config.num_attention_heads
        heads = hidden_size // 64 if hidden_size % 64 == 0 else math.gcd(hidden_size, old_heads)
        config.hidden_size, config.num_hidden_layers = hidden_size, layers
        config.num_attention_heads, config.intermediate_size = heads, 4 * hidden_size
    else:
        raise ValueError("compact students support BERT and DistilBERT WordPiece encoders only")
    if hidden_size > old_hidden or layers > old_layers or (hidden_size == old_hidden and layers == old_layers):
        raise ValueError("student must reduce width or depth without expanding either")
    # Eager attention has a portable ONNX export and avoids SDPA-version drift.
    config._attn_implementation = "eager"
    return config


def slice_teacher_into_student(teacher, student) -> dict:
    """Transfer selected channels consistently, including embeddings and heads."""
    family = teacher.encoder.config.model_type
    if family != student.encoder.config.model_type or family not in {"bert", "distilbert"}:
        raise ValueError("teacher and student must share a supported encoder family")
    old_layers = int(teacher.encoder.config.num_hidden_layers)
    new_layers = int(student.encoder.config.num_hidden_layers)
    layer_map = [((i + 1) * old_layers // new_layers) - 1 for i in range(new_layers)]
    pattern = r"(encoder\.(?:transformer|encoder)\.layer\.)(\d+)(\.)"
    old_state = teacher.state_dict()
    transferred = {}
    for name, target in student.state_dict().items():
        source_name = re.sub(pattern, lambda m: f"{m[1]}{layer_map[int(m[2])]}{m[3]}", name)
        source = old_state[source_name]
        if source.ndim != target.ndim:
            raise ValueError(f"incompatible tensor rank: {name}")
        for axis, (old, new) in enumerate(zip(source.shape, target.shape)):
            if old < new:
                raise ValueError(f"cannot expand teacher tensor: {name}")
            if old != new:
                channels = torch.linspace(0, old - 1, new, device=source.device).round().long()
                source = source.index_select(axis, channels)
        transferred[name] = source.detach().clone()
    student.load_state_dict(transferred, strict=True)
    return {
        "method": "teacher_even_channel_slice",
        "teacher_layer_indices": layer_map,
        "teacher_hidden_size": teacher.hidden_size,
        "student_hidden_size": student.hidden_size,
        "vocabulary_preserved": True,
        "tensors_transferred": len(transferred),
        "limitation": "Heuristic initialization; attention heads are recomposed. Retraining and external evaluation required.",
    }


def temperature_kl(student_logits, teacher_logits, temperature: float):
    if not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("distillation temperature must be positive and finite")
    if student_logits.shape != teacher_logits.shape:
        raise ValueError("teacher and student label dimensions differ")
    return F.kl_div(
        F.log_softmax(student_logits.float() / temperature, dim=-1),
        F.softmax(teacher_logits.detach().float() / temperature, dim=-1),
        reduction="batchmean",
    ) * (temperature * temperature)


def load_prepared_split(split_path: Path, datasets: list[str], rows: int) -> tuple[dict, dict]:
    """Indices address one strict-loaded corpus; reject changed files or overlap."""
    if len(datasets) != 1:
        raise ValueError("--split-file requires exactly one --train-datasets file")
    payload = json.loads(split_path.read_text(encoding="utf-8"))
    actual = file_sha256(Path(datasets[0]))
    if payload.get("dataset_sha256") != actual:
        raise ValueError("prepared split dataset_sha256 does not match the corpus")
    indices = payload.get("indices", {})
    if set(indices) - {"train", "calibration", "validation", "test"}:
        raise ValueError("unknown prepared split partition")
    partitions = {}
    seen = set()
    for name in ("train", "calibration", "validation", "test"):
        values = indices.get(name, [])
        if not isinstance(values, list) or any(type(i) is not int or i < 0 or i >= rows for i in values):
            raise ValueError(f"invalid indices for {name}")
        if name != "test" and not values:
            raise ValueError(f"empty required partition: {name}")
        unique = set(values)
        if len(unique) != len(values) or seen & unique:
            raise ValueError("prepared split contains duplicate or overlapping row indices")
        seen |= unique
        partitions[name] = values
    if seen != set(range(rows)):
        raise ValueError("prepared split does not partition every corpus row")
    if payload.get("method") == "declared_lineage_and_normalized_text_connected_components_sha256_assignment":
        assignment = {i: name for name, values in partitions.items() for i in values}
        lineage_partitions = {}
        row_index = 0
        with Path(datasets[0]).open(encoding="utf-8") as stream:
            for line in stream:
                if not line.strip():
                    continue
                row = json.loads(line)
                metadata = row.get("_v18")
                lineage = metadata.get("lineage_group_sha256") if isinstance(metadata, dict) else None
                if not isinstance(lineage, str) or re.fullmatch(r"[0-9a-f]{64}", lineage) is None:
                    raise ValueError("prepared lineage corpus has missing/invalid group metadata")
                if row_index not in assignment:
                    raise ValueError("prepared lineage corpus row count differs from indices")
                partition = assignment[row_index]
                if lineage_partitions.setdefault(lineage, partition) != partition:
                    raise ValueError("prepared split separates a declared template/translation lineage group")
                row_index += 1
        if row_index != rows:
            raise ValueError("prepared lineage corpus row count differs from indices")
    return partitions, {
        "path": str(split_path), "dataset_sha256": actual,
        "manifest_sha256": hashlib.sha256(split_path.read_bytes()).hexdigest(),
        "method": payload.get("method", "external_prepared_groups"),
    }
