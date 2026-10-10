# Assertion and helper-regression verification map

**INFERENCE — Scope, 2026-10-10 (Asia/Calcutta).** This builder-prepared map records the relationship between existing helper regressions and the [A01–A30 acceptance criteria](../phase3/acceptance-criteria.md). It is not an independent verifier result. Every full assertion for the selected architecture remains **UNTESTED**, including where a helper regression later succeeds. The map preparation used source inspection; final builder helper command outcomes are separately recorded in the handoff/ledger. No acceptance assertion or probe was executed.

**FACT — Source URLs and date.** The linked source files below were inspected on client date 2026-10-10. The acceptance source is dated 2026-10-09, and the [threat model and G1–G6 specification](../phase0/guarantee-spec.md) is dated 2026-10-09. A source assertion describes what a test expects; it is not evidence that that assertion ran or that the deployed architecture enforces it.

| Helper reference | Source URL, inspected 2026-10-10 | FACT: existing regression scope | INFERENCE: full-boundary limitation |
|---|---|---|---|
| SG | [safe-git.test.ts](../../../../packages/vscode-extension/src/__tests__/safe-git.test.ts), [SafeGit.ts](../../../../packages/vscode-extension/src/security/SafeGit.ts) | Version gating, absolute candidate selection, a restricted helper environment/configuration, missing-Git denial and a Windows benign configuration control. | Configuration/helper checks do not establish trusted executable ownership, a separate execution identity, secret custody or F16 resistance. |
| AB | [ai-boundary.test.ts](../../../../packages/vscode-extension/src/__tests__/ai-boundary.test.ts) | Managed context gathering, defaults and additive denies, bounded reads/aliases, region redaction/stale-document denial, public portions, persisted deny handling and labelled modal relaxation. | These are extension-managed paths and stubbed editor behavior; originals, hostile same-user access and trusted consent remain outside this helper evidence. |
| WA | [windows-acl.test.ts](../../../../apps/local-ai-broker/src/__tests__/windows-acl.test.ts) | ACL metadata rejection, parent write/replacement checks, injected validation-before-synthetic-token-read and flag withdrawal. | Mock metadata and validation ordering do not prove deployed control-token/directory ownership or an independent principal. Same-user access is not excluded by the threat model. |
| HR | [hardening-runtime.test.ts](../../../../packages/vscode-extension/src/__tests__/hardening-runtime.test.ts) | Stubbed live-state precedence, policy parsing, zero route count from URL/comment text, scoped modal behavior and unknown-route status. | Status/helper correctness does not supply authenticated effective-enforcement receipts or an agent-proof user-presence channel. |
| SI | [secret-storage-inventory.test.ts](../../../../packages/vscode-extension/src/__tests__/secret-storage-inventory.test.ts) | ID-only persistence ordering, synthetic adapter cleanup/retry/error behavior, invalid lifetimes, expiry, flag withdrawal and pending-write cancellation. | Synthetic storage behavior does not prove custody, keychain access separation, backup deletion or downstream credential revocation. |
| T2 | [tier2-lite.test.ts](../../../../packages/vscode-extension/src/__tests__/tier2-lite.test.ts) | Public selection/placeholder generation, path/policy/alias/case checks, off/default denial and static container-template restrictions and gap labels. | Generated template text is not runtime containment, live attach, credential-forwarding denial, management isolation or mandatory networking evidence. |
| CB | [capability-boundary-regression.test.ts](../../../../packages/vscode-extension/src/__tests__/capability-boundary-regression.test.ts) | Injected-transport URL scope, mutation/lifetime limits, known-value echo/error suppression and pending-storage revocation. | An in-process capability helper and injected transport do not prove user presence, workload identity, mandatory egress or complete revocation timing. |
| RE | [review-evidence.test.ts](../../../../packages/vscode-extension/src/__tests__/review-evidence.test.ts), [ReviewEvidence.ts](../../../../packages/vscode-extension/src/security/ReviewEvidence.ts) | Exclusive creation refuses overwrite and preserves prior bytes; disabled recording has no shared fallback; relative output paths are rejected. | Writer mechanics do not prove immutable audit custody, complete actual-run identities or an independently controlled record. |

**INFERENCE — Reading the assertion table.** References below identify nearby helper behavior only. “None” means the named eight helper files contain no directly relevant full behavior; it does not assert a repository-wide absence. Even several helper references cannot be combined into a full acceptance PASS. Final command outcomes are recorded separately in the ledger; this map does not grade full acceptance.

