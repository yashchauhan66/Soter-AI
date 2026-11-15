# Content briefs: posts 6 to 15

Written 2026-11-09 for soterai.in. These are briefs, not drafts. Posts 1 to 5 already exist in `../drafts/`. The calendar and linking plan are in `../00-content-plan.md`.

## How to read these briefs

- **UNVERIFIED** means a fact, number or source I could not confirm in this pass. **UNKNOWN** means the data does not exist yet, for example a test nobody has run.
- Every search volume is UNVERIFIED. No keyword tool was used and no volume figure appears in this file.
- Quotable numbers come only from `lib/sa/claims.ts`. The approved set is below. Anything else needs a cited repo file or a cited external source with URL and date accessed.
- Competitor and third-party facts appear only in the source register at the end of this file, each with a URL and the date it was fetched (2026-11-09). Re-fetch on publish day.
- Use synthetic example data only. Never put a real key, person or number in a post.
- Brand in prose is "soterai.in" (lowercase). Product and package names keep their own spelling, for example `n8n-nodes-soterai` and "SoterAI IDE Guard".
- Each post ends with a "What this does not show" section and 3 to 4 visible FAQ questions, like the five drafts.
- Title tag is the working title plus " | soterai.in". Keep the working title at 47 characters or fewer, and the meta description at 155 or fewer.
- When a post goes live, add it to `lib/blog/posts.ts` so the blog index and sitemap pick it up. That edit is outside this folder.

### Approved numbers (from `lib/sa/claims.ts`, asOf 2026-11-09 unless stated)

| Figure | Value | Limit to print beside it |
|---|---|---|
| Regression corpora | 1,104 of 1,122 attacks caught (98.40%), 0 of 322 benign flagged | Includes sets used for tuning |
| Blind held-out set | 16 of 26 caught (61.54%), about 42.5% to 77.6% at 95% confidence (computed) | Small sample, closest to real use |
| Public synthetic benchmark (generated 2026-07-22) | 2,200 attacks and 1,000 benign, 100.00% recall, 0.00% false positives | We wrote the cases and tuned against them |
| Analyzer latency, one local CPU run | p50 9.30 ms, p95 17.83 ms over 3,200 cases | Excludes API, network and auth. Not run under load |
| Live API sample | 7 calls, server median 20 ms (14 to 64 ms), round trip median 344 ms from one machine | A sample, not a benchmark |

### Order and dependencies

| Post | Title | Week | Needs first | Ship blocker |
|---|---|---|---|---|
| 6 | LLM Firewall vs Prompt Filter: What Differs | 6 | Post 1 live | Naive-filter run through the harness |
| 7 | Jailbreak Detection: What a Filter Misses | 7 | Posts 1, 2 live | 25 outside-written variants and 15 benign role-play prompts run |
| 8 | RAG Poisoning: A Reproducible Example | 8 | Post 5 live | Live capture of the toy RAG and the preset |
| 9 | Aadhaar Redaction: Why the Checksum Matters | 8 | Post 3 live | Decision on defects D1 and D4 (fix or disclose) |
| 10 | OWASP LLM Top 10: What a Guard Can Cover | 9 | Posts 5, 7, 8 live | One test or script found for each of the 10 rows |
| 11 | Open-Source LLM Guardrails Compared | 10 | Post 6 live | Source register re-fetched on publish day |
| 12 | Protect a LangChain App With a Guard Call | 10 | none | Install test in a scratch folder, HUMAN_REVIEW decision |
| 13 | DPDP and AI Prompts: What a Team Can Do | 11 | Post 9 live | Primary legal text read, counsel review |
| 14 | Scope What Cursor and Copilot Can Read | 12 | Post 3 live | Canary experiment run on each tool named |
| 15 | How to Choose an LLM Firewall: Buyer Checklist | 12 | Posts 1, 6, 11 live | Appendix answers checked against repo evidence |

---

## Post 6. LLM Firewall vs Prompt Filter: What Differs

**Working title:** LLM Firewall vs Prompt Filter: What Differs

**Slug:** `llm-firewall-vs-prompt-filter`

**Planned URL:** `/blog/llm-firewall-vs-prompt-filter`

**Target query:** "what is an llm firewall" (volume UNVERIFIED). Secondary: "llm firewall vs prompt filter", "llm firewall vs guardrails" (both UNVERIFIED).

**Cluster and pillar:** Cluster 1a, Category: LLM firewall. Pillar 1, LLM firewall and AI guardrails. Hub: `/llm-firewall`.

**Search intent:** Informational with comparison. The reader wants to know whether a keyword list or regex in front of the model is enough.

**Reader and fear:** A backend developer or tech lead who shipped a chatbot with a blocklist. They fear that attackers reword around it, and they also fear paying for a heavy product they may not need.

**H2 outline:**
1. What a prompt filter does, with a 15-line keyword and regex filter written for the post
2. What an LLM firewall adds, listing only layers that exist in this product and their status (Stable, Beta or Labs)
3. The same 25 inputs through both: reworded, Hinglish, spaced letters, encoded, benign look-alikes
4. The same public corpus through both, using the benchmark harness and its adapter flag
5. Where a filter is enough
6. Where a filter breaks: replies, tool calls, retrieved documents, multi-turn
7. What a firewall does not fix: permissions, authentication, isolation
8. What this does not show
9. Frequently asked questions

**Unique repo asset:** `benchmarks/soterai-public-benchmark/run.mjs` accepts any adapter that exports `detect(text)`. The folder already holds `always-allow.mjs`, `flag-everything.mjs` and `soterai-n8n-local.mjs` as adapter examples. The post adds a fourth, the naive filter, and reports its recall and false-positive rate on the 3,200-case corpus. The result is UNKNOWN until someone runs it.

