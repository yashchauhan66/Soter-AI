# SoterAI Market Competitor Analysis — Real, Honest Ranking (2026-09-12)

> Method: every fact below comes from either (a) live vendor websites fetched
> 2026-09-12, (b) GitHub repo state fetched 2026-09-12, or (c) measurements run
> against this repo's own artifacts (see `scripts/guard-benchmark/v14-10k-attack-audit-results.json`).
> Vendor accuracy claims are MARKED AS VENDOR CLAIMS — none were independently verified.
> This report is deliberately unflattering to us. Our own tests
> (`tests/competitive-moat.test.ts`) forbid "best in market" claims; this document
> explains what the market actually looks like and where we honestly sit.

## 0. TL;DR — the one-paragraph truth

The AI-security market has consolidated: nearly every independent startup was
acquired by a platform giant in 2025–2026 (Lakera→Check Point, Prompt
Security→SentinelOne, Invariant→Snyk, Portkey→Palo Alto Prisma AIRS,
CalypsoAI→F5, Pangea→CrowdStrike, Protect AI→Palo Alto). Palo Alto Networks is
the Gartner "Company to Beat" two consecutive runs. In that landscape, SoterAI
is a **credible niche challenger, not a market leader**: it is genuinely unique
in local-first, IDE-native agent security with India-specific compliance, but it
has zero enterprise customers, zero third-party validation, no SOC integration,
and a measured 29.4% zero-shot recall on novel external attacks. Honest
overall rank: **12th of 14 scored players — tied with NVIDIA NeMo Guardrails
on points (12/25), top-3 in its specific lane** (local-first developer/IDE
agent security + India compliance). Full component scorecard in §2.1.

## 1. Market structure (what changed 2025–2026)

| Startup | Acquired by | Status today |
|---|---|---|
| Lakera | Check Point | Lakera Guard = Check Point's AI runtime engine |
| Prompt Security | SentinelOne | Agent + workforce AI security in S1 platform |
| Invariant Labs | Snyk | Guardrails/Explorer/MCP Scan folded into Snyk |
| Portkey | Palo Alto Networks | Now "Prisma AIRS AI Gateway" (GA) |
| Protect AI | Palo Alto Networks | Model scanning in Prisma AIRS; **LLM Guard archived 2026-07-09, unmaintained** |
| CalypsoAI | F5 | F5 AI Guardrails + AI Red Team |
| Pangea | CrowdStrike | Falcon Guardian (AIDR) |
| Robust Intelligence | Cisco | AI Defense model validation |

Still independent and well-funded: **HiddenLayer** ($100M Series B),
**Lasso Security** (multiple rounds), **Zenity / Aim / Noma** (smaller).

## 2. The honest ranking


### TIER S — Platform leaders (buy these if you are a Fortune 500)

**#1. Palo Alto Networks — Prisma AIRS (Protect AI + Portkey) — 23/25**
- E: strong (unified runtime + model scanning), B: broadest (discovery,
  gateway, runtime, supply chain, agents, workforce), M: SOC-grade (XSIAM,
  Cortex, DLP), V: Gartner "Company to Beat" in AI security, June 2026, second
  consecutive time — the strongest analyst signal in the market, D: cloud + on-prem edge.
- Weakness: sprawling platform, licensing complexity; prompt-level detection
  efficacy is not independently published.

**#2. Microsoft (Azure AI Foundry + Purview + Entra agent ID) — 22/25**
- Distribution is the moat: most enterprises already run M365/Copilot.
  Agent governance + content safety embedded where the agents already live.
- Weakness: Azure-centric; guardrail depth per prompt is shallower than
  specialists; content safety tuned for Big Tech policies, not your policies.

**#3. Cisco AI Defense — 21/25**
- Network-embedded runtime protection (no agents needed — genuinely unique
  enforcement point), algorithmic red teaming from Robust Intelligence,
  Splunk telemetry, NIST/MITRE ATLAS/OWASP mappings.
- Weakness: best when you already run Cisco networking; model scanning is
  shallower than HiddenLayer's.

