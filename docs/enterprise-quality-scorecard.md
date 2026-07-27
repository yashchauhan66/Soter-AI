# Enterprise Quality Scorecard

This scorecard is the release gate for enterprise-facing claims, marketplace listings, and customer pilot handoffs.

## Release Rule

SoterAI releases are evidence-gated. A feature can be listed as enterprise-ready only when implementation, automated tests, security review, and operating documentation are all present in the repository.

Do not claim Enterprise GA for any module that lacks production deployment evidence, customer-facing documentation, rollback guidance, and an owner-approved security review.

## Required Gates

- Automated tests: unit, integration, privacy, and abuse-case coverage must pass for the affected package.
- Security proof: data minimization, secret redaction, tenant isolation, and audit logging must be validated.
- External pentest: public enterprise GA requires an External pentest report or a documented vendor engagement with tracked remediation.
- Marketplace proof: listing copy, privacy summary, support process, screenshots, and demo flow must be present before submission.
- Operational readiness: support runbook, incident response path, and status/health checks must be documented.

## Claim Levels

- Prototype: works locally with documented limitations.
- Pilot-ready: tested with controlled users, fail-closed behavior, and rollback instructions.
- Enterprise GA: evidence-gated release with external security review, support coverage, and production monitoring.

