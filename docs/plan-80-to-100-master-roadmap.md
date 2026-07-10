# Master Roadmap: 80 → 100

**Date:** 2026-07-10
**Baseline:** `docs/MASTER-STATUS-REPORT-2026-07-10.md` (overall ~80/100)
**Rule:** 100 is awarded **only with real proof**. This plan separates what we can drive **in-repo now** from what needs an **external party / infrastructure / budget / time**. No dimension is marked 100 until its evidence artifact exists.

---

## 0. Hinglish summary — kaise 100 pe pahunchenge

80 → 100 ka gap **naya feature nahi, mostly proof/evidence** hai. 8 tracks hain. Do cheezein sabse zyada score move karti hain:

1. **ML/semantic detection tier (Track A)** — novel-attack recall ~64% → 95%. Ye **in-repo** ho sakta hai, sabse bada technical lever.
2. **External validation (Track D)** — pentest + independent benchmark + SOC2. Ye **external** hai (firm/auditor + paisa + time), par iske bina Security/Competitive/Enterprise 90 se upar nahi ja sakte — honestly.

Baaki tracks (deployed scale, live runtime proofs, marketplace publish, GTM) environment/accounts maangte hain. **Realistic: in-repo tracks 3–5 hafte; external tracks 2–4 mahine (parallel).** Har track ke acceptance criteria neeche hain.

---

## 0.5. LIVE DEPLOYMENT (soterai.in) — verified 2026-07-10

**The app is deployed** on a self-hosted nginx/Ubuntu server at https://soterai.in/. Light probes confirm the core product works live: guard detection (ALLOW/BLOCK correct), rate limiting (20 RPM enforced), auth gating (`/dashboard`→`/signin`), HTTPS+HSTS, strong security headers, valid TLS, `/api/health`, sitemap/robots. Full artifact: `docs/live-deployment-verification-2026-07-10.md`.

**This changes the plan:** Track B (deployed scale) is now infra-unblocked, and Tracks C3/C4/C5 can run against real infra. But 4 production issues must be fixed first (Track 0).

### Track 0 — Production hotfix + redeploy (do first)  ✅ in-repo

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `/blog` → 404 (exists in code: `app/blog/page.tsx` + 3 posts) | **P1** | Redeploy current build; check nginx `/blog` trailing-slash routing |
| 2 | `security.txt` → 404 (both `/.well-known/` and `/`) | P2 | Ship `public/.well-known/security.txt`; nginx serve `.well-known` |
| 3 | Deployed build predates Phase 4/5/15 (no `advisory` in guard metadata) | P2 | Commit + redeploy this session's work |
| 4 | nginx version exposed in `Server` header | P3 | `server_tokens off;` |

**Acceptance:** `/blog` 200, `security.txt` 200, guard response includes `metadata.advisory`, `Server` header generic. **Effort:** ~half day + a redeploy.

---

## 1. Gap map — har dimension ko 100 tak kya chahiye

| Dimension | Now | To 100 needs | Track | In-repo? |
|---|---|---|---|---|
| Production Readiness | 83 | Deployed 100/500 load, auth data-path load, DB/Redis pooling proven, CWV on deployed | B | ⚠ infra |
| User Friendliness | 78 | Real 15-step journey, empty/error/mobile/a11y fixes, onboarding docs, measured activation | C1 | ✅ mostly |
| Integration Ease | 87 | Every connector live-tested, Python parity, live n8n | C2 | ⚠ envs |
| Security Strength | 84 | **ML tier → 95% recall**, external pentest, full security-docs pack | A, D, E | A/E ✅, D external |
| Market Survival | 72 | Efficacy proof + real pilots/case studies + GTM | D, G | ⚠ market |
| Competitive Strength | 70 | Independent benchmark, ML tier live | A, D | A ✅, D external |
| Revenue Readiness | 70 | Razorpay live run, real conversions | C3, G | ⚠ account/market |
| Enterprise Readiness | 74 | Live IdP SSO/SCIM, 2-tenant isolation, SOC2 Type I | C4, D | C4 ⚠ env, SOC2 external |
| Marketplace Readiness | 60 | VS Code + browser store runtime + listings | F | ⚠ store accounts |
| **Overall** | **80** | All above | — | — |

