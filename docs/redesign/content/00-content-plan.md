# Content plan: soterai.in, 12 weeks from 2026-11-16

Written 2026-11-09. Status: plan, not published. The five drafts are in `drafts/`. The ten briefs for posts 6 to 15 are in `briefs/briefs.md`. The index and the list of open items are in `README.md`.

## 1. What this plan rests on, and what it does not

- **Read on 2026-11-09:** `lib/sa/claims.ts`, `lib/sa/presets.ts`, `public/llms.txt`, `public/llms-full.txt`, `lib/blog/posts.ts`, `app/limitations/page.tsx`, `lib/seo/schema.ts`, the five drafts, and the route list under `app/`.
- **Numbers:** only the figures in `lib/sa/claims.ts` or a cited repo file. The approved set is printed at the top of the briefs file.
- **Baseline: UNKNOWN.** No Search Console or Cloudflare numbers were available to this plan. No traffic, ranking, search volume or conversion figure appears anywhere in these files, and every KPI below is a method for reading data, not a target.
- **Search volumes: UNVERIFIED.** No keyword tool was used. Every target query is a hypothesis.
- **Competitors:** the plan evaluates none. Facts about other projects live in the briefs' source register, with URL and fetch date.
- **Offer:** global audience, Free plan works anywhere, paid plans are priced in INR, international billing is not available yet. Every call to action points to the playground or the Free plan. No post shows a price in another currency.
- **Cap:** at most 18 posts. Fifteen are planned. Posts 16 to 18 stay unplanned until week 12, when Search Console data can pick them.

## 2. Pillars, clusters and hubs

### 2.1 Pillars

| Pillar | What it owns | Hub pages (all exist) | Published posts | Planned posts |
|---|---|---|---|---|
| 1. LLM firewall and AI guardrails | The category, how to choose, guard-call patterns for frameworks | `/llm-firewall`, `/llm-security`, `/comparison` | `what-is-ai-context-firewall`, `llm-guardrails-explained-developer-guide` | 6, 11, 12, 15 |
| 2. Prompt injection | Direct and indirect injection, jailbreaks, multilingual text, poisoned documents | `/prompt-injection-protection`, `/jailbreak-detection`, `/rag-security` | `what-is-prompt-injection-types-examples-prevention` | 2, 7, 8 |
| 3. Data leakage and PII | Secrets, personal data, Indian identifiers, coding assistants | `/ai-data-leakage-prevention`, `/ai-security-india` | `how-ai-coding-tools-leak-secrets`, `pii-detection-indian-businesses-aadhaar-pan-gstin-compliance`, `ai-security-best-practices-indian-enterprises-2026` | 3, 9, 13, 14 |
| 4. Agent and MCP security | MCP tools, agents, automation workflows | `/ai-agent-security`, `/mcp-security`, `/ai-workflow-security` | `mcp-security-for-developers`, `ai-agent-security-risks-threats-protection` | 4, 5 |
| 5. Evidence and benchmarks | Numbers with their method and limits, framework mappings | `/benchmarks`, `/benchmark/methodology`, `/limitations`, `/compliance/owasp-llm-top-10` | none | 1, 10 |

### 2.2 Keyword clusters mapped to a pillar and an existing hub

Cluster numbers match the `cluster` field in the drafts: 1 Category, 2 Problem, 3 India, 4 Comparison, 5 Dev how-to. Every volume is UNVERIFIED.

| ID | Cluster | Target and secondary queries | Pillar | Hub URL | Posts |
|---|---|---|---|---|---|
| 1a | Category: LLM firewall | "what is an llm firewall", "llm firewall vs prompt filter" | 1 | `/llm-firewall` | 6 |
| 1b | Category: AI guardrails | "open source llm guardrails", "llm guard alternatives" | 1 | `/comparison` | 11 |
| 1c | Category: MCP security | "mcp tool poisoning", "mcp security" | 4 | `/mcp-security` | 5 |
| 2a | Problem: prompt injection detection | "prompt injection benchmark", "multilingual prompt injection detection", "hinglish prompt injection" | 2 (post 1 is filed under 5) | `/prompt-injection-protection` | 1, 2 |
| 2b | Problem: jailbreak | "jailbreak detection", "detect dan prompt" | 2 | `/jailbreak-detection` | 7 |
| 2c | Problem: RAG poisoning | "rag poisoning", "indirect prompt injection rag" | 2 (secondary 4) | `/rag-security` | 8 |
| 2d | Problem: OWASP LLM Top 10 | "owasp llm top 10 mitigation" | 5 (secondary 1) | `/compliance/owasp-llm-top-10` | 10 |
| 3a | India: Aadhaar and PAN redaction | "aadhaar number redaction", "aadhaar verhoeff checksum validation" | 3 | `/ai-security-india` | 9 |
| 3b | India: DPDP and AI prompts | "dpdp act ai", "dpdp act chatgpt personal data" | 3 | `/ai-security-india` | 13 |
| 4a | Comparison: buyer's guide | "how to choose an llm firewall", "llm firewall buyer's guide" | 1 (secondary 5) | `/comparison` | 15 |
| 5a | Dev how-to: workflows | "secure n8n ai workflow", "n8n prompt injection" | 4 | `/ai-workflow-security` | 4 |
| 5b | Dev how-to: coding assistants | "prevent ai coding assistant leaking api keys", "cursorignore", "copilot content exclusion" | 3 | `/ai-data-leakage-prevention` | 3, 14 |
| 5c | Dev how-to: LangChain | "langchain prompt injection protection", "langchain guardrails" | 1 | `/llm-firewall` | 12 |

