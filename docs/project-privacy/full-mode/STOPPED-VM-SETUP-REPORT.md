# Powered-off VM setup, 2026-10-12

**FACT / observed scope (2026-10-12):** The reviewed new-directory ACL and two powered-off base VMs are configured. Final read-only configuration assertions: **22 PASS / 0 FAIL**. This is prerequisite evidence, not a guest execution, AI workflow or confidentiality acceptance result. Sources: [pre-state](../evidence/20261012-stopped-vm-create/pre-state.json), [post-state](../evidence/20261012-stopped-vm-create/post-state.json), [all assertions](../evidence/20261012-stopped-vm-create/configuration-assertions.json).

**FACT / conversation record (2026-10-12):** In response to the exact ACL/two-stopped-VM approval question, the owner answered `choose which is best`. **INFERENCE / authorization interpretation:** This delegates the reviewed limited setup choice. It does not authorize guest boot/provisioning, original/secret mounts, Windows accounts, host firewall changes, extra drivers, existing VM changes or extension deployment. Sources: [reviewed arguments](../evidence/20261012-runtime-plan/stopped-base-vm-review.json), [reply/scope recorded before mutation](../evidence/20261012-stopped-vm-create/pre-state.json).

**INFERENCE / release assessment:** Full project-secret protection stays **BLOCKED**. The subjective rating remains **4.6 / 10**, using [the existing methodology](RATING-20261012.md). Stopped base guests do not resolve the retained nine unmanaged-route leaks.

## Actual configuration

All rows are **FACT / read-only local observations, 2026-10-12**. Sources: [agent metadata](../evidence/20261012-stopped-vm-create/agent-final-info.txt), [gateway metadata](../evidence/20261012-stopped-vm-create/gateway-final-info.txt), [agent disk](../evidence/20261012-stopped-vm-create/agent-disk-info.txt), [gateway disk](../evidence/20261012-stopped-vm-create/gateway-disk-info.txt).

| Item | Agent | Gateway |
|---|---|---|
| Name | `SoterAI-Agent-20261012` | `SoterAI-Gateway-20261012` |
| Captured UUID | `491c6144-2b6e-4332-be7a-6519112ab273` | `8e9f142b-e372-4703-8994-34de3e9c7263` |
| State | `poweroff` | `poweroff` |
| CPU / memory | 2 CPUs / 4096 MiB | 1 CPU / 768 MiB |
| NIC 1 | Internal `soterai-private-20261012` | Same internal network |
| NIC 2 / NICs 3-8 | None / None | NAT, inactive while off / None |
| Clipboard, file transfer, drag and drop | Disabled | Disabled |
| USB, VRDE, audio input/output, UART/LPT | Disabled | Disabled |
| Shares, additional host devices, port forwarding | No configured entries in inspected metadata/XML | No configured entries in inspected metadata/XML |
| Disk | Separate dynamic VDI, 10 GiB virtual capacity | Separate dynamic VDI, 10 GiB virtual capacity |
| Disk-file bytes | 1,932,525,568 | 1,932,525,568 |
| Storage | `D:\SoterAI-FullMode\machines\SoterAI-Agent-20261012` | `D:\SoterAI-FullMode\machines\SoterAI-Gateway-20261012` |

**FACT / ACL observation (2026-10-12):** Only the new `D:\SoterAI-FullMode` root was explicitly modified. Inheritance is disabled there; user SID, SYSTEM and Administrators have FullControl with child inheritance. VM files/directories inherit these principals only. The D: parent descriptor is unchanged. Fresh SDDL/registry backups preceded mutation. The root remains user-owned; created VM files report Administrators ownership while retaining the user's inherited FullControl. Sources: [before](../evidence/20261012-stopped-vm-create/pre-state.json), [after](../evidence/20261012-stopped-vm-create/storage-acl-after.json), [file ACL metadata](../evidence/20261012-stopped-vm-create/machine-artifacts.json).

**INFERENCE / ACL limit:** These permissions exclude ordinary foreign principals from the store. They do not remove same-user authority, establish independent custody, prove parent-directory race resistance or defend against administrator/host compromise.

