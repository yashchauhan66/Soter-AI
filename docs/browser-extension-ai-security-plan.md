# Browser Extension AI Security Plan

## Current posture

The extension is Manifest V3 and has prompt/output, clipboard/file, source-lineage, managed policy, enrollment, signing, rate-limit and privacy test assets. The largest design concern is permission scope: `content/source-lineage-entry.js` is injected on `<all_urls>`, while `optional_host_permissions` also permits `*://*/*`. Chrome documents host access and runtime optional permissions as security/user-trust boundaries; see [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).

## P0 hardening

1. Replace the always-on `<all_urls>` content script with one of:
   - explicit enterprise-managed source domains;
   - `activeTab` for user-initiated capture; or
   - optional host permission granted per domain with a clear purpose screen.
2. Default to local scan/redaction; send only policy/version, risk categories and bounded redacted evidence unless the organization explicitly enables remote processing.
3. Document every collected field, storage key, transmission, retention and deletion path.
4. Validate signed policy before use; retain last-known-good with version/expiry; fail strict for protected destinations when policy is invalid.
5. Ensure extension tokens are device-bound, short-lived/rotatable and never exposed to page context.
6. Add CSP and dependency review for bundled extension code; prohibit dynamic/remote code.

## Target UX

- Before submit: **Allow**, **Redact and send**, **Block**, or **Request approval**, with category, severity and a concise reason.
- File upload: scan status, detected classes, local/remote processing indicator and safe alternative.
- Output: warning for secrets, phishing, unsafe code or untrusted links without mutating the page invisibly.
- Side panel: current organization, policy version, protected sites, local mode, last sync, health and event privacy.
- Permission prompt: domain, feature enabled, data inspected and revocation control.

## Adapter architecture

- A small stable core handles policy, local detection, redaction and events.
- Site adapters only discover editor, submit, upload and response nodes through a typed interface.
- Adapter failure must not silently submit content when strict policy requires inspection.
- Mutation observers are bounded/debounced and disconnected during navigation.
- Unknown AI sites use generic, user-initiated protection until a tested adapter exists.

## Test matrix

| Layer | Tests | Gate |
|---|---|---|
| Manifest | permission diff, no remote code, allowed hosts | No new broad permission without review |
| Unit | detector/redactor/policy/signature/storage | No raw sensitive data in state/telemetry |
| DOM adapter | ChatGPT, Claude, Gemini, Perplexity, Copilot and generic fixtures | Submit interception and recovery work |
| Browser E2E | Chrome + Edge, prompt, paste, file, output, policy update, offline | All P0 flows pass in packaged build |
| Privacy | page cannot read token; extension does not retain raw content; deletion | Canary secret absent from storage/log/network |
| Performance | 1KB/10KB/100KB, rapid typing, long responses | Published p95 and no visible page freeze |
| Enterprise | managed config, enrollment, revoke, lockdown | Revocation/lockdown effective within SLO |

## Store readiness checklist

- Minimal permissions and plain-language justification.
- Privacy policy matches observed network/storage behavior.
- No unsupported efficacy/performance claim.
- Reproducible package and hash; source matches submitted artifact.
- Screenshots use real product behavior or are clearly labeled mock.
- Data deletion/support contacts and versioned release notes.
- Manual review on clean profiles in Chrome and Edge.

## Rollout

Ship permission reduction first behind a beta channel, measure adapter failures without raw content, then migrate managed enterprises. Keep the previous signed package for rollback. A permission expansion is a security release and requires fresh review.
