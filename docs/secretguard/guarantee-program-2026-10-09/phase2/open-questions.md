# Open questions and incomplete evidence

**INFERENCE — Status, 2026-10-09.** These questions are design and evidence gaps carried into Phase 3 consideration. They are not permission to begin implementation or dynamic investigation. Source-backed mechanism claims are in [research.md](research.md); candidate assessments are in [candidate-architectures.md](candidate-architectures.md).

## Priority questions

| ID / gate | Question or unresolved conclusion | Status / needed documentary resolution |
|---|---|---|
| Q01 / G2 G3 G5 | **INFERENCE:** Accept the supplied auth-token finding: CodexSandboxUsers has inherited read, the same OS user has full control, and auth.ts skips win32 permission checks. Which identity will own controller credentials and policy independently of adversarial processes? | **INFERENCE:** OPEN. Tightening group access and removing same-user authority are separate design obligations. |
| Q02 / G2 G3 G5 | **INFERENCE:** What are the effective control-auth-token and broker-directory rights, ownership, inheritance and policy-modification authority? | **INFERENCE:** INCOMPLETE. Those ACLs have not been inspected; this survey adds no inspection. |
| Q03 / G5 | **INFERENCE:** Which pinned VS Code/Electron storage backend, protection scope and key/input ownership apply to the installation? | **INFERENCE:** Static review only, not dynamically reproduced. R03–R05 support Windows same-user limitations, not demonstrated decryption of this installation. |
| Q04 / G6 | **INFERENCE:** Which immutable evidence distinguishes the Oct 8 native bundle from the current bundle? | **INFERENCE:** INCOMPLETE. No completed fresh-bundle live result is available; unsuccessful host launches and managed checks must remain separate. |
| Q05 / G1 G3 | **INFERENCE:** How will every untrusted host extension, process, child and MCP component be confined or denied protected assets without weakening T? | **INFERENCE:** OPEN. A single confined CLI is insufficient if other covered processes retain authority. |
| Q06 / G1 G5 | **INFERENCE:** When does a protection mark become effective for existing buffers, originals, aliases, history, caches, backups and open handles? | **INFERENCE:** OPEN. Define enrollment completion and pending/failed status; do not promise retroactive removal of prior knowledge. |
| Q07 / G1 G5 | **INFERENCE:** How will text selections, regex/glob rules and environment-key identity map to a trusted representation without exposing underlying plaintext? | **INFERENCE:** OPEN. Path confinement alone does not settle text or key granularity. |
| Q08 / G1 G2 G5 | **INFERENCE:** Which boundary owns trusted viewing, clipboard/display interaction, process memory, IPC and secret-use outputs? | **INFERENCE:** INCOMPLETE. The survey does not establish coverage for those channels or a trusted approval display. |
| Q09 / G2 | **INFERENCE:** Which user-presence mechanism prevents agent-created approvals while binding the user's decision to the exact requested transaction? | **INFERENCE:** INCOMPLETE. Hello/Keychain/hardware signing documentation supplies primitives, not the complete anti-automation guarantee. |
| Q10 / G2 | **INFERENCE:** How will the verifier bind asset/version, operation, recipient, process identity, expiry, policy revision and freshness to the decision? | **INFERENCE:** OPEN. Caller-supplied identity, PID text or bearer possession is insufficient independent identity. |
| Q11 / G2 G3 | **INFERENCE:** What do revocation and expiry mean for concurrent, queued and already completed operations? | **INFERENCE:** OPEN. Define the enforcement point and distinguish stopping future use from recalling disclosed plaintext. |
| Q12 / G3 | **INFERENCE:** Who may change authoritative denies, service configuration, deployment parameters and network policy? | **INFERENCE:** OPEN. Repository or agent-user write authority must not silently remove an acknowledged deny. |
| Q13 / G3 | **INFERENCE:** How will policy loss/corruption, rollback, restart, service outage, extension removal and unsupported enforcement preserve denial? | **INFERENCE:** OPEN. Lifecycle-independent policy, recovery and refusal states require explicit decisions. |
| Q14 / G4 | **INFERENCE:** Which protected authority mediates network destinations for the whole covered workload, including local services and remote components? | **INFERENCE:** INCOMPLETE. A proxy setting or allowed endpoint does not prove complete mediation or permission to disclose protected content. |
| Q15 / G4 | **INFERENCE:** How will IP versions, name resolution, transport families, redirects and destination changes remain within the selected allowlist semantics? | **INFERENCE:** OPEN. This is a policy-coverage question; no dynamic network evidence was added. |
| Q16 / G5 | **INFERENCE:** Can trusted operations use credentials without returning them to agent environment, logs, workspace, IPC or ordinary error output? | **INFERENCE:** OPEN. Define output-release policy and keep operational use separate from raw disclosure. |
| Q17 / G5 G3 | **INFERENCE:** Who owns expiry, orphan cleanup, deletion, backup retention and downstream credential revocation? | **INFERENCE:** OPEN. Expiring a reference does not establish destruction of stored values or downstream revocation. |
| Q18 / G1 G5 G6 | **INFERENCE:** Which executable, environment and configuration authority will apply to broker-launched Git and other helpers? | **INFERENCE:** F16 static review only, not dynamically reproduced. R26–R28 support specific hardening directions without a complete boundary claim. |
| Q19 / G1 G6 | **INFERENCE:** How will arbitrary unmarked private prose be handled without claiming universal automatic recognition? | **INFERENCE:** OPEN. S5-unmarked remains known-issue work; keep its scope separate from literal marked-data G1. |
| Q20 / G6 | **INFERENCE:** Which authenticated runtime evidence supports coverage labels for policy, routes, sandbox identity and supported tools? | **INFERENCE:** OPEN. Existence checks, substring matches and caller assertions must not be treated as effective enforcement. |
| Q21 / G6 | **INFERENCE:** Which OS builds, kernel ABIs, signed packages, editor versions, agent versions and remote topologies are actually supported? | **INFERENCE:** INCOMPLETE. The requested matrix remains a target; today's docs do not establish historical coverage. |
| Q22 / G1 G3 G4 | **INFERENCE:** Which VM/container manager, daemon socket, host share or native launcher is outside adversarial authority? | **INFERENCE:** OPEN. Rootless/WSL/ECI branding does not answer this authority question. |
| Q23 / G2 G3 G6 | **INFERENCE:** Who owns audit integrity, status authenticity and recovery revisions, and which records exclude plaintext? | **INFERENCE:** OPEN. Repository-local evidence is not independently protected audit authority. |
| Q24 / G1 G3 G6 | **INFERENCE:** Which patch baseline and component ownership address the reviewed advisory classes? | **INFERENCE:** OPEN. R31/R32 verify advisories, not vulnerability or remediation of this repository. |
| Q25 / G4 G5 | **INFERENCE:** Is a remote candidate permitted to export any protected representation, and under what explicit grant and destination scope? | **INFERENCE:** OPEN. Remote execution must not silently convert protected local content into approved export. |