## Verification and hashes

All rows are **FACT / local measurements, 2026-10-12**. Sources: [artifact hashes](../evidence/20261012-stopped-vm-create/machine-artifacts.json), [pre-state](../evidence/20261012-stopped-vm-create/pre-state.json), [post-state](../evidence/20261012-stopped-vm-create/post-state.json).

| Artifact | SHA-256 |
|---|---|
| Verified Canonical OVA input | `513a22ebe3982b9387b038f8a2a6dad1af980d4623dca03511312e55ba620b1a` |
| VBoxManage 7.2.20r175154 | `6852390a57d454d3b7c9ae27e66e45c367699faf2807b450de084b1f7d0203c1` |
| Agent configuration | `2b326fa9f458952aa210c91ad7a6d00696087f96d4f3ba8d525eab181e023240` |
| Agent disk | `7f224c098e806ed4e5d6042538d4bf6dd7eb74cecaeb216e24e27cc2dea29f7d` |
| Gateway configuration | `fabd1e0de8f698e1796c86989d7ad89dbf1edccfc9caee397f725fe6377f54ed` |
| Gateway disk | `367f7a3c40af506a5fd9c9e27810987a5e2060521704b643a50ded090ef129cb` |
| Global registry before | `e511a8c7b53ebcdc2273158584461d4460136c31d8a71f2cf9624e1ba10fca34` |
| Global registry after | `8df143efe1b246f2875315f41db63b86143239eb02adb4a75bcdb811d8e3f81d` |
| Frozen extension, unchanged | `d8abff1a7ac48809420bb4f2862b8d9700ccc85c9b5cd97152608be85556b032` |

**FACT / checks (2026-10-12):** Each VM passed nine assertions: captured identity, powered-off state, resources, adapter layout, reported host channels disabled, one local 10 GiB disk, no additional device/share entries, expected non-reparse paths and private inherited ACL principals. Four further checks passed for registry inventory, root/parent ACLs, pinned inputs and unchanged extension. The previously empty registry now contains only these two captured IDs. Source: [22 assertions](../evidence/20261012-stopped-vm-create/configuration-assertions.json).

**FACT / existing inspector exercised on real metadata (2026-10-12):** `WindowsBackendInspector` returned `CONFIGURATION_OBSERVED` for both VMs with `poweroff`, expected adapters and `hostBridgePresent: false`. It still reports `artifactBinding: UNVERIFIED` and `fullClaim: BLOCKED`. Disk/config hashes were recorded separately; the adapter does not attest guest contents, independent custody or functional isolation. Sources: [actual inspector receipt](../evidence/20261012-stopped-vm-create/live-backend-inspection.json), [existing source](../../../apps/privacy-controller/src/WindowsBackend.mjs).

**FACT / test scope (2026-10-12):** No product/controller source changed and no unit/host/model suite was rerun in this step. Retained controller/backend results: **38 PASS / 0 FAIL / 0 SKIP**; their mocked backend tests remain separate from this actual metadata observation. Retained extension results: 790 PASS / 0 FAIL / 3 SKIP. A0/Phase 0-5 evidence remains unchanged. Sources: [controller TAP](../evidence/20261012-runtime-plan/controller-and-backend-final.tap), [extension scorecard](../SCORECARD.md).

**FACT / resources (2026-10-12):** Post-setup free D: space is 226,768,072,704 bytes; available RAM is 4,477,308,928 bytes, below the retained 6 GiB boot-readiness threshold. No guest started. Source: [post-state](../evidence/20261012-stopped-vm-create/post-state.json).

## Retained diagnostics

All rows are **FACT / actual invocation results, 2026-10-12**. Sources: [initial guard failure](../evidence/20261012-stopped-vm-create/agent-initial-config-guard-failure.json), [read-only diagnostics](../evidence/20261012-stopped-vm-create/readonly-invocation-diagnostics.json), [successful modification](../evidence/20261012-stopped-vm-create/agent-modify-execution.json), [successful inspector](../evidence/20261012-stopped-vm-create/live-backend-inspection.json).