---

## 2. Track A — Detection to 95%+ (ML/semantic tier)  ✅ in-repo

**Why:** the single biggest technical objection. Novel-attack recall is ~64% (regex ceiling). This is the #1 lever for Security + Competitive.

**Steps**
1. **Design the semantic tier.** Extend `lib/guard/semanticClassifier.ts`: expand seed embeddings per attack family (jailbreak, system-leak, exfil, tool-abuse, rag-poison, multilingual). Keep the existing "semantic-only hit → HUMAN_REVIEW" precision guard.
2. **Add a lightweight ML classifier** (embedding + logistic/SVM or a small transformer via ONNX runtime) trained on the 1,218 + 1,000 expanded corpus, evaluated **only on the held-out sets** it was never trained on.
3. **Wire it as a recall booster** after the rules (already the pattern in `analyzeText`): novel wording → semantic/ML tier → BLOCK/REVIEW; never lowers precision below the gate.
4. **Iterate to target** with `scripts/guard-benchmark/measure-expanded.ts` + the held-out probes (`fresh-heldout.ts`, `validation-heldout.ts`) — but **never tune against the validation set** in `tests/guard/heldout-generalization.test.ts`.
5. **Raise the honest gate** in that test from ≥55% floor toward ≥90% as it genuinely improves.
6. **Re-publish** honest numbers in `docs/detection-honest-generalization.md`, the market docs, and the master report.

**Acceptance:** untuned held-out recall **≥95%**, benign FPR **<1%**, tuned corpus not regressed, `npm test` green. Update GAP-01 to CLOSED (internal); external red-team still separate (Track D).

**Evidence artifact:** new `tests/guard/ml-tier-heldout.test.ts` + refreshed `scripts/guard-benchmark/*` results committed.

**Effort:** ~1–2 weeks. **Owner:** ML/Detection.

---

## 3. Track B — Deployed production scale  ⚠ infra EXISTS (soterai.in), scale run pending

**Why:** Production >90 impossible without deployed proof (local single-process ceiling already documented in Phase 5).
**Update (2026-07-10):** deployment is **live** at https://soterai.in/ (self-hosted nginx/Ubuntu). Infra provisioning is done; what remains is the actual scale run + pooling verification.

**Steps**
1. ~~Provision a deployed environment~~ **Done — soterai.in is live.** Confirm the topology: how many app replicas run behind nginx, managed Postgres (enable the **Neon pooler** fix — known pending for 5,000-user scale), Upstash Redis, and the `DYNAMODB_EVENTS_ENABLED` heavy-event path. Add a horizontal-scale/replica config if it is currently single-node.
2. Run the Phase 5 harness against deployed infra at **100/500 concurrency** (multi-replica): `scripts/perf/{guard-api,public-pages}-load-test.js` + `server-resource-monitor.js`.
3. Run the **authenticated** data-path load with a real session cookie: `perf:dashboard`, `perf:logs`, `perf:reports`.
4. Capture deployed **Core Web Vitals** on the live site.
5. Verify DB/Redis under load: connection pooling, no N+1, indexes present, pagination correct.

**Acceptance:** deployed p95 within SLO at c=100 (guard) / c=500 (pages), 0 significant errors, no memory leak, CWV green. Fill the EVIDENCE REQUIRED rows in `docs/performance-production-benchmark.md`.

**Effort:** ~3–5 days once infra exists. **Owner:** Platform/DevOps. **External dep:** hosting + managed DB/Redis.

---

## 4. Track C — Live runtime proofs (Phases 6–12)  ⚠ needs environments

Each is code-complete; each needs a real environment run. All produce a dated runtime test report.

