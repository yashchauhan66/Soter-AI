# Phase 14 -- Content Moat Strategy

> **Goal:** Build durable topical authority around AI coding security, MCP security, prompt injection in repos, local-first AI privacy, AI broker architecture, developer secrets + AI, Indian PII / DPDP / AI workflows, and safe vibe coding.

---

## 30-Day Content Calendar Overview

| Week | Theme | Deliverables |
|------|-------|-------------|
| 1 | Foundation | Docs polish, homepage SEO hardening, Blogs 1-3 |
| 2 | Comparison + Authority | 5 comparison pages, Blogs 4-6 |
| 3 | Community + Distribution | Reddit/HN posts, 5 videos, Blogs 7-8 |
| 4 | Conversion + Refinement | 5 tutorials, Blogs 9-10, Product Hunt prep |

---

## 10 Technical Blog Posts

### Blog 1 -- "Why Your AI Coding Assistant Is Leaking Your Secrets"
**Target keywords:** AI coding secrets leak, Copilot secret exposure, AI code assistant security  
**Estimated word count:** 2,000  
**Publish:** Week 1, Day 1

1. Real examples of secrets (.env values, API keys, tokens) that end up in AI context windows when developers use Copilot, Cursor, or Claude Code.
2. How context window assembly works -- what gets sent, when, and why developers have zero visibility.
3. The attack surface: prompt injection in repo files, malicious .cursorrules, poisoned AI memory files.
4. How SoterAI's local-first scanning intercepts secrets before they leave the machine -- architecture walkthrough.
5. Step-by-step: install SoterAI IDE Guard, enable Safe Mode, see what AI would have seen vs. what AI actually sees.

---

### Blog 2 -- "MCP Tool Security: The Attack Surface Nobody Is Talking About"
**Target keywords:** MCP security, Model Context Protocol risks, MCP tool permissions, AI tool use security  
**Estimated word count:** 2,500  
**Publish:** Week 1, Day 3

1. What MCP is, how it works, and why every AI IDE now depends on it (Claude Desktop, Cursor, Windsurf, VS Code).
2. Threat model: tool poisoning, over-permissioned servers, data exfiltration through tool responses, TOCTOU attacks on tool definitions.
3. Real CVE-adjacent scenarios: a malicious MCP server that reads ~/.ssh/id_rsa and sends it as "context."
4. How SoterAI's MCP/Tool Permission Monitor works -- manifest scanning, runtime permission gating, risk scoring per tool.
5. Best practices checklist for MCP server authors and consumers (with downloadable PDF).

---

### Blog 3 -- "Prompt Injection in Your Repo: How Attackers Weaponize .md and .cursorrules Files"
**Target keywords:** prompt injection repository, cursorrules attack, AI prompt injection developer, repo-level prompt injection  
**Estimated word count:** 2,200  
**Publish:** Week 1, Day 5

1. The new attack vector: adversarial instructions hidden in README.md, CONTRIBUTING.md, .cursorrules, .claude/CLAUDE.md, and code comments.
2. Taxonomy of repo-level prompt injection: direct instruction override, context poisoning, tool invocation hijack, exfiltration-via-markdown-image.
3. Case studies: the Markdown image exfiltration attack, the "ignore all previous instructions" variants, Unicode homoglyph and combining-mark evasion.
4. How SoterAI detects these: normalizeSecurityText, multi-layer pattern matching, diacritic/combining-mark stripping, confidence scoring.
5. Defense-in-depth: what developers should do today even without SoterAI (review AI rules files, pin MCP servers, use .gitignore for AI config).

---

### Blog 4 -- "Local-First AI Security: Why Your Data Should Never Leave Your Machine"
**Target keywords:** local-first AI privacy, on-device AI security, AI data privacy developer, local AI broker  
**Estimated word count:** 1,800  
**Publish:** Week 2, Day 1

1. The privacy problem: cloud-based AI security tools see everything you scan -- your code, your secrets, your prompts.
2. Local-first architecture explained: SoterAI runs entirely in VS Code, scans happen on your machine, nothing is uploaded.
3. The Local AI Broker: how it intercepts AI requests, applies security policies, and optionally routes to a local LLM.
4. Compliance implications: GDPR, DPDP Act (India), SOC 2 -- local-first makes compliance trivially easier.
5. Performance reality: latency benchmarks showing local scanning adds < 50ms to AI interactions.

