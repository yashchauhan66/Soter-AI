#!/usr/bin/env python3
"""
SoterLLM v10 — Transfer-learning trainer (CPU-feasible, genuinely strong).

Why transfer learning:
  Full encoder fine-tuning on 136K samples is infeasible on CPU (multi-hour).
  The v7 encoder is ALREADY specialized for AI-security text. Its weaknesses
  live in the decision head + training distribution, not the encoder.

  v10 improvements over v9:
    - Added 5 NEW attack categories (8000 samples):
      * TOOL_CALL_ABUSE - AI agent tool/function manipulation
      * ENCODING_OBFUSCATION - Base64, hex, ROT13, homoglyph attacks
      * MULTI_TURN_ESCALATION - Crescendo/gradual escalation attacks
      * MODEL_EXTRACTION - Model weights/training data extraction
      * TOXICITY_HARASSMENT - Toxic, harassing content
    - Total: 14 threat categories (most comprehensive in market)

  Strategy:
    1. Load the v7 checkpoint, extract encoder + norm (freeze them).
    2. Precompute mean-pooled embeddings for the whole v10 corpus ONCE and cache
       to disk (~15 min on this CPU, then free forever).
    3. Train a higher-capacity head (384→512→256→14) + binary attack head on the
       cached embeddings with class-balanced focal loss + label smoothing.
    4. Calibrate (temperature + per-label thresholds) on a held-out calibration
       split; honest group-aware validation.
    5. Re-attach the frozen encoder + trained head and export ONNX in the exact
       same format the existing inference pipeline expects.

Usage:
  python scripts/ml/train-soterllm-v10-transfer.py \
      --train-datasets datasets/ml-augmented-v8-final.jsonl datasets/ml-v8-targeted-fix.jsonl datasets/ml-v10-advanced-attacks.jsonl \
      --v7-checkpoint models/ml-classifier-v7/pytorch_model.bin \
      --epochs 30 --batch-size 512 --output-dir models/ml-classifier-v10
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import classification_report, f1_score
from torch.optim import AdamW
from torch.utils.data import DataLoader, TensorDataset
from transformers import AutoModel, AutoTokenizer

# ── Constants ──────────────────────────────────────────────────────────────────

PRODUCT_NAME = "SoterLLM"
PRODUCT_VERSION = "v11"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
HEAD_HIDDEN_1 = 512
HEAD_HIDDEN_2 = 256
MAX_LENGTH = 256

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
    # v10 new categories
    "TOOL_CALL_ABUSE",
    "ENCODING_OBFUSCATION",
    "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION",
    "TOXICITY_HARASSMENT",
]


def group_key_for(text: str) -> str:
    """Must match train-soterllm-v4.py::group_key_for exactly."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


# ── v4 architecture (to load the v7 checkpoint) ────────────────────────────────


class SoterLLMv4(nn.Module):
    """Exact v4/v7 architecture for checkpoint loading."""

    def __init__(self, num_labels: int, dropout: float = 0.15, head_hidden: int = 256):
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
        self.attack_head = nn.Linear(EMBEDDING_DIM, 1)

    def encode(self, input_ids, attention_mask):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        token_embeddings = outputs.last_hidden_state
        mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        summed = torch.sum(token_embeddings * mask, dim=1)
        denom = torch.clamp(mask.sum(dim=1), min=1e-9)
        return self.norm(summed / denom)


# ── v8 head (trained on frozen embeddings) ─────────────────────────────────────


