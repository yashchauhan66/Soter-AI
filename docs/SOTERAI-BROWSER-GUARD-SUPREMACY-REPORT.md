# SoterAI Browser Guard — Supremacy Report

**Purpose.** Resumable source of truth for the browser-layer security audit and hardening
programme. Every claim in this document must be traceable to a command, a test ID, a file
path, or an explicitly labelled unverified research note. Absence of competitor information
is never recorded as a SoterAI advantage.

**Status:** IN PROGRESS — Service 1 (extension self-security) implemented and runtime-proved (§8);
Services 2–14 not started.
**Last updated:** 2026-08-01

---

## 0. Run metadata (§1.1)

| Item | Value |
|---|---|
| Repository | `C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard` |
| Branch | `main` |
| HEAD at audit start | `30e894591da20ca6cf09c2395a78a37d29f639c8` |
| Browser extension version | `0.1.2` (`apps/extension/manifest.json`) |
| Node / npm | `v22.16.0` / `11.15.0` |
| Dirty tracked files at start | 122 (all preserved; none reverted) |
| `apps/extension`, `tests/extension` git state | clean at audit start |
| Worktrees present | `main`, `C:/tmp/soter-n8n-main` (prunable), `.claude/worktrees/agent-a4df8d1fa08aae01a`, `.kilo/worktrees/descriptive-peak` (prunable), `.tmp/n8n-0.3.2-release-worktree` |
| Runtime-lab tooling | Playwright `1.61.1`, `chromium-1228` + `chromium_headless_shell-1228` installed |
| HEAD at the runtime-lab run (§8) | `fec7be91` |
| Runtime-lab hosts | Playwright Chromium `149.0.0.0`; Microsoft Edge stable `151.0.0.0`. Chrome stable `147.0.7727.57` would not install an unpacked extension — see §8.5 |

**Safety constraints honoured for the whole programme:** no `reset`/`clean`/force-checkout, no
push/publish/deploy, no production credential use, no test weakening, no broad permission
requests, no remotely hosted code, no dynamic code execution, no unsafe CSP. Store submission
and enterprise-browser-policy deployment are explicitly out of scope without user action.

### 0.1 Baseline measurements

| Command | Result | Exit | Duration |
|---|---|---|---|
| `npx tsx --test tests/extension/*.test.ts` | **145 pass / 0 fail** | 0 | `duration_ms 20274.255` (wall ≈40 s) |

### 0.2 Evidence sources read (§2)

| Document | State |
|---|---|
| `docs/SOTERAI-TECHNICAL-SUPREMACY-REPORT.md` | EXISTS (759 lines) |
| `docs/SOTERAI-FINAL-TECHNICAL-COMPETITOR-COMPARISON.md` | EXISTS (306 lines) — records browser extension as "Build- and test-verified", *not* runtime-verified |
| `artifacts/security/capabilities.json` | EXISTS (22 capabilities; **0** are browser-extension enforcement capabilities) |
| `docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md` | CREATED BY THIS RUN |

The existing comparison document's own wording is consistent with this audit: the browser
extension is described as build/test-verified with "page/AI interaction and document-DLP hooks",
never as runtime-proven enforcement. No pre-existing document claimed browser-layer
enforcement that this audit has to retract.

---

## 1. Browser surface location (§2 — the extension is not assumed to live in one directory)

| Path | Contents | Browser extension? |
|---|---|---|
| `apps/extension` | 77 files, ≈4,265 LOC — MV3 Chrome/Edge extension (**the only browser surface**) | YES |
| `tests/extension/*.test.ts` | 18 files, 145 tests, run by `npm run test:extension` | tests for it |
| `extensions/{eclipse,jetbrains}` | IDE plugins | no |
| `packages/vscode-extension` | VS Code / Windsurf / Cursor IDE extension | no |
| `packages/{detectors,policy-engine,shared}` | Shared detection + policy libraries imported by the extension via relative paths | shared deps |
| `app/api/extension/*`, `lib/extension/*` | Backend control plane the extension talks to | server side |
| `dist/extension` | Build output | artefact |

---

## 2. Sub-service inventory (§3)

Evidence levels used: `ABSENT`, `UI_ONLY`, `CONFIG_ONLY`, `BUILD_GATE_ONLY`,
`UNIT_TESTED`, `DOM_GESTURE_ENFORCEMENT`, `RUNTIME_PROVEN`,
`ADVISORY_CLAIMED_AS_ENFORCEMENT`, `ARCHITECTURALLY_NON_FUNCTIONAL`.
A manifest entry, UI page, test name or route existence is **not** counted as runtime enforcement.

| ID | Browser sub-service | Entry point | Data handled | Enforcement point | Evidence level | Known bypass | Status |
|---|---|---|---|---|---|---|---|
| BS-01 | Extension self-security | `manifest.json`, `src/background/service-worker.ts` | Runtime messages, config, device token, policy bundle | `service-worker.ts` message router (`isObject()` only) | `UNIT_TESTED` — no sender/schema validation | Any sender reaching `onMessage`; unsigned policy; `SOTER_SET_STATE` privileged write | **WEAK** |
| BS-02 | AI prompt / search context firewall | `src/content/index.ts` → `submit-interceptor.ts`, `src/lib/scanner.ts` | Prompt text, selection, paste, response text | `submit-interceptor.ts` capture-phase `preventDefault()` + `overlay.ts` | `DOM_GESTURE_ENFORCEMENT` | Ctrl/Cmd+Enter, programmatic `fetch`/XHR, voice, "regenerate" | **PARTIAL** |
| BS-03 | File / document / image upload guard | `src/content/file-content-scanner.ts` (`change` on `input[type=file]`) | File bytes → extracted text | `clearBlockedFileInput()` | `DOM_GESTURE_ENFORCEMENT` | Drag-and-drop, `DataTransfer`, programmatic `FormData` | **PARTIAL** |
| BS-04 | Phishing / credential / identity guard | — | — | — | `ABSENT` | n/a | **UNAUDITED → ABSENT** |
| BS-05 | Browser agent action firewall | — (browser surface) | — | — | `ABSENT` | n/a | **ABSENT** |
| BS-06 | Malicious page / web-attack defence | — (no `declarativeNetRequest`) | — | — | `ABSENT` | n/a | **ABSENT** |
| BS-07 | Work / personal data boundaries | `packages/shared/src/ai-destinations.ts` + department/role | Destination classification | `policy-engine` rule match | `CONFIG_ONLY` | Personal profile, other browser, native app | **PARTIAL** |
| BS-08 | Shadow AI / SaaS / extension discovery | `src/content/index.ts` → `SOTER_DISCOVER_SHADOW_AI` | Hostname, risk guess | Backend `/api/extension/shadow-ai` | `ARCHITECTURALLY_NON_FUNCTIONAL` | Content script runs only on the 19 declared hosts; no `tabs` permission ⇒ undeclared domains never evaluated | **BROKEN CLAIM** |
| BS-09 | Privacy-preserving evidence | `src/lib/api-client.ts`, `src/lib/redaction.ts` | Hashes, categories, bounded previews | `assertNoRawSensitiveData()` + `sanitizePrivacyPayload()` | `UNIT_TESTED` (strong: 5 dedicated privacy test files) | 3 raw `fetch()` handlers in the SW bypass the client | **STRONG w/ HOLES** |
| BS-10 | Tamper-resistant policy + health | `src/background/policy-sync.ts`, `src/lib/policy-verification.ts` | Signed policy bundle | `verifyPolicySignature()` | `ADVISORY_CLAIMED_AS_ENFORCEMENT` | Hash covers no nested content; backend never signs; no-secret ⇒ `{valid:true}` | **BROKEN** |
| BS-11 | UI / UX leadership | `src/popup/PopupApp.tsx`, `src/sidepanel/SidePanelApp.tsx`, `src/content/overlay.ts` | Status + privacy disclosure | — | `UI_ONLY` | Health signals derived from a single status string | **UI_ONLY** |
| BS-12 | Performance / reliability | `tests/extension/performance-scanning.test.ts` | — | — | `UNIT_TESTED` | Not measured in a packaged browser | **PARTIAL** |
| BS-13 | Cross-browser packaged runtime | `apps/extension/scripts/validate-store-manifest.mjs` | — | Build gate | `BUILD_GATE_ONLY` | No packaged Chrome/Edge runtime proof exists | **UNPROVEN** |
| BS-14 | Fleet / enterprise controls | `managed-schema.json`, `src/background/{heartbeat,integrity}.ts` | Integrity report | Backend heartbeat | `PARTIAL` | `hardEnforcement` / `offlineFailClosed` are **not declared** in `managed-schema.json`, so Chrome/Edge managed storage never delivers them | **BROKEN PATH** |

