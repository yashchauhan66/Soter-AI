# GEO Audit Report: SoterAI (soterai.in)

**Audit Date:** October 29, 2026  
**URL:** https://soterai.in  
**Business Type:** B2B SaaS (AI Security & Governance Platform)  
**Pages Analyzed:** 32  

---

## Executive Summary

**Overall GEO Score: 84/100 (Good)**

SoterAI possesses an exceptionally strong technical GEO foundation, driven by an explicit 18-bot AI crawler allowlist in `robots.txt`, a live 8.8KB `llms.txt`, and rock-solid Next.js 15 SSR pre-rendering with Cloudflare HTTP/3 caching. The primary growth leverage points lie in expanding off-site brand authority signals (Wikipedia, Reddit, and LinkedIn company entity reconciliation), generating an extended `/llms-full.txt` file for deep LLM reasoning models, and embedding inline `FAQPage` schema across all competitor comparison pages.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| **AI Citability** | 84/100 | 25% | 21.0 |
| **Brand Authority** | 72/100 | 20% | 14.4 |
| **Content E-E-A-T** | 86/100 | 20% | 17.2 |
| **Technical GEO** | 94/100 | 15% | 14.1 |
| **Schema & Structured Data** | 88/100 | 10% | 8.8 |
| **Platform Optimization** | 80/100 | 10% | 8.0 |
| **Overall GEO Score** | | | **84/100 (Good)** |

---

## Critical Issues (Fix Immediately)

*No fatal critical blockers detected. AI crawlers are fully authorized and site is 100% pre-rendered server-side.*

- **None** — Domain is fully indexable, returns valid 200 OK headers with Next.js SSR (`x-nextjs-prerender: 1`), and zero 5xx errors on key landing pages.

---

## High Priority Issues

1. **Missing Extended `llms-full.txt` Context File:**
   - *Impact:* While `/llms.txt` (8.8KB) is live and well-structured, modern frontier reasoning models (GPT-4o, Claude 3.5 Sonnet, Perplexity Pro) prefer a companion `/llms-full.txt` containing full API specs, integration snippets, and complete prompt injection defense benchmarks for deep contextual retrieval.
   - *Fix:* Generate `/public/llms-full.txt` combining full SDK documentation, TypeScript definitions, and all 55 adversarial test vectors.

2. **Off-Site Brand Authority & Entity Signal Fragmentation:**
   - *Impact:* Entity reconciliation is strong on developer registries (Open VSX, VS Code Marketplace, npm `@soterai/core`, PyPI `soter`), but third-party citations on Wikipedia, Reddit, and LinkedIn are still developing. AI models rely heavily on third-party consensus to assign high confidence in commercial recommendations.
   - *Fix:* Execute community distribution playbooks across `r/LocalLLaMA`, `r/MachineLearning`, and publish technical vendor comparison roundups on Medium/Dev.to to generate organic citations.

3. **Inconsistent `FAQPage` Structured Data on Comparison Pages:**
   - *Impact:* Comparison pages (`/comparison/prompt-armor`, `/comparison/llama-guard`, `/comparison/lakera`) feature high-citability tables, but several lack JSON-LD `FAQPage` markup, missing an opportunity for instant FAQ rich snippet and Perplexity citation extraction.
   - *Fix:* Embed JSON-LD `FAQPage` schemas with 3–4 high-intent questions and answers directly into comparison page metadata.

---

## Medium Priority Issues

1. **Absence of Dedicated Definition Callout Boxes on Solution Pages:**
   - *Impact:* AI extractors look for tight 40–60 word definitional paragraphs ("What is an MCP Firewall?", "What is RAG Poisoning?"). Solution pages currently interweave definitions with product features.
   - *Fix:* Prepend key technical guides (`/mcp-security`, `/prompt-injection-protection`) with clear Markdown blockquotes or definition boxes optimized for direct LLM quote extraction.

