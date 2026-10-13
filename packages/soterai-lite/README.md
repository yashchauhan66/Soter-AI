# SoterAI Lite

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
