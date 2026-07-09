# SoterAI IDE Guard for Visual Studio (PLANNED / UNBUILT)

A thin Visual Studio (Windows) adapter for the SoterAI Local AI Broker. Like the
other adapters, it contains **no** detection, redaction, or policy logic — it
sends editor text to the loopback broker and renders the broker's redacted
results.

> **Status: PLANNED / UNBUILT.** This directory is a coherent C#/.NET VSIX
> **scaffold**, not a shipped extension. It has **not** been compiled or
> installed, because this environment has no Visual Studio SDK / MSBuild. Do not
> treat Visual Studio as a supported platform. See
> [`docs/visual-studio-test-report.md`](docs/visual-studio-test-report.md) for
> the exact steps and acceptance gate required to reach PASS.

## What is here

| Path | Purpose | State |
|---|---|---|
| `source.extension.vsixmanifest` | VSIX metadata (provisional VS 2022 targets) | scaffold |
| `SoterAIGuard.csproj` | VSIX project referencing `Microsoft.VisualStudio.SDK` + `Microsoft.VSSDK.BuildTools` | scaffold, not restored/built |
| `src/SoterAIGuardPackage.cs` | `AsyncPackage` entry point | scaffold |
| `src/Commands/GuardCommands.cs` | ScanSelection, ScanDocument, RedactSelection, BrokerStatus handlers | scaffold |
| `src/Broker/BrokerClient.cs` | `HttpClient` client for the loopback broker + token resolution | scaffold |
| `src/ToolWindows/SoterAIToolWindow.cs` | Tool window skeleton for status + redacted ledger | scaffold |
| `src/SoterAIGuardPackage.vsct` | Command table (menu placement, GUIDs/IDs) | scaffold |

## Commands (planned)

- **SoterAI: Scan Selection** — `POST /v1/scan` on the current selection.
- **SoterAI: Scan Document** — `POST /v1/scan` on the active document.
- **SoterAI: Redact Selection for AI** — `POST /v1/redact`, replace the selection
  in place with the broker's redacted text.
- **SoterAI: Broker Status** — `GET /health` + `GET /v1/safe-mode/status`.

## Broker contract used

Base `http://127.0.0.1:47321` (loopback). `Authorization: Bearer <token>` on
every request except `GET /health`. The token is read from
`~/.soterai/broker/auth-token` and only ever attached as a request header — never
logged. Visual Studio has no single extension-scoped secret store, so by design
the broker/OS owns the token; plaintext editor settings are not an accepted
fallback (see the plan).

## Before it can build

On a machine with **VS 2022** and the **Visual Studio extension development**
workload:

1. Add `LICENSE.txt` (copy the repository `LICENSE`) and `media/icon.png`, both
   referenced by the manifest/csproj.
2. `msbuild SoterAIGuard.csproj /t:Restore` then
   `msbuild SoterAIGuard.csproj /p:Configuration=Release`.
3. Pin exact NuGet versions from the successful restore.
4. F5 launches the **experimental instance** (`/rootsuffix Exp`) for testing.

## Honest limitations

- **Windows-only**, VS 2022 (17.x) target is provisional until a prototype
  confirms the SDK surface. A "Visual Studio 2026" claim is unverified.
- **No universal interception** of AI extensions, prompts, or terminal input.
- **Local-first**: content goes only to the loopback broker; nothing is uploaded
  to SoterAI Cloud by default. No "100% secure" claim is made.
