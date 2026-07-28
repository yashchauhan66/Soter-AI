# SoterAI Digital PR and Backlink Strategy

**Date:** 2026-07-28
**Guiding principle:** Earn links through genuine value. No paid links, no spam,
no PBNs, no comment spam. Every tactic here is white-hat and defensible.

---

## Current Authority Status

- Estimated DR: Very low (1-15 range estimated — unverified, requires Ahrefs/Semrush)
- Confirmed external backlinks from search observation: 0 editorial links found
- Brand mentions in roundup articles: 0 found
- GitHub stars/forks: Unknown (confirm in repo settings)
- VS Code Marketplace installs: Unknown (confirm in Marketplace publisher portal)
- Product Hunt listing: Not observed

---

## Tier 1: Low-Cost, High-Impact (Days 1–30)

### 1. VS Code Marketplace Listing (Free, High Impact)
- **Action:** Complete the Marketplace listing: screenshot at each feature, demo GIF,
  accurate description targeting "VS Code AI security extension", categories filled,
  tags include "security", "ai", "copilot", "mcp"
- **Why:** Marketplace listing = high-DA microsoft.com link + trust signal for /vscode-ai-security
- **Effort:** 2-4 hours

### 2. npm Package (@soterai/sdk)
- **Action:** Ensure the npm package has: full README with install + quickstart,
  keywords array including "ai security", "prompt injection", "llm guard", "mcp security",
  homepage pointing to soterai.in, repository pointing to GitHub
- **Why:** npmjs.com is high-DA; developer discovery; brand entity signal
- **Effort:** 1-2 hours

### 3. GitHub Repository
- **Action:** Ensure primary repo has: detailed README, Topics/tags
  (ai-security, prompt-injection, mcp-security, llm-guard, india-pii),
  homepage URL = soterai.in, description clear, link to VS Code Marketplace
- **Why:** github.com is extreme-DA; developer entity signal; Google Knowledge Panel eligibility
- **Effort:** 1 hour

### 4. Product Hunt Launch
- **Action:** Create a PH listing for "SoterAI Guard — AI Security for LLMs and IDE Workflows"
- **Expected:** PH dofollow link from producthunt.com (DA ~90), community visibility, 
  potential Press/media coverage if product earns top-5
- **Timing:** Tuesday or Wednesday for max exposure
- **Prep:** Demo GIF, tagline, 3 bullet points, product screenshots, makers filled in
- **Effort:** 4-6 hours preparation + launch day monitoring

### 5. LinkedIn Company Page
- **Action:** Create SoterAI company page. Post: product screenshots, MCP security content,
  India PII examples, hiring/team updates
- **Why:** LinkedIn = high-DA entity signal. Google uses LinkedIn for Knowledge Graph company data.
- **Effort:** 1 hour setup, then 1-2 posts/week

---

## Tier 2: Content-Led Link Building (Days 15–60)

### 6. OWASP Community
- **Target:** OWASP LLM Security project GitHub, OWASP India chapter
- **Angle:** Contribute to the OWASP LLM Top 10 project resource list or wiki;
  reference the India PII benchmark dataset; offer SoterAI as a testing tool for OWASP LLM
- **Link source:** owasp.org (very high authority) or OWASP GitHub
- **Effort:** Medium

### 7. Hugging Face Dataset Publication
- **Target:** huggingface.co/datasets
- **Asset:** India PII synthetic benchmark dataset (see content calendar Asset 6)
- **Link source:** huggingface.co (high DA, trusted by Google for AI research)
- **Effort:** 2 days to create quality dataset card

### 8. DEV Community (dev.to)
- **Target:** dev.to/soterai (create organisation account)
- **Angle:** Republish blog posts (with canonical pointing to soterai.in) +
  original short-form content (MCP security tips, secret scanning quickstart)
- **Link source:** dev.to (DA 85+)
- **Effort:** Low per post, ongoing

### 9. Hacker News (Show HN)
- **Target:** news.ycombinator.com
- **Angle:** "Show HN: SoterAI — local-first AI context firewall for VS Code/Cursor/Windsurf"
  OR "Show HN: India PII detection benchmark for LLMs — 1,000 synthetic examples"
- **Requirement:** Content must be genuinely interesting to HN developers.
  Show HN posts that demonstrate working demos or original research perform best.
