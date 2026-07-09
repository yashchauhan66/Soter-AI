# SoterAI IDE Guard for Visual Studio — extension plan

Status date: 2026-07-06. Priority 7, complexity High in the cross-IDE
feasibility matrix. **This is a plan for an UNBUILT scaffold**, not a support
claim. Source scaffold lives in `extensions/visual-studio/`.

## Goal

A thin Visual Studio (Windows) adapter that reaches the SoterAI Local AI Broker
on loopback and renders redacted results. No detector, redaction rule, or policy
decision is implemented in the adapter.

## SDK-surface decision

Visual Studio has two extensibility surfaces:

1. **Classic in-process VS SDK** (`Microsoft.VisualStudio.SDK` +
   `Microsoft.VSSDK.BuildTools`): mature, full editor/command/tool-window
   access, in-process on the UI thread. This scaffold targets it because it is
   the documented, stable surface with the APIs we need today.
2. **Out-of-process VisualStudio.Extensibility**: newer, safer isolation, but a
   narrower/evolving API surface.

**Decision:** build the first prototype on the classic in-process SDK for VS
2022 (17.x), then re-evaluate porting to the out-of-process model once the
prototype proves the required editor and tool-window operations. Per the
feasibility matrix, the SDK choice must be confirmed "from an executable
prototype" before any support claim.

## Architecture

```
source.extension.vsixmanifest   VSIX metadata + install targets (provisional).
SoterAIGuard.csproj             VSIX project; SDK + BuildTools package refs.
src/SoterAIGuardPackage.cs      AsyncPackage; background load; registers commands + tool window.
src/Commands/GuardCommands.cs   Menu handlers; gather editor text; call broker; show result.
src/Broker/BrokerClient.cs      HttpClient client; token from file; scan/redact/health/safe-mode.
src/ToolWindows/                Tool window skeleton for status + redacted ledger.
src/SoterAIGuardPackage.vsct    Command table (Tools menu group + 4 buttons).
```

- **Threading.** Commands use `JoinableTaskFactory`; editor access switches to
  the main thread, network I/O runs async. This mirrors the JetBrains adapter's
  pooled-thread-then-UI pattern.
- **Token / secrets.** No single extension-scoped SecretStorage exists in VS.
  The broker/OS owns the token; the adapter reads `~/.soterai/broker/auth-token`
  and only attaches it as a request header. Plaintext editor settings are not an
  accepted fallback. A future revision may use Windows Credential Manager/DPAPI
  for a broker credential handle.
- **Rendering.** MVP uses message boxes for scan/status results and a tool
  window for the redacted "What AI Saw" ledger. Raw source/prompts/secrets are
  never displayed or uploaded by default.

## Broker endpoints used

| Command | Method + path |
|---|---|
| Scan Selection / Scan Document | `POST /v1/scan` `{content}` |
| Redact Selection for AI | `POST /v1/redact` `{content}` |
| Broker Status | `GET /health`, `GET /v1/safe-mode/status` |

## Feature-parity target (Visual Studio column)

From `docs/cross-ide-feature-parity-matrix.md`. Most rows are **B**
(broker-backed); several are **P/B** because VS cannot fully mediate workspace,
git, terminal, or context. This scaffold plans the **B** core:

| Feature | Target | Scaffold plan |
|---|---|---|
| Scan Selection | B | Command handler present |
| Scan Current File | B | Command handler present (Scan Document) |
| Redact Selection for AI | B | Command handler present |
| Safe Prompt Builder | B | Planned (reuse redact + copy) |
| Local AI Broker start/status | P/B | Status only; no broker lifecycle mgmt |
| What AI Saw Ledger | B | Tool window skeleton; wire `GET /v1/events/recent` |
| AI Safe Mode | B | Read status; enable/disable planned |
| Scan Workspace Risk / Git Changes | P/B | Deferred; needs solution/VC integration |
| Terminal Command Checker | P/B | Deferred; no reliable universal interception |

## Deliberately out of scope for the first prototype

- Workspace/solution-wide scanning and git-diff scanning (P/B).
- Terminal command interception (partial everywhere; see matrix).
- Editor adornments / squiggles for findings.
- Any cloud upload path.

## Build & debug (on a real VS machine — not run here)

```
msbuild SoterAIGuard.csproj /t:Restore
msbuild SoterAIGuard.csproj /p:Configuration=Release
# F5 in VS launches devenv /rootsuffix Exp (experimental instance)
```

Output: `bin\Release\SoterAIGuard.vsix`.

## References

- [Visual Studio extensibility overview](https://learn.microsoft.com/en-us/visualstudio/extensibility/visualstudio.extensibility/visualstudio-extensibility?view=vs-2022)
- [Create an extension with a menu command](https://learn.microsoft.com/en-us/visualstudio/extensibility/adding-a-menu-command-to-the-editor-context-menu?view=vs-2022)
- [Create a tool window](https://learn.microsoft.com/en-us/visualstudio/extensibility/adding-a-tool-window?view=vs-2022)
- [VSSDK build tools / VSIX packaging](https://learn.microsoft.com/en-us/visualstudio/extensibility/vsix-project-template?view=vs-2022)
- [JoinableTaskFactory threading guidance](https://learn.microsoft.com/en-us/visualstudio/extensibility/managing-multiple-threads-in-managed-code?view=vs-2022)
