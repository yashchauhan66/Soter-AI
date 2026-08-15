# Changelog

## [0.5.0] - 2026-08-15

### Changed

- **New-user Control Panel workflow.** The first screen now starts with three high-value outcomes: scan text before sending it to AI, protect raw workspace secrets with on-disk placeholders, and secure supported installed AI tools. Terminal, dependency, and agent-tool checks remain available under a compact disclosure.
- **Honest protection summary.** Replaced the misleading equal-weight `X / 5 active` indicator with independent `Blocking`, `Editor warnings`, and `Known gaps` states. A warning-only control can no longer look equivalent to an enforced route.
- **Beginner language and readability.** Increased compact panel text to 11px, moved protection-label explanations behind an optional disclosure, renamed technical status pills and utility actions in task language, and kept advanced agent-tool controls collapsed by default.
- **Three-step onboarding.** Getting Started now begins with a safe demo result, then workspace secret protection, then optional supported AI-tool routing. Privacy-mode configuration is no longer the first decision because local mode is already the default.
- **Focused Command Palette.** The default palette now has 10 core, reversible workflows. Advanced and diagnostic commands remain available after enabling `soterai.showAllCommands`.
- **Marketplace proof.** README now includes three real VS Code verification screenshots for secret scanning, selected-text scanning, and enabled request protection.
- **Outcome-based feedback.** Clipboard remediation confirms that safe content is ready to paste and offers the next relevant workspace-protection action. Safe Paste confirms when it inserts the redacted version.

### Fixed

- **Strongest protections were hard to discover.** Workspace vault migration and Secure My AI are now first-class Control Panel actions and value-first walkthrough steps.
- **Release version drift risk.** The panel version is read from extension metadata rather than duplicated in the webview source.

## [0.4.1] - 2026-08-11

### Fixed

A real-user pass over the installed 0.4.0 build, driven through an actual VS Code
extension host. Every defect below was reproduced in that host before it was
fixed, and each fix is pinned by a test that fails without it.

The theme is one bug with four faces: the Control Panel's headline was
permanently red on a normal machine, and the buttons it offered to fix that did
not fix it.

- **The AI-tool count was inflated by substring matching, and included SoterAI
  itself.** Detection tested each installed extension id, display name and
  description for the letters `ai` anywhere in the string. Run against the 164
  extensions a real extension host loads (73 installed + 91 built-in), that rule
  counted 27 AI tools — including `vscode.theme-monokai` and
  `vscode.theme-monokai-dimmed`, two colour themes, because "Mon-ok-**ai**". Also
  counted: `bracket-pair-color-dlw` (`p-ai-r`), `auto-rename-tag` (`p-ai-red`),
  `rainbow-csv` (`r-ai-nbow`), `vscode-containers` and `remote-containers`
  (`cont-ai-ners`), `gitlab-workflow`, and SoterAI's own extension id. Nine of the
  27 were not AI tools at all.

  The same rule *missed* nine that are: Roo Code, OpenCode, Qwen Code, IntelliCode
  (both packages), the AWS Toolkit, GitHub Pull Requests, Spring Boot's AI
  features, and a database client that ships a chat agent. So the number driving
  the red banner was wrong in both directions at once.

  Detection now goes through `AiToolRegistry`, which classifies on three
  defensible signals in order: a curated list of AI extensions and AI publishers,
  whole id *segments* matching distinctive AI tool names (never substrings), and
  finally the extension's own manifest — `categories: ["AI"]`, a contributed chat
  participant, or a contributed language-model provider. On the same 164
  extensions it reports 4 routable + 23 unmanaged, and flags **0 of the 91
  built-ins**; a host launched with `--disable-extensions` reports 0 where the old
  detector reported 3.

  `contributes.languageModelTools` is deliberately not a signal even though it
  looks like the obvious one: on a real machine it is declared by
  `ms-python.python`, `vscode-containers`, `vscode-java-debug` and a MySQL client.
  Those expose tools *to* an AI; they are not AI tools, and counting them would
  rebuild the same false-positive problem from the other side.
