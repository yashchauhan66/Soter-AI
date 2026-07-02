# P0 Privacy Fix Report

**Date:** July 1, 2026  
**Product:** Soter Enterprise AI Control Plane  
**Version:** 0.2.0  

---

## Executive Summary

Three critical P0 privacy bugs were identified and fixed:

1. **Raw clean prompts retained in extension storage** — Fixed by routing all storage writes through `createStorageSafeScanResult()` which replaces raw text with `[CLEAN_PROMPT_NOT_STORED]` markers and SHA-256 hashes.
2. **Raw clean prompts sent in backend `redactedPreview` fields** — Fixed by routing all backend payloads through `createPrivacySafePreview()` and adding backend validation guards that reject raw content fields.
3. **Exact fingerprint-matched confidential text sent in fingerprint, audit, and scan events** — Fixed by ensuring fingerprint match evidence is always metadata-only (set ID, similarity score, match type) and never contains raw matched text.

All three bugs shared the same root cause: data paths that wrote or transmitted raw user input (prompts, file content, copied text, fingerprint-matched text) without passing through the centralized privacy-safe preview utility.

---

## Root Cause Analysis

### Root Cause 1: No Centralized Privacy Gate on Storage

When the extension's `handleScan()` function stored scan results via `setState({ latestScan: result })`, the `result.redactedText` was already redacted, but `result.findings[*].match` could still contain raw matched text snippets. Additionally, the `latestScan` stored the raw `redactedText` directly rather than through the privacy-safe preview pipeline.

**Fix:** `createStorageSafeScanResult()` now wraps storage writes to ensure:
- `redactedText` uses `[CLEAN_PROMPT_NOT_STORED]` for clean prompts
- `findings[*].match` runs through `createPrivacySafePreview()` (max 120 chars, redacted)
- `textHash` is computed as SHA-256
- `length` is recorded as a number
- No raw text appears in any stored field

### Root Cause 2: No Centralized Privacy Gate on Backend Payloads

The extension's `api.scan()` and `api.audit()` methods sent scan results where `redactedPreview` could equal the raw input for clean prompts (since no redaction was applied to clean text). The backend accepted whatever preview was sent.

**Fix (client side):** All API client methods (`scan`, `audit`, `fileScanEvent`, `lineageEvent`, `fingerprintMatch`, `requestApproval`) now route through `previewForScan()` or `createPrivacySafePreview()` before sending.

**Fix (server side):** All extension API routes (`audit-log`, `scan`, `approval-request`, `fingerprint-match`, `file-scan-event`, `lineage-event`) now:
1. Call `rejectDisallowedRawContent(raw)` to reject payloads with `rawText`, `prompt`, `fullPrompt`, `fileContent`, `copiedText`, `matchedText`, or `rawContent` fields
2. Re-process `redactedPreview` through `sanitizeExtensionPreview()` server-side as defense-in-depth

### Root Cause 3: Fingerprint Evidence Contained Raw Text

The `FingerprintMatchResult.evidence` field in the fingerprint matcher contained raw matched text chunks, which were sent to the backend in fingerprint match events and stored in the database.

**Fix:** Both the local fingerprint matcher (`apps/extension/src/lib/fingerprint-matcher.ts`) and server-side fingerprint matcher (`lib/ai-data-security/fingerprint.ts`) now produce evidence that is always metadata-only:
- For exact matches: `"Exact fingerprint match detected against confidential dataset"`
- For fuzzy matches: `"Fuzzy fingerprint match detected (similarity: {score})"`
- The backend fingerprint route (`app/api/extension/fingerprint-match/route.ts`) validates that evidence does not contain API key/secret/token patterns

---

## Files Changed

