# SoterAI SEO Page Plan

**Date:** 2026-07-06
**Domain:** soterai.in
**Total pages planned:** 35 (13 core + 6 comparison + 6 use-case + 10 blog)

---

## 1. Core Landing Pages

### 1.1 Homepage

- **URL:** `/`
- **Title tag:** Local-First AI Security for Developers | SoterAI
- **Meta description:** SoterAI protects your code from AI data leaks, prompt injection, and unsafe tool calls. Local-first security for VS Code, Cursor, and Claude Code.
- **H1:** Local-First AI Security for Developers
- **Primary keyword:** AI security for developers
- **Content outline:**
  - Hero: Headline + CTA (Install Extension) + animated security console
  - Problem statement: AI coding tools see your secrets, configs, and private code
  - Product overview: 6 core capabilities (context firewall, safe mode, memory inspector, local broker, MCP security, DLP)
  - How it works: 3-step visual (install, configure, code securely)
  - Social proof: benchmarks stats (ROC-AUC, false positive rate), trust badges
  - Comparison snapshot: SoterAI vs alternatives (feature matrix)
  - FAQ section (5-8 questions)
  - Final CTA: Install free from VS Code Marketplace
- **CTA:** Install Free Extension
- **Internal links to:** /vscode-ai-security, /cursor-ai-security, /pricing, /docs, /benchmarks, /comparison
- **Internal links from:** Every page (nav + footer)
- **Schema type:** WebPage, SoftwareApplication, FAQPage
- **Priority:** P0
- **Status:** EXISTS -- needs content refresh to match new keyword targets

---

### 1.2 VS Code AI Security

- **URL:** `/vscode-ai-security`
- **Title tag:** VS Code AI Security Extension | SoterAI
- **Meta description:** Protect your VS Code workflow from AI data leaks and prompt injection. SoterAI scans context, redacts secrets, and audits what AI sees.
- **H1:** AI Security Extension for VS Code
- **Primary keyword:** VS Code AI security extension
- **Content outline:**
  - Hero: VS Code marketplace badge + install CTA
  - What threats VS Code AI extensions create (Copilot, Cline, Continue context access)
  - Feature breakdown: context firewall, secret redaction, safe mode, memory inspector
  - Installation guide (3 steps)
  - Screenshot walkthrough of extension in action
  - Comparison: with vs without SoterAI in VS Code
  - Testimonials / benchmark stats
  - FAQ (5 questions)
- **CTA:** Install from VS Code Marketplace
- **Internal links to:** /cursor-ai-security, /ai-memory-inspector, /mcp-security, /docs/quickstart, /pricing
- **Internal links from:** /, /cursor-ai-security, /use-cases/vibe-coding-security, /compare/lakera-alternative
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P0
- **Status:** TO CREATE

---

### 1.3 Cursor AI Security

- **URL:** `/cursor-ai-security`
- **Title tag:** Secure Cursor AI - Protect Code & Secrets | SoterAI
- **Meta description:** Cursor AI reads your entire codebase. SoterAI prevents secret leaks, blocks prompt injection, and gives you full visibility into what Cursor sees.
- **H1:** Secure Your Cursor AI Workflow
- **Primary keyword:** Cursor security extension
- **Content outline:**
  - Hero: "Cursor reads everything" problem statement
  - How Cursor AI accesses your codebase (context window explanation)
  - Risks: .env exposure, .cursorrules injection, codebase leakage
  - SoterAI protection: context firewall, secret redaction, rule file scanning
  - Setup guide for Cursor users
  - Before/after security comparison
  - Vibe coding security angle
  - FAQ (5 questions about Cursor-specific risks)
- **CTA:** Secure Your Cursor Setup
- **Internal links to:** /vscode-ai-security, /ai-data-leakage-prevention, /use-cases/vibe-coding-security, /prompt-injection-protection
- **Internal links from:** /, /vscode-ai-security, /use-cases/vibe-coding-security
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P0
- **Status:** TO CREATE

---

### 1.4 Local AI Broker

- **URL:** `/local-ai-broker`
- **Title tag:** Local AI Broker - On-Device AI Security | SoterAI
- **Meta description:** Route AI requests through a local security broker. SoterAI inspects, redacts, and logs every prompt before it leaves your machine.
- **H1:** Local AI Broker for Developer Security
- **Primary keyword:** Local AI broker
- **Content outline:**
  - Hero: "Your prompts never leave your machine unprotected"
  - Architecture diagram: IDE > Local Broker > Redaction > Cloud AI > Broker > IDE
  - What the broker intercepts: prompts, context, file contents, terminal commands
  - Privacy guarantees: local-first, no cloud dependency for security layer
  - Configuration options and policies
  - Performance impact (latency benchmarks)
  - Comparison: local broker vs cloud guardrails
  - Use cases: startups, regulated industries, privacy-conscious teams
- **CTA:** Download Local Broker
- **Internal links to:** /ai-data-leakage-prevention, /ai-safe-mode, /privacy, /trust, /docs
- **Internal links from:** /, /ai-data-leakage-prevention, /use-cases/startup-ai-security
- **Schema type:** SoftwareApplication, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 1.5 AI Safe Mode

- **URL:** `/ai-safe-mode`
- **Title tag:** AI Safe Mode - Controlled AI Coding | SoterAI
- **Meta description:** AI Safe Mode restricts what AI tools can see and do. Block file access, terminal commands, and context reads with one-click policies.
- **H1:** AI Safe Mode for Developers
- **Primary keyword:** AI safe mode
- **Content outline:**
  - Hero: "One click to restrict AI access"
  - What Safe Mode controls: file reads, terminal commands, context window, tool calls
  - Policy levels: permissive, standard, strict, lockdown
  - Visual: side-by-side of normal vs safe mode AI behavior
  - When to use Safe Mode (client projects, regulated codebases, onboarding new AI tools)
  - Configuration via extension settings and CLI
  - Integration with MCP security policies
  - FAQ (5 questions)
