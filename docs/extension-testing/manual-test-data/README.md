# Manual Test Data

Date: 2026-07-01

All files in this folder are fake/synthetic. They are safe for extension validation, but they are intentionally shaped like sensitive data so Soter can exercise detectors, redaction, file scanning, fingerprint matching, and audit privacy behavior.

Never replace these files with real API keys, real customer exports, real source code secrets, real company roadmap text, or real production `.env` files.

## Expected Behavior

| File | Purpose | Expected Soter behavior |
| --- | --- | --- |
| `fake.env` | Fake environment file containing fake API key, database URL, and JWT secret. | Block upload or submission. Clear file input if policy blocks. Backend events must not contain raw file content. |
| `fake-customers.csv` | Fake customer export with test names, emails, and India-style phone numbers. | Detect email/phone/customer data. Redact, block, or require approval based on active policy. |
| `fake-code.js` | Fake JavaScript containing a GitHub-like token string. | Detect token/source-code risk. Block or require approval based on policy. |
| `clean.txt` | Public non-sensitive text. | Allow. No raw clean content should be stored by default. |
| `fake-fingerprint-text.txt` | Synthetic confidential roadmap sentence for fingerprint vault tests. | Match only after this text is configured in the fingerprint vault. Store match metadata, not raw text. |
