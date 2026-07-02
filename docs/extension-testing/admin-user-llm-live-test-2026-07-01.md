# Soter Extension Admin/User Live LLM Test - July 1, 2026

## Scope

Requested scenario: admin installs Soter extension, admin policy is applied, extension is present on the user's browser, and live LLM destinations are tested like a real user.

This run used synthetic data only. No real credentials, customer records, or company documents were submitted.

## What Was Executed

| Area | Result |
|---|---|
| Extension package build | PASS |
| Unpacked browser install in live Chromium | PASS |
| Extension visible in browser management UI | PASS |
| User enrollment with invalid, expired, and valid codes | PASS |
| Policy sync and heartbeat after enrollment | PASS |
| Popup and side panel enrolled UI | PASS |
| Prompt interception on synthetic local AI page | PASS |
| Secret/API key paste blocking | PASS |
| `.env` submit blocking | PASS |
| File upload scanning | PASS |
| Company fingerprint exact and fuzzy match blocking | PASS |
| India PII approval request flow | PASS |
| Source lineage capture and destination event | PASS with issue |
| Emergency lockdown policy enforcement | PASS |
| External LLM reachability checks | PARTIAL |
| Native Chrome/Edge GPO force-install with `chrome.storage.managed` | NOT EXECUTED in this environment |

## Commands Run

```powershell
npm run package
node scripts/live-extension-e2e.mjs
npx tsx --test tests/extension/p0-beta-readiness.test.ts
```

The first `node scripts/live-extension-e2e.mjs` run was sandbox-blocked for external LLM network access. The final recorded run was executed with network access allowed.

## Build Artifact

| Artifact | Value |
|---|---|
| ZIP | `apps/extension/dist/soter-extension-v0.1.0.zip` |
| ZIP SHA-256 | `57811C460260C388ABB4D3206215E4C655B3CCB727CFC7F17F4F60BA5AD56EFF` |
| Manifest SHA-256 | `270A38AF6ABA41226F95FD9C71D56B7A6DA5C728407305C8179416CEE3BA08C9` |
| Extension ID in live run | `ilhlhkkciekmbdnpfnjlpfidnmigblom` |
| Evidence folder | `docs/extension-testing/evidence/live-browser-2026-07-01/` |
| Evidence JSON | `docs/extension-testing/evidence/live-browser-2026-07-01/results.json` |

## Live Browser Result

Final run generated at `2026-07-01T12:08:10.946Z`.

| Metric | Count |
|---|---:|
| Passed checks | 54 |
| Failed checks | 7 |

Important passes:

- Extension service worker loaded and the extension appeared on `chrome://extensions`.
- Popup opened in not-enrolled state, then valid synthetic enrollment succeeded.
- Invalid and expired enrollment codes were rejected.
- Device token was not rendered in popup or side panel.
- Policy `live-e2e-1` synced fresh, heartbeat appeared, and emergency lockdown later synced.
- Clean prompt was allowed once.
- Synthetic API key paste was blocked and safely rewritten.
- Synthetic `.env` content was blocked before submit.
- `fake.env`, `fake-customers.csv`, and `fake-code.js` file cases were detected as expected in the final run.
- Exact and fuzzy synthetic company fingerprint matches were blocked.
- Synthetic PAN/IFSC required approval and created an approval request.
- Source lineage listener activated and emitted a lineage event.
- Emergency lockdown blocked a clean prompt.
- External ChatGPT page was reachable, had a prompt box, and Soter content script was active.

## External LLM Coverage

| Destination | Reachable | Soter active | Prompt available | Result |
|---|---:|---:|---:|---|
| ChatGPT | Yes | Yes | Yes | PASS for page activation; page itself emitted site-origin errors |
| Claude | Yes | Yes | No | BLOCKED by sign-in page |
| Gemini | Yes | Yes | No | BLOCKED by no usable prompt without account state |
| Perplexity | Yes | No | Yes | FAIL: prompt existed but active marker was false |

No real prompts were submitted to external LLM services. The live external test only checked reachability, content-script activation, and prompt availability.

## Admin/Managed Policy Coverage

The extension code supports managed enterprise enrollment through `chrome.storage.managed`, and the manifest includes `managed_schema`.

Focused admin-flow regression test:

```text
npx tsx --test tests/extension/p0-beta-readiness.test.ts
8 pass, 0 fail
```

Covered by this test:

- Hashed admin enrollment tokens.
- Single-use token behavior.
- Emergency lockdown policy creation and audit behavior.
- Extension policy bundle carrying lockdown state.
- Popup rendering managed state.
- Managed config validation.
- Device token not exposed in rendered UI.
- Built extension manifest references all packaged files.

Not executed:

- Real Chrome/Edge GPO, Intune, or MDM force-install.
- Real `chrome.storage.managed` injection from OS/browser enterprise policy.
- Normal-user inability to remove a force-installed extension.

Reason: this workspace/browser automation environment does not have a managed Chrome/Edge enterprise profile or MDM/GPO policy channel configured. Writing machine policy/registry state was not performed as part of this test.

## Failures and Risks

| Severity | Finding | Evidence |
|---|---|---|
| P1 | Small clean prompt latency target missed: 333.5 ms versus under 100 ms target. | `results.json` |
| P1 | Unrelated localhost page was marked active. | `Unrelated localhost page ignored` failed with `active: true`. |
| P1 | Storage check found raw copied text terms retained. | `Storage omits raw copied text` failed. |
| P1 | Lineage destination category emitted as `unknown` instead of `local_ai`. | Lineage event payload in `results.json`. |
| P2 | Claude/Gemini live prompt tests blocked by account/sign-in state. | `promptCount: 0`. |
| P2 | Perplexity prompt existed but Soter active marker was false. | `Perplexity extension content script active` failed. |
| P2 | ChatGPT emitted site-origin errors/403 during load. | Page errors in `results.json`; not an extension-origin console error. |

## Verdict

The extension passed the core user-installed browser flow, policy sync, prompt blocking, file scanning, fingerprint enforcement, approval request, lineage capture, and emergency lockdown checks in a live browser run.

The full requested enterprise-admin scenario is only partially proven: admin-policy code paths and UI states pass automated regression tests, but real force-install and managed policy delivery through Chrome/Edge enterprise management were not executed in this environment.

Before claiming enterprise managed deployment readiness, run one manual or device-lab test on a managed Chrome/Edge profile with:

1. Force-installed extension from Chrome Enterprise or Edge Intune/GPO.
2. Managed storage values for `apiBaseUrl`, `organizationId`, `employeeId`, `email`, `department`, `role`, and `deviceToken`.
3. Verification that popup shows `Managed by organization`.
4. Verification that a standard user cannot remove the extension.
5. A live prompt test on a signed-in ChatGPT/Claude/Gemini/Perplexity account.
