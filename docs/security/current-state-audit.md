# SoterAI IDE Guard — Current-State Audit (Phase 0)

**Date:** 2026-07-23  
**Branch:** `feat/control-panel-and-release-evidence` @ `6d4f5a14` (+ dirty worktree preserved)  
**Product version under audit:** extension `0.2.1`, guard-core `0.1.0`

This document records **verified** facts against executable code. It is not a marketing brief.

---

## 1. Repository layout (active security surface)

| Path | Role |
|---|---|
| `packages/vscode-extension/` | Packaged VS Code extension (VSIX) |
| `packages/guard-core/` | Shared local detection + policy engines |
| `apps/local-ai-broker/` | Loopback OpenAI/Anthropic-compatible broker |
| `packages/detectors/`, `packages/soter-pii/` | Additional detector packages (not all wired into extension) |
| `models/ml-classifier-v3/` | ONNX artifacts exist on disk; **not loaded by extension** |
| `docs/security/` | Capability / bypass matrices and threat docs |

---

## 2. Section 1 hypothesis verification

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| 1 | Secret Broker / enforced API capability is the strongest genuinely enforced feature | **TRUE** | `EnforcedApiCapabilityBroker`, `apps/local-ai-broker`, capability registry `STRONG_ENFORCEMENT`, `wiredInRuntime: true` |
| 2 | Broker hides raw secret from AI; injects locally only for bound destination/operation | **TRUE** | Opaque `soter-cap-…` handles; host/method/path/HTTPS/workspace/expiry/use-count checks before Authorization injection; `OutputFilter` scrubs responses |
| 3 | Expired, revoked, replayed, wrong-host/method/path, non-HTTPS fail closed | **TRUE** | Fail-closed reasons in enforced capability `call()`; broker tests |
| 4 | MCP Firewall, Protected Workspace, Terminal Guard, AI Sentinel, Live Scan, Dependency Guard, Memory Guard, Permissions mostly monitoring/advisory | **MOSTLY TRUE** | MCP config scan = `DETECTION_ONLY`; live scan = `VISIBILITY_ONLY`; terminal manual review = `DETECTION_ONLY`; controlled terminal = `STRONG_ENFORCEMENT` only on broker allowlist; Protected Workspace enforces only on SoterAI-built context; DepGuard = heuristic, no OSV |
| 5 | Extension detection primarily regex/keyword | **TRUE** | `SecretDetector`, `PromptInjectionLiteDetector`, `JailbreakLiteDetector` are pure regex |
| 6 | Server-side ML / ONNX not loaded by packaged extension | **TRUE** | No `onnxruntime` import in extension or guard-core; models not in `.vscodeignore` ship set |
| 7 | Prompt-injection / jailbreak not consistent in live inline path | **WAS TRUE → FIXED 2026-07-23** | LiveScanner used `context: "file"`; `runDetectors` previously skipped PI/JB for file. Pipeline `1.1.0` now enables them for file/workspace/git. Behavioral tests: `live-scan-parity.test.ts` |
| 8 | Secret coverage limited vs mature engines | **PARTIALLY TRUE** | ~20 regex families (OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, JWT, private keys, DB URLs, …). Missing many providers (Azure, Twilio, HF, Docker, K8s, NuGet, …), no entropy layer, no checksum validation |
| 9 | Dependency Guard does not use real advisory source (OSV) | **TRUE** | `DepGuard.ts` — typosquat regex + install-script heuristics only; zero OSV/NVD calls |
| 10 | Strongest broker flow may require manual base URL | **TRUE** | Settings `soterai.broker.openAIProviderUrl` / `anthropicProviderUrl`; copy-URL commands; no one-click auto-config of third-party AI extensions |
| 11 | Streaming not supported through broker | **TRUE** | `BrokerServer.ts` throws `streaming_not_supported` when `body.stream === true` |
| 12 | Many extension tests inspect source strings | **PARTIALLY TRUE** | ~17% static source inspection (esp. `extension.test.ts`); ~65% runtime behavioral in guard-core + secret-broker; **0% real extension-host** tests |
| 13 | Too many commands / settings (feature bloat) | **TRUE** | ~100 contributed commands; `soterai.showAllCommands` defaults false to hide advanced palette entries |
| 14 | Product claims may not distinguish enforcement vs advisory | **PARTIALLY TRUE** | Control Panel + `ProtectionLevel` + `CapabilityRegistry` improve honesty; README/settings still claim live scan shows “prompt-injection” (now true after pipeline fix) and over-broad feature language remains in places |

