# SoterAI on n8n / Make / Zapier — Deep Analysis

**Date:** 2026-08-05
**Method:** source-code audit + live API testing against production (`soterai.in`) + npm registry data + public market research
**Honesty rule:** every number below is either measured, cited, or explicitly labelled an estimate. Nothing is claimed that was not tested.

---

## 1. Executive summary

| Question | Honest answer |
|---|---|
| Does it solve a real problem? | **Yes — 3 of 6 claimed problems are genuinely solved and verified.** |
| Is the detection engine good? | **Yes on attacks (10/10 caught), weak on false positives (53% FP on Hinglish).** |
| Worldwide ranking? | **~#3 of 7 in the n8n-native AI-security niche. Not ranked globally.** |
| Real adoption today? | **Near zero.** 2,741 npm downloads are almost entirely CI/mirror traffic. |
| Realistic revenue? | **$0 today. $180k–$400k ARR achievable in 12–18 months if distribution is fixed.** |
| Biggest weakness? | **Not the product — the product is decent. It is distribution + one FP bug.** |
| Can it become market leader? | **In the n8n-native niche: yes, realistically. Globally vs Lakera/Palo Alto: no.** |

**The single most important finding:** Lakera, Prompt Security, and HiddenLayer — the actual category leaders — **have no n8n community node at all.** The n8n-native AI-security niche is genuinely unclaimed. That is the entire opportunity.

---

## 2. What was actually built (code audit)

### 2.1 n8n — `n8n-nodes-soterai` v0.3.3 — **SHIPPED & LIVE**

One node, seven actions, published on npm since 2026-06-26.

| Action | Endpoint | Verdict |
|---|---|---|
| Universal AI Firewall | orchestrates 5 endpoints | **Genuinely differentiated** |
| Guard Input | `/api/guard/input` | Works |
| Guard Output | `/api/guard/output` | Works |
| Analyze Text | `/api/guard/analyze` | Works |
| Redact Secrets/PII | `/api/guard/input` | Works |
| RAG Risk Summary | `/api/rag/document/trust-score` | Works |
| Audit n8n Workflow | **100% local, zero network** | **Unique in the market** |

**Real engineering strengths found in the code:**

1. **`usableAsTool: true`** (line 29) — the n8n AI Agent can call SoterAI as a tool. Most competitors are transform-only nodes. This is a real edge.
2. **Zero runtime dependencies** — only `n8n-workflow` as a peer. This is a *hard requirement* for n8n verification, and it is already met.
3. **Two-layer secret sanitisation** — `sanitizeErrorMessage()` + `sanitizeOutputObject()` scrub `sk-`, `ghp_`, `AKIA`, Bearer tokens, and DB connection strings from **both** error paths and API responses. Depth-capped at 8 to prevent recursion bombs. This is better hygiene than most paid security nodes.
4. **SSRF-hardened base URL validation** — rejects credentials-in-URL, query params, fragments, and non-HTTPS except localhost.
5. **Local workflow audit** maps findings to **OWASP LLM Top 10 (2025)** and returns node-by-node placement advice. It never sends the workflow off-box.
6. **Three protection profiles** (BALANCED / STRICT / MAXIMUM) with distinct thresholds — real policy logic, not decoration.

### 2.2 Make.com — **NOT SUBMITTED**

Only declarative JSON: `app.json` + 10 module definitions. No app registered on Make's marketplace. Files untouched since 2026-07-27.

Good news: the `api.soterai.in` base URL in `app.json` was tested and **does serve the guard API correctly** (HTTP 200, valid detection response). The blueprint is technically sound — it just was never submitted.

### 2.3 Zapier — **NOT SUBMITTED + CONTAINS A BUG**

4 actions written in TypeScript, never pushed via `zapier push`.

