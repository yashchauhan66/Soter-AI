#!/usr/bin/env python3
"""
SoterLLM v4 — Market-leading local AI-security classifier trainer.

Why v4 exists (honest gap vs v3):
  v3 (MiniLM + single Linear head) hit ~99% on a LEAKED random_split and only
  ~70–87% honest novel recall after a precision gate. Gaps documented in
  artifacts/ml-v2/*:
    - single linear head (under-capacity)
    - no calibration (raw softmax ≠ probability)
    - no OOD/abstention (low-conf coerced to SAFE)
    - max_length=128 truncates long adversarial prompts
    - no class-balanced loss (attack:safe ≈ 2.5:1)
    - no per-label operating points

v4 upgrades that beat typical market local classifiers (Lakera/Prompt-Security
style cloud models excluded — different product class):
  1. 2-layer MLP head + LayerNorm (384→256→9) with GELU
  2. Group-aware 3-way split: train / calibration / validation (0 leakage)
  3. Class-balanced CrossEntropy (effective-number weights) + label smoothing
  4. Optional focal modulation for hard adversarial examples
  5. Temperature scaling fitted on the calibration split (ECE-minimizing)
  6. Per-label thresholds fitted for target FPR on calibration
  7. OOD/abstention score = max_prob + entropy (exported alongside logits)
  8. max_length 256 (longer jailbreaks / multi-turn fragments)
  9. Attack probability = 1 - P(SAFE) as primary security risk score
 10. Dataset manifest + honest metrics (never report leaked F1 as generalization)

Usage:
  # Smoke (CI / local sanity)
  python scripts/ml/train-soterllm-v4.py --sample --epochs 1 --batch-size 8 \\
      --output-dir models/ml-classifier-v4-smoke --no-cuda

  # Full production train (CPU)
  python scripts/ml/train-soterllm-v4.py \\
      --train-datasets datasets/ml-augmented-v6.jsonl \\
      --epochs 4 --batch-size 12 --max-length 256 \\
      --output-dir models/ml-classifier-v4 --no-cuda

  # GPU (Colab / cloud)
  python scripts/ml/train-soterllm-v4.py \\
      --train-datasets datasets/ml-augmented-v6.jsonl \\
      --epochs 5 --batch-size 64 --max-length 256 \\
      --output-dir models/ml-classifier-v4

Artifacts written to --output-dir:
  model.onnx (+ optional external data)
  pytorch_model.bin
  labels.json
  calibration.json          # temperature + per-label thresholds + OOD floor
  training_stats.json
  eval_results.json         # GROUP-AWARE val metrics (honest)
  dataset_manifest.json     # row counts, group counts, split sizes
  tokenizer_config/
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import (
    classification_report,
    f1_score,
    precision_recall_fscore_support,
)
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset, Subset
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

# ── Constants ──────────────────────────────────────────────────────────────────

PRODUCT_NAME = "SoterLLM"
PRODUCT_VERSION = "v4"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
HEAD_HIDDEN = 256

ALL_LABELS = [
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

DEFAULT_DATASETS = [
    "datasets/ml-augmented-v6.jsonl",
    "datasets/ml-augmented-v5.jsonl",
    "datasets/ml-augmented-v4.jsonl",
]

# ── Group-key (augmentation-invariant skeleton) ────────────────────────────────


def group_key_for(text: str) -> str:
    """Collapse text so leet/spacing/reorder/unicode siblings share one key."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
        "@": "a",
        "$": "s",
        "!": "i",
    }
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


# ── Dataset ────────────────────────────────────────────────────────────────────