- **No user could reach a non-error state.** Two causes, one symptom. The count
  of tools "routed through SoterAI" only ever inspected 6 hardcoded config paths,
  so `protectedAiTools < detectedAiTools` was permanently true and the state
  machine reported `BYPASS_DETECTED` forever. Separately, "MCP governance" sat in
  the list of controls required for a green state while the runtime fact behind it
  was hardcoded `false` — so even a fully configured machine was held below
  fully-enforced by a control that could not be switched on.
- **A tool SoterAI cannot route was reported as a bypass.** Copilot talks to
  GitHub directly and no setting redirects it through a local broker, so counting
  it as an unrouted tool turned a permanent architectural limit into a red alert
  the user could not clear. Real AI tools are now classified as *routable* or
  *unmanaged*: unmanaged tools are still counted and still disclosed in the
  coverage line ("N other AI tools cannot be routed by SoterAI (monitoring
  only)"), but they no longer produce an error, and the headline reads "Enforced,
  with known gaps" instead of "Bypass detected".
- **An offline broker was an error even when nothing depended on it.** On a fresh
  install with blocking switched off, a stopped broker breaks no promise. It is
  now an error only when Safe Mode is on or something is actually routed through
  it; otherwise the honest headline is "Monitoring only".
- **"See what is wrong" did not say what was wrong.** The primary button under an
  error headline opened a static table of route-coverage levels that never
  mentioned the live problem. It now leads with the current state, its
  explanation, a "What to do about it" section naming the fix, and the live
  coverage/active/inactive control lists, resolved when the button is clicked
  rather than cached at activation.
- **"Set up local checking" did nothing when no AI config was present.** The CTA
  the panel bills as "Needed before SoterAI can block anything" returned early
  with "No AI client config found" without starting the broker — so on any
  workspace without a Continue/OpenAI config file, the most important button in
  the product was a dead end. It now starts the broker first, reports the URL it
  is listening on, and offers "Copy broker URL" / "Run self-test"; commands like
  "Run a command safely" and "Check what I copied" are enforced from that point
  on. If the broker fails to start it says so, with the broker state, instead of
  claiming success.

- **The activity-bar icon was declared but not shipped.** `contributes.
  viewsContainers` points at `media/icon.svg`; that file had been deleted from the
  working tree, and packaging succeeded anyway — `vsce` does not resolve asset
  paths, so 0.4.1 first packaged an activity-bar entry whose icon did not exist in
  the archive. Nothing in the pipeline looked: not the unit suites, not typecheck,
  not the extension-host tests, not the 7-check packaged runtime probe, because
  none of them inspect the VSIX file list. The icon is restored (the maskable
  monochrome mark, recovered from the 0.4.0 archive), and
  `src/__tests__/manifest-assets.test.ts` now walks the whole manifest, asserts
  every asset it names exists on disk, asserts none is excluded by
  `.vscodeignore`, and asserts the activity-bar icon is a `currentColor` SVG with
  no hardcoded fills — VS Code masks that file to its alpha channel, so hardcoded
  colours are discarded and a filled glyph renders as a blob at 24x24. Removing
  the icon fails 2 of those 4 tests.

  The saffron mark stays where colour survives: `media/icon.png` (the marketplace
  and gallery icon) and `galleryBanner`. The activity bar cannot show it in
  saffron — VS Code repaints that icon in the theme's activity-bar foreground
  colour — so it carries the same mark's silhouette instead.

### Changed
- Required controls for a fully-enforced claim are now AI traffic protection,
  Protected Workspace, and AI activity evidence. MCP governance and Live file
  diagnostics are disclosed as `(advisory)` in the inactive-controls list: both
  are real features, neither is a mandatory gateway, so neither can gate an
  enforcement claim in either direction.
