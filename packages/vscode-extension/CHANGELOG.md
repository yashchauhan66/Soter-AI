# Changelog

## [0.4.0] - 2026-08-09

A real-user pass over the 0.3.x feature surface. Every entry below is a defect
that shipped in 0.3.0 and was reproduced before it was fixed. Several of them
were features that *reported* protection while doing nothing — those are the
ones worth reading.

### Fixed
- **Screen-share exposure warning missed almost every secret file.** The check
  compared the whole path string against `.env`, so only a workspace-root `.env`
  was ever flagged; `sub/.env`, `backend/.env.production`, `~/.aws/config` and
  any absolute path outside the workspace were silently ignored. Matching now
  happens on the basename, with an added path check for files under `.ssh`,
  `.aws`, `.gnupg`, `.kube` and `.docker`, plus key material (`.pem`, `.key`,
  `.p12`, `id_rsa`…) and secret-named files.
- **The git pre-commit hook could be installed dead, and could destroy an
  existing hook.** Three separate problems: the file was written without the
  executable bit, so git skips it entirely on macOS/Linux while the UI claimed
  success; a repo using husky/lefthook (`core.hooksPath`) had its hook written
  to the directory git ignores; and any pre-existing `pre-commit` hook was
  overwritten with no backup. Install now refuses when `core.hooksPath` is set
  and explains why, backs up a foreign hook to `pre-commit.soterai-backup`,
  sets mode `0755`, and warns honestly when the exec bit cannot be set.
- **Dependency Guard claimed findings that no scan had produced.** The OSV
  nudge was called with a hardcoded "risky packages found" flag, so the prompt
  asserted local findings even when nothing had been scanned. The nudge now
  takes explicit evidence and says plainly when no scan has run.
- **Local-model log scan reported "clean" after reading nothing.** LM Studio's
  `server-logs` is a directory; `readFile` failed with `EISDIR`, the error was
  swallowed, and the command reported no persisted secrets. Directory
  candidates are now expanded to the files inside them (bounded per directory),
  and the result states how many files were actually read and how many could
  not be read, instead of treating unread as clean.
- **"Secure My AI" had no palette-reachable undo.** `SoterAI: Restore AI
  Configs` is now a core palette command. A one-click rewrite the user cannot
  reverse from the palette is worse than one they never ran.
- Declared `@soterai/detectors`, which was required at runtime but present only
  via the workspace symlink and esbuild inlining.
- Added `SoterAI: Copy Pre-Commit Hook Script` as the escape hatch for
  husky/lefthook repos, referenced by the refusal message above.

### Security
- **RAG / vector-database egress is now enforced rather than advertised.** The
  host list and `isRagEgress` existed with no caller while the module header
  claimed the detection shipped. They now live in `egressFirewall.ts` and are
  folded into the live `evaluateEgressToHost` path: secret-bearing content to a
  vector DB escalates to `BLOCK` (embedded content is persisted, so a leak
  there is durable, not transient), and clean content becomes `ASK` before it
  is indexed.

