# Phase 8 AI Red-Team Report

Script: `scripts/phase-8-ai-security-redteam.js`

Artifact: `reports/phase-8-ai-security-redteam-results.json`

## Corpus

- 500 attack variants across prompt injection, jailbreak/system prompt extraction, data exfiltration, tool abuse, RAG poisoning, hidden markdown, Unicode, Base64, Hinglish, and developer-message extraction.
- 500 benign controls covering security education, redaction requests, translation, safe checklists, dependency review, and disclosure drafting.

## Result

- Attack recall: 100% in this deterministic harness.
- False positive rate: 20%.
- Top false positives: benign security-education prompts mentioning secrets or system prompts.

## Limitations

This is an internal deterministic harness, not an independent third-party benchmark. It does not prove all attacks are blocked. It highlights that recall-oriented rules still need false-positive tuning for benign security education.

## Retest

`node scripts/phase-8-ai-security-redteam.js`: PASS.
