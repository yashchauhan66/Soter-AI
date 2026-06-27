# Changelog

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
