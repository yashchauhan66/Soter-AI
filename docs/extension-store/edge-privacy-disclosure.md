# Edge Add-ons — Privacy Disclosure

**Extension:** Soter Enterprise AI Control Plane
**Version:** 0.1.2
**Publisher:** SoterAI
**Privacy policy URL:** https://soterai.in/privacy
**Last updated:** 2026-07-13

This disclosure maps directly to the Microsoft Edge Add-ons "Privacy" and
"Data collection and usage" certification requirements.

## 1. What data is processed

| Data | Where it is processed | Leaves the browser? |
|---|---|---|
| Prompt text you type into a supported AI tool | **Locally, in the browser** (content script) | No — never sent as raw text |
| AI response text (only if org enables response scanning) | **Locally, in the browser** | No — never sent as raw text |
| Copied/pasted text on supported AI tabs (data lineage) | **Locally, in the browser** | No — only a SHA-256 hash + redacted preview |
| Uploaded file contents on supported AI tabs | **Locally, in the browser** | No — only file-name hash, size, type, and detected data-type labels |
| Organization ID, employee ID/email, department, role | Read from managed storage / enrollment | Sent to the org's own Soter API for attribution |
| Device enrollment token | Stored in `chrome.storage` | Sent only as the `x-soter-extension-token` request header to the org API |

## 2. Why it is processed

The single purpose of the extension is to **detect AI security risks — prompt
injection, jailbreaks, secrets, PII, and unsafe instructions — in prompts and AI
responses on supported AI tools.** All detection runs locally so the user is warned
*before* sensitive data is submitted. Metadata (rule IDs, risk scores, redacted
previews, hashes) is reported to the organization's own admin dashboard so security
teams can see policy violations — this is the core enterprise DLP function.

## 3. When prompts/responses are scanned

- Prompts are scanned **on submit / paste / file-attach** on the supported AI hosts
  listed in the manifest, and only there.
- Responses are scanned **only if** an enterprise admin explicitly enables response
  scanning for a specific destination. Otherwise responses are never inspected.
- No scanning occurs on any site outside the declared `host_permissions`.

## 4. What is sent to the SoterAI API

Only **privacy-safe metadata**, over **HTTPS only**, to the org-configured base URL
(default `https://soterai.in`):

- Rule/detection IDs, risk score, action taken, detected data-type labels
- Redacted previews (raw sensitive tokens stripped by
  `assertNoRawSensitiveData` / `createPrivacySafePreview` before any network call)
- SHA-256 hashes for fingerprint/lineage matching
- Origin (scheme+host) of the AI destination — never full URLs with query strings

Raw prompts, raw responses, raw file contents, and raw copied text are **never** sent.

## 5. Data handling guarantees

- **HTTPS only.** All network calls target `https://` endpoints; the store build
  contains no `http://` host permission (verified by `validate-store-manifest.mjs`).
- **No sale of data.** User data is never sold.
- **No advertising use.** Data is never used for advertising or ad targeting.
- **No general browsing-history tracking.** The extension has no `history`, `tabs`,
  `webNavigation`, or `<all_urls>` access. It cannot observe pages outside the
  declared supported AI hosts.
- **No third-party sharing.** Metadata goes only to the customer's own Soter API
  instance; there are no third-party analytics or trackers in the extension.

## 6. How the API / device token is stored

- The device/enrollment token is stored in `chrome.storage` (local/managed), scoped
  to the extension. It is transmitted only as the `x-soter-extension-token` header to
  the org API and is **never** written to `console`, page DOM, or any log
  (verified by the code-smell scan in `validate-store-manifest.mjs`).

## 7. How a user can disable / remove the extension

- Disable: `edge://extensions` → toggle off **Soter Enterprise AI Control Plane**.
- Remove: `edge://extensions` → **Remove**, or right-click the toolbar icon → **Remove from Microsoft Edge**.
- On removal, all locally cached policy and enrollment data in `chrome.storage` is
  deleted by the browser. No data persists outside the browser except metadata the
  organization already recorded in its own dashboard.

## 8. Contact

- Privacy / security: security@soterai.in
- Support: support@soterai.in
