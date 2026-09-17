#!/usr/bin/env python3
"""Validate the Python harness against the repo's own v14-10k-attack-audit.

Reproduces scripts/guard-benchmark/v14-10k-attack-audit.ts EXACTLY:
  - corpus rebuilt from v14's dataset_manifest (8 files, 146,757 rows)
  - validation rows from split_indices.json (17,745)
  - same mulberry32(20260912) PRNG, same stratified quotas, same top-up
  - same decision layer at maxLength=128 (the TS audit does not load dotenv;
    "models/ml-classifier-v14/model.onnx" does not contain "v4", so its
    constructor fell to the 128 default), confidenceFloor=0.5, abstention on.

EXPECTED (artifacts/ml/v14-10k-audit.log):
  attack recall 9464/10000 = 94.64%   benign FP 6/5705   novel 147/500
"""
import json, time, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, "scripts/ml")
from v14_vs_v17_10k_honest import BertTok, decide, load_jsonl, ROOT

SEED = 20260912
D = "models/ml-classifier-v14"

def i32(x):
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x

def imul(x, y):
    r = (x * y) & 0xFFFFFFFF
    return r - 0x100000000 if r >= 0x80000000 else r

def mulberry32(seed):
    state = seed & 0xFFFFFFFF
    def rnd():
        nonlocal state
        a = i32(state)
        a = i32(a + 0x6D2B79F5)
        state = a & 0xFFFFFFFF
        ua = a & 0xFFFFFFFF
        t = imul(a ^ (ua >> 15), 1 | a)
        s = i32(t + imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t))
        t2 = i32(s ^ t)
        return ((t2 ^ ((t2 & 0xFFFFFFFF) >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd

def shuffle(arr, rnd):
    a = list(arr)
    for i in range(len(a) - 1, 0, -1):
        j = int(rnd() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a

def main():
    t0 = time.time()
    manifest = json.loads(open(f"{D}/dataset_manifest.json", encoding="utf-8").read())
    split = json.loads(open(f"{D}/split_indices.json", encoding="utf-8").read())
    corpus = []
    for rel in manifest["datasets"]:
        rows = load_jsonl(str(ROOT / rel))
        print(f"  {len(rows):>7,}  {rel}", flush=True)
        corpus += rows
    assert len(corpus) == manifest["rows_total"], f"corpus mismatch {len(corpus)}"
    validation = [corpus[i] for i in split["indices"]["validation"]]
    val_atk = [r for r in validation if r["label"] != "SAFE"]
    val_ben = [r for r in validation if r["label"] == "SAFE"]
    print(f"validation: {len(validation)} ({len(val_atk)} atk, {len(val_ben)} ben)", flush=True)

    rnd = mulberry32(SEED)
    by_label = {}
    for r in val_atk:
        by_label.setdefault(r["label"], []).append(r)
    labels_sorted = sorted(by_label.keys())
    base = 10_000 // len(labels_sorted)
    rem = 10_000 - base * len(labels_sorted)
    quota = {}
    for l in labels_sorted:
        extra = 1 if rem > 0 else 0
        if extra: rem -= 1
        quota[l] = min(len(by_label[l]), base + extra)
    sampled = []
    for l in labels_sorted:
        sampled += shuffle(by_label[l], rnd)[: quota[l]]
    if len(sampled) < 10_000:
        leftovers = []
        for l in labels_sorted:
            leftovers += shuffle(by_label[l], rnd)[quota[l]:]
        sampled += shuffle(leftovers, rnd)[: 10_000 - len(sampled)]
    print(f"sampled: {len(sampled)} attacks", flush=True)

    novel = []
    for f in ["datasets/external/harmbench.jsonl", "datasets/external/jailbreakbench.jsonl"]:
        p = ROOT / f
        if p.exists():
            for r in load_jsonl(str(p)):
                if r["label"].upper() != "SAFE":
                    novel.append(r)
    print(f"novel: {len(novel)}", flush=True)

    import onnxruntime as ort
    labels = json.loads(open(f"{D}/labels.json", encoding="utf-8").read())
    calib = json.loads(open(f"{D}/calibration.json", encoding="utf-8").read())
    thr = calib["per_label_thresholds"]; ood = calib["ood"]
    safe_idx = next(int(k) for k, v in labels.items() if v == "SAFE")
    tokcfg = json.loads(open(f"{D}/tokenizer_config/tokenizer_config.json", encoding="utf-8").read())
    vocab = {}
    for i, line in enumerate(open(f"{D}/tokenizer_config/vocab.txt", encoding="utf-8").read().split("\n")):
        t = line[:-1] if line.endswith("\r") else line
        if t: vocab[t] = i
    tok = BertTok(vocab, tokcfg.get("do_lower_case", True), tokcfg.get("strip_accents", None), tokcfg.get("tokenize_chinese_chars", True), max_len=128)
    sess = ort.InferenceSession(f"{D}/model.onnx", providers=["CPUExecutionProvider"])

    def score(rows):
        ok = 0
        for i, r in enumerate(rows):
            text = r["text"].strip()
            if len(text) < 3:
                continue
            n_content = len(tok.encode_content(text))
            ids, mask = tok.encode(text)
            logits = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
            pname = decide(logits, labels, thr, ood, safe_idx, floor=0.5, truncated=n_content > 126)
            ok += pname != "SAFE"
            if (i + 1) % 2000 == 0: print(f"    {i+1}/{len(rows)}", flush=True)
        return ok

    print("scoring attacks...", flush=True)
    tp = score(sampled)
    print("scoring benign...", flush=True)
    fp = len(val_ben) - score(val_ben)
    print("scoring novel...", flush=True)
    novel_caught = score(novel)
    print("\n=== REPLICATION vs AUDIT ===", flush=True)
    print(f"attack recall : {tp}/{len(sampled)} = {tp/len(sampled)*100:.2f}%   (audit: 9464/10000 = 94.64%)", flush=True)
    print(f"benign FP     : {fp}/{len(val_ben)} = {fp/len(val_ben)*100:.3f}%  (audit: 6/5705 = 0.105%)", flush=True)
    print(f"novel recall  : {novel_caught}/{len(novel)} = {novel_caught/len(novel)*100:.2f}%  (audit: 147/500 = 29.40%)", flush=True)
    verdict = "EXACT MATCH" if (tp == 9464 and fp == 6 and novel_caught == 147) else ("CLOSE - check deltas" if abs(tp - 9464) <= 60 else "DIVERGENT - port NOT faithful")
    print(f"VERDICT       : {verdict}   ({time.time()-t0:.0f}s)", flush=True)

if __name__ == "__main__":
    main()