### 2.3 Overlap check against the eight published posts

| Post | Closest published post | How the new post differs |
|---|---|---|
| 1 | `what-is-prompt-injection-types-examples-prevention` | That post explains types. Post 1 reports four measured numbers with scripts. |
| 2 | same | That post has a multilingual section. Post 2 is a raw smoke test with a script and its failures. |
| 3 | `how-ai-coding-tools-leak-secrets` | That post says where leaks happen and gives a checklist. Post 3 is code and captured output. |
| 4 | `ai-agent-security-risks-threats-protection` | No published post covers n8n. Post 4 wires one node. |
| 5 | `mcp-security-for-developers` | That post covers permissions and review. Post 5 reproduces one attack and ships a pin-and-scan script. |
| 6 | `what-is-ai-context-firewall`, `llm-guardrails-explained-developer-guide` | Those define terms. Post 6 runs a naive filter and the engine on the same inputs. |
| 7 | `what-is-prompt-injection-types-examples-prevention` | That post names jailbreak types. Post 7 lists misses from a test written by outsiders. |
| 8 | same (RAG poisoning section) | Post 8 builds a toy RAG and shows the two-stage case. |
| 9 | `pii-detection-indian-businesses-aadhaar-pan-gstin-compliance` | That post lists identifiers and law. Post 9 covers checksum math and live gaps. |
| 10 | `/compliance/owasp-llm-top-10` (a page, not a post) | The page is a short list. Post 10 gives a test or script per row and says where none exists. |
| 11 | `llm-guardrails-explained-developer-guide` | That post explains types. Post 11 is a cited facts table. |
| 12 | none | First LangChain post. |
| 13 | `ai-security-best-practices-indian-enterprises-2026`, `pii-detection-indian-businesses-aadhaar-pan-gstin-compliance` | Read both before drafting. Post 13 is a worksheet of engineering controls built on the primary legal text. |
| 14 | `how-ai-coding-tools-leak-secrets`, post 3 | Post 14 is about scope controls and a canary experiment. No code overlap with post 3. |
| 15 | `/comparison` (a page) | `/comparison` is a vendor matrix. Post 15 is a method for the reader's own trial and scores no vendor. |

## 3. Post key

| # | Slug | Working title | Status |
|---|---|---|---|
| 1 | `prompt-injection-benchmark-honest-numbers` | Our 100% Benchmark Is Not the Number to Trust | Draft in `drafts/` |
| 2 | `prompt-injection-hinglish-multilingual-smoke-test` | Hinglish and 9 Other Languages: A Smoke Test | Draft |
| 3 | `keep-api-keys-out-of-ai-coding-prompts` | Keep API Keys Out of AI Coding Prompts | Draft |
| 4 | `secure-n8n-ai-workflow-guard-node` | Secure an n8n AI Workflow With a Guard Node | Draft |
| 5 | `mcp-tool-poisoning-reproducible-example` | MCP Tool Poisoning: A Reproducible Example | Draft |
| 6 | `llm-firewall-vs-prompt-filter` | LLM Firewall vs Prompt Filter: What Differs | Brief |
| 7 | `jailbreak-detection-what-a-filter-misses` | Jailbreak Detection: What a Filter Misses | Brief |
| 8 | `rag-poisoning-reproducible-example` | RAG Poisoning: A Reproducible Example | Brief |
| 9 | `aadhaar-redaction-why-checksum-matters` | Aadhaar Redaction: Why the Checksum Matters | Brief |
| 10 | `owasp-llm-top-10-what-a-guard-covers` | OWASP LLM Top 10: What a Guard Can Cover | Brief |
| 11 | `open-source-llm-guardrails-compared` | Open-Source LLM Guardrails Compared | Brief |
| 12 | `protect-langchain-app-with-a-guard-call` | Protect a LangChain App With a Guard Call | Brief |
| 13 | `dpdp-ai-prompts-what-a-team-can-do` | DPDP and AI Prompts: What a Team Can Do | Brief |
| 14 | `scope-what-cursor-and-copilot-can-read` | Scope What Cursor and Copilot Can Read | Brief |
| 15 | `how-to-choose-an-llm-firewall-buyer-checklist` | How to Choose an LLM Firewall: Buyer Checklist | Brief |

## 4. Twelve-week calendar

Week 1 starts Monday 2026-11-16, one week after this plan, so the blockers in 4.2 have time to clear. Publish days are Tuesday and, in two-post weeks, Thursday. All dates are proposals.

Target queries are hypotheses. Volume is UNVERIFIED for every row. Founder hours are estimates by the plan's author, not measurements. Revise them after posts 1 and 2. Metric IDs (M1 to M5) are defined in section 7.

