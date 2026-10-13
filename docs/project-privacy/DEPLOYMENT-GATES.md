# Independent protection deployment gates

Date: 2026-10-12. Status: design/evidence plan only. Deployment DEFERRED. No account, ACL, VM, OS feature, firewall, driver, hardware or production-agent change is authorized by this document. Full G1-G6 claim BLOCKED.

## Decision and platform basis

**INFERENCE / decision:** retain the Home-compatible two-account/separate-logon-session model as the partial deployment candidate. Retain a separately managed whole-IDE VM with independent controller/egress as the stronger reference. Neither is deployed. The managed extension continues to supply bounded value without presenting these deployment modes as active. Source: [selected local architecture](ENTERPRISE-ARCHITECTURE.md).

**FACT (Microsoft documentation checked 2026-10-12; page updated 2021-01-07):** Windows object access checks compare DACL entries against requesting-token user/group/logon SIDs. Merely using another IDE profile does not change that token. [How AccessCheck works](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object).

**FACT (Microsoft documentation checked 2026-10-12; page updated 2026-05-15):** DPAPI typically permits decryption using the same user's logon credentials on the same computer; machine-scoped protection permits other machine users. [CryptProtectData](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).

**INFERENCE:** user-scoped DPAPI plus inaccessible main-account storage is useful in the separate-account design, but same-user DPAPI alone is not custody from that user's agent. DPAPI scope, entropy/key access and actual token/storage access must be evidenced; no dynamic decryption claim is established here.

**FACT (Microsoft documentation checked 2026-10-12):** WSL is not a security sandbox for untrusted code and shares the launching Windows account's trust level; disabling normal automount/interop workflows does not turn it into one. [WSL security model](https://wsl.dev/technical-documentation/security/).

**FACT (Microsoft documentation checked 2026-10-12; Hyper-V page updated 2025-05-26; Sandbox page updated 2026-03-29):** the supported Hyper-V role and Windows Sandbox do not support Windows Home. A chosen supported managed VM backend/edition must therefore be verified before the whole-IDE VM reference is proposed for actual installation. [Hyper-V requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/install-hyper-v), [Sandbox editions](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/).

## Gate A: reviewable approval before machine changes

**INFERENCE / required approval:** preserve the owner's explicit prohibition on account/VM/firewall/driver/hardware changes. Before any account creation, ACL edit or firewall configuration, present the exact affected accounts/SIDs, directories and parent ACLs, proposed rules, existing-state backups, administrative requirements and rollback procedure. Obtain explicit authorization for that concrete change. Inspection is read-only and must not expose token/secret values. Creating a public snapshot is not permission to change account authority.

**INFERENCE / gate assertions:** the approved plan names the primary trusted account, separate nonadministrator agent account, separate logon session, public workspace location and protected stores; lists existing groups/inheritance; excludes admin membership and main-account credentials from agent use; documents who owns recovery. No active-mode badge is shown before evidence gates pass.

## Gate B: Windows Home partial model prerequisites

All rows are **INFERENCE / design prerequisites and expected results**, not existing security results.

| Area | Prerequisite | Expected evidence assertion |
|---|---|---|
| Account and whole workload | Separate standard agent account and separate interactive logon session; all AI IDE/UI, shells, browser/MCP helpers and descendants enrolled | Actual process/token records identify that SID/session/launch. An ordinary native agent under the main account is explicitly uncovered. |
| Protected originals/storage | Main-account-owned secrets, policy, approvals, broker tokens and state; restricted parent/file DACLs with reviewed inheritance and group grants | Agent identity gets access denied to exact protected files, token files and parent stores; a public positive control remains usable. Do not read/print credential contents. |
| Public project view | Deliberately reviewed saved-file publication, no original `.git` objects, credential stores, recovery data or original secret mounts | Agent sees only manifest-listed public content plus synthetic fixtures; original denied paths remain absent/inaccessible. Unknown prose still requires owner review. |
| Trusted editing | Main account edits private implementations/original configuration in its own editor/session | Protected buffer/clipboard/screenshots are not exposed to the agent session through configured bridges. Shared desktop automation/clipboard transport must be tested independently. |
| DPAPI and provider credentials | Main-account user-scoped custody and inaccessible persisted stores; no main-account token, SSH-agent, Git-helper or credential forwarding | Agent cannot retrieve the chosen secret through permitted product APIs/files; provider connection uses an approved broker route rather than inherited owner credentials. Source/API review alone is not a dynamic result. |
| Policy/controller | Agent has no write/delete/sign authority over effective policy, keys, approval records or controller configuration | Exact deny persists across supported restarts and prevents unauthorized relaxation; malformed/missing/old state withholds protected release. Same-user state in the current extension is insufficient. |
| Network | Independently enforced per-account/workload routes with supported Windows Home behaviour verified, covering delegates and protocols | Unapproved destinations deny; approved public dependencies/development routes work; outage/revocation prevents new mediated releases. Rules cannot be inferred from a UI toggle or process name. |
| Development usability | Framework-specific synthetic configuration, fixtures and disposable services in the public compartment | Representative code/search/edit/build/test/preview flow completes with no extra privacy prompts after reviewed setup. Current fixed mock does not prove application parity. |

**INFERENCE / limits:** a separate account/session is a partial same-machine boundary, not resistance to administrator/kernel compromise, vulnerable privileged services or all side channels. Shared folders, redirection and credential bridges can defeat separation. Per-account network rule behaviour and workload identification require exact Windows/Home topology evidence; this document does not claim generic executable firewall rules supply per-user confinement.