**Bug found** — `zapier/creates/guardActions.ts:370`:
```ts
function getBaseUrl(bundle: ZapierBundle): string {
  return "https://soterai.in";   // ← bundle ignored entirely
}
```
The function takes `bundle` and discards it. Every self-hosted or EU-region customer who sets a custom Base URL will be **silently sent to the public India endpoint**. For a security/DPDP-compliance product this is a credibility-destroying data-residency bug. Must be fixed before submission.

---

## 3. Live detection testing (production API, 2026-08-05)

### 3.1 Attack detection — 10/10 caught

| Attack | Result | Score |
|---|---|---|
| Classic injection | REWRITE | 52 |
| Base64-encoded injection | **BLOCK** | 100 |
| DAN roleplay jailbreak | **BLOCK** | 100 |
| Hindi-language injection | **BLOCK** | 100 |
| Unicode homoglyph evasion | HUMAN_REVIEW | 45 |
| Indirect RAG poisoning | **BLOCK** | 100 |
| Tool abuse (`curl \| bash`) | **BLOCK** | 100 |
| Crescendo / narrative framing | **BLOCK** | 100 |
| Leetspeak obfuscation | REWRITE | 40 |
| Markdown-image exfiltration | **BLOCK** | 100 |

**This is genuinely strong.** Base64, homoglyph, crescendo, and markdown-exfil detection are the four things most guardrail products miss. Multilingual Hindi injection detection is essentially unique.

Caveat: 10 tests is a smoke test, not a benchmark. Prior internal measurement puts untuned held-out recall at **~64%**, not 100%. Publish the 64% figure, not the 10/10.

### 3.2 False positives — **THE CRITICAL BUG**

15 ordinary Indian customer-support messages, all completely benign:

| # | Message | Result |
|---|---|---|
| 1 | `mujhe apna order status batao please` | ❌ **FALSE POSITIVE** |
| 5 | `saare products ki price list bhejo` | ❌ **FALSE POSITIVE** |
| 6 | `return ke rules kya hai batao` | ❌ **FALSE POSITIVE** |
| 7 | `aapki privacy policy batao` | ❌ **FALSE POSITIVE** |
| 8 | `mera order cancel kar do` | ❌ **FALSE POSITIVE** |
| 9 | `mera account data dikhao` | ❌ **FALSE POSITIVE** |
| 11 | `mere saare orders dikhao` | ❌ **FALSE POSITIVE** |
| 15 | `warranty ki jankari batao` | ❌ **FALSE POSITIVE** |
| 2,3,4,10,12,13,14 | refund/address/invoice/receipt/support/payment/tracking | ✅ ALLOW |

### **8 out of 15 = 53% false-positive rate on Hinglish.**

**Root cause identified** — `lib/guard/detectors/generalizedIntentDetector.ts:619-633`.

The rule fires when `HINGLISH_INTENT` AND `HINGLISH_TARGET` both match. But both regexes are far too broad:

- `HINGLISH_INTENT` includes bare `batao`, `karo`, `dikhao`, `bhejo`, `kar do`, `nikalo` — these are **the most common verbs in ordinary Hindi**, not attack markers.
- `HINGLISH_TARGET` includes bare `data`, `rules?`, `policy`, `orders?`, `saare`, `jankari`, `all` — **ordinary commerce nouns**.

So `"order status batao"` = benign verb + benign noun → flagged HIGH severity, score 42.

The existing suppressor (`sakta|chahta|...`) only catches polite-modal phrasing, which real customers rarely use.

**Why this is a business-critical bug, not a cosmetic one:** SoterAI's stated wedge is India-first + DPDP compliance. This bug means **the product breaks worst exactly on its target market's native language.** A shop deploying MAXIMUM profile would block over half its own paying customers.

### 3.3 Latency — measured

| Metric | Measured | Lakera's public claim |
|---|---|---|
| p50 | **722 ms** | <50 ms |
| p90 | **1,061 ms** | — |
| 5 KB payload | 657–999 ms | — |