| Wk | Publish day | Post | Cluster | Target query (volume UNVERIFIED) | Format | Hours | Repo assets used | Links in and out | Success metric |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Tue 2026-11-17 | 1. Our 100% Benchmark Is Not the Number to Trust | 2a | "prompt injection benchmark" | Evidence report with re-runnable scripts | 4 | `lib/sa/claims.ts`, `benchmarks/results/latest.md`, `scripts/readme-recall-audit.ts`, `run.mjs --self-test`, `baseline-local-2026-08-27.json`, `honest-results.json` | In: `/benchmarks`, `/benchmark/methodology`, `/limitations`, `/prompt-injection-protection`. Out: same four plus the prompt injection explainer | M1, M2 on the target query. M3 via `?preset=injection`. M4 to `/benchmarks` |
| 2 | Tue 2026-11-24 | 2. Hinglish and 9 Other Languages: A Smoke Test | 2a | "multilingual prompt injection detection" | Reproducible test with script | 5 | `LANGUAGE_PRESETS`, preset `hinglish`, `readme-recall-audit.ts`, `tests/guard/hinglish-benign-commerce.test.ts` | In: `/jailbreak-detection`, `/ai-security-india`, post 1. Out: `/jailbreak-detection`, `/ai-security-india`, explainer, `/limitations`, post 1 | M1, M2. M3 via `?preset=hinglish`. M4 to `/ai-security-india` |
| 3 | Tue 2026-12-01 | 3. Keep API Keys Out of AI Coding Prompts | 5b | "prevent ai coding assistant leaking api keys" | How-to with code | 4 | `packages/soter-pii`, `guard-prompt.mjs`, preset `api-key`, IDE Guard README and `README-CLAIMS.md` | In: leak-secrets post, `/ai-data-leakage-prevention`, `/extensions/ide`. Out: leak-secrets post, `/extensions/ide`, `/vscode-ai-security`, `/cursor-ai-security`, `/ai-data-leakage-prevention` | M1, M2. M3 via `?preset=api-key`. M4 to `/extensions/ide` |
| 4 | Tue 2026-12-08 | 4. Secure an n8n AI Workflow With a Guard Node | 5a | "secure n8n ai workflow" | How-to with workflow JSON | 6 | `packages/integrations/n8n` README and example workflow, preset `injection` | In: `/integrations/n8n`, `/ai-workflow-security`. Out: `/integrations/n8n`, `/ai-workflow-security`, `/ai-agent-security`, `/limitations`, post 1 | M1, M2. M4 to `/integrations/n8n`. M5 from the n8n community, if any |
| 5 | Tue 2026-12-15 | 5. MCP Tool Poisoning: A Reproducible Example | 1c | "mcp tool poisoning" | Reproducible walkthrough with script | 4 | `tests/guard/mcp-and-memory-poisoning.test.ts`, `mcp-poisoning-obfuscation.test.ts`, presets `mcp-poisoning`, `tool-call`, `tool-gate.mjs` | In: `/mcp-security`, MCP explainer, `/ai-agent-security`. Out: `/mcp-security`, MCP explainer, `/ai-agent-security`, `/extensions/ide`, post 4 | M1, M2. M3 via `?preset=mcp-poisoning`. M4 to `/mcp-security` |
| 6 | Tue 2026-12-22 | 6. LLM Firewall vs Prompt Filter: What Differs | 1a | "what is an llm firewall" | Explainer with a test | 8 | Benchmark harness and adapters, 3,200-case corpus, preset `obfuscation` | In: `/llm-firewall`, context-firewall post, guardrails post. Out: `/llm-firewall`, those two posts, post 1, `/benchmarks` | M1, M2. M4 to `/llm-firewall` |
| 7 | Tue 2026-12-29 | 7. Jailbreak Detection: What a Filter Misses | 2b | "jailbreak detection" | Test report | 10 | `jailbreakExpanded.ts`, `heldoutBlindWide.ts`, presets `jailbreak-dan`, `obfuscation`, `hinglish` | In: `/jailbreak-detection`, `/prompt-injection-protection`, posts 1 and 2. Out: those pages, explainer, posts 1 and 2 | M1, M2. M3 via `?preset=jailbreak-dan`. M4 to `/jailbreak-detection` |
| 8 | Tue 2027-01-05 | 8. RAG Poisoning: A Reproducible Example | 2c | "rag poisoning" | Reproducible walkthrough | 9 | `ragPoisoningExpanded.ts`, `echoleak-killchain.test.ts`, preset `rag-poisoning` | In: `/rag-security`, `/docs/rag`, post 5. Out: `/rag-security`, `/docs/rag`, explainer, post 5, `/prompt-injection-protection` | M1, M2. M3 via `?preset=rag-poisoning`. M4 to `/rag-security` |
| 8 | Thu 2027-01-07 | 9. Aadhaar Redaction: Why the Checksum Matters | 3a | "aadhaar number redaction" | Explainer with code and live results | 10 | `packages/soter-pii`, `indiaPiiDetector.ts`, preset `aadhaar-pan` | In: `/ai-security-india`, PII post, post 3. Out: `/ai-security-india`, PII post, `/ai-data-leakage-prevention`, post 3, `/limitations` | M1, M2. M3 via `?preset=aadhaar-pan`. M4 to `/ai-security-india` |
| 9 | Tue 2027-01-12 | 10. OWASP LLM Top 10: What a Guard Can Cover | 2d | "owasp llm top 10 mitigation" | Mapped table and checklist | 10 | Eight presets, `tests/guard/` files per row, `lib/compliance/` mapping files (audit only) | In: `/compliance/owasp-llm-top-10`, `/trust`. Out: that page, three problem hubs, posts 5, 7, 8 | M1, M2. M4 to `/compliance/owasp-llm-top-10`. M5 |
| 10 | Tue 2027-01-19 | 11. Open-Source LLM Guardrails Compared | 1b | "open source llm guardrails" | Cited-facts comparison | 12 | Harness adapter pattern, source register S1 to S6 | In: `/comparison`, guardrails post. Out: `/comparison`, guardrails post, `/llm-firewall`, post 6, `/benchmarks` | M1, M2. M4 to `/comparison`. M5 |
| 10 | Thu 2027-01-21 | 12. Protect a LangChain App With a Guard Call | 5c | "langchain prompt injection protection" | How-to with code | 9 | `packages/langchain-middleware`, `packages/sdk`, `packages/python-sdk` | In: `/docs/quickstart`, `/docs/js`, `/docs/python`, `/ai-platform-security`. Out: same four plus `/llm-firewall` | M1, M2. M4 to `/docs/quickstart` |
| 11 | Tue 2027-01-26 | 13. DPDP and AI Prompts: What a Team Can Do | 3b | "dpdp act ai" | Practical guide with worksheet | 12 | `/docs/services/audit-exports`, `/data-retention`, `/subprocessors`, preset `personal-data` | In: `/ai-security-india`, India posts. Out: `/ai-security-india`, PII post, best-practices post, post 9, `/trust` | M1, M2. M4 to `/ai-security-india` |
| 12 | Tue 2027-02-02 | 14. Scope What Cursor and Copilot Can Read | 5b | "cursorignore" | How-to with an experiment | 10 | IDE Guard commands, `README-CLAIMS.md`, vendor docs S11 and S12 | In: leak-secrets post, `/cursor-ai-security`, `/vscode-ai-security`, post 3. Out: `/ai-data-leakage-prevention`, leak-secrets post, `/extensions/ide`, `/cursor-ai-security`, post 3 | M1, M2. M4 to `/extensions/ide` |
| 12 | Thu 2027-02-04 | 15. How to Choose an LLM Firewall: Buyer Checklist | 4a | "how to choose an llm firewall" | Checklist | 8 | `NUMBERS_WITH_LIMITS`, `public/llms.txt` limitations | In: `/comparison`, `/pricing`, posts 1, 6, 11. Out: `/comparison`, `/benchmarks`, `/limitations`, posts 1 and 6 | M1, M2. M4 to `/pricing` and `/playground` |

