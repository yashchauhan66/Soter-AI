# Security Policy

SoterAI / Soter Guard (`soterai`) is an AI-security product, so we hold our own
security posture to the standard we ask of customers. This document is the single
source of truth for reporting a vulnerability and for what you can expect in
return.

> **Honesty note.** This policy describes our process and commitments. It does
> **not** claim any certification we do not hold. SoterAI is currently
> **SOC 2 / ISO 27001 _readiness_** (self-assessment), **not** certified, and has
> **not** yet completed an independent third-party penetration test. See
> `docs/security/soc2-iso-readiness-gap-analysis.md` and
> `docs/security/pentest-scope.md`.

## Supported Versions

| Version | Supported |
|---|---|
| `0.2.x` (current) | ✅ Security fixes |
| `< 0.2.0` | ❌ No longer maintained |

We ship security fixes on the latest `0.2.x` line. Because the product is
pre-1.0, there is no long-term-support branch yet; upgrade to the latest
`0.2.x` to receive fixes.

## Reporting a Vulnerability

**Please report privately. Do not open a public GitHub issue for a security
vulnerability.**

- **Email:** `support@soterai.in` *(placeholder — replace with the monitored
  security inbox before public launch)*
- **PGP:** A public key will be published at `/.well-known/security.txt`
  (`Encryption:` field) before public launch.
- **Subject:** `[SECURITY] <short summary>`

Please include, where possible:

1. A description of the issue and the component affected (web app, Guard API,
   SDK, browser extension, VS Code extension, n8n node, RAG, billing, webhooks,
   admin, tenant isolation).
2. Steps to reproduce (proof-of-concept, request/response, or a minimal script).
3. Impact assessment (what an attacker can achieve).
4. Any suggested remediation.

## Our Commitments (SLA)

| Stage | Target |
|---|---|
| Acknowledge receipt | within **2 business days** |
| Triage + severity assignment | within **5 business days** |
| Status update cadence | at least every **7 days** until resolved |
| Fix for Critical/High | targeted within **30 days** (faster where feasible) |
| Fix for Medium/Low | next scheduled release |

Severity is assessed using CVSS 3.1 as a guideline, adjusted for real-world
exploitability in an AI-security context (e.g., a detection-bypass that yields a
silent false-negative is treated as High even if CVSS scores it lower).

## Safe Harbor

We will not pursue or support legal action against researchers who, in good
faith:

- Make a genuine effort to avoid privacy violations, data destruction, and
  service degradation.
- Only interact with accounts they own or have explicit permission to test.
- Do **not** exfiltrate more data than necessary to demonstrate the issue, and
  delete any retrieved data after reporting.
- Give us a reasonable opportunity to remediate before public disclosure
  (**coordinated disclosure**, default 90 days).
- Do not run automated high-volume/DoS testing against production without prior
  written arrangement.

Testing that stays within this scope is considered **authorized**.

## Coordinated Disclosure Policy

- We practice **coordinated disclosure**. We will work with you on a disclosure
  timeline; the default is **90 days** from triage, or sooner if a fix ships and
  is deployed.
- We are happy to credit reporters in release notes unless you prefer to remain
  anonymous.

## Bug Bounty

There is **no paid bug-bounty program at this time.** We will acknowledge and
credit valid reports. If/when a bounty program launches, it will be announced
here and in `security.txt`.

## Scope

**In scope:** the SoterAI web application and dashboard, the Guard REST APIs
(`/api/guard/**`, `/api/agent/**`, `/api/rag/**`), the JS/TS and Python SDKs, the
WordPress plugin, the n8n community node, the browser extension, the VS Code
extension, tenant isolation, billing/webhooks, and RAG security. See
`docs/security/pentest-scope.md` for the full authorized-testing scope.

**Out of scope:** third-party services we integrate with (Razorpay, cloud
providers, email/OTP delivery), social-engineering of our staff, physical
attacks, and volumetric DoS.

## What This Policy Does NOT Claim

To stay honest (and consistent with our published audit report):

- We do **not** claim SOC 2 or ISO 27001 certification.
- We do **not** claim a completed third-party penetration test.
- We do **not** claim production-scale load validation.

Those items are tracked as **EVIDENCE REQUIRED** in
`docs/final-real-user-enterprise-audit-report.md` and
`docs/100-percent-readiness-fix-plan.md`, and will be updated here only when the
external evidence exists.


## Phase 8 Disclosure Update

Security reports should be sent to support@soterai.in (confirm mailbox before public launch). Do not access customer data, perform destructive testing, or attack third-party systems. Include reproducible steps, affected assets, impact, and redacted evidence. SoterAI has prepared a vulnerability disclosure process, but a public bug bounty should not be launched until triage ownership, SLA, safe-harbor review, and reward policy are finalized.
