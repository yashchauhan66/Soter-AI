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

**Tokens** live in `:root` in `app/globals.css` as CSS custom properties:
a five-step surface ladder (`--surface-0`…`--surface-4`), brand and semantic
colours, two hairline weights, radii, motion durations/easings, and a four-step
elevation scale. Component classes reference tokens rather than literal hex
values, so retuning the palette is a single-file change.

**Tailwind theme** (`tailwind.config.ts`) exposes the same vocabulary as
utilities: `bg-ink` / `bg-panel`, full `cyan` and `lime` ramps, fluid
`text-display-xs…xl` sizes built on `clamp()`, `shadow-elevation-1…4`,
`duration-fast|base|slow`, `ease-out-expo|out-back|in-out-smooth`,
`rounded-card|panel`, `max-w-prose|measure`, and named `z-banner…toast`.

> `cyan` and `lime` **must** stay full colour objects with a `DEFAULT` key.
> `theme.extend.colors` merges shallowly, so assigning a bare hex string
> replaces Tailwind's built-in ramp and silently deletes every
> `text-cyan-300` / `bg-cyan-500/10` class in the codebase.

**Component classes** in `app/globals.css`:

| Group | Classes |
| --- | --- |
| Layout | `.container-page`, `.container-docs`, `.container-wide`, `.section`, `.section-tight` |
| Surfaces | `.card`, `.card-interactive`, `.surface`, `.surface-raised`, `.glass-panel`, `.gradient-border` |
| Buttons | `.button-primary`, `.button-secondary`, `.button-ghost`, `.button-danger`, `.button-icon`, `.button-sm`, `.button-lg` |
| Forms | `.input`, `.label`, `.field-hint`, `.field-error` |
| Type | `.eyebrow`, `.heading-hero`, `.heading-1…3`, `.lede`, `.body-copy`, `.text-gradient-brand` |
| Status | `.badge-neutral|brand|success|warning|danger|info`, `.status-dot` |
| Callouts | `.tip-card`, `.warn-card`, `.danger-card` |
| Docs | `.docs-section`, `.docs-h2`, `.docs-h3`, `.docs-anchor`, `.docs-toc-link`, `.docs-toc-progress`, `.docs-toc-top`, `.docs-toc-inline` |

All buttons share `.button-base`, so every variant is at least 44px tall
(WCAG 2.5.5) and hover/active states are gated behind `:not(:disabled)`.
Field errors are driven by `aria-invalid="true"` rather than a separate class, so
the visual and assistive-technology states cannot diverge.

`prefers-reduced-motion`, `forced-colors`, and `print` blocks at the end of
`globals.css` neutralise animation, restore real borders under High Contrast, and
expand collapsed `<details>` for printing.

**Navigation** is data, not markup: `lib/navigation.ts` holds `PRIMARY_NAV`
(desktop mega menu + mobile drawer), `FOOTER_NAV`, `LEGAL_NAV`,
`MOBILE_SHORTCUTS`, and `buildCrumbs()` for the breadcrumb trail and its
`BreadcrumbList` JSON-LD. Add a page in one place, not four.

Reusable dashboard primitives live in `components/dashboard/`:

| Component | Role |
| --- | --- |
| `PageHeader` | The only page header. Eyebrow, H1, description, `actions` slot, optional `status` badges and `docsHref`. |
| `SectionHeader` | Labelled boundary between panels inside a page. |
| `EmptyState` | Explains what will appear and offers the action that makes it appear. |
| `MetricCard` | Label/value tile. Optional `hint`, plus `delta` + `deltaIsGood` — direction alone is ambiguous when more blocked attacks is good news and more failed deliveries is not. |
| `StatCard` | Icon-anchored metric tile for four-or-fewer headline figures. |
| `StatusBadge` / `RiskLevel` | Resolve through `lib/dashboard/status.ts`. |
| `TableWrapper` | Keyboard-focusable scroll region (`role="region"`, `tabIndex={0}`) with a clipped-content fade. |