| File | Change | Fix Number |
|------|--------|------------|
| `packages/shared/src/privacy.ts` | Core privacy utility: `createPrivacySafePreview()`, `redactSensitiveText()`, `containsDisallowedRawField()`, `sanitizePrivacyPayload()`, `assertNoRawSensitiveData()` | 1, 2, 3 |
| `apps/extension/src/lib/privacy-preview.ts` | Extension privacy helpers: `createStorageSafeScanResult()`, `previewForScan()` | 1, 2 |
| `apps/extension/src/lib/storage.ts` | `setState()` now wraps `latestScan` through `createStorageSafeScanResult()` | 1 |
| `apps/extension/src/lib/api-client.ts` | All API methods route previews through `createPrivacySafePreview()` + `assertNoRawSensitiveData()` | 2 |
| `apps/extension/src/background/service-worker.ts` | Scan audit uses `previewForScan()`, storage uses `createStorageSafeScanResult()` | 1, 2 |
| `apps/extension/src/lib/scanner.ts` | Findings match redacted through `auditSafePreview()` | 1 |
| `apps/extension/src/lib/redaction.ts` | `auditSafePreview()` uses `createPrivacySafePreview()` | 2 |
| `apps/extension/src/lib/fingerprint-matcher.ts` | Evidence is metadata-only: `"Exact fingerprint match detected against confidential dataset"` | 3 |
| `apps/extension/src/lib/lineage-context.ts` | `createLineageContext()` stores redacted preview, not raw text; URLs hashed | 1, 2 |
| `apps/extension/src/lib/file-scan-policy.ts` | `redactedPreview` uses `createPrivacySafePreview()` | 2 |
| `lib/extension/privacyGuard.ts` | Backend guards: `rejectDisallowedRawContent()`, `sanitizeExtensionPreview()`, `sanitizeExtensionMetadata()` | 2, 5 |
| `app/api/extension/audit-log/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` | 2, 5 |
| `app/api/extension/scan/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` | 2, 5 |
| `app/api/extension/approval-request/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` | 2, 5 |
| `app/api/extension/fingerprint-match/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` + evidence validation | 2, 3, 5 |
| `app/api/extension/file-scan-event/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` | 2, 5 |
| `app/api/extension/lineage-event/route.ts` | Uses `rejectDisallowedRawContent()` + `sanitizeExtensionPreview()` | 2, 5 |
| `lib/siem/webhooks.ts` | `redactedWebhookPayload()` uses `sanitizePrivacyPayload()` | 6 |
| `lib/siem/exporters.ts` | `safeEvent()` uses `sanitizePrivacyPayload()` | 6 |
| `lib/ai-data-security/fingerprint.ts` | Evidence is metadata-only; `redactedPreview()` uses `createPrivacySafePreview()` | 3 |
| `app/api/extension/_shared.ts` | `recordExtensionSecurityEvent()` uses `sanitizeExtensionMetadata()` | 2 |
| `tests/phase5.test.ts` | Fixed assertion: `REDACTED_SECRET` → `REDACTED_API_KEY` | 7 |
| `tests/extension/privacy-no-raw-storage.test.ts` | Tests: clean prompt not stored, private key not stored | 7 |
| `tests/extension/privacy-no-raw-backend-payload.test.ts` | Tests: clean scan payload, file/lineage/fingerprint metadata only | 7 |
| `tests/extension/privacy-backend-guards.test.ts` | Tests: backend rejects raw fields, SIEM webhook sanitized, full prompt logging modes | 7 |
| `tests/extension/privacy-security.test.ts` | Tests: 17 comprehensive privacy tests (PRIV-001 to PRIV-017) | 7 |
| `tests/extension/response-scanning-privacy.test.ts` | Tests: response scanning privacy (RSP-001 to RSP-010) | 7 |

---

## New Privacy Utility Design

### `packages/shared/src/privacy.ts` — Core Privacy Module

```
createPrivacySafePreview(input: PrivacySafePreviewInput): string
  - If logMode === "metadata_only" → "[METADATA_ONLY]"
  - If contextType === "fingerprint" or "company_fingerprint_match" detected
    → "Fingerprint match detected against confidential dataset; raw matched text not retained"
  - Redacts all sensitive patterns via redactSensitiveText()
  - For clean prompts → "[CLEAN_PROMPT_NOT_STORED]" (not raw input!)
  - Full prompts only when allowFullText=true AND logMode="full_prompt_explicit_admin_enabled"
  - Always capped to maxLength (default 500, max 1000)

redactSensitiveText(input: string): string
  - API keys (sk-, pk- patterns)
  - AWS access keys (AKIA/ASIA)
  - GitHub tokens (ghp_ etc.)
  - Slack tokens (xox[baprs]-)
  - JWT tokens
  - Private keys (RSA/EC/DSA/OPENSSH)
  - Database URLs (postgres://, mysql://, etc.)
  - Passwords
  - Emails
  - Phone numbers (India +91 format)
  - Aadhaar-like numbers
  - PAN, GSTIN, UPI, IFSC
  - Credit cards
  - Internal IPs (10.x.x.x, 192.168.x.x)
  - Local file paths
  - Internal URLs (localhost, .local, .internal)
  - Environment variables

containsDisallowedRawField(value: unknown): string | null
  - Recursively checks for rawtext, prompt, fullPrompt, fileContent,
    copiedText, matchedText, rawContent, documentContent, response,
    rawResponse, chunkText, sample, snippet

sanitizePrivacyPayload(value: unknown): unknown
  - Strips all disallowed raw content keys
  - Re-runs redactedPreview/evidence through createPrivacySafePreview()
  - Re-runs string values through redactSensitiveText()

assertNoRawSensitiveData(payload: unknown): void
  - Test/dev helper: throws if fake test secrets appear in payload
```

