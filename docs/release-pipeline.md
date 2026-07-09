# Cross-IDE release pipeline

Status date: 2026-07-06. This explains `.github/workflows/cross-ide-release.yml`, which builds and validates every cross-IDE artifact, generates SHA256 checksums, and drafts a GitHub release. **It packages and validates only — it does not publish to any marketplace.** Publishing to each channel stays a separate, human-approved step described in [cross-ide-publishing-master-plan.md](cross-ide-publishing-master-plan.md).

## Triggers

- **Manual** (`workflow_dispatch`) with a `draft_release` toggle.
- **Tag push** matching `ide-guard-v*`.

Both run on Node 22, matching `.nvmrc` (22.17.0) and the main CI workflow.

## Jobs

| Job | What it does | Blocks release? |
|---|---|---|
| `guard-core tests` | typecheck + test the shared detection/redaction/policy library | Yes |
| `local-broker tests` | typecheck, test, build the Local AI Broker; uploads `dist` | Yes |
| `secret scan` | gitleaks over full history; fails if a credential is committed | Yes |
| `canary privacy test` | runs the extension test suite that proves redacted-only, no-raw-leak output | Yes |
| `CLI tests` | builds the broker and smoke-tests the CLI entrypoint | Yes |
| `vscode package (vsce)` | typecheck, package the audited VSIX, `validate:marketplaces`; uploads VSIX | Yes |
| `jetbrains build (experimental)` | `./gradlew buildPlugin` + best-effort `verifyPlugin`; uploads plugin ZIP | No — `continue-on-error` |
| `neovim/sublime syntax checks` | headless Lua load + Python `compileall` | No — `continue-on-error` |
| `checksums + release draft` | gathers artifacts, writes `SHA256SUMS.txt`, drafts a GitHub release | Final step |

The JetBrains and editor-adapter jobs are marked `continue-on-error` because their toolchains (IntelliJ Platform SDK, an installed Neovim, or a not-yet-built Sublime adapter) may be unavailable. Their status stays visible on the run, but a missing SDK does not block the shippable VS Code / broker artifacts. This mirrors the [support tiering](cross-ide-support-tiering.md): experimental channels do not gate ready ones.

## Artifacts

| Artifact | Produced by | Contents |
|---|---|---|
| `soterai-ide-guard-<version>.vsix` | `vscode-package` | the audited VS Code / Open VSX package |
| JetBrains plugin ZIP | `jetbrains-build` | `build/distributions/*.zip` (experimental) |
| `local-ai-broker-dist.tar.gz` | `local-broker-tests` → release step | compiled broker `dist` |
| Sublime package / Neovim release | (added when those adapters build) | tagged Git distribution, not a compiled binary |
| `SHA256SUMS.txt` | `release-draft` | one SHA256 line per release file |

Sublime and Neovim distribute *from Git tags* rather than compiled binaries, so their "artifact" is a tagged release referenced by the plugin manager — the syntax-check job validates them here; the tag is cut in the publishing step.

## Integrity and reproducibility

- Every release file is hashed with `sha256sum` into `SHA256SUMS.txt`, attached to the draft. Consumers verify with `sha256sum -c SHA256SUMS.txt`.
- Builds use `npm ci` against the committed lockfile and a pinned Node major version, so the same commit produces the same package inputs. The VSIX is built with `--no-dependencies` and the extension's `.vscodeignore`, so it contains only the manifest, license, README, bundled JS, and the activity-bar icon — no `node_modules`, source, tests, or `.env` content.
- After publishing (a separate step), re-install the registry copy into a clean profile and compare its checksum/version against the release record.

## Secrets are never printed

- All credentials are referenced only via `${{ secrets.* }}` (e.g. `GITLEAKS_LICENSE`, `GITHUB_TOKEN`). No token, certificate, or private key is echoed, written to an artifact, or included in the release body.
- The workflow does **no** marketplace publishing, so no `OVSX_PAT`, Marketplace PAT, JetBrains `PUBLISH_TOKEN`, signing `CERTIFICATE_CHAIN`/`PRIVATE_KEY`, `NPM_TOKEN`, or PyPI credential is used here at all. Those live only in the approved release environment used by the publishing runbooks.
- The draft release body explicitly states that no credentials are included and that publishing is a separate human-approved step.

## Relationship to publishing

This pipeline gets you a verified, checksummed set of artifacts and a draft release. It never flips a channel from PLANNED to published. To publish, follow the per-channel runbook in [cross-ide-publishing-master-plan.md](cross-ide-publishing-master-plan.md) from an approved release environment, and only after the channel passes its [universal release gate](cross-ide-support-tiering.md).
