# F26a checked owner context and config transport test contract

Test authoring under the existing F26a plan/card only. Two new test files contain 30 cases: `checkedOwnerHookContext.test.ts` has 12; `ownerHookGitProcess.test.ts` has 18. No tests, module wrappers, compiler/build, Git, hooks, real children, network or native editor were executed by this author. Missing-module baselines and production implementation remain root-owned work.

## Checked context

`prepareCheckedOwnerHookContext(root, ambient, enabled): Promise<context | undefined>` internally creates a fresh genuine `CheckedGitMetadata` for exactly that root and uses `buildOwnerHookEnvironment(ambient)` for its own frozen environment. `isCheckedOwnerHookContext(value)` recognizes only genuine capabilities without invoking caller traps. The readonly context contains `{root, metadata, environment, available()}`. There is no caller-borrowed metadata input.

Cases check genuine frozen capability/root identity; exact owner environment distinct from the scanner environment; fresh metadata both on repeated preparation of one root and on a second root; clone/accessor/proxy/unrelated-metadata refusal; disabled/throwing authority before local config read; invalid ambient/root refusal; sticky disable/reenable and throwing guards; local config drift; private metadata-job drift; `.git` ancestor junction replacement; and observed pinned-Git identity drift. The latter changes only the synchronous stat observation inside a restored-in-finally test wrapper; it never writes or replaces the installed executable.

The context does not witness the global config projection or a future commit's environment. A genuine context alone cannot prove effective hooksPath. The installer must explicitly query again before/after mutation and before publishing installed state. Future external overrides remain cooperative limitations.

## Owned Git projection process

`new OwnerHookGitProcess({context, operation, valid, deadline, now?, spawn?})` offers one-shot `start()`, `closed`, `busy`, and `withdraw()`. Exact operations are strings `version` and `config`. Complete results are frozen private `{status:'COMPLETE',bytes:Buffer}`; refusals are frozen value-free `{status:'UNAVAILABLE'|'STOP_UNCONFIRMED'}`.

Both operations use the pinned executable, `shell:false`, `windowsHide:true`, ignored stdin and piped stdout/stderr, with exactly `context.environment`. They must not use the scanner's metadata environment, safeGitArguments, empty hooks, a substituted global config or an ambient executable. Version arguments are exactly `['--version']`, cwd `context.metadata.job`. Config cwd is the captured root and arguments are exactly:

```text
--no-pager --no-optional-locks
-c protocol.allow=never
-c credential.helper=
-c credential.interactive=false
config --null --show-origin --show-scope --no-includes --get-regexp
^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$
```

Root confirmed the transport returns bounded private version bytes rather than parsing their version text; exact pinned version recognition belongs to the caller's `supportsCheckedGitVersion`. Thus 4096-byte version and 65536-byte config payloads have positive boundary controls, while one extra byte withdraws and retains ownership. Any stderr withholds, including the otherwise permissible config exit1 path. Only config exit1 with empty stdout/stderr may complete empty. Exit0/caps/live authority still require actual child close and both EOFs; no signal, missing exit or wrapper observation substitutes.

The 18 cases cover exact launch contracts; empty config exit1 versus nonempty/version exit1; both closure orders; nonzero/null/signalled closes; stderr1/8192/8193; both exact stdout caps and overflow; copied private chunks; invalid operations without coercion; forged context accessors; one-shot/prewithdrawal; active withdrawal/busy until actual closure; invalid initial deadlines/guards; elapsed/reversed/nonfinite clocks and a hard60sec clamp; post-callback expiry/reentrant withdrawal; early/late context drift; thrown/no-PID spawn failure; and child/stdout/stderr errors after actual PID ownership.

Fake children record literal arguments/options/input and reject kill/destroy attempts. Assertions prohibit abort signals, timeout/kill options or stdin payloads. Deterministic injected clocks remain valid through fake admission before advancing; tests do not extend the deadline or weaken the required owned-child assertions. The invalid undefined operation is passed through an explicit option override so fixture defaults cannot turn it into version.

## Custody and scope

All repository/index fixtures are manual synthetic ordinary `.git` directories with an empty SHA1 DIRC and inert config/HEAD; roots and metadata jobs are retained. Future test execution reads the pinned executable identity through genuine metadata validation, not its contents as a hook/config and not by executing it. No normal user profile/config/history is inspected. Process events are entirely fake.

`owner-hook-context-process-preproduction-01/` retains exact current OwnerHookProtocol/CheckedGitMetadata/PreCommitGitProcess context snapshots and authored test copies. The author freeze records exact hashes, case counts, absence of both new production modules, and unchanged reference bytes. It is authoring/custody evidence only: no static compiler or behavior success is claimed. Root must retain the actual 30-case missing-module baseline before adding production and then run fresh current gates separately.