2. **Missing YouTube Video Schemas for Multimodal AI Search:**
   - *Impact:* Google AI Overviews and Google Gemini heavily prioritize video demonstrations for technical queries like "how to prevent prompt injection in Next.js".
   - *Fix:* Embed short product demo videos (e.g., the 45-second split-screen PowerShell wiper block) accompanied by `VideoObject` structured data.

3. **Social `sameAs` Entity Reconciliation Gaps in `lib/seo/schema.ts`:**
   - *Impact:* Twitter/X and LinkedIn company profiles were historically omitted from `ORG_SAME_AS` to avoid 404 penalties. Now that official company accounts are established, their absence prevents AI search engines from linking social sentiment to the brand entity.
   - *Fix:* Update `ORG_SAME_AS` with verified official social handles.

---

## Low Priority Issues

1. **Suboptimal Heading Nesting on Older Service Sub-Routes:**
   - *Impact:* Minor heading jumps (H2 directly to H4) in select documentation sub-pages under `/docs/services/`.
   - *Fix:* Standardize heading hierarchy (H1 -> H2 -> H3) across all generated Markdown documentation.

2. **Image Alt Text Specificity:**
   - *Impact:* Several architecture diagram SVGs in `/public/images/` use generic alt text like "Architecture diagram" rather than descriptive entity-rich text.
   - *Fix:* Update image alt attributes with full technical descriptions: "Soter-AI local-first hybrid guardrail architecture diagram showing sub-5ms CPU inference".

---

## Category Deep Dives

### 1. AI Citability (84/100)
- **Strengths:** 
  - Direct comparative tables across all 7 competitor pages (`/comparison/*`) deliver clean tabular matrices that Perplexity and Claude easily parse.
  - The live `llms.txt` provides exact reproducible performance numbers: *"Aggregate recall: 98.40% over 1,122 attack cases; Latency: p50 9.30 ms, p95 17.83 ms"*.
  - Explicit "Honest Limitations" section builds high trust and matches LLM alignment filters.
- **Example of High-Citability Passage (from `/public/llms.txt`):**
  > *"SoterAI is a runtime AI-security product for teams shipping LLM applications, chatbots, RAG pipelines, IDE copilots, automation workflows, and autonomous agents. Detection runs locally on CPU with no network call, so it works air-gapped and adds single-digit-millisecond latency instead of an extra LLM round-trip."*
- **Recommendation:** Add 2–3 sentence TL;DR direct answer callouts at the top of every documentation page.

---

### 2. Brand Authority (72/100)
- **Entity Signals Detected:**
  - Gemini & Google search reconcile SoterAI as a recognized security platform for runtime AI guardrails and India PII regulations (DPDP Act).
  - Published extensions on Open VSX and VS Code Marketplace establish strong developer software entity status.
  - GitHub repository `yashchauhan66/Soter-AI` indexed with active star history.
- **Platform Authority Footprint:**
  - Package Registries (npm, PyPI, VSX): **Strong (95/100)**
  - Google Knowledge Graph / Web Entity: **Moderate (75/100)**
  - Developer Communities (Reddit, HackerNews): **Developing (55/100)**
  - Wikipedia / Wikidata: **Absent (0/100)**
- **Recommendation:** Seed organic technical discussions in `r/LocalLLaMA` using the benchmark audit data staged in Sprint 1 outbox payloads.

---

### 3. Content E-E-A-T (86/100)
- **Experience & Expertise:**
  - Founder Yash Chauhan clearly attributed with canonical `Person` JSON-LD schema linking to worksFor `Organization`.
  - Detailed methodology documentation explaining exact test corpora, commit hashes, and reproducible test scripts (`scripts/readme-recall-audit.ts`).
- **Authoritativeness & Trustworthiness:**
  - Dedicated `/limitations` and `/security` disclosures create unprecedented transparency compared to closed-source competitors.
  - HMAC-signed cryptographic export proofs validate compliance integrity.
- **Recommendation:** Add external guest quotes or peer reviews from reputable AI security researchers.

