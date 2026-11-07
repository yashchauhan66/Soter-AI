# Native07 trust failure review

Observed 6 November 2026. Read-only review; no native launch, signal, profile edit, or frozen-fixture modification.

The actual failure was an unwitnessed trust transition before the renderer attached. A development-host trust bypass is not established by the installed vendor source or the retained observations.

| Retained event | UTC |
| --- | --- |
| Code owned start | 09:03:11.787 |
| Observer trust-before: `isTrusted: false`, `windowFocused: true` | 09:03:21.225 |
| Listener custody owned close | 09:03:42.460 |
| Renderer owned start | 09:03:47.437 |
| Renderer first snapshot: no visible trust dialog | 09:03:48.769 |
| Observer failure: `isTrusted: true` | 09:04:51.260 |
| Code actual exit 0 and both EOF | 09:04:52.333 |

These files are under `D:/SoterAI-Lite-test-profiles/f32-installed-20261106T083325Z-d6c2d46d/profile-primary/F32Gate/primary/`. The observer failed waiting for `primary-trust-choice.json`; the renderer failed waiting for the initial native trust dialog.

The isolated profile's `.vscode-shared/sharedStorage/state.vscdb` and its backup both retain `content.trust.model.key` with one trusted URI: the **parent run directory** `file:///d%3A/SoterAI-Lite-test-profiles/f32-installed-20261106T083325Z-d6c2d46d`. This was read as fixed metadata from the closed test profile. No normal profile was inspected.

Installed VS Code 1.145.1 source, `6bab64e2d1/resources/app/out/vs/workbench/workbench.desktop.main.js`:

- `calculateWorkspaceTrust` / `doGetUriTrustInfo` use enablement, canonical workspace URIs, remote/virtual-resource trust, and stored trusted URI ancestors. They do not contain a development-host auto-trust branch (decoded character offsets 4541690 and 4542980).
- `showModalOnStart` returns when the workspace is already trusted and otherwise requests the startup dialog subject to normal workspace/startup-setting checks. It does not test development-host status (offset 20136217).
- The startup trust dialog's checked parent-folder branch calls `setParentFolderTrust(true)`; the unchecked branch calls `completeWorkspaceTrustRequest(true)` (offset 20135877). The retained parent trust is consistent with the former, but there is no retained evidence identifying the actor.
- `skipDialogs` requires both `isExtensionDevelopment` and `extensionTestsLocationURI` (offset 20655377). Native07 passed `--extensionDevelopmentPath`, but no `--extensionTestsPath`.

Recommended next step: retain the failed run and actual close receipts; preserve real trust UI assertions; avoid changing observer installation mode without supporting evidence. Add timestamped trust-transition diagnostics and fail fast if a fresh workspace becomes trusted before the renderer's own keyboard receipt. A subsequent isolated run can establish whether this repeats while renderer observation is present. Do not credit the unobserved trust grant as a successful native keyboard assertion.

Separate latent race remains: successful short observer phases close the owned window immediately after writing observer-results, while the renderer is attached only after custody. The proposed completion acknowledgment prevents a close before the renderer reads and acknowledges the results. It adds no acceptance observation and must preserve 44 unique assertions, 59 phase observations, and eight owned windows.
