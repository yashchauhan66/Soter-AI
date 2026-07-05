# SoterAI IDE Guard Validation Report

_Date: 2026-07-05 · Scope: `packages/guard-core` (v0.1.0) + `packages/vscode-extension` (soterai-ide-guard v0.1.0)_

This report is based on **real command runs and real canary scans** executed against the built
code. Every result below was reproduced locally; nothing is asserted from reading source alone
unless explicitly labelled "static review". Canary values used (fake, non-production):

```
SOTER_CANARY_OPENAI_KEY = sk-test-soter-canary-123456789
SOTER_CANARY_AWS_KEY     = AKIAIOSFODNN7EXAMPLE
SOTER_CANARY_DB_URL      = postgresql://user:password@localhost:5432/prod
SOTER_CANARY_JWT         = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canary.signature
```

---

## Verdict

**FAIL: Not ready for a paid developer MVP.**

The engine is fast, local-first by default, and its telemetry/webview/SecretStorage surfaces are
clean. But three showstoppers block a paid release:

1. **Raw-secret leak in the flagship "Redact Selection for AI" feature.** The redacted clipboard
   payload still contains the raw OpenAI key and raw JWT canaries, because those two patterns are
   not detected and the redactor only masks *detected* ranges (no safety-net pass). A privacy tool
   that hands raw secrets back to the user for pasting into an AI cannot ship.
2. **The extension cannot be packaged into a VSIX.** `vsce package` traverses the symlinked
   monorepo (60,358 files / ~1.6 GB) and produces no artifact, so it cannot be installed or smoke
   tested in a clean profile.
3. **Three declared commands are not implemented** (`configurePolicy`, `scanBeforeAIPrompt`,
   `scanGitChanges`) — invoking them throws "command not found".

---

## Build/Test Results

Tooling used: root-hoisted `tsc`/`tsx` 5.9.3 (packages have no own `node_modules`), Node v22.16.0,
`@vscode/vsce` (root). Commands were run from each package directory.

| Command | Package | Result | Evidence |
| ------- | ------- | ------ | -------- |
| `tsc --noEmit` (typecheck) | guard-core | ✅ PASS | exit 0 |
| `tsx --test src/__tests__/**` (test) | guard-core | ✅ PASS | **12 pass / 0 fail**, 2 suites, 710 ms |
| `tsc -p tsconfig.json` (build) | guard-core | ✅ PASS | exit 0, `dist/` emitted |
| `npm run lint` | guard-core | ⚠️ MISSING | no `lint` script defined |
| `tsc -p tsconfig.json` (compile) | vscode-extension | ✅ PASS | exit 0, `dist/` emitted |
| `npm run typecheck` | vscode-extension | ⚠️ MISSING | only `compile` exists (no `--noEmit` script) |
| `npm run lint` | vscode-extension | ⚠️ MISSING | no `lint` script defined |
| `npm run test` | vscode-extension | ❌ BROKEN | script runs `node ./out/test/runTest.js`; no `out/`, no test files exist |
| `vsce package` | vscode-extension | ❌ FAIL | traverses 60,358 files / ~1.6 GB via symlinked dep; **no VSIX produced** (exit 1) |

Note: `npm run test`/`npm run lint`/`npm run typecheck` do not all exist as scripts, so the
instruction's literal commands were satisfied by invoking the underlying tools directly where a
script was absent. Missing scripts are themselves an MVP gap.

---

## Feature Coverage

### guard-core modules