---

### Blog 5 -- "DPDP Act + AI Workflows: What Indian Developers Need to Know"
**Target keywords:** DPDP Act AI, India data protection AI, Indian PII AI coding, DPDP compliance developer  
**Estimated word count:** 2,000  
**Publish:** Week 2, Day 3

1. DPDP Act overview for developers: what constitutes personal data, consent requirements, data fiduciary obligations.
2. How AI coding tools create DPDP risk: Aadhaar numbers in test data, PAN cards in config, mobile numbers in logs -- all sent to AI.
3. Indian PII patterns SoterAI detects: Aadhaar (12-digit with Verhoeff), PAN, Indian mobile (+91), IFSC, UPI IDs, Indian passport numbers.
4. Building DPDP-compliant AI workflows: local scanning, redaction before AI context, audit trails (What AI Saw Ledger).
5. Template: DPDP compliance checklist for engineering teams using AI coding assistants.

---

### Blog 6 -- "The AI Context Firewall: 14 Phases of Protecting What AI Sees"
**Target keywords:** AI context firewall, AI context protection, what AI sees, AI data filtering  
**Estimated word count:** 2,500  
**Publish:** Week 2, Day 5

1. What is an AI context firewall and why it is different from a traditional WAF or DLP tool.
2. Architecture deep dive: the 14-phase pipeline (identity verification, session binding, passport + token PoP, content classification, policy enforcement, etc.).
3. Zero-trust model: every AI interaction is untrusted until verified -- identity, session, content, and tool permissions all checked independently.
4. Real-world walkthrough: tracing a single AI request through all 14 phases with annotated logs.
5. Open-source transparency: how the firewall phases are implemented, tested (98 tests), and auditable.

---

### Blog 7 -- "Safe Vibe Coding: How to Use AI Assistants Without Compromising Security"
**Target keywords:** safe vibe coding, secure AI coding, vibe coding security, AI pair programming safety  
**Estimated word count:** 1,500  
**Publish:** Week 3, Day 1

1. What "vibe coding" is and why it is exploding (natural language to code, AI-first development, rapid prototyping).
2. The security gap: vibe coders trust AI output implicitly -- no code review, no threat modeling, no secret hygiene.
3. Five rules for safe vibe coding: enable AI Safe Mode, scan before commit, review AI-generated dependencies, isolate AI sandboxes, audit AI memory.
4. How SoterAI's Safe Mode makes vibe coding safe by default: automatic scanning, real-time alerts, one-click remediation.
5. The productivity argument: safe vibe coding is actually faster because you catch issues before they become production incidents.

---

### Blog 8 -- "LLM Extension Risk Scanner: Auditing Your AI Tool Supply Chain"
**Target keywords:** LLM extension security, AI tool supply chain, VS Code extension security audit, AI plugin risk  
**Estimated word count:** 1,800  
**Publish:** Week 3, Day 3

1. The AI extension explosion: hundreds of VS Code extensions now call LLMs, and each one is a potential data exfiltration vector.
2. What the LLM Extension Risk Scanner checks: outbound network calls, permission scope, data access patterns, known vulnerability databases.
3. Risk scoring methodology: how SoterAI assigns risk levels (low/medium/high/critical) to each AI-related extension.
4. Case study: analyzing a popular "AI code reviewer" extension that sends entire files to an unaudited third-party API.
5. Actionable output: how to read the scan report, what to uninstall, what to allowlist, how to set org-wide policies.

---

### Blog 9 -- "Canary Leak Detection: Planting Tripwires for AI Data Exfiltration"
**Target keywords:** canary token AI, data leak detection AI, canary secrets, AI exfiltration detection  
**Estimated word count:** 1,800  
**Publish:** Week 4, Day 1

1. The concept: canary tokens adapted for the AI era -- unique, trackable strings planted in sensitive locations.
2. How SoterAI's canary system works: generation, placement (in .env, config, internal docs), monitoring, and alerting.
3. Detection scenarios: canary appears in AI output, canary appears in a third-party API log, canary appears in a public repo.
4. Integration with the What AI Saw Ledger: correlating canary triggers with specific AI interactions for forensic analysis.
5. Setup guide: 5-minute canary deployment for your project with SoterAI CLI.

---

