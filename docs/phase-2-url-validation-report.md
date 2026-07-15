# Phase 2 — URL Validation Report

**Date:** 2026-07-14

## Live URL checks (`curl -sS -o /dev/null -w "%{http_code}"`)

| URL | Status |
|---|---|
| https://soterai.in | 200 |
| https://soterai.in/privacy | 200 |
| https://soterai.in/support | 200 |
| https://soterai.in/terms | 200 |
| https://soterai.in/security | 200 |

All required production URLs resolve with a 200 final response.

## Retired publicvm references

`grep -R "publicvm"` across the extension, `docs/extension-store`, and `scripts`
returns **none**. The only remaining hits are in unrelated `.env` values
(`CYBERRAKSHAK_BASE_URL`, `ZEROVEIL_BASE_URL` — separate services, git-ignored, never
shipped in the store package) and in historical Phase-1 changelog/work-log docs that
document the removal itself. No production/store metadata references publicvm.

## Store metadata URLs (to paste in Partner Center / Web Store)

| Field | Value |
|---|---|
| Website | https://soterai.in |
| Privacy policy | https://soterai.in/privacy |
| Support | https://soterai.in/support |
| Terms | https://soterai.in/terms |
| Security | https://soterai.in/security |