- Version bumped from 0.4.0 because the 0.4.0 bundle on disk had drifted from the
  0.4.0 in the repo. With an identical version string VS Code offers no update, so
  a fix under the same version could never reach an installed copy.

### Notes for release
- The five in-host publish probes under `artifacts/editor-runtime/` are bound to
  the previous version and bundle hash and are now stale by construction. They
  must be re-run against 0.4.1 before publish.

## [0.4.0] - 2026-08-11

### Added
- **Resource links inside the editor.** The Control Panel footer now links to the
  website, the docs, and the issue tracker. They are buttons rather than
  `<a href>` because the webview CSP (`default-src 'none'`) blocks navigation:
  a click posts an allowlisted action name and the extension host opens a URL
  from a hardcoded table, so the panel can choose between three fixed
  destinations but can never supply one of its own.
- README header links (Website · Docs · Support · Report an issue · Source), and
  a test that fails if those drift from the manifest's `homepage`, `qna`,
  `bugs.url`, or `repository.url`.

### Changed
- Extension icon is now the SoterAI mark, with `galleryBanner` recoloured to
  `#F96403` so the Marketplace listing matches it. The activity-bar `icon.svg`
  was redrawn as a 24x24 monochrome `currentColor` outline of the same mark,
  replacing a filled 100x100 blue glyph: VS Code masks that file to its alpha
  channel and repaints it in the theme colour, so the old fills were discarded
  and the solid hexagon rendered as an indistinct blob at 24x24.
- `repository.url` and `bugs.url` now point at `yashchauhan66/Soter-AI` instead
  of relying on GitHub's rename redirect from `Ai-Security-Guard`.

### Fixed

A real-user pass over the 0.3.x feature surface. Every fix below is a defect that
shipped in 0.3.0 and was reproduced before it was fixed. Several of them were
features that *reported* protection while doing nothing — those are the ones
worth reading.

- **Screen-share exposure warning missed almost every secret file.** The check
  compared the whole path string against `.env`, so only a workspace-root `.env`
  was ever flagged; `sub/.env`, `backend/.env.production`, `~/.aws/config` and
  any absolute path outside the workspace were silently ignored. Matching now
  happens on the basename, with an added path check for files under `.ssh`,
  `.aws`, `.gnupg`, `.kube` and `.docker`, plus key material (`.pem`, `.key`,
  `.p12`, `id_rsa`…) and secret-named files.
- **The git pre-commit hook could be installed dead, and could destroy an
  existing hook.** Three separate problems: the file was written without the
  executable bit, so git skips it entirely on macOS/Linux while the UI claimed
  success; a repo using husky/lefthook (`core.hooksPath`) had its hook written
  to the directory git ignores; and any pre-existing `pre-commit` hook was
  overwritten with no backup. Install now refuses when `core.hooksPath` is set
  and explains why, backs up a foreign hook to `pre-commit.soterai-backup`,
  sets mode `0755`, and warns honestly when the exec bit cannot be set.
- **Dependency Guard claimed findings that no scan had produced.** The OSV
  nudge was called with a hardcoded "risky packages found" flag, so the prompt
  asserted local findings even when nothing had been scanned. The nudge now
  takes explicit evidence and says plainly when no scan has run.
- **Local-model log scan reported "clean" after reading nothing.** LM Studio's
  `server-logs` is a directory; `readFile` failed with `EISDIR`, the error was
  swallowed, and the command reported no persisted secrets. Directory
  candidates are now expanded to the files inside them (bounded per directory),
  and the result states how many files were actually read and how many could
  not be read, instead of treating unread as clean.
- **Every default live-scan exclude was dead.** The glob matcher compiled
  patterns through a chain of `.replace()` calls in which a later rule rewrote
  the output of an earlier one, so `**/node_modules/**` became a regex that
  matched nothing. All nine shipped excludes — `node_modules`, `.git`, `dist`,
  `build` and the binary extensions — were therefore scanned on every
  keystroke. Compilation is now a single pass over the pattern, which cannot
  rewrite its own output, and an uncompilable user pattern fails safe (the file
  is scanned) instead of throwing.
