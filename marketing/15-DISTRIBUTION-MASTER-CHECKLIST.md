# 15 — Distribution Master Checklist

**Purpose:** every place SoterAI can be listed, ranked by expected return per hour of effort. This is the "jaha jaha marketing ho sakti hai" list — work top to bottom.

**Rule for every row:** the listing must link to `https://soterai.in/playground` (activation event), not the homepage. Use the UTM convention from `13-SEPTEMBER-2026-GROWTH-SPRINT.md` §6 with `utm_medium=marketplace` or `utm_medium=directory`.

**Trust rules apply everywhere** (see `13-…-GROWTH-SPRINT.md` §7 and `tests/marketing-launch-claims.test.ts`): no "100% secure", no "SOC 2 compliant", no "independently validated". Every performance number ships with "self-maintained synthetic benchmark, not a third-party audit" and the blind held-out figure.

Status legend: `[ ]` not started · `[~]` submitted, awaiting review · `[x]` live

---

## Tier 0 — Package registries you already own (highest intent, lowest effort)

These are search engines, not just registries. A developer typing "prompt injection" into npm search is closer to installing than anyone on LinkedIn.

| # | Channel | Action | Why it ranks |
|---|---|---|---|
| `[x]` | npm `@soterai/core` | Verify keywords cover: `prompt-injection`, `llm-security`, `ai-guardrails`, `pii-redaction`, `ai-agent-security`, `jailbreak-detection`, `mcp` | npm search weights keywords + README H1 |
| `[x]` | PyPI `soter` | Same keyword set in `pyproject.toml` classifiers + `keywords`; long_description = full README | PyPI ranks on name + summary + keywords |
| `[x]` | Open VSX `soterai-ide-guard` | Categories: Linters, Other. 5 gallery screenshots minimum | Default registry for Cursor/Windsurf |
| `[ ]` | VS Code Marketplace | Same extension, separate publisher verification — `docs/vscode-publisher-verification.md` | Largest developer-tool search surface |
| `[x]` | npm `n8n-nodes-soterai` | Keep the `n8n-community-node-package` keyword — required for n8n in-app search | Already the #1 organic channel |
| `[ ]` | n8n Creator Hub / templates | Publish 3: "Guard a chatbot", "Redact PII before Sheets", "Approve agent action" | Templates outrank node listings |
| `[ ]` | Docker Hub | Publish `soterai/soterai`, README from `DEPLOY-GUIDE.md` | "self-hosted llm firewall" lands here |
| `[ ]` | GitHub Marketplace (Actions) | Ship a `soterai-scan` action wrapping `@soterai/cli` | Free listing, CI-adjacent audience |
| `[ ]` | Homebrew tap | `brew install soterai/tap/soterai` for the CLI | Maturity signal for senior devs |

---

## Tier 1 — Developer discovery platforms

| # | Channel | Notes |
|---|---|---|
| `[ ]` | **Awesome lists** | Highest-leverage backlinks in OSS. Full PR kit in `18-AWESOME-LISTS-OSS-PR-KIT.md` |
| `[ ]` | OWASP LLM Top 10 tooling landscape | You map all 10 categories — the most credible listing available to you |
| `[ ]` | StackShare | Create the SoterAI tool page, add it to your own stack |
| `[ ]` | Libraries.io | Auto-indexes npm/PyPI; verify repo + homepage are correct |
| `[ ]` | OpenSSF Scorecard badge | Run it, fix what it flags, badge it in the README. Security buyers check |
| `[ ]` | Dev.to organization | Cross-post the 8 existing `/blog` posts with `canonical_url` back to soterai.in |
| `[ ]` | Hashnode | Same canonical-URL cross-post |
| `[ ]` | Medium / Hacker Noon | Same. Never publish without the canonical tag |
| `[ ]` | Lobste.rs | Only after HN. Tags `security`, `ai`. One post, no self-promo streak |
| `[ ]` | Peerlist | India-heavy dev audience — matches the India wedge |
| `[ ]` | IndieHackers product page | Build-in-public log; posts get email distribution |

---

## Tier 2 — SaaS / AI directories

Low effort, mostly one form each. Do a batch of ten in one sitting.

| # | Directory | Priority |
|---|---|---|
| `[ ]` | AlternativeTo — list as an alternative to Lakera Guard, LLM Guard, Guardrails AI, NeMo Guardrails | High — captures the "X alternative" intent that `/comparison/*` also targets |
| `[ ]` | SaaSHub | High — ranks well for "vs" queries |
| `[ ]` | G2 | High for enterprise credibility. Needs 1 verified review to go live |
| `[ ]` | Capterra / GetApp / Software Advice (one Gartner backend, one submission) | Medium — B2B buyer traffic |
| `[ ]` | Slashdot / SourceForge software directory | Medium — strong domain authority |
| `[ ]` | There's An AI For That | Medium — high traffic, low intent |
| `[ ]` | Futurepedia | Medium — same profile |
| `[ ]` | Toolify.ai | Low-medium |
| `[ ]` | AI Tool Hunt / OpenTools / Insidr | Low — batch these last |
| `[ ]` | BetaList | One-shot, launch-timed only |
| `[ ]` | Product Hunt | ✅ Kit complete — `14-PRODUCTHUNT-TOP5-LAUNCH-PLAYBOOK.md` |
| `[ ]` | Uneed / Fazier / MicroLaunch | Small PH alternatives; cheap extra launch days |

