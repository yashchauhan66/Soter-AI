# Cross-IDE publishing master plan

Status date: 2026-07-06. This is the single per-channel publishing checklist for SoterAI IDE Guard. Nothing here is published yet; every channel below is either **READY** (artifact builds and the publish path is wired) or **PLANNED** (adapter source or packaging still incomplete). "Ready" means the release path exists and has been rehearsed locally, not that the extension is live in a registry.

The [cross-IDE support tiering](cross-ide-support-tiering.md) document governs *when* a channel may be advertised as supported. This document governs *how* to publish once a channel passes its universal release gate.

## Golden rules for every channel

- **Credentials are never committed.** Tokens, certificates, and private keys live only in the release environment or CI secret store (`${{ secrets.* }}`), never in `package.json`, a committed command, a screenshot, or a test report.
- **No "100% secure" claims.** Listing copy states what SoterAI mediates (context explicitly scanned/routed through SoterAI, broker traffic to the loopback endpoint) and what it does not (a third-party AI plugin's own network calls, arbitrary extension file reads).
- **Local-first, no raw cloud upload by default.** Raw source, secrets, prompts, and terminal output are not sent to SoterAI Cloud by default. Every listing repeats this.
- **Every claim is backed by a feature or test.** If the copy says "canary leak detection," the canary privacy test must pass for that adapter before the claim ships.
- **Do not claim registry availability until search/install succeeds in the target product**, not merely a sideload.

## Channel status summary

| Channel | Adapter path | Artifact | Status | Blocking item |
|---|---|---|---|---|
| VS Code Marketplace | `packages/vscode-extension` | `soterai-ide-guard-<version>.vsix` | READY | Marketplace publisher auth in release env |
| Open VSX (Cursor/VSCodium) | `packages/vscode-extension` | same VSIX | READY | `OVSX_PAT`; per-host smoke tests |
| JetBrains Marketplace | `extensions/jetbrains` | signed plugin ZIP | PLANNED | Gradle build + Plugin Verifier + signing certs; Marketplace approval |
| Visual Studio Marketplace | `extensions/visual-studio` | `.vsix` + manifest | PLANNED | Adapter source not built |
| Sublime Package Control | `extensions/sublime` | tagged GitHub repo | PLANNED | Adapter source not built |
| Neovim / Vim | `extensions/neovim`, `extensions/vim` | GitHub release tag | PLANNED | Vim adapter absent; Neovim install matrix incomplete |
| Eclipse Marketplace | `extensions/eclipse` | signed p2 update site | PLANNED | Adapter source not built |
| JupyterLab | `extensions/jupyterlab` | npm + PyPI package | PLANNED | Adapter source not built |

---

## (a) VS Code Marketplace — READY

**Identity:** publisher `soterai` (matches `packages/vscode-extension/package.json`), extension name `soterai-ide-guard`.

**Required assets:** raster (PNG) marketplace icon (the bundled SVG is an in-product activity-bar icon, not a marketplace icon), HTTPS listing screenshots, README, LICENSE, CHANGELOG/release notes, privacy and limitations links.

**Credentials:** a Marketplace publisher PAT / Microsoft Entra automated-publishing identity, supplied by the release environment only. Global Azure DevOps PATs are scheduled for retirement 2026-12-01; prefer the supported Entra flow. **Never store the token in the repo.**

**Exact commands:**

```powershell
npm ci
npm --prefix packages/vscode-extension run typecheck
npm --prefix packages/vscode-extension test
npm run vscode:package
npm run test:vscode-family
# clean-profile install before publishing:
code --user-data-dir C:\tmp\soterai-code-clean --extensions-dir C:\tmp\soterai-code-clean-ext --install-extension packages\vscode-extension\soterai-ide-guard-0.1.0.vsix --force
# publish only from an approved release environment:
npm run vscode:publish
```

**Privacy/limitations line for the listing:** "SoterAI IDE Guard is local-first: it connects to an authenticated loopback broker and does not send raw source, secrets, or prompts to SoterAI Cloud by default. It mediates context explicitly scanned or routed through SoterAI and cannot transparently intercept every third-party AI extension or terminal command."

Full runbook: [publishing-vscode-marketplace.md](publishing-vscode-marketplace.md).

---

## (b) Open VSX (Cursor, VSCodium, Windsurf) — READY

**Identity:** Open VSX namespace `soterai`, owned by the release account. SoterAI ships the *same audited VSIX* as VS Code rather than a fork-specific package.

**Required assets:** identical to the VS Code VSIX (icon, README, LICENSE embedded in the package).

**Credentials:** scoped Open VSX token stored as CI secret `OVSX_PAT`, or set in the process environment for a one-time local release. `scripts/publish-openvsx.mjs` refuses to run without the artifact and `OVSX_PAT`, and never puts the token on the command line. **Never commit it.**

**Exact commands:**

```powershell
npm ci
npx ovsx verify-pat soterai        # confirms namespace access without printing the token
npm run openvsx:package
npm run test:cursor
npm run test:vscodium
$env:OVSX_PAT = '<injected by secret store>'
npm run openvsx:publish
```

**Cursor / VSCodium compatibility note:** Cursor and VSCodium are *separate test targets* even though they consume the same VSIX. A successful install proves manifest/package acceptance, not command activation or feature behavior. Cursor's marketplace proxy has review/indexing delay; do not claim availability until registry search/install succeeds in the product. VSCodium qualification must set `SOTERAI_REQUIRE_EDITOR=1` so a missing host fails rather than SKIPs.

**Privacy/limitations line:** same local-first line as VS Code, plus: "SoterAI has no supported hook into Cursor's or Windsurf's private prompt-building pipeline; it protects context routed through SoterAI and broker traffic configured to use the local endpoint."

Full runbook: [publishing-openvsx-cursor.md](publishing-openvsx-cursor.md).

---

## (c) JetBrains Marketplace — PLANNED

**Adapter:** `extensions/jetbrains` (plugin id `ai.soterai.jetbrains.guard`, IntelliJ Platform Gradle plugin, `sinceBuild 251`, `untilBuild 261.*`). Source exists; a signed, verified build does not yet.

**Identity:** JetBrains Marketplace vendor account owning the plugin id. Each named product (IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, CLion, DataGrip, Rider) is a distinct verification target — one passing IntelliJ test does not establish support for the others.

**Required assets:** signed plugin distribution ZIP from `buildPlugin`, plugin logo (light + dark SVG in `META-INF`), plugin description/change-notes in `plugin.xml`, Plugin Verifier report for the declared build range.

**Credentials (release env only):** signing `CERTIFICATE_CHAIN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD`, and Marketplace `PUBLISH_TOKEN`, all read from environment variables by `build.gradle.kts`. **Never commit certs or tokens.**

**Exact commands:**

```bash
cd extensions/jetbrains
./gradlew clean buildPlugin           # produces build/distributions/*.zip
./gradlew verifyPlugin                # Plugin Verifier for the declared IDE range
./gradlew test                        # BrokerContractTest
# sign + publish only from an approved release environment:
./gradlew signPlugin
./gradlew publishPlugin               # reads PUBLISH_TOKEN from the environment
```

Marketplace publication is followed by JetBrains **manual approval** before the listing goes live; plan for that delay.

**Privacy/limitations line:** the `plugin.xml` description already states local-first behavior and that the plugin "does not transparently intercept every third-party AI assistant or terminal command." Keep that wording in the Marketplace listing.

---

## (d) Visual Studio Marketplace — PLANNED

**Adapter:** `extensions/visual-studio` (source not yet built).

**Identity:** Visual Studio Marketplace publisher for the VSIX manifest.

**Required assets:** VSIX built from the extension's `.vsixmanifest`, marketplace icon, overview, and license.

**Credentials (release env only):** Visual Studio Marketplace PAT. **Never commit it.**

**Exact commands (path once the adapter is built):**

```powershell
# build VSIX from the VS extension project (msbuild/VSSDK), then:
VsixPublisher.exe publish -payload <SoterAI.vsix> -publishManifest <publishManifest.json> -personalAccessToken $env:VS_MARKETPLACE_PAT
```

**Privacy/limitations line:** local-first; SoterAI mediates context routed through SoterAI. Visual Studio's terminal and some AI surfaces expose fewer interception points than VS Code — the listing must say so.

---

## (e) Sublime Package Control — PLANNED

**Adapter:** `extensions/sublime` (source not yet built).

**Identity:** a public GitHub repository holding the package, and a Package Control channel entry (pull request to `wbond/package_control_channel`).

**Required assets:** a tagged GitHub release (semver tag), `messages.json`, `.python-version` / `.no-sublime-package` as needed, README, LICENSE. Package Control installs *from the Git tag*; there is no token to store — distribution is the public repo plus the accepted channel PR.

**Exact commands (path once the adapter is built):**

```bash
cd extensions/sublime
python -m py_compile *.py            # syntax check every module
git tag -a v<version> -m "SoterAI IDE Guard <version>"
git push origin v<version>
# then open/refresh the Package Control channel PR referencing the tag
```

**Privacy/limitations line:** Sublime has no extension network-interception API; SoterAI mediates only explicit scan/redact/safe-prompt commands routed to the local broker. State this in the README, which becomes the listing.

---

## (f) Neovim / Vim — PLANNED

**Adapter:** `extensions/neovim` (thin Lua client, config module present; command + broker-client modules and full install matrix pending). `extensions/vim` (Vimscript adapter) does not exist yet.

**Identity:** public GitHub repository and release tags. Plugin managers install from Git; there is no registry token.

**Required assets:** a tagged GitHub release, `README.md` with install snippets, `doc/soterai.txt` help file, and a `plugin/soterai.lua` bootstrap.

**Exact commands / install snippets published in the README:**

```lua
-- lazy.nvim
{ "soterai/ide-guard-neovim", tag = "v<version>",
  config = function() require("soterai").setup({ broker_url = "http://127.0.0.1:47321" }) end }
```

```lua
-- packer.nvim
use { "soterai/ide-guard-neovim", tag = "v<version>" }
```

```bash
# release
git tag -a v<version> -m "SoterAI IDE Guard Neovim <version>"
git push origin v<version>
# syntax check in CI:
nvim --headless -c "luafile lua/soterai/init.lua" -c "qa"
```

**Privacy/limitations line:** the adapter is a thin client — no detector logic runs in Lua, and no raw source/secret/prompt leaves the loopback broker. Interpreted-editor commands are synchronous curl calls; large scans block the editor briefly. Vim (as opposed to Neovim) support depends on build features (`+job`/`+channel`) and is not yet shipped.

---

## (g) Eclipse Marketplace — PLANNED

**Adapter:** `extensions/eclipse` (source not yet built).

**Identity:** Eclipse Marketplace listing plus a hosted, signed p2 update site.

**Required assets:** signed p2 repository (`content.jar`/`artifacts.jar` + plugin/feature JARs), `feature.xml`, `p2.inf`, marketplace icon and description, and a valid signing certificate.

**Credentials (release env only):** JAR signing keystore/password. **Never commit the keystore.**

**Exact commands (path once the adapter is built):**

```bash
cd extensions/eclipse
mvn -B clean verify                  # Tycho build of the update site
# sign feature/plugin JARs with jarsigner using the release keystore, then
# publish the update site to its hosting location and submit the Marketplace listing
```

**Privacy/limitations line:** local-first; Eclipse's SWT/terminal surfaces limit interception to explicit scan/redact commands. No raw upload by default.

---

## (h) JupyterLab — PLANNED

**Adapter:** `extensions/jupyterlab` (source not yet built).

**Identity:** npm package (front-end labextension) plus a PyPI package (prebuilt/server piece), released under the `soterai` org on both registries.

**Required assets:** a prebuilt labextension (`npm run build:prod`), `pyproject.toml`, wheel + sdist, README, LICENSE, and a resolved local-vs-remote broker topology note (a remote Jupyter server changes where the broker must run).

**Credentials (release env only):** `NPM_TOKEN` and PyPI `TWINE_PASSWORD` / trusted-publisher OIDC. **Never commit them.**

**Exact commands (path once the adapter is built):**

```bash
cd extensions/jupyterlab
jlpm install && jlpm run build:prod
npm publish --access public          # reads NPM_TOKEN from the environment
python -m build                      # wheel + sdist
twine upload dist/*                  # reads credentials from the environment
git tag -a v<version> -m "SoterAI IDE Guard JupyterLab <version>" && git push origin v<version>
```

**Privacy/limitations line:** explicit cell/selection scan only; notebook *outputs* can contain sensitive data, so the adapter must redact before display. Remote-Jupyter topology requires an explicitly documented broker location; do not claim protection for a remote kernel whose broker is unreachable.

---

## Cross-channel release order

1. Pass the [universal release gate](cross-ide-support-tiering.md) for the channel.
2. Bump a unique semantic version; update changelog and release notes.
3. Build the artifact and run the adapter's typecheck, tests, canary privacy test, and package-content review.
4. Clean-profile / clean-host install and smoke test (activation, commands, broker connect, wrong-token, offline, stopped-broker).
5. Publish only from an approved release environment with secrets injected, never printed.
6. Re-install the published copy into a fresh profile and compare checksum/version against the release record.
7. Record rollback/unpublish ownership and the support contact.
