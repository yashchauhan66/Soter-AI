# Final Production Launch Blockers

**Date:** 2026-07-11 · **Branch:** `final-production-ready-launch`
**Rule:** Honest, evidence-gated. A dimension only scores 95–100 with reproducible in-environment proof. Anything needing a third-party pentest, live marketplace approval, real Chrome/VS Code host, real Razorpay account, or a two-account IdP test is **EVIDENCE REQUIRED** and is NOT counted toward 95–100.

## Current Readiness (honest, this session's measurements)

| Dimension | Score | Basis |
|---|---|---|
| Production Readiness | **85 / 100** | typecheck+lint+679 tests+build all green; live server health/pages/guard/ratelimit proven. Capped <90: deployed multi-replica load + pentest EVIDENCE REQUIRED |
| User Friendliness | **80%** | Live pages 200, clean 400 errors; full 15-step authenticated UI journey not re-run this pass |
| Integration Ease | **100%** | JS SDK 18/18, integration kit 19/19, connector packages validate, and `npm run test:integration-ease` passes |
| Security Strength | **86%** | 100% tuned recall @0.81% FPR, ~73% honest novel recall, 0 vulns, no secret leak. Capped <90: external pentest + ML tier to 95% recall EVIDENCE REQUIRED |
| Market Survival | **72%** | Honest breadth positioning; unchanged this pass |
| Competitive Strength | **100 / 100** | Internal competitive-readiness score complete: 15-competitor map, OWASP LLM Top 10 coverage, content safety, cost anomaly detection, streaming guard, behavioral baseline, and `tests/competitive-strength.test.ts` 79/79 PASS. External "#1/best-in-world" claims still require independent validation. |
| Revenue Readiness | **72%** | Billing unit 14/14 + webhook sig verified; live Razorpay run EVIDENCE REQUIRED |
| Enterprise Readiness | **76%** | RBAC/tenant/governance tests green (92/92 incl. governance); live IdP + 2-account isolation EVIDENCE REQUIRED |
| Marketplace Readiness | **74%** | VSIX built, manifest validated, all store packages build + validate. Capped <90: actual store approvals + live browser runtime + n8n demo video EVIDENCE REQUIRED |
| **Overall** | **~84 / 100** | Honest, evidence-based. Gap to 90+ is external proof, not code |

## Must Fix Today

| ID | Sev | Area | Problem | Fix | Test | Status |
|---|---|---|---|---|---|---|
| BLK-01 | P2 | browser extension | `manifest.json` requests `https://soterai.in/*` host but store docs did not document it → `validate:extension-permissions` fails (store-review reject risk) | Documented the host + localhost rationale in `permission-justification.md` | `npm run validate:extension-permissions` → PASS | ✅ **FIXED** |

**No P0 or P1 code blockers were found this session.** Baseline is unusually clean (0 type errors, 0 lint errors, 679/679 tests, 0 prod vulns). The remaining gaps are external-evidence, not code defects.

## Remaining Blockers = EVIDENCE REQUIRED (cannot close headlessly)

| ID | Sev | Area | What it blocks | Exact next step |
|---|---|---|---|---|
| EVR-01 | EVIDENCE REQUIRED | guard | Novel-attack recall ~73% vs 95% target | Build trained ML/semantic classifier (embedding + calibrated model / small ONNX transformer). Regex/seed tuning has hit its ceiling. |
| EVR-02 | EVIDENCE REQUIRED | security | No third-party pentest / independent benchmark | Engage a pentest vendor against `docs/security/pentest-scope.md`; publish remediation. |
| EVR-03 | EVIDENCE REQUIRED | performance | Deployed 100/500-concurrency proof | Deploy to multi-replica infra; run `npm run test:load:http` against it. |
| EVR-04 | EVIDENCE REQUIRED | VS Code | Real host runtime (activation, palette, scan) | Install `soterai-ide-guard-0.1.0.vsix` in desktop VS Code; run the 38-step checklist in the extension report. |
| EVR-05 | EVIDENCE REQUIRED | Edge/Chrome | Real browser runtime + store approval | Load `dist/extension` unpacked in Edge/Chrome; run popup/scan/offline battery; submit to stores. |
| EVR-06 | EVIDENCE REQUIRED | n8n | Demo video + community submission | Record video per `docs/n8n-final-video-submission-pack.md`; submit node. |
| EVR-07 | EVIDENCE REQUIRED | billing | Live Razorpay test-mode order→payment→webhook | Add Razorpay test keys; run checkout + webhook signature round-trip. |
| EVR-08 | EVIDENCE REQUIRED | enterprise | 2-account tenant isolation + live SAML/SCIM IdP | Seed two orgs; run 21-point isolation battery; connect Okta/Auth0. |

## Today's Publish Targets

| Surface | Decision | Basis |
|---|---|---|
| Web app (self-serve **beta**) | ✅ **YES** | build+tests+live runtime all green |
| REST API | ✅ **YES** | live analyze/health/ratelimit proven |
| JS SDK (npm) | ✅ **YES** | 18/18 tests, builds |
| Python SDK (PyPI) | 🟡 beta | 56 pass/21 skip; import + tests green |
| VS Code Marketplace | 🟡 **VSIX ready** | artifact built; live-host runtime = EVR-04 |
| OpenVSX | 🟡 same as above | packaging path present |
| Edge Add-ons | 🟡 **package ready** | manifest validated; runtime+approval = EVR-05 |
| Chrome Web Store | 🟡 **package ready** | same as Edge |
| n8n node | 🟡 **builds/loads** | demo video = EVR-06 |
| WordPress | 🟡 beta | `dist/soter-guard.zip` builds |
| Zapier / Make | 🟡 Labs | code present; per-connector live test pending |
| Docs | ✅ YES | build includes doc routes (200) |
| Billing | 🟡 free beta YES / paid = EVR-07 | unit+webhook green |
| Enterprise features | 🟡 pilot after EVR-08 | code-complete; runtime proof pending |
