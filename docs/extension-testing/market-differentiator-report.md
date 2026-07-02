# Market Differentiator Report

Soter now has a concrete implementation path for three enterprise differentiators beyond standard AI DLP browser controls:

1. Company Data Fingerprint Vault: detects company-specific confidential material using hash-only exact and fuzzy fingerprints.
2. Data Source Lineage Guard: records privacy-safe source-to-AI movement metadata with redacted previews.
3. AI File Content Scanner: reads supported text/source files locally before upload and blocks or escalates risky files.

These features answer:

- What sensitive data was sent?
- Where did it come from?
- Does it match known confidential documents?
- Was a sensitive file uploaded?
- Was it blocked, redacted, warned, justified, or sent for approval?

The implementation is privacy-forward. It avoids raw document, prompt, clipboard, and file-content persistence by default.
