# Changelog

## [0.6.2] - 2026-08-31

### Changed

- Refreshed the packaged IDE extension with the latest Control Panel protection
  experience, including a working **Turn on everything** action and updated product
  guidance and screenshots.
- Synchronized the website install page and direct VSIX download metadata with this
  release version.

## [0.6.1] - 2026-08-28

### Changed

- **The Control Panel now shows a live Data Boundary receipt.** It derives its
  wording from workspace trust, privacy mode, cloud state, and telemetry level, so
  users can see at a glance whether data stays local, cloud actions are merely
  available, or optional redacted metadata is enabled. It never receives raw file
  content, prompts, tokens, or secrets.
- **Privacy opt-out now deletes pending telemetry metadata immediately.** Turning
  SoterAI telemetry off, returning to local mode, disabling cloud, or disabling the
  editor's telemetry clears the in-memory queue instead of retaining old metadata
  that could become eligible later. Temporary offline and workspace-trust holds do
  not silently change the user's explicit collection preference.
- **Local protocol inputs and responses are now bounded.** The MCP stdio server
  discards an oversized frame through its newline and then resumes on the next valid
  JSON-RPC frame; a large chunk containing many individually valid messages remains
  valid. Broker JSON responses are streamed through a 1 MiB cap and cancelled when
  the peer exceeds it, rather than being buffered without a limit.
- **Release CI now verifies the actual VSIX archive.** Both primary and independent
  reproducibility builds reject missing runtime bundles, forbidden development or
  secret-bearing files, duplicate/unsafe paths, excessive entry count, and excessive
  uncompressed size. The verifier emits a SHA-256 and exact entry inventory, plus a
  deterministic CycloneDX 1.6 SBOM whose file-component hashes are derived from the
  actual archive members. Neither artifact is presented as a cryptographic signature.
- **Broker request parsing now fails closed at the HTTP boundary.** Compressed bodies,
  duplicate or ambiguous framing, unsafe declared lengths, invalid UTF-8, and streamed
  bodies over the configured cap are rejected before detector or provider logic runs.
  A deterministic 100-case malformed-body corpus verifies bounded errors and recovery.
- **Control Panel messages now have mutation-specific schemas.** Toggle messages require
  a real boolean and no extra fields. Actions consume only their allowlisted type and
  ignore attacker-supplied URLs or command fields, preserving hardcoded destinations.
- **Privacy UX now has real-host evidence.** VS Code host tests render local,
  cloud-on-request, and optional-metadata states, and assert the Data Boundary's
  semantic live region, theme tokens, forced-colors support, reduced-motion CSS,
  260-pixel responsive layout, long-text wrapping, and malformed-message isolation.
- **Signed-release evidence is now retained and fail-closed.** A verified detached
  signature and its signing manifest are uploaded separately and hashed into finalized
  provenance. A true CI flag without both files cannot set `signatureVerified`, and a
  dirty build cannot claim the full signed/reproducible provenance gate.
- **Install now points to the one-click install page.** The README's primary
  install action is the SoterAI install page (`https://soterai.in/extensions/ide`),
  which redirects straight into VS Code, Cursor, Windsurf/Devin, Kiro, Antigravity
  or VSCodium. Marketplace/Open VSX links and the `.vsix` download remain as
  secondary manual routes.
- Windsurf install guidance notes the Devin rebrand (its URL protocol changed from
  `windsurf:` to `devin:`), so users on either build reach the extension.

## [0.6.0] - 2026-08-27

### Added

