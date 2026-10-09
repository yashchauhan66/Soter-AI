# Phase 2 defensive research

**INFERENCE — Scope, 2026-10-09.** This is a documentary survey for G1–G6 under the supplied same-user adversary model. It proposes controls for later design review; it does not establish implementation, successful remediation or security certification. The authorized deliverables are outside the repository. Phase 3 remains pending.

**INFERENCE — Claim convention.** FACT identifies a statement verified against a primary source, with its direct URL and access date beside the statement. INFERENCE identifies a conclusion, recommendation or interpretation, including interpretation of supplied local evidence. SPECULATION identifies an unverified possibility. Access dates are 2026-10-09; a publication/update date is included only when established. Current documentation is not assumed to describe every historical deployed version.

## Supplied baseline and provenance

**INFERENCE — Local evidence basis.** The baseline below is accepted from the supplied [Phase 1 summary](C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/docs/secretguard/guarantee-program-2026-10-09/phase1/phase1-summary.md), [handoff](C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/docs/secretguard/guarantee-program-2026-10-09/phase1/phase1-handoff.json), and [Phase 0 issue ledger](C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/docs/secretguard/guarantee-program-2026-10-09/phase0/open-issues.json), read before research. These local observations are carried forward as attributed evidence, rather than presented as independently verified vendor facts.

| Carry-over | Assessment |
|---|---|
| Windows broker credential authority | **INFERENCE:** The supplied finding reports inherited read access for CodexSandboxUsers and full control for the same OS user on auth-token, with permission checks skipped on win32 in auth.ts. Accept this as an unresolved authority-separation concern. It does not show that every sandbox token can read the file. |
| Uninspected ACLs | **INFERENCE:** control-auth-token and the broker directory ACLs remain INCOMPLETE. A source/profile ACL review must not be treated as inspection of those objects. No credential contents or additional ACLs were inspected in this survey. |
| SecretStorage | **INFERENCE:** The Windows same-user concern is supported by R03–R05 below, with narrower wording than “bound to one session.” Actual decryption of this installation remains static review only, not dynamically reproduced. |
| F16 | **INFERENCE:** F16 remains static review only, not dynamically reproduced. Inherited execution environment and executable/configuration authority are hardening concerns; R26–R28 do not establish a specific invocation outcome. |
| Live baseline | **INFERENCE:** Fresh-bundle live evidence remains INCOMPLETE. Only Oct 8 bundle evidence is accepted as completed native evidence. Managed checks and unsuccessful later host launches do not replace that result. |
| Completion labels | **INFERENCE:** Phase 1 administrative completion and a passing harness are different from passing confidentiality guarantees. Reported managed failures and bounded positive controls retain their original limitations. |

**INFERENCE — Hash provenance.** The handoff identifies the current extension bundle as SHA-256 81b84b4efd02d30f397d39978be59ba10664982f8e6f3a9173dd35568ba3bb09 and the already-built host check as 5fa842010e3d7cea7725f8953ddcf63c17773d00efc33ee922df8f56404b1eea. These are carried-over identifiers, not a claim of a new run or independently rehashed production inputs.

## Editor and secret-storage boundaries

**FACT — R01; accessed 2026-10-09.** VS Code documents that its extension host has VS Code's permissions, including filesystem access, network requests and launching external processes. [VS Code extension runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security).

**FACT — R02; accessed 2026-10-09.** VS Code explicitly warns that Workspace Trust cannot prevent a malicious extension from executing code and ignoring Restricted Mode. [Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust).

**INFERENCE — R01/R02.** Extension previews, command interception, environment routing, Workspace Trust and model instructions can reduce cooperative exposure. They do not remove the authority of malicious host-side code under T. Isolating only a terminal while an untrusted extension can still access protected buffers leaves G1 unresolved.

**FACT — R03; accessed 2026-10-09.** VS Code documents desktop SecretStorage as using Electron safeStorage; the web implementation uses Double Key Encryption. Secrets are not synchronized across machines. [VS Code Common Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities).