---

## Tier 3 — Security-specific surfaces

Where your actual buyers are, and almost no AI-directory competitor bothers.

| # | Channel | Notes |
|---|---|---|
| `[ ]` | OWASP Slack `#project-top10-for-llm` | Participate first, share second |
| `[ ]` | MITRE ATLAS community | Map your detectors to ATLAS techniques, publish the mapping |
| `[ ]` | CISA Secure by Design pledge | Free, public, a real trust signal for `/trust` |
| `[x]` | `security.txt` | Already at `public/.well-known/security.txt` |
| `[ ]` | HackerOne / huntr disclosure policy page | Signals you take reports seriously |
| `[ ]` | r/netsec, r/cybersecurity, r/AskNetsec | Strict rules. Value-first only — see `03-reddit-communities.md` |
| `[ ]` | Detection-engineering / blue-team Discords | Share the red-team corpus, not the product |
| `[ ]` | tl;dr sec newsletter | Pitch the benchmark methodology, not the product |
| `[ ]` | Risky Business / Security Now | Pitch the blind-held-out honesty angle — genuinely newsworthy |
| `[ ]` | Null / OWASP India chapters | Offer a free workshop. India wedge, in person |

---

## Tier 4 — Integration marketplaces (partner-led distribution)

Each one puts you inside someone else's funnel permanently.

| # | Marketplace | Status in repo |
|---|---|---|
| `[ ]` | LangChain integrations directory | `@soterai/langchain-middleware` published — submit the docs page |
| `[ ]` | LlamaIndex integrations | `@soterai/llamaindex-middleware` published — submit |
| `[ ]` | Vercel integrations marketplace | `@soterai/vercel-ai-sdk-middleware` published — submit |
| `[ ]` | MCP server registry / awesome-mcp-servers | `@soterai/mcp-gateway` published — highest-momentum ecosystem right now |
| `[ ]` | Cursor / Windsurf extension directories | Extension already on Open VSX |
| `[ ]` | JupyterLab extension registry | Code in `extensions/jupyterlab` — **not published, do not list yet** |
| `[ ]` | WordPress plugin directory | Code exists — **not published, do not list yet** |
| `[ ]` | Zapier / Make | Needs a public API app — scope after n8n proves the pattern |
| `[ ]` | Chrome Web Store / Edge Add-ons | `apps/extension` — **blocker B1 in `00-START-HERE`, still open** |

> **Do not list anything from the README's "In this repo, not yet published" section.** Listing an unpublished thing is the fastest way to lose the trust that honest benchmarking earned you.

---

## Tier 5 — Answer engines (detail in `16-AEO-AI-ANSWER-ENGINE-PLAYBOOK.md`)

| # | Surface | Status |
|---|---|---|
| `[x]` | `public/llms.txt` | Rewritten — full capability, proof, and limitation coverage |
| `[x]` | `app/robots.ts` AI crawler allowlist | 17 answer-engine crawlers explicitly allowed |
| `[x]` | JSON-LD entity graph | Organization + WebSite site-wide; Article/FAQ/Breadcrumb per page |
| `[x]` | Organization `sameAs` | Fixed — was pointing at a 404 repo and a non-existent npm package |
| `[ ]` | Bing Webmaster Tools | Required — Bing's index feeds ChatGPT search |
| `[ ]` | Google Search Console | Submit `sitemap.xml`, request indexing on `/comparison/*` |
| `[ ]` | Wikidata entity | Makes the brand resolvable to every answer engine at once |

---

## Weekly operating rhythm

| Day | Action | Time |
|---|---|---|
| Mon | 3 Tier-2 directory submissions | 30 min |
| Tue | 1 Awesome-list PR (`18-…`) | 30 min |
| Wed | 1 blog cross-post with canonical URL | 20 min |
| Thu | 1 security-community contribution (no link) | 30 min |
| Fri | Update this file's checkboxes + log activated users by source | 15 min |

Two hours a week. Every row is permanent — a directory listing keeps working after you stop.

---

## Measurement

Every listing gets a UTM. At month end, sort by **activated users**, not clicks. Keep anything that produced an activation; stop re-investing in anything that produced only impressions.

```text
Date | Tier | Channel | Live? | Sessions | Playground scans | Activated | Notes
```
