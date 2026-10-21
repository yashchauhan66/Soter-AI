# SoterAI IDE Guard — Safer AI Coding, Local by Default

**Local secret and prompt checks for SoterAI-managed context and broker requests — in the editor you already use.**

**Covers:** accepted context exclusions, recognized-value redaction and requests actually routed through SoterAI. **Does not cover:** native agents, same-user filesystem/process access, other extensions, original buffers/tabs, OS clipboard/capture or independent network traffic. Setup and smoke checks are operational evidence; selected-architecture **G1–G6 remain UNTESTED and the full claim is BLOCKED**.

<p>
  <img src="https://img.shields.io/badge/LOCAL--FIRST-Enabled-F96403?style=for-the-badge" alt="Local-first protection" />
  <img src="https://img.shields.io/badge/ACCOUNT-Not_Required-202830?style=for-the-badge" alt="No account required" />
  <img src="https://img.shields.io/badge/API_KEY-Not_Required-202830?style=for-the-badge" alt="No API key required for local scanning" />
  <img src="https://img.shields.io/badge/PRICE-Free-202830?style=for-the-badge" alt="Free extension" />
</p>

Scan locally · Redact sensitive context · Guard supported AI traffic — no account, no cloud, no API key required.

## See it in action

The advanced **Configure Pinned Cline** command prepares the exact reviewed Windows Cline **4.1.25** artifact for one local project per profile. It requires Cline hooks enabled, remote configuration opted out, no legacy custom-header override and an existing OpenAI-compatible model. Stop active tasks, review the masked provider/session-header changes and encrypted backup, then restart Cline and verify its actual route. **Restore Pinned Cline** restores unchanged owned entries after review. The machine setting `soterai.lite.clineAdapter` withdraws its session while retaining denies and backups. Current-instance routing remains **Uncovered** until verified; direct context/attachments, unsupported tools and vendor hook failures remain explicit limits.

The bundled MCP tool `soterai_read_project_file_safely` uses the live editor's authenticated local session and existing saved-file reader. Every read needs native review of the exact safe output; dotenv values remain masked and persistent restrictions remain. Cancellation, policy/file/session drift and outages withhold content. The machine setting `soterai.lite.safeReadMcp` revokes the route. This supports a trusted single local workspace; same-user requester identity and vendor-agent routing are unverified. Other tools can still read originals directly.

Local scans can flag recognized synthetic secrets. A scanner verdict does not establish interception of another tool's traffic or confinement of a same-user process.

### Project privacy in the local source build

`SoterAI: Manage Project Privacy` brings file restrictions, one-time safe-read
reviews and a managed read terminal together. Approved dotenv reads return
variable names with `[MASKED]` values; sensitive-marked files stay wholly masked.
Ordinary approved views redact recognized secrets and protected regions while
retaining the saved deny. The machine setting `soterai.projectPrivacy.enabled`
defaults to `true`; it also withholds risky raw overrides in managed paste/reveal
flows.

These additions have not been deployed or verified against live Cline. They do
not intercept Cline's native file tools, ordinary terminals or independent
uploads. See the [workflow guide](../../docs/project-privacy/USER-GUIDE.md) and
[Cline assessment](../../docs/project-privacy/CLINE-ASSESSMENT.md).

---

## 🚀 Install — Pick Your Editor

**One click, inside your editor.** These links open the extension panel in your editor and install directly. Free, no account.

| Editor | Direct Install | Command line |
| :--- | :--- | :--- |
| **VS Code** | **[Install now →](vscode:extension/soterai.soterai-ide-guard)** | `code --install-extension soterai.soterai-ide-guard` |
| **Cursor** | **[Install now →](cursor:extension/soterai.soterai-ide-guard)** | `cursor --install-extension soterai.soterai-ide-guard` |
| **Windsurf / Devin** | **[Install now →](windsurf:extension/soterai.soterai-ide-guard)** | `windsurf --install-extension soterai.soterai-ide-guard` |
| **Kiro** | **[Install now →](kiro:extension/soterai.soterai-ide-guard)** | `kiro --install-extension soterai.soterai-ide-guard` |
| **Antigravity** | **[Install now →](antigravity:extension/soterai.soterai-ide-guard)** | `antigravity --install-extension soterai.soterai-ide-guard` |
| **VSCodium** | **[Install now →](vscodium:extension/soterai.soterai-ide-guard)** | `codium --install-extension soterai.soterai-ide-guard` |

> **Windsurf rebrand note:** Windsurf is now Devin. If the link above does not open, try the alternative: [devin:extension/soterai.soterai-ide-guard](devin:extension/soterai.soterai-ide-guard)

### Install from inside your editor

Open **Extensions** with `Ctrl+Shift+X` (`Cmd+Shift+X` on macOS), search for
**SoterAI IDE Guard**, and select **Install**. In VS Code, you can also open
Quick Open with `Ctrl+P` / `Cmd+P` and paste:

```text
ext install soterai.soterai-ide-guard
```

> **Install the authentic extension**
>
> **Name:** SoterAI IDE Guard - AI Security & Secret Protection · **Publisher:** `soterai` ·
> **Extension ID:** `soterai.soterai-ide-guard`

### Offline / manual installation

