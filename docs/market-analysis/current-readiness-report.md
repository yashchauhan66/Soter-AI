# SoterAI Current Readiness Report

**Assessment Date:** July 2026  
**Product Version:** 0.2.0

---

## Status Legend

| Status | Meaning |
|--------|---------|
| ✅ PASS | Production-ready, tested, documented |
| ⚠️ PARTIAL PASS | Implemented but missing tests/docs/validation |
| ❌ FAIL | Critical issues or not functional |
| 📋 PLANNED | Source exists or planned, not implemented |
| ❓ UNKNOWN | Needs manual verification |

---

## 1. Product Modules Ready (Production-Grade)

| Module | Status | Evidence | Notes |
|--------|:------:|----------|-------|
| **guard-core** (shared engine) | ✅ PASS | 827+ tests, TypeScript compiles, used by VS Code extension and broker | Core detection logic for secrets, PII, prompt injection, jailbreak |
| **Secret Detection** | ✅ PASS | 20+ patterns (OpenAI, Anthropic, AWS, GitHub, GitLab, JWT, private keys, DB URLs, Stripe, Razorpay) | Regex-based but comprehensive |
| **PII Detection** | ✅ PASS | Email, phone, IP, credit card, SSN, DOB | Basic patterns, confidence scoring |
| **India PII Detection** | ✅ PASS | Aadhaar, PAN, GSTIN, UPI, IFSC, Indian phone | Unique differentiator |
| **Prompt Injection Detection** | ✅ PASS | 140+ rules across 15+ attack families | Rule-based with semantic layer |
| **Jailbreak Detection** | ✅ PASS | 64+ rules (DAN, Skeleton Key, Many-Shot, etc.) | Good coverage of known techniques |
| **Redaction Engine** | ✅ PASS | Preserves first/last 2 chars, hashes evidence | Safe for logging |
| **Policy Evaluator** | ✅ PASS | ALLOW, REDACT, REVIEW, BLOCK actions | Per-detector configuration |
| **Decision Engine** | ✅ PASS | Multi-detector aggregation, confidence scoring | Returns decisions with evidence |

---

## 2. Product Modules Source-Complete but Not Fully Validated

| Module | Status | Evidence | Gap |
|--------|:------:|----------|-----|
| **Local AI Broker** | ⚠️ PARTIAL | Source exists, TypeScript compiles, tests in `apps/local-ai-broker` | No published latency benchmarks, no load tests, not on marketplace |
| **OpenAI-Compatible Proxy** | ⚠️ PARTIAL | Source in `BrokerServer.ts` | Needs real API integration tests |
| **Anthropic-Compatible Proxy** | ⚠️ PARTIAL | Source exists | Needs real API integration tests |
| **AI Safe Mode** | ⚠️ PARTIAL | Source in `SafeMode.ts` | Needs manual UX validation |
| **AI Memory Inspector** | ⚠️ PARTIAL | Source in `MemorySession.ts` | Performance under load unknown |
| **AI Context Firewall** | ⚠️ PARTIAL | Source in `SafeContextBuilder.ts` | Needs real-world workflow testing |
| **Protected Secret Vault** | ⚠️ PARTIAL | Source in `Vault.ts`, `VaultCrypto.ts` | Encryption needs independent audit |
| **What AI Saw Ledger** | ⚠️ PARTIAL | Source in `Ledger.ts` | Storage limits, cleanup unclear |
| **Canary Leak Detection** | ⚠️ PARTIAL | Source in `Canary.ts` | Needs multi-scenario tests |
| **MCP/Tool Permission Monitor** | ⚠️ PARTIAL | Source in `MCPPolicyAnalyzer.ts` | MCP ecosystem changes rapidly |
| **LLM Extension Risk Scanner** | ⚠️ PARTIAL | Source in `ExtensionRiskScanner.ts` | Heuristic-based, not ML |
| **Output Leak Scanner** | ⚠️ PARTIAL | Source in `OutputLeakScanner.ts` | Detection quality unknown |

---

## 3. Product Modules Only Planned (No Production Code)