| Feature | Status | Notes |
| ------- | ------ | ----- |
| SecretDetector | ⚠️ PARTIAL | AWS key ✅, DB URL ✅. **OpenAI canary NOT detected** (pattern requires `T3BlbkFJ` marker, `SecretDetector.ts:13`). **JWT canary NOT detected** (middle segment `canary` = 6 chars < required `{8,}`, `SecretDetector.ts:106`). |
| PIIDetector | ✅ PASS | email + SSN detected. |
| IndiaPIIDetector | ✅ PASS | Aadhaar, PAN, IFSC detected. |
| MCPConfigRiskDetector | ✅ PASS | `mcp_command_exec` + `mcp_api_key` detected. |
| AIGeneratedCodeRiskDetector | ✅ PASS | `command_injection` + `eval_usage` detected (SQL-injection string not flagged — minor). |
| Redactor | ⚠️ PARTIAL | Pattern path masks OpenAI/AWS/DB, but **JWT canary leaks even in pattern path** (`Redactor.ts:18`). Finding-based path only masks detected ranges (see blocker below). |
| EvidenceMinimizer | ✅ PASS | Emits masked `redactedEvidence` (`AK****************LE`); no raw content. |
| PolicyEvaluator | ⚠️ MINOR BUG | `approval_required` threshold is unreachable: defaults `block=70 < approvalRequired=85`, and `thresholdAction` checks `block` first, so any score ≥ 85 returns `block` (`PolicyEvaluator.ts:49-56`). Only reachable via explicit rules. |
| DecisionEngine | ✅ PASS (logic) | Correct scoring/caching/dedup, but propagates the redactor leak into `redactedText` and cache. |
| HashCache | ✅ PASS | SHA-256 of normalized text, TTL + policy-version invalidation, LRU-ish eviction. Stores only hash + decision (but decision contains leaky `redactedText`). |

### VS Code commands

| Command | Status | Notes |
| ------- | ------ | ----- |
| Scan Current File | ✅ Implemented | `scanFileHandler`, diagnostics + notification. |
| Scan Selection | ✅ Implemented | offers "Copy Redacted". |
| Redact Selection for AI | ❌ UNSAFE | copies `decision.redactedText` which can contain raw secrets (see blocker). |
| Scan Workspace Risk | ✅ Implemented | respects excludeGlobs + maxWorkspaceFiles. |
| Check Terminal Command | ✅ Implemented | input box → terminal-context scan. |
| Review Selected AI Code | ✅ Implemented | opens a webview (no CSP — see webview section). |
| Open Security Panel | ✅ Implemented | DashboardPanel. |
| Export Local Risk Report | ✅ Implemented | writes categories/scores only (no raw). |
| Connect to SoterAI Cloud | ✅ Implemented | token → SecretStorage. |
| Disconnect / Clear Token | ✅ Implemented | `secrets.delete`. |
| Configure Policy | ❌ MISSING | declared in `package.json`, **not registered** in `commands.ts`. |
| Scan Before AI Prompt | ❌ MISSING | declared, **not registered**. |
| Scan Git Changes | ❌ MISSING | declared, **not registered**. |

10 of 13 declared commands are registered (`commands.ts:250-263`).

---

## Privacy Canary Results

Full canary block scanned through `DecisionEngine.scan(..., {context:"file"})`, then every output
surface inspected.

| Surface | Raw canary present? | Detail |
| ------- | ------------------- | ------ |
| **Logs** | ✅ Clean | Telemetry `sendEventsToCloud` only logs a count + base URL (`telemetry.ts:91`); no raw content. `console.log` on activation only. |
| **Hash cache** | ❌ **LEAK** | Cache stores the full `GuardDecision`, whose `redactedText` still contains the raw OpenAI key + raw JWT for undetected patterns. |
| **Telemetry queue** | ✅ Clean | Event carries only masked `evidencePreview`, categories, score, length. Default level `off`. |
| **SecretStorage / storage** | ✅ Clean | Only the cloud token is stored, via `context.secrets`. Export report contains no raw values. |
| **Webview** | ✅ Clean | DashboardPanel renders only masked `redactedEvidence` + static fields; token never passed to the page. |
| **Network** | ✅ Clean | No real network primitive anywhere (`fetch`/`http`/`axios` absent); cloud send is a stub. |
| **`decision.redactedText` / clipboard** | ❌ **LEAK** | See below. |

**Detection coverage (per canary, SecretDetector):**

```
OPENAI: NOT DETECTED
AWS:    aws_access_key
DB:     database_url
JWT:    NOT DETECTED
```

**Actual redacted output produced by the engine (the exact clipboard payload of "Redact for AI"):**

```
OPENAI_KEY=sk-test-soter-canary-123456789          <-- RAW KEY STILL PRESENT
AWS_KEY=[REDACTED_AWS_ACCESS_KEY]
DATABASE_URL=[REDACTED_DATABASE_URL]
JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canary.signature   <-- RAW JWT STILL PRESENT
```

