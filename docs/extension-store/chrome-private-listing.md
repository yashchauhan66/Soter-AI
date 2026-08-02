# Chrome Web Store — Private / Unlisted Listing

## Extension Details

- **Extension Name:** Soter AI Security Guard
- **Short Description:** Enterprise AI security guard for browser extensions — detects and blocks unsafe AI prompts, secrets, and PII in real time.
- **Category:** Developer Tools
- **Language:** English

## Long Description

Soter AI Security Guard is an enterprise-grade browser extension that provides real-time security monitoring and policy enforcement for AI tool usage.

### Key Features
- **Prompt Guard:** Automatically detects and blocks prompts containing secrets, PII, source code, and sensitive business data before they reach public AI tools.
- **Shadow AI Discovery:** Identifies which AI tools employees are using across the organization, including unknown and unauthorized services.
- **Emergency Lockdown:** Instantly restrict AI data sharing across all enrolled extensions with a single admin command.
- **Approval Workflow:** Route sensitive prompts through admin approval before they are sent to AI tools.
- **SIEM Integration:** Forward security events to your SIEM or webhook endpoints with HMAC-SHA256 signed, redacted payloads.
- **Policy Engine:** Fine-grained per-department, per-role AI usage policies with real-time enforcement.

### Data Collection
This extension operates entirely in the browser. It does **not** collect, store, or transmit:
- Browsing history unrelated to AI tool usage
- Personal files or documents
- Raw API keys or credentials
- Keystroke data

The extension monitors only known AI tool domains (e.g., chatgpt.com, claude.ai, gemini.google.com) and only when a user interacts with them. Security events are transmitted to the configured enterprise Soter AI backend in redacted form only.

## Host Permission Justification

| Host Permission | Justification |
|----------------|---------------|
| `*://chatgpt.com/*`, `*://chat.openai.com/*` | Monitor and enforce AI security policy on OpenAI ChatGPT |
| `*://claude.ai/*` | Monitor and enforce AI security policy on Anthropic Claude |
| `*://gemini.google.com/*`, `*://bard.google.com/*` | Monitor and enforce AI security policy on Google Gemini/Bard |
| `*://perplexity.ai/*` | Monitor and enforce AI security policy on Perplexity |
| `*://poe.com/*` | Monitor and enforce AI security policy on Poe |
| `*://openrouter.ai/*` | Monitor and enforce AI security policy on OpenRouter |
| `*://replit.com/*`, `*://*.replit.dev/*` | Prevent source-code and secret leakage in browser development workspaces |
| `*://stackblitz.com/*`, `*://*.stackblitz.io/*` | Prevent source-code and secret leakage in browser development workspaces |
| `*://codesandbox.io/*`, `*://*.csb.app/*` | Prevent source-code and secret leakage in browser development workspaces |
| `*://github.dev/*`, `*://*.github.dev/*` | Prevent source-code and secret leakage in browser development workspaces |
| `*://bolt.new/*`, `*://v0.dev/*`, `*://lovable.dev/*` | Prevent source-code and secret leakage in AI-assisted browser builders |
| `*://openwebui.com/*` | Monitor and enforce policy on supported self-hosted AI web UI usage |
| `https://soterai.in/*` | Connect enrolled extensions to the SoterAI control plane for policy sync, enrollment and redacted event reporting |
| `*://localhost/*`, `*://127.0.0.1/*` | Protect local AI tools and development endpoints during enterprise policy enforcement |

**Note:** The extension does NOT monitor general browsing, only specifically listed AI tool domains.

## Privacy Declaration

- No data is collected from non-AI websites
- All transmitted data is redacted (PII and secrets are replaced with placeholders)
- Raw secrets are never stored or transmitted
- The extension operates under the customer's enterprise policy configuration
- No advertising, analytics, or third-party tracking is included

## Publishing Steps (Private / Unlisted)

1. Sign in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"** and upload the extension ZIP
3. Fill in all store listing fields as described above
4. Under **"Visibility"**, select **"Private"** (available only to approved users)
5. Add your organization's Google account emails to the private distribution list
6. Submit for review
7. Once approved, the extension is available only to users you explicitly authorize

## Support URL Checklist

- [ ] Support page URL (e.g., `https://soterai.com/support`)
- [ ] Privacy policy URL (see `privacy-policy.md`)
- [ ] Terms of service URL (if applicable)
- [ ] Documentation URL (e.g., `https://docs.soterai.com/extension`)

## Required Permissions Justification

The manifest is the source of truth for this table. Anything not listed here is not requested.

| Permission | Justification |
|-----------|---------------|
| `storage` | Store extension configuration, enrollment state, and cached policies locally |
| `contextMenus` | Provide right-click menu options for scanning selected text or requesting approval |
| `sidePanel` | Display the extension side panel for quick access to scan results and policy info |
| `alarms` | Schedule periodic policy syncs and heartbeat checks with the backend |
| `declarativeNetRequestWithHostAccess` | After a block decision, deny that one tab's own data-sending requests (`POST`/`PUT`/`PATCH`) to that one declared host for a few seconds, so the page cannot re-send a blocked prompt from its own script. No static rule list; no effect on `GET` or page loading; request contents are never read |

Not requested: `activeTab`, `scripting`, `webRequest`, `cookies`, `history`, `downloads`,
`debugger`, `management`, `identity`, `nativeMessaging`, `<all_urls>`, and any permission that
would grant browsing-history or cross-site visibility. Content scripts are declared statically
in the manifest for the listed AI hosts, which is why no scripting or `activeTab` permission is
needed.