| Module | Status | Evidence | Notes |
|--------|:------:|----------|-------|
| **Browser Extension** | 📋 PLANNED | Plan docs exist in `docs/browser-extension-ai-security-plan.md` | No source code |
| **JetBrains Adapter** | 📋 PLANNED | Plan in `extensions/jetbrains/`, test report exists | No published plugin |
| **Visual Studio Adapter** | 📋 PLANNED | Plan in `extensions/visual-studio/` | Not integrated with VS Marketplace |
| **Neovim Plugin** | 📋 PLANNED | Plan in `extensions/neovim/` | Lua implementation planned |
| **Vim Plugin** | 📋 PLANNED | Plan in `extensions/vim/` | Minimal viable planned |
| **Sublime Plugin** | 📋 PLANNED | Plan in `extensions/sublime/` | Python implementation planned |
| **Eclipse Plugin** | 📋 PLANNED | Plan in `extensions/eclipse/` | Java implementation planned |
| **JupyterLab Extension** | 📋 PLANNED | Plan in `extensions/jupyterlab/` | Not published |
| **n8n Integration** | ⚠️ PARTIAL | Demo workflow exists in `final/n8n-soterai-demo-workflow.json` | Not published to n8n marketplace |
| **Zapier Integration** | ⚠️ PARTIAL | Build passes but not live | Not in Zapier marketplace |
| **Make Integration** | ⚠️ PARTIAL | Planned | Not implemented |

---

## 4. Platform Coverage

### VS Code

| Aspect | Status | Notes |
|--------|:------:|-------|
| Extension Source | ✅ PASS | `packages/vscode-extension/` complete |
| TypeScript Compilation | ✅ PASS | Zero errors |
| ESBuild Bundle | ✅ PASS | Production bundle generated |
| VSIX Packaging | ✅ PASS | `vscode:package` script works |
| **VS Code Marketplace** | ❌ FAIL | **Not published** |
| **Open VSX** | ❌ FAIL | **Not published** |
| Commands (90+) | ✅ PASS | All commands registered |
| Views (3 panels) | ✅ PASS | Project Risk, Latest Findings, Policy Status |
| Settings (12+) | ✅ PASS | Cloud, policy, scan, broker, terminal config |
| Activation | ⚠️ PARTIAL | Needs real-world performance testing |

**Verdict:** Extension is technically complete but users cannot install it from marketplace.

### Cursor

| Aspect | Status | Notes |
|--------|:------:|-------|
| Compatibility Planned | ✅ PASS | Cursor is VS Code-compatible, same VSIX should work |
| **Installation** | ❓ UNKNOWN | Needs manual testing |
| **Open VSX for Cursor** | ❌ FAIL | Not published |

**Verdict:** Should work but not tested or documented.

### Windsurf

| Aspect | Status | Notes |
|--------|:------:|-------|
| Compatibility Planned | ✅ PASS | VS Code-compatible |
| **Testing** | ❓ UNKNOWN | |

**Verdict:** Should work but no evidence.

### Open VSX / VSCodium

| Aspect | Status | Notes |
|--------|:------:|-------|
| **Publishing Script** | ⚠️ PARTIAL | `openvsx:publish` script exists |
| **Publication** | ❌ FAIL | Not on Open VSX |

**Verdict:** Planned but not live.

### JetBrains

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/jetbrains-plugin-plan.md` |
| Test Report | ✅ PASS | `docs/jetbrains-plugin-test-report.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/jetbrains/` exists |
| **Published Plugin** | ❌ FAIL | Not on JetBrains Marketplace |

**Verdict:** Planned, not production-ready.

### Visual Studio

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/visual-studio-extension-plan.md` |
| Test Report | ✅ PASS | `docs/visual-studio-test-report.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/visual-studio/` exists |
| **Published Extension** | ❌ FAIL | Not on Visual Studio Marketplace |

**Verdict:** Planned, not production-ready.

### Neovim

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/neovim-plugin-plan.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/neovim/` exists |
| **Published Plugin** | ❌ FAIL | Not distributed |

**Verdict:** Planned, not production-ready.

### Vim

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/sublime-package-plan.md` references |
| Source Directory | ⚠️ PARTIAL | `extensions/vim/` exists |

**Verdict:** Planned, not production-ready.

### Sublime Text

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/sublime-package-plan.md` |
| Test Report | ✅ PASS | `docs/sublime-test-report.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/sublime/` exists |
| **Package Control** | ❌ FAIL | Not on Package Control |

**Verdict:** Planned, not production-ready.

### Eclipse

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/eclipse-plugin-plan.md` |
| Test Report | ✅ PASS | `docs/eclipse-test-report.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/eclipse/` exists |
| **Eclipse Marketplace** | ❌ FAIL | Not published |

