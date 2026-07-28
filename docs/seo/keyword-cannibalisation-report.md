# SoterAI Keyword Cannibalisation Report

**Date:** 2026-07-28
**Status:** Based on repository inspection + SERP analysis

---

## Confirmed Cannibalisation Risks

### Risk 1 — /benchmark vs /benchmarks (DUPLICATE ROUTE)

| Property | Value |
|----------|-------|
| URLs | /benchmark and /benchmarks both exist as directories in app/ |
| Keyword targeted | "AI security benchmark", "prompt injection benchmark" |
| Risk level | HIGH |
| Type | Near-duplicate or identical content |

**Evidence:** Both directories exist. sitemap.ts includes both with priority 0.9.
If both pages render the same or similar benchmark content, this is a direct
duplicate-content and canonical issue.

**Fix:**
1. Audit /benchmark vs /benchmarks content
2. If identical: 301 redirect /benchmarks → /benchmark, set canonical on /benchmark
3. If different: ensure titles/content are clearly distinct and no overlap
4. Remove /benchmarks from sitemap if redirected

---

### Risk 2 — Homepage vs /llm-security for "AI security platform"

| Property | Value |
|----------|-------|
| URLs | / and /llm-security |
| Competing keyword | "AI security platform", "LLM security platform" |
| Risk level | MEDIUM |

**Analysis:**
- Homepage title: "AI Security Platform for Prompt Injection, RAG Security and Agent Firewall"
- /llm-security title: "LLM Security Platform — Protect Large Language Model Applications"
- These are close but distinct enough: Homepage = broad brand, /llm-security = specific LLM security

**Resolution:** Keep both. Homepage targets broad "AI security platform", /llm-security
targets "LLM security platform". Ensure homepage canonical is "/" and /llm-security
canonical is "/llm-security". Both should be in sitemap. Internal links should
use distinct anchor text.

---

### Risk 3 — /vscode-ai-security vs /cursor-ai-security vs /windsurf-ai-security

| Property | Value |
|----------|-------|
| URLs | /vscode-ai-security (exists), /cursor-ai-security (missing), /windsurf-ai-security (missing) |
| Competing keyword | "VS Code AI security", "Cursor security extension", "Windsurf security extension" |
| Risk level | LOW-MEDIUM (low risk now since Cursor/Windsurf pages don't exist) |

**Analysis:**
/vscode-ai-security currently mentions Cursor and Windsurf in its content.
When /cursor-ai-security and /windsurf-ai-security are created, there will be
partial content overlap.

**Resolution:**
- /vscode-ai-security = primary page, targets "VS Code AI security extension"
- /cursor-ai-security = targets "Cursor security extension", "Cursor AI security"
- /windsurf-ai-security = targets "Windsurf security extension", "Windsurf AI security"
- Each must have: unique H1, unique intro, IDE-specific screenshots/examples,
  unique keyword metadata, and cross-link to the other IDE pages

---

### Risk 4 — /mcp-security vs /ai-agent-security for "MCP security"

| Property | Value |
|----------|-------|
| URLs | /mcp-security and /ai-agent-security |
| Competing keyword | "MCP security", "secure MCP servers", "model context protocol security" |
| Risk level | LOW |

**Analysis:**
/mcp-security targets config scanning and tool permissions.
/ai-agent-security targets agent runtime enforcement, which includes MCP security as a feature.
These are distinct angles and not currently cannibalising.

**Resolution:** Keep distinct. Add clear differentiation copy:
- /mcp-security: "Before you enable a tool" (static config review)
- /ai-agent-security: "At runtime as agents execute" (dynamic enforcement)

---

### Risk 5 — /enterprise vs /enterprise-ai-security

| Property | Value |
|----------|-------|
| URLs | /enterprise and /enterprise-ai-security |
| Competing keyword | "enterprise AI security" |
| Risk level | MEDIUM |

**Analysis:**
/enterprise appears to be a general enterprise page (pilot/trial focus).
/enterprise-ai-security is the feature landing page targeting "enterprise AI security" keyword.
If /enterprise also has significant security content, these may compete.

**Fix:**
- Ensure /enterprise focuses on: pilot program, pricing, procurement
- Ensure /enterprise-ai-security focuses on: technical security features for enterprise
- One canonical per topic — /enterprise-ai-security is the SEO target
- /enterprise should link to /enterprise-ai-security prominently

---

### Risk 6 — /ai-workflow-security vs /integrations/* pages

| Property | Value |
|----------|-------|
| URLs | /ai-workflow-security and (planned) /integrations/n8n, /zapier, /make |
| Competing keyword | "n8n AI security", "AI workflow security" |
| Risk level | LOW (once created) |

**Resolution:**
- /ai-workflow-security = concept/pillar page ("Why AI workflow security matters")
- /integrations/n8n = setup guide ("How to add SoterAI to n8n")
- Different intent: concept vs how-to
- Cross-link both ways

---

## No Cannibalisation Confirmed (clear distinct intent)

| Pages | Keyword area | Why distinct |
|-------|-------------|--------------|
| /prompt-injection-protection vs /jailbreak-detection | Both under Cluster B | Different attack type: injection vs jailbreak |
| /rag-security vs /ai-data-leakage-prevention | Both under data security | RAG-specific vs general data leakage |
| /ai-security-india vs /compliance/owasp-llm-top-10 | Compliance cluster | India-specific vs international standard |
| /comparison/lakera vs /comparison | Brand nav vs category | Named brand comparison vs hub |
| /blog/* vs feature pages | Different content type | Educational vs commercial intent |

---

## Action Items

| Priority | Action |
|----------|--------|
| P0 | Audit /benchmark vs /benchmarks — confirm if duplicate, set canonical |
| P1 | Ensure /enterprise and /enterprise-ai-security have distinct content and metadata |
| P1 | When creating /cursor-ai-security, ensure clearly distinct from /vscode-ai-security |
| P2 | Monitor GSC for pages competing on same queries once traffic grows |
