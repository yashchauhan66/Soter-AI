# Phase 15 -- Backlink and Distribution Plan

> **Goal:** Build high-quality, sustainable backlinks and distribution channels for SoterAI through educational content, community participation, and marketplace presence. No spam. No link schemes. Earn every link.

---

## Ground Rules

1. **Educational first.** Every post, comment, and listing must provide genuine value before mentioning SoterAI.
2. **Transparent beta status.** Always disclose that SoterAI is in beta. Never overstate capabilities.
3. **No astroturfing.** One account, real identity, honest opinions.
4. **Demo + GitHub + Marketplace link.** Every distribution touchpoint should include at least two of these three.
5. **Respect community norms.** Read each community's rules before posting. Lurk before you launch.
6. **Track everything.** Use UTM parameters for every link: `?utm_source=<platform>&utm_medium=<type>&utm_campaign=<campaign>`.

---

## Target Channels

### 1. GitHub Repository README

**URL:** github.com/soterai/ai-agent-security-guard (or equivalent)  
**SEO Value:** High (GitHub ranks well, README is indexed by Google)  
**Backlink Type:** Dofollow from GitHub profile and README

**Optimization Strategy:**
- **Title (H1):** "SoterAI IDE Guard -- Local-First AI Security for Developers"
- **Description line:** "Protect your secrets, prompts, MCP tools, and AI context locally before they reach any AI. VS Code extension with cross-IDE roadmap."
- **Badges row:** Version, VS Code Marketplace installs, license (MIT/Apache), build status, Discord members
- **Topics (repo tags):** `ai-security`, `vscode-extension`, `prompt-injection`, `secret-scanning`, `mcp`, `developer-tools`, `security`, `local-first`, `privacy`, `copilot`, `cursor`, `claude`
- **About section:** Short description + website link (soterai.in) + tags
- **README sections:** Problem statement, 3-step quick start, feature list with GIFs, architecture diagram, comparison table, contributing guide, license
- **Link placement:** Website link in repo About, Marketplace link in README, docs link in README
- **Social preview image:** Custom OG image (1280x640) with SoterAI logo, tagline, and dark theme

**Actions:**
- [ ] Optimize repo description and topics
- [ ] Add social preview image
- [ ] Add badges to README
- [ ] Add "Star History" chart
- [ ] Add CONTRIBUTING.md with first-timer-friendly issues
- [ ] Add GitHub Discussions for community Q&A

---

### 2. VS Code Marketplace

**URL:** marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard  
**SEO Value:** Very High (marketplace pages rank for "[tool] VS Code extension" queries)  
**Backlink Type:** Dofollow from Microsoft domain

**Optimization Strategy:**
- See Phase 13 (docs/seo/vscode-marketplace-seo.md) for full README structure
- **Keywords in description:** AI security, secret scanning, prompt injection, MCP security, local-first, Copilot security, Cursor security
- **Categories:** Security, Linters (primary discoverability categories)
- **Changelog:** Keep updated -- marketplace rewards active extensions
- **Ratings:** Prompt early beta users to leave honest reviews after 1 week of use
- **Q&A tab:** Monitor and respond within 24 hours
- **Link back:** Include soterai.in, GitHub repo, and docs links in the marketplace README

**Actions:**
- [ ] Update marketplace README (see Phase 13)
- [ ] Add 3-5 screenshots with captions
- [ ] Add marketplace banner image
- [ ] Set up review request flow (in-extension prompt after 7 days)
- [ ] Monitor Q&A tab weekly

---

### 3. Open VSX Registry

**URL:** open-vsx.org/extension/soterai/soterai-ide-guard  
**SEO Value:** Medium (secondary marketplace, indexed by Google)  
**Backlink Type:** Dofollow from Eclipse Foundation domain

**Strategy:**
- Mirror the VS Code Marketplace listing exactly
- Publish simultaneously with VS Code Marketplace releases
- Important for users of VSCodium, Gitpod, Eclipse Theia, and other open-source VS Code forks
- Add Open VSX badge to GitHub README

**Actions:**
- [ ] Create Open VSX publisher account
- [ ] Publish extension to Open VSX
- [ ] Add Open VSX install link to README and docs

---

### 4. JetBrains Marketplace (Future)

