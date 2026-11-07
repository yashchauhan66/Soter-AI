# F26a owner effective hooks: read-only design findings

Design review under the existing F26a card, not a new plan. No Git/config/history command, test, hook, child or production code was executed. No real user/system/repository config contents were read by this review. Only local source/tests and installed Git documentation were read. This document makes no behavior PASS claim.

## Decision

Keep owner hook discovery separate from the scanner capability. `security/SafeGit.ts` replaces home/global config and injects an empty `core.hooksPath`; `terminal/CheckedGitMetadata.ts` additionally pins empty system config. These are correct scanner protections and cannot establish which hook an ordinary owner commit will run. The existing `scanners/continuousGuards.ts` local first-match parser and unreadable-as-absent behavior are insufficient for owner installation.

Use a separate pinned-Git, finite, read-only owner configuration projection. Preserve the captured owner configuration-discovery context for that projection; do not use the scanner's empty-hook/global/system overrides. Query only relevant keys with strict bounded framing and origin/scope information, never `config --list` or raw config output to a public sink. An illustrative query is `git --no-pager config --null --show-origin --show-scope --no-includes --get-regexp` with a fixed expression selecting `core.hookspath`, `include.path`, `includeif.*.path`, and `extensions.worktreeconfig`. Exact argument/framing behavior requires future synthetic fixtures on the pinned executable, not an assumption from this review.

## Explicit supported contract

| Observed current owner context | Installation behavior |
| --- | --- |
| Ordinary canonical non-bare root with real `.git` directory; no relevant hook value or include/worktree ambiguity | Select exact `.git/hooks/pre-commit`. |
| Exactly one `core.hooksPath` record, direct local scope from this exact canonical `.git/config`, with a canonical literal in-root path | Select that directory's `pre-commit`; preserve a supported existing original hook. Relative values resolve from this non-bare root. Spaces are literal path characters. |
| Global, system, command or worktree hook value; duplicate hook declarations even with equal values; include/includeIf declaration; worktree/shared/bare/gitdir-file layout; unknown or malformed framing | Refuse clearly without writes. Do not silently install a default hook or persist a config override. |
| Outside-root, UNC/device/ADS/short-alias, noncanonical, symlink/junction, ambiguous ancestor, unsupported path expansion or unusable existing hook | Refuse without altering the original. |

Unrelated ordinary global/system settings need not make a repository unsupported. The restricted contract concerns hook selection and configuration ambiguity; it does not require every global config file to be absent. Includes may be common, so refusing them is a real supported-scope limit and must be stated plainly.

Treat query exit 0 as usable only with exact bounded records, both stream EOFs and actual closure. A no-match exit 1 is absence only with empty output and stderr and an otherwise valid witnessed context. Other errors, truncation, excess output, unsupported origin, drift, expiry or unconfirmed closure mean unavailable. A read-only command does not by itself guarantee bounded input parsing; apply the existing finite child/ownership discipline and refuse installation while closure is unconfirmed.

## Environment boundary

Reject ambient `GIT_CONFIG`: the installed documentation says it redirects `git config` as `--file` but does not affect other Git commands, so passing it through can make discovery disagree with commit. The minimal contract should also refuse command-injection variables (`GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*`, `GIT_CONFIG_VALUE_*`, `GIT_CONFIG_PARAMETERS`) and conflicting repository-location overrides at installation, rather than silently stripping them and calling the result equivalent.

Capture configuration-discovery names privately: `HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, `XDG_CONFIG_HOME`, plus `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`, and `GIT_CONFIG_NOSYSTEM` only if the implementation explicitly supports and witnesses them. Windows HOME fallback is documented, so retaining only one home variable can change the result. Synthetic native fixtures can point discovery at retained empty or canary config files; this does not authorize agent inspection of normal user configuration.

`--no-includes` specifies the config query's include behavior. The reviewed documentation alone does not prove that every Git startup path avoids reading included configuration. Do not advertise a universal no-external-config-read guarantee from that flag. If that stronger property is required, it needs a separately proved bounded source-discovery/preflight rule; otherwise refuse unsupported contexts without such a claim.

## Drift, encrypted originals and coverage limits

Capture root/`.git` identities, bounded exact local config bytes and identity, selected hooks-directory ancestors (including reviewed absence), existing hook identity/mode/exact private bytes, owner generation/policy/flag and the owner query projection. Recheck after approval, before backup/mutation, after each owned write and before publishing installed state. Re-run the projection to detect newly added global/system hook settings or includes; a local config hash alone cannot detect those. Drift withdraws the plan instead of selecting a new path after approval.

Keep original hook bytes solely in the encrypted recovery store. Preview/receipts expose bounded metadata and opaque recovery references, not original source text or raw Git stderr. Backup and durable PREPARED evidence precede replacement. Undo operates only on the exact unchanged owned path/generation/after-bytes and restores bytes/absence/mode as supported; it never resets `core.hooksPath` to regain control. Retain recovery material whenever restore is unconfirmed, and keep the reviewed restore route available while the feature flag is off.

Installation can witness the current owning editor's configuration context. It cannot know a later external shell's environment or future `git -c`/`--config-env` arguments. A later override can prevent the installed hook from being invoked; neither a service recheck nor a signed decision can then veto that commit. Treat future overrides, hook edits and `--no-verify` as explicit cooperative limits. Do not force a hooks path on owner commits to manufacture a positive native test. Actual default/custom positive commits must demonstrate the selected owned hook and a preserved harmless original hook really ran.

## Primary local references inspected

- `C:/Program Files/Git/mingw64/share/doc/git-doc/git-config.html`: 809-819 origins/scopes; 937-979 sources and precedence; 1086-1097 command environment injection; 1104-1110 config-only `GIT_CONFIG`; 1368-1388 includes; 3610-3633 hook directory and relative path semantics.
- Same directory `git-config.adoc`: 298-303 include flag behavior.
- Same directory `git.html`: 554-563 `--config-env`; 1834-1839 Windows HOME fallback; 2170-2187 global/system discovery overrides.
- Same directory `githooks.html`: 463-484 executable hooks, root working directory and hook environment; 563-569 pre-commit and bypass/exit behavior.
- Existing local source/tests: `scanners/continuousGuards.ts`, `__tests__/continuous-guards.test.ts`, `security/SafeGit.ts`, `terminal/CheckedGitMetadata.ts`, and prepared F26a hook-text/owner-service tests. Their existence or assertions are not new execution evidence.
