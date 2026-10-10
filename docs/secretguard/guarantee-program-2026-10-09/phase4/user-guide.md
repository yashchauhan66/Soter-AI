# Using the scoped Phase 4 hardening

**INFERENCE — Coverage, 2026-10-10 (Asia/Calcutta).** The current build improves SoterAI-managed context, redacted previews, scoped broker operations and reference cleanup. It does not prevent a hostile agent or extension running as your Windows user from reading original files/history, keys/tokens, editor buffers, clipboard/display, process state or using native network routes. All 30 full-architecture assertions and all 63 real-agent combinations remain untested. Use the reviewed artifacts in the agreed isolated profile; this guide does not authorize installation into your normal profile or system changes.

**FACT — Behavior sources, inspected 2026-10-10.** Command names appear in [package.json](../../../../packages/vscode-extension/package.json). Managed deny behavior appears in [AI-boundary commands](../../../../packages/vscode-extension/src/ai-boundary/commands.ts) and [retained-rule review](../../../../packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts); scope/remaining gaps are recorded in [issue-disposition.md](issue-disposition.md), source date 2026-10-10. These are source-backed descriptions, not independent host evidence.

**INFERENCE — Marking material for managed sharing.** In the isolated editor, use **SoterAI: Block File or Folder from AI** on the intended local workspace item. Use **Block Pattern from AI** for an accepted glob, or **Block Selected Text from AI** for a marked selection. The managed pattern control supports globs, not arbitrary regex. Use **Open Redacted AI Preview** to review the managed view. These commands affect SoterAI context/previews; other extensions and terminal/native file APIs can still read the original. Mark private prose explicitly because automatic detection does not recognize all private meaning.

**INFERENCE — Changed text and accepted rules.** If a marked selection changes, the earlier mark is retained and the managed view can withhold the whole file until review. Repository-contributed denies become retained accepted rules. Deleting or weakening `.aiignore` or the corresponding project-policy entry does not by itself remove an accepted deny. Missing/malformed policy or unavailable rule state can make managed sharing unavailable; do not replace that outcome with an unfiltered export.

**INFERENCE — Relaxing one accepted deny.** Use this ordinary editor review only when you intend to relax that precise managed rule:

1. Remove the corresponding repository entry first if the deny came from `.aiignore` or project policy. An entry left in the repository is accepted again on the next policy load.
2. Open **SoterAI: Manage Manual AI Rules**, choose the correct workspace folder, then choose the one displayed file/folder/glob/selection rule.
3. Review the displayed scope. The native modal includes the exact limitation **“not agent-proof: an agent running as me could also change this”**. Choose **“Relax this deny”** only for that intended rule; cancellation keeps it.

**INFERENCE — Consent limit.** This modal is ordinary same-user UX, not independent physical verification or proof of a human gesture. Broker approval and protection-disable modals likewise display scope/limitations and require their affirmative native result, but an agent running as you may automate or tamper with this context. The current legacy one-use broker approval has a five-minute consumption expiry and caller-supplied session; it does not implement the architecture's enrolled-agent/60-second exact-consent contract.

**FACT — Storage sources, inspected 2026-10-10.** [VaultManager.ts](../../../../packages/vscode-extension/src/firewall/VaultManager.ts) writes encrypted vault/backup data outside the workspace and stores its key in editor SecretStorage; [secret-reference commands](../../../../packages/vscode-extension/src/secret-broker/commands.ts) display reference metadata rather than raw values. [The B3 disposition](issue-disposition.md), source date 2026-10-10, records ID inventory and cleanup improvements and the remaining same-user/legacy-retention gaps.

**INFERENCE — Encrypted files and opaque references.** An explicitly migrated managed file can contain placeholders while its value/backup is stored encrypted. A secret reference represents a scoped broker value; it is not permission to expose that value, and encryption does not remove same-user DPAPI/SecretStorage, key, memory or recovery authority. Unmigrated originals, old history/copies and real key/token ownership remain outside demonstrated protection. Do not restore plaintext into the AI-connected workspace to work around an unavailable reference or cleanup failure.

**INFERENCE — Reviewing and clearing references.** Where the isolated profile exposes the advanced commands, **Manage Secret References** lists workspace-scoped metadata and expiry. **Clear Secret Broker Session** revokes current references and requests backing-value cleanup. Treat failed cleanup as INCOMPLETE and retain recovery inventory. An empty in-memory list, expired reference or successful revocation does not establish erasure of backups, unknown legacy entries or downstream provider credentials. No real credentials are needed for the agreed synthetic verification.

