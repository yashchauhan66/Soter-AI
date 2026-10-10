# Threat model and guarantee specification — Phase 0

Date: 2026-10-09, Asia/Calcutta. Status: required target, **not implemented or certified**. This specification retains the user's T and G1–G6. The current extension fails the gates described in [phase0-review.md](phase0-review.md).

## Threat model T

The AI agent, assistant, extension or MCP server is an untrusted process with the same user-level OS privileges as the user, full tool access to files, terminal, Git, network and other extensions, and exposure to prompt injection. It can execute native code, call editor commands, create children, change user-writable state, encode or divide data, and ignore cooperative integrations. The attacker's authority, rather than whether a model chooses to exercise it, determines the boundary.

The user's exclusions are kernel/root compromise, physical access and the user pasting a secret themselves. We do not add exclusions for malicious extensions, controller-token theft, clipboard/screenshot access, policy edits, extension unload, remote tool paths or sandbox escape within user-level authority. An independent authority introduced by a future architecture must resist this attacker; assuming that authority is inaccessible is insufficient evidence.

Protected assets include user-marked files, folders, globs/regex, environment keys and text selections; plaintext copies in Git objects/history, buffers, caches/backups, environment and process output; secret mappings and decryption keys; grants, policy and audit state. Encryption transforms the asset, rather than removing its need for protection.

## Guarantees, unchanged

| Gate | User's requirement | Required acceptance evidence |
|---|---|---|
| G1 | **Default deny.** Anything the user marks protected (files, folders, globs/regex, env keys, text selections) is unreadable by any agent-controlled path: file APIs, terminal, git objects/history, env vars, symlinks/hardlinks/junctions, encodings, chunking, MCP/tools, clipboard, network. | With protection acknowledged and no applicable grant, every tested agent-controlled read or capture yields zero protected bytes. Test originals and aliases, copies/history and buffers, child processes, identity spoofing, races, all tool paths and transformed/reassembled values. Include public-data positive controls. |
| G2 | **Allow only by user.** Access requires an explicit, authenticated, user-presence consent (OS-level prompt the agent cannot synthesize or auto-click). Grants are scoped (item, duration, which agent/process), revocable, and logged. The agent cannot create, approve, widen or edit grants or policy. | Independently verify user presence and exact grant scope, expiry, requester identity, revocation and audit. Attempts through editor commands, automation, stolen bearer credentials, replay, concurrent use, process replacement and writable policy must fail. A dialog or bearer token alone is insufficient. |
| G3 | **Deny is durable.** It survives restart, extension disable/unload/uninstall, config edits and policy tampering. Fail closed. | Repeat G1/G2/G4 after each lifecycle event, controller/broker crash, lost/corrupt/deleted policy, state rollback and configuration change. No startup interval admits protected bytes. Denial must persist independently of extension lifecycle. |
| G4 | **Egress.** Protected content never leaves the machine without a grant. Agent network access is allowlisted at OS/container level; content filters are defense in depth only, never the boundary. | Enforce the allowlist outside agent authority for the entire process tree. Test IPv4/IPv6, DNS, TCP/UDP, HTTP, WebSocket, QUIC, redirects, alternate interfaces, proxies, tunneling and helper/MCP routes. Independently captured unapproved transmissions contain zero protected bytes. |
| G5 | **Secrets are not at rest in agent-reachable form** (keychain/vault/placeholder injection, not plaintext in workspace/env). | Test both ordinary reads and recovery through reachable keys, credential APIs, controller interfaces, backups, Git objects, memory/crash artifacts, persisted references and IPC. Verify that operational injection occurs only under an applicable grant and does not expose the value to an unauthorized agent. |
| G6 | **Honest coverage.** The UI and docs always show what is and is not protected. | Runtime status uses authenticated evidence of effective controls. False/stale/missing policy, stopped/restarted services, unsupported agents and unavailable OS enforcement cannot produce a broader success claim. Installation/configuration evidence, managed-path tests and mandatory enforcement have separate labels. |

## Enrollment and policy semantics to resolve in architecture

Acknowledging a protection mark must mean the required boundary is active. Until enrollment is complete, the UI must identify failure or pending enforcement. Enrollment must address existing handles, open documents, Git objects, backups and derived copies instead of protecting only a current pathname. Text-region edits, rename/move operations, multi-root workspaces and remote files need explicit identity and version semantics; ambiguity must deny, not discard an earlier mark.

Repository policy may contribute additional denies. Removing or replacing repository state must not remove an already authenticated deny. Durable policy needs a revision and integrity/rollback protection outside agent write authority. The agent cannot reduce protection by deleting a file, replacing a setting, invoking a command or manipulating a trusted helper.