### 4.1 Founder hours per week (estimates)

| Week | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hours | 4 | 5 | 4 | 6 | 4 | 8 | 10 | 19 | 10 | 21 | 12 | 18 | 121 |

Weeks 8, 10 and 12 carry two posts and exceed 15 hours. Pre-write one of the two during the lighter weeks before, or move the second post to the next week. The free tools in section 6 are not in these totals. Counsel review for post 13 is not in them either.

### 4.2 Ship blockers for weeks 1 to 5

These come from each draft's `verification_notes`. The five posts are independent, so a blocked post can swap places with a later one.

| Post | Blocker |
|---|---|
| 1 | Run `scripts/phase-9-run-public-benchmark.js` and `npm run benchmark:honest` on a clean checkout and confirm 100.00% and 98.15% with 0.81%. List the 9 benign inputs the honest run flagged. Put the honest-run figures in `lib/sa/claims.ts`, or cite the JSON file. |
| 2 | Decide what to do about the product finding: a harmless sentence returned HUMAN_REVIEW at risk 0 in Portuguese, Russian, Chinese and Arabic. Get native-speaker review of the PT, RU, ZH, JA, AR and HI sentences, then re-run. If this slips, publish post 2 last of the five. |
| 3 | Install `soter-pii` from npm in a scratch folder and re-run `preflight.cjs`. The authenticated `/api/guard/input` call was never run. The docs page lists decision values that differ from the route's action values. |
| 4 | No n8n instance was run. Import the example workflow, run it, and replace the response-shape text with captured output. Confirm version 0.8.7 or 0.8.8. Re-measure the Local-mode recall figure. |
| 5 | Confirm the year of the Invariant Labs post. Decide what to do about HUMAN_REVIEW on benign tool descriptions. Re-run `tool-gate.mjs`. |

## 5. Internal-linking plan for the first 15 posts

Each post carries 3 to 5 editorial links with descriptive anchors. Utility links (a playground preset, `/limitations`, definitions) come on top. Links to posts that are not yet live go in only after those posts publish. In the table, "post N" means the planned URL `/blog/<slug>` from the post key.

### 5.1 Links out