**URL:** plugins.jetbrains.com/plugin/xxxxx-soterai  
**SEO Value:** High (JetBrains marketplace ranks well for IDE plugin queries)  
**Backlink Type:** Dofollow from JetBrains domain

**Strategy (when JetBrains plugin ships):**
- Cross-link between VS Code and JetBrains listings
- Target keywords: "AI security IntelliJ", "secret scanning JetBrains", "AI coding security IntelliJ IDEA"
- Use JetBrains-specific screenshots and feature descriptions
- Leverage JetBrains Marketplace "Related plugins" algorithm by tagging correctly

**Actions (future):**
- [ ] Complete JetBrains plugin development
- [ ] Create JetBrains Marketplace listing with optimized description
- [ ] Cross-link all marketplace listings

---

### 5. npm Packages

**Packages:** `@soterai/guard-core`, `@soterai/cli`  
**SEO Value:** Medium (npmjs.com is heavily indexed)  
**Backlink Type:** Dofollow from npmjs.com

**Optimization Strategy:**
- **README:** Must be standalone and compelling (npm renders the README as the package page)
- **Keywords field in package.json:** `ai-security`, `secret-scanning`, `prompt-injection`, `mcp`, `llm-security`, `developer-security`, `dpdp`, `pii-detection`
- **Description:** Clear, keyword-rich one-liner
- **Homepage:** Link to soterai.in
- **Repository:** Link to GitHub repo
- **Provenance:** Enable npm provenance for supply chain trust signal

**Actions:**
- [ ] Optimize package.json keywords for both packages
- [ ] Write standalone README for each package
- [ ] Enable npm provenance
- [ ] Add "Used by" section if any public projects adopt

---

### 6. Product Hunt

**URL:** producthunt.com/posts/soterai-ide-guard  
**SEO Value:** High (PH posts rank well and earn dofollow links)  
**Backlink Type:** Dofollow from Product Hunt

**Launch Strategy:**
- **Launch day:** Tuesday or Wednesday (highest engagement)
- **Launch time:** 12:01 AM PT (full 24-hour window)
- **Hunter:** Self-hunt or find a hunter with > 1,000 followers in the dev tools space
- **Tagline:** "See what AI sees. Protect what AI touches. All local."
- **Topics:** Developer Tools, Artificial Intelligence, Cybersecurity, Privacy, VS Code
- **Gallery:** 5 images -- hero banner, 3 feature screenshots, architecture diagram
- **First comment:** Founder story (see Phase 14 for draft)
- **Engagement plan:** Respond to every comment within 1 hour for the first 12 hours

**Pre-launch checklist:**
- [ ] Collect 50+ supporters before launch (personal network, beta users)
- [ ] Prepare all gallery assets (1270x760 recommended)
- [ ] Draft maker comment and FAQ answers
- [ ] Notify beta users and ask for upvotes (not fake votes -- genuine supporters)
- [ ] Schedule social media posts for launch day

---

### 7. Hacker News

**SEO Value:** Very High (HN front page links are massive authority signals; comments get indexed)  
**Backlink Type:** Nofollow (but referral traffic + brand awareness are extremely valuable)

**Strategy:**
- **Show HN post:** Use the draft from Phase 14. Post between 8-10 AM ET on Tuesday-Thursday.
- **Engage deeply:** HN values technical depth. Respond to every comment with substance.
- **Follow-up posts:** After the Show HN, post individual blog posts that reach HN (target: "MCP Security" and "Prompt Injection in Repos" are most likely to resonate).
- **Do NOT:** Ask for upvotes, post multiple times in a week, or use clickbait titles.

**Actions:**
- [ ] Post Show HN (Week 3, Day 19)
- [ ] Monitor comments for 48 hours, respond to all
- [ ] Post 1-2 blog posts to HN in Week 4 (only if genuinely interesting to the HN audience)

---

### 8. Reddit (Per-Subreddit Strategy)

#### r/vscode (650K+ members)
**Post type:** "I made a VS Code extension" showcase  
**Angle:** Focus on what the extension does in VS Code specifically. Screenshots. GIFs.  
**Flair:** Extension / Theme  
**Frequency:** One launch post, then only when major features ship  
**Do:** Share VS Code-specific features, respond to feature requests  
**Don't:** Post more than once per month, ignore critical feedback

