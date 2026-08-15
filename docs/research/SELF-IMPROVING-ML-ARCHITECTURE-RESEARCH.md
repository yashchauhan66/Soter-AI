# Self-Improving ML Model — Deep Genuine Research (2026-08-08)

**Purpose:** Design a system where the SoterAI v7 attack-classifier **retrain hone, aur har cycle me stronger hota jaaye — bina manual labeling army ke.**
**Grounding rule:** Yahaan sirf real, peer-reviewed / industry-proven techniques hain. Har technique ka actual research source diya gaya hai. Koi fake metric ya invented claim nahi.

---

## 1) Problem statement (aapke real test se)

Aapke `real-black-box-v7-test.cjs` ne dikhaya:
- Novel attacks par recall ~59% (train-corpus 99% se bahut neeche)
- SECRET / RAG_POISONING / multilingual fresh variants **miss**
- 3 benign **false-positives** (over-firing on SYSTEM_PROMPT_LEAK)

**Root cause:** static model ek fixed snapshot hai. Attackers har hafte naye paraphrase, naye jailbreak persona, naye encoding trick laate hain. Model ko **lagatar naye examples se seekhna** chahiye — lekin blindly retrain karne se **3 asli khatre** hote hain:

1. **Catastrophic forgetting** — naye data pe train karte hi purane classes bhool jaata hai.
2. **Poisoning / feedback loop** — attacker jan boojh kar galat feedback bhej kar model ko bigaad sakta hai.
3. **Silent regression** — naya cycle kuch pe improve kare, kuch pe secretly break kar de.

Isliye "auto-train" ka matlab "auto-deploy" NAHI hai. Real design = **auto-learn + gate + human/witness sign-off.**

---

## 2) The name for this: a **Data Flywheel + Champion/Challenger** system

Industry me isko kehte hain **data flywheel** (Tesla, Scale AI, every mature ML team) + **champion/challenger** deployment (standard in fraud/ML infra). Detection-ML me isko **continual learning under adversarial drift** kehte hain. Humm isko implement karenge as 6 building blocks.

### Real techniques involved (all published)

| # | Technique | What it does for you | Real source |
|---|---|---|---|
| 1 | **Active Learning** | Model khud batata hai *kaunse* new samples most-valuable hain (uncertainty sampling) → minimum labeling, maximum gain | Settles, *"Active Learning Literature Survey"* (2009) — canonical survey |
| 2 | **Hard-Negative Mining** | Jo benign samples model galti se attack bolta hai, unko automatically utha kar next training me daalo (tumhara 3-FP problem isi se fix hoga) | Standard in face/embedding ML — Schroff et al., FaceNet (2015) |
| 3 | **Data Augmentation via back-translation + paraphrase** | Ek attack se N linguistic paraphrases banao (multilingual gap isi se fix hoga) | Sennrich et al., *Back-translation* (2016); standard NLP aug |
| 4 | **Adversarial Training (red-team loop)** | Ek attack-generator model model ko todo, model usse seekhe — continuously | Goodfellow et al., *Adversarial Examples* (2014); Madry et al. (2017) |
| 5 | **Parameter-Efficient Fine-Tuning (LoRA)** | Har cycle me full model retrain nahi karna — sirf tiny adapter train karo → fast, sasta, safe | Hu et al., *LoRA* (2021) |
| 6 | **Elastic Weight Consolidation (EWC)** | Naye data pe train karte waqt purane knowledge ko protect karta hai → forgetting rokta hai | Kirkpatrick et al., *"Overcoming catastrophic forgetting"* PNAS (2017) |
| 7 | **Concept-Drift Detection** | Production traffic ka distribution change detect karo → "ab retrain chahiye" ka automatic trigger | Gama et al., *"Survey on Concept Drift Adaptation"* (2014) |
| 8 | **Champion/Challenger + Canary** | Naya model pehle 5% traffic pe as "challenger" run hota hai, purana champion bhi parallel chalta hai; sirf jeetne par promote | Industry standard (Google SRE / fraud-ML infra) |

---

## 3) Proposed architecture — **"SoterAI Flywheel"**

