# Licensing

SoterAI is **proprietary, closed-source software**. This repository is private
and its contents are confidential. **Copyright in all of it belongs to Yash
Chauhan.** See [`LICENSE`](LICENSE) for the governing terms.

This repository was previously distributed publicly under an open-core model
(Business Source License 1.1 core + Apache-2.0/MIT client packages). That model
has been retired. This page records what changed and which components still
carry their own license, so the record stays accurate.

## Repository

| Area | Path(s) | License |
|------|---------|---------|
| **Everything not listed below** | repo root, `app/`, `lib/`, `workers/`, `prisma/`, `infra/`, `helm/`, `scripts/`, `apps/`, `data/`, `models/`, `reports/` | **Proprietary — All rights reserved** ([`LICENSE`](LICENSE)). No use, copy, modification, or redistribution without a written agreement. |
| **Enterprise modules** | `lib/agent-firewall`, `lib/advanced-security` | **Commercial — All rights reserved** (own `LICENSE` files, unchanged) |

## Components already published to public registries

These were released publicly **before** this repository became private. Rights
already granted for those published versions **cannot be and are not revoked** —
each package's own `LICENSE` file governs that package, and prevails over the
root [`LICENSE`](LICENSE) for that path. Everything outside these paths is
proprietary.

| Package | Path | License | Published to |
|---------|------|---------|--------------|
| `@soterai/core` | `packages/sdk` | Apache-2.0 | npm |
| `soter-pii` | `packages/soter-pii` | Apache-2.0 | npm |
| `@soterai/cli` | `packages/soterai-cli` | BUSL-1.1 | npm |
| `@soterai/mcp-gateway` | `packages/mcp-gateway` | MIT | npm |
| `@soterai/ide-common` | `packages/ide-common` | BUSL-1.1 | npm |
| `@soterai/ide-protocol` | `packages/ide-protocol` | BUSL-1.1 | npm |
| `n8n-nodes-soterai` | `packages/integrations/n8n` | MIT | npm |
| `soterai-ide-guard` | `packages/vscode-extension` | BUSL-1.1 | VS Code Marketplace, Open VSX |

Browser-extension builds distributed through the Microsoft Edge Add-ons store
are governed by that store's listing terms; the source in `apps/extension` is
proprietary.

Packages under `packages/` that carry an open-source `LICENSE` file but have
**not** been published (for example `packages/python-sdk`,
`packages/guard-core`, `packages/integrations/{botpress,flowise,zapier}`,
`extensions/jupyterlab`) have never been distributed under that license. They
are treated as proprietary unless and until they are published.

Third-party dependencies remain under their own licenses.

## In plain terms

- **This source is not public and not licensed for outside use.** Access is by
  authorization only.
- **The npm/marketplace packages above stay usable** by anyone who already
  installed them, under the license each one shipped with.
- **The core service, models, detection rules, benchmarks, and evidence
  artifacts are proprietary.** Reading, copying, or benchmarking them without
  written permission is not permitted.

## Want a commercial license or evaluation access?

- **Yash Chauhan** — [soterai.in/contact-sales](https://soterai.in/contact-sales)

## Contributions

External contributions are no longer accepted. [`CLA.md`](CLA.md) existed to
keep the open-core model enforceable and is retained for historical record
only; it does not imply that this repository accepts outside contributions.

## Note on copyright registration

Copyright is yours automatically the moment the code is written — you do not
have to register it. If you want stronger legal proof for enforcement, you can
optionally register the work with the **Copyright Office of India**
(copyright.gov.in) or the relevant office in your jurisdiction. That step is
done outside this repository.

> This file is a plain-language map, not legal advice. Have a lawyer review
> [`LICENSE`](LICENSE) before you rely on it in a commercial agreement.