- **The "Secure My AI" success headline was unreachable.** Verification POSTed
  to `/v1/ai/openai-compatible/smoke`, a route the bundled broker does not
  serve, and sent no bearer token — so it could only ever fail. It now calls
  the real authenticated `streamSmokeTest` against the route that exists, and a
  tool whose config was not actually rewritten is reported as unverified rather
  than counted as a pass.
- **"Secure My AI" had no palette-reachable undo.** `SoterAI: Restore AI
  Configs` is now a core palette command. A one-click rewrite the user cannot
  reverse from the palette is worse than one they never ran.
- **Emergency Lockdown trapped the user in the panel.** Entering lockdown
  replaced the whole panel body, and the replacement offered no way out — the
  `soterai.unlockProtection` command existed but nothing in the panel reached
  it, so recovery required knowing the command palette. Lockdown now renders
  "Unlock protection" as its primary action. A state a one-click control can
  enter must be one the same control can leave.
- Declared `@soterai/detectors`, which was required at runtime but present only
  via the workspace symlink and esbuild inlining.
- Added `SoterAI: Copy Pre-Commit Hook Script` as the escape hatch for
  husky/lefthook repos, referenced by the refusal message above.

### Security
- **A pre-rewrite copy of every secret file was written to disk in plaintext.**
  "Secure My AI" backed each config up to `<path>.soterai-backup-<timestamp>`,
  a sibling of the original. For a `.env` that produced a second, permanent
  copy of every key on a path `.gitignore` does not match, created with default
  `0644` permissions rather than the source file's mode, and — for candidates
  under `$HOME` — outside the workspace ignore rules entirely. Backups now go
  to an encrypted `BackupSink`: AES-GCM, key held in VS Code SecretStorage,
  ciphertext under the extension's global storage, addressed by an opaque
  handle. The original path is stored inside the ciphertext, so even the
  filename is not disclosed at rest. If the sink fails, the rewrite is
  abandoned and the original is left untouched — an un-undoable rewrite of a
  secret-bearing config is worse than no rewrite at all.
- **A repository could turn its own protection off.** All 28 `soterai.*`
  settings were declared with no `scope`, which is VS Code's `window` default:
  a checked-in `.vscode/settings.json` could set them. Opening a hostile repo
  was enough to disable `protection.enabled`, `liveScan.enabled` or
  `mcpFirewall.strictMode`, or to repoint `broker.openAIProviderUrl` at an
  attacker-controlled endpoint that then received the user's real provider API
  key. The 23 safety-relevant keys are now `scope: "machine"`, so workspace
  values are ignored, and the same 23 are declared in
  `capabilities.untrustedWorkspaces.restrictedConfigurations` so Restricted
  Mode refuses them too. The 5 keys left workspace-scoped are scan budgets,
  exclude globs and palette visibility — none can disable a protection.
- **RAG / vector-database egress is now enforced rather than advertised.** The
  host list and `isRagEgress` existed with no caller while the module header
  claimed the detection shipped. They now live in `egressFirewall.ts` and are
  folded into the live `evaluateEgressToHost` path: secret-bearing content to a
  vector DB escalates to `BLOCK` (embedded content is persisted, so a leak
  there is durable, not transient), and clean content becomes `ASK` before it
  is indexed.

### Changed
- **The Control Panel now reads as instructions rather than as a status page.**
  Every control carries a one-line plain-language summary, with the honest
  caveat demoted into an expandable row instead of deleted, and the panel shows
  a single primary action chosen by protection state rather than an
  unconditional "Enable Full Protection" — which was the wrong move during
  lockdown and a no-op when protection was already full. Wording, ordering and
  badge resolution moved into a pure `panelContent.ts` module, so what a new
  user reads is unit-testable without a VS Code host. No badge can exceed what
  the capability registry permits; every level is still resolved through
  `capabilityUiBadge()`.