**Evidence to verify before publishing:**
- Run the naive adapter and record recall, false positives and per-category results. Print the corpus SHA-256 that the harness reports.
- Syntax read from `run.mjs` on 2026-11-09: `node run.mjs --adapter ./adapters/<file>.mjs`. An adapter exports `adapterInfo` and `detect(text)`, which returns `{ flagged, block, riskType, riskScore }`. Re-check if the harness changed.
- Re-capture the engine figures from `lib/sa/claims.ts` and print them with their limits.
- Check each layer named in the post against the status table in `public/llms.txt`. The MCP and agent guard is Labs.
- Run the 25 inputs against the live endpoint and copy the actions and rule names as returned.

**Claims to avoid:**
- That a firewall "stops" or "prevents" prompt injection.
- Any comparison with a named competitor. No head-to-head run exists.
- Any latency promise. Quote only `LATENCY_SENTENCE`.
- That the 100.00% figure describes real traffic. The corpus is ours.
- That the naive filter represents every filter. It is one example written for the post.

**Internal links:**
- "LLM firewall" -> /llm-firewall
- "AI context firewall architecture" -> /blog/what-is-ai-context-firewall
- "LLM guardrails explained" -> /blog/llm-guardrails-explained-developer-guide
- "why one recall number is not enough" -> /blog/prompt-injection-benchmark-honest-numbers
- "benchmark results and methodology" -> /benchmarks
- Utility: /limitations, /playground?preset=obfuscation

**CTA:** Open the obfuscated-text preset in the playground, then paste a reworded attack of your own. Sample text only.

**Founder effort:** 8 hours (estimate). Adapter and run 2, capture 1, writing 4, verification 1.

---

## Post 7. Jailbreak Detection: What a Filter Misses

**Working title:** Jailbreak Detection: What a Filter Misses

**Slug:** `jailbreak-detection-what-a-filter-misses`

**Planned URL:** `/blog/jailbreak-detection-what-a-filter-misses`

**Target query:** "jailbreak detection" (volume UNVERIFIED). Secondary: "llm jailbreak detection tool", "detect dan prompt" (both UNVERIFIED).

**Cluster and pillar:** Cluster 2b, Problem: jailbreak. Pillar 2, Prompt injection. Hub: `/jailbreak-detection`.

**Search intent:** Informational and investigation. The reader has seen role-play or "no restrictions" prompts in logs and wants to know what a detector can and cannot catch.

**Reader and fear:** A developer of a public chatbot. They fear that a reworded jailbreak gets through, and that a strict detector blocks harmless role-play such as fiction writing.

**H2 outline:**
1. Jailbreak and prompt injection: one paragraph, then a link to the existing explainer
2. Five families, each with one synthetic example: persona (DAN style), hypothetical framing, obfuscation, multilingual, many-shot or multi-turn
3. What the engine returned for each, captured live
4. The paraphrase probe: 25 new variants written by people who have not read the detectors, with every miss listed
5. Harmless role-play: 15 benign creative prompts and how many were flagged
6. What to do with REWRITE and HUMAN_REVIEW in a real app
7. What this does not show
8. Frequently asked questions

**Unique repo asset:** `lib/classifiers/datasets/expanded/jailbreakExpanded.ts` with `tests/guard/jailbreak-expanded.test.ts`, and the held-out set behind the 16 of 26 blind figure (`lib/classifiers/datasets/expanded/heldoutBlindWide.ts`, which holds 26 short paraphrases, two in each of 13 languages, counted 2026-11-09; the per-case results are UNKNOWN until you run the audit and print them). Presets `jailbreak-dan`, `obfuscation` and `hinglish` give copyable examples. Recorded figures: jailbreak 100.00% on 300 regression cases and 250 of 250 in the public benchmark, both self-written.

**Evidence to verify before publishing:**
- Run the 25 variants and the 15 benign prompts. Both counts are UNKNOWN until run. Diff the variants against the repo corpora so none is a copy.
- Re-run the three presets on the live endpoint and copy actions and rule names.
- Re-run `npx tsx scripts/readme-recall-audit.ts` and confirm the jailbreak line and the blind line.
- Check the dataset file headers for what the families are before naming them.

**Claims to avoid:**
- "Detects all jailbreaks", or any claim about unseen attacks beyond the blind figure.
- A per-language recall figure. Only a one-phrase smoke test exists.
- The "15-language" wording in `lib/compliance/owaspMapping.ts`. It conflicts with the 10-language smoke test.
- Treating the regression 100.00% as a generalization result.

**Internal links:**
- "jailbreak detection" -> /jailbreak-detection
- "prompt injection protection" -> /prompt-injection-protection
- "what prompt injection is" -> /blog/what-is-prompt-injection-types-examples-prevention
- "four benchmark numbers" -> /blog/prompt-injection-benchmark-honest-numbers
- "Hinglish and nine other languages" -> /blog/prompt-injection-hinglish-multilingual-smoke-test
- Utility: /limitations, /playground?preset=jailbreak-dan

**CTA:** Open the jailbreak preset, then reword it and test your version.

**Founder effort:** 10 hours (estimate). Variants and benign prompts 3, runs 1, writing 4, verification 2.

---

## Post 8. RAG Poisoning: A Reproducible Example

**Working title:** RAG Poisoning: A Reproducible Example

**Slug:** `rag-poisoning-reproducible-example`

