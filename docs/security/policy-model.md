# SoterAI IDE Guard Policy Model

Date: 2026-07-22

## Decision vocabulary

The shared runtime policy layer now uses the required release-gate action vocabulary:

| Action | Meaning |
|---|---|
| `ALLOW` | The action may proceed in the named supported path. |
| `ALLOW_ONCE` | The action may proceed once and must not be replayed. |
| `ALLOW_WITH_TRANSFORMATION` | The action may proceed only after redaction, tokenization, or local summarization. |
| `ALLOW_IN_SANDBOX` | The action may proceed only in a sandboxed route. |
| `ASK` | User/admin review is required before execution. |
| `DENY` | The action must not execute. |
| `QUARANTINE` | The source or artifact should be isolated from downstream use. |

## Coverage vocabulary

`RuntimePolicyEngine` uses the requested coverage labels for runtime decisions:

`FULL_ENFORCEMENT`, `STRONG_ENFORCEMENT`, `PARTIAL_VISIBILITY`, `DETECTION_ONLY`, `UNSUPPORTED`, `UNKNOWN_NOT_TESTED`.

The older route matrix uses `ENFORCED`, `REDACTED`, `MONITORED`, and `UNKNOWN`; docs should map those to the above release vocabulary when making product claims.

## Safe defaults implemented in this slice

The new runtime policy engine deterministically:

- Denies raw credential exposure.
- Denies secret egress to external, private, or metadata destinations.
- Denies unknown network egress in strict mode.
- Denies external egress in air-gapped mode.
- Asks or denies suspicious terminal parser failures instead of silently allowing them.
- Denies destructive or remote-execution terminal effects.
- Asks or denies high-risk prompt-injection-tainted actions.
- Asks or denies unsupported high-risk paths instead of showing a generic protected state.
- Marks observe mode as `observe_only` and nonblocking.

## Current wiring

`RuntimePolicyEngine` is exported from `@soterai/guard-core` and is wired into the VS Code manual terminal review command. The controlled terminal broker route, file operation policy, network egress policy, MCP gateway policy, taint engine, transaction preview, and governance policy all use the shared decision vocabulary or explicit `ALLOW`/`ASK`/`DENY` policy semantics.

## Phase-control policy modules

| Module | Phase coverage | Claim boundary |
|---|---|---|
| `RuntimeDiscovery` | Phase 2 | Capability summary and effective-risk scoring; no enforcement by itself |
| `SafeContextBuilder` | Phase 3 | Strong context firewall for SoterAI-built prompts/context |
| `FileOperationFirewall` | Phase 4 | Strong pre-execution policy for routed file operations |
| `ControlledTerminal` | Phase 5 | Strong fixed-argv enforcement for broker-routed allowlisted commands |
| Broker capability code | Phase 6 | Strong credential handling for brokered capabilities |
| `NetworkEgressPolicy` | Phase 7 | Strong preflight decisions for routed outbound requests |
| `MCPGateway` | Phase 8 | Strong pre-invocation decisions for gateway-routed MCP tools |
| `TaintEngine` | Phase 9 | Strong escalation when callers supply source provenance |
| `CheckpointRollback` | Phase 10 | Transaction preview and checkpoint metadata; rollback execution remains route-specific |
| `GovernancePolicy` | Phase 11 | Strong validation for managed enterprise policy changes |
| Attack corpus/docs/evidence | Phase 12 | Internal readiness; external validation remains required |
