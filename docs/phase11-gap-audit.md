# Phase 11 Gap Audit

CyberRakshak Guard already has a broad Phase 1-10 product surface: guard APIs, detectors, dashboard, auth, tenant isolation, billing, RAG security, webhooks, SIEM, SAML/SCIM, self-hosted deployment, support, trust/compliance pages, and go-to-market assets. This audit identifies the remaining competitive gaps before Phase 11 implementation. Positioning must remain honest: OWASP LLM Top 10 aligned, defense-in-depth, risk reduction, and detect/block/redact/monitor/report.

## Already Implemented Features

- Input, output, and public analyze guard APIs with prompt injection, jailbreak, system prompt leak, PII, India PII, secrets, and unsafe output detectors.
- Policy engine with monitor, balanced, and strict modes plus custom topics, deny patterns, and fallback messages.
- API keys, one-time key display, peppered hashing, per-key rate limiting, monthly usage metering, and usage counters.
- NextAuth credentials auth, signup, email verification, password reset, organizations, RBAC, and tenant guards.
- Guard logs, safe log persistence, reports, PDF generation, white-label reports, signed audit exports, and public security badges.
- Durable webhook queue, HMAC signatures, encrypted webhook secrets, retry/backoff, dead-lettering, replay, and worker processing.
- RAG document scanning, PDF/OCR sandbox checks, quarantine, redacted chunks, vector namespace isolation, ACL filtering, grounding guard, and retrieval/answer audit logs.
- Rule-based, semantic-scaffold, Hindi/Hinglish classifier evaluation, classifier datasets/runs, ML review queue, and red-team scenarios.
- Billing lifecycle with Razorpay checkout/webhooks, subscriptions, invoices, cancellation/reactivation, and mock billing blocked in production.
- Enterprise SAML, SCIM v2, data retention/deletion, security events, SIEM exports, integrations, admin controls, support, incidents, onboarding, and production metrics.
- Docker, docker-compose, Helm, backup/restore scripts, self-hosted docs, compliance center, sales/growth docs, and SDK package.

## Scaffold-Only Features

- Semantic and ML classifier backends are mostly heuristic/scaffolded rather than trained model infrastructure.
- Marketplace integrations exist as internal models/routes but do not yet include polished customer-specific connector packages.
- Public benchmarks page exists, but it does not yet publish versioned internal benchmark results.
- Phase 10 growth assets exist, but no verified traction is recorded as product evidence.
- Some production operations pages summarize state but are not yet full incident/alerting consoles.

## Broken or Incomplete Features

- Production build has not been completed in the latest stabilization pass.
- Phase 11 models for supply chain, agent firewall, threat intel, privacy, benchmarks, and abuse prevention do not exist yet.
- `BackgroundJob` schema drift was recently fixed with a migration, but broader schema drift checks should remain part of release gates.
- E2E browser testing is not yet automated with Playwright or equivalent.
- Some dashboard pages are server-rendered and can expose raw backend errors if new auth/data paths are not guarded.

## Missing Lakera-Style Features

- AI supply chain security and AI Bill of Materials.
- Model/provider registry and prompt version registry.
- Tool/plugin inventory, per-tool permissions, and tool-call firewall.
- Human approval workflow for risky agent actions.
- MCP gateway/firewall scaffold.
- Threat intelligence rule update workflow with approval, shadow mode, and rollback.
- Accuracy proof dashboard with benchmark snapshots and public limitations.
- Production abuse/cost-spike controls beyond standard rate limits and quota.

## Missing OWASP Coverage Features

- LLM03 supply chain inventory and AI BOM evidence.
- LLM06 excessive agency controls for tool-specific approval and rollback logs.
- LLM07 system prompt governance via prompt versioning and approval.
- LLM09 misinformation/grounding evidence dashboard beyond existing grounding guard.
- LLM10 unbounded consumption cost-budget and abuse anomaly workflows.

## Missing Indian Market Differentiation

- DPDP readiness workflow with data subject requests, consent records, breach notification drafts, and data processing records.
- WordPress/WooCommerce chatbot plugin scaffold for Indian SME use cases.
- WhatsApp chatbot agency security guide.
- Expanded Indian language detection beyond Hindi/Hinglish, especially Bengali, Tamil, Telugu, and Marathi.
- Agency-friendly middleware packages for LangChain, LlamaIndex, and Vercel AI SDK.

## Security Risks

- New public endpoints must use distributed public rate limiting.
- New admin and dashboard routes must use server-side guards; UI hiding is not sufficient.
- Prompt versions and AI BOMs must not expose raw system prompts or secrets.
- Tool firewall must default deny unknown tools and must not introduce arbitrary shell/code execution.
- Threat intelligence updates must not auto-activate untrusted remote rules.
- RAG benchmark evidence must store redacted examples only.

## Test Gaps

- No Phase 11 regression suite yet.
- No automated end-to-end browser suite yet.
- No tests for supply chain tenant isolation, AI BOM redaction, tool-call approval, threat rule rollback, DPDP workflows, WordPress scaffold, or abuse review.
- Public benchmark page needs tests to ensure sensitive examples are not published.

## Priority Order

1. Supply chain registry and AI Bill of Materials.
2. Agent/tool-call firewall with approval queue.
3. Advanced RAG security and benchmark evidence.
4. Threat intelligence rule pipeline.
5. Benchmark and accuracy dashboard.
6. Multilingual detector expansion.
7. DPDP/privacy workflow.
8. WordPress, agency, and middleware integrations.
9. Production abuse and cost controls.
10. Security audit pack, competitive readiness report, and final regression.

