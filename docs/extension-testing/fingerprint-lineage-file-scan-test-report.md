# Fingerprint, Lineage, and File Scan Test Report

## Tests Added

- `tests/ai-data-security.test.ts`
- `tests/extension/file-content-scanner.test.ts`

## Coverage

Fingerprint Vault:

- Creates hash-only fingerprints.
- Verifies raw source text is not present in serialized fingerprint output.
- Detects exact matches.
- Detects fuzzy overlap.
- Rejects unrelated low-similarity text.
- Redacts secrets and email in previews.

File Content Scanner:

- Blocks `.env`.
- Blocks secret detections in supported file content.
- Requires approval for customer CSV exports.
- Allows clean `.txt`.
- Warns on unsupported binary files when no stronger policy applies.

## Not Yet Covered

- Browser E2E file input clearing.
- Database-backed tenant isolation integration test.
- Admin UI Playwright coverage.
- Live source app copy context expiry.
