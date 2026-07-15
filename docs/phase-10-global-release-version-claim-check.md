# Phase 10 — Global Release Version & Claim Check

Date: 2026-07-15
Branch: `phase-1-release-hygiene-fix`

## 1. Version inventory (inspected manifests)

| Package | Manifest | name | version | license | repository |
|---------|----------|------|---------|---------|------------|
| root | `package.json` | `soterai` | 0.2.0 | BSL 1.1 (LICENSE) | n/a (private) |
| JS SDK | `packages/sdk/package.json` | `@soterai/core` | 0.2.0 | Apache-2.0 | unset ⚠ |
| Python SDK | `packages/python-sdk/pyproject.toml` | `soter` | 0.2.1 | Apache-2.0 | `github.com/soter/guard` ⚠ stale |
| VS Code | `packages/vscode-extension/package.json` | `soterai-ide-guard` | 0.2.0 | BSL 1.1 | `yashchauhan66/Ai-Security-Guard.git` |
| Browser ext | `apps/extension/manifest.json` | — (display: "Soter Enterprise AI Control Plane") | 0.1.2 | none declared | none declared ⚠ |
| n8n | `packages/integrations/n8n/package.json` | `n8n-nodes-soterai` | 0.2.8 | MIT | `yashchauhan66/Soter-AI.git` ⚠ inconsistent |
| WordPress | `integrations/wordpress-plugin/soter-guard/soter-guard.php` "SoterAI Guard" | 0.1.0 | GPL-2.0-or-later | soterai.in |

### Drift findings
- **Version drift across packages**: SDK 0.2.0 / Python 0.2.1 / VS Code 0.2.0 / browser 0.1.2 / n8n 0.2.8 / WordPress 0.1.0. Each tracks its own line; legal since they release independently, but no single "SoterAI platform version" exists.
- **Repo URL drift**: VS Code points at `Ai-Security-Guard`, n8n at `Soter-AI`, Python SDK at `github.com/soter/guard` (fictive), JS SDK and browser have no repo URL. Recommended canonical: `https://github.com/yashchauhan66/Ai-Security-Guard`.
- **License drift**: root BSL 1.1, JS/Python SDK Apache-2.0, n8n MIT, WordPress GPL-2.0-or-later, browser unset. This is legal (different components can carry different permissive OSI licenses), but `product-hunt-listing.md` previously claimed "MIT" globally — fixed in §3 below.

### CHANGELOG presence

| Package | CHANGELOG present? |
|---------|---------------------|
| JS SDK | NO ⚠ |
| Python SDK | NO ⚠ |
| VS Code | YES |
| n8n | YES |
| Browser ext (`apps/extension/`) | NO ⚠ |
| WordPress | readme.txt has 0.1.0 changelog section |

## 2. Phase 10 release version decisions

No version bumps forced this phase. Released versions to be tagged at actual publish time:

| Channel | Release version | Reason |
|---------|-----------------|--------|
| npm JS SDK | 0.2.0 | unchanged; publish at 0.2.0 if approved |
| PyPI Python SDK | 0.2.1 beta | already bumped; keep as Beta classifier |
| VS Code Marketplace | 0.2.0 | unchanged; `preview:false` already set |
| OpenVSX | 0.2.0 | same VSIX as VS Code |
| Edge Add-ons | 0.1.2 | unchanged |
| Chrome Web Store | 0.1.2 | unchanged |
| n8n Creator Portal | 0.2.8 | unchanged |
| WordPress | 0.1.0 beta | — beta until runtime-tested |

Rule of thumb observed: a version must increase if the package changes. None of these packages changed in Phase 10 prior to publish time; existing versions stand.

## 3. Claim search results

Patterns searched (case-insensitive) across `README.md docs packages apps app components`:

| pattern | hits | disposition |
|---------|------|-------------|
| `100% secure` | 7 | ALL negative framing ("makes no 100% secure claim"). Safe. |
| `SOC2 compliant` | many | ALL in policy/blocker docs that forbid the claim. Safe. |
| `best in world` | many | ALL in policy docs / competitor benchmark verdict ("NOT ALLOWED"). Safe. |
| `zero false positives` (incl. `0% false positive`) | 1 in `docs/marketing/product-hunt-listing.md` | **Fixed** — added corpus qualifier. |
| `enterprise certified` | many | ALL in policy docs that forbid. Safe. |
| `100% detection`, `F1 = 1.0000` unqualified | 1 file (Product Hunt listing) | **Fixed** — corpus qualifier + license truth. |
| `MIT` (license claim) | 1 file (Product Hunt listing) | **Fixed** — corrected to "Apache-2.0 SDK, BSL 1.1 backend". |
| `guarantee complete security` | 1 hit in `app/page.tsx` FAQ | Already framed as a denial ("No."). Safe. |

## 4. Files changed in this step

- `docs/marketing/product-hunt-listing.md` — replaced absolute benchmark wording with corpus-qualified wording; corrected license from "MIT" to "Apache-2.0 SDK, BSL 1.1 backend"; added qualifier block under the benchmark table and the maker's first comment.

## 5. No-claim list enforced (re-confirmed for Phase 10)

Per `docs/marketing-claims-policy.md` the following remain NOT APPROVED for external publication in any Phase 10 listing:

- "100% secure", "unhackable", "zero risk", "stops all attacks"
- "World's best", "market leader", "#1" without independent study
- "Fully enterprise certified", "SOC2 compliant/certified" (readiness program only)
- "pentest-verified" (no external pentest yet)
- "marketplace-approved" (no actual approval exists)

## 6. Decision

- Version and claim check: **PASS for marketplace submission readiness**.
- Repo URL drift and CHANGELOG gaps should be fixed before any *actual* public publish, but are not blockers to producing submission packs in this phase.
- Phases 5, 6, 7 are missing/corrupted on disk; this is a documentation gap only and does not affect publishability of the artifacts that exist.

## 7. Remaining blocker

- Canonicalize repo URL to `https://github.com/yashchauhan66/Ai-Security-Guard` across JS SDK, Python SDK, n8n package, browser extension manifest before public publish.
- Author CHANGELOG.md for JS SDK, Python SDK, browser extension before public publish.
- Restore Phase 5/6/7 docs (out of scope of Phase 10 marketplace publishing).