class V8Head(nn.Module):
    """High-capacity head over frozen v7 embeddings."""

    def __init__(self, num_labels: int, dropout: float = 0.25):
        super().__init__()
        self.head = nn.Sequential(
            nn.Linear(EMBEDDING_DIM, HEAD_HIDDEN_1),
            nn.LayerNorm(HEAD_HIDDEN_1),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(HEAD_HIDDEN_1, HEAD_HIDDEN_2),
            nn.LayerNorm(HEAD_HIDDEN_2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(HEAD_HIDDEN_2, num_labels),
        )
        self.attack_head = nn.Sequential(
            nn.Linear(EMBEDDING_DIM, 128),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(128, 1),
        )

    def forward(self, emb: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        logits = self.head(emb)
        attack_logit = self.attack_head(emb).squeeze(-1)
        return logits, attack_logit


# ── Full v8 model for ONNX export (frozen encoder + trained head) ──────────────


class SoterLLMv8Export(nn.Module):
    """Encoder (frozen v7) + v8 head, for ONNX export matching v4 I/O."""

    def __init__(self, encoder: nn.Module, norm: nn.Module, head_module: V8Head):
        super().__init__()
        self.encoder = encoder
        self.norm = norm
        self.head_module = head_module

    def encode(self, input_ids, attention_mask):
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        token_embeddings = outputs.last_hidden_state
        mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        summed = torch.sum(token_embeddings * mask, dim=1)
        denom = torch.clamp(mask.sum(dim=1), min=1e-9)
        return self.norm(summed / denom)

    def forward(self, input_ids, attention_mask):
        emb = self.encode(input_ids, attention_mask)
        logits, attack_logit = self.head_module(emb)
        return logits, attack_logit


class OnnxWrapper(nn.Module):
    def __init__(self, model: SoterLLMv8Export, temperature: float = 1.0):
        super().__init__()
        self.model = model
        self.temperature = max(float(temperature), 1e-3)

    def forward(self, input_ids, attention_mask):
        logits, _attack = self.model(input_ids, attention_mask)
        return logits / self.temperature


# ── Loss ───────────────────────────────────────────────────────────────────────


def effective_number_weights(labels, num_classes, beta=0.999):
    counts = np.bincount(labels, minlength=num_classes).astype(np.float64)
    counts = np.maximum(counts, 1.0)
    effective = 1.0 - np.power(beta, counts)
    weights = (1.0 - beta) / effective
    weights = weights / weights.sum() * num_classes
    return torch.tensor(weights, dtype=torch.float32)


class FocalCE(nn.Module):
    def __init__(self, weight=None, label_smoothing=0.05, gamma=1.5):
        super().__init__()
        self.weight = weight
        self.label_smoothing = label_smoothing
        self.gamma = gamma

    def forward(self, logits, targets):
        log_probs = F.log_softmax(logits, dim=-1)
        n_classes = logits.size(-1)
        with torch.no_grad():
            true_dist = torch.zeros_like(log_probs)
            true_dist.fill_(self.label_smoothing / max(1, n_classes - 1))
            true_dist.scatter_(1, targets.unsqueeze(1), 1.0 - self.label_smoothing)
        ce = torch.sum(-true_dist * log_probs, dim=-1)
        if self.weight is not None:
            ce = ce * self.weight.to(logits.device)[targets]
        if self.gamma > 0:
            probs = log_probs.exp()
            pt = probs.gather(1, targets.unsqueeze(1)).squeeze(1).clamp(min=1e-8)
            ce = ((1.0 - pt) ** self.gamma) * ce
        return ce.mean()


# ── Data loading ───────────────────────────────────────────────────────────────


def load_jsonl(file_paths, label_to_idx, max_samples=None):
    texts, labels, groups = [], [], []
    for fp in file_paths:
        path = Path(fp)
        if not path.exists():
            print(f"  [WARN] {fp} not found, skipping")
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
                idx = label_to_idx.get(label_str)
                if idx is None:
                    for k, v in label_to_idx.items():
                        if k.upper() == str(label_str).upper():
                            idx = v
                            break
                if idx is None:
                    continue
                texts.append(text)
                labels.append(idx)
                groups.append(group_key_for(text))
    if max_samples and len(texts) > max_samples:
        combined = list(zip(texts, labels, groups))
        rng = np.random.RandomState(42)
        rng.shuffle(combined)
        combined = combined[:max_samples]
        texts, labels, groups = map(list, zip(*combined))
    return texts, labels, groups


def group_aware_split(groups, val_frac=0.12, cal_frac=0.08, seed=42):
    # sorted(), NOT list(set()): per-process str hash randomization makes
    # set-iteration order vary, so the seeded shuffle below yields a different
    # partition every run and the manifest's split becomes unrecoverable. This
    # already cost v12 its calibration split -- see the full write-up in
    # scripts/ml/train-soterllm-v12-transfer.py group_aware_split().
    unique_groups = sorted(set(groups))
    rng = np.random.RandomState(seed)
    rng.shuffle(unique_groups)
    n = len(unique_groups)
    n_val = max(1, int(n * val_frac))
    n_cal = max(1, int(n * cal_frac))
    val_groups = set(unique_groups[:n_val])
    cal_groups = set(unique_groups[n_val:n_val + n_cal])
    train_groups = set(unique_groups[n_val + n_cal:])
    train_idx = [i for i, g in enumerate(groups) if g in train_groups]
    cal_idx = [i for i, g in enumerate(groups) if g in cal_groups]
    val_idx = [i for i, g in enumerate(groups) if g in val_groups]
    return train_idx, cal_idx, val_idx


# ── Embedding precompute ───────────────────────────────────────────────────────


@torch.no_grad()
def precompute_embeddings(texts, encoder, norm, tokenizer, batch_size=64, cache_path=None):
    """Precompute embeddings with resumable chunk-based caching.
    
    Saves progress every CHUNK_SIZE samples so a killed process can resume
    from the last saved chunk instead of starting over.
    """
    CHUNK_SIZE = 10000  # Save checkpoint every 10K samples
    
    if cache_path and Path(cache_path).exists():
        print(f"  [cache] loading embeddings from {cache_path}")
        return torch.from_numpy(np.load(cache_path))

    encoder.eval()
    norm.eval()
    n = len(texts)
    
    # Check for partial progress
    partial_path = Path(cache_path + ".partial.npy") if cache_path else None
    start_offset = 0
    all_embs = []
    
    if partial_path and partial_path.exists():
        try:
            partial = np.load(partial_path)
            start_offset = partial.shape[0]
            all_embs.append(torch.from_numpy(partial))
            print(f"  [cache] resuming from chunk {start_offset}/{n}")
        except Exception as e:
            print(f"  [cache] partial file corrupt ({e}), starting fresh")
            start_offset = 0
            all_embs = []
    
    t0 = time.time()
    chunk_embs = []
    
    for start in range(start_offset, n, batch_size):
        batch = texts[start:start + batch_size]
        enc = tokenizer(batch, padding=True, truncation=True, max_length=MAX_LENGTH, return_tensors="pt")
        # SoterLLMv4-style mean pooling via encoder+norm
        outputs = encoder(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"])
        token_embeddings = outputs.last_hidden_state
        mask = enc["attention_mask"].unsqueeze(-1).expand(token_embeddings.size()).float()
        summed = torch.sum(token_embeddings * mask, dim=1)
        denom = torch.clamp(mask.sum(dim=1), min=1e-9)
        pooled = norm(summed / denom)
        chunk_embs.append(pooled.cpu())
        
        done = start + len(batch)
        
        # Save checkpoint every CHUNK_SIZE samples
        if partial_path and done % CHUNK_SIZE < batch_size:
            if chunk_embs:
                all_embs.append(torch.cat(chunk_embs, dim=0))
                chunk_embs = []
            combined = torch.cat(all_embs, dim=0)
            partial_path.parent.mkdir(parents=True, exist_ok=True)
            np.save(partial_path, combined.numpy())
            rate = done / max(1e-6, time.time() - t0 + 1)
            print(f"    [checkpoint] saved {done}/{n} embeddings")
        
        if (start // batch_size) % 50 == 0:
            rate = done / max(1e-6, time.time() - t0 + 1)
            eta = (n - done) / max(1e-6, rate)
            print(f"    embedded {done}/{n} ({rate:.0f}/s, ETA {eta/60:.1f} min)")
    
    if chunk_embs:
        all_embs.append(torch.cat(chunk_embs, dim=0))
    
    embs = torch.cat(all_embs, dim=0)
    
    if cache_path:
        Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
        np.save(cache_path, embs.numpy())
        print(f"  [cache] saved final embeddings to {cache_path}")
        # Clean up partial file
        if partial_path and partial_path.exists():
            partial_path.unlink()
    
    return embs


# ── Eval ───────────────────────────────────────────────────────────────────────


@torch.no_grad()
def evaluate_head(head_module, embs, labels, num_labels, label_names):
    head_module.eval()
    loader = DataLoader(TensorDataset(embs, torch.tensor(labels, dtype=torch.long)), batch_size=1024, shuffle=False)
    all_logits, all_labels = [], []
    for emb_batch, label_batch in loader:
        logits, _ = head_module(emb_batch)
        all_logits.append(logits)
        all_labels.append(label_batch)
    logits = torch.cat(all_logits).numpy()
    labels_np = torch.cat(all_labels).numpy()
    preds = logits.argmax(axis=1)
    acc = (preds == labels_np).mean()
    f1_macro = f1_score(labels_np, preds, average="macro", zero_division=0)
    f1_weighted = f1_score(labels_np, preds, average="weighted", zero_division=0)
    attack_mask = labels_np > 0
    attack_recall = (preds[attack_mask] > 0).mean() if attack_mask.sum() else 0.0
    attack_precision = (labels_np[preds > 0] > 0).mean() if (preds > 0).sum() else 0.0
    report = classification_report(labels_np, preds, labels=list(range(num_labels)),
                                   target_names=label_names, output_dict=True, zero_division=0)
    return {"accuracy": float(acc), "f1_macro": float(f1_macro), "f1_weighted": float(f1_weighted),
            "attack_recall": float(attack_recall), "attack_precision": float(attack_precision),
            "report": report, "logits": logits, "labels": labels_np, "preds": preds}


# ── Calibration ────────────────────────────────────────────────────────────────


def fit_temperature(logits, labels):
    from scipy.optimize import minimize_scalar

    def nll(T):
        scaled = logits / max(T, 1e-3)
        log_probs = scaled - np.log(np.exp(scaled).sum(axis=1, keepdims=True) + 1e-10)
        return -log_probs[np.arange(len(labels)), labels].mean()

    result = minimize_scalar(nll, bounds=(0.1, 5.0), method="bounded")
    return float(result.x)


def fit_per_label_thresholds(probs, labels, num_labels, target_fpr=0.01):
    thresholds = {}
    for i in range(num_labels):
        name = ALL_LABELS[i]
        if i == 0:
            thresholds[name] = 0.0
            continue
        other = probs[labels != i, i]
        if len(other) == 0:
            thresholds[name] = 0.15
            continue
        sorted_scores = np.sort(other)[::-1]
        idx = int(len(sorted_scores) * target_fpr)
        thresholds[name] = float(max(0.05, min(0.5, sorted_scores[min(idx, len(sorted_scores) - 1)])))
    return thresholds


def compute_ece(probs, labels, n_bins=15):
    confidences = probs.max(axis=1)
    predictions = probs.argmax(axis=1)
    accuracies = (predictions == labels).astype(float)
    boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        mask = (confidences > boundaries[i]) & (confidences <= boundaries[i + 1])
        if mask.sum():
            ece += mask.sum() / len(labels) * abs(accuracies[mask].mean() - confidences[mask].mean())
    return float(ece)


# ── Main ───────────────────────────────────────────────────────────────────────


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-datasets", nargs="+", default=["datasets/ml-augmented-v8-final.jsonl", "datasets/ml-v8-targeted-fix.jsonl", "datasets/ml-v10-advanced-attacks.jsonl", "datasets/ml-v10-targeted-fix.jsonl", "datasets/ml-v11-weak-fix.jsonl"])
    ap.add_argument("--v7-checkpoint", default="models/ml-classifier-v7/pytorch_model.bin")
    ap.add_argument("--output-dir", default="models/ml-classifier-v11")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch-size", type=int, default=512)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--dropout", type=float, default=0.25)
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--emb-cache", default="artifacts/ml-v2/v11-final-embeddings.npy")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    torch.set_num_threads(8)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    label_to_idx = {n: i for i, n in enumerate(ALL_LABELS)}
    num_labels = len(ALL_LABELS)

    # 1. Load v7 checkpoint → extract encoder + norm
    # Note: v7 was trained with 9 labels, so we load with that size
    # and only extract encoder + norm (the head is discarded)
    print(f"\n[1/6] Loading v7 checkpoint: {args.v7_checkpoint}")
    V7_NUM_LABELS = 9  # Original v7 label count
    v7 = SoterLLMv4(num_labels=V7_NUM_LABELS, dropout=0.15)
    state = torch.load(args.v7_checkpoint, map_location="cpu")
    v7.load_state_dict(state)
    encoder = v7.encoder
    norm = v7.norm
    for p in encoder.parameters():
        p.requires_grad = False
    for p in norm.parameters():
        p.requires_grad = False
    encoder.eval()
    norm.eval()
    print("  encoder + norm loaded and frozen")

    # 2. Load dataset
    print("\n[2/6] Loading dataset...")
    max_samples = 3000 if args.sample else None
    texts, labels, groups = load_jsonl(args.train_datasets, label_to_idx, max_samples)
    print(f"  {len(texts)} samples loaded")
    from collections import Counter
    lc = Counter(labels)
    for i, name in enumerate(ALL_LABELS):
        print(f"    {name:40s} {lc.get(i,0):6d} ({100*lc.get(i,0)/len(labels):5.1f}%)")

    # 3. Precompute embeddings
    print("\n[3/6] Precomputing embeddings (frozen v7 encoder)...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    embs = precompute_embeddings(texts, encoder, norm, tokenizer, batch_size=64, cache_path=args.emb_cache)
    labels_t = torch.tensor(labels, dtype=torch.long)
    print(f"  embeddings shape: {tuple(embs.shape)}")

    # 4. Group-aware split
    print("\n[4/6] Group-aware split...")
    train_idx, cal_idx, val_idx = group_aware_split(groups, 0.12, 0.08, args.seed)
    print(f"  train={len(train_idx)}  cal={len(cal_idx)}  val={len(val_idx)}")

    train_embs, train_labels = embs[train_idx], labels_t[train_idx]
    cal_embs, cal_labels = embs[cal_idx], labels_t[cal_idx]
    val_embs, val_labels = embs[val_idx], labels_t[val_idx]

    # 5. Train head
    print("\n[5/6] Training v8 head...")
    head = V8Head(num_labels, dropout=args.dropout)
    class_weights = effective_number_weights(train_labels.tolist(), num_labels)
    criterion = FocalCE(weight=class_weights, label_smoothing=0.05, gamma=1.5)
    optimizer = AdamW(head.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    train_ds = TensorDataset(train_embs, train_labels)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)

    best_f1 = 0.0
    best_epoch = 0
    best_state = None
    for epoch in range(args.epochs):
        head.train()
        total_loss = 0.0
        for emb_batch, label_batch in train_loader:
            optimizer.zero_grad()
            logits, attack_logit = head(emb_batch)
            loss_cls = criterion(logits, label_batch)
            binary_targets = (label_batch > 0).float()
            loss_attack = F.binary_cross_entropy_with_logits(attack_logit, binary_targets)
            loss = loss_cls + 0.3 * loss_attack
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        scheduler.step()

        val_metrics = evaluate_head(head, val_embs, val_labels.tolist(), num_labels, ALL_LABELS)
        print(f"  Epoch {epoch+1:2d}/{args.epochs} | loss {total_loss/len(train_loader):.4f} | "
              f"val acc {val_metrics['accuracy']:.4f} | F1 {val_metrics['f1_macro']:.4f} | "
              f"atk_rec {val_metrics['attack_recall']:.4f}")
        if val_metrics["f1_macro"] > best_f1:
            best_f1 = val_metrics["f1_macro"]
            best_epoch = epoch + 1
            best_state = {k: v.clone() for k, v in head.state_dict().items()}

    print(f"\n  Best epoch {best_epoch}, val F1 {best_f1:.4f}")
    head.load_state_dict(best_state)

    # 6. Calibrate + export
    print("\n[6/6] Calibrating + exporting...")
    cal_metrics = evaluate_head(head, cal_embs, cal_labels.tolist(), num_labels, ALL_LABELS)
    temperature = fit_temperature(cal_metrics["logits"], cal_metrics["labels"])
    cal_probs = np.exp(cal_metrics["logits"] / temperature)
    cal_probs = cal_probs / cal_probs.sum(axis=1, keepdims=True)
    thresholds = fit_per_label_thresholds(cal_probs, cal_metrics["labels"], num_labels)
    ece_before = compute_ece(np.exp(cal_metrics["logits"]) / np.exp(cal_metrics["logits"]).sum(axis=1, keepdims=True), cal_metrics["labels"])
    ece_after = compute_ece(cal_probs, cal_metrics["labels"])
    print(f"  temperature={temperature:.3f}  ECE {ece_before:.4f} -> {ece_after:.4f}")

    final_metrics = evaluate_head(head, val_embs, val_labels.tolist(), num_labels, ALL_LABELS)

    # Build export model: frozen encoder + norm + trained head
    export_model = SoterLLMv8Export(encoder, norm, head)
    export_model.eval()
    wrapper = OnnxWrapper(export_model, temperature)
    wrapper.eval()

    dummy = tokenizer("test", padding="max_length", truncation=True, max_length=MAX_LENGTH, return_tensors="pt")
    # dynamo=False → legacy exporter: matches the v7 ONNX graph format exactly and
    # avoids torch 2.9 dynamo's emoji logging (crashes on Windows cp1252 consoles).
    torch.onnx.export(
        wrapper, (dummy["input_ids"], dummy["attention_mask"]),
        out_dir / "model.onnx",
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "sequence"},
                      "attention_mask": {0: "batch", 1: "sequence"},
                      "logits": {0: "batch"}},
        opset_version=14,
        dynamo=False,
    )
    print(f"  [OK] {out_dir/'model.onnx'}")

    # Save full pytorch state (encoder + head) for future fine-tuning
    full_state = {}
    full_state.update({f"encoder.{k}": v for k, v in encoder.state_dict().items()})
    full_state.update({f"norm.{k}": v for k, v in norm.state_dict().items()})
    full_state.update({f"head_module.{k}": v for k, v in head.state_dict().items()})
    torch.save(full_state, out_dir / "pytorch_model.bin")
    print(f"  [OK] {out_dir/'pytorch_model.bin'}")

    # Artifacts
    with open(out_dir / "labels.json", "w") as f:
        json.dump({str(i): n for i, n in enumerate(ALL_LABELS)}, f, indent=2)

    calibration = {
        "product": PRODUCT_NAME, "version": PRODUCT_VERSION,
        "temperature": temperature, "ece_before": ece_before, "ece_after": ece_after,
        "target_fpr": 0.01, "per_label_thresholds": thresholds,
        "ood": {"max_prob_p05": float(np.percentile(cal_probs.max(axis=1), 5)),
                "max_prob_mean": float(cal_probs.max(axis=1).mean()),
                "suggested_abstain_max_prob": 0.55},
        "notes": "Temperature baked into ONNX logits. Thresholds + OOD floor applied in lib/ml/onnxBackend.ts.",
    }
    with open(out_dir / "calibration.json", "w") as f:
        json.dump(calibration, f, indent=2)

    stats = {
        "product_name": PRODUCT_NAME, "product_version": PRODUCT_VERSION,
        "base_model": MODEL_NAME, "num_labels": num_labels, "labels": ALL_LABELS,
        "method": "transfer_learning_frozen_v7_encoder",
        "v7_checkpoint": args.v7_checkpoint,
        "architecture": {"head_layers": [EMBEDDING_DIM, HEAD_HIDDEN_1, HEAD_HIDDEN_2, num_labels],
                         "dropout": args.dropout, "max_length": MAX_LENGTH},
        "training": {"epochs": args.epochs, "batch_size": args.batch_size,
                     "learning_rate": args.lr, "best_epoch": best_epoch},
        "final_metrics": {"accuracy": final_metrics["accuracy"], "f1_macro": final_metrics["f1_macro"],
                          "f1_weighted": final_metrics["f1_weighted"],
                          "attack_recall": final_metrics["attack_recall"],
                          "attack_precision": final_metrics["attack_precision"],
                          "split": "group_aware_validation"},
        "per_label_metrics": {n: final_metrics["report"][n] for n in ALL_LABELS if n in final_metrics["report"]},
    }
    with open(out_dir / "training_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    eval_results = {
        "product_version": PRODUCT_VERSION, "split": "group_aware_validation",
        "accuracy": final_metrics["accuracy"], "f1_macro": final_metrics["f1_macro"],
        "f1_weighted": final_metrics["f1_weighted"],
        "attack_precision": final_metrics["attack_precision"], "attack_recall": final_metrics["attack_recall"],
        "temperature": temperature, "ece_calibration": ece_after, "per_label": {},
    }
    for label in ALL_LABELS:
        if label in final_metrics["report"]:
            m = final_metrics["report"][label]
            eval_results["per_label"][label] = {"precision": m["precision"], "recall": m["recall"],
                                                "f1": m["f1-score"], "support": m["support"],
                                                "threshold": thresholds.get(label, 0.15)}
    with open(out_dir / "eval_results.json", "w") as f:
        json.dump(eval_results, f, indent=2)

    manifest = {"product": PRODUCT_NAME, "version": PRODUCT_VERSION,
                "datasets": args.train_datasets, "rows_total": len(texts),
                "groups_total": len(set(groups)),
                "split": {"method": "group_aware_three_way", "train": len(train_idx),
                          "calibration": len(cal_idx), "validation": len(val_idx), "seed": args.seed}}
    with open(out_dir / "dataset_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    tokenizer_dir = out_dir / "tokenizer_config"
    tokenizer_dir.mkdir(exist_ok=True)
    tokenizer.save_pretrained(tokenizer_dir)

    print(f"\n{'='*60}")
    print(f"V11 transfer-learning training complete -> {out_dir}")
    print(f"{'='*60}")
    print(f"  Accuracy:        {final_metrics['accuracy']:.4f}")
    print(f"  F1 Macro:        {final_metrics['f1_macro']:.4f}")
    print(f"  Attack Recall:   {final_metrics['attack_recall']:.4f}")
    print(f"  Attack Precision:{final_metrics['attack_precision']:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())