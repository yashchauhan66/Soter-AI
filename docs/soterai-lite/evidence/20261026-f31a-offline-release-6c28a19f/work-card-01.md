# F31a — offline release inventory and owner publishing preparation

Authority: user on26October2026 requested shorter independent work first. Existing plan/queue amended in place, original beforebytes retained. This deliberately overrides the earlier serial scheduling dependency, not any acceptance gate. F26a progress14/current990 source bytes and exact artifact remain preserved; native06 declined and not run.

Original requirements: L4 release preparation and F31. No new leak-check definition/coverage score: frozen catalog44 unchanged. F31b retains final package, shipped SBOM/notices/privacy/claims and audits; parent F31 stays INCOMPLETE.

Scope: one build-only `audit-release.cjs`, its17 synthetic regressions and `PUBLISHING-RUNBOOK.md`. Existing builders/runtime/manifests remain unchanged. No runtime flag or GUI/native launch is appropriate for a detached read-only build utility. Actual exact artifact inspection, bounded source/provenance/license checks and meaningful before/after fixture tests are required. No new VSIX is manufactured for unchanged runtime bytes; the output explicitly identifies the existing attempt02 candidate and does not grant it feature acceptance.

Inputs: explicit SHA-pinned VSIX/build provenance; code input paths only under known package/app source or node_modules; bounded third-party manifests/notices. No workspace environment/config/history scan, network, login, download, install, publish/push/tag or process signals.

Acceptance: all17 fixture checks pass; actual15entry/four-runtime attempt02 and included input hashes checked; CycloneDX detached SBOM enumerates only actual bundled dependencies, source/runtime mappings and license uncertainty; unknown/missing notices and absent network vulnerability audit remain incomplete. Repeated output deterministic; no absolute local path in reports. CLI refuses output overwrite and unsafe paths. Preserve baseline failures/raw output. Local scoped utility commit and actual Git byte proof after source scope review; no F26a staging.

Sources: official VS Code publishing guide and Eclipse Open VSX publishing/CLI guide inspected26October2026; installed vsce3.9.2 flags inspected locally. No source review is live publishing evidence. Do not read/use real publishing credentials.

Actual integration corrections: round1 admits only vsce's two canonical lowercase documentation names while retaining case-alias denial; installed packager source and actual ZIP independently confirm them. Before18=17PASS1FAIL retained. Round2 includes already bundled `packages/core/src` and `packages/detectors/dist` code roots under the same code-only/hash/ordinary-file policy. Before20=18PASS2FAIL retained. Original17 tests remain an exact prefix; no assertion weakened. Current20PASS, actual03/04 inventory/SBOM byte-identical; two earlier actual audit failures retained unregraded. Parent F31 remains incomplete; no native06 run.
