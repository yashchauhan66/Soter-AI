# Licensing — Open Core Model

SoterAI follows an **open-core** model. The source is publicly visible, but it
is **not** "do whatever you want" software. Different parts of this repository
are governed by different licenses. **Copyright in all of it belongs to
Yash Chauhan.**

| Area | Path(s) | License | What you may do |
|------|---------|---------|-----------------|
| **Core product / server** | repo root, `app/`, `lib/`, `workers/`, `prisma/`, `infra/`, `helm/`, `scripts/` | **Business Source License 1.1** (see [`LICENSE`](LICENSE)) | View, modify, and use for **non-production / internal** purposes. **Production use as a service to third parties, or building a competing product, requires a commercial license.** Auto-converts to Apache-2.0 on the Change Date (2030-06-25). |
| **Client SDKs & middleware** | `packages/sdk`, `packages/python-sdk`, `packages/langchain-middleware`, `packages/llamaindex-middleware`, `packages/vercel-ai-sdk-middleware`, `packages/soter-pii` | **Apache-2.0** | Freely install, use, and integrate into your own apps (so you can call the SoterAI service). |
| **Enterprise / proprietary modules** | `lib/agent-firewall`, `lib/control-plane` (and any module marked "Commercial") | **Commercial — All rights reserved** | No use, copy, or redistribution without a written commercial license from Yash Chauhan. |

## In plain terms

- **You can read and learn from the code.** It's source-available.
- **You cannot take the core, host it, and sell a competing AI-security
  service** — that needs a paid commercial license.
- **You can use the SDKs** to connect your own app to SoterAI.
- **Contributions** require signing the [Contributor License Agreement](CLA.md),
  which assigns rights to Yash Chauhan so the open-core model stays enforceable.

## Want a commercial license?

For production/SaaS/OEM/enterprise use, contact the Licensor:

- **Yash Chauhan** — [soterai.in/contact-sales](https://soterai.in/contact-sales)

## Why GitHub reports this repository as "NOASSERTION"

GitHub detects licenses with [`licensee`](https://github.com/licensee/licensee), which
only recognises the licenses catalogued on choosealicense.com. **BUSL-1.1 is not in
that catalogue**, so GitHub's sidebar and API report `Other` / `NOASSERTION` for every
Business Source License project — HashiCorp Terraform and Sentry included. This is a
detector limitation, not a missing or ambiguous license.

The authoritative terms are in [`LICENSE`](LICENSE). The SPDX identifier is
**`BUSL-1.1`**, declared in `package.json` so npm, SBOM generators, and SCA tools
resolve it correctly.

## Note on copyright registration

Copyright is yours automatically the moment the code is written — you do not
have to register it. If you want stronger legal proof for enforcement, you can
optionally register the work with the **Copyright Office of India**
(copyright.gov.in) or the relevant office in your jurisdiction. That step is
done outside this repository.
