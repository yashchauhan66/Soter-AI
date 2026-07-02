# n8n Publish Report

Date: 2026-07-02

## Package
- Folder: `packages/integrations/n8n`.
- Package: `n8n-nodes-soterai`.
- Version: `0.2.0`.
- n8n metadata: present in `package.json`.
- Credentials file: present.
- Node class: present.
- Icon: present.
- README/LICENSE/CHANGELOG: present.
- Example workflow: present.

## Commands
| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | Package dependencies up to date. |
| `npm run lint` | PASS | TypeScript no-emit check passed. |
| `npm run build` | PASS | `dist` generated. |
| `npm test` | NOT_AVAILABLE | No test script. |
| `npm pack --dry-run` | PASS | Tarball contents verified. |
| `npm pack` | PASS | Created `n8n-nodes-soterai-0.2.0.tgz`. |
| `npm whoami` | ACCOUNT_BLOCKED | npm returned 401 Unauthorized. |

## Final Status
- Package readiness: YES.
- npm publish: ACCOUNT_BLOCKED.
- n8n verification: ACCOUNT_BLOCKED.

No `npm publish` was attempted because npm account authentication failed.