| Post | Editorial links (anchor -> target) | Utility links |
|---|---|---|
| 1 | "benchmark results and methodology" -> /benchmarks; "how these numbers are measured" -> /benchmark/methodology; "prompt injection protection" -> /prompt-injection-protection; "what prompt injection is and how it works" -> /blog/what-is-prompt-injection-types-examples-prevention; "published limitations" -> /limitations | /playground?preset=injection |
| 2 | "jailbreak detection" -> /jailbreak-detection; "AI security for Indian identifiers and Hinglish text" -> /ai-security-india; "what prompt injection is, with multilingual examples" -> /blog/what-is-prompt-injection-types-examples-prevention; "published limitations" -> /limitations; add on publish: "four recall numbers" -> post 1 | /playground?preset=hinglish |
| 3 | "how AI coding tools leak secrets" -> /blog/how-ai-coding-tools-leak-secrets; "SoterAI IDE Guard" -> /extensions/ide; "VS Code AI security" -> /vscode-ai-security; "Cursor AI security" -> /cursor-ai-security; "AI data leakage prevention" -> /ai-data-leakage-prevention | /docs/rest-api, /playground?preset=api-key |
| 4 | "n8n integration page" -> /integrations/n8n; "AI workflow security" -> /ai-workflow-security; "AI agent security" -> /ai-agent-security; "published limitations" -> /limitations; add on publish: "four recall numbers" -> post 1 | /changelog, /playground?preset=injection |
| 5 | "MCP security checklist" -> /mcp-security; "MCP security for developers" -> /blog/mcp-security-for-developers; "AI agent security" -> /ai-agent-security; "SoterAI IDE Guard" -> /extensions/ide; add on publish: "secure an n8n AI workflow" -> post 4 | /playground?preset=mcp-poisoning, /playground?preset=tool-call |
| 6 | "LLM firewall" -> /llm-firewall; "AI context firewall architecture" -> /blog/what-is-ai-context-firewall; "LLM guardrails explained" -> /blog/llm-guardrails-explained-developer-guide; "why one recall number is not enough" -> post 1; "benchmark results and methodology" -> /benchmarks | /limitations, /playground?preset=obfuscation |
| 7 | "jailbreak detection" -> /jailbreak-detection; "prompt injection protection" -> /prompt-injection-protection; "what prompt injection is" -> /blog/what-is-prompt-injection-types-examples-prevention; "four benchmark numbers" -> post 1; "Hinglish and nine other languages" -> post 2 | /limitations, /playground?preset=jailbreak-dan |
| 8 | "RAG security" -> /rag-security; "RAG security documentation" -> /docs/rag; "what prompt injection is" -> /blog/what-is-prompt-injection-types-examples-prevention; "MCP tool poisoning, reproduced" -> post 5; "prompt injection protection" -> /prompt-injection-protection | /limitations, /playground?preset=rag-poisoning |
| 9 | "AI security for India" -> /ai-security-india; "PII detection for Indian businesses" -> /blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance; "AI data leakage prevention" -> /ai-data-leakage-prevention; "redact locally before you paste" -> post 3; "published limitations" -> /limitations | /playground?preset=aadhaar-pan |
| 10 | "OWASP LLM Top 10 alignment" -> /compliance/owasp-llm-top-10; "prompt injection protection" -> /prompt-injection-protection; "AI data leakage prevention" -> /ai-data-leakage-prevention; "RAG security" -> /rag-security; "AI agent security" -> /ai-agent-security | /limitations; in the table: posts 5, 7, 8 and eight preset links |
| 11 | "AI security vendor comparison" -> /comparison; "LLM guardrails explained" -> /blog/llm-guardrails-explained-developer-guide; "LLM firewall" -> /llm-firewall; "firewall versus prompt filter" -> post 6; "benchmark results and methodology" -> /benchmarks | /limitations |
| 12 | "LLM firewall" -> /llm-firewall; "quickstart" -> /docs/quickstart; "JavaScript SDK guide" -> /docs/js; "Python SDK guide" -> /docs/python; "supported platforms" -> /ai-platform-security | /docs/rest-api, /limitations |
| 13 | "AI security for India" -> /ai-security-india; "PII detection for Indian businesses" -> /blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance; "AI security best practices for Indian enterprises" -> /blog/ai-security-best-practices-indian-enterprises-2026; "why the checksum matters" -> post 9; "trust center" -> /trust | /data-retention, /limitations, /playground?preset=personal-data |
| 14 | "AI data leakage prevention" -> /ai-data-leakage-prevention; "how AI coding tools leak secrets" -> /blog/how-ai-coding-tools-leak-secrets; "SoterAI IDE Guard" -> /extensions/ide; "Cursor AI security" -> /cursor-ai-security; "keep API keys out of coding prompts" -> post 3 | /vscode-ai-security, /limitations, /playground?preset=api-key |
| 15 | "AI security vendor comparison" -> /comparison; "benchmark results and methodology" -> /benchmarks; "published limitations" -> /limitations; "four benchmark numbers" -> post 1; "firewall versus prompt filter" -> post 6 | /pricing, /trust, post 11, /playground |

Draft 3 also links `/docs/rest-api` in its body. That is a sixth link, treated here as a utility link. Leave it.

### 5.2 Links in: existing pages that should link back

These are edits in `app/` or in post pages, which this task does not touch. Add each as a "Related reading" line or inline link when the post goes live.