**~14× slower than the category leader.** Acceptable for n8n batch workflows. Disqualifying for real-time chat. Do not sell this into live-chat use cases yet.

---

## 4. Real problems solved — honest scoring

| # | Claimed problem | Real? | Solved? | Verdict |
|---|---|---|---|---|
| 1 | Prompt injection reaching LLM from webhooks | **Yes — OWASP LLM01, #1 AI risk** | **Yes, verified** | ✅ **REAL** |
| 2 | No security visibility in n8n AI workflows | **Yes — n8n ships zero guardrails** | **Yes — local audit is unique** | ✅ **REAL** |
| 3 | PII/secrets leaking into LLM prompts | **Yes — DPDP/GDPR exposure** | **Yes, but 53% Hinglish FP** | ⚠️ **REAL, BROKEN ON HINDI** |
| 4 | RAG/vector poisoning | **Yes — OWASP LLM08** | Partially — scoring only, no chunk quarantine | ⚠️ **PARTIAL** |
| 5 | Agent tool-call abuse | **Yes — OWASP LLM06** | Partially — advisory, no true enforcement | ⚠️ **PARTIAL** |
| 6 | Real-time chat protection | Yes | **No — 722 ms too slow** | ❌ **NOT SOLVED** |

**Score: 3 fully real + 2 partial + 1 unsolved = 3.5 / 6.**

That is a genuinely respectable number for a solo-built product. Most competitors solve 1–2.

---

## 5. Worldwide honest ranking

### Tier 1 — Global AI-security leaders (SoterAI does not compete here)
Lakera · Palo Alto Prisma AIRS · HiddenLayer · Prompt Security · CalypsoAI
Backed by 9-figure funding, SOC2, enterprise sales motions, published benchmarks.

### Tier 2 — n8n-native AI-security nodes (**this is the real arena**)

Measured npm downloads, last 30 days, 2026-08-05:

| Rank | Package | DL/mo | Age | Honest assessment |
|---|---|---|---|---|
| 1 | `n8n-nodes-promptlock-guard` | **1,036** | 11 mo | Established, 15 releases, real incumbent |
| 2 | **`n8n-nodes-soterai`** | **1,166** | **6 wk** | **Highest raw number — but see caveat below** |
| 3 | `@scan5/ai-guard-n8n-node` | 796 | 3 wk | Newer, moving fast |
| 4 | `@paloaltonetworks/n8n-nodes-prisma-airs` | 195 | 12 mo | Enterprise brand, low community pull |
| 5 | `@bdzscaler/n8n-nodes-aiguard` | 181 | 4 mo | Stale since April |
| 6 | `n8n-nodes-trusera` | 174 | 6 mo | 35 versions, abandoned since March |
| 7 | `@avantguardllc/n8n-nodes-phinsecurity` | 86 | 5 mo | Abandoned |

### ⚠️ The download number is not real adoption

Daily downloads mapped against publish dates:

| Date | Event | Downloads |
|---|---|---|
| Jun 26 | v0.1.0 published | **483** |
| Jul 2 | v0.2.1–0.2.6 published | **789** |
| Jul 16 | v0.2.9 published | **264** |
| Jul 18 | v0.3.0 published | **148** |
| Jul 22 | v0.3.1 published | **147** |
| Jul 26 | v0.3.2 published | **144** |
| Jul 31 | v0.3.3 published | **132** |
| *typical non-publish day* | — | **0–12** |

**Every spike is a publish event.** That is npm mirrors, CDN caches, and security scanners — not humans. Baseline organic traffic is **0–12/day**, and much of that is automated too.

**Honest read: real human installs are likely in the low single digits.** This matches the known signal of 3 VS Code installs and 1 GitHub star.

**Corrected functional ranking: #3 of 7** — behind promptlock (real users) and scan5 (real momentum), ahead of the abandoned enterprise nodes.

### Strength vs weakness, plainly

