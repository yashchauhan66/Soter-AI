# SoterAI Browser Guard — Work Status & Resume Point

**Purpose:** single resumable handoff for the Browser Guard master-prompt work. Everything
already finished is listed with its evidence; everything outstanding is listed with enough
detail to continue without re-deriving any design. Start at §5.

**Last updated:** 2026-08-01 (end of session 3)
**Permanent report (source of truth for findings):** `docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md`
**Resume marker in that report:** `<!-- APPEND-MARKER-2 -->`

---

## 1. Repo state

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `30e89459` (`release: n8n-nodes-soterai v0.3.3`) |
| Extension version | `0.1.2` |
| Node / npm | `v22.16.0` / `11.15.0` |
| Playwright | `1.61.1` (browser cache has `chromium-1228`) |
| OpenSSL | `3.5.5` |
| Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Edge | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| Commit state | **Nothing committed.** All work is uncommitted in the worktree. |

## 2. Safety constraints still in force

- Preserve every tracked, modified and untracked file. No reset, clean, force-checkout.
- Never push, publish, deploy, or touch production. Store submission needs explicit permission.
- No secrets, prompts, cookies, tokens, PII or private URLs in output or in test fixtures.
- Bounded local test servers + synthetic data only (the lab uses one AWS *documentation*
  example key, `AKIAIOSFODNN7EXAMPLE`, and never leaves loopback).
- No new broad permissions, no remotely hosted code, no `eval`, no unsafe CSP.
- A manifest entry, route, UI page or passing unit test is **never** accepted as proof of
  runtime enforcement.

---

## 3. COMPLETE — Service 1: extension self-security (§23 priority 1)

Implemented and unit/source-verified. Full before/after chart, threats closed, data paths,
remaining bypasses, permissions/privacy/performance impact, 17-row files-changed table,
14-row verification table and 3-row negative-controls table are in report §7.

| ID | Weakness closed | Status |
| --- | --- | --- |
| SS-1 | Policy-bundle integrity: recursive canonical JSON, whole-body content hash, domain-separated signing payload (`soterai.policy-bundle.v1`), ECDSA P-256 preferred, HMAC opt-in, anti-rollback via `issuedAt`, trust ratchet via `signedBundleSeen`. Root cause was `JSON.stringify(policy, Object.keys(policy).sort())` — replacer-**allowlist** semantics excluded every nested field (`rules[]`, `riskThresholds`, `destinations[]`) from the hash. | ENFORCED_TESTED |
| SS-2 | Endpoint trust pinning — every control-plane call re-anchored onto a trusted origin, `credentials: "omit"`, `redirect: "error"`, so a poisoned `apiBaseUrl` cannot redirect the device token. | ENFORCED_TESTED |
| SS-3 | Runtime message boundary — type allowlist, sender id + scope + frame checks, size caps, per-type schemas, fail-safe unknown-type drop. `SOTER_SET_STATE` (unrestricted privileged state write) **deleted**, not validated. | ENFORCED_TESTED |
| SS-4 | Single fail-closed gate: a positive tamper signal blocks regardless of availability flags (previously only `offline` + a flag was gated, so a tampered bundle fell through to normal evaluation). | ENFORCED_TESTED |
| SS-5 | `content_security_policy.extension_pages` hardened (`script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'`). | **ENFORCED_DECLARATIVE** — needs the runtime proof in §5 |
| SS-10 | Two managed-config switches that were read by code but absent from `managed-schema.json` (so they silently did nothing) declared and wired. | ENFORCED_DECLARATIVE |
| SS-11 | **NEW, CRITICAL.** On a fail-closed block `rewrittenSafeText` was the *raw* prompt, and every consumer treats that field as the safe variant (overlay preview, "Use safe prompt" write-back + replay, "Copy safe prompt"). A fail-closed block therefore handed the unredacted secret back to the page it had just refused. Now redacted-only, and `remediationAffordances()` in the kernel denies `canReplace` / `canSubmitSafeText` / `canSubmitOriginal` so the overlay cannot render or replay it. | ENFORCED_TESTED |

**Test evidence recorded so far (all from repo root, all EXIT=0):**

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors, 73.7 s |
| `npm run typecheck:extension` | EXIT=0, 19.5 s |
| `npm run build` (in `apps/extension`) | EXIT=0, 37.6 s |
| `npm run validate:store` | EXIT=0, 3.4 s |
| full extension suite | **252/252 pass, 0 fail**, 14 036 ms |
| `api-route-audit` + `admin-ai-policies` | 17/17, EXIT=0 |