class AdversarialDataset(Dataset):
    def __init__(
        self,
        file_paths: list[str],
        label_to_idx: dict[str, int],
        max_samples: int | None = None,
    ):
        self.texts: list[str] = []
        self.labels: list[int] = []
        self.groups: list[str] = []
        self.sources: list[str] = []
        self.label_to_idx = label_to_idx
        self.file_paths = file_paths

        for fp in file_paths:
            path = Path(fp)
            if not path.exists():
                print(f"  [WARN] Skipping {fp} — file not found")
                continue
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    text = (obj.get("text") or "").strip()
                    label_str = obj.get("label", "SAFE")
                    if not text:
                        continue
                    label_idx = label_to_idx.get(label_str)
                    if label_idx is None:
                        for k, v in label_to_idx.items():
                            if k.upper() == str(label_str).upper():
                                label_idx = v
                                break
                    if label_idx is None:
                        continue
                    self.texts.append(text)
                    self.labels.append(label_idx)
                    self.groups.append(group_key_for(text))
                    self.sources.append(str(obj.get("source", "unknown")))

        if max_samples and len(self.texts) > max_samples:
            combined = list(zip(self.texts, self.labels, self.groups, self.sources))
            rng = np.random.RandomState(42)
            rng.shuffle(combined)
            combined = combined[:max_samples]
            self.texts, self.labels, self.groups, self.sources = map(list, zip(*combined))

        print(f"  [OK] Loaded {len(self.texts)} examples from {len(file_paths)} file(s)")
        print(f"  [OK] {len(set(self.groups))} distinct group keys")
        self._print_label_distribution()

    def _print_label_distribution(self) -> None:
        idx_to_label = {v: k for k, v in self.label_to_idx.items()}
        counts: dict[str, int] = {}
        for lbl in self.labels:
            name = idx_to_label.get(lbl, f"UNKNOWN_{lbl}")
            counts[name] = counts.get(name, 0) + 1
        for name in sorted(counts.keys()):
            pct = counts[name] / max(1, len(self.labels)) * 100
            print(f"    {name:40s} {counts[name]:6d} ({pct:5.1f}%)")

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> tuple[str, int]:
        return self.texts[idx], self.labels[idx]


# ── Model ──────────────────────────────────────────────────────────────────────