### Honesty
- Registered the five newly-wired protections in the capability registry at the
  level each one actually reaches: `ai-config-auto-route` and
  `git-precommit-secret-hook` as **ADVISORY_ONLY** (they edit configuration so
  traffic *will* flow through the broker — the enforcement belongs to the
  broker's own capabilities, not to these), `screen-share-exposure-warning` as
  **VISIBILITY_ONLY** (VS Code cannot detect an in-progress screen share),
  `local-model-log-scan` as **DETECTION_ONLY**, and `rag-egress-detection` as
  **PARTIAL_ENFORCEMENT**. Known bypasses, including `git commit --no-verify`,
  are declared in the registry rather than omitted.

### Verified
- Extension: 176/176 tests across 49 suites pass; typecheck clean.
- guard-core: 466/466 tests pass; capability registry honesty invariant passes
  (`honest=true`, 28 capabilities).
- 37 new regression tests cover the modules above, which had **zero** coverage
  in 0.3.0 — that absence is how a warning matching one filename, a hook with
  no exec bit, a claim with no scan behind it, and a scanner that read nothing
  all shipped in the same release.

## [0.3.0] - 2026-08-04

### Added
- **AI Egress Firewall** — a single local choke point for text you are about to send to an AI tool. Returns `ALLOW` / `REDACT` / `ASK` / `BLOCK`, offers a redacted copy when secrets are present, and escalates to `BLOCK` when a secret rides along with an injection attempt.
- **Obfuscation-resistant scanning** — the same guard-core detectors are re-run over de-obfuscated variants of the text, so smuggled attacks that evade a single-pass regex still score: zero-width unicode, homoglyph (Cyrillic lookalike) substitution, leetspeak, letter-spacing, reversal, and base64.
- **Destination awareness** — `evaluateEgressToHost` combines the content decision with where it is going. Clean content to a non-allowlisted host becomes `ASK`; content carrying secrets becomes `BLOCK`.
- New commands: `SoterAI: Check Before Sending to AI` (core palette), plus `SoterAI: Show AI Egress Firewall Status` and `SoterAI: Check Egress Payload (API)` (advanced-gated). The payload command is a programmatic entry point for other extensions and future editor wrappers.
- Every egress decision is appended to the tamper-proof local audit ledger with **redacted evidence only** — raw text and secrets are never stored, logged, or transmitted.

### Security
- Redaction offsets are computed from the **raw** text only, so a folded/de-obfuscated variant can never produce a mis-aligned edit that leaves a secret in place.
- Findings carry minimized evidence; a behavioural test asserts the raw secret never reaches `redactedEvidence`.

### Honesty
- Registered `egress-firewall` in the capability registry as **PARTIAL_ENFORCEMENT**, not STRONG. It is a choke point for content SoterAI is asked to send or approve. VS Code exposes no network-interception API, so a request another extension makes directly to a provider is **not** intercepted. Known bypasses are declared in the registry and shown in the status view.

### Verified
- Extension: 139/139 tests pass, typecheck clean.
- guard-core: 466/466 tests pass; capability registry honesty invariant passes (`honest=true`, 23 capabilities).

## [0.2.2] - 2026-07-31

### Fixed
- Aligned packaged runtime release evidence with the broker Safe Mode policy check so VS Code-family hosts can prove the same VSIX behavior deterministically.
- Fixed the Marketplace license pointer to resolve to the bundled `LICENSE.md` file.

### Verified
- Packaged VSIX runtime probes passed in VS Code, Cursor, Windsurf, Kiro, and Antigravity with the same artifact.
- VSCodium was not installed on this machine, so its local runtime probe remains unverified until `codium` is available on PATH.

## [0.2.1] - 2026-07-22

### Added
- Controlled terminal flow that routes supported commands through the authenticated local broker with preview, fixed-argv execution, and redacted output.
- Runtime capability summary and status coverage indicators for brokered, partial, unsupported, and unknown paths.
- Extension isolation summary for risky non-allowlisted AI/agent extensions.
- Broker preflight coverage for runtime capabilities, file operations, network egress, MCP tools, policy changes, process launches, and extension isolation.
- Strongest local release gate evidence covering typecheck, tests, audit, VSIX packaging, and isolated VS Code install verification.

### Security
- Added process sandbox policy decisions for shell, environment-secret, unrestricted-network, and unrestricted-filesystem launches.
- Added file-operation, network-egress, MCP, taint, rollback, and governance policy guardrails in the shared guard core.
- Added release evidence gates that block `99+` and `100/100` claims unless external/deployment attestations are present.
- Dependency audit now passes at high severity with `0` known vulnerabilities.

### Verified
- `npm run validate:strongest-local` passed 15/15 required local checks.
- `npm test` passed 829 tests.
- VSIX installs successfully in an isolated VS Code profile as `soterai.soterai-ide-guard@0.2.1`.

## [0.2.0] - 2026-07-14

### Added - UX pack (native, local-first, all tested)
- **Live inline scanning** - supported files are scanned as you type and secrets / PII / prompt-injection appear as native squiggly diagnostics (`soterai.liveScan.enabled`, on by default). 100% local, debounced, skips oversized files / excluded globs / non-file schemes.
- **One-click Quick Fixes** - lightbulb actions on every finding: *Redact this finding* (undoable edit), *Copy safe version of this line*, and *Move secrets to protected vault* for secret categories. Internal `soterai.applyFindingFix` command is hidden from the palette.
- **Clipboard / paste guard** - `SoterAI: Scan Clipboard Before AI` checks what's on the clipboard and offers a redacted replacement; `SoterAI: Safe Paste` scans the clipboard and can insert a redacted version instead of the raw secret. Raw clipboard values are never logged.
- **Rich status dashboard** - the existing security dashboard now shows a Live Scan badge and has *Scan Clipboard* and *Getting Started* actions, all through the strict webview message allowlist.
- **Native Getting Started walkthrough** (`contributes.walkthroughs`) - 5-step guided onboarding (privacy mode -> demo scan -> scan selection -> policy pack -> sidebar), auto-opened once on first install via a `soterai.onboarded` flag. `soterai.openWalkthrough` command added.

### Changed
- **Command Palette hygiene:** of 123 contributed commands, only the core commands show by default; the rest are gated behind `soterai.advancedCommands` (`soterai.showAllCommands` or `soterai.experimentalFeatures.enabled`, default false) or hidden outright for internal commands. Nothing unregistered.

### Verified (2026-07-14, real runs)
- `tsc --noEmit` clean; **50 tests / 17 suites pass**; esbuild production bundle (extension.js 217 KB); VSIX packages to 16 files / ~222 KB with no `src`/tests/`.env`/secrets; no `console.log`/`eval`/`innerHTML` in extension source; VSIX installs via VS Code 1.128.0 CLI and Cursor 3.10.17 CLI and registers as `soterai.soterai-ide-guard@0.2.0`.

## [0.1.0-marketplace-readiness] - 2026-07-13

### Added
- Launch command surface: `SoterAI: Quick Start`, `Check Extension Health`, `Open Settings`, `Run Demo Scan`, `Scan Selected Text`, `Scan Git Diff`, `Review Terminal Command`, `Scan MCP / Agent Tools`, `Open AI Activity Ledger`, `Generate Canary Token`, and `Choose Policy Pack`.
- `soterai.privacyMode` setting with `local`, `cloud`, and `hybrid` options. Local mode is the default.
- Static tests covering launch commands, command aliases, build/lint scripts, privacy mode, no-console logging, and documented child-process boundaries.

### Changed
- Added `build` and `lint` package scripts required by release automation.
- Telemetry now fails closed in local privacy mode and untrusted workspaces; reviewed network telemetry remains disabled.
- Removed activation and telemetry console logging from extension source.
- Documented fixed-argv non-shell boundaries for git diff scanning and local broker startup.

### Verified
- Extension package typecheck, lint, test, build, and VSIX package completed successfully.
- Root typecheck and root test completed successfully.
- Generated VSIX installed through VS Code CLI as `soterai.soterai-ide-guard@0.1.0`.

## [0.2.2] — 2026-06-27

### Fixed
- SDK env variable resolution now accepts both `SOTERAI_*` and `SOTER_*` prefixes
- All 31 documented service API references updated from `/api/v1` to real `/api/*` routes
- Legacy unverified SDK snippets hidden from customer-facing docs until integration-tested
- False "1M+ production requests" claim removed; now accurately describes deployment assets
- False "<50ms SDK latency" claim replaced with recorded HTTP p50 (891ms)
- False "independent benchmark" claim corrected to "internal regression benchmark"
- Service count updated from 32 to 33 documented services
- "OWASP LLM Top 10 Compliant" corrected to "OWASP LLM Top 10 Mapped"

### Added
- `lib/guard/scheduledPersistence.ts` — fire-and-forget guard result persistence with parallelized pre-checks
- `tests/guard/attack-pack-regression.test.ts` — 74 attack variant regression tests
- `tests/docs-service-catalog.test.ts` — contract tests verifying API references resolve to implemented routes
- `docs/APP_AUDIT_AND_COMPETITIVE_REPORT_2026-06-27.md` — comprehensive audit with competitor comparison and roadmap
- `scripts/validate-env.ts` — production environment validation script (41 checks)

### Changed
- Parallelized Redis rate-limit and monthly-usage checks in input/output guard routes
- Policy cache invalidation now uses dedicated `invalidateProjectPolicyCache()` instead of generic `deleteLocalCache()`
- Benchmark text, homepage, metadata, and badge descriptions now accurately reflect internal benchmark limitations

---

## [0.2.1] — 2026-06-21

### Fixed
- Python SDK: Fixed `pyproject.toml` license deprecation (TOML table → SPDX string)
- Python SDK: Removed deprecated `License :: OSI Approved :: MIT License` classifier

### Changed
- All packages synced to version 0.2.0 (npm) / 0.2.1 (PyPI)
- Updated main README with Package Health table and current test counts
- Cleaned up old example directories and build artifacts

### Added
- Middleware READMEs for langchain, llamaindex, vercel-ai-sdk packages
- New examples: Next.js + `@soterai/core`, FastAPI + `soter`, Flask + `soter`
- CI/CD pipeline with SDK tests, Docker build, EC2 deploy, npm/PyPI publishing
- `.gitignore` now includes `dist/` pattern

---

## [0.2.0] — 2026-06-21

### Added
- Python SDK published to PyPI as `soter` v0.2.0
- Middleware packages published to npm
  - `@soterai/langchain-middleware`
  - `@soterai/llamaindex-middleware`
  - `@soterai/vercel-ai-sdk-middleware`

---

## [0.1.0] — 2026-06-21

### Added
- Initial release of `@soterai/core` to npm
- Phase 1-6 feature implementation
- Webhook system with HMAC-SHA256 signatures
- Razorpay billing integration
- Policy engine with MONITOR / BALANCED / STRICT modes
- Next.js app with App Router
- Prisma ORM with PostgreSQL
- Docker production setup
- E2E testing with Playwright
# 2026-07-02

- Completed same-day launch readiness check for the root app, extension, n8n node, Zapier integration, and Make.com app.
- Fixed extension store privacy documentation for response scanning controls.
- Fixed the Phase 4 local secret-store test harness so it does not depend on production `NODE_ENV`.
- Built extension ZIP and n8n package tarball.
- Pushed Zapier integration version `0.1.0`; public publication remains pending platform review/account tasks.
