# F09 owned-job fixture freeze 01

Test source: `packages/vscode-extension/src/__tests__/vaultAppJob.test.ts`.

Source bytes: 26,291. SHA-256: `45b01d261cfa98268c8c7acfdfcfbee5a37d213d55833962348c096f1f244650`.

Declared executable cases: **33**, with 26 distinct IDs J01-J26; J04 expands into eight invalid-registration cases. This is a fixture count, not a pass claim. No tests, product processes, packaging checks or Git mutations were executed by the fixture author. The production module was absent when authoring began. Each case dynamically imports it so a missing-feature baseline can count the declared failures rather than aborting the whole file at import time.

Frozen inputs read before baseline:

- design-01.md SHA-256 `fabd53d6e3b17706774107acfe10d6bf2d12b7fc7e68873051738c14ad421e92`.
- design-02.md SHA-256 `b292829ddd54604ae135278661b70e4f6f2f8e4c1e62f71242d6ef0d9c632b8a`.
- design-03.md SHA-256 `2db7c5118dc5e837ccbc3c75260f5340779e939fdd046ecf424dbb0793ba09c6`.

The synthetic EventEmitter child has real PassThrough pipes, asynchronous spawn/READY events, captured private IPC, explicit close/EOF and controlled lifecycle timers. Its kill method always throws and records any prohibited attempt. Cases cover fresh validated child environments, no value-bearing spawn options/argv, one-shot private READY/START, exact names/registration budgets, atomic output release, ANSI/encoding/Unicode/nonzero behavior, output overflow and discarded-channel draining, cancellation/withdrawal, ACK versus actual exit, STOP_UNCONFIRMED, errors, premature closure and ownership-preserving disposal. START payload assertions inspect the explicitly authorized private sink; all public metadata assertions exclude the synthetic values.

Three real finite Node fixtures are source-only until the root runs the baseline: selected DB injection with masked completed output, a fresh sibling without the prior DB selection, and an app that ignores STOP but naturally finishes after 1.6 seconds. The last case waits for its own constant public readiness marker before requesting STOP. These apps never call process.exit or kill. All temporary files use the root-provided TEMP directory, unique mkdtemp names and a synthetic ownership marker. Cleanup checks canonical parent ownership and the exact public file list before removing its own directory. No real workspace, normal editor profile, network, credential file or secret-bearing temporary file is used.

Independence: **LOW**, same-lineage contract fixtures. Mock/native behavior, OS confinement, independent AI routes and app behavior outside managed completed stdout/stderr remain separate acceptance scopes.
