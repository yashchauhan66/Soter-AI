# Final Manual Publish Readiness Report

Date: 2026-07-01
Tester: Codex autonomous QA run on local Windows machine
Build ZIP: `apps/extension/dist/soter-extension-v0.1.0.zip`
ZIP SHA-256: `2D40B2E92ED14D8F454DD3A2FD3F659E15FE85A74F6C679C55EA4B715EB53DBA`
Backend URL: `http://localhost:3000`
Browser versions: Chrome `147.0.7727.57`; Edge `150.0.4078.42`; Playwright Chromium version recorded in `docs/extension-testing/evidence/live-browser-2026-07-01/results.json`

## Pre-flight Commands

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npm run typecheck:extension` | PASS | Extension TypeScript check passed. |
| `npm run validate:extension-permissions` | PASS | Manifest permissions and store docs matched. |
| `npm run test:extension` | PASS | 120 tests passed, 0 failed. Includes privacy, file scanner, fingerprint, and lineage tests. |
| `npm run build:extension` | PASS | First sandboxed run failed with Windows access denied while resolving parent dependency paths; elevated rerun passed. |
| `npm run package` | PASS | First sandboxed run failed for same dependency-resolution access issue; elevated rerun passed and created ZIP. |
| `npm run typecheck` | PASS | Full repo TypeScript check passed. |
| `npm test` | PASS | 626 tests passed, 0 failed. |

## Package Structure

| Check | Result | Notes |
| ----- | ------ | ----- |
| Extension folder exists | PASS | `apps/extension/dist/extension` exists. |
| `manifest.json` exists | PASS | Present in unpacked extension and ZIP root. |
| Service worker path exists | PASS | Manifest points to `background/service-worker.js`; file exists. |
| Content script paths exist | PASS | `content/index.js` and `content/source-lineage-entry.js` exist. |
| Popup HTML path exists | PASS | Manifest points to `popup/index.html`; file exists. |
| Side panel HTML path exists | PASS | Manifest points to `sidepanel/index.html`; file exists. |
| Icon paths exist | PASS | 16/32/48/128/192/512 PNG icons exist. |
| ZIP root contains manifest | PASS | `tar -tf` confirmed root-level `manifest.json`. |
| Actual JS names | PASS | Build outputs `popup/index.js` and `sidepanel/index.js`; manifest points to valid HTML. |

## Backend

| Check | Result | Notes |
| ----- | ------ | ----- |
| Docker compose | FAIL | Elevated `docker compose up -d` failed because `soter:latest` is not available/pullable without registry login. |
| Postgres available | PASS | Prisma connected to PostgreSQL database `soter` at `localhost:5432`. |
| Prisma generate | PASS | `npx prisma generate` passed. |
| Prisma migrations | PASS | `npx prisma migrate deploy` applied pending migrations successfully. |
| Seed | PASS | `npm run db:seed` passed with documented synthetic demo admin from seed script. |
| Next dev backend | PASS | `npm run dev` started; `/`, `/signin`, and `/test-ai-page` returned HTTP 200 after initial compile. |
| Admin login available | PARTIAL | Seeded demo admin exists. Browser login/admin workflows were not completed against the real backend. |

## Chrome Load Test

| Check | Result | Notes |
| ----- | ------ | ----- |
| Playwright Chromium load | PASS | Live runner loaded service worker, extension card, popup, and side panel. Evidence in `docs/extension-testing/evidence/live-browser-2026-07-01/`. |
| Installed Chrome load | FAIL | Real Chrome launched with `--load-extension`, but `chrome://extensions` exposed no Soter card via CDP and Soter popup was not reachable from exposed extension IDs. |
| Popup opens | PASS in Playwright Chromium / FAIL in installed Chrome | Chromium popup screenshot captured; real Chrome popup not verified. |
| Side panel opens | PASS in Playwright Chromium / FAIL in installed Chrome | Chromium side panel screenshot captured; real Chrome side panel not verified. |
| Service worker clean | PASS in Playwright Chromium | No extension console errors in live runner. |

## Edge Load Test

| Check | Result | Notes |
| ----- | ------ | ----- |
| Installed Edge load | PASS | Edge DevTools showed Soter service worker `background/service-worker.js`. |
| Popup opens | PASS | `edge-real-popup.png` captured. |
| Side panel opens | PASS | `edge-real-sidepanel.png` captured. |
| Extension management UI screenshot | PARTIAL | Screenshot captured, but CDP shadow DOM item extraction returned no item names. |
| Service worker clean | PASS | Soter service worker target visible via Edge remote debugging. |

## Enrollment

| Check | Result | Notes |
| ----- | ------ | ----- |
| Invalid token rejected | PASS | Verified in synthetic Playwright backend. |
| Expired token rejected | PASS | Verified in synthetic Playwright backend. |
| Self-service enrollment | PASS | Synthetic enrollment code enrolled popup successfully. |
| Policy sync | PASS | Popup showed fresh policy version `live-e2e-1`. |
| Heartbeat | PASS | Popup showed recent heartbeat in synthetic runner. |
| Device token hidden | PASS | Popup and side panel did not display synthetic device token. |
| Real backend/admin enrollment | NOT VERIFIED | Real admin UI token creation and real extension enrollment against `localhost:3000` were not completed. |

## Local Mock AI Page

| Check | Result | Notes |
| ----- | ------ | ----- |
| Page reachable | PASS | `http://localhost:3000/test-ai-page` returned HTTP 200. Synthetic local AI page in runner also worked. |
| Clean prompt allowed | PASS | Allowed and replayed once. |
| Fake API key paste detected | PASS | Overlay shown; safe rewrite removed fake key. |
| Fake `.env` submit blocked | PASS | Overlay shown and submit prevented. |
| Small clean prompt under 100 ms | FAIL | Live runner measured 163.6 ms. |
| No extension console errors | PASS | No extension console errors recorded by live runner. |

