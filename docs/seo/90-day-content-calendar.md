# SoterAI 90-Day Content Calendar

**Date:** 2026-07-28
**Strategy:** Fewer, stronger, evidence-backed assets over high-volume AI content.
**Priority signals used:** Search volume gap, SERP opportunity, product fit, link-earning potential.

---

## DAYS 1–30: Foundation Content (Publish or Refine Existing)

### Week 1 (Days 1-7)

**Asset 1: Refresh "What Is Prompt Injection" blog post**
- Target keyword: `what is prompt injection`, `prompt injection types`, `prompt injection examples`
- URL: `/blog/what-is-prompt-injection-types-examples-prevention` (exists)
- Action: Add 2026 real-world examples (MCP tool injection, indirect injection via web content).
  Add a comparison table of attack types. Add SoterAI detection example.
- Author: SoterAI Security Team (add attribution markup)
- CTA: Link to /prompt-injection-protection + benchmark
- Distribution: Twitter/X thread with a real injection example; DEV Community cross-post
- Link-earning potential: Medium — educational, linkable by devs

**Asset 2: Complete VS Code Marketplace listing**
- Action: Ensure description, screenshots, demo GIF, and review prompt are on the listing
- This is a trust signal for `/vscode-ai-security` rankings and brand entity
- Not published content but mandatory for SEO entity strength

**Asset 3: About page (new — already created in code)**
- URL: `/about`
- Provides E-E-A-T signal: company, mission, founding date, team, contact
- Author: SoterAI team
- CTA: Links to signup and docs

---

### Week 2 (Days 8-14)

**Asset 4: "MCP Security for Developers: Complete 2026 Guide" — upgrade existing post**
- Target keyword: `MCP security`, `model context protocol security`, `secure MCP servers`
- URL: `/blog/mcp-security-for-developers` (exists)
- Action: Expand to 2500+ words. Add: threat model diagram (even SVG), real MCP server
  config examples, SoterAI MCP scanner output screenshot, tool permission analysis table.
- Why: SERP shows cyberkendra.com, truefoundry.com, strac.io winning with long guides.
  SoterAI has the product but needs content depth.
- Author: SoterAI Security Team
- CTA: Link to /mcp-security + /integrations/n8n
- Distribution: Hacker News Show HN (if substantial enough), DEV Community, Twitter thread

**Asset 5: "AI Security for Indian Enterprises 2026" — upgrade existing post**
- Target keyword: `AI security India`, `India PII detection`, `DPDP AI compliance`
- URL: `/blog/ai-security-best-practices-indian-enterprises-2026` (exists)
- Action: Add DPDP Act 2026 Rules update, Aadhaar detection example, SoterAI Indian PII
  scan output, compliance mapping table (DPDP requirements → SoterAI controls)
- Why: This is SoterAI's highest-probability Top-3 opportunity.
  Competition is thin; product is differentiated.
- Distribution: LinkedIn (India developer/security groups), PluggedIn newsletter, YourStory

---

### Week 3 (Days 15-21)

**Asset 6: India PII Benchmark Dataset — Hugging Face**
- Asset type: Dataset on Hugging Face Hub (with Dataset Card)
- Description: 1,000 synthetic Indian PII examples across Aadhaar, PAN, GSTIN, UPI,
  IFSC, Indian mobile numbers, ABHA — with entity labels and detection results
- Why: Creates a citable, linkable asset. Indian compliance researchers will link to it.
  Confirms SoterAI's India expertise to Google's entity system.
- Link to: `/ai-security-india` and `/benchmark`
- Author: SoterAI (Dataset card cites the company)
- Distribution: Hugging Face discussions, Indian ML community (TFUG, etc.), LinkedIn
- Note: Dataset must be entirely synthetic — no real PII under any circumstances.

**Asset 7: MCP Security Checklist — GitHub**
- Asset type: GitHub Markdown file / interactive checklist at `/mcp-security-checklist`
  (or as a Gist-style resource)
- Content: 25-item checklist for securing MCP server deployments
  (tool permissions, input validation, output filtering, audit logging, etc.)
- Why: "MCP security checklist" has zero dedicated ranking pages. First-mover advantage.
  Checklist content earns links naturally from developer blog posts.
- Link to: `/mcp-security` and `/blog/mcp-security-for-developers`
- Distribution: Hacker News, DEV Community, MCP Discord/Slack channels

---

### Week 4 (Days 22-30)

**Asset 8: Submit SoterAI to Product Hunt**
- Action: Create Product Hunt launch page with genuine product description, demo GIF,
  and real use case (India PII protection for LLMs)
- This creates: a high-DA backlink (producthunt.com), community visibility,
  and brand entity signal
- Timing: Tuesday or Wednesday launch for maximum visibility
- Prepare: Twitter/X pre-launch thread, LinkedIn post, Hacker News comment in relevant thread
- Note: Do not ask for upvotes in a way that violates Product Hunt's guidelines

---

## DAYS 31–60: Original Research and Integration Depth

### Week 5–6 (Days 31-44)

**Asset 9: "State of MCP Security 2026" Research Report**
- Target keyword: `MCP security 2026`, `model context protocol security`
- URL: `/blog/state-of-mcp-security-2026` (new)
- Content (2500-4000 words):
  - Analysis of 100+ public MCP servers (tool permission scope, missing auth)
  - Common misconfiguration patterns found (data, not personal speculation)
  - Comparison of MCP attack surface vs. traditional API
  - SoterAI detection methodology (cite the scanner)
  - Actionable developer guidance
- Unique contribution: Original data from actual MCP server analysis.
  This is why competitors cannot instantly replicate it.
- Required evidence: Run SoterAI MCP scanner on 50-100 public MCP repos.
  Record real findings. Anonymise repo identifiers.