| Assertion | Guarantees | Related helpers | INFERENCE: what remains necessary beyond the helper | Full selected-architecture status |
|---|---|---|---|---|
| A01 | G1 G3 G5 | AB, T2 | Independent custody and zero-byte denial of originals, aliases and reachable copies under hostile U/A, with public controls. | UNTESTED |
| A02 | G1 G4 G5 | AB | Protected editor/session isolation across buffers, display, accessibility, clipboard, memory and recovery; trusted edit/save control. | UNTESTED |
| A03 | G1 G5 | SG, T2 | Entire enrolled workload/descendant launch environment and reachable process state; controller-credential separation. | UNTESTED |
| A04 | G1 G5 G6 | AB, T2 | All enrolled legacy/history/index/cache/derived copies and accurate acknowledgement, beyond a generated public snapshot. | UNTESTED |
| A05 | G1 G3 | AB, T2 | Authoritative versioned marks through edit/rename/ambiguity across every protected route. | UNTESTED |
| A06 | G1 G2 G5 | None | Trusted exact-item edit lease, protected save/revision and exclusion of U/A buffers/store authority. | UNTESTED |
| A07 | G2 G3 | AB, HR | Independent pending-only queue with no agent-triggered privileged ceremony, relaxation or grant. | UNTESTED |
| A08 | G2 | HR | Matching fresh P-native/C signatures and physical verification over authoritative exact scope. | UNTESTED |
| A09 | G2 G5 G6 | CB | Independently enrolled workload/launch/channel identity, with replacement/other-workload denial. | UNTESTED |
| A10 | G2 G3 | CB, SI | Single-use atomic consumption, epochs, restart invalidation and elapsed-time expiry at the authoritative boundary. | UNTESTED |
| A11 | G2 G4 G5 | CB | Exact consented item/version/operation/recipient/output authority, including separate disclosure scope. | UNTESTED |
| A12 | G1 G2 G3 G4 | AB, SI, HR | Custody/mandatory controls through disable/unload/uninstall and controller failure/recovery with no startup gap. | UNTESTED |
| A13 | G2 G3 G6 | AB, HR, SI | Authenticated durable policy/checkpoint/witness integrity and rollback resistance, with RECOVERY_LOCKED behavior. | UNTESTED |
| A14 | G2 G3 G5 | WA, SG | Actual independent store/controller/management identity and token/directory/binary/parent/service/network ownership evidence. | UNTESTED |
| A15 | G1 G3 G4 G6 | AB, WA, HR, SI, T2 | Flag/route/prerequisite withdrawal must preserve acknowledged custody and mandatory denial outside agent-controlled state. | UNTESTED |
| A16 | G4 | T2, CB | Mandatory OS/container enforcement for all transports, interfaces, descendants, local services and delegated routes. | UNTESTED |
| A17 | G2 G4 | CB | Explicit protected export consent at the boundary despite allowlisted endpoints; no unrestricted relay. | UNTESTED |
| A18 | G1 G4 G5 | T2, CB | Lifetime-offline private workload and protected display/clipboard/control-plane/results, with separate covert-channel evidence. | UNTESTED |
| A19 | G2 G3 G4 G5 | CB, SI | Observed serialized tD and cancellation/drain/enforcement tA, active/queued/E authority and one-second target. | UNTESTED |
| A20 | G1 G4 G5 | SG, CB | Approved trusted-service credential use without U/A environment/memory/file/helper exposure. | UNTESTED |
| A21 | G3 G5 G6 | SI, CB | Durable protected inventory plus separate actual deletion/backup/downstream-revocation observations. | UNTESTED |
| A22 | G1 G4 G5 | AB, SI, CB | Every deployed public result/error/log/audit/recovery path and private-output custody. | UNTESTED |
| A23 | G1 G2 G5 | SG, AB | Independent constrained helper identity, pinned trusted execution/configuration and no S/M authority; F16 remains static-only. | UNTESTED |
| A24 | G6 | HR | Fresh authenticated receipts from actual effective controls, scoped to the exact G/topology/enrollment state. | UNTESTED |
| A25 | G2 G6 | HR | Authoritative independent P/C despite hostile U mirror changes; no universal display-honesty claim. | UNTESTED |
| A26 | G6 | RE | Immutable uniquely identified actual records, pinned identities/hashes/boundaries and positive controls without status promotion. | UNTESTED |
| A27 | G1 G2 G3 G4 G5 G6 | None | Independent real-agent evidence for the exact OS/editor/agent/topology/artifact cell. | UNTESTED |
| A28 | G1 G6 | AB, T2 | Honest unclassified-prose exposure and conservative public classification, without universal semantic detection. | UNTESTED |
| A29 | G1 G2 G3 G4 G5 | CB, T2 | Explicit enrolled delegate/channel/topology/network authority and no inherited grants or management access. | UNTESTED |
| A30 | G1 G2 G3 G4 G5 G6 | WA, HR, T2 | Actual supported OS/session/device/worker/management prerequisites and later independent resistance evidence. | UNTESTED |

**INFERENCE — Execution separation.** The Phase 4 wrapper defaults to both package typecheck/build/full existing unit suites and compilation of both existing harnesses, with no host run. Its user-only host option, `verify-all.ps1 -RunHost -CodePath <isolated-editor-path>`, does not turn a builder session into an independent verifier or promote historical/mocked observations to A01–A30 PASS. The [fresh-session kit](independent-verifier-kit/README.md) carries expected results and reporting rules only; this helper map and all builder findings remain outside its allowed inputs.