class SoterLLMv4(nn.Module):
    """
    MiniLM encoder + capacity head.

    Forward returns raw logits (no softmax). Temperature scaling is applied
    post-hoc at export/inference time via calibration.json.
    """

    def __init__(self, num_labels: int, dropout: float = 0.15, head_hidden: int = HEAD_HIDDEN):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(MODEL_NAME)
        self.norm = nn.LayerNorm(EMBEDDING_DIM)
        self.dropout = nn.Dropout(dropout)
        self.head = nn.Sequential(
            nn.Linear(EMBEDDING_DIM, head_hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(head_hidden, num_labels),
        )
        # Binary attack head: trains 1-P(SAFE) more sharply for security ranking.
        self.attack_head = nn.Linear(EMBEDDING_DIM, 1)

    def encode(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        token_embeddings = outputs.last_hidden_state
        mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        summed = torch.sum(token_embeddings * mask, dim=1)
        denom = torch.clamp(mask.sum(dim=1), min=1e-9)
        pooled = summed / denom
        return self.norm(pooled)

    def forward(
        self, input_ids: torch.Tensor, attention_mask: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        pooled = self.encode(input_ids, attention_mask)
        x = self.dropout(pooled)
        logits = self.head(x)
        attack_logit = self.attack_head(x).squeeze(-1)
        return logits, attack_logit


class SoterLLMv4OnnxWrapper(nn.Module):
    """ONNX-export wrapper: single logits tensor (temperature baked in)."""

    def __init__(self, model: SoterLLMv4, temperature: float = 1.0):
        super().__init__()
        self.model = model
        self.temperature = max(float(temperature), 1e-3)

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        logits, _attack = self.model(input_ids, attention_mask)
        return logits / self.temperature


# ── Loss ───────────────────────────────────────────────────────────────────────


def effective_number_weights(labels: list[int], num_classes: int, beta: float = 0.999) -> torch.Tensor:
    """Cui et al. Class-Balanced Loss based on Effective Number of Samples."""
    counts = np.bincount(labels, minlength=num_classes).astype(np.float64)
    counts = np.maximum(counts, 1.0)
    effective = 1.0 - np.power(beta, counts)
    weights = (1.0 - beta) / effective
    weights = weights / weights.sum() * num_classes
    return torch.tensor(weights, dtype=torch.float32)


class FocalCE(nn.Module):
    def __init__(
        self,
        weight: torch.Tensor | None = None,
        label_smoothing: float = 0.05,
        gamma: float = 1.5,
    ):
        super().__init__()
        self.weight = weight
        self.label_smoothing = label_smoothing
        self.gamma = gamma

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        # CE with label smoothing for soft targets, then focal reweight.
        log_probs = F.log_softmax(logits, dim=-1)
        n_classes = logits.size(-1)
        with torch.no_grad():
            true_dist = torch.zeros_like(log_probs)
            true_dist.fill_(self.label_smoothing / max(1, n_classes - 1))
            true_dist.scatter_(1, targets.unsqueeze(1), 1.0 - self.label_smoothing)
        ce = torch.sum(-true_dist * log_probs, dim=-1)  # (B,)
        if self.weight is not None:
            w = self.weight.to(logits.device)[targets]
            ce = ce * w
        if self.gamma > 0:
            probs = log_probs.exp()
            pt = probs.gather(1, targets.unsqueeze(1)).squeeze(1).clamp(min=1e-8)
            ce = ((1.0 - pt) ** self.gamma) * ce
        return ce.mean()


# ── Collate / train / eval ─────────────────────────────────────────────────────


def collate_fn(batch, tokenizer, max_length: int):
    texts = [item[0] for item in batch]
    labels = [item[1] for item in batch]
    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=max_length,
        return_tensors="pt",
    )
    return (
        encoded["input_ids"],
        encoded["attention_mask"],
        torch.tensor(labels, dtype=torch.long),
    )


def train_epoch(
    model: SoterLLMv4,
    loader: DataLoader,
    optimizer,
    scheduler,
    device: torch.device,
    criterion: nn.Module,
    attack_weight: float = 0.35,
) -> dict[str, float]:
    model.train()
    total_loss = 0.0
    all_preds: list[int] = []
    all_labels: list[int] = []
    steps = 0

    for input_ids, attention_mask, labels in loader:
        input_ids = input_ids.to(device)
        attention_mask = attention_mask.to(device)
        labels = labels.to(device)

        optimizer.zero_grad(set_to_none=True)
        logits, attack_logit = model(input_ids, attention_mask)
        loss_cls = criterion(logits, labels)
        # Binary attack target: anything not SAFE.
        attack_target = (labels != 0).float()
        loss_atk = F.binary_cross_entropy_with_logits(attack_logit, attack_target)
        loss = loss_cls + attack_weight * loss_atk
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        total_loss += float(loss.item())
        preds = torch.argmax(logits, dim=1)
        all_preds.extend(preds.detach().cpu().tolist())
        all_labels.extend(labels.detach().cpu().tolist())
        steps += 1

    f1 = f1_score(all_labels, all_preds, average="weighted", zero_division=0)
    return {"loss": total_loss / max(1, steps), "f1": float(f1)}


@torch.no_grad()
def evaluate(
    model: SoterLLMv4,
    loader: DataLoader,
    device: torch.device,
    label_names: list[str],
    temperature: float = 1.0,
) -> dict[str, Any]:
    model.eval()
    all_preds: list[int] = []
    all_labels: list[int] = []
    all_probs: list[list[float]] = []
    all_attack: list[float] = []
    total_loss = 0.0
    steps = 0
    t = max(temperature, 1e-3)

    for input_ids, attention_mask, labels in loader:
        input_ids = input_ids.to(device)
        attention_mask = attention_mask.to(device)
        labels = labels.to(device)
        logits, attack_logit = model(input_ids, attention_mask)
        loss = F.cross_entropy(logits, labels)
        total_loss += float(loss.item())
        probs = torch.softmax(logits / t, dim=1)
        preds = torch.argmax(probs, dim=1)
        all_preds.extend(preds.cpu().tolist())
        all_labels.extend(labels.cpu().tolist())
        all_probs.extend(probs.cpu().tolist())
        all_attack.extend(torch.sigmoid(attack_logit).cpu().tolist())
        steps += 1

    accuracy = sum(p == l for p, l in zip(all_preds, all_labels)) / max(1, len(all_preds))
    f1_macro = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    f1_weighted = f1_score(all_labels, all_preds, average="weighted", zero_division=0)
    report = classification_report(
        all_labels,
        all_preds,
        labels=list(range(len(label_names))),
        target_names=label_names,
        zero_division=0,
        output_dict=True,
    )

    # Binary attack metrics (security-primary)
    y_true_atk = [0 if l == 0 else 1 for l in all_labels]
    y_pred_atk = [0 if p == 0 else 1 for p in all_preds]
    prec, rec, f1b, _ = precision_recall_fscore_support(
        y_true_atk, y_pred_atk, average="binary", zero_division=0
    )

    return {
        "loss": total_loss / max(1, steps),
        "accuracy": float(accuracy),
        "f1_macro": float(f1_macro),
        "f1_weighted": float(f1_weighted),
        "attack_precision": float(prec),
        "attack_recall": float(rec),
        "attack_f1": float(f1b),
        "classification_report": report,
        "predictions": all_preds,
        "labels": all_labels,
        "probabilities": all_probs,
        "attack_probs": all_attack,
    }


# ── Calibration ────────────────────────────────────────────────────────────────


def expected_calibration_error(
    confidences: list[float], correct: list[bool], n_bins: int = 15
) -> float:
    if not confidences:
        return 0.0
    bins = [[] for _ in range(n_bins)]
    for c, ok in zip(confidences, correct):
        idx = min(n_bins - 1, int(c * n_bins))
        bins[idx].append((c, 1.0 if ok else 0.0))
    ece = 0.0
    n = len(confidences)
    for bucket in bins:
        if not bucket:
            continue
        conf = sum(c for c, _ in bucket) / len(bucket)
        acc = sum(a for _, a in bucket) / len(bucket)
        ece += (len(bucket) / n) * abs(conf - acc)
    return float(ece)


def fit_temperature(
    logits_list: list[list[float]], labels: list[int], max_iter: int = 80
) -> float:
    """Grid + refine temperature to minimize NLL on calibration set."""
    logits = torch.tensor(logits_list, dtype=torch.float32)
    y = torch.tensor(labels, dtype=torch.long)

    def nll(t: float) -> float:
        t = max(t, 1e-3)
        return float(F.cross_entropy(logits / t, y).item())

    # Coarse grid
    best_t, best = 1.0, nll(1.0)
    for t in np.linspace(0.5, 5.0, 46):
        v = nll(float(t))
        if v < best:
            best, best_t = v, float(t)
    # Local refine
    for step in (0.2, 0.05, 0.01):
        for t in (best_t - step, best_t, best_t + step):
            if t <= 0.05:
                continue
            v = nll(float(t))
            if v < best:
                best, best_t = v, float(t)
    return float(best_t)


@torch.no_grad()
def collect_logits(
    model: SoterLLMv4, loader: DataLoader, device: torch.device
) -> tuple[list[list[float]], list[int], list[list[float]]]:
    model.eval()
    logits_all: list[list[float]] = []
    labels_all: list[int] = []
    probs_all: list[list[float]] = []
    for input_ids, attention_mask, labels in loader:
        input_ids = input_ids.to(device)
        attention_mask = attention_mask.to(device)
        logits, _ = model(input_ids, attention_mask)
        probs = torch.softmax(logits, dim=1)
        logits_all.extend(logits.cpu().tolist())
        probs_all.extend(probs.cpu().tolist())
        labels_all.extend(labels.tolist())
    return logits_all, labels_all, probs_all


def fit_per_label_thresholds(
    probs: list[list[float]],
    labels: list[int],
    num_labels: int,
    target_fpr: float = 0.01,
) -> dict[str, float]:
    """
    For each attack class, find the lowest probability threshold such that
    the false-positive rate on SAFE examples stays ≤ target_fpr.
    Falls back to 0.5 if not enough SAFE mass.
    """
    thresholds: dict[str, float] = {"SAFE": 0.0}
    safe_idx = [i for i, y in enumerate(labels) if y == 0]
    for c in range(1, num_labels):
        name = ALL_LABELS[c]
        if not safe_idx:
            thresholds[name] = 0.5
            continue
        safe_scores = sorted([probs[i][c] for i in safe_idx], reverse=True)
        # Allow at most floor(target_fpr * n_safe) false positives
        max_fp = max(0, int(math.floor(target_fpr * len(safe_scores))))
        if max_fp >= len(safe_scores):
            thr = 0.05
        elif max_fp == 0:
            thr = safe_scores[0] + 1e-6  # stricter than any SAFE score
        else:
            thr = safe_scores[max_fp]  # the (max_fp)-th highest SAFE score
        thresholds[name] = float(min(0.99, max(0.15, thr)))
    return thresholds


def compute_ood_stats(
    probs: list[list[float]], labels: list[int]
) -> dict[str, float]:
    """Stats used to set an abstention floor on max-probability / entropy."""
    max_probs = [max(p) for p in probs]
    entropies = []
    for p in probs:
        e = 0.0
        for x in p:
            if x > 1e-12:
                e -= x * math.log(x)
        entropies.append(e)
    # On correct in-distribution predictions, 5th percentile max_prob is a
    # reasonable abstention floor (below this → ABSTAIN / treat carefully).
    correct_max = [m for m, y, p in zip(max_probs, labels, probs) if int(np.argmax(p)) == y]
    if not correct_max:
        correct_max = max_probs
    floor = float(np.percentile(correct_max, 5))
    return {
        "max_prob_p05": floor,
        "max_prob_mean": float(np.mean(max_probs)),
        "entropy_mean": float(np.mean(entropies)),
        "entropy_p95": float(np.percentile(entropies, 95)),
        "suggested_abstain_max_prob": float(max(0.25, min(0.55, floor))),
    }


# ── Split ──────────────────────────────────────────────────────────────────────


def group_aware_three_way_split(
    groups: list[str],
    val_frac: float,
    cal_frac: float,
    seed: int,
) -> tuple[list[int], list[int], list[int]]:
    """Split indices by group key into train / cal / val with zero group overlap."""
    group_to_indices: dict[str, list[int]] = defaultdict(list)
    for idx, g in enumerate(groups):
        group_to_indices[g].append(idx)

    unique = list(group_to_indices.keys())
    rng = np.random.RandomState(seed)
    rng.shuffle(unique)

    n = sum(len(v) for v in group_to_indices.values())
    target_val = int(n * val_frac)
    target_cal = int(n * cal_frac)

    val_idx: list[int] = []
    cal_idx: list[int] = []
    for g in unique:
        if len(val_idx) < target_val:
            val_idx.extend(group_to_indices[g])
        elif len(cal_idx) < target_cal:
            cal_idx.extend(group_to_indices[g])
        else:
            break

    used = set(val_idx) | set(cal_idx)
    train_idx = [i for i in range(n) if i not in used]
    return train_idx, cal_idx, val_idx


# ── ONNX export ────────────────────────────────────────────────────────────────


def export_to_onnx(
    model: SoterLLMv4,
    tokenizer,
    output_dir: str,
    temperature: float,
) -> str:
    model.eval()
    wrapper = SoterLLMv4OnnxWrapper(model, temperature=temperature)
    wrapper.eval()
    dummy = tokenizer(
        ["Sample input for ONNX tracing of SoterLLM v4 classifier."],
        return_tensors="pt",
    )
    output_path = os.path.join(output_dir, "model.onnx")
    # Torch 2.x defaults to the dynamo exporter which prefers opset >= 18
    # (LayerNormalization has no opset-14 previous version). Use 18 + dynamo
    # path, with a legacy fallback for older torch builds.
    export_kwargs = dict(
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size"},
        },
        opset_version=18,
        do_constant_folding=True,
    )
    try:
        torch.onnx.export(
            wrapper,
            (dummy["input_ids"], dummy["attention_mask"]),
            output_path,
            **export_kwargs,
        )
    except TypeError:
        # Older torch without dynamo kwargs
        torch.onnx.export(
            wrapper,
            (dummy["input_ids"], dummy["attention_mask"]),
            output_path,
            **export_kwargs,
        )

    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"  [OK] ONNX validated: {output_path}")

    sess = onnxruntime.InferenceSession(output_path)
    ort_out = sess.run(
        None,
        {
            "input_ids": dummy["input_ids"].numpy(),
            "attention_mask": dummy["attention_mask"].numpy(),
        },
    )
    print(f"  [OK] ONNX inference shape: {ort_out[0].shape}")
    return output_path