- **CTA:** Enable AI Safe Mode
- **Internal links to:** /vscode-ai-security, /mcp-security, /ai-memory-inspector, /docs
- **Internal links from:** /, /local-ai-broker, /mcp-security, /use-cases/enterprise-ai-coding-governance
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 1.6 AI Memory Inspector

- **URL:** `/ai-memory-inspector`
- **Title tag:** AI Memory Inspector - Audit What AI Saw | SoterAI
- **Meta description:** See exactly what your AI coding tools accessed. SoterAI logs every file read, context inclusion, and prompt sent -- full audit trail.
- **H1:** AI Memory Inspector: Know What AI Saw
- **Primary keyword:** AI memory inspector
- **Content outline:**
  - Hero: "What did your AI see?" with audit log visualization
  - The problem: AI tools read files silently, no audit trail
  - What Memory Inspector logs: file accesses, context inclusions, prompt contents, tool calls
  - Dashboard walkthrough: timeline view, file access heatmap, prompt history
  - Export and compliance: audit logs for SOC 2, ISO 27001, DPDP
  - Privacy: all logs stored locally, no cloud sync required
  - Integration with VS Code extension and CLI
  - FAQ (5 questions)
- **CTA:** Start Your AI Audit
- **Internal links to:** /ai-data-leakage-prevention, /ai-safe-mode, /trust, /docs, /compliance/soc2-readiness
- **Internal links from:** /, /vscode-ai-security, /local-ai-broker
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 1.7 MCP Security

- **URL:** `/mcp-security`
- **Title tag:** MCP Security - Secure AI Tool Permissions | SoterAI
- **Meta description:** MCP servers give AI tools dangerous capabilities. SoterAI scans, validates, and enforces permissions on every MCP tool call.
- **H1:** MCP Security for AI Tool Calls
- **Primary keyword:** MCP security
- **Content outline:**
  - Hero: "AI tools are running code on your machine" with risk visualization
  - What MCP is and why it matters (brief explainer)
  - Risks: unauthorized file access, command execution, data exfiltration via MCP tools
  - SoterAI MCP protection: tool permission scanning, call validation, risk scoring
  - MCP server risk scanner: scan any MCP server config for vulnerabilities
  - Policy enforcement: allowlists, blocklists, approval workflows
  - Real examples of MCP security risks (sanitized)
  - FAQ (5 questions)
- **CTA:** Scan Your MCP Servers
- **Internal links to:** /prompt-injection-protection, /ai-safe-mode, /docs, /compliance/owasp-llm-top-10
- **Internal links from:** /, /vscode-ai-security, /ai-safe-mode
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 1.8 Prompt Injection Protection

- **URL:** `/prompt-injection-protection`
- **Title tag:** Prompt Injection Protection for Developers | SoterAI
- **Meta description:** Detect and block prompt injection attacks in your AI workflow. SoterAI scans README files, configs, and inputs for injection payloads.
- **H1:** Prompt Injection Protection
- **Primary keyword:** Prompt injection protection
- **Content outline:**
  - Hero: Example of a prompt injection attack in a README file
  - What prompt injection is (brief, visual explainer)
  - Attack vectors: README files, .cursorrules, CLAUDE.md, dependency docs, user input
  - Detection capabilities: pattern matching, semantic analysis, multi-layer scanning
  - Benchmark results: detection rate, false positive rate, ROC-AUC
  - Integration: scans on file open, on paste, on AI context inclusion
  - OWASP LLM Top 10 alignment
  - FAQ (5 questions)
- **CTA:** Try the Prompt Scanner
- **Internal links to:** /ai-data-leakage-prevention, /benchmarks, /comparison, /compliance/owasp-llm-top-10, /docs
- **Internal links from:** /, /mcp-security, /vscode-ai-security, /cursor-ai-security
- **Schema type:** SoftwareApplication, FAQPage, BreadcrumbList
- **Priority:** P0
- **Status:** TO CREATE

---

### 1.9 AI Data Leakage Prevention

- **URL:** `/ai-data-leakage-prevention`
- **Title tag:** AI Data Leakage Prevention for Developers | SoterAI
- **Meta description:** Prevent AI coding tools from leaking secrets, PII, and proprietary code. SoterAI redacts sensitive data before it reaches any AI model.
- **H1:** AI Data Leakage Prevention
- **Primary keyword:** AI data leakage prevention
- **Content outline:**
  - Hero: "Your .env file is in the AI's context window" with redaction demo
  - What data AI tools can leak: API keys, tokens, PII, database credentials, proprietary code
  - How leakage happens: context window inclusion, prompt caching, model training
  - SoterAI DLP: real-time scanning, pattern detection (regex + ML), automatic redaction
  - Supported secret types: AWS keys, API tokens, .env files, PII (SSN, Aadhaar, PAN, credit cards)
  - Policy configuration: what to redact, what to warn, what to block
  - Audit trail: every redaction logged for compliance
  - ROI: cost of a single leaked API key vs SoterAI subscription
- **CTA:** See DLP in Action
- **Internal links to:** /ai-memory-inspector, /local-ai-broker, /pricing, /trust, /compliance/soc2-readiness
- **Internal links from:** /, /vscode-ai-security, /cursor-ai-security, /prompt-injection-protection
- **Schema type:** SoftwareApplication, BreadcrumbList
- **Priority:** P0
- **Status:** TO CREATE

---

### 1.10 Pricing

- **URL:** `/pricing`
- **Title tag:** Pricing - AI Security Plans for Every Team | SoterAI
- **Meta description:** Free for individuals. Pro for teams. Enterprise for scale. SoterAI AI security pricing starts at $0. No credit card required.
- **H1:** Simple, Transparent Pricing
- **Primary keyword:** AI security SaaS pricing
- **Content outline:**
  - Pricing tiers: Free, Pro, Enterprise (feature comparison table)
  - Feature breakdown per tier
  - FAQ about billing, upgrades, team sizes
  - Enterprise contact form / pilot program link
  - Money-back guarantee or free trial details
  - Comparison with competitor pricing (brief)
  - Trust badges and security certifications
  - Final CTA for each tier