### Blog 10 -- "Terminal Command Firewall: Stopping AI from Running Dangerous Commands"
**Target keywords:** terminal command firewall, AI terminal safety, AI command execution security, agentic AI safety  
**Estimated word count:** 2,000  
**Publish:** Week 4, Day 3

1. The agentic risk: AI assistants (Claude Code, Cursor agent mode, Copilot Workspace) now execute terminal commands autonomously.
2. Threat model: rm -rf, curl to exfiltration endpoints, pip install malicious-package, git push --force, environment variable reads.
3. How the Terminal Command Firewall works: command parsing, risk classification, policy matching, user confirmation for risky commands.
4. Policy configuration: allowlists, blocklists, risk thresholds, per-project overrides.
5. The balance: enabling AI productivity while preventing catastrophic terminal actions -- real-world policy templates included.

---

## 5 Comparison Pages

### Comparison 1: SoterAI vs. Lakera Guard
**URL:** /comparison/soterai-vs-lakera  
**Target keywords:** Lakera Guard alternative, Lakera vs SoterAI, local AI security vs cloud  
**Differentiators to highlight:**
- Local-first vs. cloud-only (Lakera requires API calls to their servers)
- IDE-native vs. API-only (SoterAI lives in VS Code; Lakera is an API endpoint)
- Developer-focused vs. enterprise-API-focused
- Indian PII / DPDP support (Lakera lacks India-specific patterns)
- Free tier with full local scanning vs. usage-based pricing

### Comparison 2: SoterAI vs. GitHub Advanced Security
**URL:** /comparison/soterai-vs-github-advanced-security  
**Target keywords:** GitHub Advanced Security alternative, GHAS vs SoterAI, secret scanning alternative  
**Differentiators to highlight:**
- Pre-commit (before AI sees it) vs. post-push (after it is in the repo)
- AI context awareness (SoterAI scans what AI sees, not just git history)
- MCP and tool permission scanning (GHAS does not cover this)
- Local-first (no data leaves your machine) vs. cloud-processed
- Works with any AI tool, not just GitHub Copilot

### Comparison 3: SoterAI vs. Prompt Security
**URL:** /comparison/soterai-vs-prompt-security  
**Target keywords:** Prompt Security alternative, prompt injection detection comparison  
**Differentiators to highlight:**
- Developer IDE integration vs. enterprise proxy/gateway approach
- Real-time in-editor alerts vs. API-level blocking
- Open-source core vs. closed-source
- Local processing vs. cloud processing
- Combined secret + prompt + MCP scanning vs. prompt-only focus

### Comparison 4: SoterAI vs. HiddenLayer
**URL:** /comparison/soterai-vs-hiddenlayer  
**Target keywords:** HiddenLayer alternative, AI security platform comparison  
**Differentiators to highlight:**
- Developer-first vs. enterprise ML security focus
- IDE-native experience vs. dashboard-only
- Coding workflow integration vs. model-level protection
- Affordable / free tier vs. enterprise pricing only
- Practical developer tools vs. research-oriented platform

### Comparison 5: SoterAI vs. Manual Code Review + .gitignore
**URL:** /comparison/soterai-vs-manual-security  
**Target keywords:** AI security best practices, manual vs automated AI security, do I need AI security tool  
**Differentiators to highlight:**
- Automated real-time scanning vs. human review (humans miss things, especially at 2am)
- AI-context-aware (knows what AI will see) vs. git-aware-only
- MCP and tool permission monitoring (manual review cannot cover this)
- Canary tokens and leak detection (proactive vs. reactive)
- Time savings: 5-minute setup vs. ongoing manual vigilance

---

## 5 Docs / Tutorials

### Tutorial 1: "Quick Start: Protect Your First Project in 5 Minutes"
**URL:** /docs/quickstart  
**Prerequisites:** VS Code installed, any code project open  
**What it teaches:**
- Install SoterAI IDE Guard from marketplace
- Run first security scan on current workspace
- Enable AI Safe Mode
- Review the What AI Saw Ledger
- Set up your first canary secret

### Tutorial 2: "Setting Up the Local AI Broker for Complete Privacy"
**URL:** /docs/tutorials/local-ai-broker  
**Prerequisites:** SoterAI IDE Guard installed, basic terminal knowledge  
**What it teaches:**
- What the Local AI Broker does and why you want it
- Configuration: selecting your local LLM (Ollama, LM Studio, or custom endpoint)
- Routing rules: which requests go local, which go to cloud (with policy)
- Testing: verify no data leaves your machine with network monitoring
- Performance tuning: caching, model selection for speed vs. quality

