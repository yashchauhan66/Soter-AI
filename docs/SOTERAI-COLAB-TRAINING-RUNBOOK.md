# SoterAI Colab Training Runbook

Use this path for full ML retraining. Do not run full training on a local CPU.

## Files To Use

- Upload bundle: `soterai-train-bundle.zip`
- Open notebook: `notebooks/SOTERAI_ML_TRAINING_COLAB.ipynb`
- Output location in Colab: `/content/drive/MyDrive/soterai-ml-runs`

## Colab Steps

1. Open Google Colab.
2. Set runtime to GPU or TPU.
3. Upload and open `notebooks/SOTERAI_ML_TRAINING_COLAB.ipynb`.
4. Run cells from top to bottom.
5. When prompted, upload `soterai-train-bundle.zip`.
6. Wait for training to finish.
7. Download or keep the latest run folder from `/content/drive/MyDrive/soterai-ml-runs`.

## Strong Preset

The notebook uses:

- Base model: `microsoft/deberta-v3-base`
- Epochs: `4`
- Batch size: `8`
- Gradient accumulation: `8`
- Effective batch size: `64`
- Max length: `256`
- Class weighting: enabled

This is the default strong T4-friendly training setup.

If that attempt fails, the notebook automatically retries:

- `microsoft/deberta-v3-base`, batch `4`, accumulation `16`, max length `192`
- `sentence-transformers/all-MiniLM-L6-v2`, batch `32`, accumulation `2`, max length `192`

## Important

Do not install pinned `torch`, `torchvision`, or `numpy` in Colab. Colab provides a CUDA-matched Torch build. The notebook installs only the extra ML packages listed in `requirements-colab.txt`.

If Colab shows `Bundle does not contain SoterAI training files`, upload the latest regenerated `soterai-train-bundle.zip`. Older Windows-created bundles stored paths with backslashes; the current bundle uses Linux-safe forward-slash paths and the notebook also includes a repair fallback.

## Expected Artifacts

Each run writes:

- `experiment_summary.json`
- `config.json`
- `split_manifest.json`
- `labels.json`
- `label_to_idx.json`
- `model_config.json`
- `pytorch_model.bin`
- `tokenizer/`
- `checkpoints/best.pt`

Send back the latest `experiment_summary.json` and artifact folder when training completes.

If training fails, send the newest log from:

`/content/drive/MyDrive/soterai-ml-runs/_training-logs`
