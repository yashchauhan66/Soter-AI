# Candidate architectures

**INFERENCE — Decision status, 2026-10-09.** These are defensive architecture candidates for later review, based on [research.md](research.md) and [mechanism-matrix.md](mechanism-matrix.md). No architecture is selected, implemented, deployed or certified here. G1–G6 and T remain the acceptance target.

## Shared authority and data design

**INFERENCE — Required separation.** Protected originals, keys, authoritative policy, approval decisions and audit state should be owned by an authority unavailable to agent-controlled identities. Moving a broker into another process under the same unrestricted user does not establish that separation. Service ACLs, protected application identity or a separate machine are possible building blocks, with platform-specific limitations in R06–R23.

**INFERENCE — Whole adversary coverage.** Every untrusted extension, terminal, child, MCP server and other process covered by T must either be confined or lack access to the protected authority. Isolating a named agent CLI while retaining an unrestricted malicious host extension leaves the target unsatisfied.

**INFERENCE — Protected enrollment.** Protection should be acknowledged only after the authoritative store and approved representations account for prior buffers, aliases, history, caches, handles and derived copies. Text selections and environment keys require a trusted representation boundary. Existing plaintext in an extension-readable buffer cannot become inaccessible merely through a new sharing flag.

**INFERENCE — Operation versus disclosure.** Prefer a broker executing a narrowly approved operation without returning credential plaintext. Separate “use this credential for this operation” from “disclose this value/content to this agent or off-machine destination.” Outputs and errors require their own release policy; raw secret injection into agent environment defeats that separation.

**INFERENCE — Proposed logical composition.** The diagram specifies roles, not deployed components. The grant verifier must authenticate both the approval and the requester; neither the untrusted client nor a caller-supplied identity determines authorization.

~~~mermaid
flowchart LR
  U[Authenticated user-presence authority] -->|Transaction-bound decision| C[Separate controller and grant verifier]
  A[Untrusted agent compartment] -->|Narrow operation request| C
  C --> V[Protected assets and secret store]
  C -->|Approved operation or release| E[Mandatory egress enforcement]
  C --> S[Authenticated status and protected audit]
~~~

## A — Managed local VM with separate controller

**INFERENCE — Composition.** Place untrusted tooling in a managed VM receiving an approved workspace representation. Keep vault, enrollment, grants and policy in a separately authorized local controller. Give the guest narrow broker operations and protected egress mediation; guest/editor activity must not control VM policy or host sharing.

**INFERENCE — Source basis.** R19–R23 explain VM/container management and sharing authority. R06/R08/R09 support distinct controller, service and network policy ownership. R10/R16/R17 provide candidate user-presence/key primitives, whose exact authorization integration remains unresolved.

**INFERENCE — G1/G5 contribution.** Excluding protected originals and secret-bearing history from the guest reduces direct reach. Sensitive user viewing and marking need a trusted interface that does not expose plaintext to the untrusted extension host. Host-side same-user processes must also be denied access to protected assets; the VM alone is insufficient.

**INFERENCE — G2/G3/G4/G6 contribution.** The controller can verify transaction scope and own durable policy independently of editor lifecycle. Mandatory networking can limit the guest's destinations. Authenticated effective-control status can replace self-reported sandbox strength. These are design opportunities; user-presence anti-automation, management authority, policy rollback and complete route coverage remain INCOMPLETE.

**INFERENCE — Decision gates.** Review deployment ownership, guest-host sharing, clipboard/display/input integration, local IPC, inherited credentials, startup/outage denial, grant identity, recovery and uninstall behavior. Windows Sandbox defaults are not the intended policy; Docker/WSL/ECI labels do not independently establish it.

**SPECULATION — Practical fit.** A managed VM may offer a clearer cross-platform execution boundary but could add resource and workflow costs. Neither comparative cost nor editor compatibility was measured.

## B — Native OS confinement with separate controller

**INFERENCE — Composition.** Retain a common controller/grant protocol while using platform-native enforcement: a reviewed restricted Windows identity/AppContainer plus WFP; a reviewed Linux process/namespace policy with relevant Landlock rights and network enforcement; a signed macOS sandbox/helper boundary with protected network mediation. These are mechanism families, not equivalent ready-made implementations.

**INFERENCE — Source basis.** R07/R09/R11–R17 describe platform mechanisms and their limits. R12/R13 require complementary policy beyond syscall filtering or a sandbox toolkit. R31/R32 support patch and component-composition review.

**INFERENCE — G1/G5 contribution.** A properly enforced process boundary can exclude protected resources and controller authority while sharing approved data. Prior handles, unrelated same-user processes, helper identities and extension-readable buffers remain separate gates.

**INFERENCE — G2/G3/G4/G6 contribution.** Independent approval verification, persistent deny ownership, destination enforcement and authenticated status remain required. Native confinement alone does not provide those responsibilities. Required kernel/OS capabilities and unsupported helper paths must yield an honest incomplete state or refusal to acknowledge protection.

**INFERENCE — Decision gates.** Review all untrusted launch paths, existing threads/processes, inherited resources, capability availability, policy-update authority, signing/deployment constraints and destination policy. Do not assume current documentation applies to requested historical host versions or that the three operating systems offer identical guarantees.

**SPECULATION — Practical fit.** Native confinement might reduce VM overhead and improve some workflows, at the cost of more platform-specific maintenance and assurance work. No comparative measurement supports a stronger claim.

## C — Dedicated remote executor with local protected authority

**INFERENCE — Composition.** Run untrusted work on a separately administered executor receiving only an approved representation. Keep local enrollment and disclosure authorization in a separately protected local controller; use narrowly authorized operation requests rather than general host access. The agent must lack executor-management and controller-administration rights.

**INFERENCE — Source basis.** R24/R29 support authenticated resource identity, audience separation and least-privilege scopes. R19–R23 motivate separation of deployment authority and exposed resources. These sources do not certify a particular remote service or confidentiality claim.

**INFERENCE — G1/G5 contribution.** Assets not exported to the executor are absent from its ordinary workspace. This does not remedy host-side malicious extensions or access to local originals. Remote storage, logs, backups and administrators become additional design obligations.

**INFERENCE — G2/G3/G4/G6 contribution.** All off-machine disclosure of protected material still requires a suitable grant under G4. A remote sandbox is not permission to upload protected workspace content or local vault contents. Local lifecycle-independent denial, signed authorization, exporter controls and truthful local/remote status remain required.

**INFERENCE — Decision gates.** Resolve acceptable trust domains, data residency, initial export semantics, local caching, operation-result release, remote authority, connection loss and revocation. Without explicit export authorization, this candidate must not receive protected content.

**SPECULATION — Practical fit.** Dedicated administration may simplify some authority boundaries while adding latency, operating cost and provider trust. Those tradeoffs are unmeasured.

## Options insufficient by themselves

| Option | Reasoning |
|---|---|
| Extension-only redaction/routing | **INFERENCE:** R01/R02 leave malicious host code with wider access than cooperative mediation. |
| Same-user broker plus DPAPI | **INFERENCE:** R03–R06 do not establish separation from equally authorized Windows processes. |
| Virtual view while originals remain accessible | **INFERENCE:** Filesystem presentation does not revoke access through other paths. |
| Read-only mounts containing secrets | **INFERENCE:** Preventing writes leaves reads available. |
| Firewall/content scanner after raw disclosure | **INFERENCE:** Destination restriction and pattern filtering do not restore G1 once the agent possesses the bytes. |
| Ordinary dialog or short-lived bearer token | **INFERENCE:** Neither proves independent presence, exact transaction approval or requester binding. |

## Shortlist and acceptance position

**INFERENCE — Recommendation for Phase 3 consideration.** Compare A and B first using the shared authority/data design. Keep C conditional on approved export semantics. Preserve the extension as a client and truthful status surface; do not make it the sole denial authority.

**INFERENCE — Feasibility limit.** If unrestricted same-user processes retain protected originals, trusted plaintext buffers, management authority or the ability to approve grants, none of these candidates satisfies T. Architecture review must resolve that authority problem rather than silently narrowing the adversary.

**INFERENCE — Acceptance position.** No candidate currently earns a G1–G6 PASS. The Windows token finding, incomplete control-token/directory ACL review, static-only credential/F16 findings and missing fresh-bundle live result remain open across every candidate.
