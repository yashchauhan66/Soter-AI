# Live Browser Privacy Regression Checklist

**Date:** July 1, 2026  
**Product:** Soter Enterprise AI Control Plane  
**Scope:** P0 privacy fix validation — no raw prompt, no raw fingerprint matched text, no raw file content, no raw copied text in storage, backend payloads, or webhook payloads by default.

---

## Preconditions

- [ ] Backend running (`npm run build && npm start`) with a reachable Postgres database
- [ ] At least one organization + admin user seeded
- [ ] Extension built: `npm run build:extension`
- [ ] Extension loaded unpacked in Chrome: `chrome://extensions` → Load unpacked → `dist/extension/`
- [ ] Extension enrolled and policy-synced (heartbeat visible in admin)
- [ ] Chrome DevTools → Application → Storage → Extension Storage Local accessible for inspection
- [ ] Admin dashboard audit log accessible
- [ ] Fingerprint vault seeded with at least one fingerprint set containing fake confidential text
- [ ] At least one source app configured (e.g., GitHub or Google Docs)

---

## 1. Clean Prompt Storage Test

**Objective:** Verify no raw clean prompt text is stored in extension storage.

- [ ] Navigate to `https://chatgpt.com`
- [ ] Type a clean prompt: `How do I implement error handling in React?`
- [ ] Submit the prompt
- [ ] Open Chrome DevTools → Application → Storage → Extension Storage Local
- [ ] Inspect the `soter.extensionState` entry
  - [ ] `latestScan.redactedText` is `[CLEAN_PROMPT_NOT_STORED]` ✅
  - [ ] `latestScan.textHash` is a 64-char hex SHA-256 hash ✅
  - [ ] `latestScan.length` equals the prompt character count ✅
  - [ ] `latestScan` does NOT contain the raw prompt string ✅
- [ ] Inspect `soter.lineageContext.v1` (if applicable)
  - [ ] `selectedTextHash` is a hash, not raw text ✅
  - [ ] `redactedPreview` is `[LINEAGE_CONTENT_NOT_STORED]` or redacted ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 2. Clean Prompt Backend Payload Test

**Objective:** Verify no raw clean prompt text is sent to backend APIs.

- [ ] Open Chrome DevTools → Network tab
- [ ] Filter by `/api/extension/`
- [ ] Submit clean prompt on ChatGPT
- [ ] Inspect the `scan` and `audit-log` POST requests
  - [ ] `redactedPreview` is `[CLEAN_PROMPT_NOT_STORED]` ✅
  - [ ] No `rawText`, `prompt`, `fullPrompt`, `fileContent`, `copiedText`, `matchedText`, or `rawContent` field exists ✅
  - [ ] Payload contains only: `organizationId`, `employeeId`, `url`, `riskScore`, `detectedDataTypes`, `action`, `redactedPreview` ✅
- [ ] Verify admin audit log entry (in `/admin/audit/logs` or similar)
  - [ ] `redactedPreview` is `[CLEAN_PROMPT_NOT_STORED]` ✅
  - [ ] No raw prompt visible in audit entry ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 3. Fake API Key Blocked and Not Leaked

**Objective:** Verify API keys are detected, blocked, and not leaked in storage or backend.

- [ ] Open ChatGPT
- [ ] Type a prompt containing `API_KEY=synthetic_api_key_value`
- [ ] Submit the prompt
- [ ] Verify prompt is blocked ✅
- [ ] Inspect extension storage:
  - [ ] `latestScan.redactedText` does NOT contain `synthetic_api_key_value` ✅
  - [ ] `latestScan.redactedText` contains `[REDACTED_API_KEY]` or `[REDACTED_ENV_VAR]` ✅
  - [ ] `latestScan.findings[*].match` does NOT contain the raw key ✅
- [ ] Inspect Network tab → `audit-log` POST:
  - [ ] `redactedPreview` does NOT contain `synthetic_api_key_value` ✅
  - [ ] `redactedPreview` contains `[REDACTED_API_KEY]` ✅
- [ ] Inspect Network tab → `scan` POST:
  - [ ] `redactedPreview` does NOT contain raw key ✅
- [ ] Verify admin audit log shows `[REDACTED_API_KEY]` not raw key ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 4. Private Key Not Leaked

**Objective:** Verify private key blocks are fully redacted from all outputs.

