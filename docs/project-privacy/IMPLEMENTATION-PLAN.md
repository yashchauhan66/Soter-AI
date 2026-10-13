# Project privacy: analysis and implementation plan

Date: 2026-10-11. Starting checkout: security-hardening, 8ef3aeb54f4019f4ee815a844443995176a656f0.

## Contract and feasibility

The requested contract is project-scoped: secrets are unreadable to an AI agent, users can restrict arbitrary project files, approved dotenv access reveals names but never values, ordinary restricted files need approval, and the UI makes these operations easy. Protection must account for project history, copies, open buffers and tool output as well as ordinary files.

FACT (source checked 2026-10-11): VS Code extensions run with the editor's permissions and can read files, make network requests and start processes. A sibling extension is not forced to use another extension's reader. https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security

FACT (local evidence, 2026-10-11): the existing synthetic host comparison records eight scoped blocks and nine confidentiality leaks, including direct filesystem reads, environment/output, Git objects and independent loopback traffic. See ../secretguard/guarantee-program-2026-10-09/phase5/host-comparison.md. The current report keeps full G1-G6 BLOCKED and the OS architecture UNTESTED.

INFERENCE: the five demands cannot be perfectly fulfilled by an ordinary extension in a shared, unrestricted IDE session. Narrowing the data to one project does not remove the file/process/network authority that causes these failures. A background process with the same authority is insufficient too.

DECISION: implement a bounded project privacy workflow now, reuse the existing deny-only boundary, and explicitly withhold a claim that rogue or native agents cannot read originals. Do not install services, alter ACLs/accounts/firewall, launch containers, deploy, push or execute new probes. Preserve historical evidence and claims. The complete no-read contract needs a separately verified agent compartment; that deployment remains deferred. The owner has now selected VS Code with Cline; see [the Cline assessment](CLINE-ASSESSMENT.md) for integration prerequisites and limits.

## Existing mechanisms and planned changes

| Requirement | Current source and observation | Implementation direction |
|---|---|---|
| 1. Project secrets inaccessible | ai-boundary/BoundarySnapshot.ts omits default-protected paths for managed readers. Direct reads still leak. | Use the shared credential-bearing path list for managed exclusion; no weakening of existing denies. Provide schema-only sensitive views, never raw reveal in the new workflow. |
| 2. Easy per-file restrictions | ai-boundary/commands.ts saves add-only file/folder/glob/region denies. | Reuse explorer restrictions; add a sensitive restriction and a focused project privacy panel with restriction/approval/status actions. |
| 3. Permission plus masking | Existing redacted preview refuses denied files; the terminal watcher runs after execution starts and cannot veto it. | Add an explicit approved read route and a terminal-shaped managed reader, with no OS shell. Approval is one invocation, exact file/content/policy bound, expirable and revalidated. Dotenv returns variable names and [MASKED]. Other sensitive files remain wholly masked. Ordinary approved files receive recognized-secret redaction and region enforcement. |
| 4. Professional UI | Existing sidebar has themed styles, CSP, host action allowlist and accessible controls. | Add a focused project privacy card/status page, keyboard actions and explorer commands. Show covers/does not cover visibly; never label an operational reader as OS isolation. |
| 5. Project leak surfaces | Managed gathering, output filters, child environment and safe Git exist. Unmanaged history/environment/network remain gaps. | Reuse managed controls and document per-surface coverage. A generated public snapshot or registered advisory tool is not a deployed security boundary. |

## Implementation sequence

1. Add a pure view builder: dotenv names only; other sensitive files withheld; ordinary files pass recognized-value redaction. Bound content size; discard comments, multiline values and unknown dotenv lines.
2. Add a project-only access service. Default managed reads retain denies. Only the approved route may produce a one-time safe view. Bind the native editor modal to workspace/path, content/current policy, a 60-second lifetime and requester surface. No persisted allow, no caller-provided approval, no raw reveal or arbitrary command execution. Cancellation, changed file/policy, disabled flag, revoked requests and disposal withhold output.
3. Add host commands and a managed read-only terminal with a fixed `read <relative path>` grammar. Output is safe view only. It does not intercept existing IDE terminals. Arbitrary third-party tool integration is not claimed.
4. Add the focused UI, explorer menu entries and a feature flag. The main sidebar stays metadata-only; sensitive source content is never sent to webviews or logs. An optional safe preview contains approved output only.
5. Run synthetic unit/adapter tests, package typecheck/build and existing boundary/UI/claims regressions. No host run, live provider or real credential test is implied. Report new bundle hashes separately; old program results do not certify a new bundle.

