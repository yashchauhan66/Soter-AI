# Phase 4 n8n npm Package Readiness

## Package

- Name: `n8n-nodes-soterai`
- Version: `0.2.8`
- Tarball: `packages/integrations/n8n/n8n-nodes-soterai-0.2.8.tgz`
- Package size: 153.5 kB
- Unpacked size: 188.6 kB
- Total files: 16

## Commands

- `npm pack --dry-run --cache .npm-cache-phase4`: PASS.
- `npm pack --cache .npm-cache-phase4`: PASS.
- `tar -tf n8n-nodes-soterai-0.2.8.tgz`: PASS.
- `tar -tf ... | Select-String ".env|secret|token|coverage|test-output"`: only matched the intentionally named workflow file `soterai-secret-pii-redaction.workflow.json`.

## Included

- `package.json`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `dist/credentials/SoterApi.credentials.js`
- `dist/nodes/SoterGuard.node.js`
- `dist/nodes/soterai.png`
- `nodes/soterai.png`
- six example workflow JSON files including the five final examples

## Excluded

- `.env`
- `.env.local`
- coverage
- test output
- npm cache
- source TypeScript files
- `node_modules`

## Publish Decision

Do not publish automatically. Package is locally packable and inspection-passing, but npm publish requires explicit user authorization and live n8n/video evidence should be completed before Creator Portal submission.
