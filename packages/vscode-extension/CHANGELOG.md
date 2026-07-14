# Changelog

## [0.2.0] — 2026-07-14

### Added — UX pack (native, local-first, all tested)
- **Live inline scanning** — supported files are scanned as you type and secrets / PII / prompt-injection appear as native squiggly diagnostics (`soterai.liveScan.enabled`, on by default). 100% local, debounced, skips oversized files / excluded globs / non-file schemes.
- **One-click Quick Fixes** — lightbulb actions on every finding: *Redact this finding* (undoable edit), *Copy safe version of this line*, and *Move secrets to protected vault* for secret categories. Internal `soterai.applyFindingFix` command is hidden from the palette.
- **Clipboard / paste guard** — `SoterAI: Scan Clipboard Before AI` checks what's on the clipboard and offers a redacted replacement; `SoterAI: Safe Paste` scans the clipboard and can insert a redacted version instead of the raw secret. Raw clipboard values are never logged.
- **Rich status dashboard** — the existing security dashboard now shows a Live Scan badge and has *Scan Clipboard* and *Getting Started* actions, all through the strict webview message allowlist.
- **Native Getting Started walkthrough** (`contributes.walkthroughs`) — 5-step guided onboarding (privacy mode → demo scan → scan selection → policy pack → sidebar), auto-opened once on first install via a `soterai.onboarded` flag. `soterai.openWalkthrough` command added.

### Changed
- **Command Palette hygiene:** of 123 contributed commands, only the ~14 core commands show by default; the rest are gated behind `soterai.advancedCommands` (`soterai.showAllCommands` setting, default false) or hidden outright for internal commands. Nothing unregistered.

### Verified (2026-07-14, real runs)
- `tsc --noEmit` clean; **50 tests / 19 suites pass**; esbuild production bundle (extension.js 217 KB); VSIX packages to 16 files / ~222 KB with no `src`/tests/`.env`/secrets; `npm audit --omit=dev` → **0 vulnerabilities**; new files have no `console.log`/`eval`/`innerHTML`/`localStorage`; VSIX installs via VS Code 1.128.0 CLI and registers as `soterai.soterai-ide-guard@0.1.0`.

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