**Planned URL:** `/blog/rag-poisoning-reproducible-example`

**Target query:** "rag poisoning" (volume UNVERIFIED). Secondary: "indirect prompt injection rag", "poisoned document llm" (both UNVERIFIED).

**Cluster and pillar:** Cluster 2c, Problem: RAG poisoning. Pillar 2, Prompt injection (secondary pillar 4). Hub: `/rag-security`.

**Search intent:** Informational and how-to. The reader wants to see one poisoned document do damage, then see where a check can sit.

**Reader and fear:** A developer with a RAG chatbot over a wiki, support tickets or email. They fear that text written by a stranger gets treated as an instruction.

**H2 outline:**
1. How a poisoned document gets in: wiki edit, support ticket, email, web page
2. A toy RAG in about 40 lines with three synthetic documents, one poisoned, that prints the assembled prompt (no model call needed)
3. What the guard returns on the document alone and on the assembled context
4. Three places to scan: at ingestion, at retrieval, on the reply
5. A two-stage case from the news: a hidden instruction in retrieved content, then an image link in the reply that carries data out
6. Quarantine and access control: what the product offers and its status
7. What this does not show
8. Frequently asked questions

**Unique repo asset:** `lib/classifiers/datasets/expanded/ragPoisoningExpanded.ts` (payload families such as embedded instructions and authority spoofing, all with fabricated domains). `tests/guard/echoleak-killchain.test.ts` checks both stages plus a precision check that a legitimate image still passes. Preset `rag-poisoning`. Recorded figures: RAG poisoning 99.00% on 100 regression cases and 200 of 200 in the public benchmark, both self-written.

**Evidence to verify before publishing:**
- Run the toy RAG and copy the guard output for the three documents and for the assembled context.
- Run the output-direction check on a markdown image with a data-carrying URL (the case in the echoleak test) and copy the result.
- Confirm the facts about the 2025 Microsoft 365 Copilot case from the sources in the register (CVE-2025-32711, CVSS 9.3, disclosed by Aim Security in June 2025, fixed server-side, no evidence of exploitation in the wild). Read the NVD entry for the CVSS vector and dates.
- Read `/docs/rag` and `/rag-security` for what quarantine, trust scoring and retrieval access control really do today, and whether each is Stable, Beta or Labs. The status table in `public/llms.txt` does not list RAG.

**Claims to avoid:**
- That soterai.in would have stopped the Microsoft case. No test against that system exists.
- Any detail about Microsoft's product that the cited sources do not state.
- A recall figure for real documents. None exists.
- "Stops RAG poisoning" in any form.

**Internal links:**
- "RAG security" -> /rag-security
- "RAG security documentation" -> /docs/rag
- "what prompt injection is" -> /blog/what-is-prompt-injection-types-examples-prevention
- "MCP tool poisoning, reproduced" -> /blog/mcp-tool-poisoning-reproducible-example
- "prompt injection protection" -> /prompt-injection-protection
- Utility: /limitations, /playground?preset=rag-poisoning

**CTA:** Open the RAG-poisoning preset and paste a document snippet of your own.

**Founder effort:** 9 hours (estimate). Toy RAG 2, captures 1, news-case reading 1, writing 4, verification 1.

---

## Post 9. Aadhaar Redaction: Why the Checksum Matters

**Working title:** Aadhaar Redaction: Why the Checksum Matters

**Slug:** `aadhaar-redaction-why-checksum-matters`

**Planned URL:** `/blog/aadhaar-redaction-why-checksum-matters`

**Target query:** "aadhaar number redaction" (volume UNVERIFIED). Secondary: "aadhaar verhoeff checksum validation", "redact pan aadhaar from prompts" (both UNVERIFIED).

**Cluster and pillar:** Cluster 3a, India: Aadhaar and PAN redaction. Pillar 3, Data leakage and PII. Hub: `/ai-security-india`.

**Search intent:** Informational and how-to. The reader has a 12-digit regex that redacts order numbers, or no redaction at all.

**Reader and fear:** An India-based developer or privacy owner. They fear that real Aadhaar numbers reach prompts and logs, and they fear that crude redaction breaks the product.

**H2 outline:**
1. Why a 12-digit regex is not enough, with live results for an order number, a card number and an IBAN
2. What a Verhoeff check does, in about 20 lines of code
3. What it does not do: about 10 in 100 random 12-digit strings pass, so the checksum cuts false positives but does not remove them
4. What the live engine does today: a checksum-valid and a checksum-invalid number get the same result (known gap D4)
5. What the offline package `soter-pii` does: it rejects the invalid number
6. Masked numbers: `XXXX XXXX 1234` and what the live engine did with it
7. PAN: format only, and what a regex cannot check
8. A redaction recipe: offline first, guard call second
9. What this does not show
10. Frequently asked questions

**Unique repo asset:** `packages/soter-pii/index.ts` (`verhoeffCheck`, plus `isLikelyAadhaar`, which also rejects a first digit of 0 or 1) and `packages/soter-pii/test/redact.test.js`. `lib/guard/detectors/indiaPiiDetector.ts` holds the live pattern with no checksum. Preset `aadhaar-pan` already prints a limit line about the missing checksum. A 1,000,000-sample script with a fixed seed measures the random pass rate.

