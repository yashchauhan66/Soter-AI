# SoterAI Founder Scorecard

**Date:** 2026-07-24  
**Methodology:** Evidence-weighted scoring with 0-100 scale per dimension

---

## Overall Scores

| Dimension | Score | Confidence | Key Evidence | Key Missing | Verdict |
|-----------|:-----:|:----------:|--------------|-------------|---------|
| Product maturity | 65/100 | High | 679 tests, 91 models, 100+ routes, 20+ detectors, 7 platforms | Single end-to-end tested workflow | Feature-complete pre-1.0 |
| Security strength | 72/100 | High | CSP, CSRF, bcrypt-12, secret redaction, rate limiting, zombie session prevention | No SAST/DAST in CI, no pen test | Strong foundations |
| Enforcement reliability | 55/100 | Medium | Decision engine + policy resolution works | No production enforcement data | Untested at scale |
| Privacy | 78/100 | High | Secrets never returned in findings, redaction mandatory, retention policies | No independent DPDP audit | Unique strength for India |
| Detector quality | 68/100 | Medium | 84% recall @ 1% FPR (self-measured on 1,218-case benchmark) | No independent audit | Strong for self-reported |
| False-positive handling | 45/100 | Medium | DetectionFeedback model in DB | No feedback loop in use | Bare minimum |
| Production readiness | 40/100 | Medium | Docker, workers, health checks, .next build exists | No autoscaling, no backup, no monitoring | MVP-level |
| Browser readiness | 35/100 | High | Chrome extension code works | NOT ON WEB STORE (critical blocker) | Cannot deliver |
| IDE readiness | 30/100 | High | VS Code ext with 17 modules | NOT ON MARKETPLACE (critical blocker) | Cannot deliver |
| SDK readiness | 50/100 | Medium | JS SDK published-ready, n8n published | Python incomplete, no Go/Java | JS only |
| Integration readiness | 40/100 | Medium | n8n published, webhooks work | No SIEM tested, Zapier partial | Early stage |
| Enterprise readiness | 20/100 | Medium | SSO/SAML code exists | No IdP test, no SOC2, no SCIM test, no SLA | Early stage |
| Compliance readiness | 25/100 | Medium | Evidence vault, OWASP mapping | No audit report, no certification | Foundation only |
| Operations | 45/100 | Medium | Workers, health checks, Docker | No monitoring, no alerting, logs in repo | Needs cleanup |
| Performance | 50/100 | Medium | Benchmarks exist | No production p95/p99 | Benchmarks are internal |
| Reliability | 40/100 | Medium | Graceful shutdown, health endpoints | No uptime SLA, no redundancy | Basic |
| Scalability | 30/100 | Low | Redis caching, worker pools | No published load tests, no autoscaling | Untested |
| Maintainability | 75/100 | High | Clean monorepo structure, typed, tested | 15+ stray log/artifact files | Solid engineering |
| UX | 40/100 | Medium | Dashboard components built | Inconsistent, clearly pre-1.0 | Functional basic |
| Onboarding | 20/100 | High | API key flow works | Self-hosting requires Docker+DB+Redis expertise, no quickstart | Critical weakness |
| Documentation | 65/100 | High | 208 docs files, API docs, README, ARCHITECTURE.md | Claims don't match reality in places, outdated | Impressive volume |
| Marketplace readiness | 10/100 | High | Code ready for Chrome and VS Code | Nothing published | Non-existent |
| Pricing readiness | 30/100 | Medium | Pricing in code, Razorpay integrated | No pricing page, no working checkout flow | Hidden |
| Support readiness | 10/100 | High | Contact form exists | No support system, no SLA | None |
| Sales readiness | 15/100 | Medium | Pilot form exists | No sales materials, no pricing page, no demo | Pre-sales |
| Investor readiness | 40/100 | Medium | Working product, clean code, large TAM | No revenue, no customers, no clear ICP | Technical asset |
| Defensibility | 30/100 | Medium | India PII, open-core BSL, local-first | No network effects, no proprietary data, no community | Wedge only |

---

## Weighted Market-Gap Completion

### Methodology

For each requirement:
- Market importance (1-5)
- Buyer urgency (1-5)  
- Revenue relevance (1-5)
- Implementation completeness (0-100%)
- Evidence confidence (0-100%)
- Production proof (0-100%)