| Existing page | Add links to posts |
|---|---|
| `/benchmarks`, `/benchmark/methodology` | 1, then 10 |
| `/limitations` | 1, 2 |
| `/prompt-injection-protection` | 1, 2, 7, 8 |
| `/jailbreak-detection` | 2, 7 |
| `/rag-security`, `/docs/rag` | 8 |
| `/mcp-security`, `/ai-agent-security` | 5, then 4 |
| `/ai-workflow-security`, `/integrations/n8n` | 4 |
| `/ai-data-leakage-prevention` | 3, 9, 14 |
| `/extensions/ide`, `/vscode-ai-security`, `/cursor-ai-security` | 3, 14 |
| `/ai-security-india` | 2, 9, 13 |
| `/llm-firewall` | 6, 11, 12 |
| `/comparison` | 6, 11, 15 |
| `/compliance/owasp-llm-top-10` | 10 |
| `/docs/quickstart`, `/docs/js`, `/docs/python`, `/ai-platform-security` | 12 |
| `/trust` | 10, 13 |
| `/blog/what-is-prompt-injection-types-examples-prevention` | 1, 2, 7, 8 |
| `/blog/what-is-ai-context-firewall` | 6 |
| `/blog/llm-guardrails-explained-developer-guide` | 6, 11 |
| `/blog/how-ai-coding-tools-leak-secrets` | 3, 14 |
| `/blog/mcp-security-for-developers` | 5 |
| `/blog/ai-agent-security-risks-threats-protection` | 4, 5, 8 |
| `/blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance` | 9, 13 |
| `/blog/ai-security-best-practices-indian-enterprises-2026` | 13 |

### 5.3 Notes for whoever builds the pages

- Add each post to `BLOG_POSTS` in `lib/blog/posts.ts`. The blog index and the sitemap read it. Set `seoTitle` so the title tag, with the " | soterai.in" suffix the layout adds, stays at 60 characters or fewer.
- `BlogArticle` emits Article, FAQPage and BreadcrumbList JSON-LD. Its Article author is the Organization. The drafts' front matter says BlogPosting with Yash Chauhan as author. Choose one. A person author needs a code change, and a `founderNode` already exists in `lib/seo/schema.ts`.
- The FAQ JSON-LD must match the visible FAQ text.
- `/playground?preset=<id>` accepts only ids in `ALL_PRESETS`: `injection`, `api-key`, `personal-data`, `aadhaar-pan`, `hinglish`, `tool-call`, `reply-leak`, `jailbreak-dan`, `prompt-leak`, `obfuscation`, `rag-poisoning`, `exfiltration`, `mcp-poisoning`, `tool-abuse`, `code-injection`, `memory-poisoning`, `safe`, `safe-support`, `safe-answer`, `safe-product`, `safe-coding`. The nine language examples cannot be deep-linked.
- A deep link fills the text box and sends nothing until the visitor presses "Check this text". An unknown id is ignored.

## 6. Free tools (link magnets)

Four tools. Two ship first as deep links with no new code. Effort figures are estimates and are not in the 121 hours above.

| Tool | Ships as | New code | Engine reuse | Effort | Ship with |
|---|---|---|---|---|---|
| 1. Prompt-injection tester | `/playground?preset=injection` | None for version 1 | `POST /api/guard/analyze` through the playground | 0 h (version 1). 8 to 10 h for an optional multi-family page | Post 1, week 1 |
| 2. Aadhaar and PAN redaction tester | `/playground?preset=aadhaar-pan` | None for version 1 | Same endpoint, India rules in `lib/guard/detectors/indiaPiiDetector.ts` | 0 h (version 1). 8 to 12 h for an optional in-browser version | Post 9, week 8 |
| 3. System-prompt leak checker | `/playground?preset=prompt-leak` tests extraction requests only | Version 2 needs a new page | None for version 2 | 0 h (version 1). 6 to 8 h (version 2) | Post 10, week 9 (version 1) |
| 4. OWASP LLM checklist generator | New page, cannot be a preset | Yes | None | 10 to 14 h | Post 10, week 9 |

**Can ship first with no new code:** tools 1 and 2, and version 1 of tool 3. Tool 4 cannot.

### Tool 1. Prompt-injection tester

- **Purpose:** let a developer try their own wording on the real engine. Link magnet for posts 1, 6 and 7.
- **Reuses:** the public endpoint `POST /api/guard/analyze` (20 requests per minute, 8,000 characters by default) and presets `injection`, `jailbreak-dan`, `obfuscation`, `prompt-leak`, `rag-poisoning`, `hinglish`, `memory-poisoning`, `code-injection`, with `safe`, `safe-support` and `safe-coding` as controls.
- **Inputs and outputs:** text and a direction in. Action, risk score, rule names, redacted text and a limit line out. The limit line is `GENERAL_LIMIT` from `lib/sa/claims.ts`: on 26 blind test cases the engine caught 16.
- **Optional version 2:** a new page that runs ten attack families in one click. Ten requests per run means two runs a minute reach the limit, so it must show the rate limit instead of a verdict.
- **Privacy note:** the public playground sends text to the soterai.in server. Tell users to paste sample text only. The route can call an LLM judge when `SOTERAI_LLM_JUDGE` is on. The default in code is off. The production setting is UNKNOWN. Do not write "we do not store your text" until you have read the production configuration and `/privacy`. The route records a latency metric, not the text (read 2026-11-09).
- **Known limits:** 16 of 26 on the blind set. Harmless sentences in four of ten tested languages went to HUMAN_REVIEW (draft 2). A verdict is one engine's opinion on one text.