- **An administrator can now require a guard, not just hope it stays on.** Twenty-five
  settings were `machine`-scoped, which stops a hostile repository from weakening a
  guard but still lets the person at the keyboard switch protection off. Eight
  safety-critical settings now declare a `policy` block, so Intune, Group Policy or
  an MDM profile can pin them: `protection.enabled`, `privacyMode`, `cloud.enabled`,
  `sentinel.enabled`, `protectedWorkspace.enabled`, `terminal.protectionMode`,
  `secretInterceptor.enabled`, `autoVaultMigration.enabled`.

  When a setting is pinned, the Control Panel shows the control as **Set by your
  organisation**, disables its toggle, and says in one plain sentence that it was set
  outside this editor. Clicking a pinned toggle previously appeared to work and
  changed nothing, because VS Code keeps the managed value — the worst possible
  outcome for a security control.

  **How the detection works, and its limit.** VS Code exposes no API for reading a
  policy value: `inspect()` reports default, global, workspace and folder layers and
  stops. So `enterprise/managedSettings.ts` computes what those visible layers would
  resolve to and compares it with the effective value; a mismatch means a layer the
  extension cannot see won. That is why the wording says "set outside this editor"
  rather than naming Group Policy — the inference proves an invisible override, not
  which mechanism produced it. A policy pinning a setting to the value it already had
  is invisible, which is harmless: the user sees the correct state either way.

- **Telemetry now obeys the editor's own telemetry setting.** `TelemetryManager` read
  only SoterAI's `telemetry.redactedEvents` and never `vscode.env.isTelemetryEnabled`,
  so a user who turned telemetry off for the whole editor still had SoterAI events
  queued. For a security product that is a compliance finding, not a preference
  mismatch. Events now route through `env.createTelemetryLogger` (feature-detected,
  since it postdates the `^1.85.0` floor) and the editor-wide flag is checked before
  an event is even recorded — a queue built while telemetry is off is still data the
  user asked us not to collect.

  Second defect in the same file: `sendEventsToCloud()` returned `true` without
  sending anything, so the queue was trimmed as though delivered. There is no reviewed
  endpoint client, so it now returns `false` and the queue is held. A new
  `holdReason()` states which gate is holding it, in one sentence, instead of leaving
  a silent queue unexplained.

  **Residual limitation.** No network telemetry transport ships at all, so the "send"
  path is verified only as far as the logger. The gate itself
  (`enterprise/telemetryGate.ts`) is pure and every branch is unit-tested; the
  transport beyond it is unwritten, not merely untested.

- **Dangerous commands in the integrated terminal are now detected as they run.**
  `TerminalCommandRiskDetector` has 22 patterns — fork bombs, `curl | bash`, reverse
  shells, reads of `~/.aws/credentials`, `--privileged` containers, destructive
  `kubectl` — and none of them ran unless a user deliberately pasted a command into a
  SoterAI input box. The only automatic terminal behaviour was one advisory per
  session on `onDidOpenTerminal`, with a "Don't Show Again" that silenced it forever.
  An AI agent running `rm -rf ~` in the integrated terminal produced nothing at all.

  SoterAI now subscribes to `window.onDidStartTerminalShellExecution` and runs the
  existing detector over `execution.commandLine`. A critical match shows a modal
  naming the matched pattern; lower severities show a normal notification. Every
  detection is recorded in the redacted timeline first, so a dismissed message can
  still be found afterwards.

  **"Don't show again" no longer silences a critical detection.** It suppresses the
  coverage advisory only. Critical fires on every occurrence, not once per session.

  **This is `MONITORED`, and it says so.** The event arrives after the shell has begun
  the command; there is no veto and no way to recall a running process. The capability
  registry records it as `DETECTION_ONLY` with `preExecutionBlock: false`, and when the
  user asks how to undo it, SoterAI says plainly that it cannot undo a command the
  shell already ran. Only the broker's controlled terminal is `ENFORCED`.

  **Residual limitations.** The API postdates `^1.85.0`, so on the oldest supported
  hosts this registers nothing (feature-detected, no throw). Even on a new host it
  only fires for shells where VS Code shell integration is active — a shell without it
  runs commands SoterAI never sees. External terminals and subprocesses spawned by a
  running command are never visible.

### Changed