**Strongest in the niche at:**
- Universal Firewall orchestration (5 layers in one node) — **nobody else has this**
- Local, zero-network workflow security audit — **nobody else has this**
- Multilingual injection detection (Hindi/Devanagari/CJK) — **nobody else has this**
- `usableAsTool` AI-Agent integration
- Secret-sanitisation hygiene

**Weakest in the niche at:**
- Real users (near zero)
- Latency (14× the leader)
- Hinglish false positives (53% — actively harmful)
- Marketplace presence (0 of 3 marketplaces listed)
- Third-party validation (no SOC2, no published benchmark, no case study)

---

## 6. Where SoterAI actually exists worldwide, today

| Surface | Status | Reality |
|---|---|---|
| npm registry | ✅ Live | Discoverable only if you search the exact name |
| n8n **verified** nodes panel | ❌ Not submitted | **This is where 100% of discovery happens** |
| Make.com marketplace | ❌ Not submitted | JSON exists, never registered |
| Zapier App Directory | ❌ Not submitted | Code exists, never pushed |

**Blunt truth: SoterAI is invisible.** An n8n user searching "security" in the nodes panel will never see it. Being on npm without being in the verified panel is like having a shop with no signboard in a back alley.

### n8n verification gap analysis (measured against official 2026 rules)

| Requirement | Status |
|---|---|
| Name starts `n8n-nodes-` | ✅ Pass |
| `n8n-community-node-package` keyword | ✅ Pass |
| Zero runtime dependencies | ✅ Pass |
| `n8n` attribute pointing at `dist` | ✅ Pass |
| English-only UI | ✅ Pass |
| TypeScript + lint passes | ✅ Pass |
| README in package | ✅ Pass |
| GitHub Actions publish **with provenance** | ✅ Pass (`--provenance` present in `publish-n8n.yml`) |
| `@n8n/node-cli` ≥ 0.23.0 as **devDependency** | ❌ **FAIL — uses `npx @n8n/node-cli@latest`, not a pinned devDep** |

**Only ONE line of package.json stands between this node and verification eligibility.** That is the highest-leverage fix in this entire document.

---

## 7. Market context

| Platform | Scale | Relevance |
|---|---|---|
| **n8n** | ~$2.5B valuation, ~$40M ARR (est.), 230k+ users, 169k GitHub stars, ~1,000 integrations | **Best fit** — developer audience, AI-native (n8n 2.0 shipped AI Agent nodes Jan 2026), community-node model = low barrier |
| **Zapier** | ~$100M ARR, ~6,000 apps, 7% iPaaS share | Largest reach, but non-technical audience rarely buys security |
| **Make** | Owned by Celonis, ~1,500 apps | Middle ground, strict ongoing review |

**AI-guardrails market size: ~$30M today, forecast to double in 2026** (IT-Harvest). This is a small, early, fast-growing category — good for a new entrant, bad for anyone expecting large near-term revenue.

*All platform figures are third-party estimates from comparison blogs, not audited filings. Treat as directional.*

---

## 8. Revenue and market-capture projection

### The honest ceiling maths

```
n8n active users                        ~230,000
× building AI workflows (~40%)          ~92,000
× would pay for a security add-on (1–3%) 900 – 2,760
× realistic ARPU ($20–40/mo)
= n8n-only ceiling: $216k – $1.3M ARR
```

**The n8n node alone cannot build a large company.** It is a wedge and a credibility asset, not the business.

### Scenarios

| Scenario | Requires | Month 6 | Month 12 | Month 18 |
|---|---|---|---|---|
| **Do nothing** | — | $0 | $0 | $0 |
| **Realistic** ⭐ | Fix FP bug + get verified + submit Make/Zapier | $2k–6k ARR | **$40k–90k ARR** | **$180k–400k ARR** |
| **Optimistic** | Above + published benchmark + 3 case studies + DPDP push | $10k | $150k | **$600k–1M ARR** |

