# Soter Extension Live Browser E2E Sign-Off Report

**Test date:** July 1, 2026  
**Release under test:** Soter Enterprise AI Control Plane `0.1.0`  
**Sign-off role:** Browser extension QA, enterprise security QA, release engineering  
**Data rule:** Synthetic data only. No real secrets, company files, customer records, or employee records were used.

## 1. Test Environment

| Item | Value |
|---|---|
| OS | Windows |
| Installed Google Chrome | `147.0.7727.57` |
| Installed Microsoft Edge | `150.0.4078.42` |
| Automated live browser | Playwright Chromium `149.0.7827.55` |
| Playwright | `1.61.0` |
| Local test destination | `http://localhost:41739/ai` |
| Backend | In-memory synthetic control-plane API; request bodies retained only for this QA evidence run |
| Evidence | `docs/extension-testing/evidence/live-browser-2026-07-01/` |

Google Chrome 147 was launched, but current Chrome/Edge releases do not support Playwright's command-line unpacked-extension loading path. The functional installed-extension run therefore used Playwright Chromium, the supported extension automation channel. A manual toolbar click, native Chrome directory picker, and native side-panel container were not validated.

## 2. Extension Build and Package

| Artifact | Result |
|---|---|
| Unpacked folder | `apps/extension/dist/extension/` |
| ZIP | `apps/extension/dist/soter-extension-v0.1.0.zip` |
| ZIP size | 55,717 bytes |
| ZIP SHA-256 | `E1F213557D4EB6978A60E55C79EA6BB2DFCBC3915B5ADF078BCF385EF3DB33B6` |
| Manifest SHA-256 | `270A38AF6ABA41226F95FD9C71D56B7A6DA5C728407305C8179416CEE3BA08C9` |
| `npm run typecheck:extension` | PASS |
| `npm run package` | PASS |
| `npm run validate:extension-permissions` | PASS |
| `npm run test:extension` | 111 pass, 0 fail |

Three release-blocking packaging defects were found and corrected during the live load attempt:

1. The manifest contained an invalid non-public-key `key`, preventing unpacked installation.
2. Vite emitted ES module imports in classic manifest content scripts.
3. Separately bundled classic scripts shared top-level identifiers and collided at runtime.

The final package removes the invalid key and emits both content scripts as self-contained IIFEs. The corrected extension loaded with ID `ilhlhkkciekmbdnpfnjlpfidnmigblom`.

## 3. Platforms Tested

| Platform | Coverage | Result |
|---|---|---|
| Synthetic localhost AI | Prompt, paste, submit, overlay, files, fingerprints, lineage, lockdown, privacy, performance | EXECUTED |
| ChatGPT | Reachability, content-script activation, prompt element presence | PARTIAL PASS |
| Claude | Reachability and content-script activation; sign-in page had no prompt | BLOCKED |
| Gemini | Reachability and content-script activation; no usable prompt without account | BLOCKED |
| Perplexity | Reachable with prompt element; Cloudflare/CORS state prevented active marker | BLOCKED |
| Poe | Not executed | NOT TESTED |
| Replit/v0/Bolt/StackBlitz | Not executed live | NOT TESTED |
| Edge | Installed version recorded; extension not loaded | NOT TESTED |

No external AI prompt was submitted. ChatGPT produced Cloudflare/application errors, while Claude and Gemini required account state. These are not marked as functional passes.

## 4. Tests Passed

The machine run recorded **51 passing checks**. Material passes include:

- Extension service worker loaded and the extension appeared on `chrome://extensions`.
- Icon assets, popup, side-panel document, and unenrolled UI rendered.
- Invalid and expired synthetic enrollment codes were rejected.
- Valid self-service enrollment, policy sync, and heartbeat completed.
- Device token was absent from popup and side-panel text.
- Localhost destination, prompt field, paste listener, and submit interception activated.
- Clean prompt was allowed once; fake API key and `.env` submission were blocked.
- Safe replacement removed the synthetic API key.
- `.env` and fake GitHub-token files were cleared; CSV produced a policy overlay; clean text was allowed.
- Exact and fuzzy company fingerprint matches were detected and blocked.
- Synthetic PAN and IFSC triggered `require_approval`; an approval request was created.
- Source lineage listener activated, hashes were stored, TTL was 15 minutes, and a lineage event was emitted.
- Emergency lockdown appeared in the popup and blocked a clean local-AI prompt.
- Raw fake API key and fake GitHub token were absent from recorded backend events.
- Response scanning disabled produced no response audit event.
- No extension-origin console error remained after the build fixes.

## 5. Tests Failed or Blocked

| Severity | Finding | Evidence |
|---|---|---|
| **P0** | Clean prompt is persisted in `chrome.storage.local` as `latestScan`. | Immediate post-submit storage check failed. |
| **P0** | Clean prompt is sent to `/audit-log` and `/scan` in `redactedPreview`; because there are no findings, the preview equals the raw prompt. | Exact synthetic React question was present in both request bodies. |
| **P0** | Exact confidential fingerprint text is sent to fingerprint, audit, and scan endpoints as `redactedPreview`. | Exact synthetic Project Cedar reference text was present in three event payloads. |
| **P1** | Unrelated localhost page was monitored. | `data-soter-active-domain="true"` appeared on a generic localhost feedback page. |
| **P1** | 10 KB browser round-trip target missed. | 351.9 ms versus target under 300 ms. |
| **P1** | Lineage destination category was `unknown` for the configured local-AI destination. | Captured lineage event payload. |
| Blocked | Claude and Gemini had no usable prompt without account state. | Sign-in/public pages only. |
| Blocked | Perplexity content script did not reach active state under Cloudflare/CORS failures. | Public page errors and `active: false`. |
| Blocked | Full approval lifecycle was not executed. | No real admin session/database for approve-once, reject, or require-redaction. |
| Blocked | Managed enrollment was not executed. | No Chrome GPO/MDM managed storage configured. |

