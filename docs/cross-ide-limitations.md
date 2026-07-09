# Cross-IDE limitations (read this)

Status date: 2026-07-06. SoterAI IDE Guard is honest about what each adapter can and cannot do. This page states per-platform limits so no listing over-claims. It complements the VS Code-specific [ide-guard-limitations.md](ide-guard-limitations.md) with the constraints that differ by host.

## Limits that apply to every adapter

- **The broker must be running.** Adapters are thin clients. Without an authenticated Local AI Broker on loopback, scan/redact/safe-prompt/ledger commands cannot run. A stopped or unreachable broker means no protection, and the adapter says so rather than failing silently.
- **SoterAI mediates only what is routed through SoterAI.** It protects context you explicitly scan/redact/safe-prompt and broker traffic configured to use the local endpoint. It cannot transparently intercept a third-party AI plugin's own prompt-building pipeline or network calls.
- **It cannot stop another extension from reading open files.** In a trusted workspace, any extension can read files you have open. The strongest practical protection is moving real secrets into the Protected Vault so workspace files hold only placeholders — not an OS-level block.
- **No "100% secure" guarantee.** Extension "AI/malware" risk scoring is heuristic from local metadata, not definitive detection. Full process/tool/filesystem mediation needs OS-level controls (sandboxing, per-process ACLs, EDR), which an editor plugin cannot provide.
- **Canary detection is best-effort.** Canaries reveal that a leak path exists; they do not prevent the leak and do not cover paths that never route through SoterAI.

## VS Code / Cursor / VSCodium / Windsurf

- Cannot hook Cursor's or Windsurf's proprietary AI prompt pipeline; those are private surfaces with no supported extension API.
- A successful VSIX install proves package acceptance, not command activation or feature behavior — each fork is a separate test target.
- Restricted/untrusted workspaces and some remote-extension topologies reduce available APIs; behavior is honestly "partial," not simulated success.

## JetBrains (IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, CLion, DataGrip, Rider)

- **Status: adapter source exists (`extensions/jetbrains`), signed/verified build not yet shipped.** Do not advertise until `buildPlugin` + Plugin Verifier + a real-host install pass.
- One passing IntelliJ test does not establish support for Rider, DataGrip, or the others — each product is a distinct verification target within the declared `sinceBuild 251 / untilBuild 261.*` range.
- Cannot mediate the network calls of JetBrains AI Assistant or other third-party AI plugins; it governs SoterAI-routed context and the local broker.

## Visual Studio

- **Status: adapter not built.** Path documented, no artifact yet.
- Visual Studio exposes fewer terminal and AI interception points than VS Code; enforcement is limited to explicit scan/redact/safe-prompt commands.

## Sublime Text

- **Status: adapter not built.**
- Sublime has no extension network-interception API. The adapter can only act on explicit commands routed to the local broker; it cannot observe what other plugins send anywhere.

## Neovim / Vim

- **Status: Neovim thin-client config present (`extensions/neovim`); command/broker-client modules and full install matrix pending. Vim adapter absent.**
- Interpreted-editor calls to the broker are synchronous (curl); a large scan briefly **blocks the editor UI**. This is a design constraint of the runtime, stated in the README.
- Vim support depends on build features (`+job`/`+channel`) and is not shipped; do not claim Vim support from Neovim testing.
- No native memory-inspector or vault UX parity is promised for terminal editors — commands and redacted output only.

## Eclipse

- **Status: adapter not built.**
- SWT/terminal surfaces limit interception to explicit scan/redact commands. Requires a signed p2 update site before any listing.

## JupyterLab

- **Status: adapter not built.**
- Notebook **outputs** can contain sensitive data; the adapter must redact before display, and cannot retroactively scrub outputs already rendered by other extensions.
- **Remote-Jupyter topology is a hard constraint:** when the kernel/server is remote, the broker's location must be explicitly resolved and documented. SoterAI does not claim protection for a remote kernel whose local broker is unreachable.
- Scope is explicit cell/selection scan; no terminal interception or native vault UX parity is promised at Tier 3.

## Compiled / unbuilt adapters

Visual Studio, Sublime, Eclipse, JupyterLab, and Vim adapters are **not yet built**. JetBrains has source but no shipped signed build. Until an adapter's real package builds, installs in a clean host, connects to the authenticated broker, completes a scan, and passes canary/no-leak tests (the [universal release gate](cross-ide-support-tiering.md)), its channel is PLANNED and must not be advertised as supported.