- **The palette no longer offers the same workflow twice.** Eight commands were thin
  aliases forwarding to another command, with both halves listed in the palette:
  `scanSelectedText`→`scanSelection`, `scanGitDiff`→`scanGitChanges`,
  `reviewTerminalCommand`→`checkTerminalCommand`, `choosePolicyPack`→`applyPolicyPack`,
  `openSecurityPanel`→`openControlPanel`, `scanMCPAgentTools`→`scanMCPConfigs`,
  `openAIActivityLedger`→`openAILedger`, `generateCanaryToken`→`generateCanary`.
  Each alias is **still declared and still registered** — a keybinding, task or another
  extension's `executeCommand` that references one keeps working — but it no longer
  occupies a palette row beside the command it forwards to.

- **Eighteen `Show …` rows became one `SoterAI: Open Report`.** The old surface required
  the user to know which report existed before they could look at anything, and the
  titles read as module names. The new command lists every report with a one-line
  description, phrased as the question it answers ("What is protected right now",
  "Files an AI agent read"). All eighteen commands stay registered for automation; only
  their palette rows are gone.

- **The README stops advertising a command count.** "The full surface (162 commands)"
  reads to a reviewer as an unfinished product and means nothing to a user who can
  reach ten of them. The Commands table now names the canonical command for each
  workflow, and a test fails if a raw count returns.

- **One generated readiness document replaces the stale hand-written ones.**
  `docs/vscode-extension-marketplace-readiness.md` claimed v0.1.0, "all 100 commands"
  and a MIT license while the shipped package was 0.5.0 with a different command count
  and `SEE LICENSE IN LICENSE.md`. It sat in the public repo the marketplace listing
  links to, so a reviewer could find the contradiction before a customer did. It is
  deleted. `docs/vscode-extension-readiness.md` replaces it and is **generated** from
  the manifest and from guard-core source by `scripts/generate-readiness.mjs`, with
  `readiness-doc.test.ts` failing the build the moment it drifts. Every count in it —
  commands, palette visibility, settings, policy-pinnable settings, per-detector rule
  totals — is read from source at generation time.

  `SOTERAI-EXTENSION-TESTING-AND-MARKET-ANALYSIS.md` claimed "400+ detection rules",
  "100+ commands" and "18 risk types". Corrected to the real figures (12 detectors,
  186 explicit rules), with a note naming what it previously claimed — quietly editing
  a wrong number is how the next wrong number survives.

  **Residual limitation.** The generator reads the manifest and counts `pattern:` rule
  entries in guard-core; it does not execute the detectors, so a rule that is declared
  but unreachable would still be counted.



