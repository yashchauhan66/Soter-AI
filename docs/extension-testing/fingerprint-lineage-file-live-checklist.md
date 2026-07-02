# Fingerprint / Lineage / File-Scan — Live Browser E2E Checklist

> **Status: NOT YET EXECUTED.** This is a manual checklist for a human tester with a
> running Soter backend, a seeded organization, and the packaged extension
> (`apps/extension/dist/soter-extension-v0.1.0.zip`). Do **not** mark any item passed
> unless you actually performed it in a real browser. Record the date, tester, build
> hash, and observed result next to each item.

## Preconditions

- [ ] Backend running (`npm run build && npm start`) with a reachable Postgres database.
- [ ] At least one organization + admin user seeded.
- [ ] Extension loaded unpacked in Chrome (`chrome://extensions` → Load unpacked → `apps/extension/dist/extension`).
- [ ] Extension enrolled (managed config or enrollment code) and heartbeat visible in admin.
- [ ] Policy sync succeeded (fingerprint bundle + source apps fetched).

---

## 1. File Content Scanner

- [ ] Open ChatGPT (`https://chatgpt.com`).
- [ ] Upload a fake `.env` file containing `API_KEY=sk-test-1234567890abcdef`.
  - [ ] File input is **cleared** (attachment does not remain).
  - [ ] Blocking overlay is shown.
  - [ ] A file scan event appears in `/admin/file-scan-events` with action `block`.
  - [ ] The event stores **fileNameHash** (not the filename) and a **redacted preview** (no raw key).
- [ ] Upload a clean `.txt` file ("hello world").
  - [ ] Upload is **allowed** (no overlay, input retained).
  - [ ] Event (if logged) shows action `allow`, no findings.
- [ ] Upload a fake `.csv` with columns of emails and phone numbers.
  - [ ] Detected data types include email/phone.
  - [ ] Action is `require_approval` (customer data) and input is cleared.
  - [ ] Admin event shows redacted preview only.
- [ ] Upload a `.pdf` / `.docx`.
  - [ ] Handled as **metadata-only** (supported=false, no fake content parsing claimed).

## 2. Fingerprint Vault

- [ ] In `/admin/fingerprint-vault`, create a fingerprint set from fake confidential text.
  - [ ] Set is listed with category / sensitivity / action / hash count.
  - [ ] No raw text is visible in the DB row (only hashes + counts).
- [ ] In Claude (`https://claude.ai`), paste text that is similar to the confidential source.
  - [ ] A `company_fingerprint_match` is detected locally.
  - [ ] The configured action (e.g. `block`) is enforced and overrides weaker policy.
  - [ ] A match event appears in admin with **redacted preview only**.
- [ ] Disable the fingerprint set, re-sync policy, paste the same text again.
  - [ ] No match is produced (disabled sets are excluded from the bundle).

## 3. Data Source Lineage

- [ ] In `/admin` configure GitHub (`github.com`) or Google Docs (`docs.google.com`) as a source app.
- [ ] Re-sync policy so the extension fetches source apps.
- [ ] Visit the source app, select/copy some fake confidential content.
  - [ ] Local lineage context is created (verify via extension storage / debug log).
  - [ ] Raw copied text is **not** stored — only hashes + redacted preview.
  - [ ] Source URL is stored as a hash (query string dropped).
- [ ] Visit an **unrelated** site (e.g. a news site), select text.
  - [ ] No lineage context is created (unrelated browsing is not monitored).
- [ ] Paste the copied content into ChatGPT/Claude.
  - [ ] A lineage event source → destination appears in `/admin/data-lineage`.
  - [ ] Event shows source app, destination AI, data types, action.
- [ ] Wait > 15 minutes (or fast-forward) and paste again.
  - [ ] Lineage context has **expired** and is not attached.

## 4. RBAC / Tenant Isolation (manual)

- [ ] A non-admin user cannot open `/admin/*` AI-data-security pages.
- [ ] A read-only user cannot create/delete fingerprint sets or source apps.
- [ ] Events for Org A are never visible to an admin of Org B.

---

**Tester:** ______________  **Date:** ______________  **Build:** ______________

**Overall live E2E result:** ☐ Pass ☐ Fail ☐ Partial — notes:
