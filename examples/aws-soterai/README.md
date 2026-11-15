# Approved delivery to an existing EC2 server

This is an opt-in reference for one finite Node application. Region `ap-southeast-2` comes from the local `.env.production`; repository `yashchauhan66/Soter-AI` comes from the Git remote. No credential value was used to construct these files. The existing DockerHub/SSH website workflow is retained. This reference has not deployed or installed anything on that server.

The supported artifact is a JSON envelope containing one UTF-8 `app.bundle.cjs` of at most 128 KiB. Archives, native dependencies, a complete Next.js image, and arbitrary host commands are unsupported. Expanding that scope needs additional artifact admission and runtime tests.

## Build, review, publish, then approve delivery

The manual [workflow](../../.github/workflows/soterai-aws-ec2.yml) builds without cloud credentials, then checks the exact final artifact on a fresh runner. Leave `approved_artifact_sha256` empty for a build and review. To publish, rerun the same source revision with the exact reviewed artifact digest. The protected `soterai-aws-ec2` environment is the owner approval boundary. The privileged job rechecks bytes before credentials, uses OIDC, performs no npm/application execution, and writes an encrypted create-only object to a versioned bucket. It returns a public receipt with the object version. It does not deploy automatically.

Delivery requires a **separate Ed25519 signed approval** after the object version exists. Its payload contains `schemaVersion:1`, `operation:"ec2.deploy"`, a random 32-character hexadecimal `approvalId`, `policyDigest`, `artifactSha256`, `objectKey`, `objectVersion`, and integer `issuedAt`/`expiresAt` milliseconds. Maximum lifetime is 15 minutes. `policyDigest` is SHA-256 of recursively key-sorted compact JSON of the complete owner policy; the signature covers recursively key-sorted compact JSON of the payload. The envelope is `{payload,signature}` with a base64 signature. Keep the private signing key in owner custody, outside agent access.

The owner invokes the installed fixed entrypoint:

```sh
/usr/bin/node /opt/soterai-owner/owner-broker.cjs ec2-deploy APPROVAL_ID
# Revocation wins only before the exclusive deployment claim:
/usr/bin/node /opt/soterai-owner/owner-broker.cjs ec2-revoke APPROVAL_ID
```

The broker validates account/principal, the exact owner-managed SSM document/version/hash, and the versioned S3 checksum before submitting to one instance. Both broker and server receiver durably consume the approval ID before their external/local actions. Failure or interruption requires owner reconciliation and never silently reuses that approval. A returned command ID means `SUBMITTED`; deployment health remains a separate observation. Raw provider/command logs are withheld.

## Owner setup still required

Fill [owner-target.json](owner-target.json) and the policy template with the actual account, instance, versioned bucket and IAM roles. Defaults deliberately fail preflight. Create the OIDC trust from [oidc-trust.template.json](oidc-trust.template.json) and the narrow publisher/broker IAM policies. The publisher has no secret-read permission. Restrict the GitHub environment to protected `main`, require an owner review and prevent self-review; the OIDC environment subject alone does not restrict the branch. Require CODEOWNERS review for this workflow, these scripts/configuration, guard/CLI sources, lockfiles and tests. No repository protection setting was changed here.

Build owner bundles into a fresh directory:

```powershell
node packages/soterai-cli/scripts/build-owner.cjs <new-output-directory>
```

After reviewing their receipt, install them as root-owned files outside the workspace, with root-owned ancestors and no group/other write permissions. The complete runtime is bundled; no external npm dependency is permitted. The production entrypoints refuse execution from this checkout. Their Node runtime and AWS CLI must also be trusted owner installations. Use the real, pinned AWS CLI executable path rather than a symlink alias. Launch the broker through a trusted service/launcher that clears its environment and supplies only the intended short-lived AWS credential variables. UID 0 alone does not establish credential provenance.

Required fixed paths:

- `/opt/soterai-owner/owner-broker.cjs` and `/opt/soterai-owner/ec2-install.cjs`.
- `/etc/soterai/ec2-policy.json`: the completed policy, matching the signed approval and actual SSM document hash.
- `/etc/soterai/ec2-broker.json`: root-owned JSON with `policyFile`, `approvalsDirectory`, `stateDirectory`, `awsExecutable` absolute paths. Approval files are `APPROVAL_ID.json`; state is persistent, root-owned, private storage with working file/directory fsync.
- `/etc/soterai/ec2-installer.json`: root-owned JSON containing the pinned `awsExecutable` path.
- `/var/lib/soterai-ec2-installer` and `/opt/soterai-approved/releases`: existing root-owned directories. Retained release versions and decision records are never automatically deleted.

Install the [SSM document](ssm-document.json) in the same account, use a numeric version, and verify its AWS SHA-256 hash and returned content. The broker requires schema 2.2, one fixed Node command and `ENV_VAR` interpolation. An older SSM agent that cannot supply `SSM_Approval` fails closed. Configure SSM access/instance role and the separate [systemd service](soterai-approved-app.service) only after owner review. The reference listens on loopback port 8081. Its service uses a dedicated runtime user; its example `EnvironmentFile` must point to the **existing trusted server `env.production`**. The local environment file is never bundled, uploaded or copied by this workflow.

An approved production application can access the runtime secrets intentionally supplied to it. This design keeps them out of the isolated development agent; it cannot prevent deliberately malicious approved production code from leaking its own environment. Independent review and real runtime acceptance remain required.