**Observed on 2026-11-09 (one run each, synthetic input):**
- `2341 6789 1234` (checksum valid) and `4521 8890 1123` (checksum invalid): both returned ALLOW_WITH_REDACTION, risk 30, "Aadhaar-like pattern".
- `7890 1234 5678` as an order reference: redacted as Aadhaar-like.
- Card `4111 1111 1111 1111`: "Credit card-like pattern" and "Aadhaar-like pattern".
- IBAN `GB82 WEST 1234 5698 7654 32`: "Credit card-like pattern", "IBAN-like bank identifier" and "Aadhaar-like pattern".
- `XXXX XXXX 1234` and `xxxx-xxxx-1234`: no pattern rule fired. HUMAN_REVIEW at risk 0 from the ML tier only.
- Computed locally: 101,264 of 1,000,000 pseudo-random 12-digit strings starting with 2 to 9 passed the check (10.13%, linear congruential generator, seed 12345).

**Evidence to verify before publishing:**
- Check whether D1 and D4 were fixed. If yes, re-run everything and change sections 4 and 6 to say what changed and when.
- Re-run the 1,000,000-sample count and print the code and seed.
- Verhoeff detects all single-digit errors and all adjacent transpositions (Wikipedia, see register). That the 12th Aadhaar digit is a Verhoeff check digit, and that numbers never start with 0 or 1, are UNVERIFIED against a UIDAI primary source. Only secondary sites were found. Find a UIDAI document, or say "widely documented, not confirmed by UIDAI in this post".
- UIDAI describes Masked Aadhaar as hiding the first 8 digits (register). Confirm the exact wording before using it.
- Safety: `2341 6789 1234` passes the checksum and starts with 2, so a real person may hold it. For the algorithm demo, use checksum-valid numbers that start with 1, such as `1234 5678 9010`, `1000 0000 0004` or `1020 3040 5068` (computed 2026-11-09). Keep the preset number only where the post shows live engine output, and replace it if you can.
- `/ai-security-india` says masked patterns such as "XXXX XXXX 1234" are detected. The two observations above do not support that. Resolve before linking to the page.

**Claims to avoid:**
- "Validates Aadhaar". A checksum validates format, not existence.
- Any recall figure for Indian identifiers. None exists. The 300 of 300 secret and personal-data result is global, synthetic and self-written.
- Legal statements about storing Aadhaar numbers. Link to post 13 instead.
- "UIDAI approved", "certified", or any compliance status.
- That the live engine checks the checksum, unless the fix has shipped and been re-run.

**Internal links:**
- "AI security for India" -> /ai-security-india
- "PII detection for Indian businesses" -> /blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance
- "AI data leakage prevention" -> /ai-data-leakage-prevention
- "redact locally before you paste" -> /blog/keep-api-keys-out-of-ai-coding-prompts
- "published limitations" -> /limitations
- Utility: /playground?preset=aadhaar-pan

**CTA:** Open the Aadhaar and PAN preset, read the limit line, then try your own made-up numbers.

**Founder effort:** 10 hours (estimate), plus the time to fix D1 and D4 if you choose to. Script and runs 2, writing 5, verification 3.

---

## Post 10. OWASP LLM Top 10: What a Guard Can Cover

**Working title:** OWASP LLM Top 10: What a Guard Can Cover

**Slug:** `owasp-llm-top-10-what-a-guard-covers`

**Planned URL:** `/blog/owasp-llm-top-10-what-a-guard-covers`

**Target query:** "owasp llm top 10 mitigation" (volume UNVERIFIED). Secondary: "owasp top 10 for llm applications 2025", "owasp llm top 10 tools" (both UNVERIFIED).

**Cluster and pillar:** Cluster 2d, Problem: OWASP LLM Top 10. Pillar 5, Evidence and benchmarks (secondary pillar 1). Hub: `/compliance/owasp-llm-top-10`.

**Search intent:** Informational checklist. A security engineer or developer was asked whether the app is covered.

**Reader and fear:** They fear ticking a box for a risk that the tool does not touch.

**H2 outline:**
1. The 2025 list in one table
2. How to read "covered": the engine inspects text, a product feature outside the engine handles it, or no guard can
3. The ten rows: what the engine does, what it does not do, and the repo test or script behind each claim
4. Four worked examples with live output: sensitive information, system prompt leakage, retrieved-document poisoning, excessive agency
5. What you still need: authentication, least privilege, isolation, evaluations, red teaming
6. A printable checklist (the same table as plain text)
7. What this does not show
8. Frequently asked questions

**Unique repo asset:** The presets `api-key`, `prompt-leak`, `rag-poisoning`, `tool-call`, `tool-abuse`, `memory-poisoning`, `exfiltration` and `injection`. Tests under `tests/guard/` that map to rows (system-prompt-leak, rag-poisoning, tool-abuse, mcp-and-memory-poisoning, data-exfiltration). `lib/compliance/owaspMapping.ts` and `lib/compliance/publicContent.tsx` are the site's current self-mapping. Treat them as claims to audit, not as evidence.

**Evidence to verify before publishing:**
- Confirm names and numbers against OWASP. The pages for LLM07:2025 System Prompt Leakage and LLM08:2025 Vector and Embedding Weaknesses were fetched on 2026-11-09 (register). The 2025 PDF was too large to fetch, so the other eight rows are UNVERIFIED against the primary source. Check them.
- For each row, find one test, script or preset that exercises it. If none exists, write "no test found" in that row.
- Do not quote the coverage figures (95 to 99) in `lib/compliance/owaspMapping.ts`. They are self-assigned, every `gaps` list is empty, and one line claims "15-language multilingual detection".
- Check that features named in `lib/compliance/publicContent.tsx` exist and run: "grounding guard, citation checks" for LLM09, "dependency audit checks" for LLM03, "ACL post-filtering" for LLM08. A search of `lib/` found "grounding guard" only inside the compliance mapping files. Whether it is implemented is UNKNOWN.
- OWASP's LLM07 text says a system prompt should not be treated as a secret or as a security control. Use that point when describing what a leak detector does.