**Verdict:** Planned, not production-ready.

### JupyterLab

| Aspect | Status | Notes |
|--------|:------:|-------|
| Plan Document | ✅ PASS | `docs/jupyterlab-extension-plan.md` |
| Test Report | ✅ PASS | `docs/jupyterlab-test-report.md` |
| Source Directory | ⚠️ PARTIAL | `extensions/jupyterlab/` exists |
| **PyPI/npm** | ❌ FAIL | Not published |

**Verdict:** Planned, not production-ready.

---

## 5. Security Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| Loopback-only bind | ✅ PASS | Broker binds to 127.0.0.1 only |
| Bearer token auth | ✅ PASS | 256-bit token, timing-safe comparison |
| No CORS | ✅ PASS | Rejects cross-origin requests |
| Body size limits | ✅ PASS | 1MB default limit |
| Rate limiting | ✅ PASS | Request limits in place |
| Timeout enforcement | ✅ PASS | Request timeouts configured |
| No raw secret logging | ✅ PASS | Redacted evidence only |
| Secret detection | ✅ PASS | Comprehensive regex patterns |
| PII detection | ✅ PASS | Global + India patterns |
| Prompt injection detection | ⚠️ PARTIAL | Rule-based, no ML backing |
| External audit | ❌ FAIL | No third-party security audit |
| Penetration test | ❌ FAIL | No published pen test |
| **SOC 2** | ❌ FAIL | Not certified |
| **ISO 27001** | ❌ FAIL | Not certified |

**Verdict:** Good baseline security, but no enterprise validation.

---

## 6. Privacy Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| Local-first by default | ✅ PASS | No cloud required for core features |
| No raw cloud upload | ✅ PASS | Broker scans before proxy |
| Redacted event model | ✅ PASS | SHA-256 hashes, no raw secrets |
| What AI Saw ledger | ✅ PASS | Local storage, exportable |
| Canary detection | ✅ PASS | Tripwires for leak detection |
| Online/offline fallback | ⚠️ PARTIAL | Needs connectivity testing |
| Data retention policy | ⚠️ PARTIAL | Documented but not enforced in code |
| GDPR compliance | ❓ UNKNOWN | No DPA, no DPO listed |
| DPDP (India) | ⚠️ PARTIAL | Readiness docs but no certification |

**Verdict:** Strong privacy architecture, weak compliance validation.

---

## 7. Performance Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| Analyzer latency (claimed) | ⚠️ PARTIAL | "4.6ms p50" in README, but benchmark is internal |
| VS Code activation | ❓ UNKNOWN | Not measured in real workspaces |
| Large file handling | ⚠️ PARTIAL | 256KB limit configured |
| Workspace scan (1000 files) | ❓ UNKNOWN | Not benchmarked |
| Concurrent requests | ❓ UNKNOWN | No load test results |
| Memory usage | ❓ UNKNOWN | Not profiled |

**Verdict:** No published performance benchmarks.

---

## 8. Marketplace Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| VSIX Package | ✅ PASS | Built and packaged |
| vsce Configuration | ✅ PASS | Publisher: soterai |
| Icon and Assets | ✅ PASS | Logo, icon present |
| README for Marketplace | ⚠️ PARTIAL | Exists but needs marketplace-specific version |
| CHANGELOG | ✅ PASS | CHANGELOG.md exists |
| License | ✅ PASS | BSL-1.1 |
| **VS Code Marketplace** | ❌ FAIL | **NOT PUBLISHED** |
| **Open VSX** | ❌ FAIL | **NOT PUBLISHED** |
| **JetBrains Marketplace** | ❌ FAIL | No plugin |
| **Visual Studio Marketplace** | ❌ FAIL | No extension |
| **npm Package** | ❌ FAIL | guard-core not published to npm |
| **PyPI Package** | ❌ FAIL | No published Python package |

**Verdict:** Packaging is ready, publishing is not done.

---

