# Chrome Web Store — Privacy Disclosure

**Extension:** Soter Enterprise AI Control Plane
**Version:** 0.1.2
**Publisher:** SoterAI
**Privacy policy URL:** https://soterai.in/privacy
**Last updated:** 2026-07-14

This disclosure maps to the Chrome Web Store "Privacy practices" tab
(single purpose, permission justifications, data usage, and the data-use
certifications).

## 1. Single purpose

SoterAI Guard helps users detect AI security risks in supported AI tools by scanning
prompts and AI responses for prompt injection, jailbreak attempts, secrets, PII, and
unsafe instructions.

## 2. What data is processed

| Data | Where it is processed | Leaves the browser? |
|---|---|---|
| Prompt text you type into a supported AI tool | **Locally, in the browser** (content script) | No — never sent as raw text |
| AI response text (only if org enables response scanning) | **Locally, in the browser** | No — never sent as raw text |
| Copied/pasted text on supported AI tabs (data lineage) | **Locally, in the browser** | No — only a SHA-256 hash + redacted preview |
| Uploaded file contents on supported AI tabs | **Locally, in the browser** | No — only file-name hash, size, type, detected data-type labels |
| Organization ID, employee ID/email, department, role | Read from managed storage / enrollment | Sent to the org's own Soter API for attribution |
| Device enrollment token | Stored in `chrome.storage` | Sent only as the `x-soter-extension-token` request header to the org API |

## 3. What is sent to the SoterAI API

Only **privacy-safe metadata**, over **HTTPS only**, to the org-configured base URL
(default `https://soterai.in`): rule/detection IDs, risk score, action taken, detected
data-type labels, redacted previews (raw sensitive tokens stripped before any network
call), SHA-256 hashes for fingerprint/lineage matching, and the origin (scheme+host)
of the AI destination — never full URLs with query strings.

Raw prompts, raw responses, raw file contents, and raw copied text are **never** sent.

## 4. Chrome Web Store data-use certifications

- **We do NOT sell or transfer user data to third parties** (outside approved use cases). Metadata goes only to the customer's own Soter API instance.
- **We do NOT use or transfer user data for purposes unrelated to the item's single purpose.**
- **We do NOT use or transfer user data to determine creditworthiness or for lending.**

## 5. Data handling guarantees

- **HTTPS only.** All network calls target `https://` endpoints; the store build contains no `http://` host permission (verified by `validate-store-manifest.mjs`).
- **No sale of data. No advertising use. No general browsing-history tracking** — the extension has no `history`, `tabs`, `webNavigation`, or `<all_urls>` access.
- **No remote code** — no downloaded or `eval`'d JavaScript; all `innerHTML` writes are escaped via `escapeHtml`.
- **No third-party analytics or trackers** in the extension.

## 6. Token storage

The device/enrollment token is stored in `chrome.storage`, scoped to the extension,
transmitted only as the `x-soter-extension-token` header to the org API, and is
**never** written to `console`, page DOM, or any log.

## 7. Disable / remove / deletion

- Disable: `chrome://extensions` → toggle off **Soter Enterprise AI Control Plane**.
- Remove: `chrome://extensions` → **Remove**. On removal Chrome deletes all locally cached policy/enrollment data in `chrome.storage`.
- Deletion request: email **security@soterai.in**; org-side metadata is deleted from the customer's dashboard on request.

## 8. Contact

- Privacy / security: security@soterai.in
- Support: support@soterai.in
