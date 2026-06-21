# Changelog

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
