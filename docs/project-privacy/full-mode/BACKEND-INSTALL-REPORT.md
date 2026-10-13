# Approved base-backend installation

**FACT / result (2026-10-12):** The approved base application/core-driver installation is complete. Installed version: **7.2.20r175154**; installer attempt 2 exited **0**. The new `D:\SoterAI-FullMode` directory exists and remains empty. No VM was created by this step; full protection remains **BLOCKED**. Sources: [installer exit](../evidence/20261012-backend-install/installer-exit-attempt2.json), [installed inventory](../evidence/20261012-backend-install/post-install.json), [storage receipt](../evidence/20261012-backend-install/storage-directory.json).

## Exact scope and verification

All rows are **FACT / read-only observations (2026-10-12)**.

| Assertion | Observed result | Evidence |
|---|---|---|
| Pinned official installer, valid signature | SHA-256 matched; Oracle America, Inc. signature Valid | [Pre-install record](../evidence/20261012-backend-install/pre-install.json) |
| Base application present | Windows Installer `VBoxApplication`: **LOCAL**, state 3 | [Product/feature inventory](../evidence/20261012-backend-install/post-install.json) |
| Optional components excluded | `VBoxUSB`, `VBoxNetwork`, `VBoxNetworkFlt`, `VBoxNetworkAdp`, `VBoxPython`: **ABSENT**, state 2 | [Product/feature inventory](../evidence/20261012-backend-install/post-install.json) |
| Core driver registered/loaded | Only `VBoxSup` found by the scoped driver inventory; Running, System start | [Driver inventory](../evidence/20261012-backend-install/post-install.json) |
| Backend command runs | Absolute installed `VBoxManage.exe --version` returned `7.2.20r175154`, exit 0 | [Installed inventory](../evidence/20261012-backend-install/post-install.json) |
| Installed executable integrity | VBoxManage, VirtualBox and VBoxHeadless signatures **Valid**, Oracle signer; SHA-256 recorded | [Installed inventory](../evidence/20261012-backend-install/post-install.json) |
| Core-driver signature | **Valid**, Microsoft Windows Hardware Compatibility Publisher; SHA-256 recorded | [Driver receipt](../evidence/20261012-backend-install/core-driver.json) |
| Extension Pack excluded | Installed ExtensionPacks directory inventory empty | [Installed inventory](../evidence/20261012-backend-install/post-install.json) |
| New storage directory | Empty regular directory, no reparse point; inherited ACL inspected, not edited | [Storage receipt](../evidence/20261012-backend-install/storage-directory.json) |
| No VM creation | New application-global registry contains **0 MachineEntry records**; no create/import/configure/start VM command issued | [Registry count/hash](../evidence/20261012-backend-install/vm-registry-after-finish.json) |
| Existing extension bundle retained | SHA-256 still `d8abff1a7ac48809420bb4f2862b8d9700ccc85c9b5cd97152608be85556b032` | [Final state](../evidence/20261012-backend-install/install-state.json) |

**FACT / changed machine state (2026-10-12):** Base binaries were installed in `C:\Program Files\Oracle\VirtualBox`; the core `VBoxSup.sys` driver and base application's `VBoxSDS` service were registered. The installer was user-visible; the user confirmed Finish. After Finish, VirtualBox Manager and its supporting processes were observed, and a previously absent `.VirtualBox/VirtualBox.xml` was initialized with zero VM entries. The approved D: directory was created. Source: [pre-state](../evidence/20261012-backend-install/pre-install.json), [post-state](../evidence/20261012-backend-install/post-install.json), [final state](../evidence/20261012-backend-install/install-state.json), [new registry receipt](../evidence/20261012-backend-install/vm-registry-after-finish.json).

**FACT / scope exclusions (2026-10-12):** No account creation, firewall command, Windows feature/Hyper-V/BIOS toggle, Extension Pack installation, VM creation/import/start, protected-file read, extension deployment, push or Code.exe close/kill/reload was performed. No new test probe or exploit code was added. This step changed only installation/evidence state; extension product code was not edited. Sources: [launch receipt](../evidence/20261012-backend-install/installer-launch-attempt2.json), [final state](../evidence/20261012-backend-install/install-state.json).

**INFERENCE / limit:** A registered and loaded driver plus version output does not prove guest startup, confinement, mandatory egress, application compatibility or any full G1-G6 guarantee. Those require an approved exact image/configuration and functional evidence. The new storage directory inherits Authenticated Users/Users access and is not verified secret custody; do not place originals, policy keys or provider credentials there.

## Retained failure and corrected invocation

