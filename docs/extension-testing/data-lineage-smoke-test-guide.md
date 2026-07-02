# Data Lineage Smoke Test Guide

Date: 2026-07-01

Use only fake text.

## Goal

Verify source-to-destination lineage when a user copies text from a configured source app/page and pastes it into an AI destination.

## Setup

1. Start backend.
2. Sign in:

```text
http://localhost:3000/signin
```

3. Open lineage events:

```text
http://localhost:3000/admin/data-lineage
```

4. Configure a source app if the UI/API is enabled:

```text
GET/POST /api/admin/source-apps
```

Suggested local test source:

```text
Name: Local Manual Source
Domain pattern: localhost
Category: local_test
Enabled: true
```

5. Open the local mock page:

```text
http://localhost:3000/test-ai-page
```

Or use an approved source app such as GitHub, Google Docs, or Notion if your organization has explicitly authorized that test.

## Test Steps

1. Open the configured source app/page.
2. Select and copy fake text:

```text
Customer name: Test User
Email: test.user@example.com
Phone: 9876543210
Issue: Payment failed for invoice INV-12345
```

3. Open ChatGPT or Claude.
4. Paste the copied text into the prompt box.
5. Submit only if policy allows it.
6. Refresh:

```text
http://localhost:3000/admin/data-lineage
```

## Expected Results

* source lineage context created
* source URL is hashed/redacted
* raw copied text not stored
* lineage event shows source to destination
* lineage context expires after 15 minutes

## If Source-App Content Script Is Not Fully Wired

Mark the test as FAIL or PARTIAL and document exactly what is missing:

* no source app config UI
* source app API fails
* source copy listener not injected
* destination paste does not attach lineage context
* admin data lineage event not created
* raw text appears in backend event

## Pass/Fail Table

| Check | Result | Notes |
| --- | --- | --- |
| source app configured | PASS/FAIL/PARTIAL | |
| source copy detected | PASS/FAIL | |
| destination paste detected | PASS/FAIL | |
| lineage context created | PASS/FAIL | |
| source URL hashed/redacted | PASS/FAIL | |
| raw copied text not stored | PASS/FAIL | |
| lineage event shows source to destination | PASS/FAIL | |
| lineage context expires after 15 minutes | PASS/FAIL | |
| final pass/fail | PASS/FAIL | |
