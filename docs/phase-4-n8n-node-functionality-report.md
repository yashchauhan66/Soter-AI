# Phase 4 n8n Node Functionality Report

## Source Inspected

- `packages/integrations/n8n/nodes/SoterGuard.node.ts`
- `packages/integrations/n8n/credentials/SoterApi.credentials.ts`
- Generated dist files after build.

## Operations Verified In Node Definition

| Operation | Value | Status |
| --- | --- | --- |
| Analyze Text | `analyzeText` | Added and verified |
| Guard Input | `inputGuard` | Verified |
| Guard Output | `outputGuard` | Verified |
| Redact Secrets or PII | `piiRedactor` | Verified |
| Get RAG Risk Summary | `ragScanner` | Verified |

## Parameter Review

- Required text fields are visible for their operations.
- Project ID can be set per node or inherited from credentials.
- Metadata JSON is optional and now fails clearly when invalid.
- Guard Input and Guard Output support `BLOCK`, `REDACT`, `WARN`, and `CONTINUE`.
- RAG summary requires Document ID and Document Source.

## Runtime Hardening Added

- 20 second HTTP timeout.
- Clear authentication errors for 401/403.
- Clear rate-limit error for 429.
- Clear payload-size error for 413.
- Clear upstream timeout error for 408/504.
- Network failure message avoids leaking credential details.
- API error messages redact `sk-*`, `sk_*`, and `x-api-key` values.
- Empty text validation.
- 200,000 character per-item text limit.
- RAG Document ID validation.

## Credentials

- Credential type: `SoterAI API`.
- API key field is password-masked.
- Base URL default: `https://soterai.in`.
- Optional Project ID field.
- Credential test sends a safe connection-test message with metadata.

## Local Proof

- `node -e "const {SoterGuard}=require('./dist/nodes/SoterGuard.node.js'); ..."` loaded the node and credential class.
- Output operations: `analyzeText,inputGuard,outputGuard,piiRedactor,ragScanner`.
- `npm run lint`: PASS.
- `npm run build`: PASS.

## Runtime Proof Not Completed

Live execution inside n8n is blocked because no local n8n host, Docker daemon, or n8n CLI was available.