**FACT / first attempt (2026-10-12):** The first inventory command failed with `Get-ItemProperty : Specified cast is not valid.` Reading named registry values instead completed the pre-install inventory. The first installer invocation exited **1** without an MSI log or installed backend. It incorrectly passed multiple unquoted MSI properties and a msiexec logging switch to the executable bootstrapper. Sources: [inventory failure record](../evidence/20261012-backend-install/pre-install.json), [original launch](../evidence/20261012-backend-install/installer-launch.json), [original exit](../evidence/20261012-backend-install/installer-exit.json).

**FACT (vendor source checked 2026-10-12):** The bootstrapper parses `--msiparams` as one string and has a separate `--msi-log-file` option. [Vendor bootstrapper source](https://raw.githubusercontent.com/VirtualBox/virtualbox/main/src/VBox/Installer/win/Stub/VBoxStub.cpp).

**FACT / corrected attempt (2026-10-12):** The second invocation quoted the complete MSI property string and used the bootstrapper logging option. The MSI action returned success, followed by final process exit 0 after the user confirmed Finish. Exact arguments and complete MSI log are retained. No safety-filter or automatic approval-review rejection occurred. Sources: [corrected launch](../evidence/20261012-backend-install/installer-launch-attempt2.json), [MSI log](../evidence/20261012-backend-install/virtualbox-msi-attempt2.log), [exit](../evidence/20261012-backend-install/installer-exit-attempt2.json).

**FACT / restart state (2026-10-12):** MSI recorded `MsiSystemRebootPending=1` during its initial property setup, before its installation action; `REBOOT=ReallySuppress` was supplied. No reboot was initiated. Source: [MSI log](../evidence/20261012-backend-install/virtualbox-msi-attempt2.log).

**INFERENCE:** The initial reboot-pending observation should not be presented as a requirement newly caused by this installation. Guest compatibility/performance and any restart prerequisite remain untested until the separately authorized runtime step.

## Hashes, rollback and remaining work

All hashes below are **FACT / SHA-256 measured 2026-10-12**, with source [binary inventory](../evidence/20261012-backend-install/post-install.json) and [driver receipt](../evidence/20261012-backend-install/core-driver.json).

| Artifact | SHA-256 |
|---|---|
| Approved installer | `a81777d2b36380ce042a29e9c554cf032eb46a793f62e3cc82e7411e535c2c26` |
| VBoxManage.exe | `6852390a57d454d3b7c9ae27e66e45c367699faf2807b450de084b1f7d0203c1` |
| VirtualBox.exe | `90144a93a45082a025372478060d2f2744baab1ffb154c14f975616f844a1eef` |
| VBoxHeadless.exe | `5f21bc7f6e6f07f39e4d8b9b5068babb09315a160db2c07f97607d2f4852c776` |
| VBoxSup.sys | `a4d29ed6ba1c9ad74110cb86d10c0d8c9f492a1b3f6836963139380b02b3ed90` |

**FACT / report changes (2026-10-12):** Added this report and installation receipts/log/hash inventory under `docs/project-privacy/evidence/20261012-backend-install`. Earlier source, A0/host evidence and the 28-test controller receipt were retained. Source: [new evidence index](../evidence/20261012-backend-install/SHA256SUMS.txt).

**INFERENCE / rollback:** If rollback is requested, use the supported Windows uninstall entry for the newly installed **Oracle VirtualBox 7.2.20**, product `{BA553E42-4B98-43E8-BD2F-A0A19A58FF6F}`. Preserve the retained installer/evidence. Do not manually delete driver files, alter virtualization features, remove other VM software or reboot automatically. Remove `D:\SoterAI-FullMode` only after verifying the exact path and that it remains empty; if any files appear, preserve them pending review. Do not delete profile/VM data without separate authorization. Oracle documents supported Windows uninstallation through its program entry: [installation/uninstallation manual](https://docs.oracle.com/en/virtualization/virtualbox/7.2/user/installation.html), checked 2026-10-12.

**FACT / remaining work (2026-10-12):** No isolated AI IDE or gateway is deployed. Exact guest images/configuration, whole-workload enrollment, protected controller/key/policy custody, independent user-presence UI, mandatory egress, safe code round-trip and actual enrolled-agent tests remain incomplete. The earlier host survey's nine unmanaged-route leaks remain unresolved by this installation. Source: [controller report](CONTROLLER-REPORT.md), [earlier host report](../FINAL-LOCAL-REPORT.md), [setup gates](SETUP-REVIEW.md).

**INFERENCE / next gate:** Prepare and review exact pinned guest images/configuration and their rollback before asking for VM-creation approval. This installation approval authorizes no VM creation or additional machine changes. Keep the UI and full claim BLOCKED until runtime evidence exists.
