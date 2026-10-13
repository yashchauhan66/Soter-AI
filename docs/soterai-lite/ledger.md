# SoterAI Lite ledger

Read this file FIRST after any context compaction or on resumption. Do not overwrite evidence or repeat finished work. User request identity is recorded in `evidence/20261013-l0-disk-gate-51f892d0/request-identity.json`.

## Current state

- **L0 INCOMPLETE: disk gate FAIL; explicit user STOP condition reached.**
- L1-L7: **NOT-RUN**. Do not describe this stop as reaching L6.
- No extension behavior, workspace protection, vendor configuration, or normal VS Code profile has changed.
- New Lite VSIX: **NOT-BUILT**. Coverage, requirement ratings, hostile sub-score, old score, and prior reported results: **UNVERIFIED / NOT-RUN**, as applicable.
- Baseline HEAD: `8ef3aeb54f4019f4ee815a844443995176a656f0`; starting branch: `security-hardening`. Existing user modifications remain uncommitted.
- Only small stop evidence is being committed on the pre-authorized `soterai-lite` branch. Branch/commit outcome is recorded separately; a planned command is not a completed claim.

## STEP RECEIPT L0.1 — preflight stop

Result: **FAIL** (disk gate); **INCOMPLETE** (L0 overall).

Exact executed gate command:

```powershell
& '.\docs\soterai-lite\evidence\20261013-l0-disk-gate-51f892d0\preflight.ps1'
```

The exact read-only commands for disk measurement, Git status, branch, HEAD and request hashing are in that script. Raw measurement and Git outputs are saved beside it. The exec tool reported exit code `1`; the script requested `20`. Both are recorded explicitly in `execution-result.json`.

Saved measurement: **3,051,290,624 bytes available on C:** at `2026-10-13T04:19:12.0779265Z`, using `System.IO.DriveInfo.AvailableFreeSpace`. This is **3.051290624 GB / 2.84173583984375 GiB**, below both 20 GB and 20 GiB. Earlier direct measurement: 3,091,800,064 bytes; also FAIL. Initial null `Get-PSDrive.Free` was not treated as zero. CIM corroboration was INCOMPLETE with exact message `Get-CimInstance : Access denied`; see `initial-observations.txt`.

The request says "check free disk (>= 20 GB else STOP)". This specific gate overrides continued stage work. No disk cleanup, process termination, download, login, publication, backup bundle, fsck, catalog freeze, split, build, suite, host test or installation was performed.

Files changed and computed SHA-256 (paths relative to this directory):

| File | SHA-256 |
| --- | --- |
| `evidence/20261013-l0-disk-gate-51f892d0/disk-measurement.json` | `F7671CC5974FD259559333ED97B98E6E8B15157E086E37BB2408982E7E984123` |
| `evidence/20261013-l0-disk-gate-51f892d0/execution-result.json` | `62426054221BD145ACDE4120962CE83F8D073121A77C88A0D437EACFB56C7623` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-branch-before.txt` | `8DF13568F5FBD22AC0AEA86D7883CB03A3747EA614DE8226144C5BBC145BF9A0` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-head-before.txt` | `99188ED9196A8FA235B4CE86C10DEFFC27B2C3715F3E2F6AAF3FFE90DA1440F1` |
| `evidence/20261013-l0-disk-gate-51f892d0/git-status-before.txt` | `8FAB22024A0FAC804C38722BFEFF22F04F95C3C38ACC9F509D683D175798F7C5` |
| `evidence/20261013-l0-disk-gate-51f892d0/initial-observations.txt` | `3E91D26B42A056FEE5B9A5A2AF3D66E3E563E347E6A58393CF97ED3D29114100` |
| `evidence/20261013-l0-disk-gate-51f892d0/offline-hooks/.keep` | `44F4DD67009324A9FD4FAED0040A49CD696429EC8C7AD062BA6BDE15178A61F9` |
| `evidence/20261013-l0-disk-gate-51f892d0/preflight.ps1` | `87F3E7602B66AE6E5E0C2D0CC9909D42B84D105D04C852A4B8F4667AB4392CA9` |
| `evidence/20261013-l0-disk-gate-51f892d0/request-identity.json` | `341A4EB78E684F942665661F0948929D808DC8A2447211644BEB74D5032D71FD` |
| `PREFLIGHT-STOP.md` | `B91E6E35CEB0F72ECC2BC8E7968766D3C6660513CD47AEACAFF6753BF7AF7976` |

The ledger's own computed hash is in `evidence-index.json`, avoiding a self-referential hash. Any later receipt must get a new evidence index; do not overwrite the current one.

Adversarial review: a same-lineage sub-agent checked only the stop decision and unit conversion. Independence **LOW**; this does not count as product review.

What remains unprotected: the existing product configuration is unverified in this task; no new mitigation is installed. The same-user hostile-process model remains outside the intended Lite scope. Cooperative-tool coverage is unmeasured, not assumed.

Next: stop. User frees C: space to at least 20 GiB, then sends the exact resume text in `PREFLIGHT-STOP.md`. Recheck disk with new unique evidence paths before further L0 work. The remaining preflight, catalog freeze and stages have not been completed and must still run.

## Evidence-only Git operation

Planned exact commands, recorded here before execution:

```powershell
git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks switch -c soterai-lite
git add -- docs/soterai-lite
git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "docs(soterai-lite): record failed L0 disk gate and stop"
```

Per-command `core.hooksPath` avoids invoking the existing external Qoder post-commit tracker or LFS checkout hooks. It does not change persistent Git configuration or product protection. Only task evidence may be staged. Verify no unrelated file is staged before committing. Store each command's actual output in a new evidence file, and verify the commit afterwards.

Branch creation is now **PASS**: `git branch --show-current` returned `soterai-lite`. Branch command exit code was `0`; PowerShell represented Git's informational stderr as `NativeCommandError`, which does not indicate a failed switch. Raw output: `evidence/20261013-l0-disk-gate-51f892d0/branch-result.txt`, SHA-256 `E2FEEF21395C0A5B5651E6E5BEC4AEFCD9F84E23EF42FA083E58F125E0F8A2F9`.

The initial `evidence-index.json` snapshot was verified: **11 entries checked, 0 hash mismatches**, before this append. Preserve that index as a historical snapshot; `evidence-index-20261013-l0-stop.json` records the final appended ledger and all pre-commit files. Actual staging uses `git -c core.autocrlf=false add -- docs/soterai-lite` to preserve evidence bytes. This per-command option leaves persistent Git configuration unchanged. The exact final mutation commands are in `evidence/20261013-l0-disk-gate-51f892d0/commit-evidence.ps1`; raw commit output and post-commit identity will be written to new files after the commit and are deliberately outside that commit.
