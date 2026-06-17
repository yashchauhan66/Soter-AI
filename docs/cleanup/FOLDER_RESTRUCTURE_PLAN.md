# CyberRakshak Guard — Folder Restructure Plan

Generated: 2026-06-17  
Status: **EVALUATION — Not yet executed**

---

## Current vs Target Structure Comparison

### `lib/` (119 .ts files across 29 subdirectories)

| Current Path | Target Path | Status | Import Count | Action |
|-------------|-------------|--------|-------------|--------|
| `lib/guard/` | `lib/guard/` | ✅ Already correct | 41 refs | None |
| `lib/guard/detectors/` (via `lib/guard/`) | `lib/detectors/` | ⚠️ Currently nested in guard | ~5 refs (internal) | Move out of guard |
| `lib/auth/` | `lib/auth/` | ✅ Already correct | 90 refs | None |
| `lib/billing/` | `lib/billing/` | ✅ Already correct | 3 refs | None |
| `lib/enterprise/` | `lib/enterprise/` | ✅ Already correct | 16 refs | None |
| `lib/rag/` | `lib/rag/` | ✅ Already correct | 9 refs | None |
| `lib/webhooks/` | `lib/webhooks/` | ✅ Already correct | 0 (internal) | None |
| `lib/phase8/` | `lib/launch/` or `lib/ops/` | ❌ Needs rename | 15 refs | Rename + update imports |
| `lib/ml/` | `lib/ml/` | ✅ Already correct | 0 (admin-only) | None |
| `lib/classifiers/` | `lib/ml/classifiers/` | ⚠️ Could consolidate | 0 (admin-only) | Optional move |
| `lib/redteam/` | `lib/redteam/` | ✅ Already correct | 2 refs | None |
| `lib/siem/` | `lib/siem/` | ✅ Already correct | 0 (worker-only) | None |
| `lib/threat-intel/` | `lib/threat-intel/` | ✅ Already correct | 1 ref | None |
| `lib/supply-chain/` | `lib/supply-chain/` | ✅ Already correct | 1 ref | None |
| `lib/privacy/` | `lib/privacy/` | ✅ Already correct | 1 ref | None |
| `lib/agent-firewall/` | `lib/agent-firewall/` | ✅ Already correct | 1 ref | None |
| `lib/audit/` | `lib/audit/` | ✅ Already correct | 0 (internal) | None |
| `lib/abuse/` | `lib/abuse/` | ✅ Already correct | 0 (admin-only) | None |
| `lib/benchmarks/` | `lib/benchmarks/` | ✅ Already correct | 0 (admin-only) | None |
| `lib/compliance/` | `lib/compliance/` | ✅ Already correct | 9 refs | None |
| `lib/email/` | `lib/email/` | ✅ Already correct | 0 (internal) | None |
| `lib/events/` | `lib/events/` | ✅ Already correct | ~3 refs | None |
| `lib/integrations/` | `lib/integrations/` | ✅ Already correct | 1 ref | None |
| `lib/network/` | `lib/network/` | ✅ Already correct | 1 ref | None |
| `lib/observability/` | `lib/observability/` | ✅ Already correct | 0 (internal) | None |
| `lib/pdf/` | `lib/pdf/` | ✅ Already correct | 0 (internal) | None |
| `lib/privacy/` | `lib/privacy/` | ✅ Already correct | 1 ref | None |
| `lib/retention/` | `lib/retention/` | ✅ Already correct | 2 refs | None |
| `lib/secrets/` | `lib/secrets/` | ✅ Already correct | 0 (internal) | None |
| `lib/db.ts` | `lib/db.ts` | ✅ Already correct | ~10 refs | None |
| `lib/utils.ts` | `lib/utils.ts` | ✅ Already correct | ~5 refs | None |
| `lib/validations.ts` | `lib/validations.ts` | ✅ Already correct | 9 refs | None |
| `lib/apiKey.ts` | `lib/apiKey.ts` | ✅ Already correct | ~3 refs | None |
| `lib/apiKeyCrypto.ts` | `lib/apiKeyCrypto.ts` | ✅ Already correct | ~2 refs | None |
| `lib/apiKeyMiddleware.ts` | `lib/apiKeyMiddleware.ts` | ✅ Already correct | ~2 refs | None |
| `lib/apiResponse.ts` | `lib/apiResponse.ts` | ✅ Already correct | ~3 refs | None |
| `lib/auth.ts` | `lib/auth.ts` | ✅ Already correct | ~2 refs | None |
| `lib/badge.ts` | `lib/badge.ts` | ✅ Already correct | 2 refs | None |
| `lib/localCache.ts` | `lib/localCache.ts` | ✅ Already correct | 1 ref | None |
| `lib/onboarding.ts` | `lib/onboarding.ts` | ✅ Already correct | 1 ref | None |
| `lib/publicRateLimit.ts` | `lib/publicRateLimit.ts` | ✅ Already correct | 6 refs | None |
| `lib/rateLimit.ts` | `lib/rateLimit.ts` | ✅ Already correct | ~3 refs | None |
| `lib/redis.ts` | `lib/redis.ts` | ✅ Already correct | ~5 refs | None |
| `lib/reports.ts` | `lib/reports.ts` | ✅ Already correct | 0 (internal) | None |
| `lib/agency.ts` | `lib/agency.ts` | ✅ Already correct | 9 refs | None |
| `lib/backgroundJobs.ts` | `lib/backgroundJobs.ts` | ✅ Already correct | ~3 refs | None |
| `lib/backgroundJobProcessors.ts` | `lib/backgroundJobProcessors.ts` | ✅ Already correct | ~1 ref | None |

