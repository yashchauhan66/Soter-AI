# Reviewer Notes for Store Submission (Microsoft Edge Add-ons — Resubmission)

Dear Reviewer,

**Resubmission note (policy 1.3.1):** In the previous review you saw
`Error message: Invalid origin.` when opening the extension. Root cause and fix
are described below, and a **working test account** is provided so the flow now
completes end-to-end.

---

## 1. Why you saw "Invalid origin." (now fixed)

The extension talks to our control-plane API at `https://soterai.in` over
`/api/extension/*`. Those endpoints authenticate with a per-device token header
(`x-soter-extension-token`) or an org API key — **not** a browser session cookie.

Because they do not use cookies, they are not CSRF-sensitive, but our server-side
CSRF guard was still enforcing a same-site `Origin` check on them. A browser
extension's requests carry an `Origin` of `chrome-extension://<id>` (never the web
origin), so the guard returned **403 "Invalid origin."** before enrollment could run.

**Fix:** `/api/extension/` is now exempt from the session-cookie CSRF origin check
(same as our other token-authenticated API routes, e.g. `/api/guard/`), with an
automated regression test. Session-cookie routes (dashboard, account, admin) remain
fully protected by the origin check. No security boundary was relaxed for any
cookie-authenticated route.

## 2. App purpose

Soter Enterprise AI Control Plane is an enterprise DLP / AI-governance extension
deployed to employees (via MDM or self-service). It protects sensitive corporate
data from being inadvertently leaked to public AI tools (ChatGPT, Claude, Gemini,
etc.) and applies the organization's policy on supported AI sites.

## 3. Working test account (please use these)

**API Base URL (production):** `https://soterai.in`

**Enrollment code (review-only, single-org):**
`SOTER-REVIEW-ENROLL-CODE-PLACEHOLDER`

> Action required before resubmit: generate a real, non-expiring, review-scoped
> enrollment code in the Soter Admin dashboard (**Admin → Extension → Enrollment
> tokens → New**) for a dedicated review organization, then replace the placeholder
> above. See `docs/extension-testing/manual-enrollment-guide.md`.

### Enroll steps for the reviewer
1. Install the extension and click its toolbar icon (popup opens).
2. In **API Base URL**, enter `https://soterai.in`.
3. In **Enrollment Code**, paste the code above and click **Connect / Enroll**.
4. The popup should show **Enrolled** and begin syncing policy. Navigate to
   https://chatgpt.com (a declared host) and type a prompt containing a test secret
   (e.g. an AWS key pattern) to see a local block/warn verdict.

## 4. Permission explanations

- **Declared host permissions:** only the supported AI tools, browser-coding
  environments, and the SoterAI control-plane host listed in the manifest. No broad
  all-site host access is requested.
- **storage:** stores the local DLP policy, thresholds, and enrollment state.
- **contextMenus / sidePanel / alarms:** context menu for on-demand scan, the policy
  side panel, and the periodic policy-sync/heartbeat alarm.
- **Copy/paste handling:** performed by content scripts on declared hosts only; no
  browser clipboard-API permission is requested.

## 5. Privacy and data handling

- Prompts are evaluated **locally** in the browser.
- Raw prompts, files, or copied text are **never** sent to our servers.
- Only redacted previews, hashes, and metadata are sent to the admin's isolated
  tenant dashboard.

Thank you,
The Soter Security Team
