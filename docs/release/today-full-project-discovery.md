# Today Full Project Discovery

Date: 2026-07-02

## Project Structure
- Root app: Next.js/Prisma project at repository root, package `soterai` version `0.2.0`.
- Browser extension: `apps/extension`, package `@soter/extension` version `0.1.0`, private.
- n8n community node: `packages/integrations/n8n`, package `n8n-nodes-soterai` version `0.2.0`.
- Zapier integration: `packages/integrations/zapier`, package `soterai-zapier` version `0.1.0`, app id `243229`.
- Make.com custom app: `packages/integrations/make`, manifest `app.json` version `0.2.0`.
- Prisma schema: `prisma/schema.prisma`.
- Docker config: `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`.
- Store docs: `docs/extension-store`.

## Detected Publish Targets
- Chrome Web Store / Microsoft Edge Add-ons extension ZIP: `apps/extension/dist/soter-extension-v0.1.0.zip`.
- npm package for n8n: `packages/integrations/n8n/n8n-nodes-soterai-0.2.0.tgz`.
- Zapier CLI app version: `0.1.0`.
- Make.com custom app JSON bundle in `packages/integrations/make`.

## Existing Docs And Assets
- Extension listing docs: Chrome public/private, Edge public/hidden, permission justification, privacy policy, reviewer notes, support process.
- Screenshots: more than five real screenshot PNGs plus `promo-large-920x680.png`.
- n8n README, LICENSE, CHANGELOG, example workflow.
- Zapier README and publishing checklist.
- Make README, setup guide, publishing checklist, scenario blueprint.

## Missing Or Conditional Items
- No installed `gitleaks` or `git-secrets`.
- n8n package has no `npm test` script.
- Make app has no local Make CLI/package script; validation was JSON-structure only.
- Platform dashboard sessions for Chrome, Edge, npm, n8n Creator Portal, and Make.com were not available.

## Blockers
- Root `npm install` failed with `EUNSUPPORTEDPROTOCOL` for `workspace:*`.
- npm account is not authenticated (`npm whoami` returned 401).
- Chrome/Edge/Make/n8n review portals require account login/review access.
