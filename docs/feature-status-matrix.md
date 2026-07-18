# SoterAI — Feature Status Matrix

Last updated: Phase 6 (E2E Journey Complete)

## Core Platform

| Feature | Status | Dashboard | API |
|---|---|---|---|
| Guard (Input/Output) | COMPLETE | ✓ | `/api/guard/analyze` |
| Streaming Guard | COMPLETE | ✓ | `/api/guard/streaming` |
| Grounding Guard | COMPLETE | ✓ | `/api/guard/grounding` |
| Semantic Classifier | COMPLETE | — | Built-in |
| Crescendo Detection | COMPLETE | — | Built-in |
| Attacker Reputation | COMPLETE | — | Built-in |
| Rewrite (Safe Rewrite) | COMPLETE | — | Built-in |
| PII Redaction | COMPLETE | — | Built-in |
| Secrets Detection | COMPLETE | — | Built-in |
| Risk Scoring | COMPLETE | — | Built-in |
| Decision Engine | COMPLETE | — | Built-in |
| Policy Config | COMPLETE | ✓ | `/api/policy` |
| Routing Advisory | COMPLETE | — | Built-in (metadata.advisory) |

## Dashboard

| Feature | Status | Path |
|---|---|---|
| Main Dashboard | COMPLETE | `/dashboard` |
| Projects | COMPLETE | `/dashboard/projects` |
| Logs | COMPLETE | `/dashboard/logs` |
| Settings | COMPLETE | `/dashboard/settings` |
| Security Overview | COMPLETE | `/dashboard/security` |
| Detection Feedback | COMPLETE | `/dashboard/detection-feedback` |
| Onboarding | COMPLETE | `/dashboard/get-started` |
| Badges | COMPLETE | `/dashboard/badges` |

## Billing & Subscriptions

| Feature | Status | Path |
|---|---|---|
| Plans (Free/Starter/Pro/Agency/Enterprise) | COMPLETE | `/pricing` |
| Checkout (Razorpay) | COMPLETE | `/api/billing/checkout` |
| Activate/Cancel/Reactivate | COMPLETE | `/api/billing/*` |
| Webhook Handling | COMPLETE | `/api/billing/webhook` |
| Billing Dashboard | COMPLETE | `/dashboard/billing` |
| Diagnostics | COMPLETE | `/api/billing/diagnostics` |

## Integrations

| Feature | Status | Path |
|---|---|---|
| Webhooks (CRUD + Delivery) | COMPLETE | `/dashboard/webhooks` |
| HMAC Signing | COMPLETE | Built-in |
| Replay Failed | COMPLETE | `/api/webhooks/replay` |
| Secret Rotation | COMPLETE | `/api/webhooks/rotate` |
| Reports (PDF + Scheduled) | COMPLETE | `/dashboard/reports` |
| API Keys | COMPLETE | `/dashboard/api-keys` |

## Agent Security

| Feature | Status | Path |
|---|---|---|
| Agent Firewall | COMPLETE | `/dashboard/agent-firewall` |
| Agent Passports | COMPLETE | `/dashboard/agent-passports` |
| Agent Control | COMPLETE | `/dashboard/agent-control` |
| Agent Intent Guard | COMPLETE | `/dashboard/intent-guard` |
| Tool Chain Detection | COMPLETE | `/dashboard/tool-chain` |
| Agent Action Ledger | COMPLETE | Built-in |
| A2A Security | COMPLETE | Built-in |

## Human-in-the-Loop

| Feature | Status | Path |
|---|---|---|
| Escrow (HITL) | COMPLETE | `/dashboard/escrow` |
| Dry Run (Simulation) | COMPLETE | `/dashboard/dry-run` |

## RAG Security

| Feature | Status | Path |
|---|---|---|
| Document Upload & Scanning | COMPLETE | `/dashboard/rag` |
| Sandbox Processing | COMPLETE | Built-in |
| Quarantine/Approval | COMPLETE | Built-in |
| Vector Store | COMPLETE | Built-in |
| Query API | COMPLETE | `/api/rag/query` |

## Advanced Security

