# SoterAI Lite privacy

This statement describes the packaged Lite extension's data routes. Lite reduces accidental project-secret exposure through supported cooperative tools and managed routes. It does not isolate other processes, extensions or applications running as the same user.

## Local processing and defaults

Local detectors inspect supported document content and selected files in memory. Local live scanning starts by default; sensitive-file discovery and watchers can read content for analysis without asking before each local scan. Replacing files through vault migration requires owner review. Restricted mode can still perform local analysis; integrations and mutations enforce their own trust requirements. This release supports a local Windows filesystem workspace. Linux, macOS, remote and virtual workspaces are not tested or supported.

A trusted workspace can start the bundled local broker on a private loopback port. Provider destinations start blank. Installing Lite needs no SoterAI account, provider login, administrator access or external controller. Optional tool use can have its own account requirements.

## Data that can leave the machine

Configured managed provider routes send approved, inspected requests to the provider the owner configures. Public code, text and values not recognized by the declared filters can be included. The separate cloud preference being off is not a global veto on configured provider traffic. Providers control their own retention. Independent tools and applications can send their own traffic outside Lite's managed routes.

Owner-invoked dependency advisory commands can ask to contact OSV with package names, ecosystems and versions. Their default mode asks first; an owner can select always or never. The local MCP dependency check uses offline heuristics. Opening support or rotation links is an explicit owner action.

Approved safe-read/MCP clients receive the exact reviewed safe output and can subsequently share it. Vault run/task/debug workflows give selected values to the chosen application through its environment; that application can use, print or transmit them. Output filtering does not recall an earlier upload.

## Storage and retention

Saved restrictions, policy paths and review metadata persist in extension state and project policy files. Turning a feature off preserves accepted denies, recovery information and existing encrypted backups. Uninstall is not a promise to erase profiles, backups or earlier copies.

Opening a recognized sensitive plaintext document can record its relative filename, time, candidate count and best-effort active-tool name/id locally, retaining up to200 recent events. This record is separate from optional audit telemetry and does not prove which process read a file. A clear-history command is available.

Optional audit and possible-exposure histories retain bounded event/count/time and keyed-reference metadata. They do not prove credential validity, actual AI access or completed rotation. Disabling collection stops new opted-in events; previously accepted records are not silently rewritten.

Reviewed vault, editor-recovery and vendor-configuration backups retain encrypted originals outside normal workspace files. Keys use VS Code SecretStorage. Some filenames, source/workspace identifiers, digests, generation and ownership metadata remain outside ciphertext. SecretStorage and encryption are not an independent boundary against code running as the same user. Decrypted content necessarily exists in process memory during use; no secret-free-memory or crash-dump guarantee is made.

Provider keys, reference values and optional cloud tokens use SecretStorage for their distinct purposes. Configuring the optional cloud token does not establish observed synchronization or account validation. Never include credentials in issue reports or public exports.

## Telemetry and control

Redacted event telemetry is off by default and also respects host/owner/privacy/trust controls. The inspected bundled telemetry send callbacks do not send a remote telemetry payload; an opt-in can expose minimized event metadata to VS Code's telemetry output. VS Code, operating-system and other vendors' telemetry are separate.

Use the native review/undo commands for configuration changes and recovery. Restore can refuse when ownership or bytes changed; preserve those receipts for manual review. Pre-commit installation/resume is unavailable in this release after an incomplete final verification attempt; existing owned-hook status and reviewed restore remain accessible. Vault disclosure recovery can restore originals only after its separate explicit review; removal must not silently disclose them.

For support, use the issue tracker linked in the extension's package metadata. Share sanitized reproduction steps and metadata, not secret values. The owner publishing runbook and required human/independent verification remain separate from this privacy statement.
