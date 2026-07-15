# Phase 8 Security Scope Inventory

## Web App

Public pages, auth pages, dashboard, admin pages, reports, logs, billing UI, enterprise settings. Files: `app/**`, `components/**`. Risks: auth bypass, XSS, CSRF, data leakage. Tests: e2e/auth/readiness/security suites. Pentest scope: yes.

## REST API

Guard, projects, API keys, logs, reports, policies, webhooks, billing, enterprise, SAML, SCIM, RAG, MCP, agent control. Files: `app/api/**`, `lib/**`. Risks: authz, tenant isolation, validation, replay, error leakage. Tests: `tests/api-route-audit.test.ts`, `tests/security*.test.ts`, `scripts/phase-8-api-self-pentest.js`. Pentest scope: yes.

## Auth And Session

Files: `auth.ts`, `auth.config.ts`, `middleware.ts`, `lib/auth/**`, `app/api/auth/**`. Risks: callback redirects, token reuse, password reset, role changes. Tests: `tests/auth*.test.ts`, `tests/email-otp.test.ts`. Pentest scope: yes.

## Multi-Tenant System

Files: `lib/auth/guards.ts`, `lib/auth/rbac.ts`, `prisma/schema.prisma`, org/project API routes. Risks: IDOR, cross-org exports, role spoofing, pagination leakage. Tests: tenant/phase7 docs and route audit. Pentest scope: yes.

## Payments

Files: `app/api/billing/**`, `lib/billing/razorpay.ts`. Risks: client amount/plan changes, webhook replay, invalid signatures, duplicate events, cross-org activation. Tests: `tests/billing.test.ts`. Pentest scope: yes.

## Enterprise

Files: `app/api/enterprise/**`, `app/api/sso/saml/**`, `app/api/scim/**`, `lib/enterprise/**`. Risks: SAML assertion validation, SCIM token scope, role/group spoofing, audit logs. Pentest scope: yes.

## AI Security Engine

Files: `lib/guard/**`, `lib/classifiers/**`, `lib/agent-*`, `lib/rag/**`. Risks: prompt injection, jailbreak, secret/PII leakage, RAG poisoning, MCP/tool abuse. Tests: guard/security/redteam suites and `scripts/phase-8-ai-security-redteam.js`. Pentest scope: yes.

## Browser Extension

Files: `apps/extension/**`. Risks: overbroad permissions, content-script injection, storage, message spoofing, raw prompt retention, DOM XSS. Tests: `tests/extension/**`, `npm run validate:extension-permissions`. Pentest scope: yes.

## VS Code Extension

Files: `packages/vscode-extension/**`, `apps/local-ai-broker/**`, `packages/ide-*`. Risks: SecretStorage misuse, workspace escape, webview CSP, command injection, local broker auth. Tests: `packages/vscode-extension/src/__tests__`, `tests/security-hardening.test.ts`. Pentest scope: yes.

## n8n And SDKs

Files: `packages/integrations/n8n/**`, `packages/sdk/**`, `packages/python-sdk/**`. Risks: credential masking, timeout/retry behavior, secret-bearing errors, package contents. Tests: integration and SDK tests. Pentest scope: yes.

## Infrastructure

Files: `Dockerfile`, `docker-compose*.yml`, `helm/**`, `infra/**`, `next.config.mjs`, env validation. Risks: headers, CORS, exposed services, non-root runtime, secret injection, logging. Pentest scope: yes.