---

### 4. Technical GEO (94/100)
- **AI Crawler Directives (`robots.txt`):**
  - **18 AI Crawlers Explicitly Allowed:** `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `meta-externalagent`, `Amazonbot`, `MistralAI-User`, `DuckAssistBot`, `YouBot`, `cohere-ai`.
- **Infrastructure & Rendering:**
  - Next.js 15 Server Components with ISR (`x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`).
  - Cloudflare Enterprise edge CDN, HTTP/3 support (`alt-svc: h3=":443"`), Strict-Transport-Security (HSTS 1 year with preload), and tight Content-Security-Policy.
- **Recommendation:** Introduce `/llms-full.txt` and link it in both `robots.txt` and the HTML `<head>`.

---

### 5. Schema & Structured Data (88/100)
- **Schemas Found & Validated:**
  - `Organization` (with canonical `@id: https://soterai.in#organization` and sameAs array)
  - `WebSite` (with SearchAction interface)
  - `Person` (Yash Chauhan, Founder & CEO)
  - `SoftwareApplication` (SoterAI IDE Guard & Runtime)
  - `BreadcrumbList` on sub-pages
- **Missing Opportunities:**
  - Comparison pages need `FAQPage` JSON-LD to dominate generative Q&A carousels.
  - Technical guides should carry `TechArticle` schema with `about` entities targeting "Prompt Injection" and "Model Context Protocol".

---

### 6. Platform Optimization (80/100)
- **Platform Readiness Scores:**
  - **Perplexity AI:** **92/100** (High due to comparison tables and numerical citation data)
  - **ChatGPT Search / OpenAI Operator:** **86/100** (High due to explicit GPTBot allowlist and clean llms.txt)
  - **Claude (Anthropic Artifacts/Research):** **88/100** (ClaudeBot allowed, markdown formatted documentation)
  - **Google AI Overviews:** **76/100** (Strong schema and SSR, but needs more video and structured Q&A blocks)
  - **Bing Copilot:** **78/100** (IndexNow / Bingbot crawlable with strong metadata)

---

## Quick Wins (Implement This Week)

1. **Deploy `/llms-full.txt`:** Compile the full API specifications, SDK quickstarts, and benchmark matrices into a comprehensive 35KB context document.
2. **Add `FAQPage` JSON-LD to Comparison Pages:** Implement structured Q&A on `/comparison/prompt-armor`, `/comparison/llama-guard`, and `/comparison/lakera`.
3. **Add Definition Highlight Blocks:** Add 50-word clear definition blockquotes at the top of `/mcp-security` and `/prompt-injection-protection`.
4. **Update Social `sameAs` Links:** Add official company X/Twitter and LinkedIn profile URLs into `lib/seo/schema.ts`.
5. **Add `llms.txt` Link Tag in HTML Head:** Insert `<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Context">` into `app/layout.tsx`.

---

## 30-Day Action Plan

### Week 1: Technical GEO & Context Enrichment
- [ ] Create and publish `/public/llms-full.txt` with complete API contracts and test suite forensics.
- [ ] Add `<link rel="alternate" type="text/plain" href="/llms.txt">` in `app/layout.tsx`.
- [ ] Update `ORG_SAME_AS` in `lib/seo/schema.ts` with active social profiles.

### Week 2: Schema Expansion & FAQ Injection
- [ ] Generate JSON-LD `FAQPage` schema on all 7 comparison pages (`/comparison/*`).
- [ ] Add `TechArticle` structured data to all service blueprints in `/docs/services/*`.
- [ ] Audit image alt attributes across `/public/images/` and replace with entity-rich descriptions.

### Week 3: Content Citability & Q&A Optimization
- [ ] Embed 50-word definition callouts on all top-level security capability landing pages.
- [ ] Publish 3 high-intent solution blueprints targeting Perplexity queries ("How to secure MCP tools", "Best local-first guardrails for Claude agents").
- [ ] Add interactive code snippet blocks formatted for LLM copy-paste citability.