**Root cause:** `DecisionEngine.scan` calls `redactText(content, allMatches)`
(`DecisionEngine.ts:57-58`). When a `findings` array is passed, `redactText` redacts **only the
detected match ranges and skips the pattern-based fallback entirely** (`Redactor.ts:34-49`). Any
secret the detectors miss therefore survives into `redactedText`, which is then (a) copied to the
clipboard by `redactSelectionForAI` (`commands.ts:104`), (b) cached, and (c) held in
`state.latestDecision`.

**Canary verdict: FAIL** — raw OpenAI key and raw JWT escaped into the redacted output, clipboard,
and in-memory cache. AWS and DB canaries were handled correctly.

---

## Local-first Verification

**PASS — cloud is disabled by default and no network call occurs.**

- `soterai.cloud.enabled` default `false`; `soterai.scan.remoteEscalation` default `never`;
  `soterai.telemetry.redactedEvents` default `off`.
- `TelemetryManager.flush()` early-returns unless `cloud.enabled` is true (`telemetry.ts:64-70`).
- No `fetch`/`http`/`https`/`axios`/`XMLHttpRequest` exists in the extension source; the "cloud
  send" is a stub that only `console.log`s. All scans (selection/file/workspace/terminal) run
  entirely through the local `DecisionEngine`. Verified by scanning with defaults — results
  returned locally, zero outbound calls.

---

## Performance Results

Measured via `DecisionEngine.scan(text, {context:"file", skipCache:true})`, avg of 5 runs, mixed
secret/PII content:

| Input size | Avg latency | Verdict |
| ---------- | ----------- | ------- |
| 1 KB   | **1.24 ms** | ✅ instant |
| 10 KB  | **6.41 ms** | ✅ instant |
| 100 KB | **93.17 ms** | ✅ acceptable (no UI freeze) |

Scaling is roughly linear. The default `scan.maxFileSizeKb` is 256 KB (≈ 230 ms worst case) and
work runs off the extension host's async path, so no visible freeze is expected. Workspace scans
honor `excludeGlobs` (node_modules/.git/dist/build/binaries) and `maxWorkspaceFiles` (1000).
Performance is **not** a blocker.

---

## VSIX Packaging

**FAIL — no VSIX artifact could be produced.**

- Command: `vsce package --allow-missing-repository --skip-license` from
  `packages/vscode-extension`.
- `@soterai/guard-core` is a `file:../guard-core` dependency resolved as a **symlink into the
  monorepo**. `.vscodeignore` excludes `node_modules/**` but not the symlinked package tree, and
  there is no bundler (esbuild/webpack). vsce followed the symlink and tried to include
  **60,358 files / ~1.6 GB** (`integrations/`, `python-sdk/`, `sdk/`, the repo root `../../`,
  etc.). The run exited non-zero and **produced no `.vsix`**.
- Generated VSIX path: **none**.
- Install result: **not attempted** — nothing to install.
- Secondary gaps that would surface once packaging is fixed: no `README.md`, no `LICENSE` file
  (`license` field is `BSL-1.1` but no file), no `repository` field, no `activationEvents` (OK for
  modern VS Code auto-gen), and the "consists of N files — you should bundle" warning.

Because packaging fails, steps that depend on it — **install VSIX in a clean profile, manual smoke
test in a real Extension Development Host, uninstall** — could **not** be executed and remain
UNVERIFIED.

---

## Webview Security

| Check | DashboardPanel | Review-AI-Code panel |
| ----- | -------------- | -------------------- |
| CSP present | ✅ `default-src 'none'; script-src 'nonce-…'` (`DashboardPanel.ts:95`) | ❌ **No CSP meta tag** (`commands.ts:181-207`) |
| No remote scripts | ✅ | ✅ |
| No `eval`/`new Function` | ✅ | ✅ |
| Scripts gated | ✅ nonce-based | ✅ `enableScripts` not set → scripts disabled (mitigates missing CSP) |
| Message input validated | ✅ fixed allow-list (`scanCurrentFile`/`connectCloud`/`disconnectCloud`) | n/a (no messaging) |
| Token exposed to page | ✅ No — token stays in SecretStorage, never serialized into HTML | ✅ No |
| Output escaping | ⚠️ finding `title`/`reason`/`category` interpolated unescaped, but values are static detector strings and evidence is masked → low risk | ⚠️ same, low risk |

DashboardPanel is solid. The Review-AI-Code panel should get a matching CSP and HTML-escaping for
consistency, but is low risk because scripts are disabled and only masked/static content is shown.

