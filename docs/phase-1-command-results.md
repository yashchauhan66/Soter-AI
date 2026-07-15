# Phase 1 Command Results

| Command | Result | Evidence |
| --- | --- | --- |
| `git status` | PASS | Dirty tree inventoried on `phase-1-release-hygiene-fix`; local global ignore warning only |
| `git branch --show-current` | PASS | `phase-1-release-hygiene-fix` |
| `git status --short` | PASS | Dirty files classified; cache removal staged |
| `git diff --stat` | PASS | Source/doc/asset hygiene changes visible; npm cache removal staged |
| `git ls-files --deleted` | PASS | Empty after asset restore and cache cleanup |
| `git ls-files --others --exclude-standard` | PASS | Only classified untracked release docs/scripts remain |
| `npm run validate:extension-permissions` | PASS | Manifest/docs match, 20 HTTPS hosts |
| `npm run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm run lint` | PASS with warnings | 0 errors, 72 warnings |
| `npm test` | PASS | 679 pass, 0 fail |
| `npm audit --omit=dev` | PASS | 0 vulnerabilities after approved network/cache run |
| `npm run build` | PASS | Next.js compiled, generated 194 static pages |
| `npm run package` | PASS | Store manifest validation passed; `soter-extension-v0.1.2.zip` generated |
| `npm run test:sdk:js` | PASS | 18 pass, 0 fail |
| `npm --prefix packages/sdk run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm --prefix packages/vscode-extension run typecheck` | PASS | `tsc --noEmit -p tsconfig.json` exit 0 |
| `npm --prefix apps/extension run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm --prefix packages/integrations/n8n run lint` | PASS | `tsc --noEmit` exit 0 |
| `git checkout-index -a -f --prefix=C:/tmp/soterai-clean-release-test-20260714/` | PASS | Staged release candidate exported to clean temp directory |
| clean-copy `npm install` | PASS | 848 packages installed; Prisma Client generated |
| clean-copy `npm run validate:extension-permissions` | PASS | Manifest/docs match, 20 HTTPS hosts |
| clean-copy `npm run typecheck` | PASS | Required approved temp write for `tsconfig.tsbuildinfo`; exit 0 |
| clean-copy `npm run lint` | PASS with warnings | 0 errors, 72 warnings |
| clean-copy `npm test` | PASS | 679 pass, 0 fail |
| clean-copy `npm audit --omit=dev` | PASS | 0 vulnerabilities after approved network/cache run |
| clean-copy `npm run build` | PASS | Next.js compiled, generated 194 static pages |
| clean-copy `npm run package` | PASS | Store manifest validation passed; `soter-extension-v0.1.2.zip` generated in temp copy |

Notes:

- The first sandboxed `npm audit --omit=dev` failed due registry/cache access and was rerun with approval.
- `npm run build` reported local `.env.local` and `.env` loading. Those files are ignored and excluded from commit.
