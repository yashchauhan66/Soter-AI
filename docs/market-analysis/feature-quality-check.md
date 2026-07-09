# SoterAI Feature Quality Check

**Assessment Date:** July 2026  
**Rating Scale:** 1-10 (10 = best)

---

## Rating Criteria

| Criterion | Definition |
|-----------|------------|
| **User Value** | Does this solve a real, acute problem? |
| **Market Uniqueness** | Does any competitor offer this? |
| **Security Strength** | How robust is the protection? |
| **Implementation Maturity** | Is it production-ready? |
| **Test Coverage** | Are there automated tests? |
| **Reliability** | Will it work under load/failure? |
| **Performance** | Is it fast enough? |
| **Monetization Value** | Will customers pay for this? |

---

## Feature Assessments

### Local AI Broker

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 9 | Core moat—no competitor has this exact combination |
| Market Uniqueness | 9 | Loopback-only, bearer auth, mandatory scan, no cloud upload |
| Security Strength | 7 | Good controls, but rule-based detection can be evaded |
| Implementation Maturity | 7 | Source complete, no formal verification |
| Test Coverage | 6 | Tests exist but no load/integration tests with real APIs |
| Reliability | 6 | Unknown under concurrent load |
| Performance | 6 | No published benchmarks |
| Monetization Value | 9 | Clear enterprise value for privacy-conscious teams |
| **Overall** | **7.4/10** | Strong differentiator, needs validation |

**Missing Pieces:**
- Load testing under concurrent requests
- Integration tests with real OpenAI/Anthropic APIs
- Latency benchmarks published
- Error handling for provider failures

---

### OpenAI-Compatible Broker

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Enables drop-in replacement for OpenAI client |
| Market Uniqueness | 7 | Some competitors have proxies, but not local-first |
| Security Strength | 7 | Scans requests/responses |
| Implementation Maturity | 6 | Source exists, needs real API validation |
| Test Coverage | 5 | Mock tests only |
| Reliability | 6 | Unknown |
| Performance | 6 | Proxy adds latency, not measured |
| Monetization Value | 8 | Critical for Copilot alternatives |
| **Overall** | **6.6/10** | Good potential, needs validation |

**Missing Pieces:**
- Streaming support validation
- Error handling for API failures
- Timeout/retry logic
- Token usage tracking

---

### Anthropic-Compatible Broker

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 7 | For Claude users |
| Market Uniqueness | 7 | Rare to support Anthropic proxy |
| Security Strength | 7 | Same as OpenAI broker |
| Implementation Maturity | 5 | Less tested than OpenAI path |
| Test Coverage | 4 | Limited tests |
| Reliability | 5 | Unknown |
| Performance | 5 | Not measured |
| Monetization Value | 7 | Growing Claude adoption |
| **Overall** | **5.9/10** | Needs work |

---

### AI Safe Mode

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 7 | Auto-scan all AI interactions |
| Market Uniqueness | 6 | Others have "safe mode" concepts |
| Security Strength | 6 | Depends on detection quality |
| Implementation Maturity | 6 | Source exists |
| Test Coverage | 5 | Limited |
| Reliability | 6 | Unknown |
| Performance | 6 | Unknown overhead |
| Monetization Value | 7 | Clear value |
| **Overall** | **6.1/10** | Needs validation |

---

### AI Memory Inspector

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Tracks what AI has "learned" |
| Market Uniqueness | 9 | No competitor has this |
| Security Strength | 6 | Detection is heuristic |
| Implementation Maturity | 6 | Source exists |
| Test Coverage | 5 | Limited |
| Reliability | 5 | Memory could grow unbounded |
| Performance | 5 | Not profiled |
| Monetization Value | 8 | Unique feature |
| **Overall** | **6.5/10** | Unique but needs work |

**Missing Pieces:**
- Memory cleanup/expiry
- Performance profiling
- Real-world validation

---

### AI Context Firewall

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 9 | Core problem: accidental secret sharing |
| Market Uniqueness | 8 | GitGuardian doesn't do AI context |
| Security Strength | 7 | Good detection + redaction |
| Implementation Maturity | 7 | Source complete |
| Test Coverage | 6 | Has tests |
| Reliability | 6 | Unknown at scale |
| Performance | 6 | Unknown |
| Monetization Value | 9 | Clear enterprise value |
| **Overall** | **7.3/10** | Strong feature |