## 9. Enterprise Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| SAML SSO | ⚠️ PARTIAL | Code exists in Next.js app, not validated |
| SCIM | ⚠️ PARTIAL | Code exists, not validated |
| RBAC | ✅ PASS | 6 roles implemented |
| Audit exports | ✅ PASS | JSONL/CSV with HMAC signatures |
| SIEM integration | ⚠️ PARTIAL | Worker exists, needs validation |
| Webhooks | ✅ PASS | HMAC-signed, retry logic |
| Billing | ✅ PASS | Razorpay integrated |
| Data retention | ⚠️ PARTIAL | Configured but not automated |
| Customer support | ❌ FAIL | No support infrastructure |
| SLA | ❌ FAIL | No published SLA |
| On-call | ❌ FAIL | No evidence of on-call rotation |
| Case studies | ❌ FAIL | Zero public case studies |
| G2/Capterra | ❌ FAIL | Not listed |

**Verdict:** Enterprise features exist in code, but enterprise trust signals are missing.

---

## 10. Documentation Readiness

| Aspect | Status | Notes |
|--------|:------:|-------|
| README | ✅ PASS | Comprehensive, honest limitations |
| Architecture docs | ✅ PASS | 268+ documentation files |
| API documentation | ⚠️ PARTIAL | Service catalog has issues (per audit) |
| Setup guide | ✅ PASS | GETTING_STARTED.md |
| Limitations page | ✅ PASS | ide-guard-limitations.md is excellent |
| Security policy | ✅ PASS | SECURITY.md exists |
| Changelog | ✅ PASS | CHANGELOG.md |
| Pricing page | ❌ FAIL | Not public |
| Comparison pages | ⚠️ PARTIAL | Exist but need validation |
| Video demos | ⚠️ PARTIAL | n8n demo exists, not mainstream |

**Verdict:** Good technical docs, weak go-to-market docs.

---

## 11. Support/Readiness Gaps Summary

### Critical Gaps (Block Launch)

| Gap | Impact | Effort |
|-----|--------|--------|
| VS Code Marketplace publication | Users cannot install | 5-10 days (approval) |
| No independent benchmark | Cannot prove detection quality | 2-4 weeks |
| No customer proof | No trust signals | 2-3 months minimum |
| Pricing page missing | Cannot sell | 1 week |

### High Gaps (Block Enterprise Pilots)

| Gap | Impact | Effort |
|-----|--------|--------|
| No external security audit | Enterprise procurement block | 2-3 months, $10K-50K |
| No SOC 2 | Enterprise compliance requirement | 6-12 months |
| No case studies | No reference customers | Ongoing |
| No support SLA | Enterprise risk | 1-2 months to establish |

### Medium Gaps (Block Growth)

| Gap | Impact | Effort |
|-----|--------|--------|
| Cross-IDE adapters incomplete | Market limited to VS Code | 3-6 months per IDE |
| guard-core not on npm/on-chain | Developers cannot use programmatically | 1 week |
| No browser extension | Cannot monitor browser-based AI | 2-3 months |
| No mobile SDK | Cannot support mobile AI apps | 2-3 months |

---

## 12. Readiness Scorecard

| Category | Status | Score |
|----------|--------|------:|
| Core Detection Engine | ✅ PASS | 75/100 |
| Local AI Broker | ⚠️ PARTIAL | 70/100 |
| VS Code Extension | ⚠️ PARTIAL | 72/100 |
| Cross-IDE Adapters | ❌ FAIL | 25/100 |
| Security Hardening | ⚠️ PARTIAL | 65/100 |
| Privacy Architecture | ✅ PASS | 80/100 |
| Marketplace Presence | ❌ FAIL | 30/100 |
| Enterprise Trust | ❌ FAIL | 40/100 |
| Documentation | ⚠️ PARTIAL | 70/100 |
| Go-to-Market | ❌ FAIL | 35/100 |
| **Overall** | ⚠️ PARTIAL | **58/100** |

---

## Final Assessment

**Product is technically solid but commercially blocked.**

- Core detection and broker architecture are production-grade (827 tests, honest limitations, good docs)
- Critical go-to-market blockers: no marketplace, no benchmark, no case studies, no pricing
- Cannot credibly position against funded competitors without external validation
- **Recommended for controlled paid beta with 50-100 technical early adopters**
- **Not ready for public launch or enterprise pilots**

---

**Next:** [Feature Quality Check](./feature-quality-check.md)
