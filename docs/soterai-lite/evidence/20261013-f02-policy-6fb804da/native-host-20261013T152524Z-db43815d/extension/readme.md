# SoterAI Lite

Known project credential paths are excluded automatically from SoterAI-managed readers using 279 distinct filename/path patterns. Eight optional stack presets also withhold configuration families that can contain credentials. Right-click a project folder, choose **SoterAI**, then **Add Stack Protection Preset**, **Import Protection Policy** or **Export Protection Policy**. Native pickers and a metadata diff let you review additions. No admin rights, account or extra installation is required for these local controls.

Policy imports and `.soterai/team-policy.json` can only add denies and sensitive treatment. Export includes accepted manual/imported restrictions, region digests/offsets and sensitive patterns; it never reads source-file contents. Review filenames and other metadata before sharing it. Export requires a new JSON destination inside the chosen project and never overwrites a file.

The machine setting `soterai.lite.versionedPolicy` withdraws new enrollment/import/preset operations while keeping accepted protection. Invalid, oversized or newer schemas withhold managed reads. The same-key v2 storage envelope is rejected by the tested previous schema-aware parser; downgrading those readers makes managed reads unavailable. Keep a current Lite version to read upgraded policy. Expanded defaults apply to the managed boundary; native AI reads and legacy scanner coverage are separate surfaces.

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
