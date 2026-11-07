# F26a owner projection protocol and environment test contract

Test authoring under the existing F26a card and plan. This is not a replacement plan or production implementation. The author has not run tests, imports, Git, compiler/build, hook, child or network work. Fixtures contain only synthetic strings/bytes and do not inspect process environment, user config/history or the filesystem. Missing module/API baselines and current execution remain root-owned work.

New `src/__tests__/ownerHookProtocol.test.ts` has 14 cases; `src/__tests__/ownerHookEnvironment.test.ts` has 12. Both dynamically import the new `history-hooks/OwnerHookProtocol` API without a static missing-export dependency.

## Exact query framing

Installed `git-config.adoc` lines257-264 specify LF between key/value and NUL terminating a value, while lines276-285 describe origin/scope fields without their exact byte delimiters. The author asked root before freezing. Root's actual pinned-Git synthetic `owner-config-framing-witness-01.json` confirms:

```text
scope NUL origin NUL key LF value NUL
local\0file:.git/config\0core.hookspath\n.synthetic-hooks\0
```

The exact local stdout is 55 bytes and is bound in the author freeze. Root also observed include and global records in that frame; Windows absolute global origin spelling uses backslashes. No-match is actual exit1 with zero stdout/stderr. Those are root's actual isolated framing facts, not execution or parser PASS by this author. The pure parser does not infer child success from empty bytes: its caller must separately validate the actual query outcome/closure.

## Parser API and scope

```ts
parseOwnerHookConfig(raw: Buffer, root: string): Readonly<{ hooksRelative: string }> | undefined
```

Empty bytes select only frozen `{hooksRelative:'.git/hooks'}`. Otherwise exactly one direct local `core.hookspath` record is supported, with origin `file:.git/config` or exact canonical absolute root `\.git\config`. A literal canonical forward-slash relative hooks path may include `.git/custom-hooks`, spaces, Unicode and leading dashes. Output contains only the relative selection, never origin/key/other configuration values, and grants no filesystem or owner capability.

Whole refusal covers other scopes, includes/includeIf/worktree settings/unknown keys, duplicates/multiple/trailing records, 17-record overflow, malformed framing, fatal UTF8/BOM, more than64KiB raw input, outside/noncanonical/absolute/expanded paths, traversal/ADS/short aliases/device/control components, invalid root, nonBuffer/proxy/coercion inputs. Native Buffer admission must not invoke caller methods/getters. Positive inputs are preserved exactly. Existing raw and record caps do not authorize a prefix; no16-record acceptance is implied because the supported selection grammar permits only one record.

## Environment API and scope

```ts
buildOwnerHookEnvironment(ambient: NodeJS.ProcessEnv): Readonly<NodeJS.ProcessEnv> | undefined
```

Preserve only exact validated config-discovery context: canonical absolute Windows `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`; optional validated `SystemRoot`, `WINDIR`, `COMSPEC`, `HOMEDRIVE`, `HOMEPATH`. Require usable HOME or USERPROFILE; a drive/path pair alone does not substitute for them. Only exact `GIT_CONFIG_NOSYSTEM='1'` is supported. Paths follow the literal conservative `PreCommitHookText` grammar; no existence checks are allowed by this pure helper.

Reject other ambient `GIT_*` selectors case-insensitively, including query-only GIT_CONFIG, command/config pairs, directory/worktree/index/object selectors, unknown selectors and ambient GIT_PAGER. Reject case-ambiguous discovery names, nonplain/inherited/symbol/accessor/proxy records and nonstring admitted values without coercion. Omit PATH, Node/Electron startup variables, credentials, proxies and other generic values; do not mutate input.

Inject exactly these fixed controls: `GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, `GIT_OPTIONAL_LOCKS=0`, `GIT_PAGER=''`, `PAGER=''`, `GIT_NO_LAZY_FETCH=1`, `GIT_NO_REPLACE_OBJECTS=1`, `GIT_PROTOCOL_FROM_USER=0`, `LC_ALL=C`, `LANG=C`. Return a frozen record. This projection preserves the explicitly supported current owner-discovery context; it is not the scanner's isolated empty-hook environment and does not promise authority over a future external commit's different overrides.

## Custody

`owner-hook-protocol-preproduction-01/` retains exact named existing `PreCommitHookText`, `SafeGit` and `CheckedGitMetadata` source snapshots plus authored test snapshots. The freeze records absence of new OwnerHookProtocol production before implementation, exact test hashes/counts and the root framing witness/streams/run receipt. No behavior/static compiler success is claimed. Root must execute and retain the actual missing-module baseline before adding production, then run current parser/environment checks and compiler separately.
