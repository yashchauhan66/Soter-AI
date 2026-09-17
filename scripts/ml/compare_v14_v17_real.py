import os
import json
import time
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

MODELS = {
    "v14": "models/ml-classifier-v14",
    "v17-minilm": "models/ml-classifier-v17-minilm",
    "v17-mdistilbert": "models/ml-classifier-v17",
}

def load_model(dir_path):
    print(f"Loading {dir_path}...")
    tok_path = os.path.join(dir_path, "tokenizer_config", "tokenizer.json")
    tokenizer = Tokenizer.from_file(tok_path)
    
    with open(os.path.join(dir_path, "labels.json"), "r", encoding="utf-8") as f:
        raw_labels = json.load(f)
    if isinstance(raw_labels, dict):
        if any(k.isdigit() for k in raw_labels.keys()):
            id2label = {int(k): v for k, v in raw_labels.items()}
        else:
            id2label = {int(v): k for k, v in raw_labels.items()}
    else:
        id2label = {i: l for i, l in enumerate(raw_labels)}
        
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    sess = ort.InferenceSession(os.path.join(dir_path, "model.onnx"), opts)
    input_names = [inp.name for inp in sess.get_inputs()]
    return tokenizer, sess, id2label, input_names

def predict(text, tokenizer, sess, id2label, input_names):
    enc = tokenizer.encode(text)
    ids = enc.ids[:256]
    mask = enc.attention_mask[:256]
    
    # Pad to fixed 256 or variable? Let's check dimensions of model inputs
    input_ids = np.array([ids], dtype=np.int64)
    attention_mask = np.array([mask], dtype=np.int64)
    
    feed = {"input_ids": input_ids, "attention_mask": attention_mask}
    if "token_type_ids" in input_names:
        feed["token_type_ids"] = np.zeros_like(input_ids)
    feed = {k: v for k, v in feed.items() if k in input_names}
    
    t0 = time.perf_counter()
    logits = sess.run(None, feed)[0][0]
    lat_ms = (time.perf_counter() - t0) * 1000.0
    
    exp = np.exp(logits - np.max(logits))
    probs = exp / np.sum(exp)
    top_idx = int(np.argmax(probs))
    pred_label = id2label[top_idx]
    
    # safe prob
    safe_idx = None
    for idx, name in id2label.items():
        if name == "SAFE":
            safe_idx = idx
            break
    safe_p = probs[safe_idx] if safe_idx is not None else 0.0
    attack_p = 1.0 - safe_p
    
    return pred_label, float(probs[top_idx]), float(attack_p), lat_ms

print("Test harness loaded successfully.")