- **CTA:** Start Free / Upgrade to Pro / Contact Sales
- **Internal links to:** /enterprise, /docs, /use-cases/startup-ai-security, /use-cases/enterprise-ai-coding-governance
- **Internal links from:** Every page (nav), /, all comparison pages
- **Schema type:** Product, AggregateOffer (already implemented)
- **Priority:** P0
- **Status:** EXISTS -- has Product + AggregateOffer schema, needs keyword optimization

---

### 1.11 Docs Hub

- **URL:** `/docs`
- **Title tag:** Documentation - SoterAI AI Security Platform
- **Meta description:** Get started with SoterAI in under 5 minutes. Quickstart guides, API reference, SDK docs, and integration tutorials for AI security.
- **H1:** SoterAI Documentation
- **Primary keyword:** SoterAI docs
- **Content outline:**
  - Quick links: Quickstart, API Reference, SDK guides
  - Getting started section with 3-step install
  - SDK documentation index (JS, Python, Next.js, Express, FastAPI)
  - API contract reference
  - Integration guides (Botpress, Intercom, Zendesk, WhatsApp, WordPress)
  - Best practices guide
  - FAQ section
  - Search functionality
- **CTA:** Get Started in 5 Minutes
- **Internal links to:** /docs/quickstart, /docs/rest-api, /docs/js, /docs/python, /docs/best-practices, all integration guides
- **Internal links from:** /, /pricing, every landing page
- **Schema type:** WebPage, FAQPage, BreadcrumbList (already implemented)
- **Priority:** P0
- **Status:** EXISTS -- has BreadcrumbList + FAQPage schema

---

### 1.12 Privacy Policy

- **URL:** `/privacy`
- **Title tag:** Privacy Policy | SoterAI
- **Meta description:** SoterAI is local-first by design. Read our privacy policy to understand what data we collect, how we use it, and your rights.
- **H1:** Privacy Policy
- **Primary keyword:** SoterAI privacy policy
- **Content outline:**
  - Data collection: what we collect and why
  - Local-first architecture: what stays on your machine
  - Data processing: how we handle telemetry (if any)
  - Third-party processors / subprocessors
  - Your rights: access, deletion, portability
  - DPDP compliance (India)
  - GDPR compliance (EU users)
  - Contact information for privacy inquiries
- **CTA:** Contact Privacy Team
- **Internal links to:** /terms, /trust, /subprocessors, /data-retention
- **Internal links from:** Footer (all pages), /local-ai-broker, /ai-memory-inspector
- **Schema type:** WebPage
- **Priority:** P1
- **Status:** EXISTS -- has metadata + OpenGraph

---

### 1.13 Limitations

- **URL:** `/limitations`
- **Title tag:** Known Limitations | SoterAI
- **Meta description:** SoterAI is transparent about what we can and cannot protect. Read our honest assessment of current limitations and our roadmap.
- **H1:** Known Limitations
- **Primary keyword:** SoterAI limitations
- **Content outline:**
  - Philosophy: why we publish limitations publicly
  - Current detection boundaries (false positive/negative rates)
  - What SoterAI does not protect against (list with explanations)
  - IDE coverage: VS Code supported, others in progress
  - Language/framework coverage gaps
  - Performance constraints and known edge cases
  - Roadmap for addressing limitations
  - How to report issues
- **CTA:** Report an Issue / View Roadmap
- **Internal links to:** /benchmarks, /trust, /security, /changelog
- **Internal links from:** /trust, /security, footer
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

## 2. Comparison Pages

### 2.1 Lakera Alternative

- **URL:** `/compare/lakera-alternative`
- **Title tag:** SoterAI vs Lakera - AI Security Comparison
- **Meta description:** Compare SoterAI and Lakera for AI security. SoterAI offers local-first IDE protection while Lakera focuses on API-level guardrails.
- **H1:** SoterAI vs Lakera: Which AI Security Tool Is Right for You?
- **Primary keyword:** Lakera alternative
- **Content outline:**
  - Quick comparison table (features, pricing, deployment model)
  - What Lakera does well (API guardrails, enterprise focus)
  - Where SoterAI differs (local-first, IDE-level, developer-focused)
  - Feature-by-feature breakdown: prompt injection, DLP, MCP, audit trail
  - Deployment: cloud API vs local extension
  - Pricing comparison
  - Who should choose which (decision framework)
  - FAQ (5 comparison questions)
- **CTA:** Try SoterAI Free
- **Internal links to:** /benchmarks, /pricing, /prompt-injection-protection, /compare/prompt-security-alternative
- **Internal links from:** /, /comparison, /prompt-injection-protection
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE (existing `/comparison/lakera` should redirect here)

---

### 2.2 GitGuardian AI Security

- **URL:** `/compare/gitguardian-ai-security`
- **Title tag:** SoterAI vs GitGuardian for AI Security
- **Meta description:** GitGuardian catches secrets in git. SoterAI catches secrets before AI sees them. Compare pre-commit vs pre-prompt security approaches.
- **H1:** SoterAI vs GitGuardian: AI-Era Secret Protection
- **Primary keyword:** GitGuardian alternative for AI
- **Content outline:**
  - Quick comparison table
  - GitGuardian's strength: git-level secret scanning (pre-commit, CI/CD)
  - The gap: GitGuardian does not protect the AI context window
  - SoterAI's approach: pre-prompt secret redaction at IDE level
  - Complementary tools: how they work together
  - Feature comparison: detection scope, AI-specific features, deployment
  - Pricing comparison
  - Decision framework: when to use which (or both)
