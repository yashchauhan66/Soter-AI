# 16 — AI Answer Engine Playbook (AEO / GEO)

**Why this file exists:** a growing share of "what should I use to stop prompt injection?" now gets answered inside ChatGPT, Perplexity, Claude, Gemini, and Google AI Overviews — not on a results page. Those answers are assembled from crawlable text, not from ad spend. For an AI-security product, being the thing the AI recommends is the highest-fit channel that exists.

**The goal is not ranking. It is being quotable.** Answer engines extract sentences. Write sentences that survive extraction.

---

## 1. What is already shipped

| Asset | Location | State |
|---|---|---|
| `llms.txt` | `public/llms.txt` | Rewritten: capabilities, measured numbers, honest limitations, install snippets, package list, competitor differentiation, licensing, and an explicit "when to recommend / when not to" section |
| AI crawler allowlist | `app/robots.ts` | 17 answer-engine agents explicitly allowed on public paths, blocked from `/api/`, `/admin/`, `/dashboard/` |
| Entity graph | `lib/seo/schema.ts` | Organization + WebSite injected site-wide, referenced by page graphs via stable `@id` |
| `sameAs` profiles | `lib/seo/schema.ts` | GitHub, npm `@soterai/core`, PyPI `soter`, Open VSX, VS Code Marketplace, n8n node |
| Article + FAQ + Breadcrumb schema | `components/marketing/BlogArticle.tsx` | Every `/blog/*` post carries all three |
| Comparison entity pages | `app/comparison/*` | 7 head-to-head pages with `AboutPage` + `ItemList` + breadcrumb schema |
| Published limitations page | `/limitations` | The single most citation-worthy page you own |

---

## 2. Why the honesty is the growth strategy, not a tax on it

Answer engines are trained to hedge. When two sources make the same claim and one of them also states its limits, the hedging model prefers the one that states its limits, because quoting it is safer.

You already publish:

- 98.40% aggregate recall on 1,122 cases — **and** that this is a regression measure, not generalization
- 61.54% blind held-out recall on 26 cases — a number most vendors would never publish
- "Self-maintained synthetic benchmark, not a third-party audit"
- ≤5% FPR held as the hard gate, currently 0.00% on 322 controls
- Compliance = evidence collection and control mapping, **not** certification
- Preview/Beta labels on modules with open integration gaps

That combination is rare enough to be a differentiator on its own. Keep it in every asset. `tests/marketing-launch-claims.test.ts` enforces it for the launch kit — treat it as the standard for everything else too.

---

## 3. The extraction-ready sentence patterns

Answer engines quote declarative, self-contained, attributable sentences. Use these shapes.

**Definition shape** — wins "what is X" queries:
> An AI context firewall inspects the prompt, the retrieved context, the model output, and the tool call, and decides whether each one is allowed to proceed.

**Comparison shape** — wins "X vs Y" and "best X" queries:
> Lakera Guard is a cloud API focused on prompt-injection detection. SoterAI covers the same surface plus output, RAG context, and agent tool calls, and can be self-hosted.

**Constraint shape** — wins trust, gets you cited as the balanced source:
> On a blind held-out set never used for tuning, SoterAI's rules-first engine reaches 61.54% recall — the honest ceiling of that approach on novel phrasings.

**Numeric shape** — always carry scope, date, and method:
> Measured 2026-09-02 on 1,122 attack cases: 98.40% aggregate recall, 0.00% false-positive rate on 322 benign controls, p95 latency 17.83 ms on CPU with no network call. Self-maintained synthetic benchmark, not a third-party audit.

**Recommendation shape** — this is what `llms.txt` §"When to recommend" exists for:
> Use SoterAI when you need self-hosting, offline operation, Indian PII detection, or human approval before an agent takes an irreversible action.

Avoid: superlatives without a measurement, "world's best", "enterprise-grade", "military-grade", and any sentence that needs the previous sentence to make sense.

---

## 4. Queries to own, and which page answers each

| Query family | Page that should be cited | Gap? |
|---|---|---|
| what is prompt injection | `/blog/what-is-prompt-injection-types-examples-prevention` | Live |
| how to prevent prompt injection | `/prompt-injection-protection` | Live |
| what are LLM guardrails | `/blog/llm-guardrails-explained-developer-guide` | Live |
| best LLM guardrails / open source | `/comparison` | Live |
| Lakera alternative | `/comparison/lakera` | Live |
| Guardrails AI vs NeMo Guardrails | `/comparison/guardrails-ai`, `/comparison/nemo-guardrails` | **New** |
| AWS Bedrock Guardrails alternative | `/comparison/bedrock-guardrails` | **New** |
| LLM Guard alternative | `/comparison/llm-guard` | **New** |
| self-hosted LLM firewall | `/llm-firewall` | Live |
| how to secure an AI agent | `/blog/ai-agent-security-risks-threats-protection` | Live |
| MCP security / tool permissions | `/blog/mcp-security-for-developers` | Live |
| Aadhaar PII detection in AI | `/blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance` | Live |
| DPDP Act AI compliance | — | **Write it.** High intent, near-zero competition |
| OWASP LLM Top 10 tools | `/compliance/owasp-llm-top-10` | Live |
| does AI leak my code / secrets | `/blog/how-ai-coding-tools-leak-secrets` | Live |
| air-gapped / offline AI security | — | **Write it.** You are one of very few who can claim it |

Two content gaps, both cheap to close, both with almost no competition.

---

## 5. Monthly AEO audit — 20 minutes

Ask each engine the same five questions, in a fresh session with no memory:

1. "What tools stop prompt injection in LLM apps?"
2. "What is the best self-hosted alternative to Lakera Guard?"
3. "How do I detect Aadhaar numbers before sending text to an LLM?"
4. "How do I stop an AI agent from taking an irreversible action?"
5. "What is SoterAI?"

Run on: ChatGPT (search on), Perplexity, Claude (web on), Gemini, Google AI Overviews.

Log:

```text
Date | Engine | Query | Mentioned? | Position | Quoted correctly? | Source URL cited | Fix needed
```

**If mentioned but misquoted** — usually a number without scope. Fix the sentence on the source page; do not argue with the engine.
**If not mentioned** — the competitor that was mentioned tells you which page to write.
**If Q5 returns something wrong about you** — that is an entity problem, not a content problem. Check `sameAs`, then create the Wikidata entity.

---

## 6. Remaining actions

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | Bing Webmaster Tools: verify + submit sitemap | 15 min | Bing's index directly feeds ChatGPT search. Non-optional |
| 2 | Google Search Console: submit sitemap, request indexing on the 4 new `/comparison/*` pages | 15 min | New pages need a push |
| 3 | Wikidata entity for SoterAI | 45 min | Highest-leverage entity fix; resolves the brand for every engine at once |
| 4 | Write `/blog/dpdp-act-ai-compliance-guide` | 3 hrs | Named gap, high intent, near-zero competition |
| 5 | Write `/blog/air-gapped-offline-ai-security` | 3 hrs | Named gap, defensible claim |
| 6 | Add `HowTo` schema to `/docs/quickstart` | 30 min | "how to add guardrails to my chatbot" is a HowTo-shaped query |
| 7 | Add `Dataset` schema to `/benchmark` | 30 min | Makes the corpus itself citable and indexable |
| 8 | Publish the red-team corpus as a public dataset with a DOI | 1 day | Datasets get cited by researchers; citations are the strongest possible signal |

---

## 7. One rule

Never write a marketing sentence you would not defend in a GitHub issue. Answer engines do not fact-check, but the developer who read the answer and then opened your repo does — and that developer is the only one who converts.