- Author/reviewer: SoterAI Security Research (name attribution preferred)
- CTA: /mcp-security, /docs/mcp, /signup
- Distribution: Hacker News Show HN, arXiv preprint (optional), DEV Community,
  cyberkendra.com outreach for coverage

**Asset 10: n8n + Zapier + Make Integration Pages (already created in code)**
- URLs: `/integrations/n8n`, `/integrations/zapier`, `/integrations/make`
- Action: Already implemented. Now distribute:
  - n8n community forum post
  - Zapier community post
  - Make community post
- These posts will drive direct traffic and organic links from official community sites

---

### Week 7–8 (Days 45-60)

**Asset 11: "AI Coding Assistant Threat Model" — Technical Deep-Dive**
- Target keyword: `AI coding assistant security risks`, `copilot security risks`,
  `cursor security`, `windsurf security`
- URL: `/blog/ai-coding-assistant-threat-model` (new)
- Content (2000-3000 words):
  - Threat categories: context exfiltration, MCP tool abuse, prompt injection in files,
    supply chain poisoning via AI suggestions, indirect injection from dependencies
  - Each threat with: attack vector, real-world example (where public), detection method,
    SoterAI IDE Guard coverage, residual risk
  - Coverage by IDE: VS Code, Cursor, Windsurf
- Unique contribution: Most competitor content covers "AI security" generically.
  A threat-model article specifically for IDE AI is a gap.
- CTA: /vscode-ai-security, /cursor-ai-security, /windsurf-ai-security
- Distribution: GitHub Security blog outreach, security.stackexchange.com canonical reference,
  DEV Community, Twitter security community

**Asset 12: DPDP Compliance Page**
- URL: `/compliance/dpdp` (new)
- Target keyword: `DPDP AI compliance`, `DPDP Act AI`, `AI security DPDP`
- Content: How SoterAI helps organisations meet DPDP Act 2023 obligations for AI systems.
  Map DPDP data principal rights to specific SoterAI controls. State explicitly what
  SoterAI does and does not cover for DPDP compliance. Include link to official DPDP text.
- Required evidence: Review actual DPDP Act 2023 sections relevant to AI.
  Do not make compliance claims that are not supportable.
- CTA: /enterprise-ai-security, /contact-sales
- Distribution: LinkedIn India compliance/legal community

---

## DAYS 61–90: Distribution, CTR Optimisation, and Refresh

### Week 9–10 (Days 61-74)

**Asset 13: Prompt Injection Benchmark v2 — Public Release**
- URL: `/benchmark` (upgrade existing)
- Action: Add a publicly reproducible test suite to GitHub.
  Clearly label: self-maintained, not an independent audit.
  Add: test methodology, dataset source, false-positive rate, false-negative rate,
  tested model versions and dates.
- Why: Self-published benchmarks with public reproducible data are far more credible
  than proprietary charts. Academic and security bloggers will cite reproducible benchmarks.
- Distribution: arXiv preprint (optional), GitHub release, DEV Community,
  outreach to AI security researchers who have cited OWASP LLM

**Asset 14: Outreach Campaign — Roundup Articles**
- Targets: edgelabs.ai, cyberkendra.com, appsecsanta.com, generalanalysis.com,
  futureagi.com, nightfall.ai
- Approach: "We noticed you didn't include SoterAI in your [article title].
  Here's what makes it different: [3 specific differentiators].
  Here's our benchmark data: [link]. Happy to provide a demo."
- Required per outreach: Personalised email, specific reference to their article,
  concrete data point, no spam
- Expected outcome: 1-3 inclusions = 3-5 high-DA backlinks in relevant context

**Asset 15: YouTube Demo Video**
- Content: 5-minute demo showing: secret detection in VS Code, prompt injection block,
  MCP config scan, n8n integration guard
- Why: YouTube = second search engine. Video evidence strengthens E-E-A-T.
  VideoObject schema on the demo page earns rich result eligibility.
- Distribution: YouTube, embedded on /demo and /vscode-ai-security

---

### Week 11–13 (Days 75-90)

**Asset 16: GSC CTR Optimisation Sprint**
- Action: Export GSC data. Find pages ranking positions 7-20 with >100 impressions.
  A/B test new title tags and meta descriptions to improve CTR.
- Evidence required: GSC before/after CTR comparison (minimum 2-week window)
- No content changes needed — only metadata

**Asset 17: "What Is RAG Security" Educational Blog Post**
- Target keyword: `RAG security`, `RAG poisoning`, `vector database security`
- URL: `/blog/what-is-rag-security-vector-database-threats` (new)
- Content: Explain RAG pipeline components, where attacks happen, what RAG poisoning is,
  real example of indirect prompt injection via poisoned document, SoterAI RAG guard coverage
- CTA: /rag-security

**Asset 18: First Quarterly Content Refresh**
- Review all 8 existing blog posts for:
  - Outdated statistics (update with 2026 data)
  - Broken or outdated outbound links
  - Missing CTAs
  - New internal linking opportunities
  - Missing author attribution
- Update `datePublished` / `dateModified` metadata
- Republish with a "Updated [date]" note

---

## Evergreen Content Principles

1. **Every post needs a unique contribution.** What can we say that no one else can?
   (Our own detection data, our own product screenshots, India-specific examples.)

2. **State what we measured, how, and when.** Security content without methodology
   dates badly and looks like marketing copy.

3. **Link to our own limitations.** Every post that makes a detection claim should
   link to /limitations. This is a trust signal, not a weakness.

4. **Author attribution on every post.** Minimum: "By SoterAI Security Team, reviewed [date]."
   Better: a named engineer with a LinkedIn profile.

5. **Update schedule.** Every post should have a stated review schedule (quarterly for
   technical posts, annually for foundational explainers).
