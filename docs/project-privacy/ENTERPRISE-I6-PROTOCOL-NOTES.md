# I6: bounded capability decision protocol

Date: 2026-10-12. Status: local implementation and synthetic unit verification only. Independent broker deployment, authenticated OS workload identity, independent user presence, secret execution and durable authority remain UNTESTED. Full G1-G6 claim stays BLOCKED.

## Implemented boundary

**FACT (local source, 2026-10-12):** [CapabilityProtocol](../../packages/vscode-extension/src/project-privacy/capabilities/CapabilityProtocol.ts) is disabled when no explicit enable callback returns true. Enabling without the required authority adapter returns `AUTHORITY_UNAVAILABLE`. It consumes metadata and returns metadata decisions; it reads no protected files, executes no process, supplies no credentials and sends no network traffic.

**FACT (local source, 2026-10-12):** the [adapter contract](../../packages/vscode-extension/src/project-privacy/capabilities/contracts.ts) requires authoritative transport authentication and independent approval checks. A caller supplies an opaque connection reference, not an accepted identity assertion. The core validates the adapter result's authority, principal, workload, launch, session and attestation lifetime. It does not itself establish that any of these assertions are true; the configured adapter belongs to the trusted computing base.

**FACT (local source, 2026-10-12):** the grant binds project, item, content revision, policy revision, exact recipient, fixed operation, action, output class, authority-owned destination route, bounded lifetime and one use. Item classification must be public and match the operation. Revisions and destination permission are checked at issuance and consumption. Approval metadata must match the exact binding and duration and indicate the required independent-presence contract. An editor modal cannot be represented as independent presence by an honest adapter.

**FACT (local source, 2026-10-12):** the [fixed registry](../../packages/vscode-extension/src/project-privacy/capabilities/operations.ts) permits only public schema, public contract and synthetic runtime status decisions. It has no arbitrary shell, SQL, HTTP proxy, raw-secret reveal or credential injection operation. Maximum output sizes are dispatcher requirements described by metadata; no output dispatcher or filtering implementation exists here.

**FACT (local source, 2026-10-12):** the monotonic clock rejects nonfinite, negative and backwards readings and permanently withholds subsequent decisions in that controller. Grants are capped at 60 seconds and further limited by approval and authentication expiry. Consumption records one-use state before returning `ALLOWED_ONCE`. Unknown references, wrong bindings, revision changes, replay and withdrawal return a denial without content.

**FACT (local source, 2026-10-12):** disabled state, authority outage, authority exceptions or authority-identity changes cancel active local grants when observed by a request. Local revoke/dispose functions cancel active grants directly. Recovery needs fresh approval for a cancelled grant. A future configuration-change listener must call `revokeAll()` immediately; toggling a flag off and back on without any observation is not an independently observed revocation.

## Evidence

**FACT (local test execution, 2026-10-12):** [dedicated tests](../../packages/vscode-extension/src/__tests__/project-privacy-capabilities.test.ts) passed **45/45**, with zero failed or skipped cases, using `node --import tsx --test src/__tests__/project-privacy-capabilities.test.ts`. Positive schema/contract/synthetic controls accompany wrong-recipient, changed revision/destination, unsupported-operation, approval-mismatch, expiry, replay, revocation, outage, snapshot, strict metadata and capacity controls. These are in-process synthetic adapter tests, not real transport or operating-system proof.

**FACT (local execution, 2026-10-12):** the initial sandboxed test runner reported `spawn EPERM`. The same test command ran successfully after an approved escalation. This was a test-worker permission failure, not a safety-filter block or a failed confidentiality assertion. No host security probes ran.

**FACT (local typecheck, 2026-10-12):** standalone strict typechecking passed using the existing root TypeScript installation: `node ../../node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module commonjs --esModuleInterop --types node src/project-privacy/capabilities/index.ts src/__tests__/project-privacy-capabilities.test.ts`. An initial invocation referenced a nonexistent package-local TypeScript installation; the corrected existing root path succeeded without downloads.

## Honest product integration

**INFERENCE / integration requirement:** expose this as **"Capability protocol: locally unit-tested; independent broker not deployed"**, with feature setting `soterai.projectPrivacy.capabilityProtocol` default false if a product integration declares it. A true flag must never imply that an authority adapter exists, a workload is enrolled, a network boundary is enforced or G2/G5 have been verified. Do not connect it to an unrestricted shell, ordinary Cline tools or secret injection.

**INFERENCE / future adapter requirement:** issuer authority, identity verification, approval receipt, authoritative policy/content snapshot and route ownership must come from independently protected state. Deployment requires end-to-end release transaction checks, fixed-operation dispatch, bounded public-result validation, durable anti-replay/rollback, signed/attested artifact evidence and effective revocation/drain acknowledgements. A fabricated `INDEPENDENT_TRANSPORT` or `INDEPENDENT_USER_PRESENCE` string does not supply these mechanisms.

## Rollback and remaining limits

**FACT (local source, 2026-10-12):** rollback can leave the flag disabled, stop issuance, call `revokeAll()` and dispose the core. It does not alter original files or remove existing restrictions. There is no runner to kill, network rule to revert or credential to rotate in this increment.

**FACT (local source, 2026-10-12):** grants and revocation/replay records are process-local, unsigned and ephemeral. An opaque UUID is an in-memory lookup reference, not a portable authenticated bearer token. Restart rejects old grant references but cannot independently prove durable approval replay rejection. The lifetime ledger has a default 1,024-record cap (configurable from 1 to 4,096) and fails closed at capacity; it does not discard tombstones to fabricate continuity.

**INFERENCE / limitation:** this core supplies bounded protocol checks, not independent custody or rogue-agent containment. Same-user tampering, compromised adapters, independent user presence, authentic workloads, controller continuity, result confidentiality, remote execution, active operation revocation/drain, mandatory egress, native agents, prior releases and administrator compromise remain outside this verification. Previously released data cannot be recalled. No Phase 3 architecture assertion is promoted by these unit results.
