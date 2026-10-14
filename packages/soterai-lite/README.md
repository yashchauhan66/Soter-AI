# SoterAI Lite

Known project credential paths are excluded automatically from SoterAI-managed readers using 279 distinct filename/path patterns. Eight optional stack presets also withhold configuration families that can contain credentials. Right-click a project folder, choose **SoterAI**, then **Add Stack Protection Preset**, **Import Protection Policy** or **Export Protection Policy**. Native pickers and a metadata diff let you review additions. No admin rights, account or extra installation is required for these local controls.

Policy imports and `.soterai/team-policy.json` can only add denies and sensitive treatment. Export includes accepted manual/imported restrictions, region digests/offsets and sensitive patterns; it never reads source-file contents. Review filenames and other metadata before sharing it. Export requires a new JSON destination inside the chosen project and never overwrites a file.

The machine setting `soterai.lite.versionedPolicy` withdraws new enrollment/import/preset operations while keeping accepted protection. Invalid, oversized or newer schemas withhold managed reads. The same-key v2 storage envelope is rejected by the tested previous schema-aware parser; downgrading those readers makes managed reads unavailable. Keep a current Lite version to read upgraded policy. Expanded defaults apply to the managed boundary; native AI reads and legacy scanner coverage are separate surfaces.

Use the Explorer SoterAI menu to review a manual deny **for this editor session**. Review the exact metadata diff, type the displayed confirmation, wait the 10-second cooldown and confirm the final action. Permanent rules stay saved. Restart, re-blocking a file, workspace changes or protection drift ends the session permission. Imported/team/default protection cannot be removed here. Sensitive protection has a separate review: it retains sensitivity and every protected text region, so approved safe reads still return masked values. Same-user confirmation is not agent-proof.

Startup and 60-second periodic checks compare policy/source fingerprints, selected safety settings and installed extension versions. Alerts contain metadata only. The machine flag `soterai.lite.policyDrift` withdraws monitoring and new owner reviews, revokes session permissions, and retains permanent protection. Review audit is bounded to 64 entries/32KiB and persisted atomically with unchanged policy in strict v3 storage; older schema-aware readers fail closed. A full audit refuses additional reviews rather than truncating history.

Every managed safe read shows the exact safe text in a native approval modal before returning it. Env files show variable names with every value masked; sensitive files show only a masked summary. Saved restrictions remain. Reviews bind the saved file, policy, output and internal destination, with a fixed 60-second deadline that includes initial policy enrollment. Cancel, expiry, revocation or any changed binding returns no text. Safe modal output is limited to 16 KiB; larger output is withheld. This preview creates no plaintext TextDocument before approval. Requester identity is not OS-verified.

The machine setting `soterai.lite.safeConsent` withdraws managed reads and clears owned safe previews; restriction saves continue. Data already returned cannot be recalled. A stale native modal may remain visible after expiry or revocation, but its response grants nothing. Managed terminal text is sanitized before review; terminal framing is separate. These controls do not intercept original files or arbitrary shells.

Local managed secret scanning, file restrictions, approved masked reads, vault
workflows and a bundled loopback AI broker. Existing settings use `soterai.*`.
This local candidate preserves the extension identity and saved vault/policy.

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