### Tutorial 3: "MCP Server Security Audit: Step-by-Step"
**URL:** /docs/tutorials/mcp-security-audit  
**Prerequisites:** SoterAI IDE Guard installed, at least one MCP server configured  
**What it teaches:**
- Listing all MCP servers and tools in your environment
- Running the MCP/Tool Permission Monitor scan
- Reading the risk report: what each risk level means
- Remediating: restricting tool permissions, removing risky servers
- Ongoing monitoring: setting up alerts for new MCP server additions

### Tutorial 4: "DPDP Compliance for AI-Assisted Development Teams"
**URL:** /docs/tutorials/dpdp-compliance  
**Prerequisites:** Team using AI coding assistants, awareness of DPDP Act  
**What it teaches:**
- Configuring SoterAI to detect Indian PII patterns (Aadhaar, PAN, mobile, IFSC, UPI)
- Setting up team-wide policies for AI data handling
- Generating compliance audit reports from the What AI Saw Ledger
- Integrating with CI/CD for pre-merge PII scanning
- Template: Data Protection Impact Assessment (DPIA) for AI coding tools

### Tutorial 5: "Building a Security-First AI Coding Workflow"
**URL:** /docs/tutorials/security-first-workflow  
**Prerequisites:** SoterAI IDE Guard installed, basic AI coding experience  
**What it teaches:**
- The security-first workflow: scan, code, review, commit
- Configuring per-project security policies (.soterai.json)
- Setting up pre-commit hooks for automated scanning
- Team onboarding: rolling out SoterAI across an engineering org
- Measuring security posture: dashboards and weekly reports

---

## 5 Short Video Ideas (30-60 seconds each)

### Video 1: "Watch AI Leak Your .env in Real Time"
**Duration:** 45 seconds  
**What it shows:**
- Open a project with a .env file containing API keys
- Show Copilot/Cursor autocomplete referencing the secret
- Enable SoterAI Safe Mode
- Show the secret being redacted in real time before AI sees it
- End card: "Your secrets. Your machine. Install SoterAI IDE Guard."

### Video 2: "MCP Tool Scanning in 30 Seconds"
**Duration:** 30 seconds  
**What it shows:**
- Open Command Palette, run "SoterAI: Scan MCP Tools"
- Show the scan results with risk levels (green/yellow/red)
- Click on a high-risk tool to see why (excessive permissions, network access)
- End card: "Know what your AI tools can do. SoterAI IDE Guard."

### Video 3: "Prompt Injection Hidden in a README"
**Duration:** 60 seconds  
**What it shows:**
- Clone a demo repo with a malicious README containing hidden prompt injection
- Open the file -- looks normal to humans
- Run SoterAI scan -- highlights the injection in red with explanation
- Show the normalized text view revealing the hidden instructions
- End card: "See what AI sees. SoterAI IDE Guard."

### Video 4: "The What AI Saw Ledger"
**Duration:** 45 seconds  
**What it shows:**
- Open the AI Saw Ledger panel
- Show a timeline of AI interactions with content previews
- Click an entry to see exactly what context was sent to AI
- Highlight a redacted secret (shown as [REDACTED] in the ledger)
- End card: "Full visibility. Zero trust. SoterAI IDE Guard."

### Video 5: "Canary Secret Setup (60 seconds)"
**Duration:** 60 seconds  
**What it shows:**
- Open Command Palette, run "SoterAI: Generate Canary Secret"
- Place the canary in a .env file
- Show the monitoring dashboard
- Simulate a leak detection alert
- End card: "Plant tripwires. Catch leaks. SoterAI IDE Guard."

---

## 5 LinkedIn / X Post Ideas

### Post 1: The Wake-Up Call
**Hook:** "Your AI coding assistant just sent your AWS_SECRET_ACCESS_KEY to a server in Virginia. You didn't notice."  
**Content angle:** The invisible risk of AI context windows -- what gets sent, how developers have zero visibility, and why this is the next major security incident category.  
**CTA:** "We built SoterAI to fix this. Local-first. Open source. Free. Link in comments."

