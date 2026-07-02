# File Upload Smoke Test Guide

Date: 2026-07-01

Use files from:

```text
C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\extension-testing\manual-test-data
```

Run this on ChatGPT or Claude if file upload is available to the test account. The local mock page can be used for debugging, but does not replace a real AI-site pass.

Local mock page:

```text
http://localhost:3000/test-ai-page
```

## Steps

1. Start backend at `http://localhost:3000`.
2. Enroll the extension.
3. Open ChatGPT or Claude.
4. Open browser DevTools console.
5. Open admin file scan events:

```text
http://localhost:3000/admin/file-scan-events
```

6. Upload each file below one at a time.
7. Do not send the prompt if the extension blocks the upload.
8. Refresh the admin event page after each test.

## Files And Expected Results

| File | Expected behavior |
| --- | --- |
| `fake.env` | Blocked. File input cleared if policy blocks. Raw file content not sent to backend. File scan event created. |
| `fake-customers.csv` | Customer data detected. Redact/block/approval based on policy. Raw file content not sent to backend. |
| `fake-code.js` | Token detected and blocked or held for approval. Raw token not stored. |
| `clean.txt` | Allowed. No raw clean file content stored by default. |

## Result Table

| File | file selected | content scanned | action | input cleared if blocked | raw file content not in backend | admin event visible | pass/fail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fake.env` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| `fake-customers.csv` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| `fake-code.js` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| `clean.txt` | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL | PASS/FAIL |

## Evidence To Capture

* Screenshot of file chosen before action.
* Screenshot of Soter overlay/action.
* Screenshot of admin file event with redacted metadata.
* Browser console errors, if any.