---

## 3. Extension self-security threat model (§4)

### 3.1 Verified findings, ranked

Each finding is either **PROVEN** (an executed command reproduced it), **CODE-VERIFIED**
(read directly from the cited source, no runtime ambiguity), or **INFERRED**.

#### SS-1 — CRITICAL — Policy integrity is triply broken (`ADVISORY_CLAIMED_AS_ENFORCEMENT`)

**(a) The canonical hash covers almost nothing. PROVEN.**
`apps/extension/src/lib/policy-verification.ts` and `lib/extension/policySigning.ts` both compute:

```ts
const normalized = JSON.stringify(policyJson, Object.keys(policyJson as object).sort());
```

The second argument of `JSON.stringify` is a **replacer allowlist**, not a key ordering. It
filters object keys at *every* depth, so any nested key not present at the top level is dropped.
Executed proof against a representative policy bundle:

```
"riskThresholds":{}       // all four thresholds erased from the hash input
"rules":[{}]              // the entire ruleset erased from the hash input
HASH INPUTS EQUAL (rules+thresholds excluded from hash) -> true
```

The two compared bundles differed in `rules[0].action` (`block` → `allow`) and
`riskThresholds.block` (`85` → `100`). Their canonical hash inputs were byte-identical, so a
tampered policy that disables all blocking produces a valid `policyHash`.

**(b) The hash is never bound to the body. CODE-VERIFIED.**
`apps/extension/src/background/policy-sync.ts` passes `policyHash` straight into
`verifyPolicySignature()` and never recomputes it from the received policy. The signature
therefore attests `version|organizationId|updatedAt|policyHash` only — the ruleset can be
replaced wholesale while all four remain valid.

**(c) Nothing signs, and configuring signing breaks sync. CODE-VERIFIED.**
`lib/extension/policySigning.ts` (`signPolicyBundle`, `computePolicyHash`) has **zero callers**;
`app/api/extension/policy/route.ts` returns the compiled bundle with no `signature` and no
`policyHash`. Meanwhile `verifyPolicySignature()` opens with:

```ts
if (!signingSecret) return { valid: true };   // integrity disabled in the default deployment
```

So in the shipped configuration integrity is absent; and if an administrator *did* set
`policySigningSecret`, every sync would fail the "signature required but not present" branch and
the policy would freeze at the last cached value. The feature is non-functional in **both**
configurations. The scheme is also symmetric HMAC with the verification secret stored
client-side, and compares hex digests with `!==` (non-constant-time).

#### SS-2 — CRITICAL — `apiBaseUrl` trust / device-token exfiltration primitive. CODE-VERIFIED.

No component validates the scheme or host of `apiBaseUrl`:

- `src/lib/enrollment-ui.ts` lets the user type any API base URL and forwards it as
  `chrome.runtime.sendMessage({ type: "SOTER_ENROLL", enrollmentCode, apiBaseUrl })`.
- `src/lib/enrollment.ts::enrollWithCode()` `fetch`es it as given, then persists
  `apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : apiBaseUrl` — the
  **responding server chooses the origin** for every later policy fetch, audit event and
  heartbeat, permanently rebinding the client.
- `src/lib/api-client.ts::request()` attaches `x-soter-extension-token: deviceToken` to whatever
  origin results, with no allowlist check.
- Three service-worker handlers (`handleShadowAIDiscovery`, `handleCheckApprovalStatus`,
  `handleClaimApproval`) use raw `fetch()` instead of `SoterExtensionApiClient`, so they also skip
  `assertNoRawSensitiveData()` / `sanitizePrivacyPayload()`.

Impact: an `http://` or attacker-chosen origin can receive the device token and audit metadata,
and can then serve policy. This is the delivery vehicle that makes SS-1 remotely exploitable.

#### SS-3 — HIGH — No message-boundary security. CODE-VERIFIED.

`src/background/service-worker.ts` (439 lines) routes 14 message types behind a single guard:

```ts
if (!isObject(message)) return;   // isObject = Boolean(value && typeof value === "object")
```

There is no `sender.id` check, no `sender.tab`/`frameId`/`origin` scoping, no per-type schema, no
payload size bound, no message version, no nonce/replay window, and no fail-safe response for
unknown types. `SOTER_SET_STATE` performs `setState(message.state ?? {})` — an unrestricted
privileged write that can set `enabled:false`, replace the cached `policy`, or rewrite `config`
(including `apiBaseUrl` and `deviceToken`). **Zero senders of `SOTER_SET_STATE` exist in the
codebase**, so it is deletable dead attack surface.

Mitigating (confirmed good, do not "fix"): the manifest declares no `externally_connectable`, so
web pages cannot message the worker and other extensions would land on an unregistered
`onMessageExternal`; and there are no `web_accessible_resources`. The reachable sender set is
therefore the extension's own content scripts and UI pages — which still means **any page the
content script runs on can influence the worker through a compromised content-script context**,
and any future `externally_connectable` addition would be immediately exploitable.

#### SS-4 — HIGH — Tamper does not fail closed. CODE-VERIFIED.

`policy-sync.ts` sets `policySyncStatus: "error"` when verification fails, but `scanner.ts`
gates fail-closed on `state.policySyncStatus === "offline"` only:

```ts
if (state.policySyncStatus === "offline" && (policy.offlineFailClosed || state.config.offlineFailClosed))
```

So a *detected tamper event* is strictly weaker than a network outage. Additionally the
`syncPolicy` catch path writes `policySyncStatus: cached ? "offline" : "error"`, and
`getCachedPolicy()` always returns at least `defaultPolicy`, so `"error"` is unreachable from
that branch.

#### SS-5 — MEDIUM — No explicit extension-pages CSP. CODE-VERIFIED.

`manifest.json` declares no `content_security_policy`. MV3's default already forbids remote
scripts and `eval`, but the manifest does not pin `object-src`, `base-uri`, `form-action` or
`frame-ancestors`. Constraint discovered while planning the fix: the popup and side panel build
their own `<style>` block through `innerHTML`, and `scripts/validate-store-manifest.mjs` **rejects
any CSP containing `'unsafe-inline'`**. The hardened value must therefore omit `default-src` and
`style-src` entirely:

