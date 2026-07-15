# Phase 10 Marketplace Publishing — Work Log

Started: 2026-07-15
Branch: `phase-1-release-hygiene-fix` (checked out at start of phase)
Node: v22.16.0 / npm 11.15.0 / Python 3.12.10

Every entry records: task | command | result | artifact path | files changed | evidence | publish decision | remaining blocker.

---

## Step 0 — Repository baseline + previous-phase reads

| # | task | command | result | artifact path | files changed | evidence | publish decision | remaining blocker |
|---|------|---------|--------|---------------|---------------|----------|------------------|--------------------|
| 0.1 | Confirm `.env` not tracked | `git ls-files --error-unmatch .env` | error (not tracked) | — | — | git reports pathspec did not match; `.gitignore` lists `.env` | Safe — secrets not in repo | None |
| 0.2 | Read previous phases | Task agent read PHASE-1..9 + finals | Phase 1/2/3/4/8/9 EXISTS, 5/6 MISSING, 7 corrupted null bytes | — | — | See summary in Step 1 report | — | Phase 5/6/7 docs missing |
| 0.3 | Inventory packages | Task agent inspected manifests + artifacts | See inventory in Step 1 report | — | — | All packages present; version drift confirmed | — | Repo URL + license drift across packages |

## Step 1 — Global release version + claim check

| # | task | command | result | artifact path | files changed | evidence | publish decision | remaining blocker |
|---|------|---------|--------|---------------|---------------|----------|------------------|--------------------|
| 1.1 | typecheck | `npm run typecheck` | PASS (no output) | — | — | exit 0 | Green gate | None |
| 1.2 | lint | `npm run lint` | PASS, 0 errors, 72 warnings | — | — | `✖ 72 problems (0 errors, 72 warnings)` | Green gate | Warnings not blocking |
| 1.3 | tests | `npm test` | PASS 687/687 (36.3s) | — | — | `tests 687 / pass 687 / fail 0` | Green gate | None |
| 1.4 | audit | `npm audit --omit=dev` | PASS, 0 vulnerabilities | — | — | `found 0 vulnerabilities` | Green gate | None |
| 1.5 | build | `npm run build` | PASS, Next.js production build complete | — | — | Route tree printed | Green gate | None |
| 1.6 | permission validate | `npm run validate:extension-permissions` | PASS — manifest & store docs match | — | — | `PASS: manifest permissions and store docs match.` | Green gate | None |
| 1.7 | Claim sweep — `100% secure` | rg across repo | 7 hits, all NEGATIVE framing ("makes no 100% secure claim") | — | — | docs/market/README.md:31, extensions/*/README.md | Safe — no fix needed | None |
| 1.8 | Claim sweep — `SOC2 compliant`, `best in world`, `zero false`, `enterprise certified`, `unhackable` | rg across repo | All hits in policy docs that forbid those phrases | — | — | final-claim-approval-matrix.md, marketing-claims-policy.md | Safe — no fix needed | None |
| 1.9 | Fix unsafe PH listing | Edit `docs/marketing/product-hunt-listing.md` | Removed absolute "100% detection" / "0% FP" / "MIT" claims; added corpus qualifier + license truth | — | `docs/marketing/product-hunt-listing.md` | Diff: title, tagline, benchmark block, maker comment | Safe — must not publish as "zero FP" unqualified | None |
| 1.10 | Version matrix audit | inspect manifests | Drift confirmed — see Step 1 report | — | — | table below | No publish without version reconciliation | n8n 0.2.8 vs SDK 0.2.0 vs Python 0.2.1 vs browser 0.1.2 vs WordPress 0.1.0 |

Version matrix (decided for Phase 10 — no version bumps forced; package changes will bump at real publish time):

| Package | Current | Phase 10 release tag | Rationale |
|---------|---------|----------------------|-----------|
| root (soterai) | 0.2.0 | 0.2.0 | private monorepo root, not published |
| JS SDK (@soterai/core) | 0.2.0 | 0.2.0 | unchanged since Phase 9; no code drift gated |
| Python SDK (soter) | 0.2.1 | 0.2.1 | already bumped; keep |
| VS Code (soterai-ide-guard) | 0.2.0 | 0.2.0 | unchanged |
| Browser extension | 0.1.2 | 0.1.2 | unchanged |
| n8n (n8n-nodes-soterai) | 0.2.8 | 0.2.8 | unchanged, ahead of SDK |
| WordPress | 0.1.0 | 0.1.0 (beta) | not yet published; keep beta tag |

## Step 2 — Global build/test gate

Documented above; full PASS. Details in `docs/phase-10-global-build-test-gate.md`.

---

(Continued in steps 3..15 below as they complete.)
