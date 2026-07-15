# Chrome Web Store — Store Listing

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
- All scanning runs locally in your browser. Raw prompt, response, and file text never leave your device.
- When a risk is found, a clear overlay lets you use a safe, redacted version of your prompt, copy it, or request approval.
- Privacy mode and per-destination controls are governed by your organization's policy.
- For organizations, only redacted previews and metadata are synced over HTTPS to your own Soter admin dashboard — never raw content.

**Supported AI tools**
ChatGPT, Claude, Gemini, Perplexity, Poe, OpenRouter, Replit, StackBlitz,
CodeSandbox, GitHub Codespaces, Bolt, v0, Lovable, and Open WebUI.

**Privacy first**
No data is sold. No advertising use. No browsing-history tracking. No remote code
execution. The extension only runs on the supported AI sites listed above.

**Support:** support@soterai.in

## URLs (paste into the Chrome Web Store Developer Dashboard)

| Field | Value |
|---|---|
| Website / Homepage URL | https://soterai.in |
| Support URL | https://soterai.in/support |
| Privacy policy URL | https://soterai.in/privacy |

## Search keywords

`AI security`, `prompt injection`, `DLP`, `data loss prevention`, `PII`, `secrets`,
`jailbreak`, `ChatGPT security`, `AI guardrails`, `enterprise AI`

## Screenshots (1280×800, in `docs/extension-store/edge-assets/` — reused for Chrome)

1. `edge-01-popup-onboarding.png` — popup, first-run onboarding/enrollment
2. `edge-02-popup-enrolled.png` — popup, enrolled state with org policy
3. `edge-03-sidepanel-scan-result.png` — side panel showing a scan result
4. `edge-04-ai-warning-overlay.png` — warning overlay on a supported AI site
5. `edge-05-admin-policy-studio.png` — admin dashboard context (optional)
6. `edge-11-chatgpt-overlay.png` — overlay live on ChatGPT

## Promotional assets

- Small promo tile 440×280: `edge-assets/small-promotional-tile-440x280.png`
- Marquee/large promo tile 1400×560: `edge-assets/large-promotional-tile-1400x560.png`
- Store icon 128×128: `apps/extension/assets/icon-128.png`

## Reviewer test instructions

See `chrome-reviewer-notes.md` — install steps, safe synthetic test prompt, a fake
secret to trigger detection, and expected behavior. **No real credentials or account
are required to test.**