### TIER A — Security giants with elite AI-specific tech

**#4. Check Point (Lakera) — 21/25**
- The most battle-tested prompt firewall in existence: Gandalf is played by
  1M+ hackers, so their detection is trained on real adversarial data at a
  scale nobody else has. Vendor-claims: sub-50ms latency, 0.01% production FPR,
  100+ languages. Dropbox, banking case studies.
- Weakness: cloud-API centric (data leaves your machine); agent security is
  newer than their prompt-injection core.

**#5. CrowdStrike (Pangea → Falcon Guardian) — 20/25**
- Unique capability: correlates prompts → agent actions → endpoint processes
  (prompt-to-blast-radius reconstruction). Vendor-claims: 99% detection of
  prompt attacks, ≤100ms, 200+ injection techniques.
- Weakness: endpoint-centric; requires Falcon estate; AI gateway still "coming".

**#6. Cloudflare (AI Gateway + Firewall for AI) — 20/25**
- Unbeatable for public-facing AI apps: the world's largest edge network,
  80% of top GenAI companies already route through Cloudflare. MCP server
  governance is the most mature shipping implementation.
- Weakness: you must route traffic through Cloudflare; DLP depth per
  prompt is thinner than specialists.

### TIER B — Funded independents (best-of-breed specialists)

**#7. HiddenLayer — 19/25**
- Only serious model-supply-chain player (backdoored weights, malicious
  models), patented research, US Federal + healthcare wins, $100M raised,
  AWS/Databricks alliances, Gartner/RSAC validation.
- Weakness: prompt/runtime detection less proven than Lakera's; smaller channel.

**#8. Lasso Security — 18/25**
- Intent-based detection (patents pending), LEAP CPU-based guardrails,
  vendor-claim 98.6% accuracy, 3,000+ attack types, Gartner AI Usage Control
  mention, strong agentic focus.
- Weakness: younger company, smaller customer base, claims not third-party audited.

**#9. SentinelOne (Prompt Security) — 17/25**
- Strong open-source mindshare (ps-fuzz, ClawSec), workforce + agent coverage,
  Purple AI SOC integration incoming.
- Weakness: mid-integration into S1's platform; detection efficacy claims not
  yet benchmarked publicly post-acquisition.

**#10. Snyk (Invariant Labs) — 16/25**
- Guardrails (contextual agent security), Explorer (agent observability),
  MCP Scan (widely used), developer-first distribution that fits Snyk.
- Weakness: acquisition integration is recent; runtime prompt firewall less
  mature than Lakera's.

### TIER C — Platform-native guardrails (good enough, locked in)

**#11. AWS Bedrock Guardrails — 14/25**
- Content filters (incl. prompt injection/jailbreak), denied topics, PII,
  contextual grounding, and **Automated Reasoning checks** — the only
  mathematically rigorous hallucination check on the market.
- Weakness: Bedrock-locked; you adopt it because you're on AWS, not because
  it's the best.

**#12 (tie). NVIDIA NeMo Guardrails — 12/25**
- Open source (7.1k stars, active), programmable input/output/dialog rails.
  It's a safety toolkit, not a security product — you build the guardrails.
- Weakness: DIY; no detection intel; you own the efficacy.

### TIER D — Deprecated

**#14. LLM Guard (Protect AI) — 8/25 — DO NOT ADOPT**
- Archived 2026-07-09, read-only, models unmaintained. Historically the most
  popular open-source scanner suite (~20 scanners). Its successor capability
  lives inside Palo Alto Prisma AIRS. Using it today = unpatched detectors.

### The niche challengers

**#12 (tie). SoterAI (this product) — 12/25 overall, top-3 in its lane**

Component scorecard (same E/B/M/V/D rubric as everyone else, 5 points each):

