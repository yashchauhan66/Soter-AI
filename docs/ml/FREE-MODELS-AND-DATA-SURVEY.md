# Free models & data for training — what actually exists (2026-08-06)

Answers two questions: is Lakera's model free, and is anything free BETTER than Lakera.

## 1. Lakera's model: NOT available. Their data: partly available.

`huggingface.co/lakera` has **5 models — all cancer image classification from Apr 2023**.
Lakera Guard is closed, API-only. There is nothing to download or fine-tune.

Their datasets are the valuable part, and the licences differ sharply:

| Dataset | Rows | Licence | Usable commercially? |
|---|---|---|---|
| `Lakera/mosscap_prompt_injection` | **278,945** | **MIT** | ✅ **YES** |
| `Lakera/gandalf_ignore_instructions` | 1,000 | MIT | ✅ yes — *already used* |
| `Lakera/gandalf-rct` | 339,000 | **custom** | ❌ **NO** — see below |
| `Lakera/gandalf_summarization` | — | (check) | unverified |

### gandalf-rct is off-limits — read this before anyone touches it
Its LICENSE file says the data is "provided solely for academic, non-commercial
research purposes" and that use for "commercial… purposes is strictly prohibited",
plus a redistribution bar. SoterAI is a commercial product. **Do not train on it.**
Verified by reading the raw LICENSE file, not the HF licence tag (which just says
"other").

### mosscap IS the prize — 279k rows, MIT, and we are not using it
Mosscap was the DEF CON 31 Gandalf spin-off. Same game, harder passwords.
Columns: `level` (1-8, escalating defence), `prompt`, `answer`, `raw_answer`.

Two properties nothing else in our corpus has:
- **Real humans attacking a real defended target**, not templates. This is the
  exact distribution `docs/ml/LAKERA-PARITY-PROGRAM.md` calls their moat.
- **`raw_answer` reveals which attacks SUCCEEDED** (the player saw a refusal; the
  raw field kept the leak). That is a free success label — attacks that beat a
  real defence, which is a far stronger training signal than "someone typed this".

Caveat Lakera states plainly: they published everything received "regardless of
whether it truly is a prompt injection or not", so a large share is ordinary
chatter. It needs labelling by outcome, not by assumption. Treat an unlabelled
mosscap row as UNKNOWN, never as an attack — that mistake is exactly what poisoned
the v1 datasets (`inthewild-regular`).

Current corpus uses only `gandalf_ignore_instructions` = **1,000 rows**.
Mosscap is **279x** more real-human attack data, same publisher, MIT.

## 2. Is anything free BETTER than Lakera? Yes — Meta Prompt Guard 2.

`meta-llama/Llama-Prompt-Guard-2-86M` (86M params, 512-token window, gated by
Llama 4 Community Licence — free under 700M MAU, must display "Built with Llama"
and prefix derived model names with "Llama").

Meta's reported numbers on their private held-out benchmark:

| Model | AUC (Eng) | **Recall @ 1% FPR** | Latency A100/512tok |
|---|---|---|---|
| Prompt Guard **2 86M** | .998 | **97.5%** | 92.4 ms |
| Prompt Guard 2 22M | .995 | 88.7% | 19.3 ms |
| Prompt Guard 1 | .987 | 21.2% | 92.4 ms |

AgentDojo attack-prevention @3% utility loss: **PG2-86M 81.2%**, ProtectAI 22.2%,
Deepset 13.5%.

**SoterAI today: 73.2% recall @ 4.2% FPR** (cross-distribution, our own set).
Not the same benchmark, so not directly comparable — but a 24-point recall gap at
a 4x better FPR is far too large to be measurement noise.

### Why PG2 is the shortcut
Our model is MiniLM-L6-v2 trained on ~3,400 templates. PG2-86M is trained on
real attack traffic with a custom energy-based loss built specifically to hold up
out-of-distribution — which is precisely the axis we fail on (73% cross-dist vs
99% in-dist). Fine-tuning PG2 on our data is a far shorter path to parity than
continuing to train MiniLM on templates.

Meta's stated limits, worth respecting: 512-token cap, judges only "does this try
to override prior instructions" (NOT content harm — so it does not replace our
UNSAFE_OUTPUT work), and adaptive adversaries can still evade it.

### Also checked
- `protectai/deberta-v3-base-prompt-injection-v2` — Apache-2.0, 291k downloads,
  but **archived/unmaintained**, English-only, no jailbreak detection, and its own
  card warns it false-positives on system prompts. AgentDojo 22.2%. Skip it.

## Recommended order
1. **Add mosscap to `fetch-external-corpora.py`** (MIT, 279k rows, label by
   `raw_answer` outcome). Biggest honest data win available, zero licence risk.
2. **Benchmark PG2-86M on `crossdist-eval-v2.jsonl`** before adopting it — Meta's
   97.5% is on THEIR private set. Measure it on ours.
3. Only then decide: fine-tune PG2 vs keep training MiniLM.
4. **Never** train on `gandalf-rct`.