**Claims to avoid:**
- "OWASP certified", "OWASP compliant", or any score. The compliance page itself says alignment is not certification.
- "Covers all 10". Several rows are outside any text guard.
- The agentic list in `owaspMapping.ts` (`OWASP_AGENTIC_2026`) until the OWASP source for it is verified.
- Copying OWASP text. Paraphrase and cite.

**Internal links:**
- "OWASP LLM Top 10 alignment" -> /compliance/owasp-llm-top-10
- "prompt injection protection" -> /prompt-injection-protection
- "AI data leakage prevention" -> /ai-data-leakage-prevention
- "RAG security" -> /rag-security
- "AI agent security" -> /ai-agent-security
- In the table: /blog/jailbreak-detection-what-a-filter-misses, /blog/rag-poisoning-reproducible-example, /blog/mcp-tool-poisoning-reproducible-example, and preset links
- Utility: /limitations

**CTA:** Use the checklist on your own app, then test one row on sample text in the playground.

**Founder effort:** 10 hours (estimate). Evidence hunt 4, captures 1, writing 4, verification 1.

---

## Post 11. Open-Source LLM Guardrails Compared

**Working title:** Open-Source LLM Guardrails Compared

**Slug:** `open-source-llm-guardrails-compared`

**Planned URL:** `/blog/open-source-llm-guardrails-compared`

**Target query:** "open source llm guardrails" (volume UNVERIFIED). Secondary: "nemo guardrails vs guardrails ai", "llm guard alternatives" (both UNVERIFIED).

**Cluster and pillar:** Cluster 1b, Category: AI guardrails. Pillar 1, LLM firewall and AI guardrails. Hub: `/comparison`.

**Search intent:** Commercial investigation. The reader is choosing a library.

**Reader and fear:** A developer who fears picking an abandoned project, a license that blocks use, or a tool built for a different job.

**H2 outline:**
1. Four jobs that "guardrails" can mean: output validation, dialog flow control, input and output scanning, agent protection
2. The projects at a glance, in a table of cited facts: repository, license, archived or not, last push, date fetched
3. One short section per project: what its own documentation says it is for, and nothing more
4. Test them yourself: the same 10 inputs, versions pinned, results published only for what you ran
5. Where a hosted service fits and where it does not, including that the soterai.in server is proprietary and that international billing is not available yet
6. What this does not show
7. Frequently asked questions

**Unique repo asset:** The benchmark harness adapter pattern from post 6, so the same 10 inputs can be pointed at each library. The hands-on test is optional. Without it, the post is a cited facts table only.

**Evidence to verify before publishing:** Everything in the first table of the source register, re-fetched on publish day. As of 2026-11-09:
- NeMo Guardrails: not archived. GitHub's license field shows "Other", while the LICENSE.md header names Apache-2.0. Print both or check the file again.
- Guardrails AI: Apache-2.0, not archived.
- LLM Guard: MIT, archived.
- LlamaFirewall: license UNVERIFIED (the PyPI license field is empty). Read the repository license file before stating one.
- Read each project's own README or docs for its stated purpose. Paraphrase only. If you run a tool, record its version.
- The existing `/comparison` page lists star counts of 17K, 3.3K and 4.6K for Guardrails AI, NeMo Guardrails and LLM Guard. The GitHub API on 2026-11-09 returned 7,591, 7,458 and 3,218. Fix the page or drop star counts from both places.

**Claims to avoid:**
- Any ranking, any "best", any popularity claim.
- That soterai.in beats any project here. No head-to-head test exists.
- Feature gaps in another project, unless you read its docs and cite the page and date.
- Copying text from any project's site.
- Calling soterai.in open source. The server is proprietary. Published packages keep their own licenses.

**Internal links:**
- "AI security vendor comparison" -> /comparison
- "LLM guardrails explained" -> /blog/llm-guardrails-explained-developer-guide
- "LLM firewall" -> /llm-firewall
- "firewall versus prompt filter" -> /blog/llm-firewall-vs-prompt-filter
- "benchmark results and methodology" -> /benchmarks
- Utility: /limitations

**CTA:** Run the same 10 inputs through whichever tool you are considering, including the soterai.in playground.

**Founder effort:** 12 hours (estimate). 8 for the facts-only version, 14 with the hands-on test.

---

## Post 12. Protect a LangChain App With a Guard Call

**Working title:** Protect a LangChain App With a Guard Call

**Slug:** `protect-langchain-app-with-a-guard-call`

**Planned URL:** `/blog/protect-langchain-app-with-a-guard-call`

**Target query:** "langchain prompt injection protection" (volume UNVERIFIED). Secondary: "langchain guardrails", "secure langchain app" (both UNVERIFIED).

**Cluster and pillar:** Cluster 5c, Dev how-to: LangChain. Pillar 1, LLM firewall and AI guardrails. Hub: `/llm-firewall`.

**Search intent:** How-to. The reader has a chain or agent and wants a check before and after the model.

**Reader and fear:** A developer who fears that user text reaches the model unchecked and that tool calls run unreviewed, and who does not want to rewrite the app.

