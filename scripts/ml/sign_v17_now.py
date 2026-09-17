#!/usr/bin/env python3
"""Sign v17 model artifacts with the existing operator key (no tsx needed)."""
import hashlib, json, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]

def canonicalize(v):
    if isinstance(v, list):
        return "[" + ",".join(canonicalize(x) for x in v) + "]"
    if isinstance(v, dict):
        parts = ",".join(json.dumps(k) + ":" + canonicalize(v[k]) for k in sorted(v.keys()))
        return "{" + parts + "}"
    return json.dumps(v)

def sign_one(model_path, builder):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    key_pem = (ROOT / ".soterai" / "model-signing" / "operator-signing-key.pem").read_bytes()
    b64 = "".join(l for l in key_pem.decode().splitlines() if "-----" not in l)
    import base64
    raw = base64.b64decode(b64)
    seed = raw[-32:]
    priv = Ed25519PrivateKey.from_private_bytes(seed)
    meta = json.loads((ROOT / ".soterai" / "model-signing" / "operator-signing-key.pem.json").read_text())
    data = Path(model_path).read_bytes()
    unsigned = {
        "version": 1,
        "artifact": {"filename": "model.onnx", "sha256": hashlib.sha256(data).hexdigest(), "sizeBytes": len(data)},
        "provenance": {"source": "local-training", "builderId": builder, "createdAt": datetime.now(timezone.utc).isoformat()},
        "signer": {"keyId": meta["keyId"]},
    }
    sig = priv.sign(canonicalize(unsigned).encode())
    import base64 as b64m
    manifest = dict(unsigned, signature=b64m.b64encode(sig).decode())
    out = str(model_path) + ".manifest.json"
    Path(out).write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"signed {model_path} -> {out} sha={manifest['artifact']['sha256'][:16]}... key={meta['keyId']}")

sign_one("models/ml-classifier-v17/model.onnx", "soterai://local/v17-candidate")
sign_one("models/ml-classifier-v17-minilm/model.onnx", "soterai://local/v17-control")