- **CTA:** Try SoterAI Free
- **Internal links to:** /ai-data-leakage-prevention, /pricing, /docs, /compare/lakera-alternative
- **Internal links from:** /, /comparison, /ai-data-leakage-prevention
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 2.3 Prompt Security Alternative

- **URL:** `/compare/prompt-security-alternative`
- **Title tag:** SoterAI vs Prompt Security - Developer-First AI Security
- **Meta description:** Prompt Security guards LLM APIs. SoterAI guards your IDE. Compare cloud-first vs local-first approaches to AI prompt security.
- **H1:** SoterAI vs Prompt Security: Developer-First AI Protection
- **Primary keyword:** Prompt Security alternative
- **Content outline:**
  - Quick comparison table
  - Prompt Security overview: API-level prompt firewall, enterprise LLM governance
  - SoterAI's approach: IDE-level, local-first, developer-focused
  - Key difference: where protection happens (API gateway vs developer machine)
  - Feature comparison: prompt injection, DLP, audit, MCP
  - Developer experience comparison
  - Pricing comparison
  - FAQ (5 questions)
- **CTA:** Try SoterAI Free
- **Internal links to:** /prompt-injection-protection, /benchmarks, /pricing, /compare/lakera-alternative
- **Internal links from:** /, /comparison, /prompt-injection-protection
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE (existing `/comparison/prompt-security` should redirect here)

---

### 2.4 HiddenLayer Alternative

- **URL:** `/compare/hiddenlayer-alternative`
- **Title tag:** SoterAI vs HiddenLayer - AI Security Comparison
- **Meta description:** HiddenLayer secures ML models in production. SoterAI secures AI coding workflows at the IDE level. See how they compare.
- **H1:** SoterAI vs HiddenLayer: Different Layers of AI Security
- **Primary keyword:** HiddenLayer alternative
- **Content outline:**
  - Quick comparison table
  - HiddenLayer focus: ML model security, adversarial attack detection, model supply chain
  - SoterAI focus: developer workflow security, IDE-level protection
  - Different threat models: model attacks vs context/prompt attacks
  - When you need HiddenLayer (ML ops teams)
  - When you need SoterAI (developers using AI coding tools)
  - Complementary use cases
  - FAQ (5 questions)
- **CTA:** Try SoterAI Free
- **Internal links to:** /model-supply-chain-security, /prompt-injection-protection, /pricing, /compare/lakera-alternative
- **Internal links from:** /, /comparison, /model-supply-chain-security
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE (existing `/comparison/hiddenlayer` should redirect here)

---

### 2.5 Snyk vs SoterAI

- **URL:** `/compare/snyk-vs-soterai`
- **Title tag:** Snyk vs SoterAI - Code Security vs AI Security
- **Meta description:** Snyk finds vulnerabilities in code. SoterAI prevents AI tools from leaking your code. See why modern teams need both.
- **H1:** Snyk vs SoterAI: Traditional Code Security vs AI Security
- **Primary keyword:** Snyk vs SoterAI
- **Content outline:**
  - Quick comparison table
  - Snyk's domain: SAST, SCA, container security, IaC scanning
  - SoterAI's domain: AI context security, prompt injection, DLP for AI tools
  - Why they are complementary, not competitors
  - The new attack surface: AI tools as a vector (not just code vulnerabilities)
  - Feature comparison where they overlap (secret detection)
  - Decision framework
  - FAQ (5 questions)
- **CTA:** Add AI Security to Your Stack
- **Internal links to:** /ai-data-leakage-prevention, /prompt-injection-protection, /pricing, /compare/semgrep-vs-soterai
- **Internal links from:** /comparison, /compare/semgrep-vs-soterai
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 2.6 Semgrep vs SoterAI

- **URL:** `/compare/semgrep-vs-soterai`
- **Title tag:** Semgrep vs SoterAI - SAST vs AI Security
- **Meta description:** Semgrep finds code patterns and vulnerabilities. SoterAI protects your code from AI tools. Different problems, different solutions.
- **H1:** Semgrep vs SoterAI: Static Analysis vs AI Security
- **Primary keyword:** Semgrep vs SoterAI
- **Content outline:**
  - Quick comparison table
  - Semgrep's domain: custom SAST rules, code pattern matching, policy enforcement
  - SoterAI's domain: AI-specific security (context firewall, prompt scanning, DLP)
  - Why code scanners miss AI-specific threats
  - The AI attack surface that Semgrep rules cannot cover
  - Complementary workflow: Semgrep for code quality + SoterAI for AI safety
  - Decision framework
  - FAQ (5 questions)
- **CTA:** Add AI Security to Your Stack
- **Internal links to:** /prompt-injection-protection, /ai-data-leakage-prevention, /pricing, /compare/snyk-vs-soterai
- **Internal links from:** /comparison, /compare/snyk-vs-soterai
- **Schema type:** WebPage, FAQPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

## 3. Use-Case Pages

### 3.1 Vibe Coding Security

- **URL:** `/use-cases/vibe-coding-security`
- **Title tag:** Vibe Coding Security - Stay Safe While Shipping Fast
- **Meta description:** Vibe coding with Cursor and Copilot is fast but risky. SoterAI protects your secrets and code without slowing your flow.
- **H1:** Secure Vibe Coding Without Killing the Vibe
- **Primary keyword:** Vibe coding security
- **Content outline:**
  - What vibe coding is and why developers love it
  - The security risks: AI reads everything, fast iteration means less review
  - Real scenarios: .env in context, AI suggesting leaked patterns, prompt injection via dependencies
  - How SoterAI protects vibe coding: background scanning, non-intrusive alerts, auto-redaction
  - Setup: 2-minute install, zero config needed
  - Testimonial / before-after scenario
  - Compatible tools: Cursor, Copilot, Claude Code, Cline, Continue
  - CTA section