```
Requirement Weight = Market Importance × Buyer Urgency × Revenue Relevance
Evidence-Adjusted Completion = Implementation Completeness × Evidence Confidence × Production Proof
Overall = Σ(Weight × Adj_Completion) / Σ(Weight)
```

### Results by Segment

| Segment | Completion Score | Confidence | Key Gap |
|---------|:---------------:|:----------:|---------|
| Developer product | 45% | Medium | Onboarding friction, marketplace distribution |
| SMB | 28% | Medium | Self-hosting complexity, no SaaS tier |
| Mid-market | 22% | Low | SSO untested, no SOC2, no Python SDK |
| Enterprise | 15% | Low | SOC2, SSO, SCIM, references, SLA all missing |
| Regulated enterprise | 8% | Low | Certifications, data residency, deployment options |
| **Technical capability** | **62%** | High | Feature breadth is real but shallow in places |
| **Commercial readiness** | **18%** | Medium | No pricing page, no checkout, no sales process |
| **Runtime proof** | **25%** | Low | No production customer running the product |

### Overall Market-Gap Completion: **32/100**

Breakdown:
- 62% technical capability (weight: 0.3) = 18.6
- 18% commercial readiness (weight: 0.4) = 7.2
- 25% runtime proof (weight: 0.3) = 7.5
- **Total: 33.3% → 32/100**

---

## Comparison to Benchmarks

| Dimension | SoterAI | Lakera | Prompt Security | Cyberhaven | Notes |
|-----------|:-------:|:------:|:---------------:|:----------:|-------|
| Feature breadth | 75/100 | 70/100 | 55/100 | 60/100 | SoterAI covers more categories |
| Detection accuracy | 68/100 | 85/100 | 70/100 | 60/100 | Lakera claims 0.01% FPR |
| Enterprise readiness | 20/100 | 80/100 | 70/100 | 80/100 | Certifications + references |
| Distribution | 10/100 | 80/100 | 85/100 | 75/100 | No marketplaces, no brand |
| Open-core flexibility | 90/100 | 40/100 | 30/100 | 10/100 | BSL vs proprietary |
| India-specific | 85/100 | 20/100 | 10/100 | 20/100 | Clear leader |
| Browser security | 35/100 | 30/100 | 90/100 | 80/100 | Prompt Security dominates |
| IDE security | 60/100 | 10/100 | 20/100 | 20/100 | SoterAI leads |
| Agent security | 65/100 | 50/100 | 20/100 | 20/100 | SoterAI leads |
| Pricing (value) | 85/100 | 50/100 | 60/100 | 20/100 | Open-source wins on cost |

---

## Key Metrics Summary

| Metric | Current | 3-Month Target | 12-Month Target |
|--------|:-------:|:--------------:|:----------------:|
| Paying customers | 0 | 3 | 12 |
| MRR | $0 | $1,500 | $24,000 |
| ARR run-rate | $0 | $18,000 | $288,000 |
| Chrome extension users | 0 | 100 | 5,000 |
| VS Code extension installs | 0 | 500 | 10,000 |
| GitHub stars | ?? | 500 | 2,000 |
| Tests passing | 679 | 679+ | 700+ |
| Team size | 1 (founder) | 1-2 | 3-5 |
| SOC2 | No | No | Type I in progress |
| Customer references | 0 | 2 case studies | 5 case studies |

---

## Verdict Summary

**SoterAI is the most feature-complete open-source AI security project and has a genuine wedge in India-specific PII protection. It is currently a 28/100 startup — strong technical foundations with near-zero commercial execution. The gap between working code and sellable product is ~6-12 months, focused entirely on distribution, onboarding, and trust signals, not on new features.**

| Question | Answer |
|----------|--------|
| "What has actually been built?" | A full AI security control plane with API guard, browser extension, VS Code extension, agent security framework, policy engine, and billing |
| "Is it one coherent product?" | No — it's 24 partially-connected products trying to be one platform |
| "Is it sellable now?" | To 5 technically sophisticated design partners only |
| "How much revenue can it realistically generate?" | $4,800 - $216,000 ARR in 12 months depending entirely on GTM execution |
| "Should a founder invest time in this?" | Yes, IF the founder focuses on selling, not building |