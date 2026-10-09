# PHASE3_KICKOFF

**INFERENCE — Handoff status, 2026-10-09.** Phase 2 is complete as a defensive documentary survey with unresolved assurance gaps. Phase 3 has not started. This document is a proposed architecture-review charter for a later user instruction; it does not authorize implementation, deployment, probes or environment changes.

## Inputs

**INFERENCE — Review set.** Use [research.md](research.md), [mechanism-matrix.md](mechanism-matrix.md), [candidate-architectures.md](candidate-architectures.md) and [open-questions.md](open-questions.md), together with the supplied Phase 0 specification/issue ledger and Phase 1 summary/handoff. Preserve source dates and distinguish documentation, local supplied evidence, inference and speculation.

**INFERENCE — Required carry-over.** Retain the reported auth-token inherited group read and same-user full control, win32 permission-check omission, uninspected control-auth-token/directory ACLs, static-only F16/credential-storage status, and missing fresh-bundle live result. Do not convert Oct 8 native evidence into current-bundle validation.

## Proposed Phase 3 objective

**INFERENCE — Objective.** Choose a concrete authority/data-boundary architecture capable of addressing G1–G6 under unchanged T. Establish who owns assets, policy, consent, network enforcement, deployment and audit; identify unresolved feasibility gates before implementation.

**INFERENCE — Governing principle.** Native or VM isolation must cover every untrusted component or deny it protected assets independently. The design cannot assume host-side malicious extensions, same-user processes, clipboard/display, remote tooling or policy changes are harmless.

## Architecture decisions to prepare

| Decision | Proposed reviewable output |
|---|---|
| ADR-01: authority and compartment | **INFERENCE:** Compare A/B and conditional C; identify controller, vault, deployment and adversary identities, administrative rights and boundaries. |
| ADR-02: enrollment and representations | **INFERENCE:** Define files/folders/globs/regex/environment keys/selections, asset/version identity, approved views and handling of preexisting copies/buffers/handles. Specify when protection may be acknowledged. |
| ADR-03: authenticated grants | **INFERENCE:** Select a user-presence primitive and trusted approval interface; define exact transaction scope, requester authentication, freshness, duration, use count and revocation semantics. Retain unresolved anti-automation limits explicitly. |
| ADR-04: durable policy and lifecycle | **INFERENCE:** Specify protected policy ownership, revision/rollback handling, restart/outage behavior, safe enrollment failure, unsupported environments and extension-removal behavior. |
| ADR-05: network and export | **INFERENCE:** Specify mandatory OS/compartment enforcement authority, allowed destination semantics, name/transport handling, local-service boundaries and separately authorized disclosure/export. |
| ADR-06: secret operations and retention | **INFERENCE:** Define operation-only use, output release, credential/key placement, expiry/orphan cleanup, backups, memory/log retention and downstream revocation ownership. |
| ADR-07: platform/package coverage | **INFERENCE:** Define supported OS/editor/agent versions and deployment topology, required APIs/ABIs/entitlements, patched dependency baselines and incomplete/unsupported states. |
| ADR-08: audit and honest status | **INFERENCE:** Define authenticated effective-control evidence, independently owned audit, revision identity, secret-free logging and the meaning of each UI coverage label. |

## Review gates

| Gate | Required architecture explanation |
|---|---|
| G1 | **INFERENCE:** Explain how protected originals and alternate representations are inaccessible through every covered authority, including host-side components and sensitive buffers. |
| G2 | **INFERENCE:** Explain how authenticated presence and exact transaction scope reach the independent verifier without agent-issued approvals or caller-claimed process identity. |
| G3 | **INFERENCE:** Explain why acknowledged denies survive lifecycle/policy/controller failures and how recovery preserves the last valid protective state. |
| G4 | **INFERENCE:** Explain where mandatory network mediation occurs and why allowed destinations do not authorize ungranted disclosure. |
| G5 | **INFERENCE:** Explain why ciphertext, keys, credential APIs, persistence, outputs and trusted operational use do not leave ungranted secret recovery authority with the agent. |
| G6 | **INFERENCE:** Explain how status reflects effective controls rather than installation, route strings, self-reported strength or stale settings. |

**INFERENCE — Feasibility stop conditions.** Keep an architecture INCOMPLETE if protected plaintext remains reachable by an unrestricted covered identity, approval can be issued under agent authority, policy can be weakened by agent-controlled state, or required enforcement lacks a defined deployment boundary. Record the unresolved property; do not silently narrow T or grant PASS from source documentation.

## Proposed rollout and recovery design

**INFERENCE — Rollout artifact.** Prepare a staged, feature-flagged implementation proposal only after architectural decisions are reviewable. Name ownership, prerequisites, compatibility limits, pending-protection states and required user decisions without changing any system in this phase.

**INFERENCE — Rollback artifact.** Define rollback as preserving already acknowledged denies while withdrawing the new feature or version. Recovery should retain protected assets and policy under the enforcing authority; removing the UI or service must not automatically restore ungranted readability. Identify where this desired behavior is not yet feasible.

**INFERENCE — Evidence obligations.** Define the future evidence schema and acceptance criteria at a high level: pinned versions/hashes/identities, policy revision, authentic grant state, observed boundary, valid positive controls and separate errors/incomplete results. Address the missing fresh-bundle baseline as an open evidence obligation. This charter contains no reproduction recipe or executable validation procedure.

## Scope and handoff discipline

**INFERENCE — Proposed Phase 3 scope.** Architecture decisions, authority/data diagrams, coverage mapping, feasibility assessment and rollout/recovery design are the next reviewable artifacts. Any subsequent implementation or operational validation needs its own authorized phase.

**INFERENCE — Filter handling.** If a safety filter blocks later work, preserve its exact message as INCOMPLETE and continue unaffected authorized work without reformulation around the block. The prior supplied message is retained in [open-questions.md](open-questions.md).

**INFERENCE — Completion rule.** A later Phase 3 summary should identify chosen and rejected options, unresolved gates, expected limitations, and the concrete implementation proposal. Stop at that summary under the project's phase boundaries. This Phase 2 handoff makes no zero-success or G1–G6 certification claim.