#### r/cybersecurity (800K+ members)
**Post type:** Discussion / tool share  
**Angle:** Frame as a security research finding ("I analyzed what AI coding assistants send to remote servers, here's what I found") with the tool as the solution  
**Frequency:** One post, followed by educational comments in related threads  
**Do:** Provide technical depth, share threat models, cite CVEs  
**Don't:** Lead with the product, make unsubstantiated security claims

#### r/webdev (2.5M+ members)
**Post type:** Showoff Saturday or general post  
**Angle:** "How to protect your secrets when using AI coding assistants"  
**Frequency:** One post, then contribute to AI security discussions  
**Do:** Focus on practical developer workflow improvements  
**Don't:** Post outside Showoff Saturday for self-promotion

#### r/programming (6M+ members)
**Post type:** Link post to a technical blog  
**Angle:** Submit the "MCP Tool Security" or "Prompt Injection in Repos" blog post  
**Frequency:** One post per month maximum  
**Do:** Let the content speak for itself  
**Don't:** Self-promote in comments, post low-effort content

#### r/selfhosted (500K+ members)
**Post type:** Project showcase  
**Angle:** "Self-hosted AI security -- scan your code locally, no cloud required"  
**Frequency:** One post  
**Do:** Emphasize local-first, no telemetry, self-hosted architecture  
**Don't:** Require cloud accounts or paid tiers for basic functionality

#### r/LocalLLaMA (350K+ members)
**Post type:** Project share  
**Angle:** Local AI Broker -- route AI requests to local models with security scanning  
**Frequency:** One post, contribute to privacy-related discussions  
**Do:** Share technical architecture of the local broker, discuss Ollama/LM Studio integration  
**Don't:** Dismiss cloud models -- frame it as "choice and visibility, not cloud vs. local"

#### r/ClaudeAI (200K+ members)
**Post type:** Tool share  
**Angle:** "VS Code extension that secures your Claude coding sessions"  
**Frequency:** One post  
**Do:** Frame as complementary to Claude, not competitive  
**Don't:** Imply Claude is insecure -- frame as "adding a security layer"

#### r/Cursor (100K+ members)
**Post type:** Extension showcase  
**Angle:** "Scan what Cursor sees from your codebase" -- focus on .cursorrules security  
**Frequency:** One post  
**Do:** Share .cursorrules prompt injection findings, offer practical security tips  
**Don't:** Position as anti-Cursor; position as "Cursor + security"

---

### 9. Dev.to, Hashnode, Medium (Cross-Posting Strategy)

**SEO Value:** Medium-High (these platforms have high DA and good Google indexing)  
**Backlink Type:** Varies (Dev.to nofollow, Hashnode dofollow on custom domain, Medium nofollow)

**Strategy:**
- **Primary publication:** soterai.in/blog (canonical URL always points here)
- **Cross-post to Dev.to:** 3-5 days after original publication, with canonical URL set to soterai.in
- **Cross-post to Hashnode:** Same timing, use Hashnode's canonical URL feature
- **Medium:** Only for the 2-3 highest-performing posts, under a SoterAI publication

**Dev.to Optimization:**
- Tags (max 4): `security`, `ai`, `vscode`, `webdev`
- Cover image: Same as blog post hero image
- Series: "AI Coding Security" (link posts together)

**Hashnode Optimization:**
- Tags: `AI Security`, `Developer Tools`, `VS Code`, `Cybersecurity`
- Newsletter: Enable Hashnode newsletter to build email list
- Custom domain: Consider blog.soterai.in mapped to Hashnode (for dofollow backlinks)

**Actions:**
- [ ] Create SoterAI accounts on Dev.to, Hashnode, Medium
- [ ] Set up cross-posting workflow with canonical URLs
- [ ] Cross-post first 3 blogs in Week 2

---

### 10. LinkedIn and X/Twitter

**SEO Value:** Low-Medium (social links are nofollow, but drive referral traffic and brand signals)

**LinkedIn Strategy:**
- **Profile:** Founder profile with "Building SoterAI" in headline
- **Company page:** SoterAI with logo, banner, description, website link
- **Posting cadence:** 3x per week (Mon/Wed/Fri)
  - Monday: Technical insight or finding
  - Wednesday: Product update or demo
  - Friday: Industry commentary or comparison
