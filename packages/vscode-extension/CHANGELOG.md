# Changelog

## [0.4.0] - 2026-08-10

A real-user pass over the 0.3.x feature surface. Every entry below is a defect
that shipped in 0.3.0 and was reproduced before it was fixed. Several of them
were features that *reported* protection while doing nothing — those are the
ones worth reading.

### Fixed
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
