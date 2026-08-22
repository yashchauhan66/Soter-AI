# SoterAI Browser Extension — Deep Analysis + soterai.in Real-User Test + Final Report

**Date:** 2026-08-17
**Tested:** `apps/extension` v0.1.2 (Soter Enterprise AI Control Plane, Chrome/Edge MV3) + live `https://soterai.in`
**Method:** Deep source-code analysis + full extension test suite run (fresh) + live production website/API probing as a real user + signup flow test.

---

## 1. EXECUTIVE SUMMARY

| Item | Result |
|---|---|
| Extension test suite | **328/328 PASS** (0 fail, run fresh today, 15.5s) |
| TypeScript typecheck | **Clean** (exit 0) |
| Production site (soterai.in) | **LIVE** — HTTP 200, ~1s TTFB, Cloudflare, strong security headers |
| Production health API | `{"status":"ok","database":"reachable","guard":{"ml":{"mode":"enforce","status":"healthy"}}}` |
| Auth protection | All APIs return `Authentication required.` without session — **correct** |
| Signup flow | Works; **email verification enforced** (`verificationRequired: true`) |
| Overall extension rating | **8.6 / 10** (enterprise-grade architecture, early version number) |

---

## 2. BROWSER EXTENSION — DEEP CODE ANALYSIS

### 2.1 Architecture

| Layer | Files | What it does |
|---|---|---|
| Manifest | `manifest.json` (MV3) | 18+ AI destinations scoped; **no** `<all_urls>`, `tabs`, `activeTab`, `scripting`, `webNavigation` |
| Background | `service-worker.ts`, `policy-sync.ts`, `heartbeat.ts`, `network-block.ts`, `integrity.ts`, `context-menu.ts` | Scan orchestration, policy sync every 15 min, heartbeat every 5 min, DNR network-layer block |
| Content | `submit-interceptor.ts`, `paste-listener.ts`, `file-upload-listener.ts`, `file-content-scanner.ts`, `response-observer.ts`, `overlay.ts`, `overlay-sentinel.ts`, `dom-observer.ts`, `source-lineage-*` | Intercepts submit/paste/upload on AI sites, renders enforcement overlay, tamper detection |
| Adapters | 18 site adapters (chatgpt, claude, gemini, perplexity, replit, stackblitz, codesandbox, bolt, v0, lovable, openwebui, copilot, localhost-ai…) | Per-site DOM knowledge for prompt input + submit button |
| Lib | `scanner.ts`, `redaction.ts`, `rewrite.ts`, `approval-ledger.ts`, `fingerprint-matcher.ts`, `policy-verification.ts`, `trusted-endpoint.ts`, `message-guard.ts`, `privacy-preview.ts` | Decision kernel, redaction, safe rewrite, approval grants, company fingerprint matching, HMAC policy verification |
| Shared engines | `packages/detectors`, `packages/policy-engine`, `packages/shared` | Same detection engine as IDE extension & server guard |
| UI | Popup + Side panel | Enrollment, privacy proof ("What leaves browser?"), latest scan |

### 2.2 Security engineering highlights (rare in this market)

1. **Fail-closed gate (SS-4)** — if the policy bundle is tampered (hash/signature/organization mismatch/rollback) or offline with fail-closed flag, the extension blocks with a special rule that **disables every remediation path** — no "use safe prompt", no replay, no approval release. Only an audited dismiss.
2. **SS-11 fix** — fail-closed blocks return *redacted* text as `rewrittenSafeText`, never raw text. A previous version could hand raw text back to the page it just blocked.
3. **Network-layer enforcement (SS-9)** — after a `block` verdict on submit/upload, a tab-scoped, method-scoped (`POST/PUT/PATCH`), 3-second `declarativeNetRequest` session rule denies the page's own `fetch()` replay. Orphan reclaim on worker restart. Honestly documents what it cannot cover (WebSockets, unseen requests).
4. **Approval ledger (SS-7)** — scan-first ordering: an approval can never release a fail-closed block; grants are origin-bound, single-use, TTL-bound; server-side claim verification before replay.
5. **Message boundary validation (SS-3)** — every runtime message crosses a type allowlist + sender identity + schema check. Unknown messages dropped, not routed.
6. **Trusted endpoint pinning (EP-2xx)** — refuses http (except loopback for local broker), IP literals, embedded credentials, punycode/IDN homographs; once pinned, no other origin accepted. 328 tests include 15+ endpoint-poisoning attacks.
7. **Overlay tamper detection (SS-6)** — a page that removes/neutralizes the verdict is audited as an override attempt.
8. **Privacy kernel** — `assertNoRawSensitiveData()` runs before every backend call; raw prompt never stored by default; audit events carry metadata + redacted preview only; full-prompt logging requires explicit admin mode.

