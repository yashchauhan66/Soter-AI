# Enterprise Pilot Plan

**Date:** 2026-07-09
**Target:** 3 enterprise pilots in 90 days

## Ideal Pilot Customer

| Attribute | Requirements |
|---|---|
| Size | 100-5,000 employees |
| Industry | Tech, fintech, e-commerce |
| AI Usage | Active ChatGPT/Claude adoption |
| Pain Point | Security concerns blocking AI rollout |
| Decision Maker | CISO or VP Engineering |
| Timeline | 30-90 day pilot |

## Pilot Structure

### Phase 1: Discovery (Week 1)

| Activity | Owner |
|---|---|
| Initial meeting | Sales |
| Security assessment | Solutions Engineer |
| Requirements gathering | Solutions Engineer |
| Pilot proposal | Sales |

### Phase 2: Setup (Week 2-3)

| Activity | Owner |
|---|---|
| Environment setup | Customer IT |
| SSO/SCIM integration | Solutions Engineer |
| Policy configuration | Customer Security |
| Training session | Solutions Engineer |

### Phase 3: Deployment (Week 4-6)

| Activity | Owner |
|---|---|
| Browser extension rollout | Customer IT |
| VS Code extension rollout | Customer IT |
| API integration | Customer Dev |
| Monitoring setup | Solutions Engineer |

### Phase 4: Evaluation (Week 7-12)

| Activity | Owner |
|---|---|
| Weekly check-ins | Solutions Engineer |
| Usage reporting | Dashboard |
| Feedback collection | Sales |
| Security metrics | Customer Security |

## Pilot Success Criteria

Targets are measured on the customer's own traffic during the pilot and reported with their measurement boundary (per [`../marketing-claims-policy.md`](../marketing-claims-policy.md)).

| Criterion | Target | Note |
|---|---|---|
| Time to value | <1 week | First guarded traffic in production |
| Detection recall on **known** attack patterns | 100% on the pilot's tuned signature set | Matches the tuned-corpus result; novel-wording recall is ~64% today (regex ceiling — see [`../detection-honest-generalization.md`](../detection-honest-generalization.md)), improving with the ML/semantic tier |
| Benign false-positive rate | <1% | Precision generalizes well in our benchmarks |
| User satisfaction | >4/5 | Survey of pilot users |
| Confirmed risky events caught & actioned | Documented, not a fixed quota | Reported as observed incidents (evidence level E3), not a marketing number |

## Pilot Pricing

| Plan | Price | Notes |
|---|---|---|
| PRO | ₹2,999/mo | Standard pilot plan |
| ENTERPRISE | Custom | For large deployments |

## Pilot Deliverables

| Deliverable | Frequency |
|---|---|
| Usage report | Weekly |
| Security metrics | Weekly |
| Executive summary | Monthly |
| Final pilot report | End of pilot |

## Pilot Conversion

| Outcome | Action |
|---|---|
| Success | Convert to annual contract |
| Partial success | Extend pilot 30 days |
| Failure | Document learnings, exit gracefully |
