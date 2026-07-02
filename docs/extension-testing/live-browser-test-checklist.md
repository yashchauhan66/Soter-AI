# Live Browser Test Checklist — Soter Enterprise AI Control Plane

**Version:** 1.0.0  
**Date:** June 30, 2026  
**Test Environment:** Chrome/Edge Unpacked Extension

---

## ✅ Pre-Test Setup

- [ ] Build extension: `npm run build:extension`
- [ ] Package extension: `npm run package`
- [ ] Extract `soter-extension-*.zip` to test directory
- [ ] Open Chrome/Edge → Extensions → Enable Developer Mode
- [ ] Click "Load unpacked" → Select extracted extension folder
- [ ] Verify extension icon appears in toolbar
- [ ] Open extension popup to confirm it loads without errors

---

## 🔧 Core Extension Functionality

### Installation & Enrollment

- [ ] **Load Unpacked**: Extension loads without manifest errors
- [ ] **Popup Opens**: Click extension icon → popup displays
- [ ] **Side Panel Opens**: Right-click icon → "Open Side Panel" works
- [ ] **Enrollment Flow**:
  - [ ] Create enrollment token in admin dashboard
  - [ ] Copy token
  - [ ] Open extension popup → Click "Enroll Device"
  - [ ] Paste token → Submit
  - [ ] Verify success message
  - [ ] Confirm device appears in admin enrollments list
- [ ] **Policy Sync**: Extension fetches policy after enrollment
- [ ] **Heartbeat**: Extension sends heartbeat every 5 minutes
  - [ ] Check admin audit logs for heartbeat events
  - [ ] Verify `lastHeartbeatAt` timestamp updates

---

## 🎯 Platform-Specific Tests

### ChatGPT (chat.openai.com)

- [ ] **Fake API Key Block**:
  - [ ] Navigate to ChatGPT
  - [ ] Try to submit: `My OpenAI API key is sk-1234567890abcdefghijklmnop`
  - [ ] ✅ **Expected**: Prompt blocked, audit log created, user warned
- [ ] **Clean Prompt Allow**:
  - [ ] Submit: `What is the capital of France?`
  - [ ] ✅ **Expected**: Prompt allowed, no block

### Claude (claude.ai)

- [ ] **PAN Redaction**:
  - [ ] Submit: `My PAN is ABCDE1234F`
  - [ ] ✅ **Expected**: PAN redacted to `[REDACTED_PAN]`, audit log shows redaction
- [ ] **GSTIN Redaction**:
  - [ ] Submit: `Our GSTIN is 29ABCDE1234F1Z5`
  - [ ] ✅ **Expected**: GSTIN redacted, audit log created

### Gemini (gemini.google.com)

- [ ] **Clean Prompt Allow**:
  - [ ] Submit: `Explain quantum computing`
  - [ ] ✅ **Expected**: Prompt allowed

### Perplexity (perplexity.ai)

- [ ] **Warning Test**:
  - [ ] Submit prompt with borderline sensitive content
  - [ ] ✅ **Expected**: Warning shown but prompt allowed (if policy configured)

### Poe (poe.com)

- [ ] **Fallback Interception**:
  - [ ] Submit any prompt
  - [ ] ✅ **Expected**: Prompt intercepted, analyzed, action taken per policy

### Replit (replit.com)

- [ ] **Source Code Warning**:
  - [ ] Submit code containing potential secrets
  - [ ] ✅ **Expected**: Warning or block depending on policy

### v0.dev / Bolt.new

- [ ] **Prompt Interception**:
  - [ ] Submit design/code generation prompt
  - [ ] ✅ **Expected**: Prompt analyzed before submission

### Localhost Open WebUI

- [ ] **Environment Variable Block**:
  - [ ] Navigate to `http://localhost:3000` or similar Open WebUI instance
  - [ ] Try to submit: `DATABASE_URL=postgresql://user:pass@localhost/db`
  - [ ] ✅ **Expected**: Blocked, audit log created

---

## 🛡️ Security Features

### Paste Detection

- [ ] **Copy-Paste Interception**:
  - [ ] Copy sensitive text (e.g., API key format)
  - [ ] Paste into ChatGPT input
  - [ ] ✅ **Expected**: Paste event captured, content analyzed
  - [ ] If sensitive: warning or block

### Submit Interception

- [ ] **Form Submit Hook**:
  - [ ] Type prompt manually (no paste)
  - [ ] Click send button
  - [ ] ✅ **Expected**: Submit intercepted, content analyzed before sending