The harness also recorded a conservative failure because lineage storage retained a **redacted preview** containing non-sensitive words from the copied text. The full copied string and email were not stored; hashes plus a redacted preview were stored. This is acceptable only if the product requirement permits redacted previews, as stated in the test charter.

## 6. Console Errors

**Extension-origin console errors:** None in the final run.

**Site-origin errors observed:**

- ChatGPT: Cloudflare/403 and application "Something went wrong" errors.
- Gemini: third-party analytics requests blocked by the site's CSP.
- Perplexity: Cloudflare Access, CORS, 403, and identity-provider errors.

These site errors limited external workflow coverage and are retained in `results.json`.

## 7. Extension Errors

No final service-worker, popup, side-panel, localhost content-script, or lineage-script runtime error was observed after the packaging fixes.

The original artifact was not loadable/usable for content interception. The report and verdict apply to the rebuilt artifact identified by the hashes above.

## 8. File Scanner Result

| File | Live result |
|---|---|
| `fake.env` | PASS: blocked, overlay shown, input cleared |
| `fake-customers.csv` | PASS: sensitive-data overlay shown; file retained under redaction-level action |
| `fake-code.js` | PASS: fake GitHub token blocked, input cleared |
| `clean.txt` | PASS: allowed, no overlay |
| 1 MB clean text | PASS: completed in 567.6 ms without page freeze |

Only supported text/code extraction was tested. PDF, DOCX, XLSX, and PPTX remain metadata-only and were not claimed as parsed.

## 9. Fingerprint Vault Result

Exact and slightly modified synthetic investor-deck text both matched and were blocked with `company_fingerprint_match`.

**Privacy result: FAIL.** The exact reference text was included in backend `redactedPreview` fields. This defeats the intended hashed-reference privacy boundary even though the fingerprint bundle itself used hashes.

No claim is made for semantic embeddings. The live test covered exact chunk and fuzzy shingle matching only.

## 10. Data Lineage Result

Source selection/copy on the synthetic internal page created:

- SHA-256 source URL hash
- SHA-256 selected-text hash
- Redacted preview
- 15-minute expiry
- Source-to-destination lineage event

The full selected text and email were not stored. However, the destination category was incorrectly emitted as `unknown` rather than `local_ai`, and unrelated localhost pages were treated as active AI destinations.

## 11. Emergency Lockdown Result

PASS for the executed local flow:

- Lockdown policy synced.
- Popup displayed the lockdown state.
- A clean local-AI prompt was blocked.
- Policy version changed to the lockdown version.

Unknown external destination handling, source-code approval, and all-file-upload lockdown combinations were not exhaustively executed.

## 12. Approval Workflow Result

PARTIAL:

- India PII produced `require_approval`.
- The overlay displayed the approval action.
- A synthetic approval request was sent and returned `pending`.

Not executed: admin approval UI, approve-once consumption, rejection, redaction-required response, replay prevention, and persisted audit trail against the real database.

## 13. Privacy and Security Result

| Check | Result |
|---|---|
| Device token hidden from popup/side panel | PASS |
| Raw fake API key absent from backend events | PASS |
| Raw fake file token absent from file events | PASS |
| Full copied source text absent from lineage context/event | PASS |
| Source URL hashed and query omitted | PASS |
| Response event absent when response scanning disabled | PASS |
| Raw clean prompt absent from local storage | **FAIL** |
| Raw clean prompt absent from backend events | **FAIL** |
| Raw fingerprint reference absent from backend events | **FAIL** |
| Unrelated website ignored | **FAIL for localhost scope** |

The privacy failures are release blockers because they contradict the requested metadata-only/default-no-raw-content posture.

## 14. Performance Result

| Workload | Result |
|---|---|
| Small clean prompt | 99.3 ms, PASS against under 100 ms |
| 10 KB prompt | 351.9 ms, FAIL against under 300 ms |
| 100 KB prompt | 556.0 ms, no freeze |
| 1 MB clean text file | 567.6 ms, no freeze |
| Duplicate response audits with scanning disabled | None observed |

These measurements include browser messaging and synthetic localhost API round trips, not only detector CPU time.

## 15. Remaining Blockers

1. Stop storing `latestScan` raw text for clean prompts, or store metadata/redacted summaries only.
2. Do not send clean prompt text as `redactedPreview` in audit/scan events when logging mode is `metadata_only`.
3. Never send exact fingerprint-matched reference text; use category, hashes, match score, and a safely generalized preview.
4. Scope localhost monitoring to configured URL patterns/routes instead of every page on the hostname.
5. Emit the configured destination category in lineage events.
6. Bring 10 KB live scan latency below 300 ms or revise the documented target with production measurements.
7. Complete manual Chrome and Edge tests with real unpacked loading, native toolbar popup, and native side panel.
8. Complete authenticated ChatGPT, Claude, Gemini, Perplexity/Poe, and one coding-platform workflow.
9. Complete real admin/database tests for managed enrollment, heartbeat visibility, fingerprint administration, lockdown, and approval lifecycle.

## 16. Final Verdict

| Release gate | Verdict |
|---|---|
| **Controlled beta ready** | **NO** |
| **Paid pilot ready** | **NO** |
| **Production GA ready** | **NO** |

The corrected extension is functionally promising and the local enforcement paths work, but the observed raw clean-prompt and fingerprint-reference transmission are P0 privacy defects. A controlled beta should not ship until those defects are fixed and revalidated. External authenticated workflows and real admin approval lifecycle coverage are also still incomplete.

