# SoterAI Edge Extension — Real User Testing Final Report
**Date:** 2026-08-22  
**Extension:** Soter Enterprise AI Control Plane v0.2.0  
**Edge Add-ons ID:** `lhjiakjcedoeihgddlleibhcoodkjdjn`  
**Browser:** Microsoft Edge 152.0.0.0 (Windows 11)  
**Test Method:** Automated CDP harness against the REAL published store build installed from Edge Add-ons marketplace  
**Total Test Rounds:** 9 (Round 1 through 9b)  
**Total Test Cases:** 68  

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Tests | 68 |
| PASS | 42 (62%) |
| FAIL | 19 (28%) |
| PARTIAL | 4 (6%) |
| SKIP/INFO | 3 (4%) |

**Overall Verdict:** The extension's CORE protection (secret detection, prompt injection blocking, PII detection, overlay rendering, enrollment, policy sync) works correctly in real Edge. However, there are **critical security bypass vectors** and a **privacy violation** (raw text sent to ML endpoint) that must be fixed before enterprise deployment.

---

## ✅ FEATURES THAT WORK CORRECTLY

### 1. Extension Installation & Service Worker (PASS)
- MV3 service worker registers correctly in real Edge
- Extension ID matches the published Add-ons listing
- Alarms (policy-sync + heartbeat) scheduled on install
- declarativeNetRequest API available (SS-9 prerequisite)
- Unknown runtime messages correctly dropped (SS-3 message guard)

### 2. Content Script Activation (PASS)
- Guard activates on chatgpt.com within ~387ms
- Guard activates on claude.ai
- soterai.in (first-party) guarded even before enrollment
- `data-soter-active-domain` attribute correctly set

### 3. Secret Detection & Blocking (PASS)
- AWS access key (`AKIAIOSFODNN7EXAMPLE`) correctly detected
- Verdict: **BLOCK** with overlay shown
- DOM submit gesture actually stopped (page handler never ran)
- Risk score + category surfaced to user (35/100, aws_access_key)
- Overlay preview is REDACTED (no raw secret in panel)
- Verdict panel uses CLOSED shadow root (page script cannot read it)

### 4. India PII Detection (PASS)
- Aadhaar number detected → category: `aadhaar`
- PAN number detected → category: `pan`
- Escalated to **REQUIRE_APPROVAL** under org policy
- Redacted preview shows `[REDACTED_AADHAAR]`

### 5. Prompt Injection Detection (PASS)
- Injection phrasing detected → categories: `prompt_injection`, `prompt_injection_semantic`
- Risk score: 100/100
- Verdict: **BLOCK**

### 6. Benign Prompt Pass-Through (PASS)
- Harmless prompts pass without false positives
- No overlay shown
- Page POST reaches the AI model endpoint

### 7. Paste Scanning (PASS)
- Sensitive text pasted into composer triggers scan
- Overlay appears after paste
- Enter pressed during scan window is blocked (synchronous interceptor)
- Enter pressed after overlay stays blocked
- Typed secret + Enter also intercepted

### 8. AI Response Scanning (PASS)
- Leaking AI response marked with risk banner
- WebSocket-streamed responses scanned (v0.2.0 ws-page-hook)
- Response-type audit events generated
- "Hide sensitive" affordance present on flagged responses

### 9. File Upload Scanning (PASS)
- .txt file containing secrets triggers overlay
- file-scan-event POST sent to control plane
- Upload blocked

### 10. Block Overlay & Remediation (PASS)
- Overlay renders with correct verdict text
- Buttons: Copy, Use Safe Prompt, Dismiss
- "Use safe prompt" replaces input with redacted text + Safe Context Capsule
- Redacted replay reaches AI endpoint (no raw secret)
- Hard-enforcement policy produces locked overlay (no dismiss)

### 11. Network-Layer Deny Window — SS-9 (PASS after fix)
- Session rule installed: blocks POST/PUT/PATCH to destination
- Page fetch during window → `BLOCKED: Failed to fetch`
- TTL expires (~3s) → normal operation resumes
- Does NOT brick the tab

### 12. Enrollment & Policy Sync (PASS)
- Enrollment with code via popup UI works
- Org policy bundle fetched and adopted after enrollment
- Policy version reflected in popup/sidepanel
- Heartbeat reaches control plane
- Sync status shows "fresh"

### 13. Self-Service Trial Mode (PASS)
- "Try free with sample policy" works from popup
- Enrolls as "Soter Trial (Local)" with trial-user
- Policy version trial-1.0.0 applied
- No enrollment code needed

### 14. Popup UI (PASS)
- Renders correctly in real Edge host
- Shows enrollment status, org, employee, policy version
- Shows "What leaves browser" privacy info
- Reflects latest scan decision (live status)
- Sync now button present

### 15. Side Panel (PASS)
- Renders correctly in real Edge host
- Shows enrollment, policy sync, response scanning status
- Shows latest decision/activity
- Emergency mode indicator

### 16. Context Menu (PASS)
- "Scan with Soter" registered at install
- Right-click scan opens side panel with results