| Exact message | Cause and outcome |
|---|---|
| `VM state or configuration location mismatch` | Guard expected an unescaped Windows path. Refused before modify. Correct comparison of VBoxManage's escaped representation passed; reviewed settings applied with exit 0. |
| `SyntaxError: Unexpected identifier 'node'` | PowerShell removed quotes from inline `node -e`. No backend action ran. Passing the existing inspector invocation via stdin succeeded. |
| `VBoxManage.exe: error: unknown option: --machinereadable` | Installed `showmediuminfo` rejects this flag. No disk modification occurred. Supported plain-text invocation succeeded for both disks. |

**FACT / approval review (2026-10-12):** No safety-filter or automatic approval-review rejection occurred. These retained invocation failures are not rewritten as first-attempt passes.

## Changes and rollback

**FACT / changed files (2026-10-12):** The new D: root ACL changed; each VM directory gained `.vbox`, `.vbox-prev` and VDI files. The user's VirtualBox registry gained two records. Workspace changes are this report, evidence/checksum records and progress notes in the scorecard, final report and rating. Extension/controller source, packaged verification UI report and frozen bundle are unchanged. Sources: [artifact inventory](../evidence/20261012-stopped-vm-create/machine-artifacts.json), [registry before](../evidence/20261012-stopped-vm-create/VirtualBox-before.xml), [registry after](../evidence/20261012-stopped-vm-create/VirtualBox-after.xml).

**INFERENCE / rollback, not executed:** Recheck that the captured IDs still identify this run's powered-off VMs and expected D: configurations. Unregister only these IDs, preserving disks by omitting `--delete`. Preserve evidence/disks by default; do not restore the old global registry over subsequent user changes. Any later removal must verify exact resolved run directories and absence of unrelated files. Restore the saved root SDDL only after checking no later sensitive/authority data becomes exposed; never modify D:'s parent. Do not restore `.vbox-prev` as a hardened configuration: it is the vendor import's earlier state and has not passed final assertions.

**INFERENCE / commands for an owner-requested rollback only:**

```powershell
& 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe' unregistervm '491c6144-2b6e-4332-be7a-6519112ab273'
& 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe' unregistervm '8e9f142b-e372-4703-8994-34de3e9c7263'
```

## Remaining coverage

All rows are **INFERENCE / remaining implementation or acceptance work**, based on [setup scope](SETUP-REVIEW.md), [architecture](../ENTERPRISE-ARCHITECTURE.md), [retained verification](../FINAL-LOCAL-REPORT.md) and the post-state above.

| Item | Current limit |
|---|---|
| Runnable isolated AI IDE | Guests have not booted, been provisioned or enrolled; no working AI environment is claimed. |
| Mandatory egress | Internal/NAT topology is not a provider allowlist or enforced gateway. No running gateway/proxy exists; future gateway access to host/private networks must be considered before activation. |
| Independent policy/key custody and presence | Controller modules are source only; same-user storage does not establish independent authority. Physical consent integration is incomplete. |
| Public code round-trip | Whole-workload trusted-IDE to isolated-AI-IDE import/edit/export is not implemented and verified. |
| Live UI | Existing UI keeps full claim BLOCKED. This step adds no live VM readiness integration or full-success badge. |
| Actual supported AI operation | Authenticated/enrolled Claude Code remains incomplete. Historical Codex/Gemini public controls do not prove isolated routing. |
| Unmanaged native AI | Retained nine native-route leaks remain unresolved. Same-user native agents are outside the proposed enrolled-guest boundary. |
| Broader acceptance | Guest isolation, enforced egress, independent consent, revocation/drain, parent races, host/admin compromise, side channels and Phase 3 UNTESTED criteria are not promoted. |

**FACT / stopping point (2026-10-12):** Both VMs remain powered off; no original project/secrets mounted. Full claim is BLOCKED. Boot/provisioning and activation remain outside this approval.
