# SoterAI ML artifact manifest contract

Future promoted neural artifacts must ship a manifest next to the model files and pass:

```bash
python scripts/ml/validate_artifact_manifest.py /secure/model/artifact-manifest.json
```

Required fields:

```json
{
  "schema_version": "soterai-artifact-manifest/v1",
  "artifact_id": "soterai-ml-v1-<experiment-id>",
  "taxonomy_version": "SOTERAI-ML-TAXONOMY-v1",
  "serialization": "safetensors",
  "labels": ["..."],
  "files": [
    {"path": "model.safetensors", "sha256": "<sha256>"},
    {"path": "tokenizer.json", "sha256": "<sha256>"}
  ]
}
```

The validator is an integrity gate only. It does not load or promote the model. Production promotion additionally requires safe serialization, preprocessing/threshold parity, bounded input/timeout behavior, shadow/canary evidence, monitoring, and rollback evidence.