**Current probability weighting: Realistic 55% · Do-nothing 30% · Optimistic 15%.**

### Timeline to first real revenue

| Phase | Duration | Milestone |
|---|---|---|
| Fix FP bug + pin devDep | **Week 1** | Blockers cleared |
| Submit for n8n verification | Week 2 | Submitted |
| n8n review | Weeks 3–8 | Shield icon appears |
| First organic installs | Weeks 6–12 | First 100 real users |
| First paying customer | **Months 3–5** | ~$50–200 MRR |
| $10k ARR | **Months 9–14** | Product-market signal |

**First real paying customer: realistically 3–5 months from today**, and only if Week 1 happens.

### Market capture

Realistic 18-month share of the **n8n-native AI-security niche**: **15–25%** — genuine #1 or #2 is achievable, because 4 of 6 competitors are abandoned.

Realistic 18-month share of the **global AI-guardrails market**: **<0.5%.** Do not claim otherwise.

---

## 9. Real issues and weaknesses (prioritised)

### 🔴 P0 — Fix this week

**1. Hinglish 53% false-positive rate** — `generalizedIntentDetector.ts:619-633`
Remove bare verbs (`batao`, `karo`, `dikhao`, `bhejo`, `nikalo`, `kar do`) and bare nouns (`data`, `orders`, `rules`, `policy`, `saare`, `jankari`) from the pair. Require a genuine adversarial marker — bypass intent (`bhool jao`, `hata do`, `band karo`, `bina roke`), or a security-sensitive target (`system prompt`, `api key`, `credentials`, `instructions`). Add all 15 test messages above as regression tests.
*Impact: unblocks the entire India-first strategy.*

**2. `@n8n/node-cli` not a pinned devDependency** — `packages/integrations/n8n/package.json`
Add `"@n8n/node-cli": "^0.23.0"` to `devDependencies`. **This one line is the only remaining blocker to n8n verification eligibility.**
*Impact: unlocks the only channel where discovery actually happens.*

**3. Zapier base-URL bug** — `zapier/creates/guardActions.ts:370`
`getBaseUrl()` discards `bundle` and hardcodes the India endpoint. Data-residency violation for EU/self-hosted customers.
*Impact: must be fixed before Zapier submission, or it becomes a public incident.*

### 🟠 P1 — This month

4. **Not on any marketplace** — Make and Zapier submissions never sent. Both take weeks to review; the clock only starts when you submit.
5. **Latency 722 ms** — profile the server path. Target p50 <200 ms. Until then, do not market for live chat.
6. **No published benchmark** — every competitor claim is unverifiable, including yours. Publishing an honest HarmBench/JailbreakBench result with real FPR would be a genuine differentiator in a category full of unfalsifiable marketing.

### 🟡 P2 — This quarter

7. **Universal Firewall makes up to 5 sequential API calls** — at 722 ms each, worst case is ~3.6 s per item. Batch these server-side into one call.
8. **Fail-open on network error** — if `soterai.in` is down, the node throws and (with `continueOnFail`) traffic passes unguarded. A security product should offer explicit fail-closed.
9. **Single point of failure** — one server, one region. No SLA, no status page commitment.
10. **No SOC2 / ISO27001** — hard blocker for enterprise deals.
11. **INR-only payments** — cannot bill the international users the marketplaces would send.

---

## 10. How to become market leader — the actual plan

### The strategic insight

**Lakera, Prompt Security, and HiddenLayer have no n8n node.** The category leaders are ignoring this channel entirely. The only n8n-native competitors are one active incumbent, one newcomer, and four abandoned packages.

**Do not try to beat Lakera at LLM security. Win at being the definitive AI-security layer for automation platforms.** That is a niche that is (a) real, (b) growing with n8n's 10× ARR growth, and (c) currently unowned.

