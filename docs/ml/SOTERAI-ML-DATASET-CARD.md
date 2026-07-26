# SoterAI ML Dataset Card

## Dataset identity

- **Primary audited file:** `datasets/ml-augmented-v6.jsonl`
- **Rows:** 79,580
- **SHA-256:** `842bfc66bb32f4acf2c2f2f1eb8510c698c3919c1507c07299f2fd05ddcfd732`
- **Audit tool:** `scripts/ml/soterai_data_freeze.py`
- **Audit artifact:** `reports/ml-v1-freeze/dataset-forensic-audit.json`
- **Taxonomy status:** legacy flat labels; not yet reannotated to v1 multi-head labels

## Audit findings

| Finding | Count / result |
| --- | ---: |
| Exact duplicate affected rows | 7,994 |
| Normalized duplicate affected rows | 14,884 |
| Normalized unique texts | 69,325 |
| Conflicting-label groups | 0 in this file; conflicts remain a required audit gate across combined sources |
| Synthetic/augmented rows | 51,064 (64.1669%) |
| English rows | 69,984 |
| Hinglish rows | 1,583 |
| Missing language metadata | 7,980 |
| Spanish / French / German / Portuguese / Hindi / Japanese | 8 / 8 / 6 / 4 / 4 / 3 |
| Lexical near-duplicate candidate pairs | 1,352,582 |
| Lexical near-duplicate accepted pairs | 91,021 |

The lexical MinHash/Jaccard pass is a leakage guard, not semantic equivalence proof. Embedding-based multilingual clustering and human review must be completed in Colab before any final holdout is considered independent.

## Provisional split result

The generated manifests are **not locked**. Source-group separation caused label coverage failure:

- development validation contains only `SAFE`;
- final candidate contains only `SAFE` and `JAILBREAK`;
- final candidate has only three source groups;
- all partitions do not contain every legacy label.

This is evidence that the current augmented corpus cannot produce a valid independent final holdout by splitting rows alone. Do not train, tune thresholds, or claim generalization from these provisional manifests.

## Provenance, privacy, and licence

The repository does not yet provide complete row-level licence, privacy, annotator identity/confidence, generator configuration, and parent lineage for every source. These metadata fields are mandatory for the next dataset version. Sensitive examples must remain redacted in persisted review artifacts.

## Intended use and risks

The corpus is suitable for forensic audit, schema development, smoke testing, and controlled Colab experiments after split validation. It is not currently sufficient as the sole evidence for market comparison, multilingual claims, or independent production promotion. Template memorization, source imbalance, label conflation, and language sparsity can overstate validation performance.