## Coverage of the supplied issue ledger

**INFERENCE — Preservation rule.** The grouping below maps all supplied issue IDs to design questions. It does not close an issue, erase historical limitations or assert a new observation.

| Supplied IDs | Defensive design linkage |
|---|---|
| L01–L07 | **INFERENCE:** Originals, marked regions, filesystem aliases and repository policy map to Q05–Q07/Q12. |
| L08–L10 | **INFERENCE:** Environment/output, history and encoded disclosure concerns map to Q06/Q14–Q16. |
| K11 | **INFERENCE:** S5-unmarked maps to Q19. |
| K12 | **INFERENCE:** F16/Git execution authority maps to Q18 and remains static-only. |
| K13–K14 | **INFERENCE:** Routing reversion and overclaimed coverage map to Q13/Q20. |
| K15 | **INFERENCE:** Credential/policy authority maps to Q01–Q03/Q12. |
| U16–U20 | **INFERENCE:** Lifecycle, model-mediated behavior, shell/process and MCP authority map to Q05/Q08/Q12/Q13/Q18. |
| U21–U23 | **INFERENCE:** Unresolved network families map to Q14/Q15. |
| U24–U25 | **INFERENCE:** Screen/clipboard authority maps to Q08/Q09. |
| U26–U27 | **INFERENCE:** Remote execution and confinement assurance map to Q05/Q21/Q22/Q24/Q25. |
| M28–M31 | **INFERENCE:** Historical editor/OS/agent coverage maps to Q04/Q21. |
| N32–N34 | **INFERENCE:** Promptless control, restart state and misleading status map to Q09–Q13/Q20. |
| N35–N37 | **INFERENCE:** Orphan values, asserted sandbox strength and evidence accounting map to Q17/Q20/Q23. |

## Safety-filter ledger

**INFERENCE — Phase 2 accounting.** No new Phase 2 research request encountered a safety-filter block. The earlier Phase 1 auth-probe task remains INCOMPLETE for dynamic reproduction. Its supplied exact message follows verbatim; it is a retained record, not an instruction to retry.

> This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. If you’re doing authorized security work that requires more cyber permissive safeguards, apply for Daybreak access via https://platform.openai.com/settings/organization/status-and-access before retrying.

**INFERENCE — Handling.** The blocked auth task was not retried or reformulated. This survey used defensive primary-source research and preserved static-only status for F16 and credential storage. Any later filter rejection must be recorded verbatim as INCOMPLETE without reformulation around the restriction.

## Resolution standard

**INFERENCE — Documentary versus operational evidence.** A vendor description can support feasibility; an architecture decision can specify a boundary; neither proves deployment coverage. Keep those evidence categories separate from later authorized implementation and validation. Prior gaps remain visible until the corresponding evidence exists.