---

### Protected Secret Vault

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Move secrets out of workspace |
| Market Uniqueness | 7 | HashiCorp Vault is different (cloud/enterprise) |
| Security Strength | 7 | Encrypted, outside workspace |
| Implementation Maturity | 6 | Source exists |
| Test Coverage | 5 | Limited crypto tests |
| Reliability | 6 | Unknown |
| Performance | 7 | Local, should be fast |
| Monetization Value | 7 | Part of bundle |
| **Overall** | **6.6/10** | Good concept, needs audit |

**Missing Pieces:**
- Independent crypto audit
- Key rotation mechanism
- Backup/restore
- Integration with real secret managers

---

### What AI Saw Ledger

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Audit trail for AI context |
| Market Uniqueness | 9 | No competitor has this |
| Security Strength | 8 | SHA-256 hashes, no raw secrets |
| Implementation Maturity | 7 | Source complete |
| Test Coverage | 6 | Has tests |
| Reliability | 6 | Local storage limits |
| Performance | 6 | Unknown at scale |
| Monetization Value | 8 | Compliance value |
| **Overall** | **7.3/10** | Strong feature |

---

### Canary Leak Detection

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Tripwires for prompt injection |
| Market Uniqueness | 8 | Rebuff has this, but prototype |
| Security Strength | 7 | Depends on canary coverage |
| Implementation Maturity | 6 | Source exists |
| Test Coverage | 5 | Limited scenarios |
| Reliability | 6 | Unknown |
| Performance | 7 | Hash matching is fast |
| Monetization Value | 7 | Detection capability |
| **Overall** | **6.8/10** | Good potential |

---

### MCP/Tool Permission Monitor

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 7 | MCP is growing, early market |
| Market Uniqueness | 8 | Cisco has MCP catalog, but different |
| Security Strength | 6 | Heuristic analysis |
| Implementation Maturity | 5 | MCP ecosystem volatile |
| Test Coverage | 4 | Limited |
| Reliability | 5 | Unknown |
| Performance | 6 | Unknown |
| Monetization Value | 7 | Growing importance |
| **Overall** | **6.0/10** | Early stage |

---

### LLM Extension Risk Scanner

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 6 | Nice-to-have, not critical |
| Market Uniqueness | 7 | No direct competitor |
| Security Strength | 5 | Heuristic metadata analysis |
| Implementation Maturity | 5 | Source exists |
| Test Coverage | 4 | Limited |
| Reliability | 5 | Extension metadata changes |
| Performance | 7 | Metadata scan is fast |
| Monetization Value | 5 | Low standalone value |
| **Overall** | **5.5/10** | Complementary feature |

---

### India PII Detection

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 8 | Critical for India market |
| Market Uniqueness | 10 | NO competitor has this |
| Security Strength | 7 | Regex patterns, good coverage |
| Implementation Maturity | 7 | Production-ready |
| Test Coverage | 7 | Has India-specific tests |
| Reliability | 7 | Stable |
| Performance | 8 | Fast |
| Monetization Value | 9 | India-market wedge |
| **Overall** | **7.9/10** | Strong differentiator |

---

### Cross-IDE Adapters

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 7 | Broader market reach |
| Market Uniqueness | 6 | Some competitors have multi-IDE plans |
| Security Strength | N/A | Adapter doesn't change security |
| Implementation Maturity | 3 | VS Code only production-ready |
| Test Coverage | 3 | Mostly plan docs |
| Reliability | 3 | Untested |
| Performance | 5 | Unknown |
| Monetization Value | 7 | Revenue expansion |
| **Overall** | **4.3/10** | Not ready |

---

### CLI

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| User Value | 6 | For CI/CD and automation |
| Market Uniqueness | 5 | Many tools have CLIs |
| Security Strength | N/A | Wrapper around core |
| Implementation Maturity | 5 | Source in `packages/soterai-cli/` |
| Test Coverage | 4 | Limited |
| Reliability | 5 | Unknown |
| Performance | 7 | Should be fast |
| Monetization Value | 6 | Part of suite |
| **Overall** | **5.4/10** | Nice-to-have |

