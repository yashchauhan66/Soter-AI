# Optional Tier-2-lite: public snapshot scaffold

**INFERENCE — Coverage label.** hygiene, not a boundary against same-user native processes; WSL is not a security boundary against the Windows user

**INFERENCE — Current state, 2026-10-09.** B4 adds a repository-only, default-off snapshot/template generator and synthetic unit tests. It does not launch Docker, WSL, a VM, VS Code, an AI agent or a network service. There is no runtime container coverage claim and no normal-profile change. Agents started natively are OUTSIDE COVERAGE. G1–G6 and all thirty selected-architecture assertions remain UNTESTED. Live container deployment/attach and online mode are INCOMPLETE/UNAVAILABLE.

## Generator contract and flag

**INFERENCE — Entry point.** `generateTier2LiteWorkspace` in `packages/vscode-extension/src/tier2-lite/PublicWorkspace.ts` accepts an explicit boolean `enabled`, absolute source root, exact individually classified `publicPaths`, effective `isProtected` deny checker, reviewed digest-pinned base-image reference and optional placeholder count. `enabled` defaults to false. Off rejects before reading files or evaluating policy; there is no old export/launch fallback. This is an input flag, not a newly installed editor setting or independent policy authority.

**INFERENCE — Public selection.** No recursive discovery, directory copy, implicit wildcard or source Git clone occurs. Every selected file must have a valid portable relative path, be explicitly public and remain unprotected before and after asynchronous reading. Unknown policy, policy exceptions, missing files, blocked paths, aliases/hardlinks, binary/invalid UTF-8 text and size errors reject the entire result. Existing `readBoundaryFile` provides regular-file, alias/hardlink and bounded reads. Limits are 256 files, 64 KiB per file and 4 MiB total public text. ASCII path restrictions and Windows device-name/stream rejection may reject otherwise legitimate files; this is an explicit unsupported input, not a silently weakened fallback.

**INFERENCE — Omitted inputs.** Hidden source files, `.git`, home/history/cache/recovery directories, `node_modules`, credential-name/file patterns and Docker socket paths cannot be public selections. Unselected source files are not read. This does not recognize arbitrary private meaning: a secret mistakenly classified public can be exported. The caller's classification and deny checker remain writable by a same-user agent; they are workflow hygiene, not G1/G2 authority.

**INFERENCE — Placeholders.** Fresh UUID-based placeholders include no source path, value, decryption key or secret-resolution endpoint. Placeholder count does not cause a protected file read. They are opaque public reminders, not usable credentials or permission to resolve anything. There is no automatic secret injection in this scaffold.

**INFERENCE — Output.** The function returns an in-memory plan: public files under `public/`, placeholders, devcontainer/Dockerfile templates, isolated-host-profile settings and a run-specific manifest with public-file hashes. It performs no disk writes, container builds or process launches. A later separately reviewed user wrapper can serialize only this plan to a fresh exclusive directory; it must never build with the original repository as Docker context. No such wrapper was added here.

## Declared container and forwarding policy

| Mechanism | Generated policy and current limit |
|---|---|
| Nonprivileged runtime | **INFERENCE:** UID/GID 65532, privileged=false, no added capabilities, drop ALL, no-new-privileges, read-only root and bounded temporary storage. Image/user/editor compatibility is UNTESTED. A digest reference pins an identifier; it does not review the image's contents, metadata or entrypoint. |
| Workspace | **INFERENCE:** A new run-specific named public volume overrides default workspace binding. Only generated public files are copied into the image. No original workspace, host home/history, recovery/cache, credential or Docker socket bind is generated. Runtime tools can create new state in that public volume; no runtime cleanliness claim is made. |
| Environment | **INFERENCE:** No `${localEnv:...}` values. `remoteEnv` is empty and `userEnvProbe` is none. Fresh container home is temporary; SSH/GPG/askpass references are empty and Git helper/global-config inputs are disabled in the declared environment. Base-image/client-injected environment and editor IPC remain unverified. |
| Git config/helper | **INFERENCE:** Generated isolated-host and customization settings request copyGitConfig=false and gitCredentialHelperConfigLocation=none; Docker credential helper is off. Those settings are not applied to a current profile. Effective behavior at attach is INCOMPLETE. |
| SSH/GPG forwarding | **INFERENCE:** Application policy explicitly requests no forwarding, with no host agent/home mounts or inherited socket environment. No official dedicated Dev Containers SSH/GPG disable setting was verified in this research, so none is invented. Environment clearing does not establish absence of editor-mediated credential channels. A later isolated client must have an empty synthetic home, no active SSH/GPG agents and no host credential delegation; attach inspection remains a prerequisite. This item is INCOMPLETE, not a tested disabled channel. |
| Editor helpers | **INFERENCE:** No generated feature installs, lifecycle commands, default extensions, dotfiles bootstrap, port forwarding or Wayland/WSL service mounts. Required host-profile settings are emitted as an artifact only. Client/global/image metadata can add behavior; exact effective configuration remains UNTESTED. |
| Networking | **INFERENCE:** Build/runtime templates request network=none; no provider connection, endpoint secret or generic proxy is generated. Live enforcement and editor control-channel routing are UNTESTED. Future online mode is unavailable until reviewed allowlisting exists outside container writable authority. An agent-writable proxy is not the planned enforcement authority. |

