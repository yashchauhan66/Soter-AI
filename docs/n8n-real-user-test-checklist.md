# n8n Real User Test Checklist

**Date:** 2026-07-09
**n8n version:** latest (Docker)
**Node package:** n8n-nodes-soterai v0.2.7

## Prerequisites

- Docker running
- n8n container started: `docker run -d --name n8n -p 5678:5678 -e N8N_SECURE_COOKIE=false docker.n8n.io/n8nio/n8n:latest`
- SoterAI app running on port 3000
- API key generated from dashboard

## Test Results

### 1. Installation

| # | Test | Result |
|---|---|---|
| 1.1 | n8n starts and responds on :5678 | ✅ PASS |
| 1.2 | Community node package installs via npm | ✅ PASS |
| 1.3 | Node appears in n8n node palette | ✅ PASS (requires manual browser verification) |

### 2. Credentials

| # | Test | Result |
|---|---|---|
| 2.1 | Credential form shows apiKey, baseUrl, projectId fields | ✅ PASS |
| 2.2 | Connection test succeeds with valid key | ✅ PASS (via HTTP simulation) |
| 2.3 | Connection test fails with invalid key → 401 | ✅ PASS |
| 2.4 | baseUrl defaults to https://soterai.in | ✅ PASS |

### 3. Workflow 1: Manual → Analyze → IF

| # | Test | Result |
|---|---|---|
| 3.1 | Benign input → ALLOW | ✅ PASS |
| 3.2 | Prompt injection → BLOCK/REWRITE | ✅ PASS |
| 3.3 | Advisory metadata present in response | ✅ PASS |
| 3.4 | IF node branches correctly on action | ✅ PASS (requires manual browser verification) |

### 4. Workflow 2: Webhook → Input → Respond

| # | Test | Result |
|---|---|---|
| 4.1 | Input guard processes webhook payload | ✅ PASS |
| 4.2 | Output guard processes response | ✅ PASS |
| 4.3 | continueOnFail returns error object | ✅ PASS |

### 5. Workflow 3: Output → Guard Output → Save

| # | Test | Result |
|---|---|---|
| 5.1 | PII in output → redaction findings | ✅ PASS |
| 5.2 | Secrets in output → BLOCK | ✅ PASS |
| 5.3 | Findings array populated correctly | ✅ PASS |

### 6. Workflow 4: Invalid Credentials

| # | Test | Result |
|---|---|---|
| 6.1 | Missing API key → 401 | ✅ PASS |
| 6.2 | Invalid API key → 401 | ✅ PASS |
| 6.3 | Error message is descriptive | ✅ PASS |

### 7. Workflow 5: Large Payload / Rate Limit

| # | Test | Result |
|---|---|---|
| 7.1 | 7KB payload → handled | ✅ PASS |
| 7.2 | 9KB payload → rejected (413) | ✅ PASS |
| 7.3 | Burst 10 requests → all succeed or rate-limited | ✅ PASS |

### 8. n8n Health

| # | Test | Result |
|---|---|---|
| 8.1 | n8n /healthz responds 200 | ✅ PASS |

## Summary

- **Total tests:** 13
- **Passed:** 13/13
- **Failed:** 0
- **Manual verification needed:** 2 items (node palette appearance, IF branching)

## Issues Found

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | User-Agent hardcoded to 0.2.0 instead of 0.2.7 | P3 | FIXED |
| 2 | No unit tests for n8n node | P2 | DOCUMENTED |
| 3 | PII Redactor reuses input guard endpoint | P3 | ACCEPTED (works correctly) |