### File Upload Warning

- [ ] **File Attachment Detection**:
  - [ ] Attempt to upload file to ChatGPT
  - [ ] ✅ **Expected**: Warning shown about file uploads
  - [ ] Verify audit log created for file upload attempt

### Response Scanning

- [ ] **Response Monitoring On**:
  - [ ] Enable response scanning in admin settings for ChatGPT
  - [ ] Submit clean prompt
  - [ ] Wait for AI response
  - [ ] ✅ **Expected**: Response scanned, metadata logged (no full text by default)
- [ ] **Response Monitoring Off**:
  - [ ] Disable response scanning in admin settings
  - [ ] Submit prompt
  - [ ] ✅ **Expected**: No response audit event created

---

## 👤 Approval Workflow

### Approval Request

- [ ] **Trigger Approval**:
  - [ ] Configure policy to require approval for certain prompts
  - [ ] Submit prompt that triggers approval
  - [ ] ✅ **Expected**: 
    - [ ] User sees "Approval Required" message
    - [ ] Request appears in admin approval queue
    - [ ] Prompt text is redacted in admin UI
    - [ ] Audit log created

### Approval Grant

- [ ] **Admin Approves**:
  - [ ] Admin opens approval queue
  - [ ] Reviews request
  - [ ] Clicks "Approve"
  - [ ] ✅ **Expected**:
    - [ ] Extension polls and receives approval
    - [ ] Original prompt submitted to AI
    - [ ] Audit log updated with approval

### Approval Reject

- [ ] **Admin Rejects**:
  - [ ] Admin reviews request
  - [ ] Clicks "Reject" with reason
  - [ ] ✅ **Expected**:
    - [ ] User notified of rejection
    - [ ] Prompt not submitted
    - [ ] Audit log updated

---

## 🚨 Emergency Lockdown

### Lockdown Enable

- [ ] **Admin Activates Lockdown**:
  - [ ] Admin navigates to Emergency Lockdown page
  - [ ] Clicks "Enable Lockdown"
  - [ ] Enters reason
  - [ ] ✅ **Expected**:
    - [ ] Lockdown state saved to database
    - [ ] All active extensions notified within 60 seconds

### Extension Lockdown Behavior

- [ ] **Extension Receives Lockdown**:
  - [ ] Extension polls lockdown status
  - [ ] ✅ **Expected**:
    - [ ] Extension UI shows lockdown badge
    - [ ] All AI prompts blocked immediately
    - [ ] User sees "Emergency Lockdown Active" message
    - [ ] Audit logs show lockdown enforcement

### Lockdown Disable

- [ ] **Admin Deactivates Lockdown**:
  - [ ] Admin clicks "Disable Lockdown"
  - [ ] ✅ **Expected**:
    - [ ] Extension receives update
    - [ ] Normal operation resumes
    - [ ] Lockdown badge removed

---

## 🕵️ Shadow AI Discovery

- [ ] **Detect Unenrolled AI Tool**:
  - [ ] Navigate to an AI tool not in configured destinations list (e.g., `ai.tool.example.com`)
  - [ ] Submit prompt
  - [ ] ✅ **Expected**:
    - [ ] Extension detects AI-like interface
    - [ ] Shadow AI event logged
    - [ ] Admin notified in dashboard

---

## 📊 Audit Log Verification

- [ ] **Audit Completeness**:
  - [ ] Perform various actions (blocks, redactions, approvals)
  - [ ] Navigate to admin audit logs
  - [ ] ✅ **Expected**:
    - [ ] All events logged with timestamps
    - [ ] User/device identified correctly
    - [ ] Redacted previews shown (no raw prompts by default)
    - [ ] Action outcomes recorded

### Audit Privacy

- [ ] **No Raw Prompts**:
  - [ ] Submit sensitive prompt
  - [ ] Check audit log entry
  - [ ] ✅ **Expected**: Only redacted/sanitized text stored by default
- [ ] **Metadata Only for Responses**:
  - [ ] Check response scanning audit logs
  - [ ] ✅ **Expected**: Response metadata logged, not full response text by default

---

## 🔗 Webhook Event Verification

- [ ] **Configure Webhook**:
  - [ ] Admin creates webhook endpoint
  - [ ] Selects events to subscribe
  - [ ] Saves webhook