- **CTA:** Install Extension -- Keep Vibing Safely
- **Internal links to:** /cursor-ai-security, /ai-safe-mode, /ai-memory-inspector, /vscode-ai-security
- **Internal links from:** /, /cursor-ai-security, /vscode-ai-security
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 3.2 Startup AI Security

- **URL:** `/use-cases/startup-ai-security`
- **Title tag:** AI Security for Startups - Protect IP While Moving Fast
- **Meta description:** Startups use AI tools heavily but cannot afford a data leak. SoterAI offers free-tier AI security that protects your IP from day one.
- **H1:** AI Security for Startups
- **Primary keyword:** AI security tool for startups
- **Content outline:**
  - Why startups are the most at-risk (small teams, heavy AI use, IP-dependent)
  - Common startup risks: sole developer using Cursor, API keys in .env, no security review
  - The cost of a leak for a startup (investor confidence, IP theft, compliance)
  - SoterAI's startup-friendly approach: free tier, 2-minute setup, no infra required
  - Feature highlights for startups: secret redaction, context firewall, audit log
  - Pricing: free for individuals, affordable Pro for small teams
  - Case study or scenario (seed-stage startup protecting their AI workflow)
  - CTA section
- **CTA:** Start Free -- No Credit Card
- **Internal links to:** /pricing, /docs/quickstart, /local-ai-broker, /use-cases/freelancer-ai-security
- **Internal links from:** /, /pricing, /compare/lakera-alternative
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 3.3 Freelancer AI Security

- **URL:** `/use-cases/freelancer-ai-security`
- **Title tag:** AI Security for Freelancers - Protect Client Code
- **Meta description:** Freelancers handle multiple client codebases with AI tools. SoterAI ensures client secrets and proprietary code never leak to AI models.
- **H1:** AI Security for Freelance Developers
- **Primary keyword:** AI security for freelancers
- **Content outline:**
  - Freelancer risk profile: multiple client projects, varied security policies, AI tool dependency
  - Client trust: what happens when AI leaks a client's API keys
  - Liability concerns: contractual obligations around data protection
  - SoterAI for freelancers: per-project security policies, secret redaction, audit trail
  - Show clients your security posture (exportable audit logs)
  - Free tier covers most freelancer needs
  - Setup walkthrough
  - CTA section
- **CTA:** Protect Client Projects Free
- **Internal links to:** /pricing, /ai-memory-inspector, /ai-data-leakage-prevention, /use-cases/startup-ai-security
- **Internal links from:** /pricing, /use-cases/startup-ai-security
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 3.4 Agency AI Security

- **URL:** `/use-cases/agency-ai-security`
- **Title tag:** AI Security for Dev Agencies - Manage Team Risk
- **Meta description:** Dev agencies manage multiple developers using AI tools across client projects. SoterAI provides centralized AI security policies and audit trails.
- **H1:** AI Security for Development Agencies
- **Primary keyword:** AI security for agencies
- **Content outline:**
  - Agency risk: multiple developers, multiple clients, inconsistent AI tool usage
  - Governance challenges: enforcing security policies across teams
  - Client compliance requirements (SOC 2, ISO 27001)
  - SoterAI for agencies: centralized policies, per-project configs, team audit dashboard
  - Partner program benefits
  - Pricing for teams
  - Case study or scenario
  - CTA section
- **CTA:** Explore Agency Plan / Become a Partner
- **Internal links to:** /pricing, /enterprise, /partners/agency, /compliance/soc2-readiness
- **Internal links from:** /pricing, /partners/agency, /use-cases/startup-ai-security
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 3.5 Enterprise AI Coding Governance

- **URL:** `/use-cases/enterprise-ai-coding-governance`
- **Title tag:** Enterprise AI Coding Governance | SoterAI
- **Meta description:** Enforce AI coding policies at scale. SoterAI provides centralized governance, compliance reporting, and audit trails for enterprise teams.
- **H1:** Enterprise AI Coding Governance
- **Primary keyword:** Enterprise AI coding governance
- **Content outline:**
  - Enterprise challenge: hundreds of developers using AI tools with no visibility
  - Regulatory pressure: SOC 2, ISO 27001, GDPR, DPDP requirements for AI usage
  - SoterAI Enterprise: centralized policy engine, compliance dashboards, SIEM integration
  - Role-based access and policy enforcement
  - Audit and reporting capabilities
  - Deployment options: SaaS, on-premise, hybrid
  - Integration with existing security stack (SIEM, SSO, SCIM)
  - Enterprise pilot program
- **CTA:** Request Enterprise Pilot
- **Internal links to:** /enterprise, /enterprise/pilot, /pricing, /compliance/soc2-readiness, /compliance/iso27001-readiness
- **Internal links from:** /, /enterprise, /pricing, /ai-safe-mode
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 3.6 India DPDP AI Security

- **URL:** `/use-cases/india-dpdp-ai-security`
- **Title tag:** DPDP Compliance for AI Dev Tools - India | SoterAI
- **Meta description:** Ensure DPDP compliance for AI coding workflows. SoterAI detects Aadhaar, PAN, GSTIN, and other Indian PII before AI tools can access it.
- **H1:** DPDP-Compliant AI Security for Indian Developers
- **Primary keyword:** DPDP AI security
- **Content outline:**
  - DPDP Act overview and relevance to AI developer tools
  - Indian PII at risk: Aadhaar numbers, PAN cards, GSTIN, phone numbers, UPI IDs
  - How AI tools can inadvertently process Indian PII
  - SoterAI's India-specific detection: Aadhaar patterns, PAN validation, GSTIN format matching
  - Compliance reporting for DPDP audits
  - Local-first advantage: data never leaves Indian jurisdiction
  - Case study: Indian startup protecting customer data in AI workflow
  - Resources: DPDP Act links, compliance checklist
