# Soter Enterprise AI Control Plane - Browser Extension

Chrome/Edge browser extension that stops secrets, PII, source code, and sensitive business data from leaking into AI tools.

## Features

- **Prompt interception** - scans prompts before they reach supported AI tools such as ChatGPT, Claude, Gemini, Perplexity, Poe, OpenRouter, Replit, StackBlitz, CodeSandbox, GitHub Dev, Bolt, v0, Lovable, and OpenWebUI.
- **File upload scanning** - blocks or warns on risky uploads such as `.env`, private keys, credentials, customer exports, and unsupported binary files.
- **Response scanning** - detects sensitive data in AI responses when an admin enables it for a destination.
- **Source lineage tracking** - stores hashes and redacted context so teams can understand where pasted data originated.
- **Shadow AI discovery** - identifies unsupported AI destination usage without monitoring unrelated browsing.
- **Emergency lockdown** - enforces stricter cached policy locally when an organization enables incident response mode.
- **Policy enforcement** - organization-wide policies with HMAC-SHA256 signature verification.
- **Privacy proof UI** - popup and side panel show exactly what leaves the browser.

## Privacy Model

The extension is designed for local-first protection:

| Data | Default behavior |
| --- | --- |
| Raw prompt text | Not sent to SoterAI by default |
| Raw file content | Scanned locally for supported text files; not sent as backend event content |
| Clean prompt storage | Stored as hash, length, and marker only |
| Risky prompt storage | Redacted preview, safe rewrite, hashes, metadata, and policy decision |
| Backend audit event | Metadata, decision, risk score, detected data types, destination context, and redacted preview |
| Response scans | Controlled per destination; clean response scans stay local unless policy requires an event |
| Full prompt logging | Off by default; requires explicit admin policy mode |

The extension does not request `<all_urls>`, `tabs`, `activeTab`, `scripting`, or `webNavigation` in the store build.

## Installation

### From Source

```bash
npm install
npm run build
```

Then load `apps/extension/dist/extension` as an unpacked extension in Chrome or Edge:

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable developer mode.
3. Click "Load unpacked".
4. Select `apps/extension/dist/extension`.

### From Store

1. Install from the approved Chrome Web Store or Microsoft Edge Add-ons listing.
2. Pin the extension to the toolbar.
3. Enroll with your organization code or managed policy.

## Configuration

### Enterprise Enrollment

1. Click the SoterAI icon in the toolbar.
2. Enter the enrollment code and API base URL.
3. Click "Connect".

### Managed Deployment

IT admins can deploy through Chrome/Edge enterprise policy:

- Configure managed enrollment settings.
- Configure policy signing secret when signature verification is required.
- Configure response scanning per destination.
- Use emergency lockdown for incident response.

## Permissions

| Permission | Purpose |
| --- | --- |
| `contextMenus` | Adds user-visible scan and approval actions on supported AI pages. |
| `sidePanel` | Shows enrollment, latest scan, response scanning, and privacy status. |
| `storage` | Stores enrollment state, policy cache, hashes, redacted previews, and scan metadata locally. |
| `alarms` | Schedules policy sync, heartbeat, and lockdown refresh. |

Content scripts are declared statically in `manifest.json` and scoped to supported AI hosts. There are no optional permissions in the store build.

### Host Permissions

`host_permissions` are limited to specific `https://` AI destinations plus `https://soterai.in/*` for SoterAI API calls. Local development hosts such as `localhost` and `127.0.0.1` live only in `manifest.dev.json` and are excluded from the store package.

Run:

```bash
npm run validate:extension-permissions
```

This fails if manifest permissions and store docs drift apart.

## Development

```bash
npm run dev                 # Watch mode with hot reload
npm run build               # Production build
npm --prefix apps/extension run typecheck
npm run test:extension      # Browser extension privacy/security tests
npm run package             # Build + create ZIP for store submission
```

## License

MIT