**H2 outline:**
1. Where checks go in a chain: user input, retrieved documents, tool calls, reply
2. JavaScript: wrap a chain with `withSoterLangChain`, tested with a fake chain so no model call is needed
3. What the wrapper does with each action, read from the source: only BLOCK throws, and HUMAN_REVIEW and REWRITE continue
4. A stricter wrapper that also stops on HUMAN_REVIEW
5. Gate a tool with `withSoterLangChainTool`
6. Python: `protect_chat` with a callable that wraps the chain
7. Failure behavior: timeout, 429, 5xx. Choose fail open or fail closed on purpose
8. Measure the added time in your own environment
9. What this does not show
10. Frequently asked questions

**Unique repo asset:** `packages/langchain-middleware/src/index.ts` and its README. Read on 2026-11-09: `withSoterLangChain` calls `guardInput`, throws only when the action is BLOCK, sends `safeText` or `redactedText` onward, then calls `guardOutput` and again throws only on BLOCK. `withSoterLangChainTool` returns `executed: false` for anything except ALLOW, READ_ONLY and REDACT. SDK error classes (`SoterRateLimitError`, `SoterNetworkError`) are in `packages/sdk/src/errors.ts`.

**Evidence to verify before publishing:**
- Install `@soterai/core` and `@soterai/langchain-middleware` from npm in a scratch folder. The repository `package.json` files say 0.2.0. The registry version is UNVERIFIED.
- The wrapper types require input `{ input: string }` and output `{ output: string }`. Check them against the LangChain release you test with. Many runnables take or return strings or message objects. Cite the LangChain docs page and date for any claim about LangChain behavior.
- The wrapper has no streaming path. Confirm and say so.
- The package README names "soter.dev" and an alias with an old brand name. Fix the README before linking to the package.
- Confirm what the SDK does on timeout and on 429, and print the real behavior.
- Python: read `packages/python-sdk` for the `protect_chat` signature before writing code.

**Claims to avoid:**
- "Drop-in", "one line", or compatibility with every LangChain version.
- Parity between the JavaScript and Python packages without a test.
- That the wrapper reviews retrieved documents. It sees only the input string and the output string.
- That HUMAN_REVIEW stops the chain. In the shipped wrapper it does not.

**Internal links:**
- "LLM firewall" -> /llm-firewall
- "quickstart" -> /docs/quickstart
- "JavaScript SDK guide" -> /docs/js
- "Python SDK guide" -> /docs/python
- "supported platforms" -> /ai-platform-security
- Utility: /docs/rest-api, /limitations

**CTA:** Follow the quickstart, then run the three synthetic prompts from this post.

**Founder effort:** 9 hours (estimate). Install and tests 3, writing 4, verification 2.

---

## Post 13. DPDP and AI Prompts: What a Team Can Do

**Working title:** DPDP and AI Prompts: What a Team Can Do

**Slug:** `dpdp-ai-prompts-what-a-team-can-do`

**Planned URL:** `/blog/dpdp-ai-prompts-what-a-team-can-do`

**Target query:** "dpdp act ai" (volume UNVERIFIED). Secondary: "dpdp act chatgpt personal data", "dpdp ai prompts" (both UNVERIFIED).

**Cluster and pillar:** Cluster 3b, India: DPDP and AI prompts. Pillar 3, Data leakage and PII. Hub: `/ai-security-india`.

**Search intent:** Informational. A customer or board asked whether the team's prompts are handled correctly.

**Reader and fear:** A founder, CTO or privacy lead at an Indian software company. They fear a customer audit and a bill from a law firm for basics.

**Required text:** The post must say near the top and in the FAQ that it is not legal advice. It must also say that no lawyer has reviewed it, until one has (UNKNOWN today).

**H2 outline:**
1. What this post is and is not (not legal advice)
2. Where personal data enters prompts: support chats, resumes, KYC forms, logs, tool outputs
3. What the law says, in plain words, with section references taken from the Act and Rules text
4. Engineering controls a team can apply now: map the flows, minimize before sending, keep logs short, review provider terms, set retention, write an incident playbook. Each is labelled an engineering control, not a legal conclusion
5. What soterai.in can support (redaction of Indian identifiers, audit export, self-hosting) and what it cannot
6. A one-page worksheet
7. When to call a lawyer
8. What this does not show
9. Frequently asked questions

**Unique repo asset:** The audit export documentation (`/docs/services/audit-exports`), the site's own `/data-retention`, `/subprocessors`, `/privacy` and `/trust` pages as worked examples of the controls, and preset `aadhaar-pan`. Verify each page's content before citing it.

**Evidence to verify before publishing:**
- Read the primary text: the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025, from the Gazette or MeitY. Secondary sources found on 2026-11-09 (DSCI, PwC India, Deloitte India, Legal500, Lexology) disagree on details such as the notification date (13 or 14 November 2025) and the end of the phase-in (one source says 12 May 2027). Use the primary text for every date.
- Counsel review. UNKNOWN. Plan for it before week 11.
- `/ai-security-india` lists "consent management" and "data subject request handling". `public/llms.txt` says compliance content is evidence collection and control mapping only. Reconcile the two before this post links to the page.
- Confirm what each of your own pages says about retention and subprocessors, and that the post matches.
- Two published posts make legal statements this pass did not verify: that processing Aadhaar numbers "requires explicit consent" under the Aadhaar Act and the DPDP Act (FAQ in the PII post), and that Indian enterprises "must comply" with sectoral rules and MeitY guidelines on AI governance (FAQ in the best-practices post). Have counsel check both before post 13 links to them.

**Claims to avoid:**
- That soterai.in makes a team compliant with the DPDP Act or any other law.
- Legal conclusions about whether a given prompt, log or transfer is lawful.
- Penalty amounts, unless quoted from the primary text with the section number.
- Any statement about GDPR or other regimes. No content for them exists.
- Any certification claim (SOC 2, ISO 27001, HIPAA or similar). soterai.in holds none.