### 17. Emergency Lockdown (PASS after fix)
- Lockdown policy adopted correctly
- Blocks even harmless prompts to public AI
- Audit trail mentions emergency-lockdown
- No data reaches AI endpoint

### 18. Overlay Tampering Audit (PASS)
- Tampering attempts reported to audit trail
- Audit bodies mention tamper events

### 19. Click/Submit Interception — Round 9 (PASS)
- Send button onClick (bubble) → BLOCKED ✓
- Document click CAPTURE listener → BLOCKED ✓
- Window click CAPTURE listener → BLOCKED ✓
- mousedown-triggered send → BLOCKED ✓
- pointerdown-triggered send → BLOCKED ✓

---

## ❌ FEATURES THAT DO NOT WORK / HAVE BUGS

### 🔴 CRITICAL: Raw Text Leaks to ML Endpoint (FAIL)
**Tests:** F1, F2, I1, K1, C8  
**Issue:** The `/api/v1/ml/classify` endpoint receives the FULL RAW TEXT including secrets and PII.
- Raw AWS key `AKIAIOSFODNN7EXAMPLE` found in POST bodies
- Raw Aadhaar number found in POST bodies
- Happens BOTH before and after enrollment
- Popup claims "Raw prompt to SoterAI: No" — **this is FALSE**
- 10 POSTs to `/api/v1/ml/classify` all carried the raw secret from claude.ai

**Impact:** Privacy violation. The extension's own privacy claims are contradicted by its behavior. Enterprise customers would fail compliance audits.

**Fix Required:** Send only a redacted/hashed representation to the ML classifier, or run ML locally.

---

### 🔴 CRITICAL: Submit Interceptor Bypass via Capture Listeners (FAIL)
**Tests:** W-doc-capture, W-win-capture, W-keyup (Round 8)  
**Issue:** If a page registers a CAPTURE-phase listener on document/window BEFORE the content script, or uses `keyup` instead of `keydown`, the interceptor is bypassed and the secret reaches the AI endpoint.

- Document CAPTURE keydown → secret LEAKED
- Window CAPTURE keydown → secret LEAKED  
- keyup-triggered send → secret LEAKED

**Note:** Round 9 showed these as PASS for click events, but Round 9b showed regression when shield hosts were removed. The fix is incomplete.

**Impact:** A malicious or differently-architected AI page can bypass protection entirely.

---

### 🔴 CRITICAL: iframe Bypass (FAIL)
**Test:** W-iframe (Round 8)  
**Issue:** If the AI composer is rendered inside an iframe, the content script does NOT run there (manifest lacks `all_frames: true`). Secret reaches the endpoint unimpeded.

**Impact:** Any AI tool using iframe-based composers (some enterprise tools do) is completely unprotected.

---

### 🟡 HIGH: Paste Exposure Window (FAIL)
**Tests:** C2, C2b (Round 7)  
**Issue:** When sensitive text is pasted:
- Raw secret appears in composer at t=78ms
- Overlay only appears at t=474.8ms
- **~397ms exposure window** where the secret is visible in the DOM
- After overlay appears, the raw secret REMAINS in the composer
- `paste-listener.ts` never calls `event.preventDefault()`

**Impact:** The secret is visible in the page DOM for ~400ms and is never removed. Screen recording, browser extensions, or accessibility tools could capture it.

---

### 🟡 HIGH: Overlay Watchdog Does Not Repair Tampering (FAIL)
**Tests:** D8, H6, H7, L2, L3  
**Issue:** 
- Page sets `display:none !important` on overlay → overlay stays hidden (watchdog does NOT repair)
- Page removes overlay from DOM → overlay does NOT re-mount
- Watchdog tick is 500ms but repair never happens even after 4.8s

**Impact:** A malicious page script can simply hide or remove the security overlay, making the user think nothing was detected.

---

### 🟡 MEDIUM: extensionVersion Mismatch (FAIL)
**Tests:** F4, K2  
**Issue:** Audit events report `extensionVersion: "0.1.2"` but the store build is `0.2.0`. The constant in `packages/shared/src/constants.ts` was not updated before publishing.

**Impact:** Admin dashboard shows wrong version. Audit trail is inaccurate.

---

### 🟡 MEDIUM: Shadow AI Discovery Does Not Work (FAIL)
**Test:** C2  
**Issue:** On unlisted AI-looking domains, no content script runs (manifest has no `<all_urls>` or `tabs` permission). Shadow AI discovery POST count = 0.

**Impact:** The "Shadow AI Discovery" feature advertised in the product does not actually discover anything on domains not in the manifest.

---

### 🟡 MEDIUM: Approval Flow Incomplete (PARTIAL)
**Tests:** J5, N2  
**Issue:** 
- Approval request is sent ✓
- Status polling works ✓
- But CLAIM never fires (claim=0)
- Submission is never released after approval

**Impact:** The full approval workflow (request → approve → claim → submit) does not complete. User must manually re-submit.

---

### 🟢 LOW: No Default Policy on Fresh Install (FAIL → INFO)
**Test:** B1  
**Issue:** On fresh install before enrollment, storage is empty. No local protection until user enrolls or starts trial.