| Axis | Score | Honest evidence |
|---|---|---|
| **E — Detection efficacy** | **3.0 / 5** | Measured 2026-09-12 on 10,000 held-out attacks: 94.64% recall, 0.11% FPR, ROC-AUC 0.9997 (`v14-10k-attack-audit-results.json`). In-distribution detection is genuinely strong — comparable to specialist vendors' claims. But zero-shot on HarmBench/JailbreakBench: **29.4%** — a real production gap vendors like Lakera (Gandalf-trained) do not have. Rules tier p95 ≤ 25ms is excellent; ML tier p50 ~62ms CPU-only. |
| **B — Coverage breadth** | **3.5 / 5** | 12 deterministic detectors + 14-class ML tier + agent firewall (session/tool/memory/browser) + RAG security + MCP scanning + canary tokens + India PII. Matches or exceeds Tier B vendors on agent/RAG-specific breadth — genuinely ahead of SentinelOne-era Prompt Security there. Missing vs. Tier S/A: AI discovery/shadow-AI, model supply-chain scanning, runtime response/containment, threat intel feeds. |
| **M — Enterprise maturity** | **1.5 / 5** | No production enterprise deployments, no SLAs/support org, no SOC integration (no SIEM/SOAR export), no on-prem appliance story beyond local IDE, single maintainer. Evidence gates and reproducible benchmarks are excellent engineering discipline but are NOT market maturity. |
| **V — Market validation** | **1.0 / 5** | Zero named customers, zero analyst mentions (Gartner/Forrester), zero case studies, zero paid pilots. Every Tier S/A/B player has at least two of these; most have all. This is our weakest axis. |
| **D — Deployment flexibility** | **4.5 / 5** | The strongest axis: 100% local-first (zero egress), works offline, VS Code + n8n + browser extension + local broker, free and open. No competitor at ANY tier offers zero-egress in-IDE agent security. Only real limits: no cloud/SaaS deployment option for teams that WANT managed, and no BYO-model support beyond the broker. |
| **Total** | **12.0 / 25** | Ties NeMo Guardrails on points, but the SHAPE is opposite: NeMo is broad-but-DIY (B/M/V without efficacy), SoterAI is efficacious-and-flexible but unproven (E/D without maturity/validation). |

**Honest strengths (measured, reproducible):**
- **Local-first, in-IDE**: only product doing agent security inside VS Code
  with zero data egress — no Tier S/A competitor offers this.
- **India compliance**: Aadhaar/PAN/GSTIN/UPI/IFSC detection — genuinely
  unique; DPDP Act timing is real.
- **Breadth per dollar**: 12 deterministic detectors + 14-class ML tier +
  agent firewall + RAG security + MCP scanning, free.
- **Honest engineering culture**: reproducible benchmarks, evidence gates,
  this document.