New test files from Service 1 (107 new cases on a 145 baseline): trusted-endpoint 16,
enrollment-trust 10, message-boundary 24, policy-integrity 23, policy-fail-closed 13,
manifest-invariants 10, policy-signing-e2e 11.

---

## 4. COMPLETE — packaged-extension runtime lab, 5 of 7 files

`tests/extension-runtime/lab/` (new directory, nothing else in the repo touched):

| File | Contents | Status |
| --- | --- | --- |
| `tls.ts` | Ephemeral EC P-256 self-signed cert in `os.tmpdir()`, SAN `chatgpt.com` + `soterai.in` + `localhost` + `IP:127.0.0.1`, 2-day validity, `spkiSha256Base64` for Chrome's per-key allowlist, `dispose()` removes it. Nothing written inside the repo. | DONE |
| `policy-fixtures.ts` | `labPolicyBundle("block" \| "redact" \| "tampered")`, `LAB_ORGANIZATION_ID = "demo-org"`, `LAB_SECRET = "AKIAIOSFODNN7EXAMPLE"`, `LAB_PROMPT_WITH_SECRET`. Tampered mode = correctly sign with an ephemeral in-memory key, then flip `rules[0].action` to `"allow"`. | DONE |
| `server.ts` | Bounded loopback HTTPS server: synthetic chat page at `/`, the page's own destination `POST /lab/model-ingest`, control plane under `/api/extension/*` serving the mode-selected bundle, request recorder (`received`, `allBodies()`, `ofPath()`), 512 KiB body cap, 500-entry ring, `reset()` / `stop()`. | DONE |
| `browser.ts` | Extracts the **store zip** to a temp dir, launches `chromium.launchPersistentContext` on a fresh temp profile with `channel: "chrome" \| "msedge"`, `--disable-extensions-except` / `--load-extension`, the host-resolver + SPKI switches, resolves the extension id from the MV3 service worker URL, exposes `manifestSha256` + `launchArgs` for the evidence record, `dispose()` removes both temp dirs. | DONE |
| `fixtures.ts` | Worker-scoped `lab` fixture: cert → server → browser → wait for the bootstrap policy fetch → keep the popup open as the privileged (`extension_page`) message sender. Helpers `send()`, `state()`, `applyPolicy(mode)`, `openChat()`, plus an `evidence` record. | DONE |
| `../browser-guard-runtime.spec.ts` | RT-700…RT-708 battery | **TODO — §5** |
| `../../playwright.extension.config.ts` | Separate config, one project per browser | **TODO — §5** |

### Lab design facts (already derived — do not re-derive)

- The **store** manifest injects its content script only on 19 real https AI origins. A lab
  served over `http://127.0.0.1` would silently be testing the *dev* manifest. Hence:
  `--host-resolver-rules="MAP chatgpt.com 127.0.0.1:PORT,MAP soterai.in 127.0.0.1:PORT,MAP * ~NOTFOUND,EXCLUDE localhost"`.
  This simultaneously blackholes all real DNS (so the extension's default
  `https://soterai.in` telemetry cannot reach production) and routes that telemetry into the
  lab where its bytes can be searched for raw secrets.
- `--ignore-certificate-errors-spki-list=<base64 SHA-256 of SPKI>` trusts exactly one key.
  The blanket `--ignore-certificate-errors` is not used. Avoid Google-owned hostnames —
  built-in key pins defeat the SPKI exception.
- **No storage seeding is needed.** `verifyPolicyBundle` recomputes and compares the content
  hash *before* candidate-key selection, so a signed-then-mutated bundle yields
  `hash_mismatch` even with **no trusted key configured**. `demo-org` is the pre-enrollment
  default `organizationId`, which clears the `organization_mismatch` gate. So the whole chain
  runs against a completely unmodified packaged artefact.
- Unsigned bundle + no keys ⇒ `{ valid: true, verified: false, code: "unsigned" }`, which is
  **not** in `POLICY_TAMPER_CODES`, so block/redact modes do not trip the fail-closed gate.