- **Content format:** Text posts (800-1200 characters) with 1 image or short video
- **Engagement:** Comment on AI security posts by others, share relevant news with SoterAI angle
- **Hashtags:** #AISecurity #DeveloperTools #CyberSecurity #VibeCoding #DPDP (max 3-5 per post)

**X/Twitter Strategy:**
- **Handle:** @soterai_in (or @soterai if available)
- **Posting cadence:** Daily (1-2 tweets)
  - Technical tips (thread format for deep topics)
  - Product updates (screenshot + 1-liner)
  - Retweets of AI security news with commentary
- **Thread strategy:** Weekly thread on one AI security topic (repurpose blog content)
- **Engagement:** Follow and interact with AI security researchers, VS Code team, developer advocates

**Actions:**
- [ ] Set up LinkedIn company page
- [ ] Set up X/Twitter account
- [ ] Create posting calendar for Month 1
- [ ] Batch-create first 2 weeks of posts

---

### 11. Indie Hackers

**URL:** indiehackers.com/product/soterai  
**SEO Value:** Medium (IH has good DA, community is supportive of builders)  
**Backlink Type:** Dofollow from product page

**Build-in-Public Strategy:**
- **Product page:** Create with description, milestones, revenue (when applicable)
- **Updates:** Monthly "milestone" posts
  - Month 1: "Launched on VS Code Marketplace, X installs"
  - Month 2: "First paying customer" or "First 100 users"
  - Month 3: "What I learned from user feedback"
- **Community posts:** 1-2 per month on topics like:
  - "How I chose local-first architecture (and the tradeoffs)"
  - "Marketing a developer security tool as a solo founder"
  - "My first 30 days of SEO as a developer"

**Actions:**
- [ ] Create Indie Hackers product page
- [ ] Write first milestone post
- [ ] Schedule monthly updates

---

### 12. Security Newsletters

**Strategy:** Pitch individual stories, not product announcements. Offer exclusive content (early findings, threat reports).

| Newsletter | Audience | Pitch Angle | Contact Method |
|-----------|---------|------------|----------------|
| tl;dr sec | Security engineers | "New attack surface: AI coding assistants leak secrets" | Submission form |
| The Hacker News (thehackernews.com) | Broad security | "Prompt injection in developer repos -- new threat vector" | Press contact |
| Daniel Miessler's Unsupervised Learning | Security + AI | "Local-first approach to AI security" | Twitter DM / email |
| TLDR Newsletter (Tech/AI editions) | Developers + AI | "Open-source VS Code extension for AI coding security" | Submission form |
| Console.dev | Developer tools | "SoterAI -- AI security for developers" | Submission form |
| Changelog News | Open-source developers | "Show: SoterAI IDE Guard" | Submission form |
| Indian startup newsletters (YourStory, Inc42) | Indian tech ecosystem | "Indian startup tackles AI security for developers, DPDP compliance" | Press contact |

**Pitch Template:**
Subject: [Story pitch] New attack surface: what AI coding assistants see from your codebase

Body: Brief description of the threat (2 sentences), what SoterAI does (2 sentences), link to the technical blog post, offer for exclusive interview or demo.

**Actions:**
- [ ] Build media list with contact details
- [ ] Craft 3 pitch variants (security angle, dev tools angle, India angle)
- [ ] Send pitches in Week 3-4

---

### 13. AI Developer Communities

| Community | Platform | Strategy |
|-----------|----------|----------|
| Claude Discord | Discord | Share in #projects channel, help with Claude security questions |
| Cursor Community | Discord/Forum | Share .cursorrules security findings, offer the extension |
| Continue.dev | Discord | Share as complementary security tool for Continue users |
| LangChain | Discord | Share AI security best practices for RAG/agent builders |
| Ollama | Discord | Share Local AI Broker integration |
| AI Engineer Foundation | Various | Submit talk proposals on AI coding security |
| MLSecOps Community | Slack | Share threat research and tool |

**Engagement Rules:**
- Join and lurk for 1 week before posting
- Answer questions and help others for 2 weeks before sharing SoterAI
- Always frame as "I built this to solve X problem" not "check out my product"
- Share specific, actionable security tips alongside any product mention

