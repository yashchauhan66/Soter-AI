# Current-candidate V01 execution successors

These files prepare and verify fresh runs. No native check has been executed by this preparation. The coordinating root runs them after F26a/F32 release the isolated Code host. All outputs are new; old failures, native results and 17-case baseline stay unchanged.

The final candidate has now been materialized: VSIX SHA256 `011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec`, source proof `23fd63bb04122bf055f656a77424085b75ff3e3c813121c15034cd209fd1c8f6`. Common affected `20261106-v01-current-01`, Cline `20261106-v01-cline-01`, Claude `20261106-v01-claude-02`, and Gemini `20261106-v01-gemini-02` all passed read-only admission and PowerShell syntax checks with actual exit0. All 21 local controls passed. The exact run commands below use these materialized directories; do not rerun preparation over them.

The original sandbox preparation failed with esbuild EPERM and is retained in `20261106-v01-current-preparation-failed-01`; root's same approved preparation subsequently succeeded. Claude preparation01 hit ENOSPC while copying its public binary into workspace staging. Its failure receipt and small partial files remain in `20261106-v01-claude-01`; the failed binary was absent afterward. Claude02/Gemini02 use exact retained D: inputs directly, without large C: vendor clones. No native attempt was consumed by either preparation failure.

Use the freshly qualified `f32-candidate-config.json` produced by the root. Its descriptors must identify the final source proof, full-suite evidence, qualification and VSIX. An explicitly documented metadata-only reuse qualification may reference retained original full-suite execution; it must not call that a new full-suite run.

Optional evidence-only config fields: `affectedOutput` selects a fresh sibling directory for the common affected preparation; `routeAttempt` is a two-digit fresh route suffix (default `01`); `routeIds` selects any nonempty subset of `cline`, `claude`, `gemini`. These permit a new successor after diagnosis while preserving all prior files. Never overwrite an earlier attempt.

From the repository root:

```powershell
node docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/prepare-v01-affected.cjs <absolute-current-f32-candidate-config.json>
powershell -NoProfile -File docs/soterai-lite/evidence/20261106-v01-current-01/syntax.ps1
node docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/prepare-v01-routes.cjs <absolute-current-f32-candidate-config.json>
```

Preparation extracts all 18 qualified archive entries, freshly bundles six host drivers and pins their complete input graph. It requires current source/full/package consistency, and never imports the product or launches Code. The three route preparations retain the exact original matrix/guard files, reobserve public tool inputs and add actual Code close/both-EOF custody. Only exact original hashes can qualify; no vendor installation is attempted.

The 6 November read-only observation found current installed Cline **4.1.26** and Claude **2.1.318**, outside these original selected-version fixtures. Their original **4.1.25 / 2.1.301** public inputs remain byte-identical in retained D: test copies. The generated wrapper copies these public inputs directly into its new D: run, excludes only the known prior synthetic vendor-bootstrap files, and labels them retained exact vendor bytes. It does not claim current-installed-version coverage. Gemini **0.55.1** remains installed with matching bytes; its exact picomatch **4.0.2** dependency is recovered from the retained isolated public copy. `vendor-pins-observation-01.json` retains the missing original paths, and `vendor-pins-observation-02.json` proves the selected fallback hashes match. Neither is route execution evidence.

Run hosts sequentially after the root's lifecycle work:

```powershell
node docs/soterai-lite/evidence/20261106-v01-current-01/run-v01-affected.cjs
node docs/soterai-lite/evidence/20261106-v01-current-01/verify-v01-affected.cjs
powershell -NoProfile -File docs/soterai-lite/evidence/20261106-v01-cline-01/syntax.ps1
node docs/soterai-lite/evidence/20261106-v01-cline-01/run-v01-route.cjs
powershell -NoProfile -File docs/soterai-lite/evidence/20261106-v01-claude-02/syntax.ps1
node docs/soterai-lite/evidence/20261106-v01-claude-02/run-v01-route.cjs
powershell -NoProfile -File docs/soterai-lite/evidence/20261106-v01-gemini-02/syntax.ps1
node docs/soterai-lite/evidence/20261106-v01-gemini-02/run-v01-route.cjs
```

Affected scope is PS5.1 **19**, editor **25**, MCP **25**, retained broker **106** = **175 assertions / eight phases**, plus functional **10** and security **17**. `affected-acceptance.json` requires actual source/package/loaded runtime hashes, assertion identities, original D: result bytes, natural exit0 and both EOFs. It includes every security case and explicitly preserves **8 BLOCKED_SCOPED and 9 LEAK_CONFIRMED** unmanaged paths. A changed baseline stops for investigation; it is never silently relabeled PASS.

The route runner accepts Cline **20 + four generated-hook checks**, Claude native CLI **22**, Gemini CLI **16**. Cline's original passing fixture contains refused liveness probes/child launches; those were prevented by the immutable guard. Current refusal counts and reasons remain explicit and do not imply product OS confinement. Every route retains its loopback public controls and actual vendor execution. These are scripted developer-bootstrap checks with LOW independence. Cline's additional hook generator source is bound to the exact packaged frontend build graph and uses the exact packaged MCP runtime.

Codex CLI **20** and Codex IDE **21** successors are owned by the sibling `f26a_finish` agent. All five routes total **99 + four hook checks**. This affected/tool-route packet alone does not finish V01, V02 or human/independent V05 gates. No publication, authenticated provider use or normal-profile installation occurs here.

Controls already executed: `v01-affected-controls.test.cjs` **8/8**, `v01-route-controls.test.cjs` **13/13**. Route controls validate retained historical fixture shapes without transferring those results to the current artifact.