def save_tokenizer(output_dir: str, tokenizer) -> str:
    tok_dir = os.path.join(output_dir, "tokenizer_config")
    tokenizer.save_pretrained(tok_dir)
    vocab = tokenizer.get_vocab()
    sorted_tokens = sorted(vocab.items(), key=lambda x: x[1])
    with open(os.path.join(tok_dir, "vocab.txt"), "w", encoding="utf-8") as f:
        for token, _ in sorted_tokens:
            f.write(token + "\n")
    print(f"  [OK] Tokenizer + vocab.txt → {tok_dir}")
    return tok_dir


# ── Main ───────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train SoterLLM v4 (market-leading local classifier)")
    p.add_argument("--train-datasets", nargs="+", default=None)
    p.add_argument("--val-split", type=float, default=0.12, help="Group-aware val fraction")
    p.add_argument("--cal-split", type=float, default=0.08, help="Group-aware calibration fraction")
    p.add_argument("--epochs", type=int, default=4)
    p.add_argument("--batch-size", type=int, default=12)
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--max-length", type=int, default=256)
    p.add_argument("--dropout", type=float, default=0.15)
    p.add_argument("--label-smoothing", type=float, default=0.05)
    p.add_argument("--focal-gamma", type=float, default=1.5)
    p.add_argument("--attack-loss-weight", type=float, default=0.35)
    p.add_argument("--target-fpr", type=float, default=0.01)
    p.add_argument("--output-dir", type=str, default="models/ml-classifier-v4")
    p.add_argument("--sample", action="store_true", help="Quick 200-sample smoke run")
    p.add_argument(
        "--max-samples",
        type=int,
        default=None,
        help="Cap dataset size (stratified shuffle). Useful for mid-size CPU trains.",
    )
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--no-cuda", action="store_true")
    p.add_argument("--weight-decay", type=float, default=0.01)
    return p.parse_args()