### `apps/extension/src/lib/privacy-preview.ts` — Extension-Specific Wrappers

```
createStorageSafeScanResult(result: ScanResult, rawText: string): ScanResult
  - Computes textHash (SHA-256)
  - Stores prompt length
  - Replaces redactedText with privacy-safe preview
  - Sanitizes findings[*].match
  - Replaces rewrittenSafeText with preview

previewForScan(result: ScanResult, contextType, maxLength): string
  - Wraps createPrivacySafePreview for ScanResult objects
```

---

## Storage Changes

### Extension Storage (`chrome.storage.local`)

| Key | Before | After |
|-----|--------|-------|
| `soter.extensionState.latestScan.redactedText` | Raw redacted text (could equal raw input for clean prompts) | `[CLEAN_PROMPT_NOT_STORED]` for clean prompts; redacted text for flagged content |
| `soter.extensionState.latestScan.textHash` | Not present | SHA-256 hex hash of raw input |
| `soter.extensionState.latestScan.length` | Not present | Character count of raw input |
| `soter.extensionState.latestScan.findings[*].match` | Raw matched text snippet | Redacted preview (max 120 chars, secrets redacted) |
| `soter.extensionState.latestScan.rewrittenSafeText` | Could contain raw content | Same as redactedText preview |
| `soter.lineageContext.v1.selectedTextHash` | Not present | SHA-256 hex hash of selected text |
| `soter.lineageContext.v1.redactedPreview` | Raw copied text | `[LINEAGE_CONTENT_NOT_STORED]` or redacted preview |
| `soter.lineageContext.v1.sourceUrlHash` | Not present | SHA-256 hash of redacted URL |

No raw prompt, raw file content, raw copied text, or raw fingerprint-matched text is stored in extension storage by default.

---

## API Payload Changes

