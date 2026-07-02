# Soter AI Security Guard — Full Live Browser Testing Checklist

**Version:** P1 — Paid Enterprise Pilot Readiness  
**Date:** June 30, 2026

---

## Prerequisites
- [ ] Node.js 18+ installed
- [ ] Extension built (`npm run build:extension`)
- [ ] Chrome (latest) installed
- [ ] Edge (latest) installed
- [ ] Test organization created in the Soter AI dashboard
- [ ] Admin user with admin privileges
- [ ] Test enrollment token generated

---

## 1. Chrome Load Unpacked

- [ ] Open `chrome://extensions/`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select the extension build directory
- [ ] Verify extension appears in the toolbar
- [ ] Verify popup opens and shows enrollment prompt
- [ ] Verify no console errors in `chrome://extensions/` service worker console

## 2. Edge Load Unpacked

- [ ] Open `edge://extensions/`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select the extension build directory
- [ ] Verify extension appears in the toolbar
- [ ] Verify popup opens and shows enrollment prompt
- [ ] Verify no console errors in service worker console

## 3. Enrollment Flow

- [ ] Generate enrollment token from admin dashboard (`/admin/extension-enrollments`)
- [ ] Copy token at creation time
- [ ] Open extension popup
- [ ] Enter enrollment token
- [ ] Verify enrollment succeeds
- [ ] Verify popup shows "Enrolled" state
- [ ] Verify employee ID and department are displayed
- [ ] Verify policy is synced (check side panel)

## 4. ChatGPT Prompt Block Test

- [ ] Navigate to `chatgpt.com`
- [ ] Open a new chat
- [ ] Type a prompt containing a fake API key: `sk-test-1234567890abcdef`
- [ ] Verify the extension intercepts the prompt
- [ ] Verify a block notification appears
- [ ] Verify the prompt is NOT sent to ChatGPT
- [ ] Check admin dashboard audit log for `PROMPT_BLOCKED` event

## 5. Claude Prompt Redact Test

- [ ] Navigate to `claude.ai`
- [ ] Type a prompt containing PII: `My email is john@example.com and SSN is 123-45-6789`
- [ ] Verify the extension detects PII
- [ ] Verify the prompt is redacted (PII replaced with `[REDACTED]`)
- [ ] Verify the redacted prompt is sent (or blocked, per policy)
- [ ] Check admin dashboard for `PROMPT_REDACTED` event

## 6. Gemini Clean Allow Test

- [ ] Navigate to `gemini.google.com`
- [ ] Type a clean prompt: `What is the capital of France?`
- [ ] Verify the prompt is allowed without interference
- [ ] Verify no security events are generated for safe prompts
- [ ] Verify the Gemini response loads normally

## 7. Perplexity Warn Test

- [ ] Navigate to `perplexity.ai`
- [ ] Type a prompt containing sensitive business data: `Summarize our Q4 financial results showing $2.3M revenue`
- [ ] Verify the extension warns about financial data in the prompt
- [ ] Verify the user sees a warning notification
- [ ] Check admin dashboard for the detection event

## 8. Localhost Open WebUI Block Test

- [ ] Start a local Open WebUI instance (e.g., `http://localhost:3000`)
- [ ] Navigate to the local Open WebUI
- [ ] During emergency lockdown: verify the extension blocks access
- [ ] Outside lockdown: verify normal policy applies
- [ ] Verify the block event is logged

## 9. Extension Popup Enrollment Test

- [ ] Open extension popup
- [ ] Verify enrollment status is displayed
- [ ] Verify "Last sync" timestamp is shown
- [ ] Verify current policy version is shown
- [ ] Click "Sync Now" if available
- [ ] Verify policy refresh completes

## 10. Side Panel Scan Test

- [ ] Open the extension side panel
- [ ] Navigate to a monitored AI tool
- [ ] Verify the side panel shows the current destination
- [ ] Verify the side panel shows active policy rules
- [ ] Verify the scan status indicator is active

## 11. Emergency Lockdown Test

- [ ] Open admin dashboard → `/admin/ai-policies/emergency-lockdown`
- [ ] Type "LOCKDOWN" to confirm
- [ ] Click "Activate Emergency Lockdown"
- [ ] Verify the lockdown state changes to "ACTIVE"
- [ ] Navigate to ChatGPT
- [ ] Verify prompts are blocked
- [ ] Verify file upload is blocked
- [ ] Verify source code prompts require approval
- [ ] Check that the heartbeat response includes `lockdownChanged: true`
- [ ] Deactivate lockdown
- [ ] Verify normal policy is restored
- [ ] Verify extensions receive the updated policy

## 12. Approval Request Test

- [ ] Navigate to a monitored AI tool
- [ ] Type a prompt that triggers `require_approval` policy
- [ ] Verify an approval request notification appears
- [ ] Open admin dashboard → approvals
- [ ] Verify the approval request is listed
- [ ] Approve the request (choose "approve once")
- [ ] Verify the extension allows the prompt to be sent
- [ ] Verify the next similar prompt triggers a new approval request
- [ ] Verify the "once" claim is consumed

## 13. Audit Log Verification

- [ ] Open admin dashboard
- [ ] Navigate to audit logs
- [ ] Verify all previous test events appear:
  - [ ] `EXTENSION_SHADOW_AI_DISCOVERED` events
  - [ ] `PROMPT_BLOCKED` events
  - [ ] `PROMPT_REDACTED` events
  - [ ] `EMERGENCY_LOCKDOWN_ENABLED` / `DISABLED` events
  - [ ] `APPROVAL_REQUESTED` / `APPROVAL_CLAIMED` events
- [ ] Verify events are tenant-scoped (no cross-org leakage)

## 14. Heartbeat Verification

- [ ] Open browser DevTools → Network tab
- [ ] Filter for heartbeat requests
- [ ] Verify heartbeat is sent to `/api/agent/heartbeat`
- [ ] Verify request includes device identity
- [ ] Verify response includes `ok: true`
- [ ] If lockdown is active, verify response includes `lockdownChanged` and `lockdownPolicy`
- [ ] Verify `recommendedPollIntervalMs` is reduced during lockdown

---

## Pass/Fail Summary

| Test | Status |
|------|--------|
| 1. Chrome load unpacked | ☐ |
| 2. Edge load unpacked | ☐ |
| 3. Enrollment flow | ☐ |
| 4. ChatGPT prompt block | ☐ |
| 5. Claude prompt redact | ☐ |
| 6. Gemini clean allow | ☐ |
| 7. Perplexity warn | ☐ |
| 8. Localhost block | ☐ |
| 9. Popup enrollment | ☐ |
| 10. Side panel scan | ☐ |
| 11. Emergency lockdown | ☐ |
| 12. Approval request | ☐ |
| 13. Audit log | ☐ |
| 14. Heartbeat | ☐ |

**Overall Result:** ☐ PASS  ☐ FAIL

**Notes:**
