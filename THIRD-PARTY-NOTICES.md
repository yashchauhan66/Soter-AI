# Third-Party Notices

This file records attribution for third-party material used in SoterAI. It is
referenced by `scripts/ml/fetch-external-corpora.py`, whose licence header states
that attribution obligations are met here.

SoterAI's own licensing is described in `LICENSE`, `NOTICE`, and `LICENSING.md`.
Nothing in this file grants rights to SoterAI code or trademarks.

---

## 1. Training corpora (machine-learning datasets)

### How these are used

These datasets are consumed **to fit model weights**. SoterAI does **not**
republish, redistribute, or ship the rows themselves — no dataset row appears in
any released artifact. What ships is a trained model (`model.onnx`) whose weights
are a statistical function of the training set.

Licences are verified by reading each dataset's card and LICENSE file, **not** by
trusting the Hugging Face licence tag. The tag is unreliable: `Lakera/gandalf-rct`
is tagged `other` while its LICENSE bars commercial use outright.

### Attribution — datasets in the default fetch set

| Dataset | Licence | Attribution |
|---|---|---|
| [Lakera/mosscap_prompt_injection](https://huggingface.co/datasets/Lakera/mosscap_prompt_injection) | MIT | © Lakera AI |
| [Lakera/gandalf_ignore_instructions](https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions) | MIT | © Lakera AI |
| [reshabhs/SPML_Chatbot_Prompt_Injection](https://huggingface.co/datasets/reshabhs/SPML_Chatbot_Prompt_Injection) | MIT | © Reshabh K Sharma et al. |
| [TrustAIRLab/in-the-wild-jailbreak-prompts](https://huggingface.co/datasets/TrustAIRLab/in-the-wild-jailbreak-prompts) | MIT | © TrustAIRLab (Shen et al., "Do Anything Now") |
| [Open-Orca/OpenOrca](https://huggingface.co/datasets/Open-Orca/OpenOrca) | MIT | © OpenOrca contributors |
| [deepset/prompt-injections](https://huggingface.co/datasets/deepset/prompt-injections) | Apache-2.0 | © deepset GmbH |
| [yanismiraoui/prompt_injections](https://huggingface.co/datasets/yanismiraoui/prompt_injections) | Apache-2.0 | © Yanis Miraoui |
| [jackhhao/jailbreak-classification](https://huggingface.co/datasets/jackhhao/jailbreak-classification) | Apache-2.0 | © Jack Hao |
| [databricks/databricks-dolly-15k](https://huggingface.co/datasets/databricks/databricks-dolly-15k) | **CC-BY-SA-3.0** | © Databricks, Inc. |
| [quickium/prompt-security-v0](https://huggingface.co/datasets/quickium/prompt-security-v0) | mixed — see §1.1 | © quickium and upstream contributors |
| [neuralchemy/Prompt-injection-dataset](https://huggingface.co/datasets/neuralchemy/Prompt-injection-dataset) | Apache-2.0 wrapper — see §1.1 | © neuralchemy |

**CC-BY-SA-3.0 note (dolly).** ShareAlike attaches to *adaptations of the
dataset*. Trained model weights are not distributed as a dataset adaptation and
no dolly row is redistributed. Attribution is given above. If dolly rows are ever
republished in derivative dataset form, that artifact must itself be CC-BY-SA-3.0.

### 1.1 Datasets used only with an in-adapter licence filter

The top-level tag on these does not describe every row, so the adapter filters
before any row reaches training. Removing these filters is a licence violation,
not a tuning decision.

- **`quickium/prompt-security-v0`** — Hub tag `other`.
  - `train` split (71,117 rows) is commercially usable **except** rows with
    `source == "octavio_pi_multilingual"` (~7,205), which are **GPL-3.0** and
    whose copyleft would travel into derived work.
  - `train_nc` split (293,907 rows, © AI2) is **CC BY-NC** and bars commercial
    model training.
  - Adapter (`load_quickium`) pins `split="train"` and drops the GPL source.
    Contribution layer is CC-BY-4.0; embedded CoCoNot rows are ODC-BY.
- **`neuralchemy/Prompt-injection-dataset`** — Apache-2.0 wrapper over mixed
  upstreams. The WildGuard / JudgeComparison subset is **"Research" only**.
  Adapter (`load_neuralchemy`) allow-lists `source ∈ {original, harmbench}` and
  drops `augmented` rows.

### 1.2 Excluded — licence forbids commercial use

Recorded so the exclusion is deliberate and auditable, not accidental.

| Dataset | Why excluded |
|---|---|
| `Lakera/gandalf-rct` | LICENSE: "academic, non-commercial research purposes" only; also bars redistribution |
| `tatsu-lab/alpaca` | CC-BY-NC-4.0 (NonCommercial) |
| `allenai/wildjailbreak` | CC BY-NC; card bars commercial model training |
| `dmilush/shieldlm-prompt-injection` | Tagged MIT, but ~1,002 TrustAIRLab rows are CC-BY-NC-SA-4.0 |
| `xTRam1/safe-guard-prompt-injection` | No licence declared — no permission granted |
| `jayavibhav/prompt-injection` | No licence declared — no permission granted |
| `JasperLS/prompt-injections` | No licence declared — no permission granted |

### 1.3 Excluded on provenance, not licence

- **`blackXmask/RedLockX-Prompt-Injection-109K-DataSet`** — Apache-2.0, so legally
  usable, but every row carries `source: synthetic_v1`. The external-corpus effort
  exists to counterbalance synthetic data; adding 109k synthetic rows would repeat
  the v6 regression at scale. Importable, deliberately not in `DEFAULT_SOURCES`.

---

## 2. Base model

**[`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)**
— Apache-2.0, © Nils Reimers / UKP Lab and the sentence-transformers authors.
Used as the frozen-then-fine-tuned encoder in SoterLLM v4. Apache-2.0 permits
commercial use and derivative works with attribution and NOTICE preservation.

### 2.1 Evaluated but not incorporated

**[`meta-llama/Llama-Prompt-Guard-2-86M`](https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M)**
— Llama 4 Community License. Used **only as an external benchmark baseline** in
`scripts/ml/benchmark-vs-lakera.py`. No weights are incorporated into or
distributed with SoterAI.

If this model is ever fine-tuned or shipped, the Llama 4 Community License
requires: free use only below 700M MAU, prominent display of **"Built with
Llama"**, and derived model names prefixed with **"Llama"**. None of these
obligations are currently triggered, because it is only measured, never shipped.

---

## 3. Software dependencies

Runtime and build dependencies are declared in `package.json`,
`packages/*/package.json`, and the Python requirements used by `scripts/ml/`.
Their licences are as published by their respective authors; this file does not
restate them.
