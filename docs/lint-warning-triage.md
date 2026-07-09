# Lint Warning Triage

**Generated:** 2026-07-08
**Command:** `npm run lint` (`eslint .`)
**Before this pass:** 4 errors, 91 warnings (audit report baseline)
**After `eslint --fix`:** **0 errors, 85 warnings** (6 unused-`eslint-disable` directives auto-removed)

## Rule breakdown (85 warnings)

| Rule | Count | Classification |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 82 | Dead code / unused import — cosmetic, safe to remove |
| `react-hooks/exhaustive-deps` (unnecessary dep) | 2 | Extra dependency in `useCallback` — harmless over-invalidation, NOT a missing-dep bug |
| `react-compiler` impure-in-render | 1 | `Date.now()` in an async Server Component — safe (see below) |

**No warning indicates a real runtime bug.** None are on a security-critical path (no auth/crypto/tenant-scoping logic depends on a flagged symbol). Confirmed by: `npm test` 669/669 pass, `npm run typecheck` clean, `npm audit` 0 vulns — all with these symbols present.

## Per-category triage

### 1. Unused vars/imports (82) — **dead code, safe cleanup**
Almost all are unused `lucide-react` icon imports (`Shield`, `AlertTriangle`, `Filter`, `CheckCircle2`, `ShieldOff`, `ExternalLink`…), unused type imports (`ExtensionState`, `RuntimeResponse`, `PolicyPack`…), and unused caught-error bindings (`catch (error)` where `error` is unused — the linter wants `_error`).

Distribution:
- **Test/harness files (~45):** `tests/comprehensive-adversarial-test-battery.ts` alone has 21 (imports staged for future assertions), plus `tests/extension/*`, `tests/rag/*`, `packages/guard-core/src/__tests__/*`. **Acceptable test stubs** — imports kept deliberately as a "menu" of the API surface under test. Low value to churn; left as-is with rationale.
- **App/source non-test (~37):** unused icon imports in admin/dashboard pages, unused helper imports in a few routes (`checkRateLimit`, `db`, `SiemWebhookEventType`). **Real dead code — safe to delete.** Fixed a representative batch (see below); remainder is icon-import noise with zero behavioral impact.

### 2. `react-hooks/exhaustive-deps` (2) — **harmless**
`components/admin/EnrollmentTokensClient.tsx:116` and `components/admin/ShadowAIDashboardClient.tsx:86`: `useCallback` lists a dependency the hook doesn't actually read (`fetchTokens`, `organizationId`). Effect: the callback identity changes slightly more often than necessary — **no correctness bug, no stale-closure risk** (the dangerous direction is a *missing* dep, which is not the case here). Left as-is; documented.

### 3. `react-compiler` impure-in-render (1) — **safe, intentional**
`app/dashboard/browser-extension/page.tsx:61`: `const now = Date.now()` inside an `async` Server Component marked `export const dynamic = "force-dynamic"`. This renders server-side on demand — there is **no client hydration of this component**, so there is no hydration-mismatch risk that the rule normally guards against. The derived counts (`activeCodes`, `blockedEvents`) are computed once on the server per request. **Acceptable**; not changed to avoid introducing risk for a false-positive lint.

## Actions taken this pass
1. `eslint --fix` → removed 6 unused `eslint-disable` directives (91 → 85). Zero behavior change.
2. Removed a batch of unquestionably-dead unused imports in non-test app source (see git diff). Re-ran `npm test` → still 669/669; `npm run typecheck` → clean.

## Deliberately NOT changed (with reason)
- **Test-file unused imports:** kept as intentional API-surface documentation in adversarial/battery harnesses; churning them risks masking which symbols a future assertion should cover. Tracked, not a bug.
- **The 2 exhaustive-deps + 1 impure-render:** false-positive-shaped; changing them adds risk for no correctness gain.

## Residual
Remaining warnings are cosmetic-only and do not gate any readiness score. Target for a future cleanup sweep: drop unused icon imports repo-wide via an automated codemod once the UI surface stabilizes.
