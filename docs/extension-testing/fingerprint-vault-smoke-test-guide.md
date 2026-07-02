# Fingerprint Vault Smoke Test Guide

Date: 2026-07-01

Use only the synthetic Dragonfly text from this guide.

## Setup

1. Start backend.
2. Sign in:

```text
http://localhost:3000/signin
```

3. Open:

```text
http://localhost:3000/admin/fingerprint-vault
```

4. Create or register a fingerprint set. If the current UI is display-only in your build, use the admin API or seed helper your team uses for fingerprint creation, then return to the UI to verify it appears.

Test fingerprint:

```text
Name: Dragonfly Test Roadmap
Category: product_roadmap
Sensitivity: critical
Action: block or require_approval
Text: Project Dragonfly confidential roadmap launch plan for Q4 beta customers.
```

Expected storage behavior:

* raw fingerprint text is not stored in audit/match events
* fingerprint chunks are hashes
* match events store metadata such as fingerprintSetId, similarity score, category, sensitivity, and action

## Exact Match Test

1. Open Claude or ChatGPT.
2. Paste:

```text
Project Dragonfly confidential roadmap launch plan for Q4 beta customers.
```

3. Try to submit.
4. Expected:
   * exact match detected
   * overlay blocks or requires approval
   * popup/side panel shows fingerprint finding
   * admin event is created without raw text

## Fuzzy Match Test

1. Open Claude or ChatGPT.
2. Paste:

```text
Project Dragonfly private Q4 roadmap plan for beta customers.
```

3. Try to submit.
4. Expected:
   * fuzzy match detected if threshold is met
   * similarity score visible in event metadata or debug details
   * action follows the fingerprint set policy
   * raw text is not stored

## Admin Verification

Open:

```text
http://localhost:3000/admin/fingerprint-vault
http://localhost:3000/admin/extension-events
```

Check backend records and UI do not expose the raw synthetic text except where you intentionally typed it in the setup form.

## Pass/Fail Table

| Check | Result | Notes |
| --- | --- | --- |
| fingerprint set created | PASS/FAIL | |
| exact match detected | PASS/FAIL | |
| fuzzy match detected if threshold met | PASS/FAIL | |
| correct action applied | PASS/FAIL | |
| raw fingerprint text not stored in match/audit/scan events | PASS/FAIL | |
| only fingerprintSetId/similarity/category/sensitivity stored | PASS/FAIL | |
| admin event visible | PASS/FAIL | |
| final pass/fail | PASS/FAIL | |
