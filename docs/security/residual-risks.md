# Residual Risks

Date: 2026-07-23

The following risks remain after Phases 0–12 (including integration usability, MCP preflight wiring, terminal bypass tests, dependency intelligence docs, Control Panel primary workflows, and release evidence refresh).

| Risk | Coverage | Current mitigation | Required closure |
|---|---|---|---|
| Other extensions read plaintext files | `DETECTION_ONLY` / `VISIBILITY_ONLY` | Extension risk scanning, vault migration guidance, safe context builder, Protected Workspace on SoterAI-built context only | Enterprise extension allowlisting, OS/container isolation |
| Raw terminal execution | `DETECTION_ONLY` / `UNSUPPORTED` for intercept | Manual command review, controlled broker fixed-argv route, one-time raw-terminal warning, bypass-pattern tests (pipe/nested/encoded/env) | Make controlled terminal the only supported AI execution route; OS policy |
| Child process trees | `UNSUPPORTED` / engine `UNKNOWN_NOT_TESTED` | Process sandbox preflight (engine only, not wired) | OS-enforced process sandbox runner |
| Arbitrary network egress | `UNSUPPORTED` | `NetworkEgressPolicy` for routed requests only (engine not fully wired) | Local proxy or OS firewall enforcement |
| MCP outside preflight path | `DETECTION_ONLY` | Config scan + optional broker `POST /v1/preflight/mcp-tool` + `soterai.preflightMCPTool` | Require MCP host integration or launch through broker before execute |
| Ambient cloud credentials | `DETECTION_ONLY` | Terminal/network/file policies can flag obvious usage; secret broker for scoped capability calls | Cloud-specific credential capability brokers |
| Dependency / supply chain | `DETECTION_ONLY` | Heuristics + optional OSV (no install block) | Full SCA + policy-gated installs if product scope expands |
| External validation | `UNKNOWN_NOT_TESTED` | Internal tests and synthetic corpora; security evidence gates under `reports/` | Third-party penetration test and public reproducible harness |
| Streaming partial flush | `STRONG_ENFORCEMENT` with known residual | SSE scan-before-forward on brokered streams | Accept residual: tokens already flushed cannot be recalled |

## Honesty rules for claims

- No release note, UI, badge, or sales material should claim universal zero-trust protection until these risks are either closed or explicitly scoped out.
- `soterai.showAllCommands` defaults to **false** (palette hygiene). Control Panel exposes five primary workflows without requiring the advanced palette.
- There is **no fail-open security setting** that disables enforcement while still claiming ENFORCED badges.
- STRONG paths require traffic through the Local AI Broker (or other named enforcement points in `CAPABILITY_REGISTRY`).

## Related artifacts

- `docs/security/capability-matrix.md`
- `docs/security/dependency-intelligence.md`
- `docs/security/broker-streaming.md`
- `reports/security-100-evidence-gates.md`
- `reports/release-provenance-attestation.md`
