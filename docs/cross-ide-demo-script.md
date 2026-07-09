# Cross-IDE demo script

Status date: 2026-07-06. One reproducible walkthrough for recording GIFs and video across every adapter. The flow is identical everywhere so the assets read as one product: **canary scan → redact → safe prompt → ledger**. Only the command surface (menu, palette, or `:command`) changes per IDE.

## Recording rules

- Record against a throwaway workspace. Every "secret" on screen is a **planted canary or an obvious placeholder** — never a real token, path, or customer value.
- The broker must be running and paired before recording. If the broker is stopped, show the honest "broker unavailable" state deliberately, or restart before the take.
- Show redacted evidence only. If a raw secret ever appears on screen, discard the take.
- Keep the honest closing frame: SoterAI mediates context routed through SoterAI; it does not intercept every third-party AI plugin.

## Fixture file (`demo/leaky-config.ts`)

```ts
// Planted canary (decoy) + an obvious placeholder key.
const CANARY = "soterai-canary-DO-NOT-SHARE-9f3b21";   // decoy tripwire
const apiKey = "sk-EXAMPLE-1234567890-REPLACE-ME";      // placeholder, not real
export const cfg = { apiKey, endpoint: "https://api.example.com" };
```

## Pre-roll: start and pair the broker (once, off-camera)

```bash
# Local AI Broker, loopback only
npm --prefix apps/local-ai-broker run build
node apps/local-ai-broker/dist/cli.js start        # binds 127.0.0.1:47321
# the auth token lives at ~/.soterai/broker/auth-token — never shown on camera
```

## The four beats

### 1. Canary scan
Select the fixture contents and run the scan command. The result panel shows detections (canary + placeholder key) with **redacted** evidence and a decision. Narration: "Detection runs in the local broker; raw values never leave the machine."

### 2. Redact
Run the redact command on the same selection. The text is replaced in place with placeholders (e.g. `«REDACTED-SECRET»`). Narration: "Now the buffer holds safe context, not secrets."

### 3. Safe prompt
Run the safe-prompt command. The prompt copied to the clipboard/register contains placeholders only. Paste it into a scratch buffer on camera to prove there are no raw secrets.

### 4. Ledger ("What AI Saw")
Open the ledger view. Show decisions, hashes, and redacted evidence — no raw secrets. Narration: "Auditable, local-first, no raw source/secrets/prompts to the cloud by default."

## Per-IDE command surface

| IDE | Scan | Redact | Safe prompt | Ledger / status |
|---|---|---|---|---|
| VS Code / Cursor / VSCodium | Command Palette → *SoterAI: Scan Selection* or editor context menu | *SoterAI: Redact Selection for AI* | *SoterAI: Safe Prompt* | Activity-bar "What AI Saw" view; status bar broker indicator |
| JetBrains | Editor right-click → *Scan Selection with SoterAI* | *Redact Selection for AI with SoterAI* | Tools → SoterAI safe prompt | SoterAI Guard tool window (right anchor); status-bar widget |
| Visual Studio | Extensions/Tools menu → SoterAI scan | SoterAI redact | SoterAI safe prompt | SoterAI tool window (planned) |
| Sublime | Command Palette → *SoterAI: Scan Selection* | *SoterAI: Redact* | *SoterAI: Safe Prompt* | Output panel / status bar (planned) |
| Neovim | `:SoterScan` (visual selection) | `:SoterRedact` | `:SoterSafePrompt` (writes to `+` register) | `:SoterSafeModeOn` / broker status notification |
| Eclipse | right-click → SoterAI scan | SoterAI redact | SoterAI safe prompt | SoterAI view (planned) |
| JupyterLab | cell toolbar / command → SoterAI scan cell | SoterAI redact cell | SoterAI safe prompt | SoterAI side panel (planned); redact outputs before display |

## Safe Mode B-roll (optional)

Toggle Safe Mode on (`ToggleSafeMode` / `:SoterSafeModeOn`) and show the status indicator flip. Narration: "Safe Mode raises the broker's enforcement level for higher-risk sessions." Do not claim it blocks other extensions — it governs the broker, not the OS.

## Post-production caption bank (honest, reusable)

- "Local-first: detection runs on your machine."
- "Redacted evidence only — no raw secrets, ever."
- "No raw source, secrets, or prompts to the cloud by default."
- "SoterAI mediates context routed through SoterAI. See the limitations page."
