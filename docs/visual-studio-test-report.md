# SoterAI IDE Guard for Visual Studio — test report

Status date: 2026-07-06.
Host used for authoring: Windows 11 x64, **no Visual Studio SDK / MSBuild / VS
2022 present**.

## Verdict

**UNBUILT / NOT TESTED.** The `extensions/visual-studio/` directory is a
scaffold. No compilation, packaging, installation, or broker interaction has
been performed. Visual Studio is **not** a supported SoterAI platform. Nothing
in this report may be promoted to a support claim.

There are no PASS rows to report, because nothing runnable was produced in this
environment. The rows below are all pending.

## Status of each check

| Check | Status | Notes |
|---|---|---|
| C# compiles | NOT RUN | No MSBuild/Roslyn with the VS SDK here. Code is written to be idiomatic and compilable-looking only. |
| NuGet restore (`Microsoft.VisualStudio.SDK`, `Microsoft.VSSDK.BuildTools`) | NOT RUN | Requires a VS 2022 dev machine; package versions in the csproj are provisional. |
| VSIX packaging (`bin\Release\SoterAIGuard.vsix`) | NOT RUN | Produced only by VSSDK build tools on a real build. |
| Manifest validity | NOT VERIFIED | `source.extension.vsixmanifest` written to schema from docs; not validated by the packager. |
| Experimental-instance install | NOT RUN | Needs `devenv /rootsuffix Exp`. |
| Command activation (4 commands appear on Tools menu) | NOT RUN | Requires the installed VSIX in the experimental instance. |
| Broker scan round trip | NOT RUN | Requires a running broker + a real command invocation. |
| In-place redaction | NOT RUN | Requires broker `POST /v1/redact` and editor-edit verification. |
| Canary privacy test | NOT RUN | Must confirm only loopback traffic and that the token never appears in logs. |

## Steps and acceptance to reach PASS

Environment: Windows + **VS 2022** with the **"Visual Studio extension
development"** workload; SoterAI Local AI Broker running on
`http://127.0.0.1:47321` with a token in `~/.soterai/broker/auth-token`.

1. **Add missing assets.** Copy the repo `LICENSE` to `LICENSE.txt` and provide
   `media/icon.png` (both referenced by the manifest/csproj).
2. **Restore + build.**
   `msbuild SoterAIGuard.csproj /t:Restore` then
   `msbuild SoterAIGuard.csproj /p:Configuration=Release`.
   **Accept:** build succeeds; `bin\Release\SoterAIGuard.vsix` exists.
   Pin the exact restored NuGet versions.
3. **Install into the experimental instance.** F5, or install the VSIX into a
   clean `/rootsuffix Exp` instance.
   **Accept:** the four **SoterAI: …** commands appear under the Tools menu and
   the tool window opens.
4. **Broker status.** Run **SoterAI: Broker Status**.
   **Accept:** a message box shows broker health + Safe Mode; no token text is
   shown anywhere.
5. **Scan.** Open a file with a fake secret, select it, run **Scan Selection**;
   then run **Scan Document**.
   **Accept:** results show decision/risk/findings and a **redacted** evidence
   preview.
6. **Redact.** Select the fake secret, run **Redact Selection for AI**.
   **Accept:** the selection is replaced in place with the broker's redacted
   text; the original secret is gone from the buffer.
7. **Canary / privacy.** With a capture tool, confirm the only network traffic
   is loopback to the broker; grep the VS ActivityLog and any adapter output to
   confirm the token never appears.
   **Accept:** no non-loopback traffic; no token in logs.
8. **Failure modes.** Stop the broker and use a bad token; confirm each command
   shows a readable `SoterAI: …` message, not an unhandled exception dialog.

Record PASS/FAIL with evidence per step. Only after steps 2–7 pass, plus a
Marketplace validation dry run, may Visual Studio be described as anything
beyond an unbuilt scaffold.

## Feature-parity release row (to fill in on first build)

Copy the Visual Studio column from `docs/cross-ide-feature-parity-matrix.md`
here and replace each symbol with evidence-linked PASS/PARTIAL/FAIL/NOT TESTED.
Currently every cell is **NOT TESTED**.