- `chrome.runtime.onInstalled` fires on a fresh temp profile ⇒ first `syncPolicy()` is
  automatic. Later mode switches need `SOTER_SYNC_POLICY`, which is `extension_page` scope ⇒
  must be sent from `chrome-extension://<id>/popup/index.html` (a tab showing that URL
  satisfies `isExtensionPageSender`).
- Playwright transpiles specs with esbuild → **cjs**: no top-level `await`, no
  `import.meta.url`, in any file under `tests/`.
- Root `tsconfig.json` **excludes** `tests/` and `packages/`, so these files are not covered
  by root `npx tsc --noEmit`.

---

## 5. NEXT — start here tomorrow

### 5.1 Write `tests/extension-runtime/browser-guard-runtime.spec.ts`

Import `{ test, expect }` from `./lab/fixtures`. RT-700 must run first so the suite cannot
pass vacuously.

| ID | Proves | Assertions |
| --- | --- | --- |
| RT-700 | Lab integrity gate | Page served by the lab (`#lab-marker[data-lab="soterai-runtime-lab"]`); the loaded manifest is the **packaged** one (`lab.evidence.manifestSha256 === lab.evidence.builtManifestSha256`); `chrome.runtime.getManifest()` from the popup matches the packaged security fields (`manifest_version`, `version`, `permissions`, `host_permissions`, `content_security_policy.extension_pages`, `content_scripts[0].matches`, `web_accessible_resources === undefined`); real DNS is blackholed (a page fetch to any other hostname fails); guard active (`html[data-soter-active-domain="true"]`). |
| RT-701 | SS-5 CSP at runtime | Attach listeners **before** navigation; open `popup/index.html` and `sidepanel/index.html`; `#root` renders non-empty; zero `securitypolicyviolation` events; zero CSP console errors. Only then may SS-5 move from `ENFORCED_DECLARATIVE` to `ENFORCED_TESTED`. |
| RT-702 | BLOCK prevents submission | Mode `block`; fill `#prompt-textarea` with `LAB_PROMPT_WITH_SECRET`; click `[data-testid="send-button"]`; overlay badge `Submission Blocked`; the page's own bubble-phase handler never runs (`#sent-count` stays `0`, `window.__labSent.length === 0`) because the interceptor calls `stopImmediatePropagation()` in the capture phase at `document`. |
| RT-703 | Blocked data never reaches the network | `server.reset()` immediately before the interaction; `server.ofPath("/lab/model-ingest").length === 0`; **and** `server.allBodies()` does not contain `LAB_SECRET` — this covers the extension's own audit/scan/lineage POSTs, not just the page's. |
| RT-705 | REDACT transforms before the destination | Mode `redact` via `applyPolicy`; submit; overlay badge `Security Warning`; click `[data-action="replace"]`; the replay fires and `/lab/model-ingest` **is** received, its body does **not** contain `LAB_SECRET`, and the surviving benign text is present. |
| RT-704 / RT-708 | Tamper ⇒ fail closed, no leak back into the page (SS-4 + SS-11) | Mode `tampered`; `state().policyIntegrity` is `{ verified: false, code: "hash_mismatch" }` and `policySyncStatus === "error"`; submit ⇒ badge `Submission Blocked — Policy Unverified`; `[data-action="replace"]` **absent**; `#prompt-textarea` value unchanged; the overlay preview `textarea` does not contain `LAB_SECRET`; `/lab/model-ingest` absent. |
| RT-706 | SS-3 boundary at runtime | From the page main world, `chrome.runtime.sendMessage` is not a function (no `externally_connectable`); a `window.postMessage` of a SOTER-shaped message changes nothing; and from the **privileged popup** `SOTER_SET_STATE` is refused (`unknown_type`) with state unchanged. |
| RT-707 | No web-accessible resources at runtime | `manifest.web_accessible_resources === undefined`; `fetch("chrome-extension://<id>/manifest.json")` from the page rejects. |

Overlay selectors (Playwright pierces the open shadow root): host `[data-soter-overlay]`,
badge `.status-badge`, buttons `[data-action="copy"|"replace"|"dismiss"]`, preview `textarea`.

### 5.2 Write `playwright.extension.config.ts`

Separate from the root config, which **must not be reused** (it throws without
`E2E_DATABASE_URL`/`DATABASE_URL`, has `testDir: ./tests/e2e`, a `globalSetup` and a Next
`webServer`). Needs: `testDir: "./tests/extension-runtime"`, no `webServer`, no DB,
`workers: 1`, `fullyParallel: false`, generous `timeout`, and **one project per browser** —
`{ name: "chrome", use: { channel: "chrome" } }` and `{ name: "edge", use: { channel: "msedge" } }`
— because §22 requires Chrome and Edge proven separately.