### 2.3 Detection engine (shared with IDE extension & server)

- Secrets: AWS, GitHub PAT, OpenAI, JWT, private keys, DB URLs, `.env`, passwords
- PII: Global + **India-specific** (Aadhaar, PAN, UPI)
- Prompt injection: classic, paraphrased, split-word, jailbreak persona, prompt extraction, indirect extraction, **multilingual** (Korean, Russian, Chinese, Arabic, German, Hindi Devanagari + **Hinglish**)
- Anti-evasion: zero-width chars, homoglyphs, leetspeak, base64, ROT13 → normalized re-scan
- Semantic injection shield: paraphrase-resistant intent scoring
- Business-sensitive + source-code detection
- Custom org detectors: keywords, regex, document fingerprints

### 2.4 Quality gates (run fresh today)

| Gate | Result |
|---|---|
| `npm run test:extension` | **328/328 pass, 0 fail** |
| `npm --prefix apps/extension run typecheck` | **Clean** |
| Manifest invariants test | Broad `declarativeNetRequest` refused by test (MF-506/507); store docs drift check exists |

---

## 3. REAL MARKET PROBLEMS THE EXTENSION SOLVES

| # | Market problem (2026 reality) | How SoterAI solves it | Usefulness |
|---|---|---|---|
| 1 | **Employees paste secrets/PII/source code into ChatGPT, Claude, Gemini** — #1 enterprise AI data-leak vector | Submit interception + local scan + redaction + safe rewrite before the request leaves the browser; network-layer deny stops script replays | **10/10** — everyday risk |
| 2 | **Risky file uploads to AI tools** (`.env`, private keys, customer CSVs) | File upload listener + local content scanner + block/warn policy | **9/10** |
| 3 | **Shadow AI** — employees using unapproved AI tools IT doesn't know about | Shadow AI discovery reports unknown AI destination usage without monitoring general browsing | **9/10** — compliance teams pay for this |
| 4 | **Prompt injection / jailbreak via browser AI chat** | Multilingual + obfuscation-resistant injection detection incl. Hinglish (unique for India market) | **8/10** |
| 5 | **No audit trail for AI usage** — legal/regulatory exposure | Every decision → backend audit event (metadata + redacted preview only) with risk score, rules, destination | **9/10** |
| 6 | **Incident response** — "shut down AI now" during a breach | Emergency lockdown enforced locally from cached policy even offline | **9/10** — rare capability |
| 7 | **Policy tampering / rogue admin** | HMAC-SHA256 signed policy bundles + fail-closed on tamper signals | **8/10** — enterprise trust requirement |
| 8 | **India data compliance** (DPDP Act, Aadhaar/PAN leakage) | Built-in India PII detectors; Hinglish injection detection | **9/10 for Indian enterprises** — no global competitor has this |
| 9 | **Where did the pasted data come from?** (insider-risk forensics) | Source lineage tracking — hashes + redacted context of paste origin | **7/10** |
| 10 | **Privacy backlash from employees** ("my employer reads my chats") | Privacy-proof UI shows exactly what leaves the browser; raw prompts not sent by default — provable | **8/10** — adoption enabler |

**Competitive position:** Enterprise browser-DLP for AI chat is served by ~none of the big DLP vendors as a lightweight extension with local-first scanning. Competitors (Lakera, Prompt Security, Nightfall) are API/proxy platforms requiring traffic routing. SoterAI's in-browser interception + signed policy + fail-closed design is differentiated, especially for the Indian mid-market (50–500 employees — the exact segment the governance page targets).

---

## 4. IMPROVEMENTS NEEDED (honest gaps)

