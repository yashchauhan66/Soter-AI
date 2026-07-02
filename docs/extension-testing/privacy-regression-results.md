# Soter Extension — Privacy Regression Test Results

**Date:** 2026-07-01  
**Test Suite:** `npm run test:extension` (privacy tests within 120 total)  
**Status:** ✅ ALL PASS

---

## Privacy Test Results

### PRIV-001: Raw file content is never sent to backend in file scan results ✅
- `.env` with `API_KEY=sk-live-*` extracted locally
- `applyFilePolicy()` returns `block`
- Raw content NOT in scan result payload

### PRIV-002: File scan event metadata does not contain raw file content ✅
- `.js` file with embedded API key scanned
- Redacted preview does NOT contain `SUPERSECRETKEY`
- Only metadata fields present

### PRIV-003: Raw copied text is never stored in lineage context ✅
- Confidential text with email, AWS key, budget data copied
- Serialized context does NOT contain raw text, email, or AWS key
- Query param secrets stripped
- `selectedTextHash` is 64-char SHA-256

### PRIV-004: Source URLs are hashed and query params stripped ✅
- URL `https://github.com/acme/repo?token=SECRET_123` → hash only
- `SECRET_123` not in serialized context
- Hash does not contain domain name

### PRIV-005: Fingerprint chunks are SHA-256 hashes only ✅
- Document with API key, private key, email fingerprinted
- All chunks are 64-char hex SHA-256 hashes
- No raw text in serialized fingerprint

### PRIV-006: API keys do not appear in redacted preview ✅
- Tested: `sk-live-*`, password, `AKIA*`, `ghp_*`, private key, `Bearer *`
- None appear in any redacted preview

### PRIV-007: Private key blocks do not appear in match events or previews ✅
- Private key header `BEGIN RSA PRIVATE KEY` not in match
- Private key content `MIIEpAIBAAKCAQEA` not in match
- API key not in match event

### PRIV-008: Cross-tenant fingerprint isolation ✅
- OrgA fingerprint does NOT match OrgB text
- 0 matches returned (isolation enforced)

### PRIV-009: Unrelated site monitoring is not active ✅
- `google.com`, `news.ycombinator.com`, `stackoverflow.com`, `reddit.com` → NOT monitored
- `chatgpt.com` → NOT monitored as source app (only as AI destination)

### PRIV-010: Lineage context TTL is enforced ✅
- Context fresh within 15-minute TTL → retrievable
- Context after TTL → returns `null`

### PRIV-011: File content scanned locally, only metadata sent ✅
- CSV with emails extracted locally
- Emails redacted in preview
- Only metadata would be sent to backend

### PRIV-012: Large file truncation preserves privacy ✅
- 50K-line file with secret at end
- Truncated to 1024 bytes
- API key still redacted in preview

### PRIV-013: SQL file customer data not leaked in preview ✅
- SQL with email and API key → both redacted

### PRIV-014: JSON file secrets not leaked in preview ✅
- JSON with API key → redacted

### PRIV-015: Log file stack trace secrets not leaked ✅
- Production log with password → redacted

### PRIV-016: Disabled/deleted fingerprint sets do not match ✅
- Empty bundle → 0 matches

### PRIV-017: Fingerprint similarity below threshold does not trigger critical action ✅
- Unrelated text → no critical confidence match

---

## Response Scanning Privacy Tests

### RSP-001: Service worker skips audit for clean response scans ✅
### RSP-002: Clean response scan produces no findings ✅
### RSP-003: Response observer checks enabled flag ✅
### RSP-004: Redacted preview truncates and redacts ✅
### RSP-005: Response containing secrets produces findings ✅
### RSP-006: Response scanning respects destination config ✅
### RSP-007: AI destinations define responseScanningEnabled field ✅
### RSP-008: Response audit uses redactedPreview not raw text ✅
### RSP-009: Privacy policy explains response scanning ✅
### RSP-010: Permission justification documents response scanning ✅

---

## Backend Payload Privacy Tests

### Clean scan payload never sends raw prompt as redactedPreview ✅
### File, lineage, fingerprint payloads contain metadata but no source content ✅
### Clean prompt storage state contains only hash, length, metadata, and marker ✅
### Private key and fake API key cannot enter stored scan state ✅

---

## Additional Privacy Guarantees Verified

| Guarantee | Verified |
|---|---|
| `assertNoRawSensitiveData()` called before every API request | ✅ (in `api-client.ts`) |
| `sanitizePrivacyPayload()` applied to audit events | ✅ |
| `createPrivacySafePreview()` used for all previews | ✅ |
| `createStorageSafeScanResult()` used before chrome.storage writes | ✅ |
| Raw text never stored in `latestScan` | ✅ |
| Full prompt logging only with `allowFullText === true` AND `full_prompt_explicit_admin_enabled` | ✅ |
| Full prompt logging disabled by default | ✅ |

---

## Disallowed Raw Fields

| Field | Status |
|---|---|
| `rawText` | ❌ Never sent by extension API client |
| `prompt` | ❌ Never sent |
| `fullPrompt` | ❌ Never sent |
| `fileContent` | ❌ Never sent |
| `copiedText` | ❌ Never sent |
| `matchedText` | ❌ Never sent |
| `rawContent` | ❌ Never sent |

---

## P0 Privacy Verdict

**✅ ALL P0 PRIVACY TESTS PASS**

No raw prompts, file content, copied text, API keys, private keys, or PII are stored or transmitted by default. Private/hidden listing is NOT blocked by privacy issues.