For offline or restricted environments, download the `.vsix` from
[Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard) or the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard), then choose
**Extensions → Install from VSIX…**. After installation, select the **SoterAI
Guard shield** in the Activity Bar.

> **Cannot find it in editor search?** Use the direct links above, the
> [Marketplace](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard), or
> [Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard). Registry search results
> can take time to refresh after a release.

<div align="center">

[Website](https://soterai.in) ·
[Docs](https://soterai.in/vscode-ai-security) ·
[Support](https://soterai.in/support) ·
[Report an issue](https://github.com/yashchauhan66/Soter-AI/issues) ·
[Source](https://github.com/yashchauhan66/Soter-AI)

</div>

## ✅ 60 seconds after install — do these 3 things

Open **SoterAI Guard → Control Panel**:

1. Run `SoterAI: Run Safe Demo Scan` to see a real local verdict using built-in
   test data—without exposing your code.
2. Run `SoterAI: Protect Workspace Secrets` to preview sensitive files and
   replace only approved values with safe local placeholders.
3. Run `SoterAI: Secure Installed AI Tools (One Click)` to review supported AI
   client routing changes. Every approved rewrite gets an encrypted backup
   outside your workspace and can be reversed with
   `SoterAI: Undo AI Tool Security Changes`.

**Local scanning is already enabled when you install.** These first steps need
no account, cloud connection, or provider API key.

## Your AI security posture, in one view

See active controls, request checking, editor warnings, known gaps, and the
current data boundary without leaving your editor.

Review the current scope notice and operational status. Historical marketplace captures have been retired from this release's README and package because their labels do not establish current agent-routing or G1–G6 verification.

## Know your protection at a glance

| Surface | What SoterAI does | Coverage |
| --- | --- | --- |
| Files, selections, clipboard, and git changes | Scans locally for secrets, PII, prompt injection, and risky code; offers redacted output | **Local detection and redaction** |
| Supported AI requests routed through the local broker | Checks content before forwarding and scans supported responses | **Blocks on the routed path** |
| Protected workspace context built by SoterAI | Excludes protected files before SoterAI builds AI context | **Blocks on the SoterAI-built path** |
| Raw integrated terminal | Detects supported risky commands after shell execution begins and directs you to the checked terminal | **Warns / monitors** |
| Controlled terminal | Allows a bounded set of fixed-argument, read-only commands after pre-execution checks | **Blocks unsupported commands** |
| MCP and agent configuration | Detects broad process execution, remote endpoints, embedded credentials, and risky configuration | **Detection only unless routed through a supported guard** |
| Other extensions’ private network calls | Cannot be intercepted by a VS Code extension API | **Not controlled** |

The Control Panel always shows the current **data boundary**, active controls,
known gaps, and one recommended next action. Green protection labels are reserved
for paths SoterAI technically controls.

## Review local results inside VS Code

Run the synthetic demo, review a selection and inspect the broker's named managed controls. Review findings and unmarked private information before sharing. These actions do not prove third-party agent routing or global network enforcement.

## Features

- **Control Panel** - one sidebar for managed request checks, context exclusions, diagnostics, monitoring, MCP configuration review and scoped lockdown. The privacy receipt describes SoterAI cloud features separately from provider traffic. Capability badges describe named managed paths; current status does not establish independent agent routing or G1–G6 verification.
- **Secure My AI (one click)** - discovers known configuration candidates for clients such as Cline, Claude Code, Continue and Aider, then reviews supported routing changes. Copilot's direct content and traffic cannot be rerouted or observed by this integration. Approved rewrites receive encrypted backups outside the workspace; restore commands recover those originals. Broker smoke checks do not verify third-party clients' actual requests.
- **Scan Current File / Selection / Workspace** - detect leaked secrets, PII, prompt injection, unsafe instructions, and risky patterns with a redacted report.
- **Live inline scanning + Quick Fixes** - supported files are scanned as you type; findings appear as native diagnostics with lightbulb fixes (redact in place, copy a safe version of the line, move secrets to the vault).
- **Redact Selection for AI** - copy selected text with recognized sensitive values replaced. Review unmarked private information before sharing.
- **Scan Before AI Prompt** - paste a prompt, scan it locally, and get an allow / redact / block verdict plus a safe prompt to copy.
- **AI Egress Firewall** - a managed request policy checker with `ALLOW` / `REDACT` / `ASK` / `BLOCK` decisions, recognized-pattern checks over supported transformed variants and destination-aware rules. Only requests submitted to this checker are covered. It cannot force native processes or other extensions to use it, and it does not provide an OS network allowlist.
- **Git pre-commit secret hook** - installs a hook that blocks a commit containing secrets. Refuses to install (with an explanation) when `core.hooksPath` is set by husky/lefthook rather than writing to a directory git ignores, and backs up any existing hook.
- **Screen-share risk check** - warns when files that would expose secrets on a shared screen are open, matching on basename and on credential directories (`.ssh`, `.aws`, `.gnupg`, `.kube`, `.docker`) and key material.
- **Scan Git Changes** - scan staged and unstaged diffs for secrets and sensitive files before commit.
- **Check Terminal Command** - flag destructive, remote-exec, credential-exposing, or suspicious shell commands before you run them.
- **Review Selected AI Code** - surface likely vulnerabilities in AI-generated code inside a hardened webview.
- **Local AI Broker** - authenticated loopback-only OpenAI/Anthropic-compatible routing with request/response scanning, redaction, canary blocking, and **SSE streaming** (`stream: true`) with scan-before-forward output protection.
- **Bounded local protocols** - broker JSON responses and MCP stdio frames are capped at 1 MiB. Oversized MCP frames are discarded through their newline so later valid checks remain synchronized.
- **Secret Broker** - replaces recognized values with scoped `soterai://secret/...` references on managed context paths. Same-user access to local credentials and unmarked private text remain outside that transformation.
- **AI Safe Mode** - Developer, Strict, and Enterprise protection overlays for SoterAI-routed workflows.
- **AI Memory Inspector** - hashes, decisions, redacted evidence, and file metadata showing what SoterAI brokered or built for AI.
- **Security Dashboard** - risk score, findings, privacy mode, policy status and the local handling model with its limits.

## Privacy & Security

- **Local-first by default.** Detection, redaction, policy checks, and secret reference creation run locally in the extension host.
- **Managed redaction has limits.** Recognized values and accepted protected sources are filtered on managed paths. Unmarked private information can remain in candidate output; this does not control another tool's transmission.
- **Local handling and scope.** `SoterAI: Local Privacy Status`, `SoterAI: Preview Managed AI Context`, and `SoterAI: What Stays Local?` describe configured handling and managed previews. They do not observe third-party model requests or prove complete confidentiality.
- **Redacted, opt-in telemetry only.** Telemetry is off by default. When enabled, it uses minimized event metadata, not raw content or tokens.
- **Opt-out purges pending metadata.** Turning SoterAI telemetry off, returning to local privacy mode, disabling cloud, or disabling editor telemetry immediately clears SoterAI's in-memory telemetry queue.
- **Local credential storage.** Provider and cloud credentials use VS Code SecretStorage. Keeping ciphertext outside the workspace does not establish independent custody against same-user applications.
- **Config backups are encrypted and kept out of your workspace.** When "Secure My AI" rewrites a config, the pre-rewrite copy is encrypted (AES-GCM, key in VS Code SecretStorage) and stored in the extension's global storage — never as a plaintext sibling file that `.gitignore` would miss. If the backup cannot be written, the rewrite does not happen.
- **Repository settings have limited authority.** The 73 safety-relevant settings are `machine`-scoped and declared as restricted in untrusted workspaces. This limits repository overrides; it does not prevent an agent running as the same user from changing user settings or other execution paths.
- **The packaged artifact is inspected, not assumed safe.** Release CI rejects unexpected source, tests, maps, logs, `.env` files, dependencies, duplicate/unsafe archive paths, missing runtime bundles, and oversized archives. It records a SHA-256 and exact entry inventory, then generates a deterministic CycloneDX 1.6 SBOM with a SHA-256 component for every file that actually ships. Integrity evidence and the SBOM are not claimed to be a cryptographic signature.
- **Broker ingress fails closed.** Request bodies are capped, declared oversize is rejected before reading, compressed and ambiguous framing is refused, and malformed UTF-8 is never replacement-decoded into apparently valid JSON.

### What Leaves Your Machine?

| Data | Local mode default | Cloud/hybrid with explicit setup |
| --- | --- | --- |
| Raw API keys, tokens, private keys, `.env` values | Recognized values are replaced on managed context paths; local components process raw input | Configured credential-use or provider paths have their own scopes; local mode is not a network prohibition |
| Raw file contents and prompts | Local detector scanning; unmarked private text can remain in output | Reviewed cloud submissions and configured provider requests may transmit content |
| Telemetry | Off | Redacted metadata only, controlled by `soterai.telemetry.redactedEvents` |
| Vaulted secrets | Local ciphertext and VS Code SecretStorage; same-user custody is not isolated | Approved broker credential use has a separate route; independent tools remain outside coverage |
| AI context | Accepted exclusions and recognized-value redaction | Broker/provider traffic can leave the machine regardless of detector privacy mode |

Use `SoterAI: Local Privacy Status` anytime to show a user-safe report that contains no API keys, prompts, secrets, raw files, private keys, database URLs, or PII.

## Workspace Trust

The extension declares **limited** untrusted-workspace support:

| Capability | Trusted workspace | Restricted workspace |
| --- | --- | --- |
| Local scanning and redaction | yes | yes |
| Cloud connect / token storage | yes | disabled |
| Remote scan escalation | yes | disabled |

Local scanning always works. Cloud, token, and remote features are gated behind a trusted workspace and surfaced clearly in the dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `SoterAI: Open Control Panel` | The single screen: every protection toggle, honest coverage badges, and Emergency Lockdown. |
| `SoterAI: Quick Start` | Choose a value-first next step: demo scan, workspace secret protection, AI-tool routing, or the local privacy promise. |
| `SoterAI: Check Extension Health` | Show version, privacy mode, token configured yes/no, workspace trust, policy status, and last scan without secrets. |
| `SoterAI: Local Privacy Status` | Show configured handling metadata and its limits, without including user secret values. |
| `SoterAI: What Stays Local?` | Explain exactly what SoterAI does not receive by default. |
| `SoterAI: Preview Managed AI Context` | Show a managed context candidate; review unmarked private text before sharing. |
| `SoterAI: Build Safe Prompt for AI` | Build a candidate prompt with recognized-value redaction; review unmarked private text before sharing. |
| `SoterAI: Open Settings` | Open VS Code settings filtered to SoterAI. |
| `SoterAI: Run Safe Demo Scan` | Run a safe local demo against fake risky text. |
| `SoterAI: Scan Selection` | Scan selected prompt/text before sending it to an AI assistant. |
| `SoterAI: Scan Before Sending to AI` | Run the egress firewall over the selection (or clipboard) and get an allow / redact / ask / block decision before you paste into any AI chat. |
| `SoterAI: Scan Current File` | Scan the active file for secrets, PII, prompt injection, unsafe instructions, and insecure patterns. |
| `SoterAI: Scan Git Changes` | Scan staged and unstaged git changes locally. |
| `SoterAI: Scan MCP Configs` | Review MCP and agent tool configuration for broad or dangerous permissions. |
| `SoterAI: Check Terminal Command` | Review a command before running it; SoterAI never executes it. |
| `SoterAI: Install Git Pre-Commit Secret Hook` | Block commits containing secrets. Refuses (and explains) when husky/lefthook owns `core.hooksPath`. |
| `SoterAI: Check Screen-Share Risk` | Warn about open files that would expose secrets on a shared screen. |
| `SoterAI: Open Report` | One list of every local report — coverage, what AI saw, agent tool permissions, risk score — with a one-line description each. |
| `SoterAI: Open AI Access Ledger` | View privacy-preserving local scan/share metadata. |
| `SoterAI: Generate Local Canary Secret` | Create a fake canary token for leak detection tests. |
| `SoterAI: Apply Policy Pack` | Apply a built-in policy profile. |
| `SoterAI: Emergency Lockdown (Revoke All Capabilities)` | Revoke everything at once; `SoterAI: Unlock Protection After Lockdown` reverses it, and the panel offers it as the primary action while locked. |

The palette shows the core workflows by default. Older command names still work —
they stay registered for keybindings, tasks and other extensions — but they no
longer occupy a second palette row next to the command they forward to, and the
individual report commands are now listed inside `SoterAI: Open Report`. Enable
`soterai.showAllCommands` to see the full advanced surface.

## Where SoterAI appears while you work

You do not have to remember to open the Command Palette. The checks are on the
surfaces where the risk actually happens:

| Where | What you get |
| --- | --- |
| Right-click a selection in the editor → **SoterAI** | Scan Selection, Scan Before Sending to AI, Redact Selection for AI, Review Selected AI Code |
| Right-click a file in the Explorer → **SoterAI** | Scan File, Add File to Protected List |
| Source Control view toolbar | Scan Git Changes before you commit |
| SoterAI Guard sidebar toolbars | Scan Workspace Risk, Open Settings, Getting Started |
| `Ctrl+Alt+V` / `Cmd+Alt+V` | Safe Paste — scans the clipboard, then pastes the safe version |
| `Ctrl+Alt+S` / `Cmd+Alt+S` | Scan Before Sending to AI — checks the selection, or the clipboard if nothing is selected |

Both keybindings only apply while an editor has focus, so they never shadow a
shortcut you use elsewhere in VS Code.

## Your AI agent can ask SoterAI before it acts

SoterAI contributes three tools an AI agent can call, so the check happens inside
the agent's own loop instead of in a sidebar the agent cannot see:

| Tool | What it answers |
| --- | --- |
| `soterai_scan_text` | Does this text contain secrets, prompt injection or a jailbreak attempt? Returns a redacted copy when it holds a secret. |
| `soterai_check_command` | Is this shell command destructive or credential-stealing? |
| `soterai_check_dependency` | Is this package a typosquat, unpinned, or installed by piping a download into a shell? |

In VS Code chat and Copilot agent mode they appear as tools automatically. Other
MCP clients get the same three from a bundled MCP server, which VS Code offers to
agent mode without you editing any config.

**These tools are advisory.** They answer questions an agent chooses to ask.
SoterAI cannot force an agent to ask, and no extension API lets it intercept what
an agent does on its own — so every result states that limit in full rather than
implying the action was blocked.

They need a recent editor. SoterAI keeps its VS Code `^1.85.0` floor so Cursor,
Windsurf, Kiro and Antigravity stay supported, and on a host without the language
model tool API it registers nothing instead of pretending.
`SoterAI: Show Runtime Capability Summary` reports which surfaces are live on the
editor you are actually using.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `soterai.privacyMode` | `local` | `local`, `cloud`, or `hybrid`. Local mode uses local detectors only. |
| `soterai.cloud.enabled` | `false` | Enables configured cloud features in trusted workspaces only. |
| `soterai.cloud.baseUrl` | `https://api.soterai.in` | Cloud API base URL. |
| `soterai.policy.mode` | `local` | Local/team/enterprise policy mode. |
| `soterai.scan.remoteEscalation` | `never` | Remote escalation mode for redacted/minimized high-risk scans. |
| `soterai.scan.maxFileSizeKb` | `256` | Maximum file size for local scans. |
| `soterai.scan.maxWorkspaceFiles` | `1000` | Maximum files checked during workspace scans. |
| `soterai.scan.excludeGlobs` | common build/binary folders | Patterns excluded from workspace scans. |
| `soterai.dependencyGuard.osvMode` | `ask` | `ask` / `always` / `never` — whether Dependency Guard may query public OSV (`api.osv.dev`) for package name+version advisories. Heuristics always run locally. Advisory only. |
| `soterai.liveScan.enabled` | `true` | Inline VISIBILITY_ONLY diagnostics (regex/heuristic; no ML in the VSIX). |
| `soterai.protection.enabled` | `true` | Master switch for the central protection state. |
| `soterai.sentinel.enabled` | `false` | AI activity sentinel; `soterai.sentinel.retentionDays` bounds local retention. |
| `soterai.mcpFirewall.strictMode` | `false` | Stricter verdicts for MCP / agent tool configuration. |
| `soterai.broker.port` | `47321` | Legacy standalone port; the owned extension broker chooses a free port per session. |

Settings that can disable a protection or change where your data goes are
**machine-scoped**: they are read from your user/machine settings only, and a
value set in a repository's `.vscode/settings.json` is ignored. Scan budgets
(`maxFileSizeKb`, `maxWorkspaceFiles`, `excludeGlobs`) and palette visibility
stay workspace-configurable, because none of them can weaken a guard.

## Supported Files


SoterAI focuses on developer text formats: JavaScript, TypeScript, Python,
Markdown, MDX, text, JSON, YAML, `.env`-style files, MCP configuration, and
agent prompt/config files. Binary files and oversized files are skipped.

## API Key Setup

Cloud and broker provider tokens are stored with VS Code `SecretStorage`. Use
`SoterAI: Connect to SoterAI Cloud` or the broker configuration commands only
in trusted workspaces. Local detector scans do not require an API key or cloud
scan connection. Configured provider requests and separately approved OSV
advisory lookups can use the network.

## Troubleshooting

- If commands do not appear, run `SoterAI: Quick Start` from the Command Palette.
- If a file is skipped, check `soterai.scan.maxFileSizeKb` and exclude globs.
- If cloud setup is disabled, verify VS Code Workspace Trust is enabled.
- If the VSIX was installed manually, reload VS Code after installation.

## Known Limitations

- Detection is defense-in-depth, not a guarantee that every issue will be found. Detectors are **regex/heuristic** in the packaged extension — no ONNX/ML model ships in the VSIX.
- **Live scan** is `VISIBILITY_ONLY`: squiggly diagnostics after content exists; it does not block send-to-AI or other extensions.
- **Terminal review** is `DETECTION_ONLY` unless you use the broker **controlled terminal** allowlist route (`STRONG_ENFORCEMENT` for fixed-argv read-only commands only).
- **MCP and extension risk analysis** is config/metadata heuristic (`DETECTION_ONLY`). The MCP gateway engine exists in guard-core but is **not wired** into the packaged extension (`UNKNOWN_NOT_TESTED` until routed).
- **DepGuard** is `DETECTION_ONLY`: local heuristics always; optional online OSV advisory lookup (`soterai.dependencyGuard.osvMode`) with explicit consent. Not a full SCA product; cannot block installs outside SoterAI-reviewed commands.
- **Broker streaming** is `STRONG_ENFORCEMENT` only for traffic routed through the loopback broker. Partial tokens already flushed before a late block cannot be recalled (honest residual risk).

- Full cloud telemetry submission is disabled until a reviewed endpoint client is added.
- SoterAI Guard is not a replacement for professional security review, secure SDLC, or incident response.
- Universal claims (full terminal/MCP/network enforcement for arbitrary agents) are **UNSUPPORTED** without an OS-level broker/sandbox.
- OS controls must also be deployed and verified for the exact identity, routes and lifecycle. The selected architecture is not deployed; the full G1–G6 claim remains **BLOCKED**, not certified by setup, encryption, a modal or a synthetic check.
- `soterai.hardening.coverageDisclosure=false` withdraws automatic, direct managed-control and routing setup before new changes; it does not hide limitations or restore an unsafe fallback. Cancelling the initial disclosure makes no setup changes. Later routing cancellation retains already configured controls, which are still scoped and unverified.


## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node --test static manifest/contract tests
npm run bundle      # extension + standalone local broker bundles
npm run package     # bundle + vsce package -> .vsix
```

The extension is bundled with esbuild into a single `dist/extension.js`
(with `@soterai/guard-core` inlined) so the packaged VSIX stays small and never
follows the symlinked monorepo.

## License

See [LICENSE](./LICENSE) (Business Source License 1.1). Copyright SoterAI.


### Owned local broker sessions

The extension broker binds a free loopback port atomically for each window. It accepts ownership only from its bundled child over private IPC, with distinct data and controller credentials and a checked session identity. It does not attach to a saved URL, PID or another window. Startup synchronizes canaries and restores validated Safe Mode before making the session available; a fresh installation defaults to strict Safe Mode. Restricted workspaces and the machine setting `soterai.lite.gatewayLifecycle=false` withhold this broker. Local scanning remains available.

Use the current broker URL from this window. The legacy `soterai.broker.port` setting applies to standalone operation; it does not select the owned extension port. Restart and token rotation create a new port/session/credentials, so previously configured clients must be reviewed and set up again. No client config is silently repaired or pointed at a different listener. Provider, safety configuration and canary changes withdraw the active broker; restart after reviewing status.

Shutdown sends a cooperative private message, keeps saved policy intact and never signals a PID. An unclosed child remains owned and blocks a replacement; status reports STOP_UNCONFIRMED after the parent wait limit. Active work may finish naturally. The broker checks only traffic explicitly routed through it; it does not confine same-user processes, mediate unmanaged traffic or establish universal secret protection.


### Bounded JSON gateway requests

Owned broker requests use complete strict UTF-8 JSON objects before provider admission. The current limits are1MiB body,32 nested levels,8192 keys/value nodes,64KiB decoded UTF-8 per key/string,4096 received chunks and a finite body-read deadline. Ordinary nested arrays, Unicode and escaped strings within these bounds work. Duplicate decoded keys, unsafe integer/nonfinite numbers, lone surrogates, leading BOM, malformed/truncated UTF-8/JSON and ambiguous or unsupported media types refuse. JSON strings preserve their content, including a BOM within a value. The declared media type is one `application/json`, optionally charset UTF-8. Empty control POST bodies retain an empty-object meaning; no nonempty body bypasses media checks.

The machine setting `soterai.lite.gatewayJsonBodies=false` withdraws this format without legacy pass-through. Owned startup uses JSON to synchronize policy/canaries, so startup also withholds while the format is disabled. A stopping owner rechecks after body decoding and before provider admission; existing provider work can finish naturally. Compression, additional framing/attachments, complete shared-registry/tool policy and actual external AI routes still need their later verification cards. This syntax boundary does not make unmanaged traffic or same-user processes isolated.


### Gzip JSON request bodies

The owned broker accepts one complete gzip member with UTF-8 application/json, then applies the same bounded JSON and existing broker inspection before contacting a provider. Encoded and decoded bodies are capped at 1 MiB, expansion at 64 times the encoded size, optional gzip headers at 4096 bytes and decoding at 1000 ms. CRC32, decoded length and exact compressed consumption are checked. Corrupt/truncated/trailing or multiple members, nested/duplicate/unsupported encoding, binary or invalid JSON and resource overflow refuse. Optional bounded name/comment/extra/header-CRC fields are opaque metadata; they are never paths or audit text. Highly compressible legitimate data beyond the expansion budget also refuses.

The machine setting `soterai.lite.gatewayGzipBodies=false` withdraws the current owner; after a reviewed restart gzip refuses and ordinary JSON/control requests remain available. It does not pass compressed bytes through unchecked. Bounded asynchronous decoding may finish naturally after its deadline, without publishing output. Additional formats and complete shared-registry/per-tool policy retain their later verification gates; this does not mediate unmanaged clients or isolate same-user processes.


### Brotli JSON request bodies

The owned broker accepts one complete standard-window `br` Content-Encoding for UTF-8 application/json before the same bounded JSON and existing request inspection. Limits are 1 MiB encoded/decoded, 64 times expansion and a 1000 ms decoding deadline, plus the body-read deadline. Experimental large-window decoding is disabled. Invalid or truncated streams, trailing bytes or another stream, nested/duplicate/unsupported encodings, output overflow and invalid JSON/UTF-8 refuse before forwarding. Brotli does not provide a gzip-style checksum guarantee; decoded content still passes normal syntax and inspection.

`soterai.lite.gatewayBrotliBodies=false` withdraws the current owner. After reviewed restart, br refuses while plain JSON and gzip remain available; no identity fallback is used. Bounded asynchronous work can finish naturally after refusal without publishing output. This is a request-format boundary, not a global resource/real-time guarantee or unmanaged traffic/OS isolation. Remaining formats and shared-registry/per-tool policy retain their later gates.


### Deflate JSON request bodies

The owned broker accepts one complete zlib-wrapped `deflate` Content-Encoding, then the same bounded UTF-8 JSON and existing inspection. Limits are 1 MiB encoded/decoded, 64 times expansion and a 1000 ms decoding deadline plus the body-read deadline. Standard zlib header/checksum and exact consumed bytes are checked. Raw deflate, preset dictionaries, wrong wrappers, malformed/truncated/trailing/concatenated streams, nested/duplicate/unsupported encodings and invalid JSON/UTF-8 refuse. Empty decoded compressed data is invalid JSON for every encoding; compatible empty identity control POSTs remain supported.

`soterai.lite.gatewayDeflateBodies=false` withdraws the current owner. After reviewed restart deflate refuses while JSON, gzip and br remain available, with no identity fallback. Bounded asynchronous work may finish naturally after refusal without publishing data. This does not provide global resource/real-time guarantees or mediate unmanaged traffic. Other body formats and complete shared-registry/per-tool policy retain later gates.


### Chunked HTTP request framing

The installed Node HTTP/1.1 parser handles raw chunk framing. The owned broker accepts one `chunked` Transfer-Encoding only, then waits for complete framing before the same bounded content decoding/JSON/inspection. Content-Length plus transfer coding, duplicate/unsupported/mixed transfer coding, Trailer declarations and received trailers refuse. Valid chunk extensions are discarded opaque framing metadata and are not forwarded. Existing 1 MiB body, 4096 received data-chunk and finite body-read limits apply; no provider bytes are sent before completion and inspection. Parser-level malformed framing refusals are distinguished in evidence from broker admission checks.

`soterai.lite.gatewayChunkedBodies=false` withdraws the owner; after reviewed restart chunked admission refuses while length-framed JSON and supported encodings remain available. No unchecked framing fallback is used. This does not replace Node framing, cover HTTP2/WebSockets/independent clients, or provide global resource/real-time or OS isolation guarantees. Complete shared-registry/per-tool policy keeps its later gate.

Finite NDJSON/SSE chat batches: `application/x-ndjson`/`application/ndjson` and `text/event-stream` are accepted only on the two broker provider chat routes. Each record contains nonempty `messages`; ordered messages merge into one canonical JSON request. Repeated options must agree (object key order is irrelevant). SSE supports complete data events, comments, message/soterai.request events, bounded id/retry metadata and optional final [DONE]; metadata is discarded. This is finite batch transcoding: provider forwarding waits for the complete body. Limits: 1MiB input, 1024 physical lines, 128 records, 64KiB per record/event, 256 messages, plus aggregate JSON bounds. NDJSON needs a final LF; SSE needs a final blank event boundary. Unknown fields/types, malformed/truncated/conflicting records and overflow refuse. `soterai.lite.gatewayFramedBodies=false` withdraws the owner and refuses these media after reviewed restart; ordinary JSON remains available. The JSON decoder flag remains a dependency.

Multipart chat forms: on the two provider chat routes, `multipart/form-data` accepts one `application/json` part named `request` with chat messages and up to 16 `text/plain` UTF8 parts named `attachment`. Text attachments append user messages; bounded basename filenames are discarded and never used as paths. Complete forms transcode to one inspected JSON request. Limits: 1MiB input, 17 parts, 4096 header bytes/8 lines, 64KiB per part, 256 messages and aggregate JSON bounds. Strict CRLF delimiters and a final closing boundary are required; preamble/epilogue, duplicate/unknown headers, nested multipart/encoding, binary types, invalid UTF8/ASCII control text and over-budget data refuse. No arbitrary vendor file/image upload support is claimed. `soterai.lite.gatewayMultipartBodies=false` withdraws ownership and refuses this media after reviewed restart; ordinary JSON and prior formats remain available.

Explicit base64 chat blobs: `application/vnd.soterai.chat-base64+json` accepts exactly `{encoding:"base64"|"base64url",mediaType:"application/json",data:string}` for a complete JSON chat. Normal chat content strings or text-part text starting with a supported text/plain or application/json UTF8 base64 data URI decode to plain/canonical JSON text. A content part exactly `{type:"soterai_base64",encoding:"base64"|"base64url",media_type:"text/plain"|"application/json",data:string}` becomes `{type:"text",text:decoded}`. Canonical standard base64 padding and unpadded base64url are required. Limits: 32768 decoded bytes/blob, 16 blobs, 131072 cumulative decoded bytes, plus existing request/JSON bounds. Binary data URIs, invalid UTF8/ASCII control text, noncanonical/ambiguous encodings and explicit nested blobs refuse. One supported outer transport compression layer remains available. Unmarked base64-looking strings remain ordinary text; arbitrary hidden encodings and unknown fields require the later shared-registry/tool-policy gate. `soterai.lite.gatewayBase64Bodies=false` withdraws ownership and refuses declared representations after reviewed restart while plain JSON/prior formats remain available.


### Gateway policy for managed chat routes

The default machine/restricted setting `soterai.lite.gatewayPolicy` inspects complete OpenAI-compatible and Anthropic-compatible chat requests using one private snapshot of current workspace/legacy vault registrations, canaries and configured credentials. F15 formats decode first; F16 then applies stricter 128KiB/32-string-leaf request/output limits. Registered raw and supported one-layer encoded values, split message/event values, provider patterns and fixed credential-assignment entropy matches withhold the complete payload. Existing approval/PII redaction and output warnings remain additional checks; approval never bypasses registered-value refusal. Supported text, bounded tool-call data and options retain their structure. Unknown fields/profiles/versions and binary/remote content refuse. Optional `x-soterai-tool` names a protocol profile, not vendor identity.

Only configured validated provider URLs and configured provider authentication are used. Client provider-key overrides, URL queries and unknown Anthropic versions refuse; arbitrary client headers are discarded. Owned startup validates the exact saved/runtime mode and private policy generation. Registry/key/cipher/root/policy/config changes, parent freshness failure or timeout withhold and withdraw authority. Canary resynchronization requires a new complete gateway-policy synchronization. Disabling this setting withdraws ownership; protected chat routes refuse after restart while management stays available. F07 matching, F08 output redaction and vault mode are required dependencies.

Responses including finite SSE remain buffered until complete inspection, with 128KiB/4096-chunk/256-event/2048-line output limits and a finite request deadline. Public LF/CRLF protocol framing remains unchanged. Cancellation, invalid UTF8/control data, incomplete streams, provider errors and stale generations release no partial provider output. Gateway audit contains fixed decision metadata. The advanced command **Run Gateway Loopback Self-Test** exercises the current private boundary with synthetic data and an isolated local collector; it reports six checks and LOW scope. It does not verify real vendor tools, independent clients, WebSockets, cross-request fragments, arbitrary encryption, same-user isolation or OS enforcement. Later tool/human/independent gates remain required.

The advanced **Review Pinned Claude Code Setup** command prepares the exact reviewed Windows Claude Code **2.1.301** text route for one local project per profile. Stop active Claude sessions, review the masked diff and encrypted backups, then restart Claude manually and verify its route. User settings and private user state must each fit 48 KiB; existing project overrides, custom hooks, helper routes and an owned safe-reader name require review first. Setup keeps vendor permission rules, selects manual permissions with thinking disabled, adds HTTP hooks whose failures block, and connects the approved safe reader. Public native file operations still follow vendor permissions; protected files use SoterAI native consent. Unsupported commands, broad searches and images are withheld. **Restore Previous Claude Code Config** restores unchanged owned settings and preserves unrelated vendor startup metadata. Disabling the machine setting soterai.lite.claudeAdapter withdraws the session and retains restrictions and encrypted recovery. Current-instance status remains **Uncovered**; native context may enter the vendor, and independent traffic is unverified. This cooperative adapter provides no OS confinement.

Use **Review Selected Source Secrets** or **Review Workspace Source Secrets** in the advanced command palette for a consent-driven review of saved JS/JSX/TS/TSX/MJS/CJS static strings and canonical comment candidates. Parsing never executes source or loads project configuration. Other languages, dynamic credentials, tagged secret templates and unsupported syntax are unverified; an unsupported or malformed file withholds the report. Public strings, explicit templates and identified Stripe publishable keys are near-match controls. This is heuristic detection, without live credential or AI-access verification.

**Review Source Vault Migration** replaces the whole reviewed file's candidate values with quoted placeholders through the canonical encrypted vault. Configure application environment or owner secret storage manually before approving; application code/imports and value-bearing env files are not generated. **Restore Reviewed Source Values (Disclosure)** explicitly restores exact original escapes and keeps saved denies. Findings use fixed types, locations and keyed references in the shared possible-exposure ledger. The machine setting `soterai.lite.configScanner.source` withdraws pending source work; hygiene/vault controls must also be enabled. The same 128-file/64KiB-per-file/1MiB/128-finding limits and trusted single local Windows workspace requirements apply. There is no startup source scan.

Use **Review Selected Docker/Kubernetes Secrets** or **Review Workspace Docker/Kubernetes Secrets** in the advanced command palette for a consent-driven local review. The declared grammar covers static Dockerfile ENV/ARG values, Compose nested environment/build-arg values, Kubernetes env name/value pairs and Secret stringData/canonical base64 UTF-8 data, with bounded comments and multiline handling. Public ports, explicit templates and identified publishable keys remain useful controls. Aliases, tags, merges, duplicate keys, malformed/foreign YAML, binary Secret data and unsupported credential expressions withhold the report. Other Docker instructions are opaque; parsing does not run a build, command, deployment or external reference. Findings are heuristic metadata, not a clean-configuration or live-credential certificate.

**Review Docker/Kubernetes Vault Migration** uses the canonical encrypted vault and saved sensitive deny for the whole reviewed file. Configure application secret loading manually before approving. YAML scalar replacements preserve valid YAML, and Secret data markers remain valid base64. **Restore Reviewed Docker/Kubernetes Values (Disclosure)** uses the encrypted whole-file checkpoint for YAML to restore exact original quoting, escapes and formatting; Docker static assignments use their exact per-entry representation. Generic substring restoration refuses checkpoint-only records. After a restart, there is no stale finding authority: select the file explicitly with **Restore File From Encrypted Backup** and review its disclosure confirmation. The machine setting `soterai.lite.configScanner.dockerKubernetes` withdraws pending container work and retains recovery, protection and metadata; the hygiene/vault controls are also required. Reviews retain the 128-file/64KiB-per-file/1MiB/128-finding limits and trusted single local Windows workspace scope. No value-bearing env file or deployment is generated.

### Review static Terraform and tfvars secrets

Use **Review Selected Terraform/tfvars Secrets** or **Review Workspace Terraform/tfvars Secrets** in the advanced command palette for a local consent-driven review of saved `.tf`, `.tfvars`, `.tf.json` and `.tfvars.json` files. The finite grammar covers static quoted strings, heredocs, comments, credential fields, variable defaults and nested literals. Public infrastructure fields and simple secret-store references remain useful. Dynamic templates, function calls, operators/comprehensions, duplicate keys, malformed input and unsupported grammar withhold analysis. This is a heuristic static review; it does not execute Terraform, validate a provider schema, run a plan or verify live credentials or AI access.

**Review Terraform/tfvars Vault Migration** replaces values only after separate owner review, using the canonical encrypted vault and permanent sensitive deny. Configure application secret loading manually before migration. **Restore Reviewed Terraform/tfvars Values (Disclosure)** restores the entire encrypted original checkpoint, including original quoting, escapes and multiline formatting; generic per-entry restoration refuses these records. After restart, select the file with **Restore File From Encrypted Backup** and review its disclosure confirmation. No value-bearing env file is generated.

The machine setting `soterai.lite.configScanner.terraform` withdraws pending Terraform operations while preserving stronger protection, recovery and metadata. Hygiene/vault controls are also required. Scope remains a trusted single local Windows workspace,128files/64KiB each/1MiB analyzed text/128findings/60seconds. Other expressions, configuration semantics, unmanaged reads and external copies remain unverified.