**Impact:** Users who install but don't enroll have ZERO protection. The popup should more aggressively prompt for trial mode.

---

### 🟢 LOW: Round 9b Regression (FAIL)
**Tests:** W-doc-click-capture, W-win-click-capture, W-mousedown, W-pointerdown (Round 9b)  
**Issue:** When shield host elements are removed before the click event, the interceptor fails again. This suggests the Round 9 fix depends on the shield host being present in the DOM.

---

## 📊 Feature-by-Feature Scorecard

| Feature | Status | Severity of Issue |
|---------|--------|-------------------|
| Extension installs & registers | ✅ PASS | — |
| Secret detection (AWS, GCP, etc.) | ✅ PASS | — |
| Prompt injection detection | ✅ PASS | — |
| India PII (Aadhaar/PAN) detection | ✅ PASS | — |
| Benign pass-through (no false positive) | ✅ PASS | — |
| Block overlay rendering | ✅ PASS | — |
| Redacted preview in overlay | ✅ PASS | — |
| Safe prompt replacement | ✅ PASS | — |
| Network-layer deny (SS-9) | ✅ PASS | — |
| Paste scanning | ✅ PASS | — |
| Response scanning | ✅ PASS | — |
| WebSocket response scanning | ✅ PASS | — |
| File upload scanning | ✅ PASS | — |
| Enrollment with code | ✅ PASS | — |
| Trial mode | ✅ PASS | — |
| Policy sync | ✅ PASS | — |
| Heartbeat | ✅ PASS | — |
| Popup UI | ✅ PASS | — |
| Side panel UI | ✅ PASS | — |
| Context menu scan | ✅ PASS | — |
| Emergency lockdown | ✅ PASS | — |
| Hard enforcement | ✅ PASS | — |
| Message guard (SS-3) | ✅ PASS | — |
| Closed shadow root (SS-6 partial) | ✅ PASS | — |
| Click/submit interception (standard) | ✅ PASS | — |
| **Raw text privacy (ML endpoint)** | ❌ FAIL | 🔴 CRITICAL |
| **Capture-listener bypass** | ❌ FAIL | 🔴 CRITICAL |
| **iframe bypass** | ❌ FAIL | 🔴 CRITICAL |
| **Paste exposure window** | ❌ FAIL | 🟡 HIGH |
| **Overlay watchdog repair** | ❌ FAIL | 🟡 HIGH |
| **extensionVersion constant** | ❌ FAIL | 🟡 MEDIUM |
| **Shadow AI discovery** | ❌ FAIL | 🟡 MEDIUM |
| **Approval claim/release** | ⚠️ PARTIAL | 🟡 MEDIUM |
| **Default policy on fresh install** | ❌ FAIL | 🟢 LOW |

---

## 🔧 Priority Fix List

### P0 — Must fix before next release:
1. **Stop sending raw text to `/api/v1/ml/classify`** — send only redacted text or local classification
2. **Add `all_frames: true`** to content_scripts in manifest.json to close iframe bypass
3. **Register interceptors at CAPTURE phase on window** at `document_start` to beat page capture listeners
4. **Hook `keyup` and `beforeinput`** in addition to `keydown`

### P1 — Should fix:
5. **Call `event.preventDefault()` in paste handler** and only insert text after verdict
6. **Implement overlay watchdog repair** — MutationObserver on the overlay host to restore visibility/presence
7. **Update `SOTER_EXTENSION_VERSION`** to "0.2.0" in constants
8. **Complete approval claim flow** — auto-claim and release after approval granted

### P2 — Nice to have:
9. **Shadow AI discovery** — add `tabs` permission or `<all_urls>` content script for unlisted domains
10. **Default trial policy on fresh install** — auto-activate local protection without requiring enrollment

---

## Test Evidence

All screenshots and JSON results are preserved in `soter-edge-test-out/`:
- `results.json` — Round 1 (26 tests)
- `results-round2.json` — Round 2 (16 tests)
- `results-round3.json` — Round 3 (12 tests)
- `results-round5.json` — Round 5 (5 tests)
- `results-round7.json` — Round 7 (8 tests, claude.ai)
- `results-round8.json` — Round 8 (5 tests, bypass vectors)
- `results-round9.json` — Round 9 (5 tests, click interception fixed)
- `results-round9b.json` — Round 9b (5 tests, regression check)
- 50+ screenshots (PNG) documenting each test visually

---

## Conclusion

The Soter Edge Extension v0.2.0 delivers **solid core protection** for the standard user journey: typing/pasting secrets into ChatGPT/Claude triggers detection, shows a clear overlay, blocks submission, and offers remediation. The enterprise features (enrollment, policy sync, heartbeat, audit trail, lockdown) all function correctly.

However, **3 critical security bypasses** and **1 privacy violation** mean the extension cannot yet claim enterprise-grade protection. A determined attacker or an unusual page architecture can bypass the interceptor, and the raw-text ML call contradicts the extension's own privacy claims.

**Recommendation:** Fix P0 items and publish v0.2.1 before marketing to enterprise customers.