## Gate C: stronger whole-IDE VM reference prerequisites

**INFERENCE / prerequisites:** select a supported, patched VM backend and host configuration without unsupported Home workarounds. Keep the complete AI IDE/UI and all delegates inside the guest. Mount only the reviewed public workspace; disable/restrict shared host folders, clipboard, drive/device redirection and credential bridges according to the chosen backend. Keep controller, policy keys, provider credentials and egress enforcement outside guest/agent authority. Independently identify guest/workload/launch/session; do not accept process names or caller strings as enrollment proof.

**INFERENCE / evidence assertions:** exact protected host paths are inaccessible to the guest workload; every relevant network path is subject to the approved gateway; a public dependency/code/test control succeeds; broker outage, stale identity, wrong revision/destination, revocation and expiry yield no new protected release. Guest snapshots, helper tools and alternate native launches cannot be silently labelled enrolled. Host/admin compromise, hypervisor escape, deliberately shared content and side channels remain explicit limits.

## Gate D: consent and fixed real-service operations

**INFERENCE / prerequisites:** use an independently protected review surface and authority. Agent requests produce pending records; they do not open/auto-approve a presence ceremony. The owner independently reviews the exact content/item, policy/content revisions, workload/launch/session, action, output class, destination, lifetime and maximum uses. No global original-secret-read approval is offered. Approval automation resistance needs its own proof; a native editor modal is expressly insufficient.

**INFERENCE / broker assertions:** grant issuance and execution use authoritative identity/approval/state; wrong recipient, launch/session, revision, destination, output class, expiry, replay and withdrawal deny. Fixed reviewed operations return only approved bounded public fields. Arbitrary shell/SQL/HTTP proxies and AI-controlled applications receive no real credentials. Logs, browser responses, screenshots, rows and error text pass the same release checks. Merely masking terminal output does not make real-secret injection safe.

**FACT (local source inspected 2026-10-12):** the I6 core implements only process-local metadata checks against a required adapter and no dispatcher/transport/signing service. It must not be used as evidence that these deployment prerequisites are satisfied. [I6 notes](ENTERPRISE-I6-PROTOCOL-NOTES.md).

## Gate E: egress, policy continuity and revocation

**INFERENCE / assertions:** demonstrate the effective identity-aware boundary for applicable IPv4/IPv6, DNS, direct-IP, browsers, helper processes and MCP/remote delegates. An allowed destination never implies protected-content permission. Independently owned rules and credentials survive supported restart/update; old/missing/invalid policy or evidence fails closed rather than launching native fallback. Public coding can continue while an unrelated restricted capability waits.

**INFERENCE / revocation semantics:** serialize revocation before subsequent protected-release commits; cancel pending grants and acknowledge running-operation drain. Show revocation pending until the actual authority/runner acknowledges. Previously released data cannot be recalled. Test controller restart and anti-rollback/durable replay state before claiming continuity; local UUID references or locally editable reports do not establish it.

## Gate F: release evidence and truthful product UI

**INFERENCE / required evidence record:** retain expected and observed results, actual working positive controls, source/loaded/package hashes, exact Windows/editor/Cline/backend versions, effective account/group/session/launch identity, policy/content revisions, test scope, skip/failure reasons and report time. Preserve A0 and preceding reports. Use only subsequently authorized verification; this plan supplies no probe, exploit or reproduction code.

**INFERENCE / UI assertions:** display mode, prerequisites, loaded/report/installed hash status, scoped PASS/FAIL/SKIP/NOT_TESTED/UNMANAGED and exact limits before any success acknowledgement. Editing a packaged local report cannot promote independent-route enforcement. Disabled, mismatched, unavailable or stale effective-state evidence must remove active protection claims while retaining honest historical results.

**FACT (local evidence inspected 2026-10-12):** current real-host results still confirm nine synthetic leaks and explicitly leave real Cline/model and OS isolation unverified. [Final local report](FINAL-LOCAL-REPORT.md), [comparison](evidence/20261012-final-local/host-comparison.json), [packaged verification](../../packages/vscode-extension/verification/project-privacy-verification.json).

## Rollback and unresolved verification

**INFERENCE / deployment rollback requirement:** back up approved machine state before changes. Stop new capability issuance/publication, cancel/drain active capabilities, preserve authoritative policy and originals, and restore only the explicitly backed-up account/ACL/network/backend configuration. Never automatically expose originals or start an unenrolled native agent when isolation fails. Retain released copies as disclosures rather than claiming they can be revoked remotely.

**FACT / NOT_TESTED (local scope, 2026-10-12):** no independent account/session/VM/egress deployment, authentic workload transport, independent presence, durable policy custody, real-service dispatcher, framework-specific application/database runtime, cross-platform boundary, administrator-compromise or side-channel verification is completed. Skipped symlink controls and parent-directory swap resistance remain untested. Sources: [local report](FINAL-LOCAL-REPORT.md), [architecture](ENTERPRISE-ARCHITECTURE.md).

**INFERENCE / completion rule:** only the concrete partial model's demonstrated controls may receive a partial coverage claim after explicit deployment authorization and successful scoped evidence. Full G1-G6 stays BLOCKED until all applicable full-reference acceptance gates are independently supported. Local implementation/test completion is not enterprise certification or permission to deploy.