- **C1 — Web-app user journey (Phase 6).** Playwright 15-step journey (`scripts/runPlaywright.mjs`, OneDrive/Turbopack workaround). Fix empty/loading/error states, nav, **mobile + a11y** (known open gaps). Docs: `quickstart-first-5-minutes.md`, `user-onboarding-checklist.md`, `feature-status-matrix.md`. → **User Friendliness 100.**
- **C2 — Integrations live (Phases 7, 13).** Docker n8n → 5 workflows; then the full integration matrix (JS/Python/WordPress/Zapier/Make/Langflow/Flowise/Dify/Botpress/Voiceflow/LangChain/LlamaIndex/Vercel-AI): install + auth + one working example + invalid-key + error handling; label Stable/Beta/Labs. Docs: `docs/integrations/integration-status-matrix.md`, `live-integration-test-report.md`. → **Integration Ease 100.**
- **C3 — Billing live (Phase 10).** Razorpay test keys → order → payment success/fail → webhook valid/invalid signature → subscribe/cancel/reactivate → over-limit. Docs: `billing-test-report.md`. → **Revenue (runtime part) unblocked.**
- **C4 — Enterprise + tenant isolation (Phase 11).** Two orgs → 21-point isolation battery (A can't reach B's data; role separation; audit logs; direct-URL block) added to CI; live IdP (Okta/Auth0/Google) SSO + SCIM create/update/deactivate. Docs: `enterprise-runtime-test-report.md`. → **Enterprise (runtime part) unblocked.**
- **C5 — RAG security live (Phase 12).** Live vector store + 2 tenants: upload safe + malicious docs → quarantine → not retrieved → namespace/ACL isolation → cross-tenant blocked → grounding guard blocks unsupported claim. Docs: `rag-security-live-test-report.md`.

**Acceptance:** each phase's checklist passes on a real host; runtime report committed. **Effort:** ~1–2 weeks total. **External dep:** Docker/n8n, VS Code host, Chrome/Edge, Razorpay test account, IdP tenant, vector store.

---

## 5. Track D — External validation  ⛔ external, cost + time

**This is the hard gate for Security/Competitive/Enterprise to reach 100. Cannot be self-issued.**

- **D1 — External penetration test.** Prepare the package (Track E), commission a reputable firm, remediate findings, publish a summary. → unblocks Security + Enterprise ceilings.
- **D2 — Independent detection benchmark.** Third party evaluates recall/FPR vs peers on a shared corpus. Only then can any cross-vendor efficacy claim be made. → unblocks Competitive.
- **D3 — SOC2 Type I** (then Type II). External auditor; keep "SOC2-ready" language until the report is issued — **never claim certified early.** → unblocks Enterprise.

**Acceptance:** signed third-party artifacts on file (report/certificate) with scope + date. **Effort:** weeks–months, in parallel. **Owner:** Security/Compliance lead + budget.

---

## 6. Track E — Security & enterprise docs package (Phase 14)  ✅ in-repo

**Have:** `SECURITY.md`, `security.txt`, responsible-disclosure, pentest-scope, SOC2-gap.
**Create:** `docs/security/{security-architecture, threat-model, data-flow-diagram, vendor-risk-register, incident-response-plan, backup-restore-plan, key-management-policy, logging-monitoring-policy}.md`.

**Acceptance:** all eight docs written, consistent with code, "SOC2-ready" (never "certified"). This is a prerequisite for the pentest (D1) and enterprise procurement. **Effort:** ~3–4 days. **Owner:** DevSecOps.

---

## 7. Track F — Marketplace publishing (Phases 8–9)  ⚠ store accounts

