# Isolated SoterAI Lite packager

This tool packages an existing, hash-pinned Lite payload with VSCE 4.1.0. Its lockfile is separate from the application workspace. The scoped minimatch 11.0.5 override addresses the retained advisory; real packaging compatibility is verified by comparing every payload byte. No publish or account operation is provided.

Install the locked tooling and run the focused tests:

```powershell
npm.cmd ci --prefix tools/soterai-lite-packager --workspaces=false --ignore-scripts --no-audit --no-fund
npm.cmd test --prefix tools/soterai-lite-packager --workspaces=false
```

Repackage the verified recovery payload into a **new** output directory whose parent already exists:

```powershell
node tools/soterai-lite-packager/package.cjs packages/soterai-lite/soterai-lite-0.7.0-recovery-20261107-attempt01.vsix 38b81310f53d5f138d966c8f29de75bf22841ec20640fc7f31f473f38d60b96f docs/soterai-lite/evidence/20261108-queue-completion/repack-next
```

The command checks the source hash, an exact 18-entry archive allowlist, an inert manifest, all 16 extension payload files, and installed toolchain hashes before and after packaging. It retains the generated VSIX, staging files, toolchain inventory and result. Existing output directories are refused. Runtime source compilation is not performed; source/build provenance remains that of the original candidate. A repack gets its own artifact hash and requires its own installed-host acceptance before release.

Run a current audit independently when refreshing dependencies:

```powershell
npm.cmd audit --prefix tools/soterai-lite-packager --workspaces=false --json
```

The 8 November 2026 lookup reported zero vulnerabilities for this isolated lockfile. The retained 42 historical associations were also reassessed against their exact OSV response bytes: 34 are absent from this toolchain and 8 use fixed versions. Historical builds and the root dependency tree retain their original audit status. Human acceptance, full catalog scenarios and original legacy migration remain separate release requirements.