## External AI Smoke Tests

| Platform | Result | Notes |
| -------- | ------ | ----- |
| ChatGPT | AUTH_BLOCKED / NETWORK_BLOCKED | Navigation failed with `net::ERR_NETWORK_ACCESS_DENIED`; no live prompt test performed. |
| Claude | AUTH_BLOCKED / NETWORK_BLOCKED | Navigation failed with `net::ERR_NETWORK_ACCESS_DENIED`; no live prompt test performed. |
| Gemini | AUTH_BLOCKED / NETWORK_BLOCKED | Navigation failed with `net::ERR_NETWORK_ACCESS_DENIED`; no live prompt test performed. |
| Perplexity | AUTH_BLOCKED / NETWORK_BLOCKED | Navigation failed with `net::ERR_NETWORK_ACCESS_DENIED`; no live prompt test performed. |

## File Upload Scanner

| File | Result | Notes |
| ---- | ------ | ----- |
| `fake.env` | PASS | Blocked/cleared with overlay. |
| `fake-customers.csv` | PASS | Overlay shown for customer data. |
| `fake-code.js` | PASS | Blocked/cleared with overlay. |
| `clean.txt` | PASS | Allowed. |

## Fingerprint Vault

| Check | Result | Notes |
| ----- | ------ | ----- |
| Synthetic fingerprint bundle | PASS | Runner served hashed synthetic bundle. |
| Exact match | PASS | Exact synthetic confidential text blocked. |
| Fuzzy match | PASS | Modified synthetic text still matched. |
| Raw fingerprint text not sent | PASS | Fingerprint/audit event inspection did not contain raw reference text. |
| Real admin fingerprint UI | NOT VERIFIED | `http://localhost:3000/admin/fingerprint-vault` was not completed with real login/admin flow. |

## Data Lineage

| Check | Result | Notes |
| ----- | ------ | ----- |
| Source listener activates | PASS | Synthetic source page set lineage listener state. |
| Source context captured | PASS | Context included source hash, selected text hash, categories, and TTL. |
| Lineage event created | PASS | Source-to-destination lineage event created. |
| Source URL hashed/redacted | PASS | `sourceUrlHash` present. |
| TTL | PASS | Context expiration was 15 minutes. |
| Raw copied text not stored | FAIL | Live privacy assertion failed: storage still contained copied lineage phrase context. Treat as P0 privacy blocker until fixed or proven false positive. |

## Privacy Checks

| Check | Result | Notes |
| ----- | ------ | ----- |
| Raw clean prompt not stored | PASS | Extension tests passed; live storage/backend checks passed. |
| Raw API key not stored/sent | PASS | Extension tests passed; live storage/backend checks passed. |
| Raw file content not sent | PASS | Extension tests passed; live backend event check passed. |
| Raw fingerprint text not sent | PASS | Extension tests passed; live fingerprint event check passed. |
| Raw copied text not stored | FAIL | Live storage check failed for lineage copied text context. |
| Unrelated site monitoring inactive | FAIL | Synthetic unrelated localhost page was still marked active because localhost destination scope was broad. |

## Screenshots

| Screenshot | Captured | Path |
| ---------- | -------- | ---- |
| Chromium extension loaded card | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/01-chrome-extensions.png` |
| Popup unenrolled | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/02-popup-unenrolled.png` |
| Popup enrolled | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/03-popup-enrolled.png` |
| Side panel enrolled | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/04-side-panel-enrolled.png` |
| API key overlay | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/05-api-key-paste-overlay.png` |
| `.env` submit block overlay | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/06-env-submit-block.png` |
| Fingerprint exact block | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/07-fingerprint-exact.png` |
| Popup lockdown | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/08-popup-lockdown.png` |
| File scanner overlays | YES | `docs/extension-testing/evidence/live-browser-2026-07-01/file-*.png` |
| Edge popup | YES | `docs/extension-store/screenshots/edge-real-popup.png` |
| Edge side panel | YES | `docs/extension-store/screenshots/edge-real-sidepanel.png` |
| Installed Chrome Soter card | NO | Chrome did not expose Soter card in this run. |
| Admin extension enrollments | NO | Real admin UI not completed. |
| Admin fingerprint vault | NO | Real admin UI not completed. |
| Admin data lineage/file events | NO | Real admin UI not completed. |
| External AI overlays | NO | External navigation was network-blocked. |

## Store Review Risk

`content_scripts.matches` includes `["<all_urls>"]` for `content/source-lineage-entry.js`, and `optional_host_permissions` includes `["*://*/*"]`. `npm run validate:extension-permissions` passed and store docs exist, including `docs/extension-store/permission-justification.md`, but this remains a store-review risk because broad host scope must be clearly justified as source-lineage capture and must be tightly controlled in product behavior. The live run also found an unrelated localhost page marked active, which strengthens this risk.

## Final Verdict

Ready for private/hidden listing: NO

Ready for public listing: NO

Ready for paid pilot: NO

Ready for production GA: NO

Reasons:

* P0 privacy blocker: live lineage storage check failed for copied text context.
* Installed Chrome did not load/verify Soter with the command-line unpacked flow on this machine.
* External AI smoke tests could not run because navigation was network-blocked.
* Real backend/admin enrollment, fingerprint vault, and admin event views were not completed through authenticated UI.
* Public listing screenshots and external-site evidence are incomplete.
* Broad `<all_urls>` lineage content script and optional all-host permission remain store-review sensitive.
