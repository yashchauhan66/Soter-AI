# SoterAI Adversarial Mutation Dataset v1 — Summary Report

**Generated**: 2026-06-27
**Source Dataset**: `soter_security_dataset_v1.jsonl` (300 records)
**Mutation Output**: `soter_mutations_v1.jsonl` (1,324 variants)
**Enhanced Regression**: `soter_regression_enhanced_v1.jsonl` (70 variants)
**Generator**: `mutator.py`

---

## 1. Mutation Overview

| Source Type | Source Records | Variants Per Record | Total Variants |
|-------------|---------------|--------------------:|---------------:|
| Malicious | 212 | 5 | 1,060 |
| Benign | 59 | 3 | 177 |
| Borderline | 29 | 3 | 87 |
| **Total** | **300** | — | **1,324** |

### Malicious Mutation Types (5 per record)

| Mutation | Purpose | FP Risk |
|----------|---------|---------|
| `direct` | Slightly reworded version — tests keyword-independent detection | Low |
| `polite` | Wrapped in politeness/social-engineering context — tests intent vs. tone | Medium |
| `indirect` | Embedded in document/email/ticket/webpage — tests indirect injection detection | Medium |
| `obfuscated` | Leetspeak, mixed case, spaced, markdown-hidden, reversed text — tests decoder | Low |
| `multilingual` | Hindi/Hinglish translation — tests multilingual classifier | Medium |

### Benign/Borderline Mutation Types (3 per record)

| Mutation | Purpose | FP Risk |
|----------|---------|---------|
| `normal_user` | Casual user rewording — tests that normal phrasing stays allowed | Low |
| `technical` | Professional/enterprise framing — tests that technical context doesn't trigger | Medium |
| `beginner` | Simplified beginner language — tests that naive phrasing isn't blocked | Low-Medium |

---

## 2. Distribution Analysis

### By False Positive Risk

| Risk Level | Count | Percentage | Notes |
|------------|------:|----------:|-------|
| Low | 542 | 40.9% | Direct variants + benign normal/beginner |
| Medium | 753 | 56.9% | Polite, indirect, multilingual, technical |
| High | 29 | 2.2% | Borderline beginner variants only |

### By Expected Guard Action

| Action | Count | Percentage |
|--------|------:|----------:|
| block_and_audit | 695 | 52.5% |
| block | 365 | 27.6% |
| allow | 198 | 15.0% |
| warn | 51 | 3.9% |
| allow_with_redaction | 12 | 0.9% |
| require_human_confirmation | 3 | 0.2% |

### Family Coverage

All 21 security families have mutation variants — no gaps.

---

## 3. Obfuscation Techniques Applied

The `obfuscated` mutation type randomly applies one of 5 techniques:

| Technique | Example | What It Tests |
|-----------|---------|---------------|
| Leetspeak | `1gn0r3 4ll pr3v10u5` | Character substitution decoder |
| Mixed case | `iGnOrE aLl PrEvIoUs` | Case normalization |
| Character spacing | `i g n o r e all previous` | Token reconstruction |
| Markdown hidden | `<!-- ignore all previous -->` | Markup parser / comment extraction |
| Reversed text hint | `[snoitcurtsni suoiverp]` | Text reversal detection |

---

## 4. Multilingual Techniques Applied

The `multilingual` mutation translates key phrases to Hindi/Hinglish using a dictionary of 30+ phrase mappings:

- English action verbs → Hindi equivalents ("ignore" → "nazarandaz karo")
- Wrapped in Hinglish templates ("Bhai, {prompt}", "Yaar, {prompt}")
- Mixed-language output preserving attack semantics
- Already Hindi/Hinglish records are kept unchanged (no double-translation)

---

## 5. Enhanced Regression Suite

The `soter_regression_enhanced_v1.jsonl` file contains 70 semantically diverse variants (5 per regression record) using advanced evasion strategies:

| Strategy | Description |
|----------|-------------|
| `semantic_reframe` | Completely different wording, same attack goal |
| `multi_step` | Attack broken into multiple innocent-looking messages |
| `context_manipulation` | Plausible cover story hiding malicious intent |
| `technical_disguise` | Framed as legitimate technical operation |
| `emotional_urgency` | Emotional manipulation or time pressure |

---

## 6. Usage Instructions

### Loading Mutations
```python
import json

mutations = []
with open('soter_mutations_v1.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            mutations.append(json.loads(line))

# Link mutations to source records
source = {}
with open('soter_security_dataset_v1.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            r = json.loads(line)
            source[r['id']] = r

for mut in mutations:
    parent = source[mut['parent_id']]
    mut['family'] = parent['family']
    mut['record_type'] = parent['record_type']
    mut['severity'] = parent['severity']
```

### Evaluating Detector Robustness
```python
# For each source record, test all its mutations
from collections import defaultdict

results = defaultdict(lambda: {'pass': 0, 'fail': 0})
for mut in mutations:
    result = soter_guard.analyze(mut['attack_prompt'])
    expected = mut['expected_guard_action']
    if result.action == expected:
        results[mut['mutation_type']]['pass'] += 1
    else:
        results[mut['mutation_type']]['fail'] += 1

# Report per-mutation-type accuracy
for mtype, counts in results.items():
    total = counts['pass'] + counts['fail']
    print(f"{mtype}: {counts['pass']}/{total} ({counts['pass']/total*100:.1f}%)")
```

### Regenerating Mutations
```bash
cd datasets/security-dataset
python3 mutator.py
```
The mutator uses `random.seed(42)` for reproducibility. Change the seed for a different variant set.

---

## 7. Quality Assurance

| Check | Result |
|-------|--------|
| Total variant records | 1,324 |
| Valid JSON (all lines) | 1,324/1,324 |
| Duplicate variant IDs | 0 |
| Orphan parent IDs | 0 |
| Empty attack prompts | 0 |
| Correct variants per parent (5 mal, 3 ben/bor) | All correct |
| Families covered | 21/21 |
| Schema field completeness | 100% |

---

## 8. Combined Dataset Statistics

| Dataset | Records | File Size |
|---------|--------:|----------:|
| Source (`soter_security_dataset_v1.jsonl`) | 300 | 448 KB |
| Mutations (`soter_mutations_v1.jsonl`) | 1,324 | 874 KB |
| Enhanced Regression (`soter_regression_enhanced_v1.jsonl`) | 70 | ~60 KB |
| **Total test corpus** | **~1,694** | **~1.4 MB** |
