#!/usr/bin/env python3
"""Colab/CUDA-first SoterAI transformer training pipeline.

This module is designed for Google Colab CUDA GPU execution. Meaningful training
fails fast when no supported accelerator is available, matching the project
transformation rule. Local use should be limited to import checks and tiny smoke
tests with --smoke-only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import random
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from soterai_dataset_audit import ML_LABELS, normalize_record, read_jsonl, split_group_key_for


DEFAULT_BASE_MODEL = "microsoft/deberta-v3-base"
DEFAULT_LABELS = [
    "SAFE",
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT",
]


@dataclass
class TrainConfig:
    dataset: str
    split_freeze: str = ""
    output_root: str = "/content/drive/MyDrive/soterai-ml-runs"
    base_model: str = DEFAULT_BASE_MODEL
    experiment_id: str = ""
    epochs: int = 4
    batch_size: int = 8
    gradient_accumulation_steps: int = 8
    learning_rate: float = 2e-5
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1
    max_length: int = 256
    val_ratio: float = 0.15
    test_ratio: float = 0.10
    seed: int = 42
    patience: int = 2
    fp16: bool = True
    class_weighting: bool = True
    classifier_dropout: float = 0.15
    min_examples_per_label_per_split: int = 2
    smoke_only: bool = False


def require_accelerator(smoke_only: bool = False) -> dict[str, Any]:
    import torch

    accelerator = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "tpu_available": False,
        "accelerator": None,
    }
    try:
        import torch_xla.core.xla_model as xm  # type: ignore

        accelerator["tpu_available"] = True
        accelerator["accelerator"] = str(xm.xla_device())
    except Exception:
        pass

    if torch.cuda.is_available():
        accelerator["accelerator"] = accelerator["cuda_device"]

    print(json.dumps({"accelerator": accelerator}, indent=2))
    if not smoke_only and not accelerator["cuda_available"]:
        raise RuntimeError(
            "No CUDA GPU is available. Stop: this PyTorch pipeline is CUDA-only and must run in a Colab GPU runtime. "
            "TPU execution requires a separate XLA training implementation and is intentionally rejected here."
        )
    return accelerator


def set_seed(seed: int) -> None:
    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return "unknown"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_records(dataset_path: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for obj in read_jsonl(Path(dataset_path)):
        rec = normalize_record(obj)
        if rec is None or not rec.text or rec.label not in ML_LABELS:
            continue
        records.append(asdict(rec))
    if not records:
        raise ValueError(f"No usable records found in {dataset_path}")
    return records


def load_frozen_splits(records: list[dict[str, Any]], dataset_path: str, split_freeze_path: str) -> tuple[dict[str, list[int]], dict[str, Any]]:
    """Load train/validation/locked-test rows from a verified FINAL_LOCKED freeze.

    The final untouched holdout is intentionally not returned: model training,
    early stopping, calibration, threshold selection, and routine experiment
    evaluation must not inspect it.
    """
    freeze_path = Path(split_freeze_path)
    freeze = json.loads(freeze_path.read_text(encoding="utf-8"))
    if freeze.get("status") != "FINAL_LOCKED":
        raise ValueError(f"Split freeze is not promotable: status={freeze.get('status')!r}")
    dataset_hash = sha256_file(Path(dataset_path))
    if freeze.get("dataset_sha256") != dataset_hash:
        raise ValueError("Split freeze dataset hash does not match the requested dataset")

    def resolve_manifest_path(raw: str) -> Path:
        candidate = Path(raw)
        if candidate.is_file():
            return candidate
        relative = freeze_path.parent / candidate.name
        if relative.is_file():
            return relative
        raise ValueError(f"Frozen partition manifest is missing: {raw}")

    audit_path_raw = str(freeze.get("audit_path") or "")
    audit_path = Path(audit_path_raw)
    if not audit_path.is_file():
        audit_path = freeze_path.parent / Path(audit_path_raw).name
    if not audit_path.is_file() or sha256_file(audit_path) != freeze.get("audit_sha256"):
        raise ValueError("Split freeze audit file is missing or its hash does not match")
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    if not audit.get("coverage_gate", {}).get("passed", False):
        raise ValueError(f"Split coverage gate failed: {audit.get('coverage_gate', {}).get('failures', [])}")
    if not audit.get("lexical_near_duplicate_audit", {}).get("semantic_embedding_audit_complete", False):
        raise ValueError("Semantic near-duplicate audit is incomplete")

    hash_to_indices: dict[str, list[int]] = {}
    for index, record in enumerate(records):
        digest = hashlib.sha256(record["text"].encode("utf-8")).hexdigest()
        hash_to_indices.setdefault(digest, []).append(index)

    partitions = {
        "train": "train",
        "development_validation": "validation",
        "locked_internal_test": "test",
    }
    output: dict[str, list[int]] = {"train": [], "validation": [], "test": []}
    seen_hashes: dict[str, str] = {}
    seen_groups: dict[str, str] = {}
    manifest_details: dict[str, Any] = {}
    for frozen_name, runtime_name in partitions.items():
        details = freeze.get("partition_manifests", {}).get(frozen_name)
        if not isinstance(details, dict):
            raise ValueError(f"Split freeze lacks partition: {frozen_name}")
        manifest_path = resolve_manifest_path(str(details.get("path") or ""))
        if sha256_file(manifest_path) != details.get("sha256"):
            raise ValueError(f"Partition manifest checksum mismatch: {frozen_name}")
        rows = json.loads(manifest_path.read_text(encoding="utf-8"))
        for row in rows:
            digest = str(row.get("exact_text_sha256") or "")
            available = hash_to_indices.get(digest, [])
            if not available:
                raise ValueError(f"Frozen row is absent from dataset: {digest}")
            previous_partition = seen_hashes.setdefault(digest, frozen_name)
            if previous_partition != frozen_name:
                raise ValueError(f"Exact-text leakage across frozen partitions: {digest}")
            group = str(row.get("split_group") or "")
            previous_group_partition = seen_groups.setdefault(group, frozen_name)
            if previous_group_partition != frozen_name:
                raise ValueError(f"Group leakage across frozen partitions: {group}")
            output[runtime_name].append(available[0])
        manifest_details[frozen_name] = {"path": str(manifest_path), "sha256": details["sha256"], "rows": len(rows)}

    if any(not indices for indices in output.values()):
        raise ValueError(f"Frozen split produced an empty training partition: { {name: len(value) for name, value in output.items()} }")
    return output, {
        "schema_version": "soterai-training-frozen-split/v1",
        "freeze_path": str(freeze_path),
        "freeze_sha256": sha256_file(freeze_path),
        "dataset_sha256": dataset_hash,
        "audit_sha256": freeze.get("audit_sha256"),
        "partitions": manifest_details,
        "final_untouched_holdout_loaded": False,
    }


def group_split(records: list[dict[str, Any]], val_ratio: float, test_ratio: float, seed: int) -> dict[str, list[int]]:
    group_to_indices: dict[str, list[int]] = {}
    for idx, rec in enumerate(records):
        key = split_group_key_for(rec["text"], rec.get("source", "<missing>"), rec.get("record_id"))
        group_to_indices.setdefault(key, []).append(idx)
    groups = sorted(group_to_indices.keys())
    rng = random.Random(seed)
    rng.shuffle(groups)

    total = len(records)
    target_test = int(total * test_ratio)
    target_val = int(total * val_ratio)
    split = {"train": [], "validation": [], "test": []}
    for group in groups:
        group_size = len(group_to_indices[group])
        deficits = {
            "test": max(0, target_test - len(split["test"])),
            "validation": max(0, target_val - len(split["validation"])),
        }
        destination = max(deficits, key=lambda name: (deficits[name], -group_size)) if any(deficits.values()) else "train"
        split[destination].extend(group_to_indices[group])
    return split


def split_manifest(records: list[dict[str, Any]], splits: dict[str, list[int]]) -> dict[str, Any]:
    manifest: dict[str, Any] = {"schema_version": 2, "partitions": {}}
    seen_groups: dict[str, str] = {}
    overlaps: list[dict[str, str]] = []
    for partition, indices in splits.items():
        label_counts: dict[str, int] = {}
        language_counts: dict[str, int] = {}
        source_families: set[str] = set()
        groups: set[str] = set()
        for idx in indices:
            rec = records[idx]
            label_counts[rec["label"]] = label_counts.get(rec["label"], 0) + 1
            language = rec.get("language") or "<missing>"
            language_counts[language] = language_counts.get(language, 0) + 1
            source = str(rec.get("source") or "<missing>").lower()
            source_families.add(source.split(":", 1)[-1])
            group = split_group_key_for(rec["text"], rec.get("source", "<missing>"), rec.get("record_id"))
            groups.add(group)
            previous = seen_groups.setdefault(group, partition)
            if previous != partition:
                overlaps.append({"group": group, "first_partition": previous, "second_partition": partition})
        manifest["partitions"][partition] = {
            "records": len(indices),
            "groups": len(groups),
            "labels": dict(sorted(label_counts.items())),
            "languages": dict(sorted(language_counts.items())),
            "source_family_count": len(source_families),
        }
    manifest["cross_partition_group_overlaps"] = overlaps
    return manifest


def validate_splits(records: list[dict[str, Any]], splits: dict[str, list[int]], minimum: int) -> dict[str, Any]:
    manifest = split_manifest(records, splits)
    if manifest["cross_partition_group_overlaps"]:
        raise ValueError("Leakage guard failed: related groups appear in multiple partitions")
    missing: list[str] = []
    for partition, details in manifest["partitions"].items():
        for label in DEFAULT_LABELS:
            if details["labels"].get(label, 0) < minimum:
                missing.append(f"{partition}:{label}<{minimum}")
    if missing:
        raise ValueError(f"Split lacks minimum per-label coverage: {', '.join(missing)}")
    return manifest


def estimate_memory(config: TrainConfig, record_count: int) -> dict[str, Any]:
    # Conservative planning numbers for MiniLM/DeBERTa-like encoder finetuning.
    tokens_per_step = config.batch_size * config.max_length
    hidden_size = 384 if "minilm" in config.base_model.lower() else 768
    layers = 6 if "minilm" in config.base_model.lower() else 12
    activation_mb = tokens_per_step * hidden_size * 4 * layers / (1024 * 1024)
    optimizer_mb = 400 if "MiniLM" in config.base_model or "minilm" in config.base_model.lower() else 1400
    return {
        "record_count": record_count,
        "tokens_per_step": tokens_per_step,
        "effective_batch_size": config.batch_size * config.gradient_accumulation_steps,
        "rough_activation_mb": round(activation_mb, 1),
        "rough_optimizer_state_mb": optimizer_mb,
        "recommended_gpu_memory_gb": 8 if optimizer_mb <= 400 else 16,
    }


def train(config: TrainConfig) -> dict[str, Any]:
    accelerator = require_accelerator(config.smoke_only)

    import numpy as np
    import torch
    import torch.nn as nn
    from sklearn.metrics import classification_report, f1_score
    from safetensors.torch import save_file as save_safetensors
    from torch.optim import AdamW
    from torch.utils.data import DataLoader, Dataset
    from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

    set_seed(config.seed)
    labels = DEFAULT_LABELS
    label_to_idx = {label: idx for idx, label in enumerate(labels)}
    records = load_records(config.dataset)
    memory_plan = estimate_memory(config, len(records))
    print(json.dumps({"memory_plan": memory_plan}, indent=2))

    if not config.experiment_id:
        config.experiment_id = f"soterai-{time.strftime('%Y%m%d-%H%M%S')}-{git_commit()[:8]}"
    run_dir = Path(config.output_root) / config.experiment_id
    checkpoint_dir = run_dir / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    if not config.split_freeze:
        raise ValueError("Full training requires --split-freeze pointing to a verified FINAL_LOCKED manifest")
    splits, frozen_split_evidence = load_frozen_splits(records, config.dataset, config.split_freeze)
    if not splits["train"] or not splits["validation"] or not splits["test"]:
        raise ValueError(f"Split produced empty partition(s): { {k: len(v) for k, v in splits.items()} }")
    manifest = validate_splits(records, splits, config.min_examples_per_label_per_split)
    manifest["frozen_split_evidence"] = frozen_split_evidence
    (run_dir / "config.json").write_text(json.dumps(asdict(config), indent=2) + "\n", encoding="utf-8")
    (run_dir / "split_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    class TextDataset(Dataset):
        def __init__(self, indices: list[int]):
            self.indices = indices

        def __len__(self) -> int:
            return len(self.indices)

        def __getitem__(self, item: int) -> tuple[str, int]:
            rec = records[self.indices[item]]
            return rec["text"], label_to_idx[rec["label"]]

    tokenizer = AutoTokenizer.from_pretrained(config.base_model)

    def collate(batch: list[tuple[str, int]]) -> dict[str, torch.Tensor]:
        texts, y = zip(*batch)
        encoded = tokenizer(list(texts), padding=True, truncation=True, max_length=config.max_length, return_tensors="pt")
        encoded["labels"] = torch.tensor(y, dtype=torch.long)
        return encoded

    class Classifier(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.encoder = AutoModel.from_pretrained(config.base_model)
            hidden = self.encoder.config.hidden_size
            self.dropout = nn.Dropout(config.classifier_dropout)
            self.classifier = nn.Linear(hidden, len(labels))

        def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor, **kwargs: torch.Tensor) -> torch.Tensor:
            model_kwargs = {key: value for key, value in kwargs.items() if key in {"token_type_ids", "position_ids"}}
            output = self.encoder(input_ids=input_ids, attention_mask=attention_mask, **model_kwargs)
            mask = attention_mask.unsqueeze(-1).float()
            pooled = (output.last_hidden_state * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
            return self.classifier(self.dropout(pooled))

    device = torch.device("cuda")
    model = Classifier().to(device)
    train_loader = DataLoader(TextDataset(splits["train"]), batch_size=config.batch_size, shuffle=True, collate_fn=collate)
    val_loader = DataLoader(TextDataset(splits["validation"]), batch_size=config.batch_size * 2, shuffle=False, collate_fn=collate)
    test_loader = DataLoader(TextDataset(splits["test"]), batch_size=config.batch_size * 2, shuffle=False, collate_fn=collate)
    optimizer = AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    total_steps = max(1, math.ceil(len(train_loader) * config.epochs / max(1, config.gradient_accumulation_steps)))
    scheduler = get_linear_schedule_with_warmup(optimizer, int(total_steps * config.warmup_ratio), total_steps)
    scaler = torch.cuda.amp.GradScaler(enabled=config.fp16 and torch.cuda.is_available())
    class_counts = np.zeros(len(labels), dtype=np.float32)
    for idx in splits["train"]:
        class_counts[label_to_idx[records[idx]["label"]]] += 1
    if config.class_weighting:
        class_weights = np.sqrt(class_counts.sum() / np.maximum(class_counts, 1.0))
        class_weights = class_weights / class_weights.mean()
        class_weight_tensor = torch.tensor(class_weights, dtype=torch.float32, device=device)
    else:
        class_weight_tensor = None
    train_loss_fn = nn.CrossEntropyLoss(weight=class_weight_tensor)
    eval_loss_fn = nn.CrossEntropyLoss()

    def collect_outputs(loader: DataLoader) -> tuple[torch.Tensor, torch.Tensor, float]:
        model.eval()
        output_logits: list[torch.Tensor] = []
        output_truth: list[torch.Tensor] = []
        losses: list[float] = []
        with torch.no_grad():
            for batch in loader:
                y = batch.pop("labels").to(device)
                batch = {k: v.to(device) for k, v in batch.items()}
                logits = model(**batch)
                losses.append(eval_loss_fn(logits, y).item())
                output_logits.append(logits.detach().cpu())
                output_truth.append(y.detach().cpu())
        return torch.cat(output_logits), torch.cat(output_truth), float(np.mean(losses)) if losses else 0.0

    def expected_calibration_error(confidences: np.ndarray, correct: np.ndarray, bins: int = 15) -> float:
        error = 0.0
        for lower in np.linspace(0.0, 1.0, bins, endpoint=False):
            upper = lower + (1.0 / bins)
            mask = (confidences > lower) & (confidences <= upper)
            if mask.any():
                error += float(mask.mean()) * abs(float(correct[mask].mean()) - float(confidences[mask].mean()))
        return error

    def evaluate(
        loader: DataLoader,
        temperature: float = 1.0,
        thresholds: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        logits, truth_tensor, uncalibrated_loss = collect_outputs(loader)
        calibrated_logits = logits / max(temperature, 1e-6)
        probabilities = torch.softmax(calibrated_logits, dim=1)
        confidences_tensor, preds_tensor = torch.max(probabilities, dim=1)
        if thresholds:
            safe_idx = label_to_idx["SAFE"]
            for idx in range(len(preds_tensor)):
                label = labels[int(preds_tensor[idx])]
                if label != "SAFE" and float(confidences_tensor[idx]) < thresholds.get(label, 0.0):
                    preds_tensor[idx] = safe_idx
                    confidences_tensor[idx] = probabilities[idx, safe_idx]
        preds = preds_tensor.tolist()
        truth = truth_tensor.tolist()
        confidences = confidences_tensor.numpy()
        correct = (preds_tensor == truth_tensor).numpy()
        one_hot = torch.nn.functional.one_hot(truth_tensor, num_classes=len(labels)).float()
        calibrated_nll = torch.nn.functional.cross_entropy(calibrated_logits, truth_tensor).item()
        brier = torch.mean(torch.sum((probabilities - one_hot) ** 2, dim=1)).item()
        return {
            "loss": uncalibrated_loss,
            "calibrated_nll": calibrated_nll,
            "brier_score": brier,
            "expected_calibration_error": expected_calibration_error(confidences, correct),
            "accuracy": float(np.mean([p == y for p, y in zip(preds, truth)])) if truth else 0,
            "f1_macro": f1_score(truth, preds, average="macro", zero_division=0),
            "f1_weighted": f1_score(truth, preds, average="weighted", zero_division=0),
            "classification_report": classification_report(truth, preds, labels=list(range(len(labels))), target_names=labels, zero_division=0, output_dict=True),
        }

    def fit_temperature(loader: DataLoader) -> float:
        logits, truth, _ = collect_outputs(loader)
        logits = logits.to(device)
        truth = truth.to(device)
        log_temperature = torch.nn.Parameter(torch.zeros(1, device=device))
        calibrator = torch.optim.LBFGS([log_temperature], lr=0.05, max_iter=50, line_search_fn="strong_wolfe")

        def closure() -> torch.Tensor:
            calibrator.zero_grad()
            temperature = torch.exp(log_temperature).clamp(0.05, 20.0)
            loss = torch.nn.functional.cross_entropy(logits / temperature, truth)
            loss.backward()
            return loss

        calibrator.step(closure)
        return float(torch.exp(log_temperature.detach()).clamp(0.05, 20.0).item())

    def tune_label_thresholds(loader: DataLoader, temperature: float) -> dict[str, float]:
        logits, truth, _ = collect_outputs(loader)
        probabilities = torch.softmax(logits / max(temperature, 1e-6), dim=1)
        confidences, predictions = torch.max(probabilities, dim=1)
        thresholds: dict[str, float] = {"SAFE": 0.0}
        for label_idx, label in enumerate(labels):
            if label == "SAFE":
                continue
            actual = truth == label_idx
            best_threshold = 0.5
            best_f2 = -1.0
            for threshold in np.linspace(0.35, 0.95, 61):
                accepted = (predictions == label_idx) & (confidences >= float(threshold))
                tp = int((accepted & actual).sum())
                fp = int((accepted & ~actual).sum())
                fn = int((~accepted & actual).sum())
                precision = tp / max(1, tp + fp)
                recall = tp / max(1, tp + fn)
                f2 = (5 * precision * recall) / max(1e-12, 4 * precision + recall)
                if f2 > best_f2:
                    best_f2 = f2
                    best_threshold = float(threshold)
            thresholds[label] = round(best_threshold, 4)
        return thresholds

    best_f1 = -1.0
    best_epoch = 0
    stale_epochs = 0
    history: list[dict[str, Any]] = []
    for epoch in range(1, config.epochs + 1):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        epoch_losses: list[float] = []
        for step, batch in enumerate(train_loader, start=1):
            y = batch.pop("labels").to(device)
            batch = {k: v.to(device) for k, v in batch.items()}
            with torch.cuda.amp.autocast(enabled=config.fp16 and torch.cuda.is_available()):
                logits = model(**batch)
                loss = train_loss_fn(logits, y) / config.gradient_accumulation_steps
            scaler.scale(loss).backward()
            if step % config.gradient_accumulation_steps == 0:
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)
            epoch_losses.append(float(loss.item() * config.gradient_accumulation_steps))
        if step % config.gradient_accumulation_steps != 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)

        val = evaluate(val_loader)
        record = {"epoch": epoch, "train_loss": float(np.mean(epoch_losses)), **{f"val_{k}": v for k, v in val.items() if k != "classification_report"}}
        history.append(record)
        if val["f1_macro"] > best_f1:
            best_f1 = val["f1_macro"]
            best_epoch = epoch
            stale_epochs = 0
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "labels": labels,
                    "label_to_idx": label_to_idx,
                    "base_model": config.base_model,
                    "classifier_dropout": config.classifier_dropout,
                    "config": asdict(config),
                },
                checkpoint_dir / "best.pt",
            )
            tokenizer.save_pretrained(run_dir / "tokenizer")
        else:
            stale_epochs += 1
            if stale_epochs >= config.patience:
                break

    best = torch.load(checkpoint_dir / "best.pt", map_location=device)
    model.load_state_dict(best["model_state_dict"])
    temperature = fit_temperature(val_loader)
    label_thresholds = tune_label_thresholds(val_loader, temperature)
    calibrated_validation = evaluate(val_loader, temperature, label_thresholds)
    test = evaluate(test_loader, temperature, label_thresholds)
    model_path = run_dir / "model.safetensors"
    safe_state = {name: tensor.detach().cpu().contiguous() for name, tensor in model.state_dict().items()}
    save_safetensors(safe_state, str(model_path), metadata={"format": "pt", "taxonomy_version": "SOTERAI-ML-TAXONOMY-v1"})
    (run_dir / "labels.json").write_text(json.dumps({str(i): label for i, label in enumerate(labels)}, indent=2) + "\n", encoding="utf-8")
    (run_dir / "label_to_idx.json").write_text(json.dumps(label_to_idx, indent=2) + "\n", encoding="utf-8")
    (run_dir / "model_config.json").write_text(
        json.dumps(
            {
                "model_type": "soterai-transformer-classifier",
                "base_model": config.base_model,
                "labels": labels,
                "classifier_dropout": config.classifier_dropout,
                "pooling": "attention_masked_mean",
                "max_length": config.max_length,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    calibration = {
        "method": "temperature_scaling",
        "temperature": temperature,
        "threshold_objective": "per-label validation F2",
        "label_thresholds": label_thresholds,
        "validation_metrics": calibrated_validation,
    }
    (run_dir / "calibration.json").write_text(json.dumps(calibration, indent=2) + "\n", encoding="utf-8")
    artifact_files = [
        {"path": model_path.name, "sha256": sha256_file(model_path), "bytes": model_path.stat().st_size},
    ]
    for tokenizer_file in sorted((run_dir / "tokenizer").rglob("*")):
        if tokenizer_file.is_file():
            artifact_files.append(
                {
                    "path": str(tokenizer_file.relative_to(run_dir)).replace("\\", "/"),
                    "sha256": sha256_file(tokenizer_file),
                    "bytes": tokenizer_file.stat().st_size,
                }
            )
    artifact_manifest = {
        "schema_version": "soterai-artifact-manifest/v1",
        "artifact_id": config.experiment_id,
        "taxonomy_version": "SOTERAI-ML-TAXONOMY-v1",
        "serialization": "safetensors",
        "files": artifact_files,
        "dataset_sha256": sha256_file(Path(config.dataset)),
        "split_freeze_sha256": sha256_file(Path(config.split_freeze)),
        "code_commit": git_commit(),
        "base_model": config.base_model,
        "labels": labels,
        "max_length": config.max_length,
        "calibration_file": "calibration.json",
        "production_status": "CANDIDATE_NOT_PROMOTED",
    }
    (run_dir / "artifact_manifest.json").write_text(json.dumps(artifact_manifest, indent=2) + "\n", encoding="utf-8")
    result = {
        "experiment_id": config.experiment_id,
        "code_commit": git_commit(),
        "accelerator": accelerator,
        "memory_plan": memory_plan,
        "dataset": config.dataset,
        "splits": {k: len(v) for k, v in splits.items()},
        "split_manifest": manifest,
        "train_class_counts": {labels[i]: int(count) for i, count in enumerate(class_counts.tolist())},
        "best_epoch": best_epoch,
        "history": history,
        "calibration": calibration,
        "artifact_manifest": artifact_manifest,
        "test_metrics": test,
        "artifact_dir": str(run_dir),
    }
    (run_dir / "experiment_summary.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def parse_args() -> TrainConfig:
    parser = argparse.ArgumentParser(description="Train SoterAI classifier in a Colab CUDA GPU runtime.")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--split-freeze", default="")
    parser.add_argument("--output-root", default=TrainConfig.output_root)
    parser.add_argument("--base-model", default=DEFAULT_BASE_MODEL)
    parser.add_argument("--experiment-id", default="")
    parser.add_argument("--epochs", type=int, default=TrainConfig.epochs)
    parser.add_argument("--batch-size", type=int, default=TrainConfig.batch_size)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=TrainConfig.gradient_accumulation_steps)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=TrainConfig.max_length)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-examples-per-label-per-split", type=int, default=TrainConfig.min_examples_per_label_per_split)
    parser.add_argument("--no-class-weighting", action="store_true")
    parser.add_argument("--smoke-only", action="store_true")
    args = parser.parse_args()
    return TrainConfig(
        dataset=args.dataset,
        split_freeze=args.split_freeze,
        output_root=args.output_root,
        base_model=args.base_model,
        experiment_id=args.experiment_id,
        epochs=args.epochs,
        batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        learning_rate=args.learning_rate,
        max_length=args.max_length,
        seed=args.seed,
        min_examples_per_label_per_split=max(1, args.min_examples_per_label_per_split),
        class_weighting=not args.no_class_weighting,
        smoke_only=args.smoke_only,
    )


def main() -> None:
    config = parse_args()
    if config.smoke_only:
        # Local import/config check only. Avoid accidental local training.
        require_accelerator(smoke_only=True)
        records = load_records(config.dataset)
        print(json.dumps({"smoke_only": True, "usable_records": len(records), "memory_plan": estimate_memory(config, len(records))}, indent=2))
        return
    result = train(config)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