### Post 2: The DPDP Angle (India-focused)
**Hook:** "If your dev team uses AI coding tools and handles Aadhaar data, you might already be violating the DPDP Act."  
**Content angle:** How AI assistants silently process Indian PII -- test data with Aadhaar numbers, config files with PAN numbers -- and what the DPDP Act requires.  
**CTA:** "We built Indian PII detection into SoterAI. Detect Aadhaar, PAN, IFSC before AI sees them. Free VS Code extension."

### Post 3: The MCP Warning
**Hook:** "MCP (Model Context Protocol) is the new npm. And just like npm, it has a supply chain security problem nobody is addressing."  
**Content angle:** MCP tools can read your filesystem, access your APIs, and modify your code. Most developers install them without reviewing permissions. This is the next log4j.  
**CTA:** "SoterAI scans your MCP tools and shows you the risk. Install the VS Code extension (free)."

### Post 4: The Build-in-Public Update
**Hook:** "Week 4 building an AI security tool as a solo founder. Here's what I learned about prompt injection."  
**Content angle:** Technical findings from building detection: combining marks bypass, Unicode homoglyphs, multi-language injection patterns. Share actual code snippets.  
**CTA:** "Following along? Star us on GitHub. Shipping new detection every week."

### Post 5: The Comparison Post
**Hook:** "I compared every AI security tool on the market. Here's the gap nobody is filling."  
**Content angle:** Matrix of Lakera, HiddenLayer, Prompt Security, GHAS -- none of them work inside the IDE, none of them are local-first, none of them cover MCP. SoterAI fills this exact gap.  
**CTA:** "Full comparison at soterai.in/comparison. The VS Code extension is free."

---

## 3 Hacker News / Reddit Launch Post Drafts

### HN Post 1: Show HN
**Title:** Show HN: SoterAI -- Local-first AI security for your IDE (open source)  
**Target:** Hacker News (Show HN)  
**Opening paragraph:**

I built SoterAI because I kept finding API keys in my AI assistant's context window. Every time I used Copilot or Cursor, my .env files, internal configs, and even production credentials were being sent to remote servers -- and I had zero visibility into what was going out.

SoterAI is a VS Code extension that scans everything before AI sees it. It runs entirely on your machine -- no cloud, no telemetry, no data leaves your laptop. It catches secrets, prompt injection attempts, risky MCP tool configurations, and gives you a full audit log of what AI actually saw.

Key features: AI Safe Mode (redacts secrets in real time), AI Context Firewall (14-phase zero-trust pipeline), MCP Tool Scanner (risk-scores your AI tools), Canary Leak Detection (plant tripwires), Terminal Command Firewall (blocks dangerous AI-executed commands).

Free and open source. Looking for feedback from security-minded developers.

---

### Reddit Post 1: r/cybersecurity
**Title:** I built an open-source tool to audit what AI coding assistants actually see from your codebase  
**Target subreddit:** r/cybersecurity  
**Opening paragraph:**

Security engineer here. I have been researching the attack surface of AI coding assistants (Copilot, Cursor, Claude Code) and found a significant blind spot: developers have zero visibility into what context these tools send to remote LLM providers. Your .env files, internal API endpoints, database credentials, and even PII in test fixtures can end up in AI context windows.

I built SoterAI IDE Guard -- a VS Code extension that intercepts and audits AI context locally. It scans for secrets, PII (including Indian patterns like Aadhaar/PAN for DPDP compliance), prompt injection attempts hidden in repo files, and risky MCP tool configurations. Everything runs on your machine. No data leaves your laptop.

I would love feedback from this community. The tool is free, the core scanning logic is open source, and I am especially interested in threat models I might have missed. What attack vectors would you want scanned?

---

### Reddit Post 2: r/LocalLLaMA
**Title:** Built a local AI broker that intercepts and secures all AI requests before they leave your machine  
**Target subreddit:** r/LocalLLaMA  
**Opening paragraph:**

Fellow local-LLM enthusiast here. I have been building SoterAI, which includes a "Local AI Broker" that sits between your IDE and any AI provider. The idea is simple: before any prompt leaves your machine, it gets scanned for secrets, PII, and prompt injection. If you are running a local model (Ollama, LM Studio), the broker can route requests entirely locally -- your code never touches the internet.

The broker also gives you a full audit log (we call it the "What AI Saw Ledger") so you can see exactly what context went to which model. For those of us who care about privacy, this is the missing piece between "I run my own model" and "I actually verified nothing leaked."

