# Enterprise Pilot Package

## Commercial Purpose

Convert a qualified enterprise security requirement into a paid, time-boxed evaluation with measurable technical and operational outcomes.

## Recommended Structure

- Duration: 4-6 weeks.
- Scope: one owned AI application and one agreed environment.
- Customer team: executive sponsor, technical owner, security owner, and business owner.
- CyberRakshak team: pilot lead, integration engineer, and security reviewer.
- Commercial model: paid pilot credited partially or fully toward an annual agreement only if approved in the proposal.

## Entry Criteria

- Named production candidate.
- Approved data-flow and testing scope.
- Integration access and customer technical owner.
- Security requirements and decision process documented.
- Budget range and target decision date confirmed.
- Success criteria signed before work begins.

## Workstreams

### 1. Architecture and Threat Review

- Map user, application, model, retrieval, tool, and output boundaries.
- Identify sensitive-data classes and tenant boundaries.
- Map relevant OWASP LLM Top 10 risk areas.

### 2. Guard Integration

- Integrate input and output guard paths.
- Configure policy, fallback behavior, alerts, and evidence.
- Measure p50/p95 latency and error behavior.

### 3. RAG and Enterprise Controls

Include only when required:

- Document scanning and quarantine.
- Retrieval ACL and grounding review.
- SAML SSO, SCIM, SIEM, retention, KMS, or self-hosted configuration.

### 4. Authorized Defensive Validation

- Run approved scenarios only against the owned pilot project.
- Record expected versus observed action.
- Review false positives and false negatives using redacted examples.

### 5. Production Recommendation

- Summarize findings, remaining risk, operating model, and rollout plan.
- State limitations and dependencies clearly.

## Deliverables

- Architecture and data-flow summary.
- Guard integration configuration.
- Security assessment report.
- Authorized red-team report.
- OWASP LLM Top 10 alignment report.
- Detection-quality summary.
- SIEM/SSO/SCIM/self-hosted setup notes where scoped.
- Final production recommendation and commercial proposal.

## Success Criteria Template

| Area | Target | Evidence |
| --- | --- | --- |
| Coverage | Agreed input/output paths guarded | Architecture and request evidence |
| Detection | Expected action on agreed critical scenarios | Evaluation report |
| Accuracy | No unresolved critical false negatives; agreed FP tolerance | Feedback review |
| Latency | p95 within agreed application budget | Monitoring export |
| Reliability | Error and fallback behavior accepted | Test report |
| Operations | Alerts, support, and incident ownership accepted | Runbook review |
| Governance | Required audit/retention/identity controls reviewed | Control checklist |

## Out of Scope by Default

- Certification or guarantee of complete protection.
- Offensive exploitation.
- Testing systems not owned or explicitly authorized by the customer.
- Broad production rollout before pilot acceptance.
- Custom feature development unrelated to agreed pilot blockers.

## Decision Meeting

The final meeting must end with one outcome:

- Proceed to annual production agreement.
- Proceed with a defined remediation plan and decision date.
- Stop because success criteria or commercial fit were not met.

Document the decision, owner, blockers, and date. Avoid indefinite unpaid pilots.
