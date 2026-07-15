# Phase 4 n8n Package Inventory

## Package

- Name: `n8n-nodes-soterai`
- Version after fixes: `0.2.8`
- Description: SoterAI helps protect n8n AI workflows by detecting prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions.
- License: MIT
- Author: SoterAI
- Repository: `git+https://github.com/yashchauhan66/Soter-AI.git`, directory `packages/integrations/n8n`
- Main: `dist/nodes/SoterGuard.node.js`

## n8n Metadata

- Node API version: `1`
- Node file: `dist/nodes/SoterGuard.node.js`
- Credential file: `dist/credentials/SoterApi.credentials.js`
- Credential name: `soterApi`
- Icon: `nodes/soterai.png`, copied to `dist/nodes/soterai.png`
- Peer dependency: `n8n-workflow: *`

## Operations

1. Analyze Text
2. Guard Input
3. Guard Output
4. Redact Secrets or PII
5. Get RAG Risk Summary

## Credentials

- API Key: required, password masked
- Base URL: default `https://soterai.in`
- Project ID: optional default
- Credential test: POST `/api/guard/input` with `x-api-key`

## Examples

- `soterai-basic-analyze.workflow.json`
- `soterai-guard-input-webhook.workflow.json`
- `soterai-guard-output.workflow.json`
- `soterai-secret-pii-redaction.workflow.json`
- `soterai-error-handling.workflow.json`
- Legacy retained: `protected-chatbot-workflow.json`

## Docs

- `README.md`: present and updated.
- `LICENSE`: present.
- `CHANGELOG.md`: present and updated for `0.2.8`.
- `NPM_PUBLISH_CHECKLIST.md`: present.
- `docs/integrations/n8n.md`: present, but older package-name wording remains outside the package README.

## Command Results

- `npm install`: PASS, already up to date.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS.
- `npm pack --dry-run --cache .npm-cache-phase4`: PASS.
- Package dry-run result: `n8n-nodes-soterai-0.2.8.tgz`, 153.5 kB, 16 files.

## Missing Or Incomplete

- Live n8n UI workflow proof: missing, no n8n runtime available.
- Demo video recording: missing.
- npm publish: not performed.
- External npm audit: blocked pending explicit approval because it exports dependency metadata.