**FACT — R04; updated 2026-05-15; accessed 2026-10-09.** Microsoft describes user-scoped DPAPI decryption as usually requiring the same logon credentials and computer, with roaming-profile qualifications. Optional entropy must be available for decryption when used; machine-scoped protection permits other users on that computer to decrypt. [CryptProtectData](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).

**FACT — R05; accessed 2026-10-09.** Electron states that Windows safeStorage uses DPAPI and does not protect from other applications in the same userspace. Its macOS and Linux providers have different semantics; Linux basic_text lacks meaningful secret protection. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

**INFERENCE — R03–R05.** Desktop SecretStorage is not sufficient authority separation against the Windows same-user adversary. This supports the likelihood concern at the backend level without establishing access to a particular ciphertext, every necessary input, or successful decryption. Encryption at rest and separation from adversarial processes must be assessed separately.

## Windows controls

**FACT — R06; accessed 2026-10-09.** Windows evaluates DACL permissions against access-token identities. File rights include modification of security descriptors and ownership. [Access control lists](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-control-lists), [File security and access rights](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights).

**FACT — R07; updated 2025-07-08; accessed 2026-10-09.** AppContainer provides application/user identity, resource restrictions and network capability controls. Microsoft also documents available keyboard/mouse resources and less restricted read-only file access. [AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation).

**FACT — R08; updated 2021-01-07; accessed 2026-10-09.** Windows separately authorizes service configuration, stopping and deletion; Microsoft warns against granting untrusted users rights that interfere with service execution. [Service security and access rights](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights).

**FACT — R09; accessed 2026-10-09.** WFP's Application Layer Enforcement performs kernel-mode stateful network authorization and can classify application/user identity. WFP management objects have access controls; dynamic-session objects disappear with the session, while persistent objects remain until deletion, subject to activation conditions. [ALE](https://learn.microsoft.com/en-us/windows/win32/fwp/application-layer-enforcement--ale-), [Access control](https://learn.microsoft.com/en-us/windows/win32/fwp/access-control), [Object management](https://learn.microsoft.com/en-us/windows/win32/fwp/object-management).

