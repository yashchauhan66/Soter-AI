# SoterAI Secret Guard privacy

[Overview](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/README.md) · [User guide](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md) · [Recovery and removal](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#recovery-and-removal)

This statement covers SoterAI Secret Guard, packaged as SoterAI Lite under the extension ID `soterai.soterai-ide-guard`. It reduces accidental project-secret exposure through supported cooperative tools and managed routes. It does not isolate other processes, extensions or applications running as the same user.

## At a glance

| Activity | Data handling |
| --- | --- |
| Local scans and reviewed previews | Process supported content locally; live scanning is on by default |
| Configured AI provider requests | Send inspected requests to the provider you select; unrecognized private information can remain |
| Optional dependency-advisory lookup | Can contact OSV with package names and versions, according to your consent setting |
| Vault and configuration recovery | Keep encrypted records outside the project; keys use VS Code SecretStorage |
| Redacted-event telemetry | Off by default; see the detailed limits below |

Local does not mean that every operation is offline. Configured provider traffic is separate from the cloud and telemetry preferences.

## Local processing and defaults

Local detectors inspect supported document content and selected files in memory. Local live scanning starts by default; sensitive-file discovery and watchers can read content for analysis without asking before each local scan. Replacing files through vault migration requires owner review. Restricted mode can still perform local analysis; integrations and mutations enforce their own trust requirements. This release supports a local Windows filesystem workspace. Linux, macOS, remote and virtual workspaces are not tested or supported.

A trusted workspace can start the bundled local broker on a private loopback port. Provider destinations start blank. Installing Lite needs no SoterAI account, provider login, administrator access or external controller. Optional tool use can have its own account requirements.

## Data that can leave the machine

Configured managed provider routes send approved, inspected requests to the provider the owner configures. Public code, text and values not recognized by the declared filters can be included. The separate cloud preference being off is not a global veto on configured provider traffic. Providers control their own retention. Independent tools and applications can send their own traffic outside Lite's managed routes.

Owner-invoked dependency advisory commands can ask to contact OSV with package names, ecosystems and versions. Their default mode asks first; an owner can select always or never. The local MCP dependency check uses offline heuristics. Opening support or rotation links is an explicit owner action.

Approved safe-read/MCP clients receive the exact reviewed safe output and can subsequently share it. Vault run/task/debug workflows give selected values to the chosen application through its environment; that application can use, print or transmit them. Output filtering does not recall an earlier upload.

An owner-approved isolated AI task copies only the selected checked public files into a temporary Docker session. Its guest has no direct network route; the host forwards inspected model requests to the configured managed provider. Proposed file contents are returned for local review and optional clipboard copy. The container does not isolate other extensions or host applications. The separately approved vault-app dependency snapshot still executes in a host Node process with its selected values.

Optional secretless Vault operations contact the exact HTTPS Vault server chosen by the owner. Following per-use approval, the host sends the stored bootstrap token to that server's configured token-creation endpoint, uses the issued token for one reviewed resource GET, and attempts token revocation. Requests disclose the configured role, policy names and selected resource to that server. Only allowlisted scalar response fields that pass output checks are returned to the guest. Setup does not contact the server. The server's own access controls, logs and retention remain the administrator's responsibility.

## Storage and retention

Saved restrictions, policy paths and review metadata persist in extension state and project policy files. Turning a feature off preserves accepted denies, recovery information and existing encrypted backups. Uninstall is not a promise to erase profiles, backups or earlier copies.

Opening a recognized sensitive plaintext document can record its relative filename, time, candidate count and best-effort active-tool name/id locally, retaining up to200 recent events. This record is separate from optional audit telemetry and does not prove which process read a file. A clear-history command is available.

Optional audit and possible-exposure histories retain bounded event/count/time and keyed-reference metadata. They do not prove credential validity, actual AI access or completed rotation. Disabling collection stops new opted-in events; previously accepted records are not silently rewritten.

Reviewed vault, editor-recovery and vendor-configuration backups retain encrypted originals outside normal workspace files. Keys use VS Code SecretStorage. Some filenames, source/workspace identifiers, digests, generation and ownership metadata remain outside ciphertext. SecretStorage and encryption are not an independent boundary against code running as the same user. Decrypted content necessarily exists in process memory during use; no secret-free-memory or crash-dump guarantee is made.

A successful **Restore changes before removal** review retains a separate immutable copy of recognized encrypted vault files, legacy vault backups and encrypted configuration backups under the same profile's `User/globalStorage/soterai-recovery` directory. This survives VS Code's deferred deletion of the extension's own global-storage directory. The archive includes plaintext file/source identifiers and ciphertext digests in its manifest and pointers; it excludes encryption keys and decrypted values. Archives are not automatically deleted, merged or restored. Direct uninstall without the successful review, profile deletion and key loss are outside this preservation guarantee. See the [user guide](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#recovery-and-removal) for the same-profile recovery procedure.

Provider keys, reference values and optional cloud tokens use SecretStorage for their distinct purposes. Configuring the optional cloud token does not establish observed synchronization or account validation. Never include credentials in issue reports or public exports.

Secretless-operation endpoint, role, policy, resource and allowed-field metadata persist in extension global state; its bootstrap token uses SecretStorage. The removal command deletes that configuration and bootstrap after confirmation. Portable vault export is a separate explicit disclosure capability: a password-encrypted file contains the vault key together with encrypted records. Anyone holding that file and password can recover the included vault values. Exports remain at the owner-selected location until the owner removes them; neither export nor import uploads them. Import only installs into an eligible empty or matching interrupted-import vault and leaves project files unchanged.

## Telemetry and control

Redacted event telemetry is off by default and also respects host/owner/privacy/trust controls. The inspected bundled telemetry send callbacks do not send a remote telemetry payload; an opt-in can expose minimized event metadata to VS Code's telemetry output. VS Code, operating-system and other vendors' telemetry are separate.

Use the native review/undo commands for configuration changes and recovery. Restore can refuse when ownership or bytes changed; preserve those receipts for manual review. Pre-commit installation/resume is a default-off candidate requiring the machine setting and explicit owner review; feature completion and current-package native verification remain pending. Existing owned-hook status and reviewed restore remain accessible. Vault disclosure recovery can restore originals only after its separate explicit review; removal must not silently disclose them.

For support, use the issue tracker linked in the extension's package metadata. Share sanitized reproduction steps and metadata, not secret values. The owner publishing runbook and required human/independent verification remain separate from this privacy statement.
