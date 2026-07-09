# SoterAI Competitor Comparison Matrix

## Core AI Security Comparison

| Capability | SoterAI | Lakera Guard | Protect AI | HiddenLayer | Prompt Security | GitGuardian |
|------------|:-------:|:------------:|:----------:|:-----------:|:---------------:|:-----------:|
| **Prompt Injection** | ✅ Strong | ✅ Strong (ML) | ✅ | ⚠️ Model-only | ✅ | ❌ |
| **Jailbreak Detection** | ✅ Strong | ✅ Strong | ✅ | ❌ | ✅ | ❌ |
| **Sensitive Data Disclosure** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Secret Redaction** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **PII Redaction** | ✅+India | ✅ | ⚠️ | ❌ | ✅ | ✅ |
| **India PII** | ✅ Unique | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Unsafe Output Detection** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Tool-Call Security** | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| **Agent Security** | ⚠️ Preview | ⚠️ Post-acq | ✅ | ❌ | ⚠️ | ❌ |
| **MCP Security** | ⚠️ Limited | ❌ | ✅ | ❌ | ❌ | ❌ |
| **RAG Security** | ⚠️ Limited | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Model Security** | ❌ | ❌ | ⚠️ | ✅ Strong | ❌ | ❌ |
| **AI Red Teaming** | ⚠️ Lab | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| **AI Supply Chain/AIBOM** | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ |
| **AI Governance** | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ | ❌ |
| **Shadow AI Discovery** | ⚠️ Limited | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Runtime Monitoring** | ⚠️ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **SIEM Integration** | ⚠️ Basic | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Compl. Reports** | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Developer Security Comparison

| Capability | SoterAI | Lakera | GitGuardian | Snyk | Copilot |
|------------|:-------:|:------:|:-----------:|:----:|:-------:|
| **VS Code Extension** | ⚠️ Packaged | ❌ | ✅ | ✅ | ✅ Built-in |
| **Cursor Support** | ⚠️ | ❌ | ❌ | ❌ | ✅ Built-in |
| **JetBrains Support** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Local AI Broker** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| **Safe AI Context Builder** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| **Memory Inspector** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| **Terminal Firewall** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| **Repo Poisoning Scanner** | ⚠️ Limited | ❌ | ❌ | ⚠️ | ❌ |
| **Dependency Risk** | ⚠️ Basic | ❌ | ❌ | ✅Strong | ❌ |
| **AI Code Review** | ⚠️ Basic | ❌ | ❌ | ❌ | ⚠️ |
| **Protected Secret Vault** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |
| **Local-First Mode** | ✅ Unique | ❌ | ❌ | ❌ | ❌ |

## Business/Product Comparison

| Aspect | SoterAI | Lakera | GitGuardian | Snyk |
|--------|:-------:|:------:|:-----------:|:----:|
| **Free Plan** | ⚠️ TBD | ✅ | ✅ | ✅ |
| **Transparent Pricing** | ❌ No page | ✅ | ✅ | ✅ |
| **SMB Pricing** | ❌ | ✅ | ✅ | ✅ |
| **Enterprise Pricing** | ❌ | ✅ | ✅ | ✅ |
| **Self-Hosted** | ✅ Docker | ❌ | ⚠️ | ⚠️ |
| **Cloud** | ✅ | ✅ | ✅ | ✅ |
| **Local Agent** | ✅ Unique | ❌ | ❌ | ❌ |
| **Marketplace** | ❌ Not published | ✅ | ✅ | ✅ |
| **Setup Complexity** | MEDIUM | LOW | LOW | LOW |
| **Developer UX** | GOOD | GOOD | GOOD | GOOD |
| **Enterprise UX** | ⚠️ | ✅ | ✅ | ✅ |
| **Documentation** | ⚠️ 268 files | ✅ | ✅ | ✅ |
| **Support** | ❌ | ✅ | ✅ | ✅ |

## Source Links for Competitor Claims

- Lakera: https://docs.lakera.ai/guard (prompt injection, jailbreak, data leakage)
- Protect AI (LLM Guard): https://protectai.github.io/llm-guard/ (open-source scanners)
- HiddenLayer: https://hiddenlayer.com/ (model security, AIBOM)
- Prompt Security: https://promptsecurity.com/ (enterprise AI guardrails)
- GitGuardian: https://github.com/GitGuardian/gg-shield (secret scanning)
- Snyk: https://snyk.io/ (dependency security)

---

## Detailed Assessment

### Where SoterAI Beats Competitors

1. **Local-first architecture** — unique, privacy-conscious
2. **India PII detection** — no competitor has this
3. **AI Memory Inspector** — no competitor has this
4. **What AI Saw Ledger** — unique audit capability
5. **Context Firewall** — protects AI prompts from secrets
6. **Protected Secret Vault** — moves secrets out of workspace
7. **Canary leak detection** — tripwires for prompt injection
8. **Terminal Command Firewall** — unique to IDE extension
9. **MCP Tool Monitor** — early market presence
10. **IDE extension** — Lakera/GitGuardian don't have this

### Where Competitors Beat SoterAI

1. **Marketplace presence** — all competitors published
2. **ML-based detection** — Lakera has 80M+ prompts training
3. **Independent benchmarks** — competitors have third-party validation
4. **External security audit** — competitors have SOC 2, pen tests
5. **Customer case studies** — competitors have references
6. **Enterprise trust** — mature support, SLAs
7. **Model security** — HiddenLayer is leader
8. **Red teaming** — CalypsoAI, Cisco have dedicated modules

---

**Next:** [Pricing Comparison](./pricing-comparison-and-recommendation.md)