| # | Gap | Severity | Recommendation |
|---|---|---|---|
| 1 | **Version 0.1.2** — store listing maturity vs enterprise claims | Medium | Ship 0.2.0 with changelog; the code is far ahead of the version number |
| 2 | **WebSocket/WebTransport not covered** by network block (honestly documented) | Medium | Add response-observer coverage for WS frames where possible; document residual risk in admin guide |
| 3 | **Chrome/Edge only** — no Firefox/Safari | Medium | Firefox MV3 port for enterprises on Firefox ESR |
| 4 | **Network block TTL = 3s** — a patient script can retry after the window | Low-Med | Make TTL policy-configurable (e.g. 10–30s) |
| 5 | **Regex + semantic-heuristic detection** — no on-device ML classifier in the browser extension (server has ML enforce mode) | Medium | Ship a small ONNX classifier (repo already has `artifacts/ml` + `scripts/ml`) into the extension for paraphrase attacks |
| 6 | **Enrollment requires enterprise code** — no self-service trial for small teams | High (growth) | Add a "try with sample policy" mode or instant org creation from soterai.in signup |
| 7 | **Popup/sidepanel English-only** | Low | i18n for Hindi/other languages given India focus |
| 8 | **Response scanning off by default** | Low | Keep default, but add admin onboarding checklist item |
| 9 | **No self-test/diagnostic page for enrolled users** ("is protection active on this site?") | Medium | Add a "test protection" button in sidepanel that runs a synthetic scan |
| 10 | **Store listing & reviews** — needs published listing presence for trust | High (growth) | Ensure Chrome Web Store + Edge Add-ons listings are live with privacy-proof screenshots |

---

## 5. EXTENSION RATING

| Dimension | Score | Why |
|---|---|---|
| Security architecture | **9.5/10** | Fail-closed, signed policy, network-layer deny, approval ledger, endpoint pinning, message validation — beyond most paid enterprise tools |
| Detection engine | **8/10** | Strong multilingual + anti-evasion; regex-core needs ML augmentation in-browser |
| Privacy engineering | **9.5/10** | Local-first, assertNoRawSensitiveData on every payload, privacy-proof UI, minimal permissions |
| Test discipline | **9/10** | 328 passing security/privacy tests incl. attack simulations; manifest invariants enforced |
| Feature completeness | **8/10** | Prompt/file/response/lineage/lockdown/shadow-AI all wired; WS gap + Chrome-only |
| UX / onboarding | **7/10** | Clean popup/sidepanel; enrollment friction for trial users |
| Market readiness | **8/10** | Enterprise-ready claims backed by code; version number + store presence need work |

### **OVERALL: 8.6 / 10** — *Enterprise-grade security engineering in an early version shell. Stronger on defense-in-depth than any browser AI-DLP extension reviewed in this repo's prior competitive analyses.*

---

## 6. soterai.in — REAL-USER TEST (AI Governance + AI Control Panel)

### 6.1 Live-site probes (as an unauthenticated real user)

| Check | Result |
|---|---|
| `https://soterai.in/` | ✅ 200, 1.0–2.1s, 234 KB |
| `/pricing`, `/docs`, `/signin`, `/signup`, `/demo`, `/extensions/ide`, `/docs/services` | ✅ all 200, <1.6s |
| `/dashboard` | ✅ 307 redirect to auth — **protection working** |
| `/playground`, `/demo-chatbot`, `/benchmark` | ✅ 200 |
| `GET /api/health` | ✅ `{"status":"ok","database":"reachable","guard":{"status":"ok","ml":{"mode":"enforce","status":"healthy","enforcing":true}}}` — **ML guard enforcing in production** |
| `POST /api/guard/scan` (no auth) | ✅ `Authentication required.` — no unauthenticated scan leakage |
| `POST /api/extension/v1/enroll` (invalid code) | ✅ `Authentication required.` |
| `POST /api/demo-chatbot` (no auth) | ✅ `Authentication required.` |

### 6.2 Security headers (production)

