# Owner-side privacy controller

**FACT (source, 2026-10-12):** This private workspace package supplies a signed policy/capability controller, an explicit single-writer durable journal, bounded reviewed outputs and an mTLS server factory. It is not a deployed daemon, VM launcher, gateway or part of the existing extension VSIX. Every status retains `fullClaim: BLOCKED`. Sources: [controller](src/CapabilityController.mjs), [transport](src/DataPlane.mjs), [runtime plan](src/FullModePlan.mjs).

**FACT (source, 2026-10-12):** The factory does not listen automatically. Default enablement is false. The controller needs authoritative transport, project/item/destination authorization, deployment verification, public projection and independent user-presence adapters. Omitting these adapters denies release. Caller-provided names and a feature flag do not establish OS isolation. Source: [controller](src/CapabilityController.mjs).

**FACT (source, 2026-10-12):** Requests only become pending records. An independently opened owner surface must review exact item/content/policy revision, recipient workload/launch/session, destination, operation, output class and lifetime. Two distinct Ed25519 signatures and the presence verifier are required; a grant is single-use and at most 60 seconds. Original environment/sensitive text has no release operation. Ordinary reviewed text is digest-bound and scanned again; schema values are all masked. Source: [controller](src/CapabilityController.mjs).

**INFERENCE / limit:** Owner-reviewed ordinary prose can still contain unrecognized confidential information. Recognized-secret redaction is defense in depth, not permission to label arbitrary text secret-free. Variable names and counts are deliberate disclosures and require owner review too.

**FACT (source, 2026-10-12):** Signed deny additions cannot be relaxed using the current policy interface. This controller does not implement temporary overrides of hard-denied items. An approved public projection is a distinct authorized item, not an original-file bypass. Source: [controller](src/CapabilityController.mjs).

**FACT (source, 2026-10-12):** Opening an existing journal requires its separately located checkpoint and a matching signing key. Missing, altered, partial or competing-writer state refuses service; old grants are not restored. Recovery is deliberately manual. Source: [journal](src/SignedJournal.mjs).

**INFERENCE / deployment limit:** Separate directories are not independent custody. Windows ACL custody, parent-directory races, power-loss durability, joint journal/checkpoint rollback and an independently protected witness remain unverified. Two test signing keys do not demonstrate physical presence. Do not install real keys, original files or real provider credentials into test fixtures.

**FACT (test definition, 2026-10-12):** Run from the repository with `npm --workspace apps/privacy-controller test`, or from this directory with `node --test src/__tests__/*.test.mjs`. The transport tests use fake one-day certificates, pinned Git OpenSSL on Windows, temporary stores and loopback only. They do not open a real AI provider session or verify deployed VMs. Sources: [tests](src/__tests__/controller.test.mjs), [transport tests](src/__tests__/transport.test.mjs).

**INFERENCE / rollback:** The package is dormant until a trusted integration explicitly constructs/listens to it. To roll back the source component, remove only this package and its two new lockfile entries; preserve existing extension changes, all evidence and any future authoritative ledger. Never fall back to unrestricted original-file reads when a controller is unavailable.

See the [setup and evidence review](../../docs/project-privacy/full-mode/SETUP-REVIEW.md) before any OS installation or runtime integration.