- **An AI agent can now ask SoterAI whether an action is safe, instead of SoterAI
  shouting from the sidebar.** Copilot agent mode and every MCP client work by
  calling tools, and SoterAI contributed none — it had 162 commands and no way to
  be consulted from inside the loop it is named for. `vscode.lm.registerTool` and
  `vscode.lm.registerMcpServerDefinitionProvider` both existed in the installed
  `@types/vscode` and neither was used.

  Three tools, reachable two ways:

  - **`soterai_scan_text`** — secrets, prompt injection and jailbreak attempts in
    text the agent is about to send, write or commit. Returns a redacted copy when
    the text held a secret. Catches content hidden by zero-width characters,
    homoglyphs, leetspeak or base64.
  - **`soterai_check_command`** — the 22-pattern terminal check, before the agent
    runs the command: recursive deletes, fork bombs, `curl | bash`, reverse
    shells, reads of `~/.aws/credentials`, privileged containers, destructive
    `kubectl`.
  - **`soterai_check_dependency`** — typosquats, unpinned versions,
    install-from-URL and piped-shell installers, from either a whole install
    command or a name and version.

  In VS Code chat and Copilot agent mode they arrive as language model tools. For
  every other agent — Claude Desktop, Cline, Continue — the same three are served
  by a bundled MCP server (`dist/soterai-mcp-server.js`, stdio JSON-RPC), offered
  to the editor through an MCP server definition provider so the user does not
  hand-edit an `mcp.json`.

  Both surfaces call one decision module, `src/agent/toolLogic.ts`. Two
  implementations of "is `rm -rf /` dangerous" would mean two answers, decided by
  which door the agent happened to come through.

  **These tools are ADVISORY, and every result says so in its own `coverage`
  field.** They return a verdict on text an agent chose to submit. An agent that
  never calls them is unaffected, and VS Code exposes no API to force the call or
  to intercept an agent's own file, network or terminal access. A result that
  overstated its authority would be worse than no result: the model would relay
  the overstatement to the user as protection.

  **`engines.vscode` stays at `^1.85.0`.** Both APIs are far newer, so both are
  feature-detected at runtime and register nothing at all on an older host.
  Raising the floor would drop Cursor, Windsurf, Kiro and Antigravity, which the
  Open VSX plan depends on. `soterai.showRuntimeCapabilitySummary` reports what
  actually registered on the current host, and says plainly when the answer is
  "nothing, because this editor does not implement the API".

  `src/__tests__/agent-tools.test.ts` (45 assertions) pins the logic, the manifest,
  and the whole MCP protocol surface without a host: verdicts for each tool, that
  no raw secret survives into a result or across the wire, that a block verdict is
  a successful call rather than a JSON-RPC error, that notifications get no reply,
  and that the manifest, the registered tool table and the MCP definitions list
  the same three names — a mismatch there is invisible at runtime, because the tool
  is simply absent from the agent's list with no error anywhere.
  `src/__tests__/host/agentTools.host.ts` (8 checks) then invokes each tool through
  `vscode.lm.invokeTool` in a real editor, because a manifest test cannot tell a
  registered tool from a contributed one that never registered.

  **Residual limitations.**
  - The MCP server is verified in three ways — unit tests against
    `handleMcpMessage`, a real spawned-process handshake during development, and a
    host check that the bundle the provider points at exists and is non-empty — but
    no test drives a third-party MCP client (Claude Desktop, Cline) end to end.
    Compatibility with those rests on the protocol, not on an executed run.
  - The graceful no-op on a host without `vscode.lm` is asserted by the same suite
    when run via `npm run test:host:floor` against VS Code 1.85.0. That run was not
    executed for this change, so the floor behaviour is verified by construction
    (feature detection plus the assertions that fire when the API is absent) rather
    than by an executed 1.85 run.
  - A tool result is handed to a language model and usually leaves the machine.
    Tests assert no raw secret appears in any result, but redaction is only as good
    as the detectors: a secret no detector recognises passes through untouched.

- **SoterAI now appears where the risk happens, not only in the Command Palette.**
  `contributes.menus` held exactly one key — `commandPalette` — with zero
  keybindings, zero context-menu entries and zero view-welcome content. The
  effect was that 162 working commands were reachable through 10 palette rows,
  and only if the user remembered to be careful at the moment users are least
  careful. Every surface below reuses an existing command; no command was added.

  - **Editor right-click → SoterAI** (only with a selection): Scan Selection,
    Scan Before Sending to AI, Redact Selection for AI, Review Selected AI Code.
  - **Explorer right-click → SoterAI** (files only): Scan File, Add File to
    Protected List.
  - **Source Control toolbar**: Scan Git Changes, gated to `scmProvider == git` —
    the last moment before a secret is committed.
  - **Sidebar view toolbars**: Scan Workspace Risk on Project Risk; Open Settings
    and Getting Started on the Control Panel.
  - **`Ctrl+Alt+V` / `Cmd+Alt+V`** → Safe Paste, and **`Ctrl+Alt+S` /
    `Cmd+Alt+S`** → Scan Before Sending to AI. Two bindings, both scoped to
    `editorTextFocus`, both two-modifier chords so they do not shadow core keys.
  - **View welcome content on all three tree views.** An empty Project Risk view
    previously rendered nothing at all; it now says the score is *unknown* rather
    than zero, and offers a scan or the safe demo. The empty-workspace case gets
    its own message instead of offering a workspace scan with no workspace.

  `src/__tests__/discoverability.test.ts` pins the manifest shape: 16 assertions
  covering menu-to-command resolution, submenu declaration, a mandatory `when`
  clause on every non-palette entry, the keybinding budget, mac chords, and
  command icons for `view/title` navigation groups. Six of them fail against the
  0.5.0 manifest.

  `src/__tests__/host/discoverability.host.ts` runs the same surfaces in a real
  extension host, because a manifest test cannot tell a wired menu from a dead
  one. It reads the surfaces from the manifest the host loaded, then invokes each
  the way the surface does: the Explorer entries with an explicit `Uri` for a
  file that is *not* open, the editor submenu against a real full-document
  selection, Safe Paste against a clipboard holding a fake key, Scan Git Changes
  in a workspace that is not a repository, and the view toolbars with no
  arguments. It also asserts no submenu command echoes the raw key back into a
  user-visible surface. 9 checks, all passing on VS Code 1.104.0.

  **Residual limitation.** No test can prove the menu item is *visible*: VS Code
  exposes no API to enumerate a rendered context menu, so the `when` clauses
  (`editorHasSelection`, `!explorerResourceIsFolder`, `scmProvider == git`) are
  verified as declared, not as evaluated. The keybindings are likewise invoked as
  commands — the chord-to-command binding itself is the host's to honour.

