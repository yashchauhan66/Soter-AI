import os, sys, json, time
from collections import defaultdict
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

MODELS = {
    "v14": "models/ml-classifier-v14",
    "v17-minilm": "models/ml-classifier-v17-minilm",
    "v17-mdistilbert": "models/ml-classifier-v17",
}

def load_model(dir_path):
    tokenizer = Tokenizer.from_file(os.path.join(dir_path, "tokenizer_config", "tokenizer.json"))
    with open(os.path.join(dir_path, "labels.json"), "r", encoding="utf-8") as f:
        raw_labels = json.load(f)
    if isinstance(raw_labels, dict):
        id2label = {int(k): v for k, v in raw_labels.items()} if any(k.isdigit() for k in raw_labels.keys()) else {int(v): k for k, v in raw_labels.items()}
    else:
        id2label = {i: l for i, l in enumerate(raw_labels)}
        
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 6
    sess = ort.InferenceSession(os.path.join(dir_path, "model.onnx"), opts)
    input_names = [inp.name for inp in sess.get_inputs()]
    return tokenizer, sess, id2label, input_names

def predict_batch(texts, tokenizer, sess, id2label, input_names, batch_size=64):
    results = []
    for i in range(0, len(texts), batch_size):
        chunk = texts[i:i+batch_size]
        encs = [tokenizer.encode(t) for t in chunk]
        max_len = min(256, max(len(e.ids) for e in encs))
        
        b_ids = [e.ids[:max_len] + [0]*(max_len - len(e.ids[:max_len])) for e in encs]
        b_mask = [e.attention_mask[:max_len] + [0]*(max_len - len(e.attention_mask[:max_len])) for e in encs]
            
        feed = {
            "input_ids": np.array(b_ids, dtype=np.int64),
            "attention_mask": np.array(b_mask, dtype=np.int64)
        }
        if "token_type_ids" in input_names:
            feed["token_type_ids"] = np.zeros_like(feed["input_ids"])
            
        t0 = time.perf_counter()
        logits_batch = sess.run(None, feed)[0]
        lat_per = (time.perf_counter() - t0) * 1000.0 / len(chunk)
        
        for logits in logits_batch:
            exp = np.exp(logits - np.max(logits))
            probs = exp / np.sum(exp)
            top_idx = int(np.argmax(probs))
            pred_label = id2label[top_idx]
            safe_idx = next((k for k, l in id2label.items() if l == "SAFE"), None)
            safe_p = probs[safe_idx] if safe_idx is not None else 0.0
            results.append((pred_label, float(probs[top_idx]), float(1.0 - safe_p), lat_per))
    return results

def eval_single_model(model_key, file_path, limit=None):
    rows = [json.loads(line) for line in open(file_path, "r", encoding="utf-8") if line.strip()]
    if limit:
        rows = rows[:limit]
    mdir = MODELS[model_key]
    tok, sess, id2label, input_names = load_model(mdir)
    
    texts = [r["text"] for r in rows]
    batch_preds = predict_batch(texts, tok, sess, id2label, input_names, batch_size=64)
    
    tp = fp = tn = fn = exact = 0
    lats = []
    lang_stats = defaultdict(lambda: {"tp": 0, "fn": 0, "fp": 0, "tn": 0})
    cat_stats = defaultdict(lambda: {"tp": 0, "fn": 0, "fp": 0, "tn": 0})
    misses = []
    fps = []
    
    for r, (pred, conf, atk_p, lat) in zip(rows, batch_preds):
        gold = r["label"]
        lang = r.get("language", "en")
        lats.append(lat)
        if pred == gold:
            exact += 1
        
        gold_atk = (gold != "SAFE" and gold != "BENIGN")
        pred_atk = (pred != "SAFE")
        
        if gold_atk and pred_atk:
            tp += 1
            lang_stats[lang]["tp"] += 1
            cat_stats[gold]["tp"] += 1
        elif not gold_atk and not pred_atk:
            tn += 1
            lang_stats[lang]["tn"] += 1
            cat_stats[gold]["tn"] += 1
        elif not gold_atk and pred_atk:
            fp += 1
            lang_stats[lang]["fp"] += 1
            cat_stats[gold]["fp"] += 1
            fps.append((r["text"][:80], gold, pred, conf, lang))
        elif gold_atk and not pred_atk:
            fn += 1
            lang_stats[lang]["fn"] += 1
            cat_stats[gold]["fn"] += 1
            misses.append((r["text"][:80], gold, pred, conf, lang))
            
    rec = (tp / (tp + fn) * 100) if (tp + fn) else 0
    fpr = (fp / (fp + tn) * 100) if (fp + tn) else 0
    prec = (tp / (tp + fp) * 100) if (tp + fp) else 0
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0
    print(f"[{model_key.upper()}] Recall: {rec:5.1f}% ({tp}/{tp+fn}) | FPR: {fpr:5.1f}% ({fp}/{fp+tn}) | Exact: {exact/len(rows)*100:5.1f}% | Lat: {np.mean(lats):.1f}ms")
    
    for c, s in sorted(cat_stats.items()):
        if c in ("SAFE", "BENIGN"):
            tot = s["fp"] + s["tn"]
            rate = s["fp"] / tot * 100 if tot else 0
            print(f"   {c:26} False Positives: {s['fp']:3}/{tot} ({rate:5.1f}%)")
        else:
            tot = s["tp"] + s["fn"]
            rate = s["tp"] / tot * 100 if tot else 0
            print(f"   {c:26} Caught: {s['tp']:3}/{tot} ({rate:5.1f}%)")
            
    if len(lang_stats) > 1:
        worst = []
        for l, s in lang_stats.items():
            tot_atk = s["tp"] + s["fn"]
            r_rate = s["tp"] / tot_atk * 100 if tot_atk else 100
            worst.append((l, r_rate, s["tp"], tot_atk, s["fp"]))
        worst.sort(key=lambda x: x[1])
        print("   Weakest languages (Recall):", ", ".join([f"{w[0]}:{w[1]:.0f}%" for w in worst[:8]]))
        
    return {"misses": misses, "fps": fps}

if __name__ == "__main__":
    m = sys.argv[1]
    f = sys.argv[2]
    eval_single_model(m, f)