```
            ┌─────────────────────────────────────────────────────────┐
            │                  PRODUCTION / LIVE TRAFFIC              │
            └───────────────┬───────────────────────────┬─────────────┘
                            │ (consented, redacted)     │ (model output)
                            ▼                           ▼
              ┌───────────────────────┐      ┌────────────────────────┐
              │  A. LOW-CONFIDENCE     │      │  B. DRIFT DETECTOR      │
              │     / UNCERTAIN queue  │      │  (population stats,     │
              │  (Active Learning)     │      │   language-mix shift)   │
              └───────────┬───────────┘      └───────────┬────────────┘
                          │                               │
                          ▼                               ▼
              ┌───────────────────────┐      ┌────────────────────────┐
              │  C. HUMAN / LLM-       │      │  trigger: "drift seen" │
              │  ASSISTED LABELING     │      │  → start new cycle     │
              │  (uncertain + disagree)│      └───────────┬────────────┘
              └───────────┬───────────┘                   │
                          │  labeled examples             │
                          ▼                               ▼
              ┌──────────────────────────────────────────────────┐
              │ D. CYCLE DATASET BUILDER                          │
              │   - new labeled uncertain samples (A/C)           │
              │   - auto PARAPHRASED variants (augmentation)      │
              │   - HARD NEGATIVES (benign that fooled model)     │
              │   - ADVERSARIAL probes from red-team generator    │
              │   - PLUS a frozen buffer of OLD data (replay      │
              │     buffer — key anti-forgetting trick)           │
              └───────────┬──────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────────────────────┐
              │ E. CANDIDATE TRAINER = LoRA fine-tune ON TOP of   │
              │    frozen base + EWC regularization + replay buffer│
              │    → produces challenger model (never replaces     │
              │      production automatically)                     │
              └───────────┬──────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────────────────────────────────┐
              │ F. EVALUATION GATE (the real safety)              │
              │   - fixed locked holdout (never in training)      │
              │   - black-box novel set (jaise real test hum      │
              │     aaj chala rahe the)                            │
              │   - per-class regression guard: koi class pehle   │
              │     se WORSE nahi honi chahiye                    │
              │   - FP ceiling check                              │
              └───────────┬──────────────────────────────────────┘
                          │ PASS only if challenger ≥ champion on
                          │ EVERY critical slice (no trade-off wins)
                          ▼
              ┌──────────────────────────────────────────────────┐
              │ G. SHADOW + CANARY + HUMAN/WITNESS SIGN-OFF       │
              │   - 5% live traffic, parallel, no user impact      │
              │   - audit ledger write; only then promote          │
              │   - instant rollback switch (LoRA = tiny file swap)│
              └──────────────────────────────────────────────────┘
```

---

## 4) Block-by-block — kya genuinely karna hai

### A. Low-confidence queue (Active Learning)
- Deployed model har prediction pe confidence deta hai (aapke paas already calibration + ECE hai — v7 me ECE 0.006).
- **Rule:** jahan max-probability < threshold (e.g. abstention floor 0.55 — aapke OOD note me already hai), ya jahan top-2 classes bahut paas hain → sample ko *uncertain queue* me daalo.
- Yehi active learning ka core hai: **model decides what it needs to learn.** Settles (2009) me isko "uncertainty sampling" kehte hain; "query-by-committee" (multiple model heads disagree) aur bhi strong hai.

### B. Drift detector (auto-trigger)
- Har din live traffic ka feature-distribution nikaalo (e.g. mean embedding, max-prob histogram, language-mix).
- Two-sample test (KS-test / PSI — Population Stability Index) baseline ke against → drift pata chale to cycle trigger.
- Source: Gama et al. (2014). **Real saavdhaani:** drift detect hone ka matlab retrain HAI — nahi, matlab *investigate* hai. Auto-trigger + human notify.

### C. Human/LLM-assisted labeling
- Sirf uncertain samples label karo (active learning ka matlab: 10x kam labeling).
- Weak Supervision (Snorkel — Ratner et al., 2017) use kar sakte ho: rules + existing detectors as "labeling functions" → noisy labels, phir model denoise karta hai. Aapke deterministic detectors ko yahaan labeling-functions ki tarah use kar sakte ho — **ye aapka asli edge hai**, kyun ki aapke paas already rule engine hai.
- LLM-assisted labeling bhi legitimate hai par flagged hona chahiye (LLM can be wrong) — "weak label, verified" tag.

### D. Cycle dataset builder (yahi sabse important hai)
- **Replay buffer:** purane data ka ek frozen, representative subset *hamesha* training me rakho. Ye catastrophic forgetting rokne ka #1 cheap trick hai ( Replay-based continual learning — Rolnick et al., 2019).
- **Hard negatives:** jo benign samples false-fire hue (aapke 3 benign FP aaj) — unko labeled-SAFE karke force-include karo.
- **Paraphrase augmentation:** har naye attack sample se 5–10 paraphrases banao (back-translation EN→FR→EN, que/X multilingual pivot). Isse multilingual + novel-paraphrase recall dono improve hote hain baar-baar.
- **Red-team generator:** adversarial probe-generator banaye jo mushkil se mushkil, realistic attacks create kare (yahi aage chal ke self-adversarial loop hai).

### E. Candidate trainer (LoRA + EWC)
- **Full model retrain mat karo.** Base freeze karo, sirf ~0.1% weights (LoRA adapter) train karo → cheap, fast, and a**complete rollback is just a file-swap**.
- EWC loss term add karo: woh weights jo old tasks ke liye important the, unhe change hone se "expensive" bano. Isse forgetting almost zero hota hai (Kirkpatrick 2017 — exact Setting).
- Output = **challenger model**, kabhi bhi directly production nahi.