---

## Summary Matrix

| Feature | Value | Unique | Security | Mature | Tests | Reliable | Perf | Money | **Overall** |
|---------|:-----:|:------:|:--------:|:------:|:-----:|:--------:|:----:|:-----:|:-----------:|
| Local AI Broker | 9 | 9 | 7 | 7 | 6 | 6 | 6 | 9 | **7.4** |
| AI Context Firewall | 9 | 8 | 7 | 7 | 6 | 6 | 6 | 9 | **7.3** |
| What AI Saw Ledger | 8 | 9 | 8 | 7 | 6 | 6 | 6 | 8 | **7.3** |
| India PII Detection | 8 | 10 | 7 | 7 | 7 | 7 | 8 | 9 | **7.9** |
| Canary Leak Detection | 8 | 8 | 7 | 6 | 5 | 6 | 7 | 7 | **6.8** |
| Protected Secret Vault | 8 | 7 | 7 | 6 | 5 | 6 | 7 | 7 | **6.6** |
| OpenAI-Compatible Broker | 8 | 7 | 7 | 6 | 5 | 6 | 6 | 8 | **6.6** |
| AI Memory Inspector | 8 | 9 | 6 | 6 | 5 | 5 | 5 | 8 | **6.5** |
| AI Safe Mode | 7 | 6 | 6 | 6 | 5 | 6 | 6 | 7 | **6.1** |
| MCP/Tool Monitor | 7 | 8 | 6 | 5 | 4 | 5 | 6 | 7 | **6.0** |
| Anthropic-Compatible Broker | 7 | 7 | 7 | 5 | 4 | 5 | 5 | 7 | **5.9** |
| Extension Risk Scanner | 6 | 7 | 5 | 5 | 4 | 5 | 7 | 5 | **5.5** |
| CLI | 6 | 5 | N/A | 5 | 4 | 5 | 7 | 6 | **5.4** |
| Cross-IDE Adapters | 7 | 6 | N/A | 3 | 3 | 3 | 5 | 7 | **4.3** |

---

## Top Features by Quality

**Tier 1 (7.0+): Production Differentiators**
1. India PII Detection (7.9) — Unique market wedge
2. Local AI Broker (7.4) — Core moat
3. AI Context Firewall (7.3) — Solves acute problem
4. What AI Saw Ledger (7.3) — Unique audit trail

**Tier 2 (6.0-6.9): Strong Features Needing Validation**
5. Canary Leak Detection (6.8)
6. Protected Secret Vault (6.6)
7. OpenAI-Compatible Broker (6.6)
8. AI Memory Inspector (6.5)
9. AI Safe Mode (6.1)
10. MCP/Tool Permission Monitor (6.0)

**Tier 3 (< 6.0): Complementary/Incomplete**
11. Anthropic-Compatible Broker (5.9)
12. Extension Risk Scanner (5.5)
13. CLI (5.4)
14. Cross-IDE Adapters (4.3)

---

## Common Missing Pieces

| Gap | Affected Features | Priority |
|-----|-------------------|----------|
| Load/integration tests | Broker, Safe Mode, Context | HIGH |
| Real API validation | OpenAI Broker, Anthropic Broker | HIGH |
| Performance benchmarks | All broker features | HIGH |
| Error handling | All features | MEDIUM |
| Crypto audit | Vault | MEDIUM |
| Memory cleanup | Memory Inspector, Ledger | MEDIUM |
| Real-world validation | Canary, MCP Monitor | MEDIUM |

---

## Monetization Priority

**Paywall-Ready:**
- Local AI Broker (Tier 1)
- AI Context Firewall (Tier 1)
- Protected Secret Vault (Tier 2)
- What AI Saw Ledger (Tier 1)

**Free Tier Value:**
- Secret/PII Detection (core engine)
- Basic Context Scanning
- India PII Detection (India-market free tier hook)

**Enterprise Upsell:**
- Team Policy Sync
- SIEM Integration
- Audit Exports
- SSO/SAML

---

**Next:** [Market Gap Analysis](./market-gap-analysis.md)