- [ ] Open ChatGPT
- [ ] Type a prompt containing a fake private key block:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  MIIEpAIBAAKCAQEA
  -----END RSA PRIVATE KEY-----
  ```
- [ ] Submit
- [ ] Verify prompt is blocked ✅
- [ ] Inspect extension storage:
  - [ ] No occurrence of `BEGIN RSA PRIVATE KEY` in stored `redactedText` ✅
  - [ ] `redactedText` contains `[REDACTED_PRIVATE_KEY]` ✅
- [ ] Inspect Network `audit-log`:
  - [ ] `redactedPreview` does NOT contain private key content ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 5. Fingerprint Exact Match Does Not Leak Matched Text

**Objective:** Verify exact fingerprint-matched confidential text is NOT sent in fingerprint, audit, or scan events.

- [ ] Precondition: Create a fingerprint set from confidential text in admin fingerprint vault
- [ ] In Claude (`https://claude.ai`), type/paste the exact confidential text
- [ ] Submit
- [ ] Verify fingerprint match is detected and action enforced ✅
- [ ] Inspect Network → `fingerprint-match` POST:
  - [ ] `localMatches[*].evidence` is `"Exact fingerprint match detected against confidential dataset"` ✅
  - [ ] No `rawText`, `matchedText`, `prompt`, or raw chunk text in payload ✅
  - [ ] `localMatches[*]` contains only: `matchedFingerprintSetId`, `similarityScore`, `sensitivity`, `recommendedAction`, `matchType`, `confidence`, `matchedChunkCount`, `totalComparedChunks`, `evidence` ✅
  - [ ] `redactedPreview` is `"Fingerprint match detected against confidential dataset; raw matched text not retained"` ✅
- [ ] Inspect Network → `audit-log` POST:
  - [ ] `redactedPreview` does NOT contain raw matched text ✅
  - [ ] `redactedPreview` contains `[CLEAN_PROMPT_NOT_STORED]` or fingerprint marker ✅
- [ ] Inspect Network → `scan` POST:
  - [ ] `redactedPreview` is `[CLEAN_PROMPT_NOT_STORED]` ✅
- [ ] Verify admin fingerprint match event:
  - [ ] No raw matched text visible ✅
  - [ ] Only metadata: set ID, similarity score, action ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 6. Fuzzy Fingerprint Match Does Not Leak Text

**Objective:** Verify fuzzy fingerprint matches only emit metadata.

- [ ] Precondition: Create a fingerprint set with confidential company text
- [ ] In Claude, paste text that is SIMILAR (but not identical) to the confidential source
- [ ] Submit
- [ ] Verify fuzzy match is detected (if similarity > threshold) ✅
- [ ] Inspect `fingerprint-match` POST:
  - [ ] `matchType` is `"fuzzy"` ✅
  - [ ] `evidence` contains similarity score only, not raw text ✅
  - [ ] No raw matched text in any field ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 7. File Content Not Stored or Sent Raw

**Objective:** Verify file scan events contain only metadata, never raw file content.

- [ ] Open ChatGPT
- [ ] Upload a fake `.env` file containing:
  ```
  API_KEY=synthetic_api_key_value
  DATABASE_URL=postgresql://admin:secret@db.internal/prod
  ```
- [ ] Verify file input is cleared and blocking overlay shown ✅
- [ ] Inspect Network → `file-scan-event` POST:
  - [ ] No `rawText`, `fileContent`, `prompt`, or raw content field exists ✅
  - [ ] `fileNameHash` is a 64-char hex hash (not the filename) ✅
  - [ ] `originalExtension` is `.env` ✅
  - [ ] `sizeBytes` is a number ✅
  - [ ] `redactedPreview` does NOT contain `synthetic_api_key_value` ✅
  - [ ] `redactedPreview` contains `[REDACTED_API_KEY]` or `[REDACTED_ENV_VAR]` ✅
- [ ] Verify admin `/admin/file-scan-events` entry:
  - [ ] No raw file content ✅
  - [ ] Only redacted preview + metadata ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 8. Lineage Copied Text Not Stored Raw

**Objective:** Verify copied text from source apps is never stored as raw text.

- [ ] Precondition: GitHub configured as a source app in admin
- [ ] Navigate to `https://github.com/some/repo/file` containing fake confidential text
- [ ] Select and copy some faked confidential text (e.g., containing `synthetic_api_key_value`)
- [ ] Inspect extension storage → `soter.lineageContext.v1`:
  - [ ] `selectedTextHash` is a 64-char hex SHA-256 hash ✅
  - [ ] No raw copied text stored ✅
  - [ ] `redactedPreview` is `[LINEAGE_CONTENT_NOT_STORED]` or redacted ✅
  - [ ] `sourceUrlHash` is a hash (query params stripped) ✅
