# P1-P4 local implementation continuation

**Latest code review:** three reproduced gaps were fixed: Docker image approval
binding, bounded registered stdin collection and canonical unique Ed25519
reviewer keys. [Review and verification](P1-P4-REVIEW-2026-11-12.md) records the
145 passing CLI tests, four journey tests and remaining acceptance boundaries.

The interrupted work was resumed using the saved plan. The deployment reference
uses the user's existing **EC2** target. Only the public region `ap-southeast-2`
was read from `.env.production`; the file has no instance/account/OIDC target
settings. Credential values were never printed, copied into tests, or used in
the new build. Project cleanup remains cancelled.

## Implemented locally

- **P1:** a native project journey connects the existing scan, owner-reviewed
  vault/context, supported Node app, tool, verification, artifact and recovery
  workflows. Configuration/save/workspace drift invalidates observations.
  Opening a command never marks protection complete. The Protection Center links
  to the journey. Independent usability and complete installed UI are pending.
- **Shared P3 scanner:** deterministic finite reads, registered matcher and
  detector policy shared with the IDE, explicit source/artifact scope, opaque
  sensitive locations, metadata-only JSON/SARIF, immutable snapshot digest and
  non-successful incomplete scans. The discovered filename leak was reproduced
  before fixing admission. The CLI's guard dependency is a production dependency
  with the lockfile synchronized.
- **P2 guest execution:** an approved, digest-pinned finite Node snapshot in the
  fixed local Docker Desktop Linux engine, with no host mount/network/privilege,
  actual inspection/canaries, bounded output and no host fallback. See
  [scope and commands](ISOLATION-2026-11-12.md). Native engine proof remains absent.
- **P2 approved EC2 operation:** owner-signed policy/artifact approval, a trusted
  root-owned bundled Linux installation outside the workspace, durable atomic
  single-use/revocation decisions, exact account/principal/document/instance/S3
  version/checksum binding, fixed SSM parameters and sanitized submission results.
  A separate trusted receiver consumes the same signed nonce before installing
  a finite Node release under a dedicated runtime service. It preserves old
  releases and keeps runtime `env.production` on the server.
- **P3 reference CI:** credential-free example source/build, a fresh final
  admission runner, exact artifact/report/source bindings, owner-reviewed digest
  and protected OIDC publication to create-only encrypted versioned S3. Delivery
  is a separate signed approval after the object version exists. This is the
  finite Node reference, not migration of the existing website's DockerHub/SSH
  pipeline. [Owner configuration and IAM/SSM files](../../examples/aws-soterai/README.md).
- **P4 evidence intake:** signatures and immutable evidence bytes bind one exact
  candidate. Duplicate reviewers, stale/mutated evidence, incorrect signatures,
  unsupported paths and secret-bearing evidence are refused. Five distinct
  owner-trusted independent human reviewer keys are needed for pilot evidence;
  scripted profiles cannot substitute. A valid signature establishes a binding,
  not independent identity by itself. The assessor always leaves final release
  authorization with the owner and returns `releaseReady:false`.

The retained ECS implementation is an additional fixed operation, not the
selected deployment target. Neither connector was invoked against AWS.

## Verification and material limits

Executed source, compiler, artifact and synthetic evidence results are recorded
in [evidence/20261112-p1-p4](evidence/20261112-p1-p4). The filename regression's
failed test and successful follow-up are both retained. The first CI receipt
test exposed an output-key validator rejecting `artifact_sha256`; its failing
and corrected executions are retained too.

The first synthetic detector sample reported one false-positive label on an
invented unsupported redaction marker. A follow-up uses the actual redactor's
generated output as the public control; both measurements are preserved. These
tiny synthetic samples are not a measured effectiveness percentage or an
independent detector evaluation. Performance measurements are local and include
hardware/scanner identity.

Docker's native response, actual owner installation/file+directory durability,
SSM agent interpolation, OIDC and AWS publication/deployment, installed IDE UI,
upgrade/recovery for the new VSIX, actual provider traffic, independent security
and accessibility review, and five real developer pilots remain unverified.
Existing local/root paths are not a Windows security boundary: production owner
operations fail closed outside their installed root-owned Linux entrypoints.
Unknown/post-claim errors require owner reconciliation and do not establish
rollout health. A deliberately malicious approved production app can leak its
runtime secrets; this design does not override that fact.

## Next concrete owner inputs

The reference files need the existing EC2 instance ID/account, SSM management
status, versioned bucket/prefix, approved document version/hash, publisher and
broker roles, reviewer/signing public keys, and protected GitHub environment.
The current local `.env.production` supplies none of those target identifiers.
No AWS CLI is installed on this Windows host. No server/role/environment changes,
registry publication, live deployment, or deletion of project files occurred.