**FACT — accessed 2026-10-09.** Official VS Code documentation describes automatic `.gitconfig` copying, local credential-helper reuse, SSH-agent forwarding and GPG credential sharing. Source URL: [Sharing Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials). **INFERENCE:** These defaults create enrollment requirements; generated JSON alone cannot certify they are disabled for every client version.

**FACT — accessed 2026-10-09.** A VS Code maintainer documented per-container `customizations.vscode.settings` with copyGitConfig=false on 2025-01-06. Source URL: [Microsoft issue 10592, maintainer comment](https://github.com/microsoft/vscode-remote-release/issues/10592). **INFERENCE:** This supports the intended setting placement, not current runtime enforcement or all forwarding channels. Ordinary issue reports alleging settings failures are not independently reproduced evidence for this build.

**FACT — accessed 2026-10-09.** The Dev Container specification defines remote/container users, mounts, environment probing, workspace-mount overrides, lifecycle hooks and tool customizations. Source URL: [Specification reference](https://raw.githubusercontent.com/devcontainers/spec/main/docs/specs/devcontainerjson-reference.md). Docker documents that its none network driver leaves only the container loopback interface. Source URL: [Docker none networking](https://docs.docker.com/engine/network/drivers/none/). **INFERENCE:** These are mechanisms supporting the declared template, not verified behavior of a deployed instance or host-wide E.

## Expected-result assertions and rollback

| Later/implemented check | Expected result / evidence scope |
|---|---|
| Default/off | **INFERENCE:** Generation fails before any source/policy read. No disk or launch side effect. Covered by synthetic unit regression. |
| Explicit public selection | **INFERENCE:** Fixture output contains exactly selected public files and opaque placeholders; unselected fake `.env`, history and caches contribute zero fixture bytes. Covered by synthetic unit regression; no real secrets used. |
| Protected/unknown/alias input | **INFERENCE:** Protected classification, missing policy, absent path, hardlink, junction, policy change and case collision reject the plan. Covered by synthetic unit regression. This does not prove an atomic same-user race boundary. |
| Template | **INFERENCE:** No host binds/localEnv/lifecycle commands; declared nonroot/offline policy, required limitation label and INCOMPLETE attach/online states. Covered by metadata regression only. |
| Runtime/container/agents | **INFERENCE:** Effective image metadata, UID, capabilities, mounts, credentials/IPC, editor placement, network/transport routes and usable public controls need later authorized independent observations. NOT_TESTED; no container or real-agent execution occurred. |

**INFERENCE — Raw targeted result.** `evidence/B4/scaffold-checks-1/targeted-units.log` records seven unit tests, seven pass, zero fail/skip and exit 0. These are scoped implementation assertions, not a security pass. Batch-wide build/typecheck/existing suites are recorded by the main B4 ledger/check runner. No safety filter blocked this scaffold task.

**INFERENCE — Rollback.** Set input flag off to withdraw generation. Retain existing evidence; do not replace a failed offline/attach prerequisite with networked/native execution, forward credentials or mount original sources. Already generated public bytes cannot be recalled. No original secret/policy was modified, so there is no secret migration to reverse and no actual VM/network/profile state to restore.

**INFERENCE — Remaining exposure.** Natively started agents, same-user files/history, DPAPI/token authority, protected buffers/tabs, clipboard/display/accessibility/memory, policy/config tampering, prior copies and host egress remain outside this mode's boundary. Independent C/W/P/S/M/E still require Tier 3. This scaffold can improve handling of explicitly public snapshots without satisfying the user's complete architecture.
