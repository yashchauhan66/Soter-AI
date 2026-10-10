# Phase 3 source notes and provenance

**INFERENCE — Convention, 2026-10-09.** FACT paragraphs describe primary documentation with direct URL and access date. INFERENCE paragraphs specify design judgments or interpretation of supplied evidence. SPECULATION marks unmeasured possibilities. No documentation fact proves this installation's controls.

## Primary facts used for the design

**FACT — S01; accessed 2026-10-09.** VS Code profiles group settings, extensions and customizations stored under user configuration. [Profiles](https://code.visualstudio.com/docs/configure/profiles).

**FACT — S02; accessed 2026-10-09.** Remote development can retain local Node, web and remote extension hosts; installation, capabilities and extensionKind affect placement. [Extension hosts](https://code.visualstudio.com/api/advanced-topics/extension-host).

**FACT — S03; accessed 2026-10-09.** VS Code APIs expose known documents/content, tabs and system clipboard operations; closing a tab need not dispose its document. [VS Code API](https://code.visualstudio.com/api/references/vscode-api).

**FACT — S04; accessed 2026-10-09.** Dev Containers can bind-mount the local workspace and share local credential helpers/SSH-agent access; its guidance also describes copying local Git configuration. [Source mount](https://code.visualstudio.com/remote/advancedcontainers/change-default-source-mount), [Git credential sharing](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials).

**FACT — S05; accessed 2026-10-09.** Windows controls process memory-read rights through process security descriptors; window-station rights include clipboard/screen access, and desktop rights include hooks and switching. [Process security](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights), [Window-station security](https://learn.microsoft.com/en-us/windows/win32/winstation/window-station-security-and-access-rights), [Desktop security](https://learn.microsoft.com/en-us/windows/win32/winstation/desktop-security-and-access-rights).

**FACT — S06; accessed 2026-10-09.** Windows supports switching logged-on accounts while applications remain running. [Fast User Switching](https://learn.microsoft.com/en-us/windows/win32/shell/fast-user-switching).

**FACT — S07; accessed 2026-10-09.** Hyper-V Enhanced Session Mode supports redirecting resources including clipboard, drives and devices; Hyper-V administration is controlled through delegated/administrative rights. [Resource sharing](https://learn.microsoft.com/en-ie/windows-server/virtualization/hyper-v/enhanced-session-mode), [Remote management](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/remotely-manage-hyper-v-hosts).

**FACT — S08; accessed 2026-10-09.** Microsoft lists Windows 11 Professional/Enterprise and hardware virtualization requirements for Hyper-V. [Hyper-V requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements).

**FACT — S09; accessed 2026-10-09.** Windows Hello supports application challenge signing and PIN/biometric interaction, with software fallback when hardware protection is unavailable. UserConsentVerifier instead returns a verification result. [Windows Hello](https://learn.microsoft.com/en-us/windows/apps/develop/security/windows-hello), [RequestSignAsync](https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.keycredential.requestsignasync), [UserConsentVerifier](https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.requestverificationasync).

**FACT — S10; accessed 2026-10-09.** WebAuthn distinguishes user presence from user verification; FIDO's transaction-confirmation paper distinguishes generic authentication from approval of displayed transaction details. [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/), [FIDO paper, published August 2020](https://fidoalliance.org/wp-content/uploads/2020/08/FIDO-Alliance-Transaction-Confirmation-White-Paper-08-18-DM.pdf).

**FACT — S11; accessed 2026-10-09.** Microsoft describes UAC secure-desktop consent for elevation. That flow concerns elevation authorization. [How UAC works](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works).

**FACT — S12; accessed 2026-10-09.** Windows service security descriptors separately control stopping/configuration/deletion; Microsoft warns about untrusted configuration/stop rights. [Service security](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights).

**FACT — S13; accessed 2026-10-09.** NIST distinguishes signature authenticity/integrity from confidentiality and replay protection. [Digital signature](https://csrc.nist.gov/glossary/term/digital_signature).

**FACT — S14; accessed 2026-10-09.** Libvirt supports granular client/object/operation authorization; its documented default access-control driver performs no such additional checks. [Libvirt client access control](https://libvirt.org/acl.html).

**INFERENCE — Further source basis.** The supplied Phase 2 research R01–R33 remains the basis for DPAPI/SecretStorage, WFP, AppContainer, Linux/macOS mechanisms, storage views, VM/container ownership, Git helper authority, standards and reviewed advisories. No advisory is treated as proof that this repository has its vulnerability.

**INFERENCE — Consent interpretation.** None of S09–S11 proves that a custom same-session dialog has a trustworthy transaction display or cannot be activated by an adversarial process. The selected C component therefore has an explicit contract and INCOMPLETE device/firmware feasibility gate. The design does not claim UAC's secure desktop can host an arbitrary custom consent interface.

## Input record

**INFERENCE — Provenance.** The files below were read before design. These measured SHA-256 identifiers record local inputs, not independently protected audit or validation of their conclusions. Phase 2 remains in its supplied Temp directory; Phase 0 inputs remain in the repository.

| Input | SHA-256 |
|---|---|
| PHASE3_KICKOFF.md | **INFERENCE:** 307264adf474c1b8129df64db2c73732dfe9da94e9d63dde719618f9137366d0 |
| research.md | **INFERENCE:** 43f915cee3adeb56e628685e05539e207c3547778ec0af12bf91dc582ea4220e |
| mechanism-matrix.md | **INFERENCE:** bd4929c335ce71c4018af7f85f013d319589da647104f40aea0f67b11f354d5a |
| candidate-architectures.md | **INFERENCE:** c146b1d3b30c605129ec9e03c05f5e0b9bbc686568d6555d8f1005121d6d0b3b |
| open-questions.md | **INFERENCE:** 6070e2acadb2d40f1b47fb8e99cb53e4bdb8d9843673858d96ca3c571adfb173 |
| phase0/open-issues.json | **INFERENCE:** 9ce02822ab25fabb4ad6865b9e4c2f3e229cc0cbce36df048ba3a054d2e4d4fd |
| phase0/guarantee-spec.md | **INFERENCE:** e8f74544327c3803933b01f68e8022c013a90d95851757bd8d82b0a6a356c28e |

**INFERENCE — Supplied baseline retained.** The reported Windows auth-token inherited CodexSandboxUsers read and same-user full control, auth.ts win32 omission, uninspected control-auth-token/directory ACLs, static-only F16/storage question and missing current-bundle live result remain open. DPAPI backend guidance supports a same-user concern; it does not reproduce decryption of this installation.

**INFERENCE — Evidence age.** Only Oct 8 bundle evidence is accepted as completed native evidence. Phase 3 performs no new runtime inspection or baseline run. Hardware, OS edition, membership, keys, ACLs and platform support remain unverified.

**INFERENCE — Filter accounting.** No Phase 3 read-only/design request encountered a safety-filter rejection. The earlier Phase 1 auth task remains INCOMPLETE. Its exact supplied message is retained below without retry or reformulation.

> This content was flagged for possible cybersecurity risk. If this seems wrong, try rephrasing your request. If you’re doing authorized security work that requires more cyber permissive safeguards, apply for Daybreak access via https://platform.openai.com/settings/organization/status-and-access before retrying.

**INFERENCE — Handling rule.** Any future rejection is recorded verbatim as INCOMPLETE; unaffected authorized design work continues without reformulation around the restriction.