**Actions:**
- [ ] Join top 5 communities
- [ ] Lurk for 1 week, then start contributing
- [ ] Share SoterAI in appropriate channels after establishing presence

---

### 14. Indian Startup Communities

| Community | Platform | Angle |
|-----------|----------|-------|
| YourStory | Publication | "Indian cybersecurity startup" pitch |
| Inc42 | Publication | "AI security" beat reporter pitch |
| r/developersIndia | Reddit | Developer tool showcase |
| Indian Startup News (ISN) | Newsletter | Product feature pitch |
| TiE Network | Events | Pitch competition entries |
| NASSCOM AI community | Industry body | AI security thought leadership |
| Product Hunt India | Telegram/WA | Cross-promote PH launch |
| Bangalore/Hyderabad tech meetups | Meetup.com | Lightning talks on AI security |

**India-Specific Angles:**
- DPDP Act compliance for AI workflows (unique positioning)
- Indian PII detection (Aadhaar, PAN, IFSC, UPI)
- "Made in India" cybersecurity tool
- Affordable pricing for Indian startups

**Actions:**
- [ ] Pitch to YourStory and Inc42 in Week 3
- [ ] Post to r/developersIndia in Week 3
- [ ] Register for 1-2 local meetups for lightning talks

---

## Backlink Quality Tiers

| Tier | Sources | DA Range | Priority |
|------|---------|----------|----------|
| Tier 1 (High authority) | GitHub, VS Code Marketplace, Product Hunt, Hacker News | 90+ | Week 1-2 |
| Tier 2 (Medium authority) | Dev.to, Hashnode, Reddit, Open VSX, npm | 60-90 | Week 2-3 |
| Tier 3 (Niche authority) | Security newsletters, Indie Hackers, Discord/Slack communities | 40-70 | Week 3-4 |
| Tier 4 (Long-tail) | Blog cross-posts, Medium, Indian publications, meetup pages | 30-60 | Month 2+ |

---

## UTM Parameter Convention

All outbound links should use this format:

```
https://soterai.in/?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>
```

| Source | Medium | Example |
|--------|--------|---------|
| github | referral | `utm_source=github&utm_medium=referral&utm_campaign=readme` |
| vscode-marketplace | referral | `utm_source=vscode-marketplace&utm_medium=referral&utm_campaign=listing` |
| producthunt | referral | `utm_source=producthunt&utm_medium=referral&utm_campaign=launch-jul2026` |
| hackernews | referral | `utm_source=hackernews&utm_medium=referral&utm_campaign=showhn` |
| reddit | social | `utm_source=reddit&utm_medium=social&utm_campaign=r-vscode` |
| linkedin | social | `utm_source=linkedin&utm_medium=social&utm_campaign=post-<date>` |
| twitter | social | `utm_source=twitter&utm_medium=social&utm_campaign=launch` |
| devto | referral | `utm_source=devto&utm_medium=referral&utm_campaign=crosspost` |
| newsletter | email | `utm_source=<newsletter-name>&utm_medium=email&utm_campaign=pitch` |

---

## Monthly Backlink Targets

| Month | New Backlinks Target | Sources |
|-------|---------------------|---------|
| Month 1 | 15-25 | GitHub, Marketplace, npm, Reddit (4 posts), Dev.to, Hashnode, HN, PH, LinkedIn, Twitter |
| Month 2 | 10-15 | Newsletter features, Indie Hackers, community posts, blog cross-posts, Indian publications |
| Month 3 | 10-15 | JetBrains Marketplace (if ready), conference talks, guest posts, additional Reddit posts |

---

## Anti-Patterns to Avoid

- **No link exchanges.** Do not offer "I'll link to you if you link to me" deals.
- **No paid links.** Do not buy backlinks or sponsor posts for links.
- **No comment spam.** Do not drop links in unrelated comment sections.
- **No mass forum posting.** One post per community per month maximum.
- **No fake accounts.** One account per platform, real identity.
- **No misleading claims.** Never claim features that do not exist yet.
- **No astroturfed reviews.** Do not create fake marketplace reviews.
- **No private network links.** Do not create satellite sites for link building.

---

*Document version: 1.0 -- Created 2026-07-06*