- **Link source:** ycombinator.com (DA 90+)
- **Risk:** HN community is discerning — over-marketing is downvoted. Must be genuinely useful.
- **Effort:** Low to post, high to prepare genuinely good content

### 10. n8n Community Forum
- **Target:** community.n8n.io
- **Asset:** `/integrations/n8n` page + "How to add SoterAI to your n8n AI workflow" post
- **Link source:** community.n8n.io (high-authority, developer audience)
- **Effort:** 30 minutes to post

### 11. Zapier Community
- **Target:** community.zapier.com
- **Asset:** `/integrations/zapier` page + tutorial post
- **Effort:** 30 minutes

### 12. Make Community (Integromat)
- **Target:** community.make.com
- **Asset:** `/integrations/make` page + tutorial post
- **Effort:** 30 minutes

---

## Tier 3: Outreach and PR (Days 30–90)

### 13. Roundup Article Inclusion Outreach

| Target publication | Article to pitch | Angle |
|-------------------|-----------------|-------|
| edgelabs.ai | "Best AI security tools" / "Best MCP security tools" | MCP-specific tooling, India PII differentiation |
| cyberkendra.com | "Best MCP security tools in 2026" | Already covers MCP — SoterAI has a dedicated /mcp-security page |
| appsecsanta.com | "Best AI security tools 2026" | Local-first, free tier, India PII detection |
| generalanalysis.com | "Best AI security platforms 2026" | Developer-first, self-hosted option |
| nightfall.ai | Context only (competitor) | Not applicable |
| itwire.com | "Best agentic AI security companies" | Listed 8 companies; pitch for inclusion |
| futureagi.com | "Best AI guardrails tools" | Self-hosted Guardrails, India market |

**Outreach template structure:**
1. Personalised opening (reference specific section of their article)
2. One-paragraph product description focused on their coverage gap
3. Three specific differentiators with evidence (benchmark link, India PII link)
4. Offer: Free account + demo + any data they need for their article
5. No reciprocal link request — only ask for inclusion on merit

### 14. Security Newsletter Outreach

| Newsletter | Audience | Pitch angle |
|------------|---------|-------------|
| tl;dr sec | Security practitioners | "Local-first AI context firewall for VS Code / Cursor / Windsurf — detect secrets and injections before the model sees them" |
| Unsupervised Learning | Security + AI | India PII benchmark dataset |
| Last Week in AI Security | AI security community | State of MCP Security 2026 research report |
| CISO Series | Enterprise security | Enterprise AI security, DPDP compliance |

### 15. Researcher Outreach
- Identify researchers who have cited OWASP LLM Top 10, MCP security papers, or IDE security papers
- Reach out with: India PII benchmark, prompt injection test suite, relevant benchmark data
- Goal: Academic citation in future papers
- Effort: High but highest-quality backlinks

### 16. Conference Submissions (Days 60-90)
- **Targets:** OWASP AppSec, DevSecCon, NullCon (India), c0c0n (Kerala), DEF CON AI Village
- **Angle:** "Local-first AI context firewall: threat model and architecture" OR
  "India PII in LLM prompts: a detection study"
- **Why:** Conference talk → proceedings page → media coverage → multiple editorial backlinks
- **Lead time:** Most CFPs close 3-6 months before the event

---

## Link Quality Standards

**What we will pursue:**
- Editorial links from genuine content (roundup articles, research citations, tutorials)
- Directory links from reputable developer/security directories
- Community links from official platform communities (n8n, Zapier, Make)
- Social profile links (LinkedIn, GitHub, npm, VS Code Marketplace, Product Hunt)
- Academic citations (Hugging Face, arXiv if applicable)

**What we will reject:**
- Paid links (even disclosed as sponsored)
- Links from PBNs or link farms
- Comment spam
- Mass guest-post link exchanges
- Reciprocal link schemes
- Links from unrelated industries (health, finance, gaming)

---

## Monthly Link Acquisition Targets (Realistic)

| Month | Target new links | Target type |
|-------|-----------------|-------------|
| Month 1 | 3-5 links | VS Code Marketplace, npm, GitHub, Product Hunt, LinkedIn |
| Month 2 | 5-10 links | n8n/Zapier community, DEV Community posts, 1-2 roundup inclusions |
| Month 3 | 8-15 links | Research citations, conference outreach, newsletter features |

These are conservative and achievable. Do not set volume targets that incentivise
buying links or publishing spam.