### Tool 2. Aadhaar and PAN redaction tester

- **Purpose:** show what gets redacted in a snippet of Indian identifiers. Link magnet for posts 9 and 13.
- **Reuses:** preset `aadhaar-pan`, which already prints a limit line about the missing checksum, and `/api/guard/analyze`. Rules in play: "Aadhaar-like pattern", "PAN-like pattern", UPI ID, IFSC code, Indian mobile number, GSTIN-like pattern.
- **Inputs and outputs:** text in. Redacted text and the matched rule names out. A checksum pass or fail column exists only in the optional in-browser version, which would use the zero-dependency `soter-pii` package.
- **Privacy note:** sample numbers only, and never a real Aadhaar number. Say "runs in your browser" for the in-browser version only after you check the network tab.
- **Known limits (from `public/llms.txt` and runs on 2026-11-09):** the Aadhaar-like rule has no checksum and can fire on card digits, IBAN digits and order numbers. UK National Insurance numbers are not named. Masked numbers such as `XXXX XXXX 1234` were not named in two samples. PAN is matched by format only.
- **Order of work:** do not build the in-browser version before you decide on defects D1 and D4. A page that says "checksum fails" next to an engine that says "Aadhaar-like" confuses users.

### Tool 3. System-prompt leak checker

- **Purpose:** test whether prompts try to extract instructions, and whether a reply discloses them. Link magnet for post 10.
- **Reuses (version 1):** preset `prompt-leak`. `systemPromptLeakDetector.ts` has request patterns for the input side and disclosure-phrase patterns for the output side. It takes only text. It does not compare a reply with a system prompt you supply, so version 1 cannot tell you whether your actual prompt leaked.
- **Version 2 (new code):** two boxes, a system prompt and a reply. It highlights shared runs of 8 or more words, in the browser, with no network call. Paraphrased leaks are missed, and shared boilerplate causes noise.
- **Privacy note:** system prompts often hold secrets. Version 2 must run offline in the page. Version 1 sends text to the server, so never paste a real system prompt into it. OWASP's LLM07 text says secrets do not belong in system prompts (register S7 in the briefs).
- **Known limits:** pattern-based detection of extraction requests, and no overlap check in version 1.

### Tool 4. OWASP LLM checklist generator

- **Purpose:** turn eight to ten yes or no questions into a checklist for the OWASP LLM risks that apply. Link magnet for posts 10 and 15.
- **Reuses:** no engine endpoint. It uses the ten 2025 risk names (verify against OWASP before shipping), a preset link per row, and the hub pages. Do not reuse the coverage percentages in `lib/compliance/owaspMapping.ts`.
- **Inputs and outputs:** questions such as: uses retrieval? calls tools or MCP servers? renders replies as HTML? shares data across tenants? stores memory? accepts uploaded documents? puts secrets in the system prompt? serves anonymous users? Out: the relevant rows, an engineering action for each, the related soterai.in page or preset, and a line saying which rows no guard covers. Export as Markdown or print.
- **Privacy note:** answers stay in the page, with no network call and no storage. Confirm in the network tab before saying so.
- **Known limits:** a checklist, not an audit or a certificate. The mapping is our reading of OWASP text. The OWASP list can change.

## 7. Measurement

### 7.1 Baseline: UNKNOWN

No Search Console export and no Cloudflare analytics export were available to this plan. The current traffic, impressions, rankings and signups of soterai.in are UNKNOWN. So no target is set for any metric. Without a baseline, any target would be invented.

Before week 1, take these two exports and keep them with this plan:

1. Search Console, Performance, last 28 days: queries and pages (clicks, impressions, CTR, average position).
2. Cloudflare Web Analytics, last 28 days: top paths and top referrers.

### 7.2 What exists in the code

- `app/layout.tsx` loads the Cloudflare Web Analytics beacon (`static.cloudflareinsights.com/beacon.min.js` with a token). So the beacon is installed. Whether the dashboard shows data is UNKNOWN.
- `app/layout.tsx` also sets a Google site-verification value. Whether the Search Console property is active and holds data is UNKNOWN.
- Whether Cloudflare Web Analytics keeps query strings, which M3 needs to see `?preset=`, is UNVERIFIED. Test it once with a deep link and look for it in the paths report.
- Whether any event is recorded when a visitor presses "Check this text" is UNKNOWN. Until one exists, M3 counts page views of `/playground`, not checks.
- Whether signups record a landing page or referrer is UNKNOWN. Do not claim a post produced a signup until an attribution method exists.

### 7.3 Metrics and how to read them