### Backend-Bound Payloads

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /api/extension/scan` | `redactedPreview` could equal raw prompt | `[CLEAN_PROMPT_NOT_STORED]` for clean prompts |
| `POST /api/extension/audit-log` | `redactedPreview` could contain raw text | Sanitized via `createPrivacySafePreview()` |
| `POST /api/extension/approval-request` | Same issue | Sanitized via `createPrivacySafePreview()` with `"approval"` context |
| `POST /api/extension/fingerprint-match` | `evidence` could contain raw matched text | Metadata-only: set ID, similarity score, action; backend validates evidence |
| `POST /api/extension/file-scan-event` | `redactedPreview` could contain raw file content | Sanitized via `createPrivacySafePreview()` with `"file"` context |
| `POST /api/extension/lineage-event` | Could contain raw copied text | Sanitized via `createPrivacySafePreview()` with `"lineage"` context |

All payloads are validated server-side: any disallowed raw content field (`rawText`, `prompt`, `fullPrompt`, `fileContent`, `copiedText`, `matchedText`, `rawContent`) causes a 400 rejection.

---

## Backend Validation Changes

### Extension API Routes — All Now Include:

1. **`rejectDisallowedRawContent(raw)`** — Rejects request if payload contains `rawText`, `prompt`, `fullPrompt`, `fileContent`, `copiedText`, `matchedText`, or `rawContent` at any nesting level. Returns 400 with descriptive error.

2. **`sanitizeExtensionPreview(body.redactedPreview, contextType, detectedDataTypes)`** — Re-processes any incoming preview through the central privacy utility as defense-in-depth. Even if the extension sends an unsanitized preview, the backend will sanitize it again.

3. **`sanitizeExtensionMetadata(metadata)`** — Strips any disallowed raw content keys from metadata and re-runs string values through `redactSensitiveText()`.

### Fingerprint Match Route — Additional Validation:

- `evidence` field schema includes a `.refine()` that rejects evidence containing API key/secret/token patterns.

---

## Fingerprint Match Privacy Changes

### Client Side (`apps/extension/src/lib/fingerprint-matcher.ts`)

| Field | Before | After |
|-------|--------|-------|
| `LocalFingerprintMatch.evidence` | Could contain raw matched text | `"Exact fingerprint match detected against confidential dataset"` or `"Fuzzy fingerprint match detected (similarity: {score})"` |

### Server Side (`lib/ai-data-security/fingerprint.ts`)

| Field | Before | After |
|-------|--------|-------|
| `FingerprintMatchResult.evidence` | Raw text or undefined | `{ exactChunkMatches: number, fuzzyShingleMatches: number, rawTextStored: false }` |
| `FingerprintRecord` | Could store raw text | Only `chunkHashes` and `shingleHashes` (SHA-256) stored |

### API Route (`app/api/extension/fingerprint-match/route.ts`)

- Schema validates `evidence` does not match API key/secret/token patterns
- `localMatches[*].evidence` is limited to 200 chars max
- `redactedPreview` is always `"Fingerprint match detected against confidential dataset; raw matched text not retained"` for fingerprint contexts

---

## SIEM/Webhook Privacy Changes

### `lib/siem/webhooks.ts` — `redactedWebhookPayload()`

- All metadata is passed through `sanitizePrivacyPayload()`:
  - Disallowed raw content keys are stripped
  - String values are redacted for secrets
  - `redactedPreview` is re-sanitized

### `lib/siem/exporters.ts` — `safeEvent()`

- All event metadata is passed through `sanitizePrivacyPayload()` before serialization
- Each exporter (Splunk, Elastic, Datadog, generic HTTP, signed webhook) uses `safeEvent()` or `redactedWebhookPayload()`

### Allowed Webhook Payload Fields

- `id`, `organizationId`, `projectId`, `eventType`, `severity`, `riskTypes`, `action`, `source`, `timestamp`, `metadata` (sanitized)

### Disallowed Webhook Payload Fields

- Raw prompt text, raw response text, raw file content, raw copied text, raw fingerprint matched text

---

## Tests Added

### `tests/extension/privacy-no-raw-storage.test.ts` (2 tests)

| Test | Description |
|------|-------------|
| Clean prompt storage state contains only hash, length, metadata and marker | `How do I implement error handling in React?` → stored as `[CLEAN_PROMPT_NOT_STORED]` with SHA-256 hash + length |
| Private key and fake API key cannot enter stored scan state | `API_KEY=synthetic_api_key_value` + `-----BEGIN PRIVATE KEY-----` → neither raw value appears in storage |

### `tests/extension/privacy-no-raw-backend-payload.test.ts` (2 tests)

| Test | Description |
|------|-------------|
| Clean scan payload never sends raw prompt as redactedPreview | `redactedPreview` is `[CLEAN_PROMPT_NOT_STORED]`, no URL query param leakage |
| File, lineage and fingerprint payloads contain metadata but no source content | Fake secret in file/lineage/fingerprint payloads → secret not present in sent body |

### `tests/extension/privacy-backend-guards.test.ts` (5 tests)

| Test | Description |
|------|-------------|
| Backend rejects every disallowed raw content field | All 7 raw fields (`rawText`, `prompt`, `fullPrompt`, etc.) rejected at any nesting level |
| Backend sanitizes previews again and clean preview is metadata-only | Server-side re-sanitization ensures `[CLEAN_PROMPT_NOT_STORED]` for clean prompts |
| SIEM webhook strips raw fields and sanitizes fake secrets | `redactedWebhookPayload()` removes `rawText` and redacts fake API key |
| Full prompt logging requires both explicit mode and allowFullText | Both conditions must be met for full prompt to pass through |
| Fingerprint finding can never make unchanged confidential text eligible for preview | `[company_fingerprint_match]` → fingerprint marker, not raw text |

### `tests/extension/privacy-security.test.ts` (17 tests: PRIV-001 to PRIV-017)

Covers: file content privacy, file scan metadata, lineage context storage, URL hashing, fingerprint chunk hashes, API key redaction, private key blocks, cross-tenant isolation, unrelated site monitoring, lineage TTL, local file scanning, large file truncation, SQL/JSON/log privacy, disabled fingerprint sets, similarity threshold validation.

### `tests/extension/response-scanning-privacy.test.ts` (10 tests: RSP-001 to RSP-010)

Covers: response scan audit skip, clean response findings, enabled flag check, preview truncation/redaction, secret detection, destination configuration, scanning flags, redacted preview audit, privacy policy documentation, permission justification documentation.

### Existing tests updated

- `tests/phase5.test.ts` — Fixed assertion expectation from `REDACTED_SECRET` to `REDACTED_API_KEY`

---

## Test Results

### Extension Tests: 120/120 passed ✅

```tap
1..120
# tests 120
# pass 120
# fail 0
# duration_ms 7927.6386
```

### Full Test Suite: 626/626 passed ✅

```tap
# tests 626
# pass 626
# fail 0
```

---

## Build/Package Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run typecheck:extension` | ✅ Pass |
| `npm run validate:extension-permissions` | ✅ Pass |
| `npm run build:extension` | ✅ Builds clean (service-worker: 47KB, content/index: 53KB, source-lineage-entry: 14KB) |
| `npm run package` | ✅ Package created |
| `npm run test:extension` | ✅ 120 tests pass |
| `npm test` | ✅ 626 tests pass |