It is a VS Code extension right now with cross-IDE support on the roadmap. Would love feedback from this community on the local routing architecture.

---

### Reddit Post 3: r/vscode
**Title:** VS Code extension that shows you exactly what your AI coding assistant sees from your workspace  
**Target subreddit:** r/vscode  
**Opening paragraph:**

I built SoterAI IDE Guard -- a VS Code extension that gives you full visibility into what AI coding tools (Copilot, Cursor, Claude) can see from your workspace. It scans for secrets, prompt injection in repo files, risky MCP tools, and gives you an audit log of every AI interaction.

The extension adds Safe Mode (one-click to redact all secrets from AI context), a Memory Inspector (see and clear what AI remembers about your project), and a Terminal Command Firewall (blocks dangerous commands that AI tries to execute). Everything runs locally -- no cloud, no telemetry.

Free on the VS Code Marketplace. Looking for beta testers and feedback on the UX.

---

## 2 Product Hunt Launch Drafts

### Product Hunt Launch 1: Main Launch

**Tagline:** "See what AI sees. Protect what AI touches. All local."

**Description:**
SoterAI IDE Guard is the first local-first AI security platform built for developers. It lives inside your VS Code and protects your code, secrets, and prompts before they reach any AI.

**Problem:** Every time you use an AI coding assistant, your secrets, API keys, and internal code are sent to remote servers. You have zero visibility into what goes out and no control over what AI sees.

**Solution:** SoterAI scans everything locally -- on your machine, before AI touches it. No cloud. No telemetry. No trust required.

**Key Features:**
- AI Safe Mode: One-click redaction of all secrets from AI context
- AI Context Firewall: 14-phase zero-trust pipeline for every AI interaction
- What AI Saw Ledger: Full audit log of every piece of context sent to AI
- MCP Tool Scanner: Risk-score every AI tool and MCP server in your environment
- Canary Leak Detection: Plant trackable tokens to detect data exfiltration
- Terminal Command Firewall: Block dangerous commands AI tries to run
- Indian PII / DPDP Support: Aadhaar, PAN, IFSC, UPI detection for compliance
- Local AI Broker: Route AI requests to local models for complete privacy

**First Comment:**
Hi Product Hunt! I am the founder of SoterAI. I built this because I accidentally leaked an AWS key through my AI coding assistant and spent a weekend rotating credentials. That should never happen to anyone.

The core insight is simple: AI security should happen before your data leaves your machine, not after. Every other tool in this space is cloud-based -- they scan your data on their servers. SoterAI runs entirely in your IDE.

We are in beta, the VS Code extension is free, and I am personally responding to every piece of feedback. Try it, break it, tell me what is missing.

AMA in the comments.

---

### Product Hunt Launch 2: AI Security Collection Launch

**Tagline:** "The missing security layer between your code and your AI assistant."

**Description:**
Developers use AI coding assistants daily but have zero visibility into what data these tools access. SoterAI IDE Guard adds a security layer directly in your IDE -- scanning for secrets, prompt injection, and risky AI tool configurations before any data leaves your machine.

Built for developers who care about security but do not want to slow down. One-click AI Safe Mode. Full audit trails. Local-first architecture. Free tier with no data limits.

**First Comment:**
Hey everyone! Quick context on why this exists: AI coding assistants are incredible productivity tools, but they create a completely new attack surface. Your .env files, internal endpoints, test data with PII -- all of it can end up in AI context windows without you knowing.

We are not anti-AI. We are pro-AI-with-visibility. SoterAI lets you use Copilot, Cursor, Claude, or any AI tool with confidence that your sensitive data is protected.

The extension is free, installs in 10 seconds, and runs its first scan in under a minute. I would love your feedback.

---

## Weekly Execution Plan

### Week 1: Foundation (Days 1-7)

| Day | Task | Owner |
|-----|------|-------|
| 1 | Publish Blog 1 ("AI Leaking Secrets") | Content |
| 1 | Optimize homepage meta tags and structured data | SEO |
| 2 | Update VS Code Marketplace README (see Phase 13) | Product |
| 3 | Publish Blog 2 ("MCP Tool Security") | Content |
| 4 | Set up blog infrastructure (if not exists) | Eng |
| 5 | Publish Blog 3 ("Prompt Injection in Repos") | Content |
| 6 | Submit sitemap to Google Search Console | SEO |
| 7 | Review analytics, adjust keyword targets | SEO |