- [ ] Navigate to ChatGPT and paste the copied text
- [ ] Inspect Network → `lineage-event` POST:
  - [ ] No `copiedText`, `rawText`, `fileContent`, `prompt` field ✅
  - [ ] `redactedPreview` is `[LINEAGE_CONTENT_NOT_STORED]` or redacted ✅
  - [ ] Payload contains only: source app metadata, destination metadata, data types, risk score, action ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 9. Approval Request Preview Sanitized

**Objective:** Verify approval request payloads never contain raw prompt/file/fingerprint text.

- [ ] Configure a policy to trigger `require_approval` (e.g., customer data or India PII)
- [ ] Submit prompt containing sensitive data (e.g., PAN, customer list)
- [ ] Verify approval overlay appears ✅
- [ ] Inspect Network → `approval-request` POST:
  - [ ] `redactedPreview` does NOT equal raw input ✅
  - [ ] `redactedPreview` is sanitized (contains `[REDACTED_PAN]` or similar) ✅
  - [ ] No `rawText`, `prompt`, `fullPrompt` field ✅
- [ ] Verify admin approval queue entry:
  - [ ] `redactedPreview` is sanitized ✅
  - [ ] No raw prompt text visible ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 10. Webhook Payload Sanitized

**Objective:** Verify SIEM/webhook payloads never contain raw content by default.

- [ ] Precondition: SIEM webhook configured in admin
- [ ] Trigger a blocked prompt event (e.g., API key)
- [ ] Inspect webhook delivery payload (via admin delivery logs or captured request):
  - [ ] No `rawText`, `prompt`, `fullPrompt`, `fileContent`, `copiedText`, `matchedText`, `rawContent` field ✅
  - [ ] `metadata.redactedPreview` does NOT contain raw fake secret ✅
  - [ ] `metadata.redactedPreview` contains `[REDACTED_API_KEY]` or similar ✅
  - [ ] Payload contains only: `id`, `organizationId`, `eventType`, `severity`, `riskTypes`, `action`, `source`, `timestamp`, `metadata` ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 11. Full Prompt Logging Disabled by Default

**Objective:** Verify raw prompt is never sent unless admin explicitly enables full logging.

- [ ] With default admin settings (full prompt logging NOT enabled):
  - [ ] Submit any prompt
  - [ ] Verify `redactedPreview` in backend is `[CLEAN_PROMPT_NOT_STORED]` ✅
  - [ ] Verify no raw prompt text in any backend payload ✅
- [ ] If admin full prompt logging is implemented:
  - [ ] Enable full prompt logging in admin settings
  - [ ] Submit prompt
  - [ ] Verify `redactedPreview` now contains redacted-but-readable content ✅
  - [ ] Verify raw prompt is still NOT sent (only redacted) ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 12. Backend Rejects Disallowed Raw Fields

**Objective:** Verify backend API routes reject payloads containing raw content fields.

- [ ] Using curl or browser console, send a POST to `/api/extension/audit-log` with a `rawText` field:
  ```javascript
  fetch('/api/extension/audit-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationId: 'org',
      rawText: 'secret stuff'
    })
  }).then(r => r.json()).then(console.log)
  ```
  - [ ] Response status is 400 ✅
  - [ ] Error message mentions "Raw content field" ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## 13. Response Scanning Privacy

**Objective:** Verify response scanning does not store/send raw response text by default.

- [ ] Enable response scanning in admin settings for ChatGPT
- [ ] Submit clean prompt to ChatGPT
- [ ] Wait for AI response
- [ ] Verify extension storage does NOT contain the raw AI response ✅
- [ ] Verify network does NOT contain raw response text ✅

**Pass/Fail:** ☐ PASS ☐ FAIL

---

## Summary

| # | Test | Pass/Fail |
|---|------|-----------|
| 1 | Clean prompt not in storage | ☐ |
| 2 | Clean prompt not in backend payload | ☐ |
| 3 | Fake API key not leaked | ☐ |
| 4 | Private key not leaked | ☐ |
| 5 | Fingerprint exact match not leaked | ☐ |
| 6 | Fuzzy fingerprint match not leaked | ☐ |
| 7 | File content not stored/sent raw | ☐ |
| 8 | Lineage copied text not stored raw | ☐ |
| 9 | Approval request preview sanitized | ☐ |
| 10 | Webhook payload sanitized | ☐ |
| 11 | Full prompt logging disabled by default | ☐ |
| 12 | Backend rejects raw fields | ☐ |
| 13 | Response scanning privacy | ☐ |

**Overall result:** ☐ ALL PASS ☐ ANY FAIL

**Tester:** ____________________ **Date:** ____________________

**Notes:**