- **CTA:** Ensure DPDP Compliance
- **Internal links to:** /ai-data-leakage-prevention, /privacy, /enterprise, /compliance/owasp-llm-top-10
- **Internal links from:** /, /privacy, /ai-data-leakage-prevention
- **Schema type:** WebPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

## 4. Blog Posts

### 4.1 How AI Coding Tools Can Leak Secrets

- **URL:** `/blog/how-ai-coding-tools-leak-secrets`
- **Title tag:** How AI Coding Tools Can Leak Your Secrets
- **Meta description:** AI coding assistants read .env files, API keys, and database credentials. Learn how secrets leak through AI context windows and how to prevent it.
- **H1:** How AI Coding Tools Can Leak Your Secrets
- **Primary keyword:** Stop AI from reading secrets
- **Content outline:**
  - The hidden risk: what AI coding tools actually read
  - Real examples of secret exposure via AI context (sanitized)
  - How context windows work and why .env files get included
  - The prompt caching risk: secrets stored in AI provider caches
  - 5 types of secrets most commonly leaked
  - Prevention strategies (manual vs automated)
  - How SoterAI solves this automatically
  - Actionable checklist for developers
- **CTA:** Install SoterAI to Protect Your Secrets
- **Internal links to:** /ai-data-leakage-prevention, /vscode-ai-security, /local-ai-broker
- **Internal links from:** /ai-data-leakage-prevention, /docs/best-practices
- **Schema type:** Article, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.2 What Is an AI Context Firewall?

- **URL:** `/blog/what-is-ai-context-firewall`
- **Title tag:** What Is an AI Context Firewall?
- **Meta description:** An AI context firewall controls what data AI tools can see. Learn how it works, why you need one, and how SoterAI implements it at the IDE level.
- **H1:** What Is an AI Context Firewall?
- **Primary keyword:** AI context firewall
- **Content outline:**
  - Definition: what an AI context firewall is
  - Analogy: network firewall vs context firewall
  - What it controls: file access, context inclusion, prompt content, tool calls
  - Why traditional firewalls do not protect AI workflows
  - How SoterAI's context firewall works (architecture diagram)
  - Policy configuration examples
  - Comparison with API-level guardrails
  - Getting started with context firewall in VS Code
- **CTA:** Install the AI Context Firewall
- **Internal links to:** /vscode-ai-security, /prompt-injection-protection, /mcp-security
- **Internal links from:** /, /vscode-ai-security, /ai-safe-mode
- **Schema type:** Article, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.3 MCP Security: Why Tool Permissions Matter

- **URL:** `/blog/mcp-security-tool-permissions`
- **Title tag:** MCP Security: Why AI Tool Permissions Matter
- **Meta description:** MCP gives AI tools access to files, APIs, and commands. Without proper permissions, MCP servers become a major attack vector. Here is what to do.
- **H1:** MCP Security: Why Tool Permissions Matter
- **Primary keyword:** MCP tool security
- **Content outline:**
  - What MCP (Model Context Protocol) is
  - How MCP servers grant AI tools real-world capabilities
  - The permission problem: most MCP servers have no access controls
  - Real risk scenarios: file system access, command execution, API calls
  - MCP security best practices
  - How SoterAI scans and enforces MCP permissions
  - Checklist: securing your MCP server configuration
  - Future of MCP security standards
- **CTA:** Scan Your MCP Servers with SoterAI
- **Internal links to:** /mcp-security, /ai-safe-mode, /docs
- **Internal links from:** /mcp-security, /docs/best-practices
- **Schema type:** Article, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.4 Prompt Injection in README Files

- **URL:** `/blog/prompt-injection-in-readme-files`
- **Title tag:** Prompt Injection in README Files - A Hidden Threat
- **Meta description:** Attackers can embed prompt injection payloads in README files, .cursorrules, and CLAUDE.md. AI tools execute them silently. Here is how to detect it.
- **H1:** Prompt Injection in README Files: The Hidden Threat
- **Primary keyword:** Prompt injection in README
- **Content outline:**
  - The attack: how prompt injection works in documentation files
  - Attack vectors: README.md, CLAUDE.md, .cursorrules, CONTRIBUTING.md, package.json
  - Real-world examples (sanitized): injections found in open source repos
  - Why AI tools trust these files implicitly
  - The repo poisoning threat model
  - Detection: what to look for (patterns, obfuscation techniques)
  - How SoterAI detects injections in project files
  - Defense checklist for open source maintainers
- **CTA:** Scan Your Repo for Prompt Injection
- **Internal links to:** /prompt-injection-protection, /cursor-ai-security, /mcp-security
- **Internal links from:** /prompt-injection-protection, /compliance/owasp-llm-top-10
- **Schema type:** Article, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.5 How to Protect .env Files from AI Assistants

- **URL:** `/blog/protect-env-files-from-ai`
- **Title tag:** How to Protect .env Files from AI Assistants
- **Meta description:** Your .env file contains API keys, database URLs, and secrets. AI coding tools can read it all. Here are 7 ways to protect your environment files.
- **H1:** How to Protect .env Files from AI Assistants
- **Primary keyword:** Protect .env from AI
- **Content outline:**
  - Why .env files are the #1 leak risk with AI tools
  - How AI assistants access .env: context window, file reading, terminal output
  - 7 protection strategies (from manual to automated)
  - Strategy 1: .gitignore is not enough (AI reads untracked files too)
  - Strategy 2: Use environment variables, not .env files
  - Strategy 3: SoterAI automatic .env redaction
  - Strategy 4-7: Additional techniques
  - Tool comparison: manual vs SoterAI vs other approaches
  - Step-by-step setup guide
- **CTA:** Auto-Protect .env Files with SoterAI
- **Internal links to:** /ai-data-leakage-prevention, /vscode-ai-security, /docs/quickstart
- **Internal links from:** /ai-data-leakage-prevention, /docs/best-practices
- **Schema type:** Article, HowTo, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.6 Local AI Broker vs Cloud AI Guardrails

