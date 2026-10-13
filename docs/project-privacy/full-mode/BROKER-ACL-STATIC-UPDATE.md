# Broker storage static update

**FACT / scope (2026-10-12):** Inspected source and security-descriptor metadata read-only at the default `C:\Users\USER\.soterai\broker` location and its parents. Token values were not opened, read or printed. No ACL edit or broker startup/authentication probe occurred. Custom storage overrides remain uninspected. Sources: [SDDL/metadata backup](../evidence/20261012-runtime-plan/broker-default-acl-backup.json), [icacls output](../evidence/20261012-runtime-plan/broker-default-icacls-readonly.txt).

Every row is **FACT / current read-only observation (2026-10-12)**.

| Asset | Observation | Interpretation scope |
|---|---|---|
| Default `auth-token` | Present, current-user owned, inheritance protected; explicit full-control entries only for owner, SYSTEM and Administrators | Earlier inherited-group-read observation is historical; it is not present on this file now. No dynamic authentication or same-user denial was demonstrated. |
| Default `control-auth-token` | Absent | No ACL can be inspected for a nonexistent file. Deployment/credential provisioning remains INCOMPLETE; no token was generated here. |
| Default broker directory | Current-user owned, inheritance protected; same three explicit principals | Metadata matches the intended private-directory shape; not a guarantee of independent custody from the same user. |
| `.soterai` parent | Inheritance enabled; foreign SID ending `-1007` has ReadAndExecute, plus owner/SYSTEM/Admin grants | The inspected broker/token entries do not inherit this read grant. Parent replacement, other storage and same-user authority still need their own evidence. |
| User profile, `C:\Users`, `C:\` | SDDL/access metadata captured | No ancestor ACL was edited or assumed to be independently protected. |

Source: [full metadata backup](../evidence/20261012-runtime-plan/broker-default-acl-backup.json).

**FACT / current source (2026-10-12):** `auth.ts` now invokes Windows ACL validation for the directory, immediate parent and token paths; it no longer simply skips permission checks on win32. `WindowsAcl.ts` rejects foreign token/directory principals and disabling file validation denies file-based authentication. The credential loader requires distinct client/control credentials and has no client-token fallback for missing controller credentials. This is source review, not a new dynamic reproduction. Sources: [auth.ts](../../../apps/local-ai-broker/src/auth.ts), [WindowsAcl.ts](../../../apps/local-ai-broker/src/WindowsAcl.ts), [CLI storage default](../../../apps/local-ai-broker/src/cli.ts).

**INFERENCE / remaining limit:** Owner full control still means a native process under that OS user can potentially read those owner-accessible files. A private DACL does not distinguish a trusted application from a rogue process holding the same authority. The isolated guest must have no host-file bridge or owner credential/control-channel access before a stronger claim is made.

**FACT / historical evidence treatment (2026-10-12):** This new observation does not rewrite Phase 1/A0 or convert prior failures to passes. F16/credential decryption reproduction is not performed. Full G1-G6 remains BLOCKED, and the retained nine unmanaged-route host leaks are unchanged. Sources: [historical report](../FINAL-LOCAL-REPORT.md), [deployment gates](../DEPLOYMENT-GATES.md).

**INFERENCE / action:** No new icacls mutation is justified for the already protected default token/directory in this inspection. Any new control-token provisioning, custom-store remediation, parent ACL changes or independent controller/key custody must be proposed and authorized separately. Keep the saved descriptors as a metadata backup; do not automatically restore them over subsequent owner changes.