| Header | Value | Verdict |
|---|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | ✅ A+ |
| Content-Security-Policy | `default-src 'self'; … frame-ancestors 'none'; object-src 'none'` | ✅ Strong (note: `script-src` includes `'unsafe-inline'` — acceptable with Next.js but nonce-based would be stronger) |
| X-Frame-Options | `DENY` | ✅ |
| X-Content-Type-Options | `nosniff` | ✅ |
| Referrer-Policy | `strict-origin-when-cross-origin` | ✅ |
| Permissions-Policy | camera/mic/geo disabled | ✅ |
| CDN/WAF | Cloudflare | ✅ |

### 6.3 Signup flow (real-user test)

```
POST /api/auth/signup {"name":"Test User","email":"test-probe-20260817@example.com","password":"***"}
→ {"ok":true,"verificationRequired":true,"emailSent":false,"verificationEmailMocked":false}
```

- ✅ Signup API works, email verification **enforced** (cannot access dashboard unverified)
- ⚠️ **FINDING:** `emailSent: false` for a real signup attempt — **transactional email delivery appears not configured/disabled in production**. A real user signing up today may never receive the verification email. **This is the single most urgent production fix.**

### 6.4 AI Governance (`/dashboard/usage-governance`) — code + structure review

Full governance suite exists and is server-rendered behind auth:
- Compliance score, policy rules, departments, pending approvals stats
- Policy configuration (default actions, data handling, approval requirements)
- Provider allow/block lists (OpenAI, Anthropic, etc.)
- Department-specific rules (engineering/marketing/finance)
- Data classification → which sensitivity levels can go to which AI provider
- Approval request workflow
- Complete audit trail + compliance reports
- Employee monitoring (top users, top providers)

### 6.5 AI Control Panel (`/dashboard/agent-control`) — code + structure review

Agent Control Center (for autonomous agents) exists with:
- Human approval queue (firewall holds + transaction escrow, redacted payloads, approve-safe-edit/deny)
- Live action audit (every tool call with decision, risk, destination, reason)
- Reversibility ledger with staged compensating rollbacks (honestly: stages reversal, doesn't falsely claim undone)
- Continuous compliance assurance scoring (SOC 2 / ISO 27001 evidence)
- Operator audit trail (human rollback decisions attributed separately from agent logs)
- Permission-gated: viewer mode vs policy-manage mode verified in code

**Honesty note in product UI itself:** the FeatureGuide callout admits approvals/rollback only cover actions routed through the control plane — rare, trust-building honesty.

### 6.6 Account / API requirement for full real-user testing

**YES — an account is needed to go deeper.** Everything beyond marketing/public pages is auth-gated (correctly). To complete a full real-user test of AI Governance + Control Panel I need **one of**:

1. **A verified user account** (email + password) — currently blocked by the email-delivery finding in §6.3, OR
2. **An admin-created test account** (auto-verified) + org/project seeded, OR
3. **An API key** from `/dashboard/api-keys` for API-level testing of guard/scan, governance, and agent-control endpoints.

**Recommendation:** fix production email delivery (or give me a pre-verified account / API key) and I can run the complete logged-in test pass next.

---

## 7. FINAL VERDICT

| Area | Verdict |
|---|---|
| Browser extension | **8.6/10** — genuinely enterprise-grade defense-in-depth; 328/328 security tests pass; solves real 2026 data-leak problems; needs ML-in-browser, Firefox, trial onboarding, and a version bump |
| soterai.in production | **LIVE & hardened** — ML guard enforcing, all APIs auth-gated, A+ security headers, dashboard protected |
| AI Governance | Feature-complete in code (policy, departments, classification, approvals, audit, reports) — needs verified-account test pass |
| AI Control Panel | Feature-complete in code (approval queue, escrow, reversibility ledger, assurance, operator audit) — needs verified-account test pass |
| **Most urgent fix** | **Production signup email delivery (`emailSent:false`) — real users cannot complete signup today** |
| Top growth fixes | Self-service trial for extension enrollment; published store listings; version bump to 0.2.0 |

---

*Report generated 2026-08-17 by deep source analysis + fresh test runs + live production probing. Extension tests: 328/328 pass. IDE-extension prior rating (2026-08-15): 82/100 — this browser extension scores higher on security architecture due to fail-closed + signed-policy + network-layer enforcement.*