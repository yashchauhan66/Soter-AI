# Exact next VM change for review

**FACT / authorization state (conversation, 2026-10-12):** The owner's explicit approval covered the VirtualBox base/core-driver installation and empty storage directory only. That step succeeded. VM import/configuration/boot has not been approved by that response. Sources: [installation report](BACKEND-INSTALL-REPORT.md), [original setup scope](SETUP-REVIEW.md).

**INFERENCE / proposed next change:** First protect only the new `D:\SoterAI-FullMode` storage directory using the reviewed ACL commands below; then import two new stopped base VMs from the same pinned Canonical Ubuntu 24.04 amd64 OVA under its `machines` subdirectory. Configure the future agent/gateway roles below, capture assigned UUIDs and disk/configuration hashes, and verify the settings read-only. Neither VM is booted or enrolled by this proposed step. No original project, history, account credential, provider token or controller signing key is placed in either VM.

**FACT (Canonical sources checked 2026-10-12):** The released image build is 20260926. Its signed checksum entry identifies `ubuntu-24.04-server-cloudimg-amd64.ova` with SHA-256 `513a22ebe3982b9387b038f8a2a6dad1af980d4623dca03511312e55ba620b1a`. The documented cloud-signing key fingerprint is `D2EB44626FDDC30B513D5BB71A5D6C4C7DB87C81`. Sources: [release directory](https://cloud-images.ubuntu.com/releases/noble/release-20260926/), [signed checksum manifest](https://cloud-images.ubuntu.com/releases/noble/release-20260926/SHA256SUMS), [Canonical verification documentation](https://ubuntu.com/docs/public-images/public-images-how-to/verify-image-checksum/).

**FACT / local verification scope (2026-10-12):** The detached checksum signature verifies against that independently pinned public fingerprint using a separate staging keyring and no private-key operation. A VM import must additionally require the complete local OVA hash to match; partial transfer or signed metadata alone is insufficient. Source: [signature receipt](../evidence/20261012-runtime-plan/checksum-signature-final.txt), [image staging receipt](../evidence/20261012-runtime-plan/image-download-start.json). The complete local image receipt and read-only import preview must be attached before asking for import approval.

**FACT / completed preparation (2026-10-12):** The complete local OVA is **594,800,640 bytes** and matches the signed SHA-256 above. Read-only base import preview and both configured role previews returned exit **0**; the virtual disk is **10 GiB per VM**, 20 GiB aggregate. The vendor template contains a bridged adapter, floppy, CD-ROM and IDE controllers; the proposed import ignores unwanted units and requires explicit adapter overrides while powered off before any future boot. No VM was imported by these previews. Sources: [verified image](../evidence/20261012-runtime-plan/image-verification.json), [base preview](../evidence/20261012-runtime-plan/virtualbox-import-dry-run-final.txt), [agent preview](../evidence/20261012-runtime-plan/SoterAI-Agent-20261012-dry-run-final.txt), [gateway preview](../evidence/20261012-runtime-plan/SoterAI-Gateway-20261012-dry-run-final.txt), [exact unexecuted arguments](../evidence/20261012-runtime-plan/stopped-base-vm-review.json).

**FACT / resources (2026-10-12):** Read-only preflight found **0 registered VMs**, empty D: target, approximately **230.6 GB free on D:** and **4,173,336,576 bytes available memory**. This is below the source's 6 GiB boot-readiness threshold. C: was under disk pressure; after full-image verification, only five redundant public-download byte caches were hashed and removed, releasing **594,800,640 bytes**. The complete verified OVA and all failure/signature logs were retained. Sources: [preflight](../evidence/20261012-runtime-plan/runtime-prerequisites.json), [cache hygiene receipt](../evidence/20261012-runtime-plan/download-cache-hygiene.json).

## New storage ACL proposal, not executed

**FACT / read-only backup (2026-10-12):** The new D: directory currently inherits Authenticated Users Modify and Users ReadAndExecute entries. Its current-user owner is SID `S-1-5-21-576938901-594400856-1755335594-1001`; no unexpected explicit foreign rule was found. The directory and D: parent's descriptors were saved before proposing a mutation. Source: [SDDL backup](../evidence/20261012-runtime-plan/vm-storage-acl-backup.json).

**INFERENCE / proposed change:** Keep owner/SYSTEM/Administrators full control, then remove inherited entries on this newly created, still-empty directory only. Do not edit the D: volume, user profile, original projects, broker tokens or their parents. Recheck current emptiness/ownership/descriptor before executing; if owner data or unexpected grants appear, stop for review. Exact commands, not executed:

```powershell
icacls "D:\SoterAI-FullMode" /grant:r "*S-1-5-21-576938901-594400856-1755335594-1001:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"
icacls "D:\SoterAI-FullMode" /inheritance:r
```

**INFERENCE / limit:** This hardens future VM-file storage against other local principals; it does not remove the owner's same-user authority or prove parent-race resistance, protected physical consent or administrator-compromise resistance.

All settings below are **INFERENCE / proposed configuration**, not existing VM results.

| Setting | Agent base VM | Gateway base VM |
|---|---|---|
| New name | `SoterAI-Agent-20261012` | `SoterAI-Gateway-20261012` |
| New storage | `D:\SoterAI-FullMode\machines\SoterAI-Agent-20261012` | `D:\SoterAI-FullMode\machines\SoterAI-Gateway-20261012` |
| CPU / RAM | 2 CPUs / 4096 MiB | 1 CPU / 768 MiB |
| Power state for this step | Off; no guest execution | Off; no guest execution |
| NIC 1 | Internal-only `soterai-private-20261012` | Same internal network |
| NIC 2 | None | NAT, for later trusted gateway provisioning; inactive while powered off |
| NICs 3-8 | None | None |
| Clipboard/file transfer/drag and drop | Disabled | Disabled |
| USB OHCI/EHCI/xHCI, VRDE, host audio | Disabled | Disabled |
| Host folders, PCI/physical disks, webcam, serial/parallel bridges | None | None |
| Guest secrets/history | None | None |
| Disk | Vendor 10 GiB virtual disk, ImportToVDI; automatic disk name captured and required inside this exact VM directory | Separate vendor 10 GiB disk with the same path checks; no shared writable disk |
| UUID | Allocated by VirtualBox during import, then captured and bound to the owner inventory; never accepted from an agent | Separate fresh UUID, captured the same way |

**INFERENCE / storage and memory limits:** The existing D: free-space observation is sufficient for base import, but recheck it before mutation. The base OVA's actual virtual disk size comes from the read-only import preview. Retain the plan's 64 GiB aggregate virtual-disk ceiling; refuse unexpected devices/disks or a larger import. This powered-off import allocates no running-guest RAM. Recheck the conservative 6 GiB available-memory gate before any future boot; do not close or kill the user's Code.exe to meet it.

**INFERENCE / excluded changes:** This approval would not cover guest boot/provisioning, Windows accounts, existing VMs, host firewall rules, any ACL outside the newly created D: storage directory, Hyper-V/BIOS settings, additional drivers/Extension Packs, production agents, credentials or extension deployment. Guest provisioning, the mandatory gateway, independent presence and safe public-project round-trip remain separate implementation/activation gates.

## Assertions and rollback

Every assertion below is **INFERENCE / expected result for an authorized future step**.

| Assertion | Required observation |
|---|---|
| Exact image | Complete local OVA matches the independently authenticated signed checksum; pinned VBoxManage executable/version matches the approved installation |
| No overwrite/adoption | Target names/directories and assigned VM records are new; existing VM registry inventory is preserved |
| Shape and power state | Both VMs are powered off; only the specified adapters/resources and vendor virtual disks are present; no host bridges or shared folders |
| Artifact provenance | Record OVA, resulting virtual disks/configurations and assigned UUIDs; parser CONFIGURATION_OBSERVED never counts as functional isolation |
| Scope | No imported source secrets, actual AI/provider call, guest boot, new host firewall rule or full-mode success badge |
| Failure handling | Keep full claim BLOCKED and partial import marked INCOMPLETE; never start an unmanaged/native fallback |

**INFERENCE / rollback:** Save the pre-import registry hash/inventory and exact new storage paths. Roll back only newly created VM records identified by the captured UUIDs. Preserve disks/configurations/evidence by default; deleting any newly created storage requires verifying its resolved absolute path is under `D:\SoterAI-FullMode\machines`, belongs to this run and contains no unrelated files. Restore the saved new-directory descriptor only after confirming no later sensitive/authority data would become exposed; do not change its D: parent. Do not restore an old global registry over newer user changes, delete other VMs or uninstall the approved backend as an automatic fallback.

**FACT / implementation progress (2026-10-12):** Added a default-disabled owner-side Windows backend inspector with pinned absolute executable/hash, minimal environment, bounded errors, strict selected configuration parsing and no VM mutations. Controller/backend tests: **38 PASS / 0 FAIL / 0 SKIP**. Backend process responses are mocked in unit tests, and actual guest confinement remains NOT_TESTED. Sources: [adapter](../../../apps/privacy-controller/src/WindowsBackend.mjs), [tests](../../../apps/privacy-controller/src/__tests__/windows-backend.test.mjs), [TAP](../evidence/20261012-runtime-plan/controller-and-backend-final.tap).

**INFERENCE / honest completion rule:** This next import is a prerequisite, not completion of the requested full-protection product. Do not call a stopped Ubuntu base image a working AI IDE or enforced gateway. Full protection remains BLOCKED until the actual supported workflow and applicable acceptance gates have evidence.

See [current rating](RATING-20261012.md) and [remaining integration work](SETUP-REVIEW.md).