- **URL:** `/blog/local-ai-broker-vs-cloud-guardrails`
- **Title tag:** Local AI Broker vs Cloud AI Guardrails
- **Meta description:** Should you secure AI at the API level or on the developer's machine? Compare local AI brokers and cloud guardrails for developer security.
- **H1:** Local AI Broker vs Cloud AI Guardrails: Which Approach Wins?
- **Primary keyword:** Local AI broker
- **Content outline:**
  - Two approaches to AI security: local-first vs cloud-first
  - Cloud guardrails: how they work (API proxy, prompt filtering)
  - Local broker: how it works (on-device interception, local scanning)
  - Comparison table: latency, privacy, coverage, deployment complexity
  - Pros and cons of each approach
  - When to use cloud guardrails (API-serving applications)
  - When to use a local broker (developer workflows, regulated environments)
  - Hybrid approach: using both together
- **CTA:** Try the Local AI Broker
- **Internal links to:** /local-ai-broker, /compare/lakera-alternative, /privacy
- **Internal links from:** /local-ai-broker, /compare/lakera-alternative
- **Schema type:** Article, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 4.7 What AI Saw: Auditing AI Coding Context

- **URL:** `/blog/auditing-ai-coding-context`
- **Title tag:** What AI Saw: How to Audit Your AI Coding Context
- **Meta description:** Do you know what files your AI coding assistant read today? Learn how to audit AI context access and why every developer needs an AI audit trail.
- **H1:** What AI Saw: Auditing Your AI Coding Context
- **Primary keyword:** What AI saw audit
- **Content outline:**
  - The visibility problem: AI tools read files silently
  - What AI coding tools typically access (files, terminals, clipboard, git history)
  - Why audit trails matter: compliance, security incidents, client trust
  - How to build an AI audit trail manually (and why it is impractical)
  - SoterAI Memory Inspector: automatic audit logging
  - Dashboard walkthrough: understanding your AI access logs
  - Compliance use cases: SOC 2 audits, client reporting
  - Getting started with AI auditing
- **CTA:** Start Your AI Audit Trail
- **Internal links to:** /ai-memory-inspector, /trust, /compliance/soc2-readiness
- **Internal links from:** /ai-memory-inspector, /trust
- **Schema type:** Article, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 4.8 AI Safe Mode for Developers

- **URL:** `/blog/ai-safe-mode-for-developers`
- **Title tag:** AI Safe Mode: One-Click AI Restrictions for Developers
- **Meta description:** AI Safe Mode lets you restrict what AI tools can access with one click. Learn when to use it and how it protects sensitive codebases.
- **H1:** AI Safe Mode: One-Click Restrictions for AI Coding Tools
- **Primary keyword:** AI safe mode
- **Content outline:**
  - What AI Safe Mode is and how it works
  - Use cases: working on client code, regulated projects, security-sensitive repos
  - Policy levels explained: what each level restricts
  - How Safe Mode differs from turning AI off entirely
  - Configuration guide: setting up Safe Mode per project
  - Integration with MCP security and context firewall
  - FAQ: common questions about Safe Mode
  - Getting started
- **CTA:** Enable AI Safe Mode
- **Internal links to:** /ai-safe-mode, /vscode-ai-security, /mcp-security
- **Internal links from:** /ai-safe-mode, /docs
- **Schema type:** Article, FAQPage, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

### 4.9 Cursor, Copilot, Claude Code: Security Risks

- **URL:** `/blog/cursor-copilot-claude-code-security-risks`
- **Title tag:** Cursor, Copilot, Claude Code: Security Risks Developers Should Know
- **Meta description:** Every AI coding tool has different security risks. Compare Cursor, Copilot, and Claude Code security models and learn how to protect yourself.
- **H1:** Cursor, Copilot, Claude Code: Security Risks Developers Should Know
- **Primary keyword:** Secure GitHub Copilot workflow
- **Content outline:**
  - Overview: the three most popular AI coding tools
  - Copilot security model: what it accesses, how data is processed, telemetry
  - Cursor security model: full codebase access, .cursorrules, privacy mode
  - Claude Code security model: terminal access, file system access, MCP tools
  - Comparison table: data access, privacy options, enterprise controls
  - Common risks across all three tools
  - How SoterAI protects each tool differently
  - Recommendations per tool
- **CTA:** Protect All Your AI Coding Tools
- **Internal links to:** /vscode-ai-security, /cursor-ai-security, /ai-data-leakage-prevention
- **Internal links from:** /, /cursor-ai-security, /vscode-ai-security
- **Schema type:** Article, BreadcrumbList
- **Priority:** P1
- **Status:** TO CREATE

---

### 4.10 DPDP and AI Developer Workflows in India

- **URL:** `/blog/dpdp-ai-developer-workflows-india`
- **Title tag:** DPDP Act and AI Developer Workflows in India
- **Meta description:** India's DPDP Act affects how developers use AI coding tools. Learn what Indian devs need to know about PII handling in AI-assisted workflows.
- **H1:** The DPDP Act and AI Developer Workflows in India
- **Primary keyword:** DPDP AI security
- **Content outline:**
  - DPDP Act summary: what it requires for personal data processing
  - How AI coding tools process personal data (Aadhaar, PAN, phone numbers in code/databases)
  - Developer obligations under DPDP when using AI tools
  - Risk scenarios: AI tool sends Indian PII to cloud API
  - How SoterAI detects Indian PII patterns (Aadhaar, PAN, GSTIN, UPI)
  - Local-first advantage: data stays on Indian developer's machine
  - Compliance checklist for Indian dev teams
  - Resources and next steps
