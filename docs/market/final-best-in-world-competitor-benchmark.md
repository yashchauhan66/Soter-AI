# Final Best-in-World Competitor Benchmark (Honest)

**Branch:** `final-enterprise-ga-ready` · **Date:** 2026-07-11
**Rule (per `docs/marketing-claims-policy.md`):** compare same capability/version/config; separate *breadth* from *efficacy*; cite public docs; use "public documentation did not identify…" rather than asserting absence. **No "best in world" claim is approved by this document** — see verdict.

## Method & limitations (stated up front)

- This is a **feature-and-positioning** comparison from public documentation, **not** a head-to-head detection efficacy study. Running competitor detection APIs on a shared corpus (the only thing that could support an efficacy ranking) was **not** performed — most require paid/enterprise access and licence terms may forbid publishing comparative results.
- SoterAI numbers are this repo's measured results (`npm run benchmark:honest`, 2026-07-11). Competitor numbers are **not** independently reproduced here.
- Therefore any efficacy ranking below is **UNPROVEN** and marked as such.

## Competitor set

Lakera, HiddenLayer, Protect AI, Prompt Security, Lasso Security, AWS Bedrock Guardrails, Azure AI Content Safety, Google Model Armor, NVIDIA NeMo Guardrails, LLM Guard, Promptfoo, Garak, PyRIT.

## Breadth / integration surface (where SoterAI is genuinely differentiated)

| Capability | SoterAI | Typical incumbent posture (public docs) |
|---|---|---|
| REST API guard | ✅ analyze/input/output | ✅ most |
| JS + Python SDK | ✅ both (JS 18/18 tests) | ✅ most |
| Browser extension (MV3, ChatGPT/Claude/Gemini) | ✅ built + validated | 🟡 few (Lasso/Prompt Security have browser angles) |
| VS Code / IDE extension | ✅ VSIX built | 🔴 rare |
| n8n community node | ✅ builds/loads | 🔴 rare |
| WordPress plugin | ✅ zip builds | 🔴 rare |
| India-first PII (Aadhaar/PAN) + Hinglish detection | ✅ | 🔴 rare |
| Agent firewall (passports/tool-chain/egress) | ✅ present | 🟡 emerging (HiddenLayer/Protect AI on model side) |
| Deterministic + explainable rules | ✅ | 🟡 varies |

**Honest read:** SoterAI's genuine, defensible lead is **breadth of integration surface** (API + browser + IDE + n8n + WordPress) and **India-first coverage** — not proven detection superiority.

## Efficacy (UNPROVEN — do not claim a ranking)

| Metric | SoterAI (measured, internal) | Competitors |
|---|---|---|
| Known-pattern recall | 100% @ 0.81% FPR (1,218-case internal corpus) | Not reproduced here |
| **Novel-phrasing recall** | **~50–73% (honest, held-out)** | Not reproduced here |
| False-positive rate | 0.81% internal | Not reproduced here |
| Independent validation | **None yet (EVR-02)** | Some (e.g. Lakera publishes research; Garak/PyRIT are open red-team tools) |

**Where SoterAI likely trails:** independent/external validation and trained-model novel-detection. Tools like **Garak** and **PyRIT** are mature open red-team frameworks; **Lakera/HiddenLayer** have published research and enterprise deployments. SoterAI has **no external benchmark or pentest yet**.

## Verdict on "best in world"

🔴 **NOT ALLOWED.** Evidence supports only scoped, honest claims:

- ✅ *"Developer-first AI security guard spanning API, browser, VS Code, and n8n"* — breadth is real.
- ✅ *"India-first AI security (Aadhaar/PAN/Hinglish)"* — differentiated.
- ✅ *"100% recall on our published benchmark corpus at 0.81% FPR"* — with the corpus/limitations adjacent.
- 🔴 *"Best in world" / "highest detection" / "lowest false positive vs [vendor]"* — require an independent, like-for-like study that does not exist. Do not publish.

## To earn a defensible ranking (future work)

1. Build the trained ML tier (EVR-01) to lift novel recall.
2. Run SoterAI + at least 2 competitors (where licence permits) on a shared, disclosed corpus.
3. Commission an independent assessor (ties to EVR-02).
4. Give each named vendor a correction path before publishing a matrix (policy requirement).