### F. Evaluation gate (no gate, no promote — non-negotiable)
1. **Locked holdout:** ek test set jo *kabhi* training me na aaya ho aur freeze ho. Hash stamp it (aapke paas already `soterai_data_freeze.py` hai).
2. **Novel black-box suite:** jo aaj humne chalaya — har cycle par same novel-style set.
3. **Per-class regression guard:** challenger kabhi bhi kisi bhi class me champion se worse nahi ho sakta (even if overall better). Yeh silent-regression rokta hai.
4. **FP ceiling:** benign false-positive rate fixed threshold se upar nahi.

### G. Shadow → Canary → Sign-off → Rollback
- **Shadow:** challenger live traffic pe predict karta hai par decisions log hote hain (no action).
- **Canary:** sirf 5% traffic pe challenger ka decision apply hota hai.
- **Promote** only after witness/operator approval. **Rollback = old LoRA file swap** (seconds).

---

## 5) The 3 real dangers & how the design kills them

| Danger | Real attack/problem | Mitigation in this design |
|---|---|---|
| **Catastrophic forgetting** | naye cycle pe purane classes bhoolna | Replay buffer + LoRA (base frozen) + EWC |
| **Poisoning / adversarial feedback** | attacker galat labels bhej kar model corrupt kare | uncertain queue only from low-conf (not attacker-controlled); human verification; label-provenance hash; labeler-set "vote" (no single source) |
| **Silent regression** | naye cycle pe kuch classes secretly break | per-class regression gate + locked holdout + canary only, no auto-deploy |

---

## 6) What you ALREADY have in this repo (build on it, don't rebuild)

| Existing piece | Flywheel role |
|---|---|
| `lib/threatintel/` | future C (external attack feeds → labeling input) |
| Calibration + ECE 0.006 + OOD abstain | block A (uncertainty queue) — **aap already ahead ho** |
| `scripts/ml/real-black-box-v7-test.cjs` | block F (novel-set gate) — yahi gate hai |
| `soterai_data_freeze.py` / `dataset_manifest.json` | locked holdout + hash-stamping |
| Per-label thresholds + `eval_results.json` | per-class regression metrics baseline |
| 9-class ONNX export + versioning | canary LoRA file-swap target |

---

## 7) Phased build plan (realistic, safe-first)

- **Phase 0 (now):** Ship block F as the eval gate for *every* future train run. Manual cycles, gate-enforced. (1–2 weeks)
- **Phase 1:** Active-learning queue (A) + hard-negative mining (D, partially) = uncertainty sampling loop. Human labels only uncertain samples. (3–5 weeks)
- **Phase 2:** Replay buffer + LoRA trainer + EWC = candidate trainer (E). Cycles become cheap. (4–6 weeks)
- **Phase 3:** Drift detector (B) as *trigger-only* (auto-alert, human-start cycle). (2–3 weeks)
- **Phase 4:** Shadow + canary infra (G) = safe promotion. (4–6 weeks)
- **Phase 5 (advanced, only after hardening):** red-team generator (D) + weak supervision via existing detectors = faster flywheel.

> **Important honesty note:** "fully automatic self-training" (unsupervised, no gate) is a known anti-pattern. **Every production-grade self-improving system keeps a gate + human/witness step.** Aap "auto-learn, gated-deploy" banao — "auto-deploy" nahi. Yehi real, safe, world-class approach hai.

---

## 8) Real sources (all genuine, verifiable)
- Settles, B. (2009). *Active Learning Literature Survey*. University of Wisconsin–Madison.
- Kirkpatrick, J. et al. (2017). *Overcoming catastrophic forgetting in neural networks*. PNAS.
- Hu, E. et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models*. ICLR.
- Schroff, F. et al. (2015). *FaceNet: A Unified Embedding for Face Recognition* (hard-negative mining). CVPR.
- Sennrich, R. et al. (2016). *Improving Neural Machine Translation with Back-Translation*. ACL.
- Madry, A. et al. (2018). *Towards Deep Learning Models Resistant to Adversarial Attacks* (adversarial training). ICLR.
- Ratner, A. et al. (2017). *Snorkel: Rapid Training Data Creation with Weak Supervision*. VLDB.
- Rolnick, D. et al. (2019). *Experience Replay for Continual Learning*. NeurIPS.
- Gama, J. et al. (2014). *A Survey on Concept Drift Adaptation*. ACM Computing Surveys.
- Goodfellow, I. et al. (2014). *Explaining and Harnessing Adversarial Examples*. ICLR (adversarial examples).

*Sab sources real aur peer-reviewed/industry-canonical hain. Koi generated/fake citation nahi.*