### Fixed

- **Add File to Protected List failed from the Explorer.** The handler read only
  `window.activeTextEditor`, so right-clicking a file that was not open reported
  "Open a file to protect" — the exact case the Explorer entry exists for, since
  a `.env` is usually protected without ever being opened. It now accepts the
  `Uri` VS Code passes from a resource menu and falls back to the active editor.

A packaging and honesty pass driven by reading the shipped artifact rather than
the source tree. Each item was reproduced before it was fixed, and each fix is
pinned by a test or by an inspection of the VSIX file list.

- **The package's own CI gate was red for a reason unrelated to its code.**
  `npm run typecheck` — the command `signed-release.yml` and
  `cross-ide-release.yml` both run before packaging — failed with `TS2688` on
  `babel__core`, `babel__generator`, `babel__template`, `babel__traverse` and
  `react-transition-group`. None of those are compiled here: `tsc` was implicitly
  loading every folder in the monorepo root `node_modules/@types`, including
  packages whose own `@types` dependencies are not installed in this workspace.
  `tsconfig.json` now pins `types: ["node", "vscode"]`, which is the complete set
  this package actually uses.
- **A scratch file was shipping inside every VSIX.** `aadhaar-check.ts`, a
  throwaway India-PII probe at the package root, travelled to users because
  `.vscodeignore` excluded `src/**` and named `canaryVerify.ts` explicitly — a
  rule that stops working the moment a second scratch file appears. Root-level
  `*.ts` is now excluded as a class.
- **A fresh install showed three SoterAI status-bar items, two of them saying
  "Off".** 0.4.1 consolidated six status-bar entries into one honest summary, but
  `WorkspaceGuard` and `AISentinel` still called `show()` in both branches of
  their update, so "Protected Off" and "Sentinel Off" remained permanent
  furniture. Both now `hide()` while disabled; their state is already reported in
  the consolidated tooltip, so nothing is lost.
- **An untrusted workspace could still switch off the secret interceptor.**
  `soterai.secretInterceptor.enabled` was `machine`-scoped but missing from
  `capabilities.untrustedWorkspaces.restrictedConfigurations`, so it was the one
  safety-relevant setting that still applied in Restricted Mode. The count of
  hardened settings in the README moves from 23 to 25 accordingly, and a new test
  derives that number from the manifest instead of trusting the prose.
- **Four dead walkthrough pages were packaged in every release.**
  `media/walkthrough/explore.md`, `policy.md`, `privacy.md` and `scan.md` were
  orphaned when 0.5.0 cut onboarding from five steps to three. `explore.md` was
  worse than dead weight: it told users the Command Palette shows "12 core
  commands" when it shows 10. `manifest-assets.test.ts` previously checked only
  that referenced assets exist; it now also fails on any walkthrough page the
  manifest does not reference.

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