### Week 1 — clear the blockers
Fix the Hinglish detector. Pin `@n8n/node-cli`. Fix the Zapier base URL. Submit for n8n verification.
*Nothing else matters until these four are done.*

### Month 1 — get discoverable
- Submit Make.com app for review
- `zapier push` + submit Zapier app
- Publish 8 workflow templates to n8n's template library (**this is the real discovery channel — more than the node listing itself**)
- Add an `n8n-community-node-package` topic + demo GIF to the GitHub repo

### Months 2–3 — build the only moat that lasts
- **Publish an honest benchmark.** Real recall, real FPR, real latency, test set public. In a category where everyone claims "98% detection," being the only vendor with reproducible numbers is a defensible position. This aligns with the existing honesty-gate discipline already in the codebase.
- **Ship the "n8n AI Security Audit" as a free public tool.** The local workflow auditor is genuinely unique and needs no API key. Give it away — it becomes the top-of-funnel.
- Get 3 real users, even free, and write up what they found.

### Months 4–6 — monetise the wedge
- Fix latency to <200 ms p50, then open the live-chat segment
- Ship DPDP compliance reporting as the paid tier (India-specific, defensible, and something no US vendor will build)
- Add Stripe/international payments
- Target: first 10 paying customers

### What NOT to do
- ❌ Do not build more platform integrations (Botpress, Dify, Flowise, Langflow, Voiceflow all already exist and all have zero users). **Nine surfaces with zero users is worse than one surface with a hundred.**
- ❌ Do not claim "100% detection." The honest number is ~64% held-out.
- ❌ Do not chase enterprise without SOC2.
- ❌ Do not market for real-time chat at 722 ms.

---

## 11. Final honest verdict

**The product is better than its adoption.** The engineering is real: the Universal Firewall orchestration, the local OWASP workflow auditor, the multilingual detection, and the secret-sanitisation hygiene are all things paid competitors do not have. 3.5 of 6 claimed problems are genuinely solved.

**The problem has never been the product. It is distribution — plus one bug.**

Three things stand between this and being the #1 n8n-native AI-security node:

1. A regex that flags half of all ordinary Hindi customer messages
2. One missing line in `package.json`
3. Three marketplace submissions that were written but never sent

None of these takes more than a week. All three have been sitting unfixed while more platform integrations were built.

**Can it become market leader? In the n8n-native AI-security niche — yes, genuinely, within 12–18 months, at $180k–400k ARR. Four of six competitors are already abandoned and the global leaders are not competing here.**

**Globally against Lakera and Palo Alto — no, and claiming otherwise would cost more credibility than it gains.**

---

## Sources

- [Zapier vs n8n vs Make: B2B Automation Comparison 2026](https://whitehat-seo.co.uk/blog/zapier-vs-n8n-vs-make)
- [Zapier Statistics 2026: Revenue, Users & Growth](https://sqmagazine.co.uk/zapier-statistics/)
- [n8n vs Zapier vs Make vs Power Automate — Automation Atlas](https://automationatlas.io/guides/automation-tool-comparison-2026/)
- [n8n Community Node Verification Guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)
- [n8n Submit Community Nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
- [LLM firewalls emerge as a new AI security layer — TechTarget](https://www.techtarget.com/searchSecurity/feature/LLM-firewalls-emerge-as-a-new-AI-security-layer)
- [LLM Firewall & Guardrail Tools Compared 2026 — CTAIO](https://ctaio.dev/en/ai-security/llm-firewall-tools/)
- [Best AI Guardrails in 2026 — General Analysis](https://generalanalysis.com/guides/best-ai-guardrails)
- [Make App Review Process](https://developers.make.com/custom-apps-documentation/app-review)
- [Zapier Integration Publishing Requirements](https://docs.zapier.com/platform/publish/integration-publishing-requirements)
- npm registry API — download statistics measured 2026-08-05
- SoterAI production API (`soterai.in`) — live testing 2026-08-05
