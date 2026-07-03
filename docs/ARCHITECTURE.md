# SoterAI — Architecture & Repository Structure

SoterAI is an enterprise AI-security platform. It combines a Next.js web application,
a browser extension, first-party SDKs/integrations, and a large library of security
services behind a single Prisma/PostgreSQL data model.

> This document is the map of the repository. Read it first when onboarding.

## High-level components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Web app** | `app/`, `components/`, `lib/` | Marketing site, authenticated **dashboard**, and **admin** panel (Next.js 15 App Router). |
| **Browser extension** | `apps/extension/` | Client-side extension that stops secrets/PII/code leaking into ChatGPT, Claude, Gemini, and 20+ AI tools. |
| **Extension backend** | `lib/extension/`, `app/api/extension/` | Enrollment, policy, heartbeat, scan, and approval APIs the extension calls. |
| **SDKs & integrations** | `packages/` | JS SDK, Python SDK, n8n node, LangChain / LlamaIndex / Vercel middleware, policy engine, detectors. |
| **Data model** | `prisma/` | Prisma schema, migrations, seed. Single multi-tenant PostgreSQL database. |
| **Workers** | `workers/` | Background processors (webhooks, SIEM, threat-intel). |
| **Infra** | `Dockerfile*`, `docker-compose*.yml`, `helm/`, `infra/` | Container, compose, and Kubernetes/Helm deployment. |

## Web application (`app/`)

App Router tree. Notable route groups:

- `app/(public)` and top-level marketing routes (`pricing`, `enterprise`, `trust`, `status`, …).
- `app/dashboard/**` — the authenticated product. Navigation is defined in
  `components/dashboard/DashboardSidebar.tsx`; the shell/layout lives in
  `components/dashboard/DashboardShell.tsx`.
- `app/admin/**` — platform-admin tooling (gated by `requireAdmin`).
- `app/api/**` — route handlers. Private routes go through the tenant guards in
  `lib/auth/guards.ts`; never query by `userId` alone.

### Auth & multi-tenancy

- `auth.ts` / `auth.config.ts` — NextAuth v5 configuration.
- `lib/auth/guards.ts` — **the tenant boundary**. `requireUser`, `getActiveOrganization`,
  `requireOrganizationAccess`, `requirePermission`, `requireProjectAccess`, `requireAdmin`.
- `lib/auth/permissions.ts` — the single source of truth for role → permission mapping.
- A user belongs to one or more **Organizations** via `OrganizationMember`; almost all
  data is scoped by `organizationId` (not `userId`).

### Design system

Tailwind with shared utility classes in `app/globals.css`: `.card`, `.eyebrow`,
`.button-primary`, `.button-secondary`, `.input`. Reusable dashboard primitives live in
`components/dashboard/` (`MetricCard`, `StatusBadge`, `EmptyRow`, …).

## Security services (`lib/`)

Each subdirectory is a self-contained service module (store + logic), consumed by
`app/api/**` route handlers and dashboard pages. Examples: `lib/guard`, `lib/agent-firewall`,
`lib/ai-data-security`, `lib/rag`, `lib/shadow-ai`, `lib/cost-firewall`, `lib/extension`,
`lib/admin-ai-policies`. Cross-cutting helpers: `lib/auth`, `lib/db.ts`, `lib/apiResponse.ts`.

## Browser extension (`apps/extension/`)

- `src/background/` — service worker: message routing, heartbeat, policy sync, context menu.
- `src/content/` — content scripts that attach to AI sites and intercept paste/submit/upload.
- `src/popup/`, `src/sidepanel/` — user-facing UI (enrollment status, scan results).
- `src/lib/` — enrollment, storage, API client, scanner, redaction, policy verification.
- `manifest.json`, `managed-schema.json` — extension manifest and enterprise (GPO/MDM) schema.
- Build: `npm run build:extension`; package a distributable zip with `npm run package`.

The extension is surfaced to end users in the dashboard at
`app/dashboard/browser-extension/` (install & enroll, device management, policy, activity),
backed by `app/api/dashboard/extension/**`.

## Packages (`packages/`)

`sdk` (JS), `python-sdk`, `integrations` (n8n and others), `langchain-middleware`,
`llamaindex-middleware`, `vercel-ai-sdk-middleware`, `policy-engine`, `detectors`,
`shared`, `soter-pii`. Published packages are built from their own `package.json`.

## Testing

- Unit/integration: `npm test` (see the aggregated list in root `package.json`).
- E2E: `npm run test:e2e` (Playwright).
- Extension: `npm run test:extension`, `npm run typecheck:extension`.

## Common scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run the web app locally. |
| `npm run verify` | Typecheck + tests + Prisma validate + build (pre-push gate). |
| `npm run build:extension` / `npm run package` | Build / package the browser extension. |
| `npm run db:migrate` / `db:seed` | Prisma migrations / seed data. |

## Conventions

1. **Tenant safety first** — every private route resolves org/project through `lib/auth/guards.ts`.
2. **Services live in `lib/<domain>/`** — keep route handlers thin; put logic in the service module.
3. **Reuse the design system** — `.card` / `.eyebrow` / `MetricCard` over ad-hoc styling.
4. **English-only** user-facing copy in shipped packages (required for marketplace listings).
