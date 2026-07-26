#!/usr/bin/env python3
"""Validate a future SoterAI model artifact manifest without loading a model.

This is intentionally a metadata/integrity gate. It does not promote an
artifact, alter runtime configuration, or execute untrusted model code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a SoterAI artifact manifest and referenced file hashes.")
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    manifest: dict[str, Any] = json.loads(args.manifest.read_text(encoding="utf-8"))
    required = {"schema_version", "artifact_id", "taxonomy_version", "labels", "files"}
    missing = sorted(required - set(manifest))
    if missing:
        raise SystemExit(f"Manifest missing required fields: {', '.join(missing)}")
    if manifest["taxonomy_version"] != "SOTERAI-ML-TAXONOMY-v1":
        raise SystemExit("Refusing artifact: unsupported taxonomy version")
    if manifest["schema_version"] != "soterai-artifact-manifest/v1":
        raise SystemExit("Refusing artifact: unsupported manifest schema")
    if manifest.get("serialization") not in {"safetensors", "onnx"}:
        raise SystemExit("Refusing artifact: production serialization must be SafeTensors or ONNX")
    if not isinstance(manifest["labels"], list) or not manifest["labels"]:
        raise SystemExit("Refusing artifact: labels must be a non-empty list")
    base = args.manifest.parent
    checked: list[dict[str, Any]] = []
    for entry in manifest["files"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str) or not isinstance(entry.get("sha256"), str):
            raise SystemExit("Refusing artifact: every file entry needs path and sha256")
        path = base / entry["path"]
        if path.resolve() != base.resolve() and base.resolve() not in path.resolve().parents:
            raise SystemExit(f"Refusing artifact: file escapes artifact directory: {entry['path']}")
        if not path.is_file():
            raise SystemExit(f"Refusing artifact: referenced file does not exist: {path}")
        actual = sha256(path)
        if actual != entry["sha256"]:
            raise SystemExit(f"Refusing artifact: checksum mismatch for {path}; expected {entry['sha256']}, got {actual}")
        checked.append({"path": entry["path"], "sha256": actual, "bytes": path.stat().st_size})
    print(json.dumps({"status": "PASS", "artifact_id": manifest["artifact_id"], "taxonomy_version": manifest["taxonomy_version"], "serialization": manifest["serialization"], "files": checked}, indent=2))


if __name__ == "__main__":
    main()