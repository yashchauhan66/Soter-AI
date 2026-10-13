# L0 preflight: stopped at the disk gate

Result: **FAIL**. L0 is **INCOMPLETE**. L1-L7 are **NOT-RUN**.

The workspace is on C:. The saved measurement found 3,051,290,624 bytes available to the current process: 3.051 GB / 2.842 GiB. This is below the user's required 20 GB under either decimal or binary interpretation. The earlier direct measurement was 3,091,800,064 bytes (3.092 GB / 2.879 GiB); both fail. Available space can change while other applications run.

The request explicitly says: "check free disk (>= 20 GB else STOP)". This specific preflight stop applies before the general instruction to continue through L6. No implementation or test work proceeded after the failed gate. Only this small evidence record and its local commit were prepared.

`Get-PSDrive.Free` was unavailable in the first command; its derived display of zero is not a valid disk measurement. CIM corroboration returned `Get-CimInstance : Access denied`; that attempt is INCOMPLETE. `.NET DriveInfo.AvailableFreeSpace` provided the conclusive measurement. The stored script records the exact commands and does not print environment values or read secret files.

## What remains

- Current project changes have not been checkpointed; their preflight status is preserved in the evidence. The evidence-only commit does not stage existing user changes.
- Git-bundle backup, `git fsck`, input allowlist, feature split, catalog freeze, implementation, VSIX build/install, all suites, coverage measurement, release preparation, and the independent-review packet: NOT-RUN.
- Supported tools, loaded extension identity, platform behavior, requirement ratings, and prior reported test/leak counts: UNVERIFIED.
- Lite Coverage Score, hostile-same-user sub-score, and old 10-scenario score: NOT-RUN. No percentage is inferred from previous reports or from implementation intent.
- New Lite bundle: NOT-BUILT; no final bundle SHA-256 exists.
- Independence: LOW. A same-lineage sub-agent reviewed only the interpretation of this stop condition; it did not verify the product.
- Protection remains the pre-existing configuration, whose behavior has not been re-verified in this task. No product safety claim is made.

## Resume

Free space on C: through your own chosen actions until at least 20 GiB is available (this satisfies either unit interpretation). No files or processes were deleted by this task. Then send:

> resume L0; C: now has at least 20 GiB free. Re-read docs/soterai-lite/ledger.md first, re-check the disk gate with new evidence files, and continue L0 through L6.

This is a preflight retry, not the L7 independent-review resume. No independent report is required yet.

Evidence: [disk measurement](evidence/20261013-l0-disk-gate-51f892d0/disk-measurement.json), [exact commands](evidence/20261013-l0-disk-gate-51f892d0/preflight.ps1), [initial observations](evidence/20261013-l0-disk-gate-51f892d0/initial-observations.txt), [execution result](evidence/20261013-l0-disk-gate-51f892d0/execution-result.json), and [ledger](ledger.md). Hashes are in `evidence-index.json`.