## Acceptance assertions

- Default managed collection excludes credential-bearing paths and user-denied files while retaining public files.
- A restricted-file request emits no original data to a model, terminal, preview, clipboard, webview, notification or audit before explicit approval.
- Cancellation/refusal is DENIED, without a persisted allow.
- Approval for project A/file X cannot authorize project B/file Y or a newer content/policy revision.
- Approved nested `.env` and `.env.local` output contains names such as DATABASE_URL and API_KEY with every value [MASKED]; comments, URL fragments, multiline secrets and interpolation values are absent.
- An ordinary restricted file gets one safe read on approval; recognized secrets and protected regions are omitted. The persistent deny remains afterwards.
- Sensitive restrictions remain masked even for ordinary filenames or a caller requesting raw content.
- Invalid policy, disabled flag, stale request, unsafe path, alias/hardlink, binary or oversized input releases no content.
- The read terminal cannot start a shell, execute commands, access outside the chosen project or expose raw environment variables.
- UI actions dispatch fixed host commands, support keyboard/focus/high contrast, escape metadata and visibly state unmanaged access limits.

## Complete-contract architecture still required

INFERENCE: a full version must launch the AI tool in an isolated identity/runtime with only an explicitly selected public workspace. Originals, source Git objects, credential stores, caches, debug output and host mounts must be inaccessible. Protected editing belongs in an AI-free trusted editor/compartment; a second profile alone is not an OS boundary. Approved safe content crosses a narrow broker channel. Mandatory routing protects outgoing model/tool requests. Runtime tests must prove denial for the specific supported agent, including child processes and bridges.

The terminal prompt must occur at the protected broker boundary before a denied read can succeed. An event raised after a normal shell has started cannot supply that guarantee. An ordinary editor modal is not independent user presence and is not agent-proof.

## Rollback and remaining limits

Setting `soterai.projectPrivacy.enabled` to false withdraws the new read/review/terminal routes without deleting saved restrictions or restoring project file contents. Existing managed denies remain. The legacy risky original-paste and raw-reveal options return to their previous settings, so disabling this flag can weaken those managed flows when their old overrides are enabled. Commands do not rewrite project files or migrate secrets. Closing the managed terminal revokes its pending requests. Reverting this implementation does not change historical evidence.

UNTESTED: real third-party agents, native terminal interception, deployed OS isolation, source editor buffer privacy, universal detection of unknown private prose, prior exposure/old copies, remote filesystems, binary sensitive formats, mandatory egress, administrator compromise and side channels. Full claim remains BLOCKED; deployment remains DEFERRED.

FACT (UX reference checked 2026-10-11): VS Code publishes extension UX guidance. The implementation follows editor themes, accessible controls and predictable native prompts. This is not a usability study or enterprise certification. https://code.visualstudio.com/api/ux-guidelines/overview

## Operational interruption

INCOMPLETE (initial plan-save attempt): `Automatic approval review failed: Fatal error: Failed to initialize session: thread-store internal error: There is not enough space on the disk. (os error 112)` / `The action was not executed because automatic approval review could not be completed. This is a review failure, not a determination that the action is unsafe. Do not bypass the approval check; resolve the error or ask the user for guidance.`

Read-only inspection confirmed zero available bytes on C:. Four regenerable Node/tsx compile-cache directories in `.tmp/sgv-b7c2c4a09d33` and `.tmp/sgv-dbcf4a036818` were verified inside the workspace, without reparse points, and cleared to resolve the disk condition. Source, reports, evidence and dependency installations were retained. The original plan write was then retried through the same apply_patch tool.