**Honest weaknesses (also measured):**
- **Zero-shot generalization**: 29.4% recall on HarmBench/JailbreakBench
  (500 attacks, measured 2026-09-12). The v14 model knows *its* attacks,
  not new ones. Tier S/A vendors train on live adversarial data
  (Lakera's Gandalf) that we do not have.
- **No market validation**: no enterprise customers, no analyst mentions,
  no case studies, single maintainer.
- **No SOC integration**: no SIEM/SOAR export, no XDR correlation — the
  thing every Tier S/A buyer asks for first.
- **Enterprise gaps**: no SSO/SCIM-in-production evidence at scale, no
  on-prem deployment story beyond local IDE.
- **Latency**: ML tier p50 ~62ms local CPU — slower than Lakera's
  sub-50ms claim (different hardware, but buyers will compare).

### Not scored (insufficient public data)
Zenity, Aim Security, Noma (Wiz), Patronus, Guardrails AI, Rebuff — smaller or
less public evidence bases as of 2026-09-12.

### 2.1 Master scoreboard — every scored player, every axis

| # | Player | E (efficacy) | B (breadth) | M (maturity) | V (validation) | D (deploy) | Total | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | Palo Alto Prisma AIRS | 4.5 | 5.0 | 5.0 | 4.5 | 4.0 | **23.0** | S |
| 2 | Microsoft (Foundry+Purview) | 3.5 | 4.5 | 5.0 | 4.5 | 4.5 | **22.0** | S |
| 3 | Cisco AI Defense | 4.0 | 4.0 | 4.5 | 4.0 | 4.5 | **21.0** | S |
| 4 | Check Point (Lakera) | 5.0 | 3.5 | 4.0 | 4.5 | 4.0 | **21.0** | A |
| 5 | CrowdStrike (Pangea) | 4.0 | 4.0 | 4.5 | 4.0 | 3.5 | **20.0** | A |
| 6 | Cloudflare | 3.5 | 4.0 | 4.0 | 4.0 | 4.5 | **20.0** | A |
| 7 | HiddenLayer | 4.0 | 3.5 | 3.5 | 4.0 | 4.0 | **19.0** | B |
| 8 | Lasso Security | 4.5 | 3.5 | 3.0 | 3.5 | 3.5 | **18.0** | B |
| 9 | SentinelOne (Prompt Security) | 3.5 | 4.0 | 3.5 | 3.5 | 2.5 | **17.0** | B |
| 10 | Snyk (Invariant) | 3.5 | 3.5 | 3.5 | 3.5 | 2.0 | **16.0** | B |
| 11 | AWS Bedrock Guardrails | 3.0 | 2.5 | 4.5 | 3.0 | 1.0 | **14.0** | C |
| 12 | NVIDIA NeMo Guardrails | 1.5 | 3.0 | 3.5 | 3.0 | 1.0 | **12.0** | C |
| 12 | **SoterAI (us)** | **3.0** | **3.5** | **1.5** | **1.0** | **4.5** | **12.0** | challenger |
| 14 | LLM Guard (Protect AI) | 2.0 | 2.5 | 0.5 | 1.5 | 1.5 | **8.0** | D |

How to read this honestly:
- On **detection efficacy alone, SoterAI (3.0) is mid-pack** — tied with AWS
  Bedrock Guardrails and above NeMo/LLM Guard; the measured 94.64% recall /
  0.11% FPR on 10k held-out attacks is within range of funded specialists'
  public claims, but the 29.4% zero-shot number is the reason it is not higher.
- On **deployment flexibility, SoterAI (4.5) ties for #1 in the entire market**
  with Cisco, Microsoft, and Cloudflare — and is the ONLY one of them offering
  zero-egress local-first, which none of the SaaS players can.
- On **market validation (1.0) and enterprise maturity (1.5), SoterAI is
  last among scored players** — this, not detection quality, is why the
  overall rank is 12th. The gap to close is go-to-market, not engineering.

## 3. Where SoterAI can actually win (the honest strategy)

1. **The lane we already own**: local-first developer/IDE agent security for
   privacy-regulated markets (India DPDP first). No Tier S/A player will
   build a VS Code-native, zero-egress guard — it's too small for them and
   exactly right for us.
2. **Fix the measured weakness before anything else**: novel-attack recall
   (29.4%). Training on external corpora (HarmBench/JailbreakBench families)
   is the single highest-leverage fix and it's cheap.
3. **The wedge into enterprise**: SOC export (Syslog/OTEL) so SoterAI findings
   land in the buyer's existing SIEM — this is the most common "no" we would
   otherwise hear.
4. **Do not compete head-on** with Palo Alto/Check Point/CrowdStrike on
   platform breadth. Compete on: local, free, developer-native, India.

## 4. Sources (fetched 2026-09-12)

- lakera.ai (Check Point footer), prompt.security (SentinelOne header),
  invariantlabs.ai (Snyk acquisition banner), portkey.ai (Prisma AIRS GA),
  paloaltonetworks.com/ai-security (Gartner "Company to Beat"), cisco.com AI
  Defense, calypsoai.com → F5 AI Guardrails, pangea.cloud → CrowdStrike
  Falcon Guardian, hiddenlayer.com ($100M Series B), lasso.security
  (98.6% claim), cloudflare.com/ai-security, aws.amazon.com/bedrock/guardrails,
  azure.microsoft.com AI Foundry, github.com/protectai/llm-guard (archived),
  github.com/NVIDIA-NeMo/Guardrails.
- Internal measurement: `scripts/guard-benchmark/v14-10k-attack-audit-results.json`