### Removed
- **27 hand-listed `onCommand:` activation events.** VS Code has generated an
  activation event for every contributed command since 1.74, and the declared
  floor here is `^1.85.0`, so all 27 were dead weight — and demonstrably drifting
  already, since the other 131 commands relied on the generated behaviour
  without anyone noticing. Removal is proven, not assumed: the real-host suite
  passes 9/9 on **both** 1.104.0 and the 1.85.0 floor, including the case that
  asserts every command the panel can invoke exists in that host.
  `activationEvents` is now the three entries that have no generated
  equivalent — `onStartupFinished`, `workspaceContains:.soterai-policy.json`
  and `onWalkthrough:soterai.gettingStarted`. A new test rejects any
  reintroduced `onCommand:` entry and pins those three as required.
- **Five marketing assets that were not pictures of this extension.**
  `command-palette.png`, `scan-results.png` (byte-identical to it),
  `settings-panel.png` and `demo.gif` were screen captures of an unrelated
  editor session — a coding-assistant transcript with third-party advertising
  visible in frame — and `dashboard-overview.png` showed the VS Code Welcome tab
  with no SoterAI surface in it. `.vscodeignore` already kept them out of the
  VSIX and a test already forbade the README from rendering them, so nothing
  shipped; they are deleted so they cannot be mistaken for usable collateral.
  Marketplace screenshots remain **absent, not pending** — no image will be
  published that does not show this extension doing the thing it claims.

### Honesty
- `onStartupFinished` is kept deliberately. Lazy activation would look tidier in
  a review, but a guard that starts only after the user runs a command does not
  guard the window before that point: live scanning, the sentinel and the
  screen-share check all have to be running to be worth anything. The cost is a
  real one and is stated rather than hidden.