### 5.3 Add the npm script and run it

- `"test:extension:runtime": "playwright test --config playwright.extension.config.ts"`.
- Prerequisite: `cd apps/extension && npm run package` (the lab loads the store zip, and
  `browser.ts` throws a clear error if it is missing).
- Record exact command, duration, exit code and artefact hashes per §27.
- Set `SOTER_LAB_HEADLESS=1` only if a headed run is impossible; headed is the default
  because MV3 service workers and extension pages behave most faithfully that way.

### 5.4 Then update the permanent report

Append at `<!-- APPEND-MARKER-2 -->` in `docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md`:
the runtime-evidence table (command, duration, exit code, per-browser results, manifest
hash), and upgrade SS-5 from `ENFORCED_DECLARATIVE` **only if the runtime proof actually
passes**. §7.9 currently states plainly that everything there is source/unit-level evidence
and makes no runtime claim — that sentence must be replaced honestly, not padded.

---

## 6. Backlog after the runtime lab (§23 order)

### 6.1 Deferred from Service 1 — carried into Service 2

| ID | Open weakness | Where |
| --- | --- | --- |
| SS-6 | Overlay uses `attachShadow({ mode: "open" })` with no re-mount watchdog, so a hostile page can read or remove the enforcement UI (LayerX "Man-in-the-Prompt" class). Needs closed shadow root + a MutationObserver watchdog. | `apps/extension/src/content/overlay.ts` |
| SS-7 | `approvedPrompts` / `replayBypass` are unbounded, non-one-time, not destination-bound and have no TTL, and `submit-interceptor.ts` short-circuits on `approvedPrompts.has(text)` **before** any scan. Needs bounded, one-time, destination-bound, expiring approvals. | `apps/extension/src/content/submit-interceptor.ts:18` |
| SS-9 | Enforcement is DOM/submit-layer only; there is no network-layer block. Needs `declarativeNetRequest` (new permission — justify against §1 "do not request broad permissions merely to make implementation easier"). | manifest + background |

### 6.2 Remaining services (2 → 14)

2 AI prompt/search context firewall (carries SS-6, SS-7, SS-9) · 3 File and upload guard ·
4 Phishing and credential guard · 5 Browser-agent action firewall · 6 Malicious-page /
network controls · 7 Work/personal data boundaries · 8 Shadow AI / SaaS / extension
discovery · 9 Privacy-safe evidence ledger · 10 Policy health and tamper resistance ·
11 UI/UX · 12 Performance · 13 Cross-browser packaged runtime · 14 Fleet and enterprise
controls.

For each: DEEP-SCAN → map runtime paths → compare against the *currently researched* market
leader → verified weaknesses + gaps → implement only `IMPLEMENT_NOW` items → adversarial
tests → real packaged-browser proof → benchmark → re-compare → before/after chart (§24
format) → next service. Verdicts limited to `STRONGER_VERIFIED`, `DISTINCTIVE`,
`ARCHITECTURAL_PARITY`, `WEAKER`, `NOT_COMPARABLE`, `UNVERIFIED`. Missing competitor
information is never a SoterAI victory.

### 6.3 Other open items

- **SS-8 honesty re-classification** in `artifacts/security/capabilities.json` — still `OPEN`
  in report §7.9.
- **§28 deliverable** `docs/SOTERAI-BROWSER-GUARD-FINAL-COMPETITOR-COMPARISON.md` — not
  started.
- **Completion gate (§25):** no sub-service may end as `UNAUDITED`, `ROUTE_ONLY`, `UI_ONLY`
  or `ADVISORY_CLAIMED_AS_ENFORCEMENT`.

## 7. Honest platform boundaries already recorded (§26)

Keep these as `PLATFORM_UNSUPPORTED` — do not let a later section quietly claim them:
browser-engine zero-days; OS-level screenshots / screen recording / native-app copying;
another extension's private code or traffic; omnibox interception; and the deliberate
server-fail-open / client-fail-closed asymmetry. Drag-and-drop, clipboard hijacking, autofill
and indirect prompt injection currently have **no** enforcement and are listed as known
bypasses, not as covered threats.