`lib/dashboard/status.ts` is the status vocabulary: every enum maps to a
human label plus one of five semantic **intents** (`success`, `info`, `warning`,
`danger`, `neutral`) which resolve to the shared `.badge-*` classes. Before this,
badges rendered raw enums (`ALLOW_WITH_REDACTION`, `PROMPT_INJECTION_DETECTED`)
and hard-coded colour triplets at 60+ call sites. Unmapped values degrade to title
case rather than leaking the enum.

`FeatureGuide` (52 pages) delegates its header to `PageHeader` and collapses its
explainer into a `<details>`, so operational panels sit above the fold instead of
below ~400px of explanation on every visit.

`tests/dashboard-ui-consistency.test.ts` enforces: one `<h1>` per page, no
hand-rolled eyebrow+h1 pairs, no raw enums surfaced to users, badge classes drawn
only from the semantic set, sticky sidebar, and a modal mobile drawer.

### Documentation (`/docs`)

The docs are a **structured site**, not a folder of pages. Three data modules own
everything shared, so 18 guides cannot drift apart again:

| File | Owns |
| --- | --- |
| `lib/docs/navigation.ts` | `DOCS_SECTIONS` (5 sections), per-page label, summary, hands-on `minutes`, search `keywords`, plus `getDocsNeighbours()` for the pager |
| `lib/docs/scope.ts` | `DOCS_SCOPE` — the "what this guide does not cover" note for every route |
| `lib/docs/services.ts` | `SERVICES` / `SERVICE_GROUPS` — the security-control catalogue behind `/docs/services` |

Components:

- `DocsPageShell` — wraps every guide. Renders the header (section, H1, summary,
  time estimate), `BreadcrumbList` JSON-LD derived from the nav tree, the scope
  note, and the previous/next pager. Accepts optional `jsonLd` for genuinely
  page-specific structured data (the quickstart's `HowTo`, for example).
  **Throws** if the route is missing from `DOCS_SECTIONS`, so an orphan page
  fails the build rather than shipping invisible.
- `DocsSidebar` — the full tree, always expanded, rendered in a `lg:sticky`
  column by `app/docs/layout.tsx`.
- `DocsSearch` — ⌘K / Ctrl+K / `/`. Client-side ranked index over labels,
  summaries, and keyword aliases; no external service, so it works offline and
  leaks no queries.
- `DocsMobileNav` — drawer below `lg`, reusing `DocsSidebar`.

To add a guide: create the page, add an entry to `DOCS_SECTIONS`, add a scope
note to `DOCS_SCOPE`, and wrap the body in `DocsPageShell`. `tests/docs-structure.test.ts`
enforces all four and rejects absolute security claims in scope notes.

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
| `npm run clean` | Delete `.next` and `tsconfig.tsbuildinfo`. First thing to try on an inexplicable dev-mode failure. |
| `npm run verify` | Typecheck + tests + Prisma validate + build (pre-push gate). |
| `npm run build:extension` / `npm run package` | Build / package the browser extension. |
| `npm run db:migrate` / `db:seed` | Prisma migrations / seed data. |

> **Stop the dev server before running `npm run build`.**
>
> `next dev --turbopack` and `next build` both write to `.next/`, and they write
> *different* things — dev produces `build-manifest.json` and a Turbopack module
> graph under `server/`, the production build produces `BUILD_ID`,
> `prerender-manifest.json`, `standalone/`, and its own manifests. Run them
> concurrently and `.next/` ends up holding half of each.
>
> The dev server keeps working, which is what makes this expensive to diagnose: it
> serves an RSC payload whose module graph no longer matches what it re-renders on
> the client, and React reports the divergence as a **hydration mismatch at an
> arbitrary component boundary** — typically somewhere in the root layout, on a
> page unrelated to whatever you last edited. The reported stack points at
> untouched files, so the obvious next move is to go debug code that is fine.
>
> `npm run clean`, then restart `npm run dev`. Nothing is lost; `.next` is
> entirely regenerable.

## Conventions

1. **Tenant safety first** — every private route resolves org/project through `lib/auth/guards.ts`.
2. **Services live in `lib/<domain>/`** — keep route handlers thin; put logic in the service module.
3. **Reuse the design system** — `.card` / `.eyebrow` / `MetricCard` over ad-hoc styling.
4. **English-only** user-facing copy in shipped packages (required for marketplace listings).