**Internal links:**
- "AI security for India" -> /ai-security-india
- "PII detection for Indian businesses" -> /blog/pii-detection-indian-businesses-aadhaar-pan-gstin-compliance
- "AI security best practices for Indian enterprises" -> /blog/ai-security-best-practices-indian-enterprises-2026
- "why the checksum matters" -> /blog/aadhaar-redaction-why-checksum-matters
- "trust center" -> /trust
- Utility: /data-retention, /limitations, /playground?preset=personal-data

**CTA:** Try redaction on made-up data in the playground. For questions, write to support@soterai.in.

**Founder effort:** 12 hours (estimate), plus counsel review time, which is outside this estimate.

---

## Post 14. Scope What Cursor and Copilot Can Read

**Working title:** Scope What Cursor and Copilot Can Read

**Slug:** `scope-what-cursor-and-copilot-can-read`

**Planned URL:** `/blog/scope-what-cursor-and-copilot-can-read`

**Target query:** "cursorignore" (volume UNVERIFIED). Secondary: "copilot content exclusion", "stop ai coding assistant reading env file" (both UNVERIFIED).

**Cluster and pillar:** Cluster 5b, Dev how-to: coding assistants. Pillar 3, Data leakage and PII. Hub: `/ai-data-leakage-prevention`.

**Search intent:** How-to and troubleshooting. The reader set an ignore file and wants to know if it is enough.

**Reader and fear:** A developer or tech lead who fears that an assistant reads `.env` or customer data despite the ignore file.

**H2 outline:**
1. Three ways context reaches a model: indexing, attachments, agent tool reads
2. What each vendor's own documentation says an ignore or exclusion setting covers, and where it stops
3. A canary test you can run: a fake secret in an ignored file, a question that would need it, a record of what happened
4. Rules files and MCP configs as channels for hidden instructions
5. A scope checklist: secrets out of the workspace, narrow workspace folders, separate dev credentials, redact before you paste
6. Where IDE Guard helps and the ceiling it publishes
7. What this does not show
8. Frequently asked questions

**Unique repo asset:** IDE Guard commands (`SoterAI: Scan Before Sending to AI`, `SoterAI: Generate Local Canary Secret`, `Scan MCP Configs`) and the ceiling published in `packages/vscode-extension/README.md` and `README-CLAIMS.md` (summarized in draft 03). The canary experiment is the new material. Its results are UNKNOWN until run.

**Evidence to verify before publishing:**
- Run the canary test on each tool you name, and record version, date and setting. Publish only what you ran.
- Re-fetch the vendor pages (register). On 2026-11-09 the Cursor page said ignored files are blocked from the agent, and that terminal commands and MCP tools may still read them. The GitHub page described a limit for Copilot agents: exclusion applies through Copilot tools and to identifiable paths in commands, might not detect indirect file access, and is not a substitute for operating-system permissions. An older search snippet said agent mode does not support exclusion. The docs changed, so cite only the page as fetched on the day.
- Plan availability for Copilot content exclusion is UNVERIFIED. Read the concept page.
- Rules-file attacks on coding assistants: if you describe them, find and cite the original research. None was verified in this pass.
- `public/llms.txt` says other VS Code-family editors are not tested, while the extension page lists Cursor, Windsurf, Kiro and VSCodium as install targets. Resolve this before saying IDE Guard works in Cursor.

**Claims to avoid:**
- That IDE Guard stops Cursor or Copilot from reading a file.
- That an ignore file makes secrets safe.
- Anything about a vendor's data retention or model training.
- Test results for any tool you did not run.

**Internal links:**
- "AI data leakage prevention" -> /ai-data-leakage-prevention
- "how AI coding tools leak secrets" -> /blog/how-ai-coding-tools-leak-secrets
- "SoterAI IDE Guard" -> /extensions/ide
- "Cursor AI security" -> /cursor-ai-security
- "keep API keys out of coding prompts" -> /blog/keep-api-keys-out-of-ai-coding-prompts
- Utility: /vscode-ai-security, /limitations, /playground?preset=api-key

**CTA:** Run the canary test on your own setup, then install IDE Guard from the extension page.

**Founder effort:** 10 hours (estimate). Canary runs 3, writing 4, vendor-doc reading 1, verification 2.

---

## Post 15. How to Choose an LLM Firewall: Buyer Checklist

**Working title:** How to Choose an LLM Firewall: Buyer Checklist

**Slug:** `how-to-choose-an-llm-firewall-buyer-checklist`

**Planned URL:** `/blog/how-to-choose-an-llm-firewall-buyer-checklist`

**Target query:** "how to choose an llm firewall" (volume UNVERIFIED). Secondary: "llm firewall buyer's guide", "ai guardrails evaluation checklist" (both UNVERIFIED).

**Cluster and pillar:** Cluster 4a, Comparison: buyer's guide. Pillar 1, LLM firewall and AI guardrails (secondary pillar 5). Hub: `/comparison`.

**Search intent:** Commercial investigation. The reader is about to run a vendor trial.

**Reader and fear:** A CTO or engineering lead at a company of 10 to 200 people with an LLM feature. They fear choosing on a demo, then finding false positives, lock-in or a billing block.

