# Edge Add-ons — Store Listing

**Extension name:** Soter Enterprise AI Control Plane
**Version:** 0.1.2
**Category:** Productivity  *(alt: Developer Tools)*

## Short description (≤132 chars)

> Scans prompts and AI responses for prompt injection, jailbreaks, secrets, PII, and unsafe instructions on supported AI tools.

## Single purpose (paste verbatim into the "Single purpose" field)

> SoterAI Guard helps users detect AI security risks in supported AI tools by scanning prompts and AI responses for prompt injection, jailbreaks, secrets, PII, and unsafe instructions.

## Full description

Soter Enterprise AI Control Plane protects people and organizations from AI security
risks. It runs a local security scan on the prompts you send — and, when your
organization enables it, the responses you receive — on supported AI tools, warning
you before sensitive data or unsafe instructions get through.

**What it detects**
- Prompt injection and jailbreak attempts
- Secrets and credentials (API keys, tokens, private keys, .env values)
- Personal data (PII) such as emails, phone numbers, and IDs
- Source code and confidential business data
- Unsafe or manipulative instructions in AI responses

**How it works**
- All scanning runs locally in your browser. Raw prompt, response, and file text
  never leave your device.
- When a risk is found, a clear overlay lets you use a safe, redacted version of your
  prompt, copy it, or request approval.
- For organizations, only redacted previews and metadata are synced over HTTPS to
  your own Soter admin dashboard — never raw content.

**Supported AI tools**
ChatGPT, Claude, Gemini, Perplexity, Poe, OpenRouter, Replit, StackBlitz,
CodeSandbox, GitHub Codespaces, Bolt, v0, Lovable, and Open WebUI.

**Privacy first**
No data is sold. No advertising use. No browsing-history tracking. The extension only
runs on the supported AI sites listed above.

## URLs

Use these exact values in Partner Center. Do not use the retired
the retired public VM privacy URL in Website, Support URL, Privacy
policy URL, or any other metadata field.

| Field | Value |
|---|---|
| Website | https://soterai.in |
| Support URL | https://soterai.in/support |
| Privacy policy URL | https://soterai.in/privacy |

## Notes for Certification

No SoterAI test account credentials are required. Soter Enterprise AI Control Plane
is an enterprise AI security/DLP extension, and the submitted store build includes
a built-in local demo policy for reviewer testing. After installing the extension,
open a supported AI site such as `https://chatgpt.com`, paste the synthetic test
prompt from the reviewer notes, and submit it. The extension should display the
local warning/redaction overlay. Enterprise enrollment is only needed for
customer-specific policy sync and admin reporting, not for certification testing.

## Search keywords

`AI security`, `prompt injection`, `DLP`, `data loss prevention`, `PII`, `secrets`,
`jailbreak`, `ChatGPT security`, `AI guardrails`, `enterprise AI`

## Screenshots (assets in `docs/extension-store/edge-assets/`)

1. `edge-01-popup-onboarding.png` — popup, first-run onboarding/enrollment
2. `edge-02-popup-enrolled.png` — popup, enrolled state with org policy
3. `edge-03-sidepanel-scan-result.png` — side panel showing a scan result
4. `edge-04-ai-warning-overlay.png` — warning overlay on a supported AI site
5. `edge-05-admin-policy-studio.png` — admin dashboard context (optional)
6. `edge-11-chatgpt-overlay.png` — overlay live on ChatGPT

## Demo steps (for the listing description / video)

1. Install and open the popup; the extension is idle until you visit a supported AI tool.
2. Open ChatGPT (or the local mock page) and paste a prompt containing a fake secret.
3. Soter's overlay appears warning of the detected secret and offers a redacted prompt.
4. Choose "Use safe prompt" to continue safely.

## Reviewer test instructions

See `edge-reviewer-notes.md` — includes install steps, safe test prompt, a fake
secret to trigger detection, and expected behavior. **No real credentials or account
are required to test.**