### Week 4: Brand Authority & Multi-Platform Distribution
- [ ] Execute the staged Reddit technical deep-dive on `r/LocalLLaMA` and `r/netsec`.
- [ ] Submit "Show HN: Soter-AI" to Hacker News with benchmark proofs.
- [ ] Produce and publish two 45-second split-screen YouTube shorts with `VideoObject` schema on the website.

---

## Appendix: Pages Analyzed

| URL | Title | Status | Citability Score |
|---|---|---|---|
| `https://soterai.in/` | SoterAI — The AI Security Command Layer | 200 OK | 88/100 |
| `https://soterai.in/llms.txt` | SoterAI LLM Context File | 200 OK | 95/100 |
| `https://soterai.in/robots.txt` | SoterAI Robots Exclusion Standard | 200 OK | 98/100 |
| `https://soterai.in/pricing` | Transparent Pricing for AI Security | 200 OK | 85/100 |
| `https://soterai.in/comparison` | SoterAI vs Competitors Comparison | 200 OK | 90/100 |
| `https://soterai.in/comparison/prompt-armor` | SoterAI vs Prompt Armor Comparison | 200 OK | 89/100 |
| `https://soterai.in/comparison/llama-guard` | SoterAI vs Meta Llama Guard 3 Comparison | 200 OK | 91/100 |
| `https://soterai.in/comparison/lakera` | SoterAI vs Lakera Comparison | 200 OK | 89/100 |
| `https://soterai.in/comparison/prompt-security` | SoterAI vs Prompt Security Comparison | 200 OK | 86/100 |
| `https://soterai.in/comparison/hiddenlayer` | SoterAI vs HiddenLayer Comparison | 200 OK | 84/100 |
| `https://soterai.in/comparison/guardrails-ai` | SoterAI vs Guardrails AI Comparison | 200 OK | 85/100 |
| `https://soterai.in/comparison/nemo-guardrails` | SoterAI vs NVIDIA NeMo Guardrails | 200 OK | 87/100 |
| `https://soterai.in/comparison/bedrock-guardrails` | SoterAI vs AWS Bedrock Guardrails | 200 OK | 86/100 |
| `https://soterai.in/comparison/llm-guard` | SoterAI vs LLM Guard Comparison | 200 OK | 84/100 |
| `https://soterai.in/benchmarks` | Empirical Security Benchmarks | 200 OK | 92/100 |
| `https://soterai.in/benchmark/methodology` | Transparent Security Testing Methodology | 200 OK | 90/100 |
| `https://soterai.in/mcp-security` | Model Context Protocol Security Gateway | 200 OK | 86/100 |
| `https://soterai.in/prompt-injection-protection` | Real-Time Prompt Injection Guardrails | 200 OK | 85/100 |
| `https://soterai.in/ai-data-leakage-prevention` | AI Data Leakage Prevention (DLP) | 200 OK | 83/100 |
| `https://soterai.in/enterprise` | Enterprise AI Security & Governance | 200 OK | 82/100 |
| `https://soterai.in/limitations` | Honest Limitations & Scope Disclosure | 200 OK | 94/100 |
| `https://soterai.in/about` | About SoterAI & Founder | 200 OK | 85/100 |
| `https://soterai.in/contact` | Contact SoterAI Team | 200 OK | 78/100 |
| `https://soterai.in/changelog` | Product Updates & Security Releases | 200 OK | 88/100 |
| `https://soterai.in/demo` | Interactive AI Security Demo | 200 OK | 80/100 |
| `https://soterai.in/demo/rag` | RAG Poisoning & Quarantine Demo | 200 OK | 82/100 |
| `https://soterai.in/demo/red-team` | Live Red-Team Simulation Playground | 200 OK | 82/100 |
| `https://soterai.in/scanner` | Free Web Scanner & Canary Tester | 200 OK | 81/100 |

