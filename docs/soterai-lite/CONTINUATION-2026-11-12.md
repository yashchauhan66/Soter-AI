# Current continuation handoff — 12 November 2026

**Superseded by [13 November continuation](CONTINUATION-2026-11-13.md):** a
further scanner finalization fix is packaged in a new exact candidate, with fresh
isolated installation and broker evidence. This page retains the earlier run.

P0 was already complete. The user selected **P1-P4 code review and gap fixes**
for this continuation. The [review record](P1-P4-REVIEW-2026-11-12.md) records
three reproduced fixes: Docker image approval binding, registered stdin byte
limits and unique Ed25519 reviewer signer keys. Full CLI tests passed 145/145;
guided journey tests passed 4/4. CLI typecheck and compilation passed.

The P1-P4 local implementation scope remains documented in
[P1-P4-IMPLEMENTATION-2026-11-12.md](P1-P4-IMPLEMENTATION-2026-11-12.md).
New evidence is retained in
[evidence/20261112-fast-continuation](evidence/20261112-fast-continuation).
Earlier evidence remains unchanged; project cleanup is cancelled.

## Saved Lite candidate

The [saved release pointer](evidence/20261112-continuation/candidate-pointer-01.json)
resolves to Lite 0.7.0 pre-release, win32-x64:

- Artifact: `packages/soterai-lite/soterai-lite-0.7.0-continuation-20261112-attempt01.vsix`.
- Size: **1,664,937 bytes**.
- SHA-256: `33e199a85265253d0fec6c7252562b2503d496d14370109304b155c171d5686e`.
- Receipt/inventory verification passed; the exact packaged broker's six
  loopback scenarios passed with synthetic credentials.
- This earlier Lite VSIX does not package the subsequent P2/P3/P4 CLI changes.
  The current CLI was compiled separately. The installed IDE remains a separate
  acceptance boundary.

The earlier Docker check returned `UNAVAILABLE / DAEMON_RESPONSE_UNVERIFIED`
after approximately 15 seconds. No snapshot was transferred or container
created; runtime isolation was not established. Its actual result is retained
in [docker-readonly-native-01.json](evidence/20261112-continuation/docker-readonly-native-01.json).

## Remaining work

1. Review the fixed CLI and rerun `isolate plan`; use its `approvalSha256` with
   `--approve-proposal`. Existing snapshot-only approvals are intentionally
   refused.
2. Establish a working local Docker Linux engine and execute the actual
   inspection/canary/application flow with a reviewed local image. Current
   [scope and commands](ISOLATION-2026-11-12.md) remain finite.
3. Verify installed IDE UI, upgrade and recovery using the exact Lite candidate.
4. Supply the real account/instance, SSM document/version/hash, versioned S3
   target, OIDC/broker roles, signing keys and protected GitHub environment for
   the [EC2 reference](../../examples/aws-soterai/README.md). Its finite Node
   reference does not migrate the existing website deployment pipeline.
5. Collect actual provider, independent security/accessibility and five real
   developer pilot evidence with distinct owner-trusted reviewer keys.

`releaseReady` remains **false**. No native Docker, real provider, AWS deployment
or human acceptance result is inferred from source tests or synthetic fixtures.