- [ ] **Trigger Events**:
  - [ ] Perform actions that trigger webhook events:
    - [ ] EXTENSION_HEARTBEAT
    - [ ] PROMPT_BLOCKED
    - [ ] PROMPT_REDACTED
    - [ ] APPROVAL_REQUESTED
    - [ ] APPROVAL_APPROVED
    - [ ] APPROVAL_REJECTED
    - [ ] SHADOW_AI_DISCOVERED
    - [ ] EMERGENCY_LOCKDOWN_ENABLED
    - [ ] EMERGENCY_LOCKDOWN_DISABLED
    - [ ] POLICY_SIGNATURE_FAILED (if applicable)
- [ ] **Verify Delivery**:
  - [ ] Check webhook delivery logs in admin UI
  - [ ] ✅ **Expected**:
    - [ ] Events delivered successfully
    - [ ] HMAC signature valid
    - [ ] No raw prompts or secrets in payload
    - [ ] Retry logic works for failed deliveries

---

## 🔒 Security & Privacy

### Policy Signature Verification

- [ ] **Valid Signature**:
  - [ ] Extension fetches signed policy
  - [ ] ✅ **Expected**: Signature verified, policy applied
- [ ] **Invalid Signature** (manual test):
  - [ ] Modify policy response to have invalid signature
  - [ ] ✅ **Expected**: Extension rejects policy, audit log created

### No Raw Prompt Leaks

- [ ] **Audit Logs**: Verify only redacted text stored
- [ ] **Webhook Payloads**: Verify no raw user input in webhook events
- [ ] **Admin UI**: Verify sensitive data masked

### Unrelated Browsing Not Monitored

- [ ] **Visit Non-AI Sites**:
  - [ ] Navigate to news site, e-commerce, social media
  - [ ] ✅ **Expected**: No extension activity, no audit logs created
- [ ] **Content Scripts Not Injected**:
  - [ ] Check extension console
  - [ ] ✅ **Expected**: Content scripts only run on configured AI destinations

---

## ⚡ Performance

- [ ] **Small Prompt (<100 words)**:
  - [ ] Submit short prompt
  - [ ] ✅ **Expected**: Processed in <100ms, no visible delay
- [ ] **Medium Prompt (~1000 words)**:
  - [ ] Submit paragraph
  - [ ] ✅ **Expected**: Processed in <300ms
- [ ] **Large Prompt (~10KB)**:
  - [ ] Submit very long text
  - [ ] ✅ **Expected**: No page freeze, processed smoothly
- [ ] **No Duplicate Audits**:
  - [ ] Submit same prompt twice
  - [ ] ✅ **Expected**: Two separate audit entries (not duplicate from same submission)

---

## 🌐 Cross-Browser

### Chrome

- [ ] All tests pass in Chrome
- [ ] Extension updates policy correctly
- [ ] No console errors

### Edge

- [ ] All tests pass in Edge
- [ ] Extension behavior identical to Chrome
- [ ] No Edge-specific issues

---

## ✅ Test Result Summary

| Category | Tests Passed | Tests Failed | Notes |
|----------|--------------|--------------|-------|
| Core Functionality | ___ / ___ | ___ | |
| Platform Tests | ___ / ___ | ___ | |
| Security Features | ___ / ___ | ___ | |
| Approval Workflow | ___ / ___ | ___ | |
| Emergency Lockdown | ___ / ___ | ___ | |
| Shadow AI | ___ / ___ | ___ | |
| Audit Logs | ___ / ___ | ___ | |
| Webhooks | ___ / ___ | ___ | |
| Security & Privacy | ___ / ___ | ___ | |
| Performance | ___ / ___ | ___ | |
| Cross-Browser | ___ / ___ | ___ | |

**Overall Pass Rate**: ____%

---

## 🚫 Known Limitations

- Extension requires manual enrollment (no SSO auto-enrollment yet)
- Response scanning limited to text responses (no image analysis)
- File upload warnings are generic (no file content analysis)
- Shadow AI detection is heuristic-based (may miss sophisticated tools)

---

## 📝 Notes for Testers

1. **Do not mark tests as passed unless actually executed.**
2. **Document any deviations from expected behavior.**
3. **Capture screenshots of failures.**
4. **Test on clean browser profile to avoid conflicts.**
5. **Clear extension storage between test runs if needed.**

---

## ✅ Sign-Off

**Tester Name**: _______________  
**Date**: _______________  
**Overall Result**: ⬜ PASS | ⬜ FAIL | ⬜ PASS WITH ISSUES  
**Ready for Beta**: ⬜ YES | ⬜ NO | ⬜ WITH RESERVATIONS  

**Signature**: _______________
