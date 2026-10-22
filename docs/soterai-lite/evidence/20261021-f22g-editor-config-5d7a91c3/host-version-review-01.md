# F22g editor-host version transition review 01

Reviewed 2026-10-21T16:00:12.505Z. Status: **static review complete; native verification pending**. Evidence independence: LOW.

The two retained F22g launches used Code 1.142.0, SHA256 5ca701a1facb91fec1ac6bbae11fc837821a1da34ddebb91a0bad7e87ab88144. Both refused startup while the setup mutex remained active. Each exited 1 with both output streams closed, signals 0, and no driver results. These are startup failures, not completed native tests.

The installed Code application changed externally. Current executable is Code 1.143.0, SHA256 f13f0179b0e6ec0251e22adbd123fe5f252fa227421b2128cf21379cf5941d58, 238249824 bytes; app commit 2d0b7506a36c1d6db9a466440131a8e01eab2289. The old 6d62b1d5da app directory is absent. No agent download, update, rollback or process intervention was performed. This is a new editor-host binding and must not be described as an unchanged-pin retry. Original client vendor pins remain unchanged.

Read-only installed-source checks found workspace.fs async read/write, stable findFiles, native picker/warning dispatch, extension-scoped SecretStorage methods/events, and separate global/default/workspace configuration inspection fields. The packaged extension engine ^1.85.0 admits 1.143.0. No missing stable API or source-level incompatibility was identified. Prior application source was unavailable for a behavioral diff, and source presence does not prove runtime behavior. The JSON receipt binds exact app files, method witnesses, offsets and old startup evidence.

At 2026-10-21T15:55:00.0852046Z, read-only Mutex.OpenExisting with ReadPermissions returned NOT_FOUND for vscode-updating. There were no wait, acquire, release or signal calls. This observation does not establish every updater activity has completed. Installed main source retains the bounded setup-mutex startup check; no bypass is proposed.

Static review supports preparing an explicitly version-bound isolated 1.143.0 fixture run. Before any launch, produce a new fixture/prelaunch receipt and recheck the exact executable/app identity; retain the same exact F22g VSIX/runtime/driver/payload/assertions/budgets and all old failures. Fresh new-family and affected native checks, natural owned withdrawal, both EOF and signals 0 remain required. No actual F22g host verification under 1.143.0 has occurred.

This review launched no host, read no normal profile or credentials, enumerated no processes, sent no signals, and changed no fixture, source, queue, updater or OS setting. Only this note and its JSON receipt were created.
