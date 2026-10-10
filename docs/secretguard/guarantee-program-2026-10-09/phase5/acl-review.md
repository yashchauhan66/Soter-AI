# Read-only ACL review

**FACT — Observation, 2026-10-10.** Windows build **26300.8935**, active USER SID `S-1-5-21-576938901-594400856-1755335594-1001`, shell **not elevated**. [Complete DACL/metadata](evidence/S3-20261010T103700Z/acl-metadata.json), [raw icacls](evidence/S3-20261010T103700Z/icacls-output.json), [initial hashes](evidence/S3-20261010T103700Z/SHA256SUMS.txt). No file contents or token values were read. All access conclusions below are **STATIC-ONLY**, not dynamic effective-access results.

| Named object | Observed metadata | Disposition |
|---|---|---|
| `C:/Users/USER/.soterai/broker` | Inheritance disabled; explicit SYSTEM, Administrators and USER full control; no CodexSandboxUsers ACE | Earlier broker hardening remains present; no further ACL change needed |
| `broker/auth-token` | Inheritance disabled; explicit SYSTEM, Administrators and USER full control; no CodexSandboxUsers ACE | Group-read finding removed at this object; same-user owner authority remains |
| `broker/control-auth-token` | Does not exist | **INCOMPLETE**, no ACL/value can be inspected; not provisioned in this review |
| `.soterai` parent | Inheritance enabled; CodexSandboxUsers has read/execute/synchronize ACE | Reported only; parent read is not proof of access through the broker's protected DACL |
| Main profile / `C:/Users` / `C:/` | Profile and these ancestors disable inheritance; no named CodexSandboxUsers ACE in those DACLs; other system/owner ACEs retained | Parent metadata inspected, no profile access guarantee inferred |
| `.aws` and `.ssh` directory candidates | Inheritance enabled; SYSTEM/Administrators/USER full control; no named CodexSandboxUsers ACE | Directory-only metadata; child contents/ACLs and complete inventory not inspected |
| `.codex` | Explicit CodexSandboxUsers read/execute ACE plus numerous explicit deny ACEs for other SIDs | Tool-owned ACLs reported only; no modification or effective-access claim |
| `OneDrive`, `Desktop`, repository | CodexSandboxUsers modify/synchronize ACEs; repository has both explicit and inherited entries | Reported only; agent/tool write authority exists in workspace policy/code/evidence locations |
| Repository `.env` | Exists, inheritance enabled; CodexSandboxUsers modify/synchronize ACE | **STATIC-ONLY exposure**; content never read; no non-broker ACL modification authorized |

**FACT — Group identity.** CodexSandboxUsers SID ends `1007`; recorded members are CodexSandboxOffline SID ending `1008` and CodexSandboxOnline ending `1009`. Membership and ACE presence do not by themselves establish a running process's effective token, deny ordering, privileges or actual file access. No group/account was changed.

**FACT — Backup and changes.** Current directory/auth-token DACLs were saved using `icacls /save` to [broker-directory.acl](evidence/S3-20261010T103700Z/broker-directory.acl) and [auth-token.acl](evidence/S3-20261010T103700Z/auth-token.acl); [backup output and hashes](evidence/S3-20261010T103700Z/backup-SHA256SUMS.txt). **Zero ACL changes** applied. Backup contains ACL metadata only. No restore was necessary. Earlier B2 backup/repair evidence remains unchanged.

**INFERENCE — Proposed response.** Keep the already protected broker DACLs. If later metadata shows drift, take a new exact-object ACL backup before restricting inheritance and removing the group grant on only the broker directory and existing named token files; validate those DACLs and restore the saved ACL on failure. Do not repair profile/OneDrive/.codex/CodexSandboxUsers ACLs through this program. No `icacls` mutation commands are currently proposed for execution because the two existing authorized objects already satisfy the scoped metadata rule.

**INFERENCE — Open limits.** The owner retains full control and same-user processes share that authority. This does not supply independent controller/key custody, application-isolated DPAPI, protected editor UI or mandatory networking. S2's synthetic startup tests cover missing/unsafe controller storage and distinct credentials; they do not inspect or repair a real absent controller token. The full list of protected user folders is unavailable, so inventory is **INCOMPLETE** rather than “all reviewed.”