**INFERENCE — Setup and status.** Review **Covers / Does not cover** before confirming **Enable Automatic IDE Protection**. “Running”, “enabled”, a parsed policy file or a configured broker URL describes operational state; it does not certify an independent boundary or agent route. Missing/stale/unhealthy state remains unverified. Ordinary editor pixels themselves are outside the hostile-user assurance boundary. A failed prerequisite keeps the affected protected operation unavailable.

**INFERENCE — Optional public scaffold.** Tier-2-lite is a default-off generator for explicitly public file snapshots and opaque placeholders. It has no ready launch/attach workflow and starts no container, WSL, VM, editor or agent. Effective credential forwarding/attach is INCOMPLETE and online mode is INCOMPLETE/UNAVAILABLE. Do not mount the original repository/home/credentials or substitute native/networked execution when a prerequisite fails. **Hygiene, not a boundary against same-user native processes; WSL is not a security boundary against the Windows user.** Source URL: [Tier-2-lite contract](tier2-lite.md), source date 2026-10-09.

**INFERENCE — One verification entry point.** From the repository root, the wrapper below runs existing package typecheck/build/unit suites and compiles both existing host harnesses. It does not launch VS Code by default:

```powershell
powershell.exe -NoProfile -File ".\docs\secretguard\guarantee-program-2026-10-09\phase4\verify-all.ps1"
```

**INFERENCE — Optional user-owned host run.** The builder never launches the host. For a later user-run comparison, close VS Code yourself and replace the path below with the isolated test editor's existing `Code.exe`. `-HostHarness Both` is the default host choice; the other accepted choices are `NativeBaseline` and `SecurityReview`. No direct harness command is needed:

```powershell
powershell.exe -NoProfile -File ".\docs\secretguard\guarantee-program-2026-10-09\phase4\verify-all.ps1" -RunHost -CodePath "C:\path\to\isolated-test-editor\Code.exe" -HostHarness Both
```

**FACT — Wrapper source, inspected 2026-10-10.** [verify-all.ps1](verify-all.ps1) creates a unique repository-local evidence directory, preserves logs/hashes, refuses reused/linked output, requires an existing isolated editor path for `-RunHost` and does not close other editor processes. **INFERENCE:** Keep synthetic fixtures/fresh synthetic history/loopback recipients and the isolated profile. Read raw findings and positive controls alongside command results: A0's completed harness recorded 7 scoped blocks and 10 leaks, so command success is not confidentiality success. A user host run also does not substitute for the different-model fresh independent session or a real-agent matrix cell.

**INFERENCE — Rollback flags withdraw operations.** Leave accepted deny state and review evidence intact. The flags below turn off their added operation or claim; they do not authorize loading an older weaker binary or exporting unfiltered data. Source URL: [batch rollback records](progress-ledger.md), source dates 2026-10-09/10.

| Flag/input set off | Withdrawal behavior |
|---|---|
| `soterai.hardening.safeDiffLaunch` | INFERENCE: no managed diff sharing; no ambient/bare-Git fallback. |
| `soterai.hardening.coverageDisclosure` | INFERENCE: no one-click setup flow; no blanket success display. |
| `soterai.hardening.addOnlyPolicy` | INFERENCE: no affected managed sharing/mutation; accepted rules remain retained. |
| `soterai.hardening.scopedConfirmation` | INFERENCE: affected weakening/approval actions are unavailable; no promptless fallback. |
| `soterai.hardening.runtimeEvidence` | INFERENCE: evidence/status claims are withdrawn; no cached verified state. |
| `soterai.hardening.secretInventory` | INFERENCE: new reference creation/reads unavailable; cleanup/recovery remains available. |
| `SOTERAI_BROKER_WIN32_ACL_VALIDATE=0` | INFERENCE: Windows file authentication unavailable; no unchecked token-read fallback. |
| `SOTERAI_BROKER_TRUSTED_SANDBOX_CLAIMS=0` | INFERENCE: advisory process preview unavailable; no execution or attested-sandbox claim. |
| Tier-2-lite input `enabled=false` | INFERENCE: generation unavailable before source/policy access; no original-workspace/native/online fallback. |

**INFERENCE — Limits after rollback.** Already disclosed/generated bytes cannot be recalled. Actual ACL backup restoration is an emergency narrowly scoped operation under the existing approval, with any reintroduced group exposure labelled INCOMPLETE; this guide performs no permission change. Independent protected editing, C confirmation, W continuity, mandatory E and S/M authority are not implemented. The [release checklist](release-checklist.md) therefore retains full-protection release BLOCKED.
