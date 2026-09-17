<!-- GENERATED FILE — do not edit.
     Produced by packages/vscode-extension/scripts/generate-readiness.mjs and
     asserted by src/__tests__/readiness-doc.test.ts. Every number below was
     read from the manifest or from guard-core source at generation time.
     Run `node scripts/generate-readiness.mjs` after changing either. -->

# SoterAI IDE Guard — readiness

**Package:** `soterai-ide-guard` v0.6.3 · publisher `soterai`
**License:** `SEE LICENSE IN LICENSE.md`
**Editor floor:** `^1.85.0` — kept deliberately low so Cursor, Windsurf, Kiro and Antigravity stay supported.
**Entry point:** `./dist/extension.js` (single esbuild bundle; no `node_modules` in the VSIX)

## Command surface

| Measure | Count |
| --- | --- |
| Commands declared and registered | 163 |
| Visible in the palette by default | 11 |
| Behind `soterai.showAllCommands` | 125 |
| Hidden from the palette (aliases, reports, internal) | 27 |

Hidden commands remain **registered**: a keybinding, task or another
extension's `executeCommand` that references one keeps working. They are
hidden because a second palette row for the same workflow makes the user
guess which one acts.

## Where the product meets the user

| Surface | Detail |
| --- | --- |
| Non-palette menu groups | editor/context, soterai.editorContext, explorer/context, soterai.explorerContext, scm/title, view/title |
| Keybindings | 2 |
| View welcome messages | 4 |
| Walkthrough steps | 3 |
| Activation | workspaceContains:.soterai-policy.json, onWalkthrough:soterai.gettingStarted, onStartupFinished |

## Agent-facing surfaces

- Language model tools: `soterai_scan_text`, `soterai_check_command`, `soterai_check_dependency`
- MCP server definition providers: `soterai.guard-tools`

Both are feature-detected. On an editor without `vscode.lm` they register
nothing rather than throwing. **They are advisory:** they answer questions an
agent chooses to ask, and no extension API can force the call or intercept
what an agent does on its own.

## Settings and central management

| Measure | Count |
| --- | --- |
| Settings declared | 31 |
| `machine`-scoped (a repo cannot set them) | 26 |
| Restricted in untrusted workspaces | 26 |
| Pinnable by an administrator (`policy`) | 8 |

## Detection engine

| Detector | Rules |
| --- | --- |
| `AIGeneratedCodeRiskDetector` | 18 |
| `EnvFileDetector` | 4 |
| `FileContextRiskDetector` | 12 |
| `IndiaPIIDetector` | 7 |
| `JailbreakLiteDetector` | 19 |
| `MCPConfigRiskDetector` | 6 |
| `OutputExfiltrationDetector` | 6 |
| `PIIDetector` | 7 |
| `PromptInjectionLiteDetector` | 36 |
| `RepoInstructionPoisoningDetector` | 8 |
| `SecretDetector` | 42 |
| `TerminalCommandRiskDetector` | 21 |
| **Total** | **186** |

All 12 detectors are deterministic regex/heuristic rules, bundled inline.
**No ML model ships in the VSIX.** `onnxruntime` appears zero times in
`dist/extension.js`; the ONNX classifier is server-side only. Any extension-
facing claim of ML capability is a defect.

## What this product does not do

- It cannot intercept another extension's network calls. VS Code exposes no
  such API, so GitHub Copilot is classified `unmanaged` and stays that way.
- Terminal commands are detected **after** the shell starts them. That path is
  `MONITORED`; only the broker's controlled terminal blocks before execution.
- Anything not routed through the local broker is advisory, and every surface
  says so rather than showing `ENFORCED`.

