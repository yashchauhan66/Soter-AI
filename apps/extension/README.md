# Soter Enterprise AI Control Plane — Browser Extension

Chrome/Edge browser extension that stops secrets, PII, source code, and sensitive business data from leaking into AI tools.

## Features

- **Prompt Interception** — Scans prompts before they reach AI tools (ChatGPT, Claude, Gemini, Perplexity, and 15+ more)
- **File Upload Scanning** — Blocks risky file uploads (.env, secrets, credentials)
- **Response Scanning** — Detects sensitive data in AI responses
- **Source Lineage Tracking** — Tracks where data originates before being pasted into AI tools
- **Shadow AI Discovery** — Detects unknown AI tools being used in the organization
- **Emergency Lockdown** — Instantly block all AI tool access across the organization
- **Policy Enforcement** — Organization-wide policies with HMAC-SHA256 signature verification
- **Privacy-First Design** — Raw text never leaves your browser; only SHA-256 hashes and metadata are sent

## Installation

### From Source (Development)

```bash
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### From Chrome Web Store

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/soter-enterprise-ai-contr/placeholder)
2. Click "Add to Chrome"
3. Pin the extension to your toolbar

## Configuration

### Enterprise Enrollment

1. Click the SoterAI icon in your toolbar
2. Enter your enrollment code and API base URL
3. Click "Connect"

### Managed Deployment

IT admins can deploy via Chrome Enterprise policy:
- Set `SoterAPIKey` and `SoterBaseUrl` in managed storage
- Extension auto-enrolls on first launch

## Supported AI Tools

ChatGPT, Claude, Gemini, Perplexity, Poe, OpenRouter, Replit, StackBlitz, CodeSandbox, GitHub Codespaces, Bolt, v0, Lovable, OpenWebUI, and any generic text editor.

## Permissions

| Permission | Purpose |
|---|---|
| `contextMenus` | Right-click "Scan with Soter" menu on supported AI pages |
| `sidePanel` | Side panel showing the latest scan result |
| `storage` | Store org policy cache and enrollment state locally |
| `alarms` | Schedule policy sync and heartbeat |

Content scripts are declared statically in `manifest.json` scoped to the supported AI
hosts, so no `scripting`, `activeTab`, or `tabs` permission is required. There are **no
optional permissions** in the store build.

### Host permissions

`host_permissions` are limited to the specific AI destinations the extension scans,
`https://` only. Local development hosts (`localhost` / `127.0.0.1`) live **only** in
`manifest.dev.json` and are never included in the store package — `npm run validate:store`
fails the build if a dev host, `http://`, `<all_urls>`, or an unused permission leaks in.

## Privacy

- Raw prompt text is never sent to the backend
- Only SHA-256 hashes and redacted previews are transmitted
- All data stays in your browser unless you enroll in an organization
- No telemetry without explicit consent

## Development

```bash
npm run dev          # Watch mode with hot reload
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run package      # Build + create ZIP for store submission
```

## License

MIT