Required grant dimensions are item/region/key identity, purpose/operation, bounded duration and authenticated agent/process identity. A future protocol should also bind the policy revision, request digest, destination/origin/port, method/path, nonce, maximum uses and decision. PID strings and caller-supplied workspace/session identifiers are not independent process authentication. Operational use and disclosure to an AI model require distinct, explicit scopes. Scope choices do not replace G2 user presence.

Revocation must deny subsequent reads/uses and prevent queued or concurrent unauthorized requests at the defined boundary. Previously disclosed bytes cannot be recalled; this physical limitation is not permission to omit a revocation test or permit new access. Authority must be consumed atomically and checked after asynchronous work. Architecture must state its handling of already running operations.

Protected environment keys must be removed before agent or child launch, rather than merely filtered in stdout. Secret injection into a trusted service must not become ambient authority in an agent process. Persisted values need expiry and recovery/cleanup semantics after crash and reload; a reference that no longer resolves does not establish deletion of its underlying value.

An allowlisted endpoint is not a grant to disclose protected content to that endpoint. G1/G2 must prevent the agent from obtaining protected bytes without approval; arbitrary encodings and covert channels cannot be universally resolved by a content scanner once the agent possesses those bytes. For this project's experiments all recipients remain on loopback. Loopback capture is a bypass/mediation test, not proof of off-machine egress or OS allowlisting.

## S5-unmarked and the target's scope

S5-unmarked is an open, reported privacy failure: arbitrary private text without a mark or known format survives automatic filtering. G1 explicitly concerns user-marked data, so S5-unmarked alone is not evidence that a marked-data test failed. It remains required remediation work under the user's known-issues list and G6. Do not relabel it PASS, remove it from evidence, or claim universal automatic recognition. A successful manual-mark control must be reported separately. Architecture must offer a conservative sharing policy or user classification workflow whose protection does not depend on inferring arbitrary private meaning.

## Evidence and decision rules

Every execution record needs an immutable run identifier, exact source/bundle/package hashes, host/OS/agent versions and identities, policy revision, grant state, synthetic fixture identity/hash, attempted operation, observation location, result and limitations. Record failed runs and timeouts. Evidence artifacts under the user's workspace are review records, not an independently anchored tamper-resistant audit.

Allowed execution outcomes are `BLOCKED_SCOPED`, `BLOCKED_BOUNDARY`, `LEAK_CONFIRMED`, `NOT_TESTED`, `SKIP`, `ERROR` and `UNSUPPORTED`. Only independently demonstrated mandatory boundary denial can justify `BLOCKED_BOUNDARY`. A missing observation, blanket denial without public controls, mock-only success, installed extension, ignored command, absent fixture or unavailable permission is not a pass.

Source findings have separate provenance: `SOURCE_CONFIRMED`, `HISTORICAL_REPORTED`, or `HYPOTHESIS_NOT_REPRODUCED`. Phase 0 makes no current attack-outcome claim. Tests whose assertions expect leaks can pass while the confidentiality gate fails; a release gate must consume findings and capture records as well as runner exit codes.

The nominal requested matrix is Windows/Linux/macOS × VS Code 1.85.0/1.104.0/1.141.0 × Claude Code/Cursor/Continue/Codex/Roo/Cline/Copilot: 63 entries in [requested-matrix.csv](evidence/baseline-final/requested-matrix.csv). These are requested cells, not certified support. Cursor needs its own fork/version mapping; CLI versus extension identities, agent versions, OS builds, remote-host topology and model settings must be pinned. An unavailable combination remains explicit and cannot silently be counted as a tested pass or removed from the target.

## Phase and release gates

The user requires a summary and a pause after each phase: 0 analysis; 1 current-build synthetic baseline; 2 verified current primary-source research; 3 architecture/ADRs/rollback plan; 4 small feature-flagged implementation; 5 a separate attacker session without builder notes for each supported OS/agent combination; 6 release gates and final report. The Phase 0 independent review is not the required Phase 5 attacker session.

No normal VS Code profile, firewall, driver or system setting may be changed without asking first. Do not publish. Use only fake canaries, fresh synthetic history, isolated profiles and loopback receivers. No real accounts or credential contents are needed. Prepare concrete reviewable artifacts before any deployment approval request.

Release for this guarantee requires every G1–G6 test on every supported cell to pass, with exactly identified failures and untested combinations otherwise. Use the user's final claim format only when supported by actual results: “Under threat model T, N attack classes tried on matrix M, 0 succeeded; untested: [...]; residual risk: [...]”. If any attack succeeds, report the actual number; do not issue the zero-success wording. Phase 0 does not warrant a zero-success claim.
