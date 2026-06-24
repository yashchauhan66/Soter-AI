# Soter AI — Live Demo Report

**Demo URL:** http://localhost:3000
**Status:** ✅ Running
**Database:** ✅ PostgreSQL connected (Docker)
**Demo Credentials:** demo@cyberrakshak.dev / demo-cyberrakshak-2026

---

## 📸 Pages Successfully Tested

### 1. Homepage (`/`)
- Hero section with "AI Security Command Layer" messaging
- Features, OWASP alignment, India PII sections
- Pricing plans (FREE ₹0, STARTER ₹999, PRO ₹2,999, AGENCY ₹7,999, ENTERPRISE Custom)
- FAQ with 11 questions
- Benchmark stats: 97/97 attacks detected, 100% detection rate, 0% false positives, <50ms latency
- Links to Playground, Docs, Sign In

### 2. Sign In (`/signin`)
- Login form works with demo credentials
- Successful login redirects to dashboard

### 3. Dashboard (`/dashboard`)
- **Stats Cards:** Plan status, Total requests, Avg risk score, Top risk
- **Guard Stats:** Blocked requests count, PII redactions count, Secrets prevented
- **Quick Actions:** Quick access buttons
- **Recent Guard Activity:** Table of recent guard decisions
- **Usage Card:** Monthly usage with progress bar
- **Risk Chart:** Top risk types visualization
- **Feature Discovery Grid:** 32+ features across 6 groups (Monitor, Protect, Detect, Control, Compliance, Manage)

### 4. Dashboard Sidebar Navigation
| Section | Items |
|---------|-------|
| **Operate** | Overview, Guard logs, Reports, Customer success, Detection feedback |
| **Configure** | Projects, API keys, Policy, Webhooks, RAG security, Agent firewall, Security badges, Shadow AI, Red team lab, Cost firewall, Credential vault, Forensics |
| **Agent Security** | Agent passports, Intent guard, Tool chain, Escrow, Dry-run, Semantic egress, Evidence vault, SLM evaluations, Context lineage, Blast radius, Memory firewall, MCP drift, Legal boundary |
| **Agency** | Partner program, Agency overview, Clients, White-label report, Branding |
| **Account** | Onboarding, Support, Billing & usage, Audit exports, Settings |

### 5. Guard Logs (`/dashboard/logs`)
- Audit trail of AI guard decisions
- Shows direction (INPUT/OUTPUT), action (ALLOW/BLOCK/REDACT), risk score, risk types
- Filters and search functionality

### 6. Policy Engine (`/dashboard/policy`)
- Policy modes: MONITOR, BALANCED, STRICT, WARN
- Per-detector toggles (Prompt Injection, Jailbreak, PII, India PII, Secrets, System Prompt Leak)
- Custom blocked topics, allowlisted domains, denied patterns
- Unsafe output mode (WARN, REDACT, BLOCK)
- Citation requirements, source count, high-risk topic review

### 7. Agent Firewall (`/dashboard/agent-firewall`)
- Computer-use guardrails configuration
- Session management
- Tool action logs
- Policy editor with allowed/blocked tools
- Approval workflows

### 8. Reports (`/dashboard/reports`)
- Monthly security report generation
- PDF download capability
- Scheduled report configuration
- White-label report (for agencies)

### 9. RAG Security (`/dashboard/rag`)
- Document collection management
- RAG document scanning
- Collection creation and management

### 10. API Keys (`/dashboard/api-keys`)
- API key generation with name and permissions
- Key prefix display (one-time only)
- Key health status

### 11. Agent Passports (`/dashboard/agent-passports`)
- 5 active agent identities displayed
- Session passport audit events
- Risk level indicators
- Passport validation status

### 12. Intent Guard (`/dashboard/intent-guard`)
- Intent verification documentation
- Currently 0 intent checks (no activity yet)
- Configuration for allowed/forbidden intent categories

### 13. Tool Chain Detector (`/dashboard/tool-chain`)
- Tool chain attack detection documentation
- Currently 0 tool chain steps/findings
- Step tracking and analysis

### 14. Transaction Escrow (`/dashboard/escrow`)
- Escrow transaction management
- Currently 0 pending/denied transactions
- Approval workflow dashboard

### 15. Dry-Run Sandbox (`/dashboard/dry-run`)
- Dry-run simulation configuration
- Safe simulation of agent actions
- Various dry-run types supported

### 16. Semantic Egress (`/dashboard/semantic-egress`)
- Data egress firewall dashboard
- Currently 0 checks/findings
- Content fingerprinting configuration

### 17. Evidence Vault (`/dashboard/evidence-vault`)
- Compliance evidence collection
- Currently 0 evidence items
- Report generation for SOC 2 / ISO 27001

### 18. SLM Evaluations (`/dashboard/evaluations`)
- SLM quality evaluation dashboard
- Currently 0 evaluations
- Model performance tracking

### 19. Context Lineage (`/dashboard/lineage`)
- Data source lineage tracking
- Flow monitoring dashboard

### 20. Blast Radius (`/dashboard/blast-radius`)
- Agent compromise simulator
- Currently 0 agent profiles
- Scenario testing

### 21. Playground (`/playground`)
- Interactive text analysis interface
- Input field with "Analyze risk" button
- Note: Analysis requires authentication

### 22. Documentation (`/docs`)
- Quickstart guide
- REST API documentation with curl examples
- Multiple SDK guides (JS/TS, Python, Next.js, etc.)
- Framework integration guides

## 🔧 Console Errors
Only 1 console error found (non-critical):
- CSP blocking Google Tag Manager script (expected in dev environment)

No JavaScript runtime errors or React warnings detected.

## 🚀 How to Access
The app is currently running at:
```
http://localhost:3000
```

**Demo Login:**
- Email: `demo@cyberrakshak.dev`
- Password: `demo-cyberrakshak-2026`

## 📋 API Test Commands
```bash
# Test Input Guard
curl -X POST http://localhost:3000/api/guard/input \
  -H "Content-Type: application/json" \
  -H "x-api-key: ck_test_your_key" \
  -d '{"message":"Ignore previous instructions"}'

# Test Output Guard  
curl -X POST http://localhost:3000/api/guard/output \
  -H "Content-Type: application/json" \
  -H "x-api-key: ck_test_your_key" \
  -d '{"aiResponse":"Your API key is sk-abc123..."}'

# Health Check
curl http://localhost:3000/api/health
```