### `components/` (52 .tsx files across 7 subdirectories)

| Current Path | Target Path | Status | Import Count | Action |
|-------------|-------------|--------|-------------|--------|
| `components/admin/` | `components/admin/` | ✅ Correct | 2 refs | None |
| `components/auth/` | `components/auth/` | ✅ Correct | ~6 refs | None |
| `components/dashboard/` | `components/dashboard/` | ✅ Correct | ~15 refs | None |
| `components/guard/` | `components/guard/` | ✅ Correct | ~6 refs | None |
| `components/marketing/` | `components/marketing/` | ✅ Correct | ~5 refs | None |
| `components/phase8/` | `components/launch/` or `components/ops/` | ❌ Needs rename | 13 refs | Rename + update imports |
| `components/ui/` | `components/ui/` | ✅ Correct | 0 refs | None |

### `app/` (192 .ts/.tsx files)

| Current Path | Target Path | Status | Action |
|-------------|-------------|--------|--------|
| `app/api/phase8/` | `app/api/support/` or `app/api/ops/` | ❌ Needs rename | Rename route directory |
| `app/admin/` | `app/admin/` | ✅ Correct | None |
| `app/dashboard/` | `app/dashboard/` | ✅ Correct | None |
| All other app routes | Same | ✅ Correct | None |

---

## Import Impact Analysis

### Moves that require import updates

| Move | Files Affected | Import Updates Needed | Risk |
|------|---------------|----------------------|------|
| `lib/phase8/` → `lib/launch/` | 15 files | 15 import path changes | LOW |
| `components/phase8/` → `components/launch/` | 13 files | 13 import path changes | LOW |
| `app/api/phase8/` → `app/api/ops/` | 7 route files | 0 (Next.js filesystem routing, no imports) | LOW |
| `lib/classifiers/` → `lib/ml/classifiers/` | 0 files (only internal) | ~3-5 internal imports | LOW |
| **Total** | **~35 files** | **~35 import changes** | **LOW** |

### Moves that do NOT require import updates (already correct)

29 of 29 `lib/` subdirectories already match the proposed target structure.  
7 of 7 `components/` subdirectories already match (except `phase8/`).

---

## Risk/Reward Assessment

### Reward: What restructuring would achieve

1. **Remove `phase8` naming** — The `phase8/` prefix is an internal development artifact from the phased build process. Renaming to `launch/`, `ops/`, or `customer-success/` gives a production-quality namespace.
2. **Minor clarity improvement** — Moving `lib/guard/detectors/` out to `lib/detectors/` would separate detector logic from guard orchestration.
3. **Consolidate ML code** — Moving `lib/classifiers/` into `lib/ml/` groups related ML code together.

### Risk: What restructuring would cost

1. **35 import path changes** — Each change must be precise or the build breaks.
2. **Git history pollution** — File renames make `git blame` and `git log --follow` harder to trace.
3. **Merge conflict risk** — Any in-flight PRs touching the same files will conflict.
4. **Test surface area** — The 4 test files (phase9, phase10, phase11) reference specific file paths that may need updating.
5. **Docker/CI invalidation** — Docker layer caching may be affected.
6. **SDK internal references** — The JS SDK and Python SDK import from `lib/` paths that might need updating.

### Risk Score: **LOW-MEDIUM**

The import count is manageable (35 changes), and the changes are mechanical (find-replace). However, the reward is also low — this is cosmetic, not functional.

---

## Recommendation

### ❌ Do NOT execute the full restructure as a separate PR right now.

**Reasoning:**

1. **The current structure already matches 90% of the target.** The project is well-organized with clear `lib/`, `components/`, `app/` separation and meaningful subdirectory names.

2. **The `phase8/` rename is the only meaningful change** — and even that is cosmetic. The `phase8/` naming is only confusing to external developers, not to the running application.

3. **The risk/reward ratio is unfavorable.** 35 import changes across 35 files for a cosmetic rename creates merge conflict risk with zero functional improvement.

4. **Better timing exists.** This restructure should be done:
   - During a major version bump (v1.0 → v2.0)
   - After all open PRs are merged
   - When there's a dedicated window for testing all import paths