---

## Workspace Trust

**PARTIAL / GAP.**

- `package.json` declares **no `capabilities.untrustedWorkspaces`**. VS Code's default for an
  extension that does not declare support is to treat it as unsupported in untrusted workspaces,
  so in Restricted Mode the extension is effectively **disabled** — meaning the desired behavior
  "safe local scans still work in an untrusted workspace" is **not** delivered, and it is not the
  explicit, intentional design either.
- `ExtensionState.isWorkspaceTrusted()` exists but only drives a UI badge
  ("Workspace Trusted" / "Restricted Mode", `DashboardPanel.ts:194`). No command gates cloud vs.
  local behavior on trust state.
- To be correct, declare `capabilities.untrustedWorkspaces: { supported: "limited" }`, allow local
  scans in restricted mode, and gate only cloud/token/remote-escalation features behind trust.

---

## Blockers

Exact files/functions to fix, in priority order:

1. **Raw-secret leak in redaction** — `packages/guard-core/src/Redactor.ts:34-49` +
   `packages/guard-core/src/DecisionEngine.ts:57-58`. After finding-based redaction, always run the
   pattern-based fallback as a safety net (or union both), so undetected secrets are still masked.
   Add a post-redaction assertion that no high-entropy `sk-…`/`eyJ…`/`AKIA…` token survives.
2. **Detector gaps for the canaries** —
   `packages/guard-core/src/detectors/SecretDetector.ts:13` (OpenAI: the strict `T3BlbkFJ` pattern
   misses generic `sk-` keys — add a broader `sk-[A-Za-z0-9_-]{20,}` medium-confidence rule) and
   `SecretDetector.ts:106` / `Redactor.ts:18` (JWT: relax middle segment from `{8,}` to `{1,}`, or
   allow short payload segments).
3. **VSIX cannot be built** — `packages/vscode-extension`. Bundle the extension (esbuild) so
   `@soterai/guard-core` is inlined, or copy its `dist` in and drop the `file:` symlink; tighten
   `.vscodeignore`. Until `vsce package` yields a `.vsix`, install/smoke/uninstall stay unverified.
4. **Missing commands** — `packages/vscode-extension/src/commands.ts:250-263`. Implement and
   register `soterai.configurePolicy`, `soterai.scanBeforeAIPrompt`, `soterai.scanGitChanges`, or
   remove them from `package.json` `contributes.commands`.
5. **Workspace Trust** — `packages/vscode-extension/package.json`. Add
   `capabilities.untrustedWorkspaces` and gate only cloud features on trust.
6. **Test/lint scripts** — both `package.json` files. Extension `test` script points to a
   non-existent `out/test/runTest.js` and there are no extension tests; no `lint` script exists in
   either package.

Lower severity: `PolicyEvaluator.ts:49-56` unreachable `approval_required` threshold; Review-AI-Code
webview missing CSP (`commands.ts:181`); unescaped finding fields in both webviews.

---

## Next Steps

Priority order to reach a shippable paid MVP:

1. **Fix the redaction safety-net (Blocker 1) + detector gaps (Blocker 2).** Re-run the canary
   harness; the "Redact for AI" clipboard payload must contain **zero** raw canary values for all
   four secrets. This is the gating privacy requirement.
2. **Make the extension bundle + package (Blocker 3).** Add esbuild, produce a small `.vsix`
   (< a few MB), then actually install it in a clean VS Code profile and run the manual smoke test
   (all four canaries, each command) and a clean uninstall. Record the VSIX path + results here.
3. **Implement or remove the 3 missing commands (Blocker 4)** so no declared command errors.
4. **Add Workspace Trust capability (Blocker 5)** and verify local scans work while cloud is gated
   in an untrusted workspace.
5. **Add real automated tests + lint** (guard-core canary regression test that fails if any raw
   secret survives redaction; `@vscode/test-electron` Extension Development Host smoke test; wire
   up `lint`/`typecheck` scripts).
6. Clean-ups: unreachable policy threshold, second webview CSP, HTML escaping, add
   `README.md`/`LICENSE`/`repository`.

Re-run this full validation after steps 1–4; do not mark PASS until the canary clipboard payload is
provably clean **and** a real VSIX installs and smoke-tests in a clean profile.