- **F1 — VS Code extension (Phase 8).** VSIX → real host → 25-point runtime checklist; drop `preview:true` at GA; `when`-clause command scoping; hide debug commands; `.vscodeignore`; README. Publish to Marketplace. Docs: `vscode-extension-marketplace-readiness.md`, `vscode-extension-real-runtime-test-report.md`.
- **F2 — Browser extension (Phase 9).** Narrow/justify `<all_urls>`, explicit CSP, README/LICENSE, tests, store listing + privacy docs + screenshots. Real Chrome+Edge 24-point run. Publish. Docs: `browser-extension-store-readiness.md`, `browser-extension-real-runtime-test-report.md`.

**Acceptance:** both live in their stores with passing runtime reports. → **Marketplace Readiness 100.** **External dep:** VS Code Marketplace + Chrome/Edge store accounts + review time.

---

## 8. Track G — GTM / customers / case studies  ⚠ market-dependent

**Why:** Market Survival + Revenue can't honestly hit 100 on docs alone — they need real usage.

- Execute the beta launch plan (`docs/market/beta-launch-plan.md`): target 50 active beta users.
- Run 3 enterprise pilots (`docs/market/enterprise-pilot-plan.md`).
- Convert real paying customers; capture **permissioned** case studies/testimonials (evidence level E3+, per claims policy).

**Acceptance:** documented active users, ≥1 paying customer, ≥1 named case study. **Effort:** ongoing (weeks–months). **Owner:** Founder/GTM.

---

## 9. Track H — Final retest + audit close (Phases 16–18)  ✅ in-repo

1. **Phase 16** — full command battery + all runtime/EVIDENCE items rechecked → `docs/final-no-gap-retest-report.md`.
2. **Phase 17** — recalc all 10 scores per scoring rules → prepend to `docs/final-real-user-enterprise-audit-report.md`.
3. **Phase 18** — print the final readiness result block (original vs new, closed/remaining, evidence list, per-surface launch decisions).

**Acceptance:** every dimension either 100 with a linked artifact, or honestly < 100 with the exact missing evidence named.

---

## 10. Sequencing (honest, parallelizable)

```
Day 0–1     Track 0 (prod hotfix: /blog, security.txt, redeploy Phase 4/5/15, server_tokens)
Weeks 1–2   Track A (ML tier)  ‖  Track E (security docs)  ‖  Track C1 (user journey)
Weeks 2–3   Track B (deployed scale run on soterai.in)  ‖  Track F (marketplace)  ‖  Track C2 (integrations)
Weeks 3–4   Track C3/C4/C5 (billing, tenant, RAG live)  ‖  kick off Track D (pentest/SOC2 — long lead)
Weeks 4–6   Track H (retest + audit close) for everything in-repo/runtime done
Months 2–4  Track D completes (pentest report, independent benchmark, SOC2 Type I)  ‖  Track G (customers)
```

**Realistic milestones**
- **In-repo + runtime done (Tracks A, B, C, E, F, H):** overall reaches **~92–94/100** — every dimension except the externally-gated ceilings.
- **After external validation (Track D) + first customers (Track G):** overall reaches **100/100** honestly.

---

## 11. The honest truth about "100/100"

- **~92–94** is reachable **without any external party** — purely by finishing the ML tier, deployed scale, live runtime proofs, docs, marketplace, and the retest. That is the realistic near-term target and it is fully in your control.
- **The last ~6–8 points require external evidence that cannot be self-issued:** a third-party pentest, an independent benchmark, a SOC2 report, and real customers. These take budget and calendar time. Any plan claiming instant 100 without them would be dishonest — and would violate `docs/marketing-claims-policy.md`.
- **Recommended order of impact:** Track A (detection) → Track E+D1 (docs + pentest) → Track B/C (scale + runtime) → Track F (marketplace) → Track D2/D3 + G (benchmark, SOC2, customers).

---

*Owner map: ML/Detection (A) · Platform/DevOps (B) · Full-stack/QA (C, H) · DevSecOps/Compliance (D, E) · Extensions (F) · Founder/GTM (G). Update `docs/no-gap-master-readiness-register.md` and `docs/MASTER-STATUS-REPORT-2026-07-10.md` as each track closes.*
