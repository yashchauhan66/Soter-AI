#!/usr/bin/env python3
"""Build the allowlisted, hash-verifiable Colab handoff; never include .env/keys."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[3]


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def notebook():
    def markdown(text):
        return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}
    def code(text):
        return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": text.splitlines(keepends=True)}
    cells = [markdown("# SoterAI v18 compact multilingual student\n\n"
                      "Upload `soterai-v18-colab-bundle.zip` to the root of your Google Drive, then choose **Runtime → Change runtime type → GPU**. "
                      "Run the cells in order. The teacher is your existing v17 multilingual checkpoint. "
                      "This trains a smaller candidate; improvement is not assumed. A new external release evaluation remains required.\n"),
             code("from google.colab import drive\nfrom pathlib import Path\nimport zipfile, subprocess, sys\n"
                  "drive.mount('/content/drive')\n"
                  "BUNDLE = Path('/content/drive/MyDrive/soterai-v18-colab-bundle.zip')\n"
                  "WORK = Path('/content/soterai-v18').resolve()\nWORK.mkdir(parents=True, exist_ok=True)\n"
                  "with zipfile.ZipFile(BUNDLE) as archive:\n"
                  "    for member in archive.infolist():\n"
                  "        if not (WORK / member.filename).resolve().is_relative_to(WORK):\n"
                  "            raise ValueError('Unsafe archive path')\n"
                  "    archive.extractall(WORK)\n"
                  "subprocess.run([sys.executable, str(WORK/'scripts/ml/colab/run_v18_colab.py'), '--preflight'], check=True)\n"),
             code("subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(WORK/'scripts/ml/colab/requirements-v18.txt')], check=True)\n"
                  "import torch\nassert torch.cuda.is_available(), 'Select a GPU runtime first'\n"
                  "print(torch.__version__, torch.cuda.get_device_name(0))\n"),
             markdown("## Train and verify ONNX\n\n"
                      "Checkpoints and candidate outputs persist on Drive. Default effective batch size is 64. "
                      "If GPU memory is insufficient, reduce `BATCH_SIZE` to 8. Do not reduce the sequence length to hide memory problems. "
                      "A 3-layer student may need more data or tuning; this run is an experiment.\n"),
             code("OUTPUT = Path('/content/drive/MyDrive/soterai-v18-student-run')\n"
                  "EPOCHS, BATCH_SIZE = 5, 16\n"
                  "cmd = [sys.executable, str(WORK/'scripts/ml/colab/run_v18_colab.py'), '--output-dir', str(OUTPUT), "
                  "'--epochs', str(EPOCHS), '--batch-size', str(BATCH_SIZE)]\n"
                  "# To resume checkpoint.pt in OUTPUT, append '--resume' to cmd.\n"
                  "subprocess.run(cmd, cwd=WORK, check=True)\n"),
             markdown("## Inspect results and keep the candidate separate\n\n"
                      "Read the data report before interpreting scores. The teacher previously saw the original corpus, so the student internal test is not independent teacher evidence. "
                      "Do not change the production model based on this notebook. Download the resulting directory and compare it on a fresh source/family-held-out release set, "
                      "including per-language benign false alarms, tail attacks and CPU latency. The bundle includes `compare-v18-bases.py`; "
                      "locally add `--candidate-dir models/ml-classifier-v18-student` to the documented paired comparison command.\n"),
             code("import json\n"
                  "for name in ['training_stats.json', 'eval_results.json']:\n"
                  "    p = OUTPUT/name\n"
                  "    if p.exists():\n"
                  "        result = json.loads(p.read_text())\n"
                  "        print(name, json.dumps(result, indent=2)[:16000])\n"
                  "print('Candidate files:', sorted(p.name for p in OUTPUT.iterdir()))\n")]
    return {"cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                           "accelerator": "GPU", "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, default=ROOT / "artifacts/ml/soterai-v18-colab-bundle.zip")
    p.add_argument("--notebook-only", action="store_true")
    args = p.parse_args()
    nb_path = ROOT / "scripts/ml/colab/soterllm-v18-student-colab.ipynb"
    nb = notebook()
    # Compile every code cell locally without importing Colab or running uploads.
    for i, cell in enumerate(nb["cells"]):
        if cell["cell_type"] == "code":
            compile("".join(cell["source"]), f"notebook-cell-{i}", "exec")
    nb_path.write_text(json.dumps(nb, indent=2), encoding="utf-8")
    if args.notebook_only:
        print(nb_path)
        return
    paths = ["scripts/ml/train-soterllm-v14-fullft.py", "scripts/ml/soter_augment.py",
             "scripts/ml/soter_distill.py", "scripts/ml/prepare-v18-data.py", "scripts/ml/compare-v18-bases.py",
             "scripts/ml/colab/run_v18_colab.py", "scripts/ml/colab/requirements-v18.txt",
             "scripts/ml/colab/soterllm-v18-student-colab.ipynb", "datasets/ml-v18-clean-corpus.jsonl",
             "artifacts/ml/v18-split-indices.json", "artifacts/ml/v18-data-report.json",
             "docs/ml-v18-implementation-plan-2026-09-18.md"]
    teacher = "models/ml-classifier-v17/"
    paths += [teacher + n for n in ("pytorch_model.bin", "training_stats.json", "labels.json", "calibration.json",
                                    "tokenizer_config/tokenizer.json", "tokenizer_config/tokenizer_config.json", "tokenizer_config/vocab.txt")]
    entries = {name: ROOT / name for name in paths}
    entries[teacher + "encoder_config.json"] = ROOT / "artifacts/ml/v18-teacher-encoder-config.json"
    optional = ["scripts/ml/v18_data_contract.py", "docs/ml-v18-colab-runbook.md"]
    entries.update({name: ROOT/name for name in optional if (ROOT/name).is_file()})
    missing = [str(path) for path in entries.values() if not path.is_file()]
    if missing:
        raise SystemExit("Cannot build incomplete training bundle:\n" + "\n".join(missing))
    manifest = {"format_version": 1, "purpose": "v18 candidate training; not a promoted artifact",
                "files": {name: digest(path) for name, path in entries.items()}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp.zip")
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
        for name, path in entries.items():
            archive.write(path, name, compress_type=zipfile.ZIP_STORED if path.suffix == ".bin" else zipfile.ZIP_DEFLATED)
        archive.writestr("v18-bundle-manifest.json", json.dumps(manifest, indent=2))
    # Verify archive contents against source hashes without extracting another 0.5GB copy.
    with zipfile.ZipFile(temporary) as archive:
        for name, expected in manifest["files"].items():
            h = hashlib.sha256()
            with archive.open(name) as stream:
                for chunk in iter(lambda: stream.read(1024*1024), b""):
                    h.update(chunk)
            if h.hexdigest() != expected:
                raise ValueError(f"Archive verification failed: {name}")
    temporary.replace(args.output)
    manifest["bundle_sha256"] = digest(args.output)
    manifest["bundle_bytes"] = args.output.stat().st_size
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"bundle": str(args.output), "bytes": manifest["bundle_bytes"],
                      "sha256": manifest["bundle_sha256"], "verified_files": len(entries)}))


if __name__ == "__main__":
    main()