```
script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

#### SS-6 — MEDIUM — Overlay is page-tamperable. CODE-VERIFIED.

`src/content/overlay.ts` uses `host.attachShadow({ mode: "open" })` and marks the host with
`data-soter-overlay` on `document.documentElement`, with no watchdog. A hostile or merely
aggressive page can read/modify the shadow tree via `host.shadowRoot`, or remove the host node
outright, and nothing re-mounts it. (Confirmed good: every interpolated value —
`policy.userMessage`, `detected`, the preview textarea — passes through `escapeHtml()`.)

#### SS-7 — MEDIUM — Approval caches are unbounded and weakly bound. CODE-VERIFIED.

`submit-interceptor.ts` holds `approvedPrompts = new Set<string>()` keyed by raw prompt text and
`file-content-scanner.ts` holds `approvedFiles = new Set<string>()` keyed by `${name}:${size}`.
Neither has a TTL, a one-time-use guard, nor destination/tab binding — an approval granted for
one destination is reusable indefinitely on any other in-scope destination, and both sets grow
without bound for the lifetime of the page.

#### SS-8 — HONESTY — Shadow-AI discovery cannot fire. CODE-VERIFIED.

`src/content/index.ts` contains `SHADOW_AI_KNOWN_PLATFORMS`, `isAiLikelyHostname()` and
`inferShadowRiskLevel()`, and sends `SOTER_DISCOVER_SHADOW_AI`. But content scripts are injected
only on the 19 declared `host_permissions`, and the extension holds no `tabs` permission. An
undeclared ("shadow") domain therefore never executes the detector. The capability must be
reported as `ARCHITECTURALLY_NON_FUNCTIONAL` until a lawful discovery mechanism exists.

#### SS-9 — ARCHITECTURAL — `BLOCK` does not equal prevented submission. CODE-VERIFIED.

Enforcement is DOM-gesture-only: capture-phase `click` on submit-like controls and capture-phase
`keydown` for a **bare** `Enter` (`shiftKey || altKey || ctrlKey || metaKey` returns early). There
is no `declarativeNetRequest` ruleset. Ctrl/Cmd+Enter, voice input, "regenerate", and any
programmatic `fetch`/XHR send path are not interceptable. §8's requirement that "a BLOCK decision
must prevent submission" is **not currently met** — tracked as the primary Service-2 deliverable.

#### SS-10 — HIGH — Enterprise enforcement flags are undeliverable. CODE-VERIFIED.

`src/lib/enrollment.ts` and `src/lib/scanner.ts` both read `hardEnforcement` and
`offlineFailClosed` from managed config, but `apps/extension/managed-schema.json` declares only
`apiBaseUrl, organizationId, employeeId, email, department, role, deviceToken, policyChannel,
enrollmentMode, logLevel`. Chrome/Edge managed storage only surfaces properties present in the
schema, so an Intune/GPO administrator **cannot set either flag**. The entire hard-enforcement and
offline-fail-closed enterprise path is unreachable through its only documented control channel.

### 3.2 Self-security control checklist (§4 required architecture)

Baseline column = state at HEAD `30e89459`, before any change in this programme.

| # | Required control | Baseline | Finding |
|---|---|---|---|
| 1 | Least-privilege permissions | PASS — `contextMenus, sidePanel, storage, alarms` only; 19 explicit https hosts; no `<all_urls>` | — |
| 2 | Optional permissions for expansion | N/A — `optional_permissions` empty (nothing to gate yet) | — |
| 3 | No `externally_connectable` exposure | PASS — key absent | — |
| 4 | No web-accessible resources | PASS — key absent | — |
| 5 | Strict schema for every message | **FAIL** | SS-3 |
| 6 | Sender / origin / tab / frame validation | **FAIL** | SS-3 |
| 7 | Nonce + bounded replay protection | **FAIL** | SS-3, SS-7 |
| 8 | Versioned messages | **FAIL** | SS-3 |
| 9 | Fail-safe unknown-message handling | **FAIL** — unknown types fall through silently | SS-3 |
| 10 | Strict extension CSP | **FAIL** — not declared | SS-5 |
| 11 | No remotely hosted execution logic | PASS — build gate scans for `eval(`, `new Function(`, remote dynamic `import()` | — |
| 12 | No dynamic code execution | PASS — same gate | — |
| 13 | Privacy-minimised sensitive state | PARTIAL — `assertNoRawSensitiveData()` strong, but 3 raw-`fetch` handlers bypass it | SS-2 |
| 14 | Integrity-checked policy bundles | **FAIL (non-functional)** | SS-1 |
| 15 | Anti-rollback / version pinning | **FAIL** — absent | SS-1 |
| 16 | Restart-safe persisted state | PASS — all state in `chrome.storage.local`; SW holds no authoritative memory | — |
| 17 | Idempotent event registration | PASS — listeners registered once at module top level | — |
| 18 | Bounded ports / queues / alarms / timers | PARTIAL — alarms bounded; overlay approval poll bounded (3 s × 100); approval Sets unbounded | SS-7 |
| 19 | Explicit browser-version compatibility | PASS — `minimum_chrome_version: 116` | — |
| 20 | DOM XSS safety in injected UI | PASS — `escapeHtml()` on every interpolated value in `overlay.ts` | — |
| 21 | Tamper-resistant UI surface | **FAIL** — `mode:"open"` shadow root, no watchdog | SS-6 |
| 22 | Endpoint/origin pinning | **FAIL** | SS-2 |
| 23 | Fail-closed on integrity failure | **FAIL** | SS-4 |
| 24 | Enterprise policy channel completeness | **FAIL** | SS-10 |
| 25 | Secrets absent from logs | PASS — build gate scans for token logging | — |
| 26 | Incognito isolation | UNVERIFIED — no `incognito` key declared (Chrome default `spanning`) | tracked for Service 13 |
| 27 | Supply-chain hardening | PARTIAL — store validator rejects `.env`, `*.map`, `*.test.*`; no artefact hash/repro check for the browser build | tracked for Service 14 |

---

## 4. Browser threat matrix (§5)

"Runtime enforcement" = YES only where a code path technically prevents the action, not where a
warning, log or UI state is produced. Baseline as of HEAD `30e89459`.

### 4.1 AI and search data-leakage threats

| Threat | User harm | Current protection | Runtime enforcement | Bypass | Test | Priority |
|---|---|---|---|---|---|---|
| Typed prompt containing secrets/PII | Credential + PII leak to third-party AI | `scanText()` + policy eval + overlay | PARTIAL — bare `Enter` / submit-button click only | Ctrl+Enter, programmatic send | `detectors.test.ts`, `policy-engine.test.ts` | P1 |
| Paste of sensitive block into AI | Bulk leak | `installPasteListener` | PARTIAL — DOM `paste` event | Programmatic `value=` set, drag-drop | `privacy-security.test.ts` | P1 |
| Drag-and-drop text/file into AI | Bulk leak | none | **NO** | n/a | none | P1 |
| File upload (DOCX/XLSX/PPTX/PDF/CSV/source/image) | Document exfiltration | `file-content-scanner.ts` + `clearBlockedFileInput()` | PARTIAL — `change` on `input[type=file]` | Drag-drop, `DataTransfer`, programmatic `FormData` | `file-content-scanner*.test.ts` | P1 |
| Selected page context carried into AI | Cross-app data lineage leak | `source-lineage-entry.js` + `lineage-context.ts` (15-min TTL, hashed URL, 240-char redacted preview) | Advisory (context only) | Manual retype | `source-lineage.test.ts` | P2 |
| Clipboard read/write abuse | Silent capture | none | **NO** | n/a | none | P2 |
| Autofill data reaching AI | Credential leak | none | **NO** | n/a | none | P2 |
| Indirect prompt injection from page content | Agent hijack | `packages/detectors` exists but no browser-side page-content scan path | **NO** | n/a | none in `tests/extension` | P1 |
| AI response containing secrets | Leak back into workspace | `installResponseObserver` + `responseScanningEnabled` | Advisory (observe + audit) | Disabled by default per destination | `response-scanning-privacy.test.ts` | P2 |
| Shadow AI destination (undeclared domain) | Entire control plane bypassed | detector code exists but never executes | **NO** — see SS-8 | n/a | none | P1 |

### 4.2 Web and identity threats

| Threat | User harm | Current protection | Runtime enforcement | Bypass | Test | Priority |
|---|---|---|---|---|---|---|
| Credential phishing page | Account takeover | none | **NO** | n/a | none | P1 |
| IDN homograph / lookalike domain | Account takeover | none | **NO** | n/a | none | P1 |
| Form-action mismatch (visible host ≠ POST host) | Credential exfiltration | none | **NO** | n/a | none | P1 |
| Malicious OAuth consent grant | Persistent mailbox/drive access | none | **NO** | n/a | none | P2 |
| Clipboard hijacking (address/OTP swap) | Financial loss | none | **NO** | n/a | none | P2 |
| Tabnabbing / `window.opener` abuse | Session theft | none | **NO** | n/a | none | P3 |
| Malicious or over-permissioned other extension | Full page-data theft | none (platform-limited) | **NO** | n/a | none | P2 |
| Redirect-chain laundering | Phishing delivery | none | **NO** | n/a | none | P3 |
| Omnibox / address-bar search leakage | Query leak to non-work AI search | none — **no interception is technically available to an extension without an omnibox keyword or the `webRequest`/DNR path** | **NO** | n/a | none | P2 (honesty-critical) |

### 4.3 AI-agent browser threats

| Threat | User harm | Current protection | Runtime enforcement | Bypass | Test | Priority |
|---|---|---|---|---|---|---|
| Hidden page-text prompt injection driving an in-browser agent | Unauthorised actions as the user | none in the browser surface | **NO** | n/a | none | P1 |
| Unsafe agent tool call (purchase, send, delete, grant) | Irreversible action | none in the browser surface | **NO** | n/a | none | P1 |
| Approval fatigue / blanket approval | Silent bypass | overlay approval exists but approvals are unbounded and unbound (SS-7) | PARTIAL | reuse of a granted approval | `hard-enforcement.test.ts` | P2 |
| Agent memory / instruction poisoning | Durable compromise | none | **NO** | n/a | none | P2 |

### 4.4 Data-boundary threats

| Threat | User harm | Current protection | Runtime enforcement | Bypass | Test | Priority |
|---|---|---|---|---|---|---|
| Work data → personal AI account | Policy/compliance breach | destination + department/role rules | CONFIG_ONLY | personal browser profile | `destinations.test.ts` | P2 |
| Policy tamper via local storage write | All enforcement disabled | none functional (SS-1, SS-3, SS-4) | **NO** | direct `SOTER_SET_STATE` | none | **P0** |
| Device-token theft via rebound origin | Fleet impersonation | none (SS-2) | **NO** | server-supplied `apiBaseUrl` | none | **P0** |
| Cross-tenant data mixing in audit events | Confidentiality breach | `organizationId` on every payload + backend auth | Server-side | — | `privacy-backend-guards.test.ts` | P3 |
| OS-level screenshot / screen recording / native copy | Exfiltration outside the browser | **PLATFORM_UNSUPPORTED** — must never be claimed | n/a | n/a | n/a | honesty |

---

## 5. Service 1 — Extension self-security: pre-implementation comparison (§6)

**Research performed in this run (2026-07-31):** two bounded web searches. Findings used below are
labelled with their source in §5.2. **No competitor extension was installed, unpacked, decompiled
or inspected**, and no competitor traffic was observed — so competitor *internal* hardening is
recorded as `NOT_COMPARABLE` rather than as a SoterAI advantage. Missing competitor information is
never scored as a SoterAI win.

### 5.1 Comparison table (verdicts limited to the §6 vocabulary)

| Dimension | SoterAI now | SoterAI evidence | Current leader | Leader evidence | Verdict | Required improvement |
|---|---|---|---|---|---|---|
| Permission minimalism | 4 API permissions, 19 explicit https hosts, no `<all_urls>`, build-gate enforced | `manifest.json`; `scripts/validate-store-manifest.mjs` ALLOWED_PERMISSIONS gate | Enterprise browser-security extensions generally request broad host access to cover all AI/SaaS destinations (LayerX markets "natively integrates with any browser … no impact on UX") | Vendor marketing pages only; actual manifests not inspected in this run | `DISTINCTIVE` | Keep; add `optional_permissions` before any surface expansion |
| No web-page-reachable messaging surface | `externally_connectable` and `web_accessible_resources` both absent | `manifest.json` | Unknown for all vendors | Not published | `NOT_COMPARABLE` | Keep absent; add a build gate so it cannot be added silently |
| Runtime message authentication | **None** — `isObject()` only, 14 handlers, incl. an unrestricted `SOTER_SET_STATE` state write | `src/background/service-worker.ts` | Chromium's own renderer→browser boundary is the reference pattern; incomplete validation there is tracked as RCE-class (CVE-2026-17806, CVE-2026-17749) | Public CVE records | `WEAKER` | Per-type schema + sender/frame scoping + size bounds + fail-safe unknown; delete `SOTER_SET_STATE` |
| Policy bundle integrity | Non-functional: hash excludes all nested content (PROVEN), hash never bound to body, backend never signs, no-secret ⇒ `{valid:true}` | §3.1 SS-1 | Signed-manifest / pinned-key distribution is standard practice for security-tool policy channels | Pattern, not a specific vendor disclosure | `WEAKER` | Shared canonical serialiser + content-bound hash + asymmetric signature + anti-rollback + fail-closed |
| Endpoint / origin pinning | None; server can rebind `apiBaseUrl` and receive the device token | §3.1 SS-2 | Enterprise-managed extensions are configured by MDM/GPO, which structurally pins the tenant endpoint | Chrome/Edge managed-storage platform behaviour | `WEAKER` | https-only + no IP literals + managed pin + first-enrollment pin + reject server-supplied origin change |
| Enterprise policy channel completeness | `hardEnforcement` / `offlineFailClosed` read by code but **not declarable** in `managed-schema.json` | §3.1 SS-10 | Managed-storage schema completeness is table stakes for any MDM-deployed extension | Chrome managed-storage docs behaviour | `WEAKER` | Declare both flags (+ policy pin fields) in the schema and gate with a test |
| Extension-pages CSP | Not declared (MV3 defaults only) | `manifest.json` | Explicit `object-src`/`base-uri`/`frame-ancestors` pinning is standard hardening | Platform guidance | `WEAKER` | Declare a CSP with no `'unsafe-inline'` and require it in the store validator |
| Injected-UI tamper resistance | `attachShadow({mode:"open"})`, no watchdog; page can read or remove the overlay | §3.1 SS-6 | LayerX's own "Man-in-the-Prompt" research shows any installed extension can read and write GenAI prompt DOM — i.e. injected security UI is an actively attacked surface | Published vendor research | `WEAKER` | Closed shadow root + re-mount watchdog + non-dismissible hard-block path |
| No remote code / no dynamic execution | PASS, build-gated (`eval(`, `new Function(`, remote dynamic `import()`, token logging) | `scripts/validate-store-manifest.mjs` | Assumed parity across reputable vendors | Not published per-vendor | `ARCHITECTURAL_PARITY` | Keep |
| Privacy minimisation of telemetry | Strong: `assertNoRawSensitiveData()`, `sanitizePrivacyPayload()`, hashed URLs, bounded previews, 5 dedicated test files | `src/lib/api-client.ts`; `privacy-*.test.ts` | Vendors publish DLP capability, not their own telemetry-minimisation invariants | Not published | `DISTINCTIVE` (invariant is test-enforced, which is unusual and checkable) | Close the 3 raw-`fetch` bypasses so the invariant is total |
| Fail-closed on tamper | Fail-closed exists for `"offline"` only, not for `"error"` | §3.1 SS-4 | Fail-closed-on-integrity-failure is the expected posture for enforcement agents | Pattern | `WEAKER` | Treat integrity failure as at least as severe as offline |
| Restart-safe state / idempotent listeners | PASS — all authority in `chrome.storage.local`; listeners registered once | `src/background/*` | Assumed parity | Not published | `ARCHITECTURAL_PARITY` | Keep; add an SW-restart regression test |

**Honest summary of Service 1 before implementation:** SoterAI leads on permission minimalism,
attack-surface absence and test-enforced telemetry privacy; it is **WEAKER on every integrity and
trust-boundary dimension** — message authentication, policy signing, endpoint pinning, managed-schema
completeness, CSP, UI tamper resistance and fail-closed behaviour. Six of these are the
IMPLEMENT_NOW set below.

### 5.2 Research sources used (public, this run)

- LayerX GenAI DLP capability description — <https://www.pixiebrix.com/tool/layerx>
- LayerX "Man-in-the-Prompt" extension→prompt-DOM injection research — <https://layerxsecurity.com/blog/man-in-the-prompt-top-ai-tools-vulnerable-to-injection/>
- SquareX browser-DLP scope (clipboard, uploads/downloads, GenAI) — <https://www.pixiebrix.com/tool/squarex>
- Browser-DLP market baseline "redact, warn, or block the submission" — <https://www.strac.io/blog/best-browser-dlp>
- AI browser extensions as an unmonitored AI channel — <https://thehackernews.com/2026/04/browser-extensions-are-new-ai.html>
- "Prompt poaching" AI extensions — <https://www.infosecurity-magazine.com/news/experts-prompt-poaching-browser/>
- MV3 removes real-time network interception (declarative, capped rules only) — <https://korben.info/en/chrome-kills-last-workarounds-keeping-ublock-origin-alive.html>
- Chromium message-boundary validation failures as RCE/sandbox-escape class — <https://www.sentinelone.com/vulnerability-database/cve-2026-17806/>, <https://www.sentinelone.com/vulnerability-database/cve-2026-17749/>

---

## 6. Service 1 — market-gap validation and scoring (§7)

Ten questions applied to each candidate. `Real` = does it close a real, reproducible attack path?
`Harm` = severity of the harm prevented. `Freq` = how often the path is reachable in normal use.
`Platform` = technically achievable inside an MV3 extension. `Evidence` = can we prove the fix with
a test or runtime artefact? `Cost` = implementation + maintenance burden (low is better).
`Perm` = does it require new permissions? `Priv` = privacy impact. `Dup` = does it duplicate an
existing control? `Value` = user/enterprise value. Score = sum of the eight positive columns
(0–5 each, `Cost`/`Perm` scored inverted so higher is always better).

| Candidate | Real | Harm | Freq | Platform | Evidence | Cost⁻¹ | Perm⁻¹ | Value | Score | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| SS-1 Content-bound policy signing (shared canonical serialiser, asymmetric, anti-rollback, backend wired) | 5 | 5 | 5 | 5 | 5 | 3 | 5 | 5 | **38** | `IMPLEMENT_NOW` |
| SS-2 Endpoint trust pinning (https-only, no IP literals, managed/first-enrollment pin, reject server rebind) | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **39** | `IMPLEMENT_NOW` |
| SS-3 Message guard (per-type schema, sender scope, size bounds, fail-safe unknown, delete `SOTER_SET_STATE`) | 5 | 4 | 5 | 5 | 5 | 4 | 5 | 4 | **37** | `IMPLEMENT_NOW` |
| SS-4 Fail-closed on integrity error + honest health surface | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | **39** | `IMPLEMENT_NOW` |
| SS-10 Managed-schema completeness for enforcement flags | 5 | 4 | 4 | 5 | 5 | 5 | 5 | 5 | **38** | `IMPLEMENT_NOW` |
| SS-5 Explicit hardened extension-pages CSP + validator requirement | 4 | 3 | 3 | 5 | 5 | 5 | 5 | 3 | **33** | `IMPLEMENT_NOW` |
| SS-6 Closed shadow root + overlay watchdog | 4 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | **34** | `IMPLEMENT_NOW` (Service 2 — it is an enforcement-UI control, sequenced with the firewall kernel) |
| SS-7 Bounded, one-time, destination-bound approvals | 4 | 4 | 3 | 5 | 5 | 4 | 5 | 4 | **34** | `IMPLEMENT_NOW` (Service 2) |
| SS-8 Honest downgrade of shadow-AI discovery + remove the dead claim | 5 | 2 | 2 | 5 | 5 | 5 | 5 | 4 | **33** | `IMPLEMENT_NOW` (honesty fix; capability re-classified, code left in place and marked) |
| SS-9 Network-layer block (`declarativeNetRequest`) so BLOCK truly prevents submission | 5 | 5 | 5 | 3 | 4 | 2 | 2 | 5 | **31** | `DEFER_WITH_REASON` → Service 2. Needs a new `declarativeNetRequest` permission and careful scoping; must not be bolted onto the self-security pass. |
| Cryptographic attestation of the extension bundle at runtime | 3 | 3 | 1 | 1 | 2 | 2 | 5 | 2 | 19 | `PLATFORM_UNSUPPORTED` — an extension cannot verifiably self-attest its own code to a server; the browser provides no such primitive |
| Detecting other installed extensions' code or traffic | 4 | 4 | 3 | 1 | 1 | 2 | 1 | 4 | 20 | `PLATFORM_UNSUPPORTED` — requires the `management` permission for *names only*; private code and traffic are never available |
| Preventing OS screenshots / screen recording / native-app copy | 4 | 4 | 3 | 0 | 0 | 1 | 5 | 4 | 21 | `PLATFORM_UNSUPPORTED` — outside the browser boundary; must never be claimed |
| Omnibox / address-bar query interception by default | 3 | 3 | 4 | 1 | 1 | 2 | 1 | 3 | 18 | `PLATFORM_UNSUPPORTED` by default — only an explicit omnibox keyword or a network-layer rule can observe it; **no default omnibox protection will be claimed** |
| Full browsing-history collection for "visibility" | 2 | 1 | 5 | 4 | 3 | 3 | 1 | 1 | 20 | `REJECT_LOW_VALUE` — high privacy cost, needs `history`/`tabs`, and §11 forbids default history collection |
| Blocking browser-engine zero-days | 5 | 5 | 1 | 0 | 0 | 1 | 5 | 5 | 22 | `PLATFORM_UNSUPPORTED` — must never be claimed |

**Service 1 IMPLEMENT_NOW set:** SS-1, SS-2, SS-3, SS-4, SS-5, SS-10.
**Deferred to Service 2 with reason:** SS-6, SS-7 (enforcement-UI, sequenced with the firewall
kernel), SS-9 (new permission + scoping design).
**Honesty re-classification in Service 1:** SS-8.

---

## 7. Service 1 — implementation record (§24)

Implemented in this pass: **SS-1, SS-2, SS-3, SS-4, SS-5, SS-10**, plus **SS-11**, a CRITICAL
finding that did not exist in the pre-implementation inventory because it was discovered *while
writing the SS-4 adversarial tests*. Nothing was committed, pushed, published or deployed; all
122 pre-existing dirty tracked files are untouched.

### 7.1 Before/after chart

| Dimension | Before | Implemented change | After evidence | Current market leader | Final verdict |
|---|---|---|---|---|---|
| SS-1 Policy bundle integrity | Hash used the `JSON.stringify(policy, keys)` **replacer-allowlist** overload, so every nested field (`rules[]`, `riskThresholds`, `destinations[]`) was excluded — a bundle with `block` flipped to `allow` hashed identically. Hash never bound to the body. Backend never signed. No-secret ⇒ `{valid:true}`. | Single shared implementation `packages/shared/src/policy-integrity.ts`: recursive canonical JSON (depth-capped, sorted at every level), SHA-256 content hash over the whole body, domain-separated signing payload binding algorithm + tenant + version + `issuedAt` + hash, ECDSA P-256 preferred with HMAC gated behind an explicit opt-in, anti-rollback and a signed-bundle trust ratchet. Server adapter `lib/extension/policySigning.ts` rewritten as a key-material adapter with **no second crypto implementation**; `app/api/extension/policy/route.ts` now signs the exact object it serialises. | `policy-integrity.test.ts` 23/23; `policy-signing-e2e.test.ts` 11/11 — SG-602 asserts 8 nested mutations all produce `hash_mismatch`, and a re-signed forgery produces `signature_mismatch` | Signed/pinned-key policy distribution is standard practice for security-tool policy channels (pattern, not a specific vendor disclosure) | `ARCHITECTURAL_PARITY` on the mechanism, `DISTINCTIVE` on the tested invariants |
| SS-2 Endpoint trust pinning | Server-supplied `apiBaseUrl` could rebind the control plane and receive the device token. | `apps/extension/src/lib/trusted-endpoint.ts`: https-only (http for loopback only), no credentials-in-URL, no remote IP literals, punycode rejection, trailing-dot + case canonicalisation, exact-origin pin match, path-cannot-escape-origin, `credentials: "omit"`, `redirect: "error"`; single re-anchoring `request` in `api-client.ts`. | `trusted-endpoint.test.ts` 16/16; `enrollment-trust.test.ts` 10/10 | MDM/GPO configuration structurally pins the endpoint for managed extensions | `ARCHITECTURAL_PARITY` |
| SS-3 Runtime message authentication | 14 handlers behind `isObject()` only, including an unrestricted `SOTER_SET_STATE` that let any content script rewrite enforcement state. | `apps/extension/src/lib/message-guard.ts`: per-type schema, sender/frame/origin scoping, size bounds, fail-safe unknown-type rejection; `SOTER_SET_STATE` deleted. | `message-boundary.test.ts` 24/24 | Chromium's renderer→browser validation is the reference pattern (incomplete validation there is tracked as RCE-class: CVE-2026-17806, CVE-2026-17749) | `ARCHITECTURAL_PARITY` |
| SS-4 Fail-closed on integrity failure | Gated on `policySyncStatus === "offline"` **and** an availability flag, so a *detected tamper event* (which sets `"error"`) fell through to normal evaluation — a detected attack was strictly weaker than a network outage. | Three ordered gates in `failClosedDecision`: positive tamper codes block regardless of any availability flag; `requirePolicySignature` blocks anything not cryptographically verified; `offline`/`error` block when either fail-closed flag is set. `verified` (not the code string) is the authority. | `policy-fail-closed.test.ts` 13/13 — FC-401 covers all 6 tamper codes while `fresh` with no flag set; FC-403 proves `verified: true` never blocks (inverted-check defence); FC-407 proves `error` behaves exactly like `offline` | Fail-closed-on-integrity-failure is the expected posture for enforcement agents | `ARCHITECTURAL_PARITY` |
| SS-5 Extension-pages CSP | Not declared; MV3 implicit defaults only, so a later manifest edit could relax it silently. | `script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'` declared in **both** manifests; required by `scripts/validate-store-manifest.mjs`; now also required by the test suite. | `manifest-invariants.test.ts` 10/10 — MF-501/502/503 pin the directives, forbid 6 weakening tokens and require the dev manifest to match the store manifest; MF-504 proves the pages contain no inline script or inline handler, so the policy is actually compatible | Explicit `object-src`/`base-uri` pinning is standard hardening | `ARCHITECTURAL_PARITY` |
| SS-10 Managed policy channel | `hardEnforcement` and `offlineFailClosed` were read by code but **undeclared** in `managed-schema.json`. Chrome/Edge only surface declared properties, so both enterprise switches silently did nothing. | Both declared, plus `requirePolicySignature` and `policyTrustedKeys` (keyId/algorithm/publicKey), all booleans defaulting to `false`. | MF-510/511/512/513 — MF-511 derives the read-set from `enrollment.ts` at test time, so a newly read-but-undeclared field fails the suite instead of failing silently in the field; MF-512 proves the schema's `algorithm` enum equals the parser's allowlist exactly | Managed-schema completeness is table stakes for MDM-deployed extensions | `ARCHITECTURAL_PARITY` |
| **SS-11 Fail-closed remediation leak (NEW, CRITICAL)** | The fail-closed result carried `rewrittenSafeText: text` — the **raw prompt**. Every consumer treats that field as the safe variant: the overlay renders it as "Redacted/Safe Preview", `submit-interceptor.onReplace` wrote it into the page input, whitelisted it in `approvedPrompts` and **replayed the submit**, and "Copy safe prompt" put it on the clipboard. One click on the primary, safe-sounding button sent the unredacted prompt — secrets included — to the destination the extension had just refused. | Three layers. Kernel: the fail-closed result emits `redactedText` in both `rewrittenSafeText` positions. Authority: `FAIL_CLOSED_RULE_IDS` / `isFailClosedBlock` / `remediationAffordances` live next to the decision, so the UI cannot invent an affordance the kernel did not authorise. UI: the overlay renders no replace button for a fail-closed block (only "Copy redacted preview" and an audited, non-submitting "Dismiss", badged "Submission Blocked — Policy Unverified"); `submit-interceptor.onReplace` refuses even if invoked directly, so an injected click on a stale overlay cannot reach the submit path. | FC-410 (no `AKIAIOSFODNN7EXAMPLE` anywhere in the serialised result, and `rewrittenSafeText === redactedText`), FC-411 (all three fail-closed varieties authorise nothing), FC-412 (an ordinary content block keeps its remediation path — the guard is not a blanket refusal), FC-414 (holds for all 6 event types). **Regression probe:** restoring `rewrittenSafeText: text` failed FC-410 and FC-414 (11 pass / 2 fail, EXIT=1); the fix returns 13/13. | Not comparable — this is a defect in SoterAI's own remediation path, not a market dimension | `STRONGER_VERIFIED` (relative to SoterAI's own prior behaviour) |

### 7.2 Real threats closed

- Policy tampering in transit or at rest: any nested edit now breaks the content hash, and any
  re-signature breaks authenticity. The eight mutations in SG-602 are exactly the ones the old
  top-level-only hash could not see.
- Cross-tenant policy replay (`organization_mismatch`) and downgrade-to-older-bundle
  (`rollback`), both proven against validly signed bundles.
- Control-plane rebinding and device-token capture by a compromised or hostile policy server.
- Page-originated enforcement-state rewrites via `SOTER_SET_STATE`.
- A detected tamper event being *weaker* than a network outage.
- Silent failure of two enterprise enforcement switches that an administrator believed were on.
- **SS-11:** the strongest block in the system handing the raw prompt back to the page through
  the button labelled as safe.

### 7.3 Data paths protected

`page input → content script → service worker → scan kernel → decision → overlay → (replace /
replay / clipboard) → destination`. The kernel is now the only authority for what the last three
steps may do, and in a fail-closed state the only text it will emit is the redacted variant.
`enrollment → managed config → trusted keys → policy fetch → integrity verify → adopt` is pinned
end to end, and the fetch cannot be re-anchored by the response it is fetching.

### 7.4 Known bypasses that remain (honest)

- A **BLOCK is still enforced at the DOM/submit layer, not at the network layer.** A page that
  posts its own `fetch` without touching the observed input, or a user who retypes the text into
  a destination the manifest does not match, is not intercepted. `declarativeNetRequest` is the
  only real fix and is `DEFER_WITH_REASON` (SS-9, Service 2) because it needs a new permission.
- `approvedPrompts` and `replayBypass` are still unbounded, non-one-time and not destination-bound,
  and `approvedPrompts.has(text)` short-circuits `handleIntent` **before** any scan (SS-7,
  Service 2).
- The overlay still uses `attachShadow({mode:"open"})` with no re-mount watchdog, so a hostile
  page or another extension can read or remove it (SS-6, Service 2). LayerX's published
  "Man-in-the-Prompt" research shows this is an actively attacked surface.
- Drag-and-drop text/files, clipboard hijacking, autofill and indirect prompt injection from page
  content have **no** browser-side enforcement path yet (§4.1).
- Signing is fail-open **at the server** (a key fault serves an unsigned bundle rather than an
  outage) and fail-closed **at the client** (`requirePolicySignature` blocks). That is deliberate:
  only the client knows whether its tenant demands a signature. A deployment that sets neither a
  signing key nor `requirePolicySignature` is unsigned and is reported as `verified: false` — it
  is never described as verified.
- Nothing here defends against browser-engine zero-days, OS-level screenshots, another
  extension's private code or traffic, or omnibox queries. Those stay `PLATFORM_UNSUPPORTED`.

### 7.5 Rejected low-value ideas (this pass)

Full browsing-history collection (`REJECT_LOW_VALUE`), runtime self-attestation of the extension
bundle, other-extension code/traffic inspection, OS screenshot prevention, default omnibox
interception, and blocking browser-engine zero-days — all `PLATFORM_UNSUPPORTED`, scored in §6 and
not implemented. No feature was added to increase count.

### 7.6 Permissions, privacy, performance

- **Permissions added: none. Permissions removed: none.** Still exactly
  `contextMenus, sidePanel, storage, alarms` and 20 explicit https hosts, now pinned by
  MF-506 as well as by the store validator. `optional_permissions` remains empty and MF-505
  fails if anything is added there without a gate.
- **Privacy:** strictly improved. SS-11 removed a raw-prompt egress path; findings previews in the
  fail-closed result go through `auditSafePreview`; no new field is stored or transmitted. No
  password, OTP, cookie or form content is read or persisted anywhere in this pass. Signing key
  material lives only in the server environment — SG-608 asserts the private key appears in
  neither the status object nor the served bundle.
- **Performance:** verification is one SHA-256 plus one ECDSA verify per policy *fetch* (not per
  keystroke), off the enforcement path; `scanPrompt` is unchanged in complexity and stays pure.
  Full extension suite 252 tests in 14.0 s.

### 7.7 Files changed

| File | Change |
|---|---|
| `packages/shared/src/policy-integrity.ts` | NEW — the single canonicalisation/hash/sign/verify implementation |
| `packages/shared/src/index.ts` | export the above |
| `apps/extension/src/lib/trusted-endpoint.ts` | NEW — endpoint pinning |
| `apps/extension/src/lib/message-guard.ts` | NEW — per-type message schemas and sender scoping |
| `apps/extension/src/lib/policy-verification.ts` | delegate to the shared module; trust state from managed config |
| `apps/extension/src/lib/scanner.ts` | SS-4 gate ordering; SS-11 redacted-only emission; `FAIL_CLOSED_RULE_IDS`, `isFailClosedBlock`, `remediationAffordances` |
| `apps/extension/src/content/overlay.ts` | SS-11 — no replace button on a fail-closed block; audited dismiss; unverified-policy badge |
| `apps/extension/src/content/submit-interceptor.ts` | SS-11 — `onReplace` refuses when the kernel authorises no replacement |
| `apps/extension/src/lib/api-client.ts`, `src/lib/enrollment.ts`, `src/lib/types.ts`, `src/background/service-worker.ts`, `src/background/policy-sync.ts` | wire pinning, message guard, integrity result and trust ratchet |
| `apps/extension/manifest.json`, `manifest.dev.json` | SS-5 CSP; `managed_schema` |
| `apps/extension/managed-schema.json` | SS-10 — four enforcement fields declared |
| `apps/extension/scripts/validate-store-manifest.mjs` | require the CSP; forbid `sandbox`/`externally_connectable`; WAR rules; built-JS code smells |
| `lib/extension/policySigning.ts` | REWRITTEN — key-material adapter over the shared module; the broken `computePolicyHash` and trust-on-first-use `verifyPolicySignature` are gone |
| `app/api/extension/policy/route.ts` | signs the served bundle when a key is configured |
| `scripts/extension/generate-policy-key.ts` | NEW — operator keypair generation + rotation guidance |
| `tests/extension/{trusted-endpoint,enrollment-trust,message-boundary,policy-integrity,policy-fail-closed,manifest-invariants,policy-signing-e2e}.test.ts` | NEW — 107 adversarial tests |

### 7.8 Verification (commands, results, exit codes)

| Command | Result | Exit |
|---|---|---|
| `npx tsx --test tests/extension/trusted-endpoint.test.ts` | 16 pass | 0 |
| `npx tsx --test tests/extension/enrollment-trust.test.ts` | 10 pass | 0 |
| `npx tsx --test tests/extension/message-boundary.test.ts` | 24 pass | 0 |
| `npx tsx --test tests/extension/policy-integrity.test.ts` | 23 pass | 0 |
| `npx tsx --test tests/extension/policy-fail-closed.test.ts` | 13 pass, `duration_ms 1416.4` | 0 |
| `npx tsx --test tests/extension/manifest-invariants.test.ts` | 10 pass, `duration_ms 1247.3` | 0 |
| `npx tsx --test tests/extension/policy-signing-e2e.test.ts` | 11 pass | 0 |
| `npx tsx --test tests/extension/*.test.ts` | **252 pass / 0 fail**, `duration_ms 14036.3` (baseline at HEAD 30e89459 was 145) | 0 |
| `npm run typecheck:extension` | clean, 19.5 s | 0 |
| `npx tsc --noEmit` (whole repo) | 0 errors, 73.7 s | 0 |
| `npm run build` (apps/extension, vite) | built, 37.6 s | 0 |
| `npm run validate:store` | PASSED — 4 permissions, 20 https hosts, no localhost | 0 |
| `npx tsx --test tests/api-route-audit.test.ts tests/admin-ai-policies/*.test.ts` | 17 pass (policy-route change does not regress the route audit) | 0 |
| `npx tsx scripts/extension/generate-policy-key.ts probe-key` | ephemeral P-256 keypair printed (probe key discarded, never stored) | 0 |

**Negative controls (a test suite that cannot fail proves nothing):**

| Injected regression | Detected by | Result |
|---|---|---|
| `rewrittenSafeText: text` restored in the fail-closed path | FC-410, FC-414 | 11 pass / 2 fail, EXIT=1 |
| `'wasm-unsafe-eval'` added to the dev manifest CSP | MF-501, MF-502, MF-503 | EXIT=1 |
| `offlineFailClosed` default flipped to `true` in the schema | MF-513 | EXIT=1 |

All three injections were reverted immediately and the suites returned to green. No test was
weakened or skipped to make anything pass.

### 7.9 Completion gate status for Service 1 (§25)

| Sub-service item | Status |
|---|---|
| SS-1 policy integrity | `ENFORCED_TESTED` — server signs, client verifies, both halves tested end to end; runtime-proved by RT-704 (§8) |
| SS-2 endpoint pinning | `ENFORCED_TESTED` — runtime-corroborated by RT-703 (§8): with all real DNS blackholed, every request the extension made landed on the pinned host |
| SS-3 message boundary | `ENFORCED_TESTED` — runtime-proved by RT-706 (§8) |
| SS-4 fail-closed gate | `ENFORCED_TESTED` — runtime-proved by RT-704 (§8) |
| SS-5 extension CSP | `ENFORCED_TESTED` — runtime-proved by RT-701 (§8): both extension pages render under the hardened CSP with zero `securitypolicyviolation` events, in Chromium and in Edge |
| SS-10 managed schema | `ENFORCED_DECLARATIVE` — schema completeness is test-gated; **delivery through a real enterprise browser policy requires user action and is not claimed** |
| SS-11 remediation authority | `ENFORCED_TESTED` — runtime-proved by RT-708 (§8) |
| SS-6, SS-7 | `OPEN` — Service 2 |
| SS-8 | `OPEN` — honesty re-classification pending in `artifacts/security/capabilities.json` |
| SS-9 | `DEFER_WITH_REASON` — Service 2 |

**Runtime status.** The packaged-extension runtime lab now exists and passes: isolated browser
profiles, a bounded loopback server that is simultaneously the destination and the control plane,
proof that blocked data is absent from every received body, and proof that the hardened CSP does
not break the popup or the side panel. Everything in §7.8 above is still only source- and
unit-level evidence — per §3 that is not accepted as proof of runtime enforcement — so the runtime
claims in this report rest on §8 and nothing else. Two boundaries remain explicitly unclaimed:
Chrome **stable** could not be used as a host (§8.5), and SS-10's delivery through a real
enterprise browser policy still requires user action.

## 8. Runtime proof — packaged-extension runtime lab (§5.1–§5.4, §22, §27)

### 8.1 What was actually run, and what it deliberately is not

The artefact under test is the **store zip**, extracted to a throwaway directory and installed
into a fresh browser profile — not `dist/extension/`, and not a test build. The page under test is
served on `https://chatgpt.com`, an origin the *shipped* manifest genuinely matches, so no
manifest was widened to make the content script inject. The extension's own API base
(`https://soterai.in`) is mapped to the same loopback server, which therefore sees every audit,
scan and lineage request the extension emits — that is what makes "the secret reached no endpoint"
a searchable fact rather than an inference. Every other hostname resolves to `~NOTFOUND`, so
nothing can leave the machine even if the extension tried.

Nothing in this section is derived from a manifest entry, a route, a UI page or a unit test. Each
row below is an observation of a state change the browser made: a request that is absent from the
server's received log, a page handler whose counter never incremented, a byte sequence absent from
every body, a `sendResponse` that never came.

What this lab does **not** prove: that a real Chrome **stable** install enforces the same
behaviour (§8.5), that an enterprise managed-policy deployment delivers the schema (SS-10), or
anything about the real chatgpt.com DOM — the page is synthetic, carrying only the two selectors
the shipped ChatGPT adapter uses.

### 8.2 Command, duration, exit code (§27)

| Item | Value |
|---|---|
| Prerequisite | `cd apps/extension && npm run package` (the lab refuses to run without the store zip) |
| Command | `npm run test:extension:runtime` → `playwright test --config playwright.extension.config.ts` |
| Result | **16 passed / 0 failed / 0 skipped** (8 tests × 2 engines) |
| Reported duration | `30.1s` (wall clock including browser launches: 33 s) |
| Exit code | `0` |
| Mode | headed, `workers: 1`, `fullyParallel: false`, `retries: 0`, serial within the file |
| Host | Windows 11 (10.0.26300), repo HEAD `fec7be91` |

`retries: 0` is deliberate: a retry relaunches the browser and would convert a flaky enforcement
failure into a pass, which is the one kind of evidence this suite must never produce. The run was
headed because MV3 service workers are not registered for unpacked extensions in headless
Chromium — the `SOTER_LAB_HEADLESS=1` escape hatch exists but was **not** used, so these results
are from a real windowed browser.

### 8.3 Artefact provenance (§27)

The suite prints its own provenance record at the start of each engine's run (RT-700), so the
values below are transcribed from the run rather than from memory.

| Item | Value |
|---|---|
| Extension version | `0.1.2` |
| Chromium project artefact | `apps/extension/dist/soter-extension-chrome-v0.1.2.zip` |
| Edge project artefact | `apps/extension/dist/soter-extension-edge-v0.1.2.zip` |
| SHA-256 of both zips | `acdf6d335bfd525a322a5bf66bcb6fde32e4a36bd060eea4d777b4bcc34a9b64` (byte-identical) |
| Manifest SHA-256 inside the loaded artefact | `a25618c027926baab7603cd1612968164f471fa281078b712b1e63517fcbae8e` |
| `dist/extension/manifest.json` SHA-256 | `a25618c027926baab7603cd1612968164f471fa281078b712b1e63517fcbae8e` — equal, asserted by RT-700 |
| Chromium engine user-agent | `…AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36` |
| Edge engine user-agent | `…Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0` (installed Microsoft Edge stable) |

The two store zips being byte-identical is worth stating plainly: the per-engine difference in this
run is the **browser**, not the package. Launch switches, identical for both projects apart from
the generated paths, port and key:

```
--disable-extensions-except=<extracted store zip>
--load-extension=<extracted store zip>
--host-resolver-rules=MAP chatgpt.com 127.0.0.1:<port>,MAP soterai.in 127.0.0.1:<port>,MAP * ~NOTFOUND,EXCLUDE localhost
--ignore-certificate-errors-spki-list=<base64 SHA-256 of the ephemeral lab SPKI>
--no-first-run --no-default-browser-check
```

Two switch choices are themselves part of the evidence. `--ignore-certificate-errors-spki-list`
trusts exactly one ephemeral public key, so the blanket `--ignore-certificate-errors` is never
used and TLS validation stays on for everything else. `MAP * ~NOTFOUND` blackholes the rest of the
internet, and RT-700 proves it by navigating to `https://example.com/` and requiring
`ERR_NAME_NOT_RESOLVED`. The profile is a fresh temp directory per run, so the install is a genuine
first install and `chrome.runtime.onInstalled` fires — which is what triggers the first policy
sync the fixture waits for.

### 8.4 Per-test, per-engine results

Both engines ran the identical suite. Every row passed on both; the durations are from the
canonical run in §8.2.

| Test | Proves | Chromium 149 | Edge 151 |
|---|---|---|---|
| RT-700 lab integrity | The artefact loaded is the packaged one (manifest hash equals the built manifest), the page is on an impersonated `https://chatgpt.com`, the *running* extension reports the packaged `permissions` / `host_permissions` / CSP / `content_scripts[0].matches`, real DNS is blackholed, and the guard claimed the domain | PASS 900ms | PASS 1.2s |
| RT-701 SS-5 CSP | Popup **and** side panel render (`#root` non-empty, which only happens after their module script runs and a `SOTER_GET_STATE` round-trip returns) with zero `securitypolicyviolation` events and zero CSP console errors, under `script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'` | PASS 856ms | PASS 1.1s |
| RT-702 BLOCK | The **page's own** bubble-phase submit handler never ran: `#sent-count` stayed `0`, `window.__labSent` empty, `#ingest-status` still `idle`, and the typed prompt was left byte-for-byte intact (a block is not a silent rewrite) | PASS 744ms | PASS 879ms |
| RT-703 BLOCK / no leak | After waiting for a real audit POST to arrive (so the search is not vacuous), the destination received **nothing** and `AKIA…EXAMPLE` appears in **no** body the extension emitted — including its own audit, scan and lineage telemetry | PASS 798ms | PASS 1.3s |
| RT-705 REDACT | The transformation happened *before* the bytes left: the destination's received body carries `[REDACTED_AWS_KEY]` and the surviving benign text, never the secret | PASS 798ms | PASS 824ms |
| RT-704 / RT-708 tamper | A bundle signed correctly and then mutated two levels deep is rejected as `hash_mismatch` with **no trusted key configured** (`policySyncStatus: "error"`, `policyIntegrity.verified: false`), the submit fails closed with `Submission Blocked — Policy Unverified`, no write-back affordance is offered at all, the textarea is untouched, and the overlay's own preview is redacted | PASS 871ms | PASS 823ms |
| RT-706 SS-3 | No `chrome.runtime` channel exists in the page's main world; a SOTER-shaped `postMessage` moved nothing (still enabled, policy-serve count unchanged); and from a **privileged** extension page the deleted `SOTER_SET_STATE` type still returns no payload and closes the port — while the same channel keeps serving `SOTER_GET_STATE`, so the refusal is type-specific, not a dead worker | PASS 1.3s | PASS 1.4s |
| RT-707 no WAR | `web_accessible_resources` is absent on the running extension, and the page's `fetch` of `manifest.json` and subresource load of an extension asset both fail | PASS 427ms | PASS 532ms |

RT-700 runs first by construction (`test.describe.configure({ mode: "serial" })`), so a broken
harness fails loudly instead of letting the rest of the suite pass vacuously.

### 8.5 Platform boundary — Chrome stable would not host the lab

§22 asks for the two engines to be proven separately, and they were. But one substitution has to
be stated rather than glossed: **there is no Chrome-branded project.** Chrome stable
`147.0.7727.57` on this machine ignores `--load-extension` — the browser launches, the artefact is
never installed, and no MV3 service worker is ever registered, so `context.serviceWorkers()` stays
empty and only page targets exist. Two documented workarounds were tried and both failed
(`--disable-features=DisableLoadExtensionCommandLineSwitch`, `--enable-unsafe-extension-debugging`),
and no Chrome Dev/Beta/Canary build is installed here.

The same extracted directory installed on the first attempt in both Microsoft Edge stable and
Playwright's bundled Chromium, so this is Chrome's own policy, not a defect in the artefact or the
lab. The Chrome-side proof therefore runs on the **Chromium** build — the same engine Chrome ships,
loading the same `soter-extension-chrome-v0.1.2.zip` the Chrome Web Store receives — and is
reported as Chromium throughout, never as Chrome. `SOTER_LAB_CHROMIUM_CHANNEL` exists so a build
that does accept unpacked extensions (a future Chrome, or Chrome for Testing) can carry that proof
unchanged. Nothing in the lab works around the refusal: a build that will not install the artefact
now fails with that sentence as its error message instead of a bare event timeout.

**Claim boundary:** "enforced in Chromium 149 and Edge 151" is supported. "Enforced in Chrome
stable" is **not** claimed by this run.

### 8.6 Anti-vacuity measures, and the one fault they caught

A suite of absence assertions is worthless if the thing that would have produced the presence never
happened. Four guards exist for that:

1. **RT-700 first, serial.** If the harness is not testing the packaged artefact on a real origin
   with the guard active, the run stops there.
2. **RT-701 asserts its own probe installed** (`__soterCspProbe.installed === true`) before
   accepting "zero violations", and asserts `#root` is non-empty — a CSP that blocked the bundle
   would leave it empty rather than silently pass.
3. **RT-703 waits for a real audit POST to arrive** before searching every body for the secret, so
   "no body contains it" cannot pass merely because no body existed.
4. **The lab reports its own faults.** During development RT-704 failed with
   `policySyncStatus: "offline"` instead of `"error"`. That was not an extension defect: a dynamic
   `import()` inside the lab's policy fixture escaped Playwright's CJS transform, the lab's own
   request handler threw, and the extension received an HTTP 500 — a *transport* fault, which it
   correctly reported as `offline` rather than as a tamper verdict. The client behaviour was right
   and the test was silently measuring the wrong thing. Fixed by making the import static; then
   hardened so it cannot recur unnoticed: the lab server now records every fault it commits, and
   `applyPolicy()` asserts that record is empty before any test reads a verdict. The background
   worker's console is also tapped and folded into the failure message, because Playwright surfaces
   no console events for service workers and "expected error, got offline" said nothing about the
   cause.

No assertion was weakened to make anything pass. In particular RT-704 still requires the exact
`hash_mismatch` code — accepting `"offline"` there would have converted a tamper proof into a
transport-failure proof.

### 8.7 Lab files

| File | Role |
|---|---|
| `playwright.extension.config.ts` | NEW — separate config: no DB, no Next server, no `webServer`; one project per engine, `workers: 1`, `retries: 0` |
| `tests/extension-runtime/browser-guard-runtime.spec.ts` | NEW — the RT-700…RT-708 battery |
| `tests/extension-runtime/lab/browser.ts` | Extracts the store zip to a temp dir, launches a fresh profile with the switches in §8.3, resolves the extension id from the MV3 service-worker URL, records provenance |
| `tests/extension-runtime/lab/server.ts` | Loopback HTTPS server: destination (`/lab/model-ingest`), control plane (`/api/extension/*`), synthetic AI page, bounded body recorder, self-fault record |
| `tests/extension-runtime/lab/tls.ts` | Ephemeral certificate + the SPKI hash the browser is told to trust |
| `tests/extension-runtime/lab/policy-fixtures.ts` | The three bundles (`block`, `redact`, `tampered`) and the ephemeral signing key, never written to disk |
| `tests/extension-runtime/lab/fixtures.ts` | One lab per worker; the popup is kept open as the privileged (`extension_page`) message sender, so the tests drive `SOTER_SYNC_POLICY` / `SOTER_GET_STATE` without relaxing the boundary RT-706 asserts |
| `package.json` | `test:extension:runtime` + `package:extension` scripts |

The privileged-sender detail matters: `SOTER_SYNC_POLICY` and `SOTER_GET_STATE` are
`extension_page` scope, so they are only accepted from a `chrome-extension://` document. Driving
them from the extension's own popup means the suite never has to widen the message boundary it is
simultaneously proving.

### 8.8 What §8 still does not prove

| Gap | Status |
|---|---|
| Chrome **stable** as the host browser | Not proven — §8.5 |
| The real chatgpt.com / claude.ai DOM | Not proven — the page is synthetic, carrying only the selectors the shipped adapter uses |
| SS-10 managed-policy delivery | Not proven — needs a real enterprise browser policy, which requires user action |
| SS-6 (closed shadow root + watchdog), SS-7 (bounded approvals), SS-9 (`declarativeNetRequest`) | `OPEN` / deferred to Service 2 — no runtime claim |
| Store submission | Not performed. Nothing was pushed, published or deployed by this run |

Reproduction, exactly as run:

```
cd apps/extension && npm run package     # produces the two store zips
npm run test:extension:runtime           # 16 passed, exit 0, 30.1s, headed
```

<!-- APPEND-MARKER-3 -->