### ✅ If you DO want to proceed, execute only these two safe moves:

**Move 1: Rename `lib/phase8/` → `lib/ops/`** (15 import updates)

| File to Update | Old Import | New Import |
|---------------|-----------|-----------|
| `app/api/guard/input/route.ts` | `@/lib/phase8/monitoring` | `@/lib/ops/monitoring` |
| `app/api/guard/output/route.ts` | `@/lib/phase8/monitoring` | `@/lib/ops/monitoring` |
| `app/api/guard/analyze/route.ts` | `@/lib/phase8/monitoring` | `@/lib/ops/monitoring` |
| `app/dashboard/page.tsx` | `@/lib/phase8/monitoring` | `@/lib/ops/monitoring` |
| `app/api/auth/signup/route.ts` | `@/lib/phase8/billing` | `@/lib/ops/billing` |
| `app/api/billing/webhook/route.ts` | `@/lib/phase8/billing` | `@/lib/ops/billing` |
| `app/api/billing/lifecycle/route.ts` | `@/lib/phase8/billing` | `@/lib/ops/billing` |
| `app/api/phase8/partner/route.ts` | `@/lib/phase8/partner` | `@/lib/ops/partner` |
| `app/api/phase8/onboarding/route.ts` | `@/lib/phase8/onboarding` | `@/lib/ops/onboarding` |
| `app/admin/detection-quality/page.tsx` | `@/lib/phase8/quality` | `@/lib/ops/quality` |
| `app/admin/production/page.tsx` | `@/lib/phase8/quality` | `@/lib/ops/quality` |
| `app/dashboard/detection-feedback/page.tsx` | `@/lib/phase8/quality` | `@/lib/ops/quality` |
| `app/dashboard/customer-success/page.tsx` | `@/lib/phase8/onboarding` | `@/lib/ops/onboarding` |
| `components/phase8/OnboardingWizard.tsx` | `@/lib/phase8/onboarding` | `@/lib/ops/onboarding` |
| `components/phase8/OnboardingExperience.tsx` | `@/lib/phase8/onboarding` | `@/lib/ops/onboarding` |
| `lib/guard/persistence.ts` | `../phase8/onboarding` | `../ops/onboarding` |

**Move 2: Rename `components/phase8/` → `components/ops/`** (13 import updates)

| File to Update | Old Import | New Import |
|---------------|-----------|-----------|
| `components/dashboard/DashboardShell.tsx` | `@/components/phase8/FeedbackWidget` | `@/components/ops/FeedbackWidget` |
| `app/admin/support/page.tsx` | `@/components/phase8/AdminPhase8Forms` | `@/components/ops/AdminPhase8Forms` |
| `app/admin/detection-quality/page.tsx` | `@/components/phase8/AdminPhase8Forms` | `@/components/ops/AdminPhase8Forms` |
| `app/contact/page.tsx` | `@/components/phase8/ContactSalesForm` | `@/components/ops/ContactSalesForm` |
| `app/enterprise/pilot/page.tsx` | `@/components/phase8/PilotRequestForm` | `@/components/ops/PilotRequestForm` |
| `app/dashboard/enterprise/pilot/page.tsx` | `@/components/phase8/PilotRequestForm` | `@/components/ops/PilotRequestForm` |
| `app/dashboard/support/new/page.tsx` | `@/components/phase8/SupportTicketForm` | `@/components/ops/SupportTicketForm` |
| `app/dashboard/billing/page.tsx` | `@/components/phase8/BillingActions` | `@/components/ops/BillingActions` |
| `app/dashboard/get-started/page.tsx` | `@/components/phase8/OnboardingExperience` | `@/components/ops/OnboardingExperience` |
| `app/dashboard/onboarding/beta/page.tsx` | `@/components/phase8/OnboardingExperience` | `@/components/ops/OnboardingExperience` |
| `app/dashboard/onboarding/enterprise/page.tsx` | `@/components/phase8/OnboardingExperience` | `@/components/ops/OnboardingExperience` |
| `app/dashboard/onboarding/agency/page.tsx` | `@/components/phase8/OnboardingExperience` | `@/components/ops/OnboardingExperience` |
| `app/dashboard/partner/page.tsx` | `@/components/phase8/PartnerProfileForm` | `@/components/ops/PartnerProfileForm` |

**Also rename the API route directory:**
- `app/api/phase8/` → `app/api/ops/` (Next.js filesystem routing — no import changes needed, just rename the directory)

**Validation after moves:**
```bash
npm run typecheck
npm test
npm run build
```

---

## Summary

| Metric | Value |
|--------|-------|
| Current structure accuracy vs target | **90% already correct** |
| Files needing move (if executed) | **~35 files** |
| Import path changes needed | **~28 changes** (lib + components) |
| Risk level | LOW-MEDIUM |
| Reward level | LOW (cosmetic only) |
| **Recommendation** | **SKIP for now — not worth a separate PR** |