- Registered the five newly-wired protections in the capability registry at the
  level each one actually reaches: `ai-config-auto-route` and
  `git-precommit-secret-hook` as **ADVISORY_ONLY** (they edit configuration so
  traffic *will* flow through the broker — the enforcement belongs to the
  broker's own capabilities, not to these), `screen-share-exposure-warning` as
  **VISIBILITY_ONLY** (VS Code cannot detect an in-progress screen share),
  `local-model-log-scan` as **DETECTION_ONLY**, and `rag-egress-detection` as
  **PARTIAL_ENFORCEMENT**. Known bypasses, including `git commit --no-verify`,
  are declared in the registry rather than omitted.

### Verified
- Extension: 235/235 tests across 56 suites pass; `tsc --noEmit` clean. (`npm
  run lint` is an alias for `typecheck` — this package has no ESLint config, so
  that is one check, not two.)
- guard-core: 466/466 tests pass; capability registry honesty invariant passes
  (`honest=true`, 28 capabilities).
- **The `engines.vscode` range is now tested, not assumed.** The manifest
  promises `^1.85.0` — every VS Code from Nov 2023 onward — while the suite had
  only ever run on 1.104.0. An extension that uses an API newer than its floor
  installs happily on an older editor and then fails at runtime for that user.
  The full host suite now passes 9/9 on **1.85.0** as well, including the check
  that every command the panel can invoke exists in that host. `npm run
  test:host:floor` reproduces it, deriving the version from `engines.vscode`
  itself so the two cannot drift apart.
- **Verified in a real VS Code host, not only in unit tests.** A new
  `npm run test:host` harness launches a pinned VS Code 1.104.0, activates the
  extension and drives the actual panel: 9/9 pass, including that toggling Live
  Scan from the panel really changes the setting, that a message outside the
  allowlist changes nothing, and that every command the panel can invoke exists
  in the host. The suite is mutation-proven — removing `action:unlock` from the
  provider's allowlist turns it red rather than leaving it green.
- **The security fixes above are mutation-proven, not merely tested.** Seven
  deliberate regressions were reintroduced one at a time — restoring the
  plaintext sibling backup, rewriting the file after a failed backup, dropping
  `scope: "machine"`, dropping a key from `restrictedConfigurations`, letting
  `*` cross a path separator, breaking the zero-segment `**/` case, and
  accepting a 404 stream route as a pass. Every one turned the suite red, and
  every file was restored byte-exact afterwards.
- 70 new regression tests cover the modules above, which had **zero** coverage
  in 0.3.0 — that absence is how a warning matching one filename, a hook with
  no exec bit, a claim with no scan behind it, a scanner that read nothing, a
  glob that excluded nothing and a backup that leaked every secret all shipped
  in the same release.

## [0.3.0] - 2026-08-04

### Added
- **AI Egress Firewall** — a single local choke point for text you are about to send to an AI tool. Returns `ALLOW` / `REDACT` / `ASK` / `BLOCK`, offers a redacted copy when secrets are present, and escalates to `BLOCK` when a secret rides along with an injection attempt.
- **Obfuscation-resistant scanning** — the same guard-core detectors are re-run over de-obfuscated variants of the text, so smuggled attacks that evade a single-pass regex still score: zero-width unicode, homoglyph (Cyrillic lookalike) substitution, leetspeak, letter-spacing, reversal, and base64.
- **Destination awareness** — `evaluateEgressToHost` combines the content decision with where it is going. Clean content to a non-allowlisted host becomes `ASK`; content carrying secrets becomes `BLOCK`.
- New commands: `SoterAI: Check Before Sending to AI` (core palette), plus `SoterAI: Show AI Egress Firewall Status` and `SoterAI: Check Egress Payload (API)` (advanced-gated). The payload command is a programmatic entry point for other extensions and future editor wrappers.
- Every egress decision is appended to the tamper-proof local audit ledger with **redacted evidence only** — raw text and secrets are never stored, logged, or transmitted.

### Security
- Redaction offsets are computed from the **raw** text only, so a folded/de-obfuscated variant can never produce a mis-aligned edit that leaves a secret in place.
- Findings carry minimized evidence; a behavioural test asserts the raw secret never reaches `redactedEvidence`.

### Honesty
- Registered `egress-firewall` in the capability registry as **PARTIAL_ENFORCEMENT**, not STRONG. It is a choke point for content SoterAI is asked to send or approve. VS Code exposes no network-interception API, so a request another extension makes directly to a provider is **not** intercepted. Known bypasses are declared in the registry and shown in the status view.

### Verified
- Extension: 139/139 tests pass, typecheck clean.
- guard-core: 466/466 tests pass; capability registry honesty invariant passes (`honest=true`, 23 capabilities).

## [0.2.2] - 2026-07-31

### Fixed
- Aligned packaged runtime release evidence with the broker Safe Mode policy check so VS Code-family hosts can prove the same VSIX behavior deterministically.
- Fixed the Marketplace license pointer to resolve to the bundled `LICENSE.md` file.

### Verified
- Packaged VSIX runtime probes passed in VS Code, Cursor, Windsurf, Kiro, and Antigravity with the same artifact.
- VSCodium was not installed on this machine, so its local runtime probe remains unverified until `codium` is available on PATH.

## [0.2.1] - 2026-07-22

### Added
- Controlled terminal flow that routes supported commands through the authenticated local broker with preview, fixed-argv execution, and redacted output.
- Runtime capability summary and status coverage indicators for brokered, partial, unsupported, and unknown paths.
- Extension isolation summary for risky non-allowlisted AI/agent extensions.
- Broker preflight coverage for runtime capabilities, file operations, network egress, MCP tools, policy changes, process launches, and extension isolation.
- Strongest local release gate evidence covering typecheck, tests, audit, VSIX packaging, and isolated VS Code install verification.

### Security
- Added process sandbox policy decisions for shell, environment-secret, unrestricted-network, and unrestricted-filesystem launches.
- Added file-operation, network-egress, MCP, taint, rollback, and governance policy guardrails in the shared guard core.
- Added release evidence gates that block `99+` and `100/100` claims unless external/deployment attestations are present.
- Dependency audit now passes at high severity with `0` known vulnerabilities.

### Verified
- `npm run validate:strongest-local` passed 15/15 required local checks.
- `npm test` passed 829 tests.
- VSIX installs successfully in an isolated VS Code profile as `soterai.soterai-ide-guard@0.2.1`.

## [0.2.0] - 2026-07-14

### Added - UX pack (native, local-first, all tested)
- **Live inline scanning** - supported files are scanned as you type and secrets / PII / prompt-injection appear as native squiggly diagnostics (`soterai.liveScan.enabled`, on by default). 100% local, debounced, skips oversized files / excluded globs / non-file schemes.
- **One-click Quick Fixes** - lightbulb actions on every finding: *Redact this finding* (undoable edit), *Copy safe version of this line*, and *Move secrets to protected vault* for secret categories. Internal `soterai.applyFindingFix` command is hidden from the palette.
- **Clipboard / paste guard** - `SoterAI: Scan Clipboard Before AI` checks what's on the clipboard and offers a redacted replacement; `SoterAI: Safe Paste` scans the clipboard and can insert a redacted version instead of the raw secret. Raw clipboard values are never logged.
- **Rich status dashboard** - the existing security dashboard now shows a Live Scan badge and has *Scan Clipboard* and *Getting Started* actions, all through the strict webview message allowlist.
- **Native Getting Started walkthrough** (`contributes.walkthroughs`) - 5-step guided onboarding (privacy mode -> demo scan -> scan selection -> policy pack -> sidebar), auto-opened once on first install via a `soterai.onboarded` flag. `soterai.openWalkthrough` command added.

### Changed
- **Command Palette hygiene:** of 123 contributed commands, only the core commands show by default; the rest are gated behind `soterai.advancedCommands` (`soterai.showAllCommands` or `soterai.experimentalFeatures.enabled`, default false) or hidden outright for internal commands. Nothing unregistered.

### Verified (2026-07-14, real runs)
- `tsc --noEmit` clean; **50 tests / 17 suites pass**; esbuild production bundle (extension.js 217 KB); VSIX packages to 16 files / ~222 KB with no `src`/tests/`.env`/secrets; no `console.log`/`eval`/`innerHTML` in extension source; VSIX installs via VS Code 1.128.0 CLI and Cursor 3.10.17 CLI and registers as `soterai.soterai-ide-guard@0.2.0`.

## [0.1.0-marketplace-readiness] - 2026-07-13

### Added
- Launch command surface: `SoterAI: Quick Start`, `Check Extension Health`, `Open Settings`, `Run Demo Scan`, `Scan Selected Text`, `Scan Git Diff`, `Review Terminal Command`, `Scan MCP / Agent Tools`, `Open AI Activity Ledger`, `Generate Canary Token`, and `Choose Policy Pack`.
- `soterai.privacyMode` setting with `local`, `cloud`, and `hybrid` options. Local mode is the default.
- Static tests covering launch commands, command aliases, build/lint scripts, privacy mode, no-console logging, and documented child-process boundaries.

### Changed
- Added `build` and `lint` package scripts required by release automation.
- Telemetry now fails closed in local privacy mode and untrusted workspaces; reviewed network telemetry remains disabled.
- Removed activation and telemetry console logging from extension source.
- Documented fixed-argv non-shell boundaries for git diff scanning and local broker startup.

### Verified
- Extension package typecheck, lint, test, build, and VSIX package completed successfully.
- Root typecheck and root test completed successfully.
- Generated VSIX installed through VS Code CLI as `soterai.soterai-ide-guard@0.1.0`.