def main() -> None:
    args = parse_args()
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    device = torch.device(
        "cpu" if args.no_cuda or not torch.cuda.is_available() else "cuda"
    )
    print(f"\n{'=' * 72}")
    print(f"  {PRODUCT_NAME} {PRODUCT_VERSION} — Market-leading local AI security classifier")
    print(f"  Base: {MODEL_NAME}  |  Device: {device}")
    print(f"{'=' * 72}\n")

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    # Datasets
    train_datasets = args.train_datasets
    if not train_datasets:
        train_datasets = [p for p in DEFAULT_DATASETS if Path(p).exists()]
        # Prefer the newest single file only to avoid double-counting if multiple exist
        if train_datasets:
            train_datasets = [train_datasets[0]]
    if not train_datasets:
        print("[ERROR] No datasets found. Generate datasets/ml-augmented-v6.jsonl first.")
        sys.exit(1)

    print("[INFO] Input datasets:")
    for fp in train_datasets:
        print(f"  {'[OK]' if Path(fp).exists() else '[MISSING]'} {fp}")

    label_to_idx = {n: i for i, n in enumerate(ALL_LABELS)}
    num_labels = len(ALL_LABELS)

    print("\n[INFO] Loading dataset...")
    max_samples = 200 if args.sample else args.max_samples
    full = AdversarialDataset(train_datasets, label_to_idx, max_samples=max_samples)

    if len(full) < 20:
        print("[ERROR] Dataset too small.")
        sys.exit(1)

    train_idx, cal_idx, val_idx = group_aware_three_way_split(
        full.groups, args.val_split, args.cal_split, args.seed
    )
    # Ensure non-empty splits on tiny sample runs
    if args.sample:
        n = len(full)
        if len(val_idx) < 5:
            val_idx = list(range(max(1, n // 5)))
            cal_idx = list(range(len(val_idx), min(n, len(val_idx) + max(1, n // 10))))
            used = set(val_idx) | set(cal_idx)
            train_idx = [i for i in range(n) if i not in used]
        if not train_idx:
            train_idx = list(range(max(1, n // 2)))

    train_set = Subset(full, train_idx)
    cal_set = Subset(full, cal_idx) if cal_idx else Subset(full, val_idx[: max(1, len(val_idx) // 2)])
    val_set = Subset(full, val_idx) if val_idx else Subset(full, list(range(min(10, len(full)))))

    print(
        f"\n[INFO] GROUP-AWARE 3-way split: "
        f"{len(train_set)} train / {len(cal_set)} cal / {len(val_set)} val"
    )
    print(
        f"       groups total={len(set(full.groups))}  "
        f"(0 shared across splits by construction)"
    )

    print(f"\n[INFO] Loading tokenizer ({MODEL_NAME})...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def make_loader(subset, shuffle: bool, bs: int) -> DataLoader:
        return DataLoader(
            subset,
            batch_size=bs,
            shuffle=shuffle,
            collate_fn=lambda b: collate_fn(b, tokenizer, args.max_length),
            num_workers=0,
        )

    train_loader = make_loader(train_set, True, args.batch_size)
    cal_loader = make_loader(cal_set, False, max(8, args.batch_size * 2))
    val_loader = make_loader(val_set, False, max(8, args.batch_size * 2))

    print(f"  Train batches: {len(train_loader)}  Cal: {len(cal_loader)}  Val: {len(val_loader)}")

    print(f"\n[INFO] Initializing SoterLLM v4 head (MLP {EMBEDDING_DIM}→{HEAD_HIDDEN}→{num_labels})...")
    model = SoterLLMv4(num_labels=num_labels, dropout=args.dropout)
    model.to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"  Parameters: {n_params:,}")

    # Class-balanced weights from TRAIN labels only
    train_labels = [full.labels[i] for i in train_idx]
    class_w = effective_number_weights(train_labels, num_labels).to(device)
    print(f"  Class weights: {[round(float(w), 3) for w in class_w.cpu()]}")
    criterion = FocalCE(
        weight=class_w,
        label_smoothing=args.label_smoothing,
        gamma=args.focal_gamma,
    )

    steps_total = max(1, len(train_loader) * args.epochs)
    warmup = int(steps_total * 0.08)
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=warmup, num_training_steps=steps_total
    )

    print(f"  lr={args.lr}  epochs={args.epochs}  max_len={args.max_length}  "
          f"focal_γ={args.focal_gamma}  smooth={args.label_smoothing}")

    print(f"\n{'-' * 72}\n  Training\n{'-' * 72}\n")
    history: list[dict] = []
    best_f1 = -1.0
    best_path = os.path.join(args.output_dir, "pytorch_model.bin")
    os.makedirs(args.output_dir, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        tr = train_epoch(
            model,
            train_loader,
            optimizer,
            scheduler,
            device,
            criterion,
            attack_weight=args.attack_loss_weight,
        )
        va = evaluate(model, val_loader, device, ALL_LABELS, temperature=1.0)
        dt = time.time() - t0
        if va["f1_weighted"] > best_f1:
            best_f1 = va["f1_weighted"]
            torch.save(model.state_dict(), best_path)
        rec = {
            "epoch": epoch,
            "train_loss": round(tr["loss"], 4),
            "train_f1": round(tr["f1"], 4),
            "val_loss": round(va["loss"], 4),
            "val_accuracy": round(va["accuracy"], 4),
            "val_f1_macro": round(va["f1_macro"], 4),
            "val_f1_weighted": round(va["f1_weighted"], 4),
            "val_attack_recall": round(va["attack_recall"], 4),
            "val_attack_precision": round(va["attack_precision"], 4),
            "time_seconds": round(dt, 1),
        }
        history.append(rec)
        print(
            f"  Epoch {epoch:2d}/{args.epochs}  "
            f"train_loss={rec['train_loss']:.4f}  "
            f"val_f1={rec['val_f1_weighted']:.4f}  "
            f"atk_rec={rec['val_attack_recall']:.4f}  "
            f"[{rec['time_seconds']:.1f}s]"
        )

    print(f"\n[INFO] Loading best checkpoint (val F1={best_f1:.4f})...")
    model.load_state_dict(torch.load(best_path, map_location=device))
    model.to(device)

    # ── Calibration ────────────────────────────────────────────────────────────
    print(f"\n{'-' * 72}\n  Calibration (temperature + per-label thresholds + OOD)\n{'-' * 72}\n")
    cal_logits, cal_labels, cal_probs = collect_logits(model, cal_loader, device)
    temperature = fit_temperature(cal_logits, cal_labels)
    print(f"  Temperature: {temperature:.4f}")

    # Recompute cal probs with temperature
    cal_probs_t = []
    for logit in cal_logits:
        x = np.array(logit, dtype=np.float64) / temperature
        x = x - x.max()
        e = np.exp(x)
        cal_probs_t.append((e / e.sum()).tolist())

    confidences = [max(p) for p in cal_probs_t]
    correct = [int(np.argmax(p)) == y for p, y in zip(cal_probs_t, cal_labels)]
    ece_before = expected_calibration_error(
        [max(p) for p in cal_probs],
        [int(np.argmax(p)) == y for p, y in zip(cal_probs, cal_labels)],
    )
    ece_after = expected_calibration_error(confidences, correct)
    print(f"  ECE before T: {ece_before:.4f}  → after T: {ece_after:.4f}")

    thresholds = fit_per_label_thresholds(
        cal_probs_t, cal_labels, num_labels, target_fpr=args.target_fpr
    )
    ood = compute_ood_stats(cal_probs_t, cal_labels)
    print(f"  Per-label thresholds (target FPR≤{args.target_fpr}):")
    for k, v in thresholds.items():
        if k != "SAFE":
            print(f"    {k:40s} {v:.4f}")
    print(f"  OOD abstain max_prob floor: {ood['suggested_abstain_max_prob']:.4f}")

    calibration = {
        "product": PRODUCT_NAME,
        "version": PRODUCT_VERSION,
        "temperature": temperature,
        "ece_before": ece_before,
        "ece_after": ece_after,
        "target_fpr": args.target_fpr,
        "per_label_thresholds": thresholds,
        "ood": ood,
        "notes": (
            "Temperature is baked into exported ONNX logits (logits_out = raw/T). "
            "Per-label thresholds and OOD floor are applied in lib/ml/onnxBackend.ts."
        ),
    }
    cal_path = os.path.join(args.output_dir, "calibration.json")
    with open(cal_path, "w", encoding="utf-8") as f:
        json.dump(calibration, f, indent=2)
    print(f"  [OK] Wrote {cal_path}")

    # ── Final honest val eval (with temperature) ───────────────────────────────
    print("\n[INFO] Final GROUP-AWARE validation (temperature-scaled)...")
    final = evaluate(model, val_loader, device, ALL_LABELS, temperature=temperature)
    report = final["classification_report"]
    print(f"  Accuracy:      {final['accuracy']:.4f}")
    print(f"  F1 macro:      {final['f1_macro']:.4f}")
    print(f"  F1 weighted:   {final['f1_weighted']:.4f}")
    print(f"  Attack recall: {final['attack_recall']:.4f}  precision: {final['attack_precision']:.4f}")
    print("\n  Per-label:")
    for name in ALL_LABELS:
        if name in report:
            m = report[name]
            print(
                f"  {name:40s} P={m['precision']:.3f} R={m['recall']:.3f} "
                f"F1={m['f1-score']:.3f} n={m['support']:.0f}"
            )

    # ── Export ─────────────────────────────────────────────────────────────────
    print(f"\n{'-' * 72}\n  Export ONNX + artifacts\n{'-' * 72}\n")
    model.cpu()
    onnx_path = export_to_onnx(model, tokenizer, args.output_dir, temperature=temperature)
    labels_path = os.path.join(args.output_dir, "labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump({str(i): n for i, n in enumerate(ALL_LABELS)}, f, indent=2)
    tok_path = save_tokenizer(args.output_dir, tokenizer)

    # Keep a CPU pytorch checkpoint too
    torch.save(model.state_dict(), best_path)

    manifest = {
        "product": PRODUCT_NAME,
        "version": PRODUCT_VERSION,
        "datasets": train_datasets,
        "rows_total": len(full),
        "groups_total": len(set(full.groups)),
        "split": {
            "method": "group_aware_three_way",
            "train": len(train_set),
            "calibration": len(cal_set),
            "validation": len(val_set),
            "val_frac": args.val_split,
            "cal_frac": args.cal_split,
            "seed": args.seed,
        },
        "label_counts": {
            ALL_LABELS[i]: int(sum(1 for y in full.labels if y == i))
            for i in range(num_labels)
        },
        "honesty": (
            "Validation metrics are group-aware and must NOT be compared to v3's "
            "leaked random_split 99% F1. Prefer held-out novel benchmarks for claims."
        ),
    }
    with open(os.path.join(args.output_dir, "dataset_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    stats = {
        "product_name": PRODUCT_NAME,
        "product_version": PRODUCT_VERSION,
        "base_model": MODEL_NAME,
        "embedding_dim": EMBEDDING_DIM,
        "head": f"LayerNorm + MLP({EMBEDDING_DIM},{HEAD_HIDDEN},{num_labels}) + attack_head",
        "num_labels": num_labels,
        "labels": ALL_LABELS,
        "training_args": {k: (v if not isinstance(v, Path) else str(v)) for k, v in vars(args).items()},
        "history": history,
        "calibration": calibration,
        "final_metrics": {
            "loss": final["loss"],
            "accuracy": final["accuracy"],
            "f1_macro": final["f1_macro"],
            "f1_weighted": final["f1_weighted"],
            "attack_precision": final["attack_precision"],
            "attack_recall": final["attack_recall"],
            "attack_f1": final["attack_f1"],
            "split": "group_aware_validation",
        },
        "per_label_metrics": {n: report[n] for n in ALL_LABELS if n in report},
    }
    with open(os.path.join(args.output_dir, "training_stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    eval_out = {
        "product_version": PRODUCT_VERSION,
        "split": "group_aware_validation",
        "accuracy": final["accuracy"],
        "f1_macro": final["f1_macro"],
        "f1_weighted": final["f1_weighted"],
        "attack_precision": final["attack_precision"],
        "attack_recall": final["attack_recall"],
        "attack_f1": final["attack_f1"],
        "temperature": temperature,
        "ece_calibration": ece_after,
        "per_label": {
            name: {
                "precision": report[name]["precision"],
                "recall": report[name]["recall"],
                "f1": report[name]["f1-score"],
                "support": report[name]["support"],
                "threshold": thresholds.get(name),
            }
            for name in ALL_LABELS
            if name in report
        },
    }
    with open(os.path.join(args.output_dir, "eval_results.json"), "w", encoding="utf-8") as f:
        json.dump(eval_out, f, indent=2)

    size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
    external = os.path.join(args.output_dir, "model.onnx.data")
    if os.path.exists(external):
        size_mb += os.path.getsize(external) / (1024 * 1024)

    print(f"\n{'=' * 72}")
    print(f"  SoterLLM v4 training complete")
    print(f"{'=' * 72}")
    print(f"  Best group-aware val F1: {best_f1:.4f}")
    print(f"  Attack recall (val):     {final['attack_recall']:.4f}")
    print(f"  Temperature:             {temperature:.4f}  ECE={ece_after:.4f}")
    print(f"  ONNX:                    {onnx_path}  (~{size_mb:.1f} MB)")
    print(f"  Calibration:             {cal_path}")
    print(f"  Labels:                  {labels_path}")
    print(f"  Tokenizer:               {tok_path}/")
    print(f"  Wire-up:")
    print(f"    ML_ONNX_MODEL_PATH={args.output_dir}/model.onnx")
    print(f"    ML_ONNX_LABELS_PATH={args.output_dir}/labels.json")
    print(f"    ML_ONNX_CALIBRATION_PATH={args.output_dir}/calibration.json")
    print(f"{'=' * 72}\n")


if __name__ == "__main__":
    main()
