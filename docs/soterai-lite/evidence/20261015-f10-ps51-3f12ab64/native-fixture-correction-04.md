# F10 native first-run triage and fixture correction

First actual native launch02 used exact VSIX
`soterai-lite-0.7.0-f10-20261017-attempt01.vsix`, SHA256
`7e72e53f061eb07c7500bc383b32926b6c80af6f848497e95cea1c7c480e5db2`,
runtime `92847f4c7a09ac17fd86420281caf4a59f1794ff216b3b38f93d51e555b4ce83`,
and host `d78f328194c160490bd63cb0d9d74be7fc790d049ad632ecced1dcead3c81c9f`.
Raw `native-launch-02.txt` SHA256
`0a9324cf0b01519047374a98e3e236909146eccddd65077d39f3d30addae5272`,
exit1. Primary result is retained under
`f10-native-host-20261017T021758Z-fa84651a/primary-results.json`.

Actual Code1.142.0 primary16: **15 PASS / 1 FAIL / 0 NOT_RUN**. Only F10-H05
failed with `AssertionError`. The record lacks a finer substep, so version,
location, date, listing and ownership assertions cannot each be assigned an
executed result. Assertions after the first failure remain unexecuted. Native
registered-value output, cancellation, withdrawal, affected F09 task, profile
undo and actual staged-only Git checks are recorded PASS in that historical
object only. Restart was NOT_RUN because the launcher correctly rejected the
incomplete primary phase; no 19-check PASS is claimed.

Read-only inspection found a definite fixture portability bug in H05: strict
string equality compared `resolve(pwd.stdout)` with `resolve(workspace.fsPath)`
on Windows. The observed workspace is lowercase `d:\...`; the launcher uses
uppercase `D:\...`, and PowerShell's filesystem drive may preserve uppercase.
Node's `resolve` does not fold that case. This is a plausible cause of the H05
failure; the existing metadata cannot prove which assertion failed.

The fixture now compares normalized absolute paths using Windows case folding
on Windows only. It additionally records only constant H05 substep ids and two
path-equality booleans, never path text or original input/output, so a fresh run
can identify the exact failed assertion without secret-bearing diagnostics.
All status/version/date/listing/ownership assertions remain. Count is still
primary16 plus restart3. No product code or transition scripts were changed.

The old host/prebuilt/results remain immutable. Root must build a uniquely named
new host and run a fresh isolated native fixture against the final new artifact.
No build, native execution, process termination or escalation was performed by
this test author for this correction. This same-lineage triage is LOW evidence.
