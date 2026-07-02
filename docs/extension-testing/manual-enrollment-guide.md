# Manual Enrollment Guide

Date: 2026-07-01

Use fake/demo data only.

## Prerequisites

1. Start the backend using `docs/extension-testing/backend-startup-for-manual-test.md`.
2. Load the extension using `docs/extension-testing/manual-chrome-edge-load-guide.md`.
3. Sign in to the admin dashboard:

```text
http://localhost:3000/signin
```

Demo credentials from `prisma/seed.ts`:

```text
Email: demo@cyberrakshak.dev
Password: demo-cyberrakshak-2026
```

## Create Enrollment Token

1. Open:

```text
http://localhost:3000/admin/extension-enrollments
```

2. Select the demo organization.
3. Create a token for a fake employee:

```text
Employee email: test.user@example.com
Department: QA
Role: Security Tester
Max uses: 1
Expiration: today + 7 days
```

4. Copy the enrollment token immediately. It should be visible only once.
5. Do not paste it into chat, docs, screenshots, or logs.

## Enroll The Extension

1. Click the Soter extension icon.
2. Enter API base URL:

```text
http://localhost:3000
```

3. Enter the enrollment code.
4. Click **Connect** or **Enroll**.
5. Wait for the popup to refresh.

## Expected Enrolled State

The popup or side panel should show:

* enrolled state
* organization
* employee
* department/role
* policy version
* sync status
* heartbeat status

## Negative Token Test

1. Open the extension popup.
2. Enter API base URL:

```text
http://localhost:3000
```

3. Enter:

```text
invalid-token-for-manual-test
```

4. Click **Connect** or **Enroll**.
5. Expected: clear invalid-token error. No enrolled state.

## Admin Verification

Open:

```text
http://localhost:3000/admin/extension-enrollments
http://localhost:3000/admin/extension-health
http://localhost:3000/admin/extension-events
```

Verify:

| Check | Result | Notes |
| --- | --- | --- |
| Enrollment success | PASS/FAIL | |
| Invalid token error | PASS/FAIL | |
| Policy sync success | PASS/FAIL | |
| Heartbeat visible in admin | PASS/FAIL | |
| Raw device token not visible | PASS/FAIL | |

Expected privacy behavior:

* raw enrollment token is shown only once at creation
* backend stores hashed token/credential values
* popup/admin UI must not display raw device token