---

## 3. Protection-level vocabulary (two systems — must converge)

| System | Location | Levels |
|---|---|---|
| Section 3 mandate / CapabilityRegistry | `packages/guard-core/src/CapabilityRegistry.ts` | `FULL_ENFORCEMENT` … `UNKNOWN_NOT_TESTED` (8 levels) |
| Extension UI badges | `packages/vscode-extension/src/protection/ProtectionLevel.ts` | `ENFORCED`, `VERIFIED`, `REDACTED`, `MONITORED`, `UNKNOWN`, `EXPOSED` |

**Gap:** UI vocabulary ≠ registry vocabulary. Control Panel does not yet render `CAPABILITY_REGISTRY` as the sole source of truth.

---

## 4. Capability snapshot (from registry)

Counts (artifact `artifacts/security/capabilities.json`, version 0.2.1):

| Level | Count |
|---|---:|
| STRONG_ENFORCEMENT | 5 |
| DETECTION_ONLY | 3 |
| VISIBILITY_ONLY | 1 |
| UNKNOWN_NOT_TESTED | 7 (engines exist, **not wired** into packaged runtime) |
| UNSUPPORTED | 2 |

Unwired engines (must not be marketed as enforced): MCPGateway, TaintEngine, FileOperationFirewall, NetworkEgressPolicy, CheckpointRollback, GovernancePolicy, ProcessSandboxPolicy.

---

## 5. Test classification (approx.)

| Category | ~% | Notes |
|---|---:|---|
| Runtime behavioral | 65% | guard-core, secret-broker, enforced-capability |
| Static source inspection | 17% | extension.test.ts contracts |
| Integration behavioral | 7% | local-ai-broker HTTP suite |
| Contract | 5% | capability honesty, package parity |
| Benchmark / mock | 4% | perf + stubs |
| Extension-host behavioral | 0% | **no real VS Code host suite** |

Static string checks must not be counted as enforcement evidence.

---

## 6. Highest-risk issues addressed / remaining

### Fixed in this pass (Phase 0 → Phase 1/3 start)

1. **Live-scan detector parity** — file context now runs prompt-injection + jailbreak; pipeline report on every decision; cache invalidates on detector version change.
2. **Phase 0 audit + hypothesis table** — this document.

### Still open (ordered by impact)

1. Broker streaming unsupported (blocks commercial AI coding UX).
2. No local ONNX in packaged extension (remove or ship ML claims).
3. DepGuard has no OSV (downgrade claims or implement).
4. MCP runtime gateway not wired.
5. Terminal enforcement only on controlled allowlist path.
6. Secret rule coverage + false-positive controls incomplete.
7. Command surface bloat (~100 commands).
8. Dual protection-level vocabularies.
9. Zero extension-host behavioral tests.
10. Manual broker URL setup only.

---

## 7. Commands run for baseline (record as executed)

See phase progress reports. Minimum set:

```text
npm --prefix packages/guard-core run test
npm --prefix packages/guard-core run typecheck
npm --prefix packages/vscode-extension run typecheck   # when deps built
npx tsx scripts/generate-capabilities-artifact.ts
```

---

## 8. Next phases

- **Phase 1** — Fix remaining misleading claims; align UI levels with registry; fail-safe policy defaults.
- **Phase 2** — Expand behavioral attack tests; reduce reliance on source-string tests as evidence.
- **Phase 3** — Complete live-scan parity documentation + regression locks (partially done via pipeline 1.1.0).
- **Phase 4+** — Secret engine, local ML, broker streaming, integrations, MCP gateway, terminal, deps, UX, release.
