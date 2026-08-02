# SoterAI — SOC2 Control Evidence Report (auto-generated)

Generated: 2026-08-02T03:14:47.513Z
Registry: v0.2.1 · honest=true
Evidence hash: 300a5803208f0ecc85ca9313a6cbe2eebf35ceab7c440dc5349f199a36b0db0c

## Control inventory (22 controls)

| Capability | Level | TSC criterion | Pre-exec block | Test evidence | Known bypasses (disclosed) |
|---|---|---|---|---|---|
| secret-broker | STRONG_ENFORCEMENT | CC6.1 | yes | enforced-capability.test.ts, broker.test.ts | 2 |
| safe-context | STRONG_ENFORCEMENT | C1.1 | yes | safecontext.test.ts | 1 |
| secret-redaction | STRONG_ENFORCEMENT | CC-series | yes | redaction.test.ts, ledger.test.ts, outputleak.test.ts | 1 |
| clipboard-safe-paste | STRONG_ENFORCEMENT | CC-series | yes | clipboard behavioral tests | 1 |
| broker-streaming | STRONG_ENFORCEMENT | CC6.1 | yes | broker.test.ts (Phase 6 streaming proxy) | 3 |
| dependency-guard | DETECTION_ONLY | CC-series | no | dep-guard.test.ts | 3 |
| controlled-terminal | STRONG_ENFORCEMENT | CC-series | yes | controlled-terminal.test.ts | 1 |
| terminal-manual-review | DETECTION_ONLY | CC-series | no | runtime-policy.test.ts | 1 |
| live-scan | VISIBILITY_ONLY | CC-series | no | live-scan-parity.test.ts | 3 |
| mcp-config-scan | DETECTION_ONLY | CC-series | no | mcp.test.ts | 1 |
| extension-risk-scan | DETECTION_ONLY | CC-series | no | extensionrisk.test.ts | 1 |
| mcp-gateway | STRONG_ENFORCEMENT | CC-series | yes | tests/mcp-gateway.test.ts, tests/mcp-runtime-smoke.test.ts, tests/mcp-http-security.test.ts | 2 |
| taint-engine | STRONG_ENFORCEMENT | CC-series | yes | tests/mcp-gateway.test.ts, tests/mcp-runtime-smoke.test.ts | 1 |
| file-operation-firewall | DETECTION_ONLY | CC-series | no | phase-controls.test.ts, apps/local-ai-broker broker tests | 1 |
| network-egress-policy | DETECTION_ONLY | CC-series | no | phase-controls.test.ts, apps/local-ai-broker broker tests | 1 |
| process-sandbox-policy | DETECTION_ONLY | CC-series | no | phase-controls.test.ts, apps/local-ai-broker broker tests | 1 |
| governance-policy | DETECTION_ONLY | CC-series | no | phase-controls.test.ts, apps/local-ai-broker broker tests | 1 |
| checkpoint-rollback | PARTIAL_ENFORCEMENT | CC-series | yes | apps/local-ai-broker/src/__tests__/checkpoint-rollback.test.ts (16 runtime tests) | 3 |
| hosted-ai-gateway | STRONG_ENFORCEMENT | CC-series | yes | tests/gateway.test.ts (24 tests: block-input, redact in/out, mid-stream block, key hygiene, tenant binding) | 3 |
| model-supply-chain-scan | STRONG_ENFORCEMENT | CC-series | yes | tests/model-scan.test.ts (trusted/unknown/revoked/bad-signature/hash/source/Hub/loader tests), tests/ai-bom-cyclonedx.test.ts | 2 |
| network-egress-firewall-processes | UNSUPPORTED | CC-series | no | — | 1 |
| child-process-control | UNSUPPORTED | CC-series | no | — | 1 |

## Counts

- STRONG_ENFORCEMENT: 10
- DETECTION_ONLY: 8
- VISIBILITY_ONLY: 1
- PARTIAL_ENFORCEMENT: 1
- UNSUPPORTED: 2

*This report is machine-generated from the honest capability registry. UNSUPPORTED and DETECTION_ONLY items are disclosed, not hidden — this is itself a SOC2 control-strength differentiator.*