---

## Remaining Privacy Limitations

1. **Full prompt logging** — The code supports `full_prompt_explicit_admin_enabled` mode but the admin UI toggle for this is not yet implemented. Without it, full prompts are blocked by default as desired.

2. **Extension Debug Mode** — If a developer enables verbose extension logging via `chrome.storage.managed`, raw prompts could appear in console logs. This is a development-only concern.

3. **Manifest V3 Service Worker Console** — Error objects and debugging logs could theoretically contain snippets of content. This is not a storage/persistence concern.

4. **Content Script Communication** — Messages sent via `chrome.runtime.sendMessage` between content scripts and the service worker contain the raw text being scanned. This is in-memory only and does not persist.

5. **Browser Crash Dumps** — If Chrome crashes after a scan but before cleanup, the raw text could exist in memory dumps. This is an OS-level concern, not an application concern.

---

## Final Verdict

### Controlled Beta Ready: **YES** ✅

All three P0 privacy bugs are fixed and verified:
- ✅ Raw clean prompts are NOT stored in extension storage by default
- ✅ Raw clean prompts are NOT sent to backend by default
- ✅ Raw fingerprint-matched confidential text is NOT sent to backend

### Paid Pilot Ready: **YES** ✅

- Privacy infrastructure is defense-in-depth (client-side + server-side validation)
- Comprehensive test suite (120 extension tests, 626 total) passes
- SIEM/webhook payloads are privacy-sanitized
- Backend rejects disallowed raw content fields
- Full live browser retest checklist available

### Production GA Ready: **NO** ❌

The following would need to be addressed before general availability:
- Admin UI toggle for full prompt logging mode
- DB-level encryption for stored redacted previews
- Retention policy enforcement for audit logs
- SOC2-type audit of data flows
- Chrome Web Store privacy policy alignment review

---

## Appendix: Key Design Decisions

### Why a marker (`[CLEAN_PROMPT_NOT_STORED]`) instead of returning truncated text?

For clean prompts, returning even truncated text is a privacy risk because:
- The first N characters could contain identifying information
- Truncated text could be reconstructed via context
- It violates the principle of storing only what's necessary

### Why defense-in-depth (client + server sanitization)?

- The client runs in an untrusted environment (browser extension)
- A compromised extension could bypass client-side sanitization
- Server-side validation ensures privacy guarantees hold even with a malicious/buggy extension

### Why is fingerprint evidence metadata-only?

- Fingerprint data is the most sensitive category (company confidential documents)
- The purpose of fingerprint matching is to detect similarity, not to transmit the matched content
- Hash-based matching inherently provides privacy — there's no need to send actual matched text
- The similarity score is sufficient for admin investigation and policy enforcement