| ID | Metric | Where to read it | Reading rule |
|---|---|---|---|
| M1 | Indexed, and the date | Search Console, URL Inspection, "Page indexing" status | Check on days 3, 7 and 14. If not indexed on day 14, check the canonical tag, that the post is in `lib/blog/posts.ts` (the sitemap source), and robots rules. |
| M2 | Impressions, clicks, CTR and average position for the target query and its secondary queries | Search Console, Performance, filter Page equals the post URL, then the Queries tab | Read the 28 days after publishing, then each following 28 days. Compare a post with its own earlier window only. Different posts target different queries. Wait for at least four weekly points before changing a post. |
| M3 | Playground visits that came from the post | Cloudflare Web Analytics, filter path `/playground`, referrer equal to the post URL | A visit is not a check. See 7.2. |
| M4 | Clicks from the post to its hub page | Cloudflare Web Analytics, referrer equal to the post, path equal to the hub | Shows whether the internal link does its job. |
| M5 | Pages that link to the post from other sites | Search Console, Links, External links, Top linked pages | Review monthly. Count editorial links only. |

### 7.4 Primary KPI per post

| Post | Primary KPI | Check at |
|---|---|---|
| 1 | M2 for "prompt injection benchmark", M4 to `/benchmarks` | Day 28 |
| 2 | M2 for "multilingual prompt injection detection", M4 to `/ai-security-india` | Day 28 |
| 3 | M2 for "prevent ai coding assistant leaking api keys", M4 to `/extensions/ide` | Day 28 |
| 4 | M2 for "secure n8n ai workflow", M4 to `/integrations/n8n` | Day 28 |
| 5 | M2 for "mcp tool poisoning", M4 to `/mcp-security` | Day 28 |
| 6 | M2 for "what is an llm firewall", M4 to `/llm-firewall` | Day 28 |
| 7 | M2 for "jailbreak detection", M4 to `/jailbreak-detection` | Day 28 |
| 8 | M2 for "rag poisoning", M4 to `/rag-security` | Day 28 |
| 9 | M2 for "aadhaar number redaction", M4 to `/ai-security-india` | Day 28 |
| 10 | M2 for "owasp llm top 10 mitigation", M5 | Day 28 |
| 11 | M2 for "open source llm guardrails", M4 to `/comparison` | Day 28 |
| 12 | M2 for "langchain prompt injection protection", M4 to `/docs/quickstart` | Day 28 |
| 13 | M2 for "dpdp act ai", M4 to `/ai-security-india` | Day 28 |
| 14 | M2 for "cursorignore", M4 to `/extensions/ide` | Day 28 |
| 15 | M2 for "how to choose an llm firewall", M4 to `/pricing` | Day 28 |

### 7.5 Cadence

- **Weekly, Friday, 20 minutes:** M1 for any post under 14 days old. Note any crawl or indexing errors.
- **Weeks 4, 8 and 12:** read M2 and M4 for every live post. Record the numbers next to the baseline. Write down what you would change, and change only posts with four weekly data points.
- **Week 12:** pick posts 16 to 18 from Search Console queries that show impressions and have no dedicated post. If no such queries exist, publish fewer than 18.
- **Process rule:** if a post is indexed and shows zero impressions after eight weeks, check canonical tags, internal links and the title before writing more posts of the same kind.

## 8. Pre-publish checklist (run for every post)

1. **Re-run every example** (commands, scripts, curl calls, presets) on publish day. Paste the outputs. Record tool versions and the date. An output that changed means the post text changes.
2. **Re-capture numbers from `lib/sa/claims.ts`.** Compare each number in the post with the file. Any number not in the file needs a cited repo file or a cited external source with URL and date.
3. **Banned-phrase scan.** Run the scan in `README.md` over the post. Zero hits.
4. **Style scan.** No em-dash chains, no negative-parallelism sentences that set up one claim only to swap it for another, no staged reveals, no chatbot phrases, no closing self-summary, no ellipsis used as truncation, no stub markers. Brand in prose is "soterai.in".
5. **Link check.** Each internal path exists as `app/<path>/page.tsx` or in `lib/blog/posts.ts`. Each `/playground?preset=<id>` id exists in `lib/sa/presets.ts`. Links to planned posts go in only after those posts are live. External links open.
6. **Claims-register check.** Every number maps to `lib/sa/claims.ts` or a cited repo file. Every third-party fact has a URL and a fetch date. UNVERIFIED and UNKNOWN markers come out only when evidence replaces them.
7. **Title and meta.** Title plus " | soterai.in" is 60 characters or fewer. Meta description is 155 or fewer. One H1 equals the title.
8. **Required sections.** "What this does not show" is present. A visible FAQ has 3 or 4 questions, and the FAQ JSON-LD matches it word for word.
9. **Schema validation.** Run Google's Rich Results Test and the schema.org validator on the live URL. Check Article, FAQPage and BreadcrumbList, the author, the publisher id `https://soterai.in#organization`, and both dates.
10. **Privacy.** Synthetic data only. No real key, person or number appears in text, code or screenshots. Aadhaar demos use numbers that start with 1.
11. **Deep links.** Each playground link opens the right preset.
12. **Register the post.** Add it to `lib/blog/posts.ts`. Confirm `/blog` and the sitemap list it and the canonical is `/blog/<slug>`.
13. **After publishing.** Request indexing in URL Inspection. Add the back-links from section 5.2. Log the publish date in the tracker in `README.md`.
14. **Post-specific gates.** Post 9 needs the D1 and D4 decision. Post 13 needs counsel review and the primary legal text. Post 14 needs the canary results. Post 11 needs the source register re-fetched the same day.