- **CTA:** Get DPDP-Compliant AI Security
- **Internal links to:** /use-cases/india-dpdp-ai-security, /ai-data-leakage-prevention, /privacy
- **Internal links from:** /use-cases/india-dpdp-ai-security, /privacy
- **Schema type:** Article, BreadcrumbList
- **Priority:** P2
- **Status:** TO CREATE

---

## 5. Implementation Priority Matrix

### Phase 1: P0 Pages (Weeks 1-4)

| Page | URL | Status | Effort |
|------|-----|--------|--------|
| Homepage refresh | `/` | NEEDS UPDATE | Medium |
| VS Code AI Security | `/vscode-ai-security` | TO CREATE | High |
| Cursor AI Security | `/cursor-ai-security` | TO CREATE | High |
| Prompt Injection Protection | `/prompt-injection-protection` | TO CREATE | High |
| AI Data Leakage Prevention | `/ai-data-leakage-prevention` | TO CREATE | High |
| Pricing optimization | `/pricing` | NEEDS UPDATE | Low |

### Phase 2: P1 Pages (Weeks 5-10)

| Page | URL | Status | Effort |
|------|-----|--------|--------|
| Local AI Broker | `/local-ai-broker` | TO CREATE | High |
| AI Safe Mode | `/ai-safe-mode` | TO CREATE | High |
| AI Memory Inspector | `/ai-memory-inspector` | TO CREATE | High |
| MCP Security | `/mcp-security` | TO CREATE | High |
| Lakera Alternative | `/compare/lakera-alternative` | TO CREATE | Medium |
| GitGuardian Comparison | `/compare/gitguardian-ai-security` | TO CREATE | Medium |
| Prompt Security Alternative | `/compare/prompt-security-alternative` | TO CREATE | Medium |
| Vibe Coding Security | `/use-cases/vibe-coding-security` | TO CREATE | Medium |
| Startup AI Security | `/use-cases/startup-ai-security` | TO CREATE | Medium |
| Enterprise Governance | `/use-cases/enterprise-ai-coding-governance` | TO CREATE | Medium |
| Blog: AI Tools Leak Secrets | `/blog/how-ai-coding-tools-leak-secrets` | TO CREATE | Medium |
| Blog: AI Context Firewall | `/blog/what-is-ai-context-firewall` | TO CREATE | Medium |
| Blog: MCP Security | `/blog/mcp-security-tool-permissions` | TO CREATE | Medium |
| Blog: Prompt Injection README | `/blog/prompt-injection-in-readme-files` | TO CREATE | Medium |
| Blog: Protect .env | `/blog/protect-env-files-from-ai` | TO CREATE | Medium |
| Blog: Cursor/Copilot/Claude | `/blog/cursor-copilot-claude-code-security-risks` | TO CREATE | Medium |

### Phase 3: P2 Pages (Weeks 11-16)

| Page | URL | Status | Effort |
|------|-----|--------|--------|
| HiddenLayer Alternative | `/compare/hiddenlayer-alternative` | TO CREATE | Medium |
| Snyk vs SoterAI | `/compare/snyk-vs-soterai` | TO CREATE | Medium |
| Semgrep vs SoterAI | `/compare/semgrep-vs-soterai` | TO CREATE | Medium |
| Freelancer AI Security | `/use-cases/freelancer-ai-security` | TO CREATE | Medium |
| Agency AI Security | `/use-cases/agency-ai-security` | TO CREATE | Medium |
| India DPDP | `/use-cases/india-dpdp-ai-security` | TO CREATE | Medium |
| Limitations | `/limitations` | TO CREATE | Low |
| Blog: Local Broker vs Cloud | `/blog/local-ai-broker-vs-cloud-guardrails` | TO CREATE | Medium |
| Blog: What AI Saw | `/blog/auditing-ai-coding-context` | TO CREATE | Medium |
| Blog: AI Safe Mode | `/blog/ai-safe-mode-for-developers` | TO CREATE | Medium |
| Blog: DPDP India | `/blog/dpdp-ai-developer-workflows-india` | TO CREATE | Medium |

### Redirects Required

| Old URL | New URL | Type |
|---------|---------|------|
| `/comparison/lakera` | `/compare/lakera-alternative` | 301 |
| `/comparison/hiddenlayer` | `/compare/hiddenlayer-alternative` | 301 |
| `/comparison/prompt-security` | `/compare/prompt-security-alternative` | 301 |

---

## 6. Technical SEO Requirements for All New Pages

Every new page must include:

1. **Metadata export** with unique title (50-60 chars) and description (120-155 chars)
2. **`alternates.canonical`** pointing to self
3. **OpenGraph properties**: title, description, url, type, image
4. **Twitter card**: inherits from OG via Next.js metadata API
5. **JSON-LD structured data**: appropriate schema type (Article, SoftwareApplication, FAQPage, etc.)
6. **BreadcrumbList** structured data via `breadcrumbList()` helper from `lib/seo/schema.ts`
7. **Internal links**: minimum 3 outbound internal links, aim for 2+ inbound links from existing pages
8. **H1 tag**: exactly one, containing primary keyword
9. **Image alt text**: all images must have descriptive alt attributes
10. **Mobile-responsive layout**: using Tailwind responsive classes

### Metadata Template

```typescript
export const metadata: Metadata = {
  title: "Page Title Here",
  description: "155-character description here.",
  alternates: {
    canonical: "/page-path",
  },
  openGraph: {
    title: "Page Title Here",
    description: "155-character description here.",
    url: "/page-path",
    type: "website", // or "article" for blog posts
  },
};
```

### JSON-LD Template for Blog Posts

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Article Title",
  description: "Article description",
  author: {
    "@type": "Organization",
    name: "SoterAI",
    url: "https://soterai.in",
  },
  datePublished: "2026-07-06",
  dateModified: "2026-07-06",
  publisher: {
    "@type": "Organization",
    name: "SoterAI",
    logo: {
      "@type": "ImageObject",
      url: "https://soterai.in/icon.png",
    },
  },
};
```