**FACT — R10; accessed 2026-10-09.** Windows Hello supports signing data after PIN/biometric user interaction without exposing the private key; hardware protection is not universal because software fallback exists. [Windows Hello](https://learn.microsoft.com/en-us/windows/apps/develop/security/windows-hello), [RequestSignAsync](https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.keycredential.requestsignasync).

**INFERENCE — R06–R10.** A separately authorized controller/service, restricted agent identity and mandatory protected network policy are complementary candidates. Removing a broad group ACE can reduce exposure, but same-user full control and same-user plaintext access remain distinct issues. Hello signing alone does not prove that the user authorized the correct transaction or that all alternative approval paths are denied.

## Linux and macOS controls

**FACT — R11; documentation dated August 2026; accessed 2026-10-09.** Landlock applies irreversible restrictions inherited by subsequent children. Coverage depends on ABI and chosen rights: current docs describe TCP from ABI 4, UDP from ABI 10 and thread synchronization from ABI 8. Network rules concern ports; already-open files have documented limitations. [Linux Landlock](https://docs.kernel.org/userspace-api/landlock.html).

**FACT — R12; accessed 2026-10-09.** Linux documentation explicitly states that seccomp syscall filtering is not a complete sandbox. [Seccomp filtering](https://docs.kernel.org/userspace-api/seccomp_filter.html).

**FACT — R13; accessed 2026-10-09.** Bubblewrap supplies namespace-based sandbox construction, with optional seccomp; maintainers state that the caller's configuration defines the protection and security model. [Maintainer README](https://github.com/containers/bubblewrap/blob/main/README.md), [Security policy](https://github.com/containers/bubblewrap/security).

**INFERENCE — R11–R13.** These controls can constrain a managed process tree despite nominal same-user identity. They do not automatically confine unrelated existing host processes. Required ABI coverage, inherited descriptors, launcher authority and destination policy need explicit design; syscall or port filtering alone is insufficient for a destination allowlist.

**FACT — R14; accessed 2026-10-09.** Apple describes App Sandbox as restricting file, network and hardware access; sandboxed applications lack unrestricted home-directory access. [Apple App Sandbox](https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox).

**FACT — R15; archived documentation; accessed 2026-10-09.** Apple's entitlement reference describes sandbox inheritance for child processes and distinguishes static entitlements from rights acquired after launch. [Sandbox inheritance](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html).

**FACT — R16; accessed 2026-10-09.** Apple documents per-item Keychain application access controls and a userPresence constraint using biometry or passcode. [Keychain application access](https://support.apple.com/en-gb/guide/mac-help/kychn002/26/mac/26), [userPresence](https://developer.apple.com/documentation/security/secaccesscontrolcreateflags/userpresence).

**FACT — R17; accessed 2026-10-09.** Apple documents Secure Enclave private-key generation inside supported hardware without plaintext key import/export through the described mechanism. [Protecting keys with the Secure Enclave](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave).

**INFERENCE — R14–R17.** Signed application/helper boundaries and carefully configured Keychain items are candidates, not proof of current extension coverage. Same-user Keychain behavior must not be generalized from Windows DPAPI. Hardware protection of signing keys does not automatically protect arbitrary secret plaintext after release.

## Filesystem presentation, containers and VMs

**FACT — R18; accessed 2026-10-09.** ProjFS projects backing-store data into a filesystem hierarchy through a user-mode provider. [Microsoft ProjFS](https://learn.microsoft.com/en-us/windows/win32/projfs/projected-file-system).

**INFERENCE — R18.** A sanitized view, including a FUSE-like presentation, contributes only if agent authority cannot also reach the originals. Hiding paths and making secret-bearing mounts read-only do not make their bytes confidential.

**FACT — R19; accessed 2026-10-09.** Docker bind mounts expose host paths and are writable by default; Docker Desktop can share native host paths into its Linux VM/container environment. [Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).

**FACT — R20; accessed 2026-10-09.** Docker warns that only trusted users should control its daemon because it controls host-resource sharing. Its documentation distinguishes cgroup resource limiting from data-access isolation; rootless mode runs daemon and containers without host root authority. [Engine security](https://docs.docker.com/engine/security/), [Rootless mode](https://docs.docker.com/engine/security/rootless/).

**FACT — R21; accessed 2026-10-09.** Docker documents weaker ECI authority separation on WSL, including user access to the Desktop VM and lack of a dedicated kernel, plus workload/version limitations. [ECI limitations](https://docs.docker.com/desktop/enterprise/hardened-desktop/enhanced-container-isolation/limitations/).

**FACT — R22; updated 2026-01-21; accessed 2026-10-09.** Hyper-V isolates operating systems in hypervisor-supported partitions; its parent partition holds virtualization-management authority. [Hyper-V architecture](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/architecture).

**FACT — R23; updated 2026-03-29; accessed 2026-10-09.** Windows Sandbox defaults include networking and clipboard redirection; mapped folders expose host resources, and configuration controls those sharing features. [Windows Sandbox configuration](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file).

**INFERENCE — R19–R23.** VM/container candidates require separately protected management authority and a curated data boundary. Default VM/container installation, rootless operation, WSL membership or a read-only mount is not sufficient evidence for G1–G6.

## Standards, application controls and advisories

**FACT — R24; published August 2020; accessed 2026-10-09.** NIST SP 800-207 rejects implicit trust based on location/ownership and separates authentication, authorization and enforcement for resource access. [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final), [Primary publication](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf).

**FACT — R25; 2025 edition; accessed 2026-10-09.** OWASP recommends least privilege, separation of untrusted content and independent approval to reduce prompt-injection and excessive-agency risks, while acknowledging prevention limits. [LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [LLM06](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).

**FACT — R26; accessed 2026-10-09.** Node documents execFile's default inherited environment and PATH lookup despite normally avoiding a shell. [Node child processes](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback).

**FACT — R27; accessed 2026-10-09.** Git supports multiple configuration scopes and environment-supplied configuration; its “protected configuration” trusts user/administrator control. core.fsmonitor can identify an executable helper, depending on version. [Git configuration](https://git-scm.com/docs/git-config#SCOPES).

**FACT — R28; accessed 2026-10-09.** Git documents no-ext-diff and no-textconv as disabling the named external diff/text-conversion features. [Git diff](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---no-ext-diff).

**INFERENCE — R26–R28.** F16 hardening should consider a trusted executable, constrained environment, trusted configuration authority and applicable helper surfaces. These diff switches address particular features; this survey neither establishes automatic execution of every hook nor reproduces F16.

**FACT — R29; specification 2026-07-28; accessed 2026-10-09.** MCP security guidance prohibits token passthrough, requires audience-appropriate tokens and recommends progressive least-privilege scopes with correlated logging. [MCP security practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices).

**FACT — R30; accessed 2026-10-09.** Vault documents single-use response-wrapping tokens and leases for dynamic secrets; arbitrary KV secrets do not receive the same lease guarantees. [Response wrapping](https://developer.hashicorp.com/vault/docs/concepts/response-wrapping), [Lease semantics](https://developer.hashicorp.com/vault/docs/concepts/lease).

**INFERENCE — R24/R25/R29/R30.** These sources support granular authorization and secret lifecycle discipline. An audience-bound token, short TTL or wrapping token is not authenticated user presence, and granting a bearer value to the agent can still convey authority. Revocation cannot recall plaintext already disclosed.

**FACT — R31; published 2026-08-26; accessed 2026-10-09.** Bubblewrap's primary advisory GHSA-pxhw-h44j-8pfx / CVE-2026-87766 describes a filesystem-boundary failure during setup, lists versions below 0.12.0 as affected and 0.12.0 as patched. [Primary advisory](https://github.com/containers/bubblewrap/security/advisories/GHSA-pxhw-h44j-8pfx).

**FACT — R32; published 2026-04-20; accessed 2026-10-09.** Anthropic's GHSA-vp62-r36r-9xqp / CVE-2026-39861 describes an out-of-workspace write-boundary failure involving component composition; it lists versions below 2.1.64 as affected and 2.1.64 as patched. [Primary advisory](https://github.com/anthropics/claude-code/security/advisories/GHSA-vp62-r36r-9xqp).

**FACT — R33; accessed 2026-10-09.** Current VS Code Agent Host documentation scopes sandboxing to supported Copilot SDK operations rather than every harness/custom tool, separates approvals from confinement, and calls Windows support experimental. [Agent Host sandboxing](https://code.visualstudio.com/docs/agents/run/agent-sandboxing).

**INFERENCE — R31–R33.** Published advisories justify reviewing setup, component authority and patch versions without asserting this repository is vulnerable to either advisory. Current vendor features do not certify the requested historical OS/editor/agent matrix or unrestricted host extensions.

## Defensive conclusions and completeness

**INFERENCE — Recommended shortlist.** Carry forward a separate secret/policy controller plus either a managed VM compartment or mandatory native confinement. Preserve an extension as a client/status interface. A remote compartment is conditional on G4 export semantics and does not cure host-side access.

**INFERENCE — Critical design gates.** Before asserting protection, address existing copies/handles/buffers, durable policy ownership, transaction-bound user presence, authenticated requester identity, complete egress mediation, operation-only secret use, revocation and truthful runtime evidence. These gates are expanded in the other four deliverables.

**INFERENCE — Completion assessment.** The documentary survey is COMPLETE within its reduced scope. Product assurance, uninspected credential/directory ACLs, concrete G2 anti-automation coverage and a fresh native baseline remain INCOMPLETE. No dynamic observations were added.

**INFERENCE — Safety-filter accounting.** No new Phase 2 research action encountered a safety-filter block. The earlier Phase 1 auth-probe block remains INCOMPLETE for dynamic evidence; no retry or reformulation was performed. Its exact supplied message is retained in open-questions.md.
