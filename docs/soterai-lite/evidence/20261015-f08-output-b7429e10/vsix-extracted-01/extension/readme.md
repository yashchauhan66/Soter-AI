# SoterAI Lite

Known project credential paths are excluded automatically from SoterAI-managed readers using 279 distinct filename/path patterns. Eight optional stack presets also withhold configuration families that can contain credentials. Right-click a project folder, choose **SoterAI**, then **Add Stack Protection Preset**, **Import Protection Policy** or **Export Protection Policy**. Native pickers and a metadata diff let you review additions. No admin rights, account or extra installation is required for these local controls.

Policy imports and `.soterai/team-policy.json` can only add denies and sensitive treatment. Export includes accepted manual/imported restrictions, region digests/offsets and sensitive patterns; it never reads source-file contents. Review filenames and other metadata before sharing it. Export requires a new JSON destination inside the chosen project and never overwrites a file.

The machine setting `soterai.lite.versionedPolicy` withdraws new enrollment/import/preset operations while keeping accepted protection. Invalid, oversized or newer schemas withhold managed reads. The same-key v2 storage envelope is rejected by the tested previous schema-aware parser; downgrading those readers makes managed reads unavailable. Keep a current Lite version to read upgraded policy. Expanded defaults apply to the managed boundary; native AI reads and legacy scanner coverage are separate surfaces.

Use the Explorer SoterAI menu to review a manual deny **for this editor session**. Review the exact metadata diff, type the displayed confirmation, wait the 10-second cooldown and confirm the final action. Permanent rules stay saved. Restart, re-blocking a file, workspace changes or protection drift ends the session permission. Imported/team/default protection cannot be removed here. Sensitive protection has a separate review: it retains sensitivity and every protected text region, so approved safe reads still return masked values. Same-user confirmation is not agent-proof.

Startup and 60-second periodic checks compare policy/source fingerprints, selected safety settings and installed extension versions. Alerts contain metadata only. The machine flag `soterai.lite.policyDrift` withdraws monitoring and new owner reviews, revokes session permissions, and retains permanent protection. Review audit is bounded to 64 entries/32KiB and persisted atomically with unchanged policy in strict v3 storage; older schema-aware readers fail closed. A full audit refuses additional reviews rather than truncating history.

Every managed safe read shows the exact safe text in a native approval modal before returning it. Env files show variable names with every value masked; sensitive files show only a masked summary. Saved restrictions remain. Reviews bind the saved file, policy, output and internal destination, with a fixed 60-second deadline that includes initial policy enrollment. Cancel, expiry, revocation or any changed binding returns no text. Safe modal output is limited to 16 KiB; larger output is withheld. This preview creates no plaintext TextDocument before approval. Requester identity is not OS-verified.

The machine setting `soterai.lite.safeConsent` withdraws managed reads and clears owned safe previews; restriction saves continue. Data already returned cannot be recalled. A stale native modal may remain visible after expiry or revocation, but its response grants nothing. Managed terminal text is sanitized before review; terminal framing is separate. These controls do not intercept original files or arbitrary shells.

Right-click a sensitive project file and choose **SoterAI → Open Masked Owner Editor**. Environment fields start masked, including in split views. Revealing one value requires native confirmation and hides after 10 seconds or a protection/view change. Change values through an empty password input; normal editor Save and Undo/Redo operate on the private custom document. Original content is never opened as a TextDocument by this editor. A separate plaintext opening shows a warning; it is still accessible to other extensions and direct filesystem tools.

Editing requires verified VS Code SecretStorage and encrypted recovery in this extension's workspace storage. Failed or conflicting saves retain the private draft; reopening offers a reviewed encrypted draft without automatically rewriting the original. Partial in-place writes can require this recovery and a separate confirmation to save it. There is no plaintext recovery fallback. Save As requires a new sensitive environment path in the same project. Native editor associations are optional: run **Use Masked Editor for Project Environments**, review the settings diff and approve. **Restore Project Editor Associations** preserves unrelated mappings and refuses changed owned mappings. The machine setting `soterai.lite.secureEditor` hides reveals and withholds editor operations while preserving saved restrictions.

Vault migration is optional: right-click a project file and choose **Migrate Secrets to Vault**. Review the names, masked values and proposed permanent sensitive deny. Verified SecretStorage and encrypted recovery outside the project are required before originals are replaced by unique placeholders. Environment examples contain names with empty values, without copied comments or multiline contents; existing conflicting examples are preserved. Applications reading the migrated file receive placeholders, so review the application's secret setup before migrating.

Use **Complete Safe Vault Recovery** after an interrupted migration to finish the masked outcome. Unexpected external edits are withheld. If a partial write damaged the source, **Restore File From Backup** requires a separate disclosure warning before restoring its bound encrypted original; it never runs automatically. Raw restoration makes those values readable in the project again. Saved restrictions and ciphertext remain when `soterai.lite.vaultMode` is off. SecretStorage API availability does not certify OS custody or protection from same-user software. Legacy unbound entries remain encrypted and are withheld from restoration.

Local managed secret scanning, file restrictions, approved masked reads, vault
workflows and a bundled loopback AI broker. Existing settings use `soterai.*`.
This local candidate preserves the extension identity and saved vault/policy.

Managed capability responses recognize registered values in raw, base64/base64url, hex, URL and JSON forms, including ordered string values split inside one response. Matching preserves exact case and Unicode. Short values match complete parts; matching never joins separate requests or decodes arbitrary nested encodings. Provider rules and credential-context entropy add recognition for unregistered values. Input, registry, decoded-view, match and work limits withhold incomplete responses. The machine setting `soterai.lite.secretMatching` withdraws these managed responses while saved restrictions and masking remain active. **Test Protection** runs synthetic in-process checks without a network call; its result does not certify external AI routes. Streaming terminal and gateway coverage require their separate adapters.

Managed result filtering accepts UTF-8 chunks, removes supported color/OSC sequences, normalizes CRLF and recognizes values across chunks and the operation's output channels. It buffers up to 128 KiB combined and releases a completed plain-text result after final flush. It does not display live undecided output. Secret-bearing operations mask every nonempty channel; invalid, oversized or incomplete output is withheld. Cursor-editing controls are unsupported. The machine setting `soterai.lite.outputRedactor` withdraws these managed results while existing restrictions remain. **Test Protection** includes synthetic chunk/ANSI/final-flush checks; native shell adapters and independent uploads have separate coverage.

Manual restrictions report saved, failed, cancelled or unavailable explicitly.
Pending saves withhold affected managed reads while unrelated public files stay
usable. Changing the chosen workspace during a save prevents a success claim.
The machine setting `soterai.lite.restrictionSave` withdraws new manual saves
when disabled; accepted restrictions and existing masking remain in effect.

Lite reduces accidental project-secret exposure through supported cooperative
AI routes. Arbitrary same-user processes and AI tools using original filesystem
reads or independent traffic can bypass these extension-level controls. Native
Windows shell monitoring does not provide universal pre-read enforcement.

Install the VSIX locally to use the bundled extension, broker and MCP server;
no controller, VM, admin rights or extra runtime installation is required.
Tool routing and vault migration require reviewed, explicit opt-in changes.
Tool-specific coverage, onboarding timing and release readiness are UNVERIFIED
for this candidate until its exact-object tests pass. This artifact is not
published. Linux, macOS and remote workspaces are NOT_TESTED.
