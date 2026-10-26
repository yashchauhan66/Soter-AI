# SoterAI Lite publishing runbook — owner actions, preparation only

Status on26October2026: **NOT READY TO PUBLISH**. F31a provides offline inventory and a detached SBOM. F26a and other required features, F31b final package work, lifecycle and human/independent gates remain incomplete. No command here authorizes the agent to publish, push, tag, log in, install tools or use credentials.

## Prepare the final object

1. Finish required feature/native/lifecycle gates and original L6 human acceptance. Keep all known unmanaged leaks and unsupported platforms visible. Do not promote mocked, stale or unavailable evidence to supported behavior.
2. Finalize `release-identity.json`: owner-controlled publisher, package name/ID, version, repository and support links. Current local identity `soterai.soterai-ide-guard` is not proof of marketplace ownership. An identity change needs storage/vault migration and renewed tests.
3. Finish F31b: derive README from final README-CLAIMS and supported-tool/version evidence; include full applicable project/third-party notices, privacy statement, changelog and icon. Explain telemetry default, local processing, routed provider traffic, retained ciphertext/metadata, opt-in operations and removal/recovery limits. Record Linux/macOS/remote as NOT_TESTED unless separately accepted.
4. Package a **new uniquely named win32-x64 pre-release VSIX** using the existing local pinned builder. Installed `@vscode/vsce`3.9.2 supports `target` and `preRelease`; F31b must wire the latter explicitly before building. `preview:true` alone does not establish the pre-release channel. Verify the actual VSIX manifest's target and pre-release property, entry hashes and shipped assets. Preserve every older candidate. See the official [VS Code packaging/platform and pre-release guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
5. Generate an SBOM from that exact VSIX and its retained immutable build provenance. F31a inventories the dependencies actually present in bundled source inputs, not every development dependency. Detached output is **not already embedded**: F31b must include the reviewed SBOM/notices in a new final VSIX and rebind/retest its final hash. The early auditor's15-entry allowlist must be explicitly extended and tested for those new shipped documents.

## Offline inventory command

From the repository root, with the existing installed dependencies:

```powershell
node packages/soterai-lite/scripts/audit-release.cjs --vsix <EXACT_VSIX_PATH> --sha256 <LOWERCASE_SHA256> --receipt <IMMUTABLE_BUILD_PROVENANCE_JSON> --out <NEW_WORKSPACE_OUTPUT_DIRECTORY>
```

The output directory's parent must exist; overwrites and linked/outside parents refuse. `release-inventory.json` and `sbom.cdx.json` contain hashes/metadata, not source contents or absolute local paths. Missing/tampered runtime/source inputs, unsupported entries/target and archive bounds fail. Unknown license metadata/notices remain INCOMPLETE. A metadata/notice match is not legal approval or proof every notice already ships. Resolve licensing with the owner and retain the findings; do not silently replace an unknown license.

The tool performs **no network vulnerability audit**. An authorized current advisory/lockfile audit, review of findings and final license/notice reconciliation remain F31b gates. No download or clean-audit assertion is inferred from offline inventory success. The tool always returns `releaseReady:false` and supplies no product protection score.

## Owner-controlled publication

6. After final acceptance, freeze the exact VSIX, manifest, bundled runtimes, catalog, SBOM, claims and review hashes. Recompute the VSIX SHA256 immediately before publication. Any rebuild or post-review code/package change requires fresh affected checks and exact-object review; do not publish a different artifact with an old approval.
7. The owner establishes publisher access and chooses authentication. Use a narrowly scoped publisher credential in the owner's credential store or protected CI secret, or a supported owner-reviewed secure publishing workflow. Never put a token in source, a command argument, terminal history, logs, this chat or evidence. The local vsce CLI supports `VSCE_PAT`; the agent never reads it. Follow the current [Microsoft publisher/authentication instructions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
8. Publish the reviewed **pre-release first** to the VS Code Marketplace, using the exact already packaged win32-x64 object. An owner may use `vsce publish --packagePath <EXACT_FINAL_VSIX>` only after separately authorizing that action and checking the package's pre-release metadata. Do not rely on a publishing command to rebuild an approved object. Retain the registry version/target/channel and compare the served artifact identity before a later stable-channel decision.
9. For Open VSX, the owner reviews registry terms, signs the contributor requirements, establishes account/namespace ownership and uses an already installed, pinned `ovsx` CLI or reviewed publishing workflow. Upload the same accepted targeted pre-release object; record namespace/version/target/channel separately. An owner credential may be supplied through `OVSX_PAT`, or supported trusted publishing may avoid a stored long-lived token. Namespace creation, account actions and publication are separate human actions; no tool installation or login is done here. See [Open VSX publishing](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions) and its [official CLI/trusted publishing instructions](https://github.com/eclipse-openvsx/openvsx/blob/main/cli/README.md).
10. If either registry rejects the package or changes its identity/content, retain the error and stop that publication path. Correct/rebuild/reverify a new unique artifact; do not bypass scans, overwrite evidence or mark the other registry successful by inference. Removing a published release or advancing to stable requires a separate owner decision.

F32 owns isolated install/upgrade/removal checks, including explicit Restore changes before uninstall, policy/ciphertext retention and owned-broker shutdown. No normal-profile installation or automatic secret restoration is authorized by this runbook. The final release remains subject to V01–V05 and original L6 HUMAN-ACTIONS/STOP; L7/final rating require the specified human and independent evidence.