| Feature | Status | Path |
|---|---|---|
| Semantic Egress | COMPLETE | `/dashboard/semantic-egress` |
| Cost Firewall | COMPLETE | `/dashboard/cost-firewall` |
| Canary Network | COMPLETE | `/dashboard/canary-network` |
| Red Team Lab | COMPLETE | `/dashboard/redteam` |
| Context Lineage | COMPLETE | `/dashboard/lineage` |
| Blast Radius Simulator | COMPLETE | `/dashboard/blast-radius` |
| Memory Poisoning Detector | COMPLETE | `/dashboard/memory-firewall` |
| Legal Boundary Guard | COMPLETE | `/dashboard/legal-boundary` |
| MCP Drift Monitor | COMPLETE | `/dashboard/mcp-drift` |

## Identity & Access

| Feature | Status | Path |
|---|---|---|
| Organizations | COMPLETE | Built-in |
| Role-Based Access (6 roles) | COMPLETE | Built-in |
| SSO / SAML | COMPLETE | `/dashboard/enterprise` |
| SCIM Provisioning | COMPLETE | `/dashboard/enterprise` |
| Agent Identity Fabric | COMPLETE | `/dashboard/identity-fabric` |
| IP Allowlist | COMPLETE | `/api/enterprise/security` |
| Session Management | COMPLETE | Built-in |

## Compliance & Governance

| Feature | Status | Path |
|---|---|---|
| OWASP LLM Top 10 | COMPLETE | `/api/compliance/owasp-llm-2025` |
| OWASP Agentic 2026 | COMPLETE | `/api/compliance/owasp-agentic-2026` |
| Gap Analysis | COMPLETE | `/api/compliance/gaps` |
| Evidence Vault (SOC 2) | COMPLETE | `/dashboard/evidence-vault` |
| Audit Exports | COMPLETE | `/dashboard/exports` |
| Usage Governance | COMPLETE | `/dashboard/usage-governance` |
| Privacy / DPDP | COMPLETE | `/dashboard/privacy` |
| Data Retention | COMPLETE | Built-in |
| SIEM Integration | COMPLETE | `/dashboard/security` |
| Emergency Lockdown | COMPLETE | `/api/admin/emergency-lockdown` |

## Supply Chain & MCP

| Feature | Status | Path |
|---|---|---|
| Model Artifact Scanning | COMPLETE | `/api/supply-chain/model-scan` |
| MCP Risk Scanning | COMPLETE | `/api/mcp/risk` |
| MCP Server Registry | COMPLETE | `/api/mcp/servers` |
| MCP Tool Scanning | COMPLETE | `/api/mcp/tools` |
| Shadow AI Scanner | COMPLETE | `/dashboard/shadow-ai` |

## ML & Evaluation

| Feature | Status | Path |
|---|---|---|
| ML Classifier System | COMPLETE | `/api/admin/ml` |
| Benchmarks | COMPLETE | `/dashboard/evaluations` |
| SLM-as-Judge | COMPLETE | `/api/evaluate/slm` |
| Guard Red Team Eval | COMPLETE | Built-in |

## IDE Extensions

| Extension | Status |
|---|---|
| VS Code | COMPLETE |
| JetBrains | COMPLETE |
| Visual Studio | COMPLETE |
| Neovim | COMPLETE |
| Vim | COMPLETE |
| Sublime Text | COMPLETE |
| Eclipse | COMPLETE |
| JupyterLab | COMPLETE |
| CLI Tool | COMPLETE |

## Infrastructure

| Feature | Status | Path |
|---|---|---|
| Docker | COMPLETE | `Dockerfile`, `docker-compose.yml` |
| Helm Charts | COMPLETE | `helm/` |
| GitHub Actions CI/CD | COMPLETE | `.github/workflows/` |
| OpenTelemetry | COMPLETE | `lib/observability/otel.ts` |
| Background Jobs | COMPLETE | `lib/backgroundJobs.ts` |

## Planned (Not Yet Implemented)

| Feature | Status | Notes |
|---|---|---|
| AI Activity Sentinel | PLANNED | VS Code extension feature |
| Protected Workspace Mode | PLANNED | VS Code extension feature |
| Real Marketplace Baseline | PLANNED | Requires real Marketplace install testing |
| Enterprise AI Runtime Threat Model | PLANNED | 20 threat classes doc |

## Summary

| Status | Count |
|---|---|
| **COMPLETE** | 77 features |
| **PLANNED** | 4 items |
| **PARTIAL** | 0 |