**H2 outline:**
1. Start from your surfaces: inputs, replies, retrieved documents, tool calls, employee use
2. Twelve questions for any vendor, including us: what text leaves your network, where it is processed, what is stored and for how long, what the evidence is, who wrote the tests, what the false-positive rate is, what happens when the service is down, how latency was measured, what audit export looks like, whether you can self-host, and what billing and region limits apply
3. How to read a benchmark: four questions, with the table of numbers and limits from `lib/sa/claims.ts` as the worked example
4. A two-week trial plan: run in Monitor mode on real prompts, label a sample of flags, count false positives, decide
5. A blank scoring sheet. No weights are suggested
6. Where soterai.in fits and where it does not
7. What this does not show
8. Frequently asked questions

**Unique repo asset:** `NUMBERS_WITH_LIMITS` in `lib/sa/claims.ts` (seven numbers, each with its test and its limit). The honest-limitations list in `public/llms.txt`. An appendix that answers all twelve questions for soterai.in itself, each with a repo file as evidence.

**Evidence to verify before publishing:**
- Answer every checklist question for soterai.in from the repo, with a file or page for each. Examples: where text goes (the public route can call an LLM judge when `SOTERAI_LLM_JUDGE` is on; whether it is on in production is UNKNOWN), retention (read `/data-retention`), failure behavior (the n8n README says every published version has failed open in Auto mode; check the SDKs), enforcement modes (Monitor, Balanced, Strict per `public/llms.txt`).
- Check that every claim about billing matches `public/llms.txt`: paid plans in INR, international billing not available yet, Free plan works anywhere.
- If any named vendor appears, every fact about it needs a URL and a fetch date. Prefer naming none.

**Claims to avoid:**
- Attacks on or ratings of any vendor.
- "We are the right choice" or "best fit". Write the fit statement from `public/llms.txt` and the limitations.
- That soterai.in fails closed, unless verified.
- A scoring table that grades named competitors.

**Internal links:**
- "AI security vendor comparison" -> /comparison
- "benchmark results and methodology" -> /benchmarks
- "published limitations" -> /limitations
- "four benchmark numbers" -> /blog/prompt-injection-benchmark-honest-numbers
- "firewall versus prompt filter" -> /blog/llm-firewall-vs-prompt-filter
- Utility: /pricing, /trust, /blog/open-source-llm-guardrails-compared, /playground

**CTA:** Start the two-week trial on the Free plan. Say plainly that paid plans are in INR and international billing is not available yet.

**Founder effort:** 8 hours (estimate). Appendix evidence 3, writing 4, verification 1.

---

## Source register

Fetched or searched on 2026-11-09. Re-fetch on publish day. Content was rephrased for compliance with licensing restrictions. No source text is copied into these briefs.

| # | Source | What it supports | Access |
|---|---|---|---|
| S1 | https://api.github.com/repos/NVIDIA/NeMo-Guardrails (redirects to NVIDIA-NeMo/Guardrails) | Not archived. 7,458 stars. Last push 2026-11-09. GitHub license field "Other" (NOASSERTION). | Fetched |
| S2 | https://github.com/NVIDIA-NeMo/Guardrails/blob/develop/LICENSE.md | File header names Apache-2.0 | Fetched |
| S3 | https://api.github.com/repos/guardrails-ai/guardrails | Apache-2.0. Not archived. 7,591 stars. Last push 2026-11-05. | Fetched |
| S4 | https://api.github.com/repos/protectai/llm-guard | MIT. Archived. 3,218 stars. Last push 2026-07-08. | Fetched |
| S5 | https://pypi.org/pypi/llamafirewall/json | Latest version 1.0.3, files uploaded 2025-05-29. License field empty, so license is UNVERIFIED. | Fetched |
| S6 | https://arxiv.org/html/2505.03574v1 | The paper presents LlamaFirewall as an open-source, security-focused guardrail framework for AI agents | Search result only |
| S7 | https://genai.owasp.org/llmrisk/llm072025-system-prompt-leakage/ | LLM07:2025 exists. A system prompt should not be treated as a secret or as a security control. | Fetched |
| S8 | https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/ | LLM08:2025 exists. Covers access control, multi-tenant leakage, data poisoning and hidden text in documents. | Fetched |
| S9 | https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf | Full 2025 list. Too large to fetch, so the other eight rows are UNVERIFIED. | Not fetched |
| S10 | https://thehackernews.com/2025/06/zero-click-ai-vulnerability-exposes.html and https://arxiv.org/abs/2509.10540 | CVE-2025-32711, CVSS 9.3, Microsoft 365 Copilot, fixed, no evidence of exploitation in the wild | Search results only |
| S11 | https://cursor.com/help/customization/ignore-files | Ignored files are blocked from the agent. Terminal commands and MCP tools may still read them. Cursor ignores `.env` files by default. | Fetched |
| S12 | https://docs.github.com/en/copilot/how-tos/content-exclusion/excluding-content-from-github-copilot | Section on limits of exclusion with Copilot agents. Changes can take up to 30 minutes to reach an IDE. | Fetched |
| S13 | https://en.wikipedia.org/wiki/Verhoeff_algorithm | Verhoeff's goal was a decimal check digit that detects all single-digit errors and adjacent transpositions | Search result only |
| S14 | https://uidai.gov.in/en/your-aadhaar and https://uidai.gov.in/en/aadhaar-online-services | Aadhaar is a 12-digit random number. Masked Aadhaar hides the first 8 digits. | Search results only |
| S15 | https://www.dsci.in/files/content/documents/2025/Digital-Personal-Data-Protection-Rules-2025.pdf, PwC India, Deloitte India, Legal500, Lexology | The DPDP Rules were notified in November 2025 with phased commencement. Dates differ by source. | Search results only. Not primary |