### Week 2: Comparison + Authority (Days 8-14)

| Day | Task | Owner |
|-----|------|-------|
| 8 | Publish Blog 4 ("Local-First AI Security") | Content |
| 8 | Publish Comparison 1 (vs. Lakera) | Content |
| 9 | Publish Comparison 2 (vs. GitHub Advanced Security) | Content |
| 10 | Publish Blog 5 ("DPDP Act + AI") | Content |
| 10 | Publish Comparison 3 (vs. Prompt Security) | Content |
| 11 | Publish Comparison 4 (vs. HiddenLayer) | Content |
| 12 | Publish Blog 6 ("AI Context Firewall Deep Dive") | Content |
| 12 | Publish Comparison 5 (vs. Manual Security) | Content |
| 14 | Cross-post top-performing blog to Dev.to and Hashnode | Content |

### Week 3: Community + Distribution (Days 15-21)

| Day | Task | Owner |
|-----|------|-------|
| 15 | Publish Blog 7 ("Safe Vibe Coding") | Content |
| 15 | Post to r/vscode (Reddit Post 3) | Community |
| 16 | Record and publish Video 1 ("Watch AI Leak Your .env") | Content |
| 17 | Post to r/cybersecurity (Reddit Post 1) | Community |
| 17 | Publish Blog 8 ("LLM Extension Risk Scanner") | Content |
| 18 | Record and publish Videos 2-3 | Content |
| 19 | Submit Show HN (HN Post 1) | Community |
| 20 | Post to r/LocalLLaMA (Reddit Post 2) | Community |
| 20 | Record and publish Videos 4-5 | Content |
| 21 | Post LinkedIn Posts 1-3 (staggered across the day) | Community |

### Week 4: Conversion + Refinement (Days 22-30)

| Day | Task | Owner |
|-----|------|-------|
| 22 | Publish Blog 9 ("Canary Leak Detection") | Content |
| 22 | Publish Tutorial 1 ("Quick Start") | Docs |
| 23 | Publish Tutorials 2-3 | Docs |
| 24 | Publish Blog 10 ("Terminal Command Firewall") | Content |
| 25 | Publish Tutorials 4-5 | Docs |
| 26 | Post LinkedIn Posts 4-5 | Community |
| 27 | Finalize Product Hunt listing (graphics, description, first comment) | Product |
| 28 | Product Hunt launch (schedule for Tuesday 12:01am PT) | Product |
| 29 | Engage with Product Hunt comments all day | Community |
| 30 | Retrospective: review analytics, plan Month 2 | All |

---

## Keyword Clusters and Search Intent Map

| Cluster | Primary Keyword | Secondary Keywords | Intent |
|---------|----------------|-------------------|--------|
| AI Coding Security | AI coding security | secure AI coding, AI pair programming safety, vibe coding security | Informational |
| Secret Scanning | AI secret leak | Copilot secret exposure, AI assistant data leak, .env AI risk | Problem-aware |
| MCP Security | MCP security | Model Context Protocol risk, MCP tool permissions, AI tool audit | Informational |
| Prompt Injection | prompt injection repo | cursorrules attack, AI prompt injection developer | Problem-aware |
| Local AI | local-first AI security | on-device AI security, private AI coding, local AI broker | Solution-aware |
| DPDP / India | DPDP Act AI | India data protection AI, Aadhaar AI risk, Indian PII scanning | Compliance |
| Comparisons | Lakera alternative | AI security comparison, GHAS alternative, Prompt Security vs | Comparison |
| Tool Category | AI security tool | AI security platform, developer security tool, IDE security | Category |

---

## Content Performance Metrics

Track weekly:
- **Organic impressions** per blog post (Google Search Console)
- **Click-through rate** per target keyword
- **Time on page** (> 3 minutes = good for technical content)
- **Scroll depth** (> 70% = content is engaging)
- **Backlinks earned** per post (Ahrefs/Semrush)
- **Social shares** (LinkedIn, X, HN upvotes, Reddit upvotes)
- **Marketplace installs** attributed to content (UTM tracking)
- **GitHub stars** growth correlated with content publishing

---

*Document version: 1.0 -- Created 2026-07-06*
