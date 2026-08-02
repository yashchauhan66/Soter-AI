# EU AI Act + India DPDP — Automated Evidence Pack
Generated: 2026-08-02T08:20:30.573Z

| EU AI Act Article | SoterAI control | Evidence |
|---|---|---|
| Art 9 — Risk management system | Pre-execution guard + 8 canonical decision verbs + fail-safe ABSTAIN; capability registry honest:true | `artifacts/security/capabilities.json` |
| Art 10 — Data & data governance | PII/SECRET detectors, deterministic 0-FP rules, benign control suite | `artifacts/security/multilingual-100lang-eval-2026-08-02.json` |
| Art 11 — Technical documentation | Model card + ONNX backend header + reproducible eval scripts | `docs/SOTERLLM-MODEL-CARD.md` |
| Art 12 — Record keeping / logging | Evidence vault signed receipts + SOC2 control automation | `artifacts/security/soc2-control-report.md` |
| Art 13 — Transparency & provision of information | Public known-bypass list + limitations kept in-repo | `artifacts/security/capabilities.json` |
| Art 14 — Human oversight | REQUIRE_APPROVAL verb + escalation path in canonical plane | `artifacts/security/capabilities.json` |
| Art 15 — Accuracy, robustness, cybersecurity | Measured recall/FP + 3.1ms p95 BLOCK latency + model supply-chain signing gate | `artifacts/perf/mcp-latency-bench.json, artifacts/security/model-trust-store.json` |

## India DPDP 2023
| Section | Control |
|---|---|
| S.8(4) — security safeguards | Pre-execution BLOCK on PII/SECRET exfil, signed receipts |
| S.8(5) — breach notification readiness | Evidence vault hash-chained receipts enable time-stamped disclosure |

> Self-generated compliance-as-code evidence; NOT a substitute for a notified-body certification. Compiled from in-repo artifacts whose SHA-256 is pinned above.