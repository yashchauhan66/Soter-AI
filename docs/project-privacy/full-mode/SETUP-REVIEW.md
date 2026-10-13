# Full-mode setup review

**FACT / current state (2026-10-12):** The extension's bounded workflows were tested previously. The new owner-side controller is separate, unbundled source; no deployed controller, isolated AI desktop, mandatory gateway or independently verified consent ceremony exists. Full G1-G6 remains **BLOCKED**. Sources: [previous report](../FINAL-LOCAL-REPORT.md), [controller](../../../apps/privacy-controller/src/CapabilityController.mjs), [new component report](CONTROLLER-REPORT.md).

## Recommended workflow and scope

**INFERENCE / decision:** Use a trusted host editor for originals and a whole AI editor/terminal compartment for a reviewed public project. The proposed Windows-Home backend is VirtualBox, with an internal-only agent guest and a separate gateway guest. Existing native AI launches remain uncovered. A separate VS Code profile or output masking does not establish this boundary.

**FACT (Oracle documentation checked 2026-10-12):** VirtualBox documents guest confinement through its VMM and configurable VM resources. NAT permits host-loopback access; shared clipboard and host folders can expose host data. [Security guide](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/Security.html).

**INFERENCE / design consequence:** Do not give the agent NAT, host-folder mounts, clipboard/drag-and-drop bridges, USB, host credentials or original Git history. A gateway must mediate allowed destinations and fixed public operations. Gateway compromise, administrator/host compromise, hypervisor defects and side channels remain limits; no perfect-protection claim is made.

All rows below are **INFERENCE / intended workflow**, not deployed results.

| User requirement | Intended behavior | Remaining prerequisite |
|---|---|---|
| Secrets inaccessible to AI | Originals remain outside the entire AI IDE, terminals and delegates; AI works with approved public bytes and synthetic configuration | Verified compartment, custody, publication/import and actual agent routing |
| User restricts any project file | User excludes the original from public publication; effective signed policy retains denies | Trusted policy UI and compartment integration; current native agents are uncovered |
| Terminal access requires consent | A mediated request queues review without opening or approving the owner's ceremony; public coding can continue | Terminal/client integration and an independently protected owner surface |
| Environment/sensitive access stays masked | Approved schema output contains variable names and `[MASKED]` for every value; no sensitive/env plaintext operation | Trusted item classification/resolver and real independent presence verification |
| Ordinary restricted content can be shared deliberately | Owner reviews a specific content digest and publishes a distinct approved, bounded projection; recognized credentials are redacted again | Review/publication UI; hard-denied original items cannot be overridden by the current controller |
| Professional, easy UI | Show mode, enrolled workload, loaded evidence and Covers / Does not cover before success; Setup required when prerequisites are absent | Runtime integration; current UI already retains full-claim BLOCKED |
| Project-wide leakage prevention | Keep original files, buffers, Git objects, recovery data and credentials outside agent authority; mediate future releases | Deployed filesystem/UI/network boundaries and functional evidence; prior disclosures cannot be recalled |

**INFERENCE / usability:** Initial setup can cost time and additional memory. After review, normal public code/search/edit/build/test should run without repeated sensitive-file prompts. Real-service parity and third-party agent authentication are separate integrations; synthetic mocks cannot prove every application works unchanged.

## Read-only findings and resource gates

**FACT / observed (2026-10-12):** Registry identifies `CoreSingleLanguage`, Windows build 26300.8935. Observed memory is approximately 16 GiB total, 4.5 GB available; 8 logical processors. C: had approximately 3 GB free; D: had approximately 230.6 GB free. These are observations, not reserved resources. Source: [prerequisite record](../evidence/20261012-controller/setup-state.json).

**FACT / observed (2026-10-12):** `HypervisorPresent=True`; reported WMI virtualization-extension flags were false. This does not prove BIOS virtualization is disabled. The proposed backend's compatibility/performance on this exact build remains NOT_TESTED. Docker engine availability is INCOMPLETE: restricted queries denied access, and an approved read-only version query hung and was interrupted. No Docker/WSL configuration was changed. Source: [prerequisite record](../evidence/20261012-controller/setup-state.json).

**FACT (Oracle documentation checked 2026-10-12):** The documented supported Windows hosts include Windows 11; the installer exposes component selection using `ADDLOCAL`. This is not validation of this exact host build. [Installation manual](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html).

**INFERENCE / resource gate:** The source readiness check requires at least 32 GiB storage and 6 GiB currently available memory, plus verified controller/gateway/presence/manifest/measurement adapters. Current memory observation fails that conservative readiness threshold. Do not close or kill the user's editors to make it pass; re-evaluate resources only after an authorized setup. Source: [readiness implementation](../../../apps/privacy-controller/src/FullModePlan.mjs).

## Concrete first installation change awaiting approval

**FACT / verified (2026-10-12):** Official staged installer: `.tmp/full-mode/installers/VirtualBox-7.2.20-175154-Win.exe`. SHA-256: `a81777d2b36380ce042a29e9c554cf032eb46a793f62e3cc82e7411e535c2c26`; Authenticode status **Valid**, signer **Oracle America, Inc.** It has not been executed. The checked `VBoxManage.exe` path and proposed `D:\SoterAI-FullMode` directory are absent. Source: [verification record](../evidence/20261012-controller/installer-verification.json), [vendor checksums](https://download.virtualbox.org/virtualbox/7.2.20/SHA256SUMS).

**INFERENCE / proposed change:** Install only the base application/core virtualization driver, with `VBoxApplication` selected. Exclude USB, bridged networking, host-only networking, Python bindings and the Extension Pack. Create only the new empty `D:\SoterAI-FullMode` directory. This does not authorize VM image import/creation, accounts, firewall rules, Hyper-V/BIOS settings or existing-VM changes.

Proposed user-visible invocation, **not executed**:

```powershell
Start-Process -FilePath '.tmp\full-mode\installers\VirtualBox-7.2.20-175154-Win.exe' -ArgumentList '-msiparams', 'ADDLOCAL=VBoxApplication', 'ALLUSERS=2', 'VBOX_START=0' -Wait
New-Item -ItemType Directory -Path 'D:\SoterAI-FullMode'
```

**INFERENCE / execution gate:** Recheck hash/signature and absence of the target directory before launch. The installer is an interactive task requiring the user's UAC and feature review. The installer may request a restart; do not reboot automatically. If feature selection cannot be confirmed, cancel and record INCOMPLETE rather than accept extra drivers. Show post-install feature/version evidence before any VM approval.

**FACT / authorization state (conversation, 2026-10-12):** The owner previously prohibited account/VM/feature/driver/firewall changes. The response to the installation question restated feature requirements; it did not explicitly approve the named machine change. No such change was made. This is an approval dependency, not a safety-filter rejection.

**INFERENCE / rollback:** Preserve the pre-install inventory and installer log. Uninstall only the newly installed VirtualBox base package through its supported Windows installer if rollback is requested; do not delete existing VMs, change OS virtualization features or silently reboot. Remove the proposed directory only if it was created by this setup and remains empty; preserve any later VM disks/evidence pending a separate review. New source code stays dormant; never start an unmanaged native fallback.

## What still needs implementation and evidence

Every row is **FACT / current source inventory (2026-10-12)** with an **INFERENCE / acceptance gate**.

| Component | Current state | Required completion evidence |
|---|---|---|
| Signed policy/capability/journal core | Implemented and fixture-tested, separate from VSIX | Independent host custody/ACLs, recovery and rollback protection |
| mTLS server factory | Real loopback flow tested; not deployed | Protected service lifecycle, authenticated measured enrollment, safe reachable topology |
| User presence and owner review | Callback contract; synthetic keys only | Real protected review/signing ceremony bound to exact item, identity, duration and revision |
| Whole AI IDE images/lifecycle | Reviewed configuration constructor only | Pinned images, approved import/config, launcher, bridge and process containment evidence |
| Gateway and provider routing | Design only | Mandatory allowed-destination proxy and actual agent/provider flows; no generic raw relay |
| Bidirectional code workflow | Existing bounded publication; no isolated round trip | Reviewed public sync, safe agent-edit import, no overwrite of protected originals or policy |
| UI integration | Existing bounded-mode verification UI; new controller not integrated | Live authoritative setup/enrollment/revocation status without fake success |
| Real Claude Code session | Previously not logged in | User-controlled authentication in the enrolled compartment, benign public coding control |

Sources: [new package](../../../apps/privacy-controller/README.md), [prior evidence](../FINAL-LOCAL-REPORT.md), [deployment gates](../DEPLOYMENT-GATES.md).

**INFERENCE / claim rule:** None of the new fixture tests closes the nine previously confirmed unmanaged-route leaks or promotes Phase 3 UNTESTED criteria. Keep full-claim BLOCKED until the actual architecture and applicable guarantees are evidenced.
