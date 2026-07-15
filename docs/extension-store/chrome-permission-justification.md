# Chrome Web Store — Permission Justification

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Manifest:** MV3, hardened store manifest (`apps/extension/manifest.json`).
Every permission below is verified as *actually used* in source; unused permissions
were removed for review.

## API permissions (4 — all used)

| Permission | Chrome Web Store justification | Code that uses it |
|---|---|---|
| `contextMenus` | Adds the right-click "Scan with Soter" entry so a user can manually scan selected prompt/response text on supported AI pages. | `src/background/context-menu.ts`, `src/background/service-worker.ts` |
| `sidePanel` | Renders the Soter side panel showing the latest scan result, detected data types, and enrollment status. | `src/background/service-worker.ts`, `src/sidepanel/*` |
| `storage` | Caches the signed org policy, privacy mode, and enrollment/auth state locally; reads managed-storage config for zero-touch enterprise enrollment. | `src/lib/storage.ts`, `src/lib/enrollment.ts`, `src/lib/lineage-context.ts` |
| `alarms` | Schedules lightweight periodic policy sync and health heartbeat without a persistent background page. | `src/background/policy-sync.ts`, `src/background/service-worker.ts` |

## Permissions deliberately NOT requested

- No `activeTab` — content scripts are declared statically; no `chrome.tabs` call exists.
- No `scripting` — no `chrome.scripting.executeScript` dynamic injection; all content scripts are declared in the manifest.
- No `tabs`, `history`, `webNavigation`, `cookies`, `webRequest`, `downloads`, `clipboardRead`.
- No `identity` / `identity.email` — employee attribution comes from enrollment/managed-storage config, not the identity API.
- No `optional_permissions` and no `optional_host_permissions`.

## Host permissions (20 — https only, no localhost, no `<all_urls>`)

Content scripts are injected **only** into the specific AI tools the extension is
built to protect. Each host maps to a shipped adapter under `src/adapters/`.

| Host | Purpose / adapter |
|---|---|
| `https://chatgpt.com/*`, `https://chat.openai.com/*` | ChatGPT (`chatgpt.ts`) |
| `https://claude.ai/*` | Claude (`claude.ts`) |
| `https://gemini.google.com/*` | Gemini (`gemini.ts`) |
| `https://www.perplexity.ai/*` | Perplexity (`perplexity.ts`) |
| `https://poe.com/*` | Poe (generic AI chat adapter) |
| `https://openrouter.ai/*` | OpenRouter (generic AI chat adapter) |
| `https://replit.com/*`, `https://*.replit.dev/*` | Replit editor + hosted preview (`replit.ts`) |
| `https://stackblitz.com/*`, `https://*.stackblitz.io/*` | StackBlitz editor + hosted preview (`stackblitz.ts`) |
| `https://codesandbox.io/*`, `https://*.csb.app/*` | CodeSandbox editor + hosted preview (`codesandbox.ts`) |
| `https://github.dev/*`, `https://*.github.dev/*` | GitHub Codespaces / web editor (`github-codespaces.ts`) |
| `https://bolt.new/*` | Bolt (`bolt.ts`) |
| `https://v0.dev/*` | v0 (`v0.ts`) |
| `https://lovable.dev/*` | Lovable (`lovable.ts`) |
| `https://openwebui.com/*` | Open WebUI (`openwebui.ts`) |
| `https://soterai.in/*` | **API host only** — the org's Soter backend the extension calls to sync policy and post redacted metadata. No content script is injected here. |

### Why the wildcard-subdomain hosts are unavoidable

`*.replit.dev`, `*.stackblitz.io`, `*.csb.app`, and `*.github.dev` serve
**per-project generated subdomains** (e.g. `abc123.csb.app`) that are unique per user
project and cannot be enumerated ahead of time. A wildcard is the minimum viable match
to scan code being sent into those AI-assisted environments. The scheme is pinned to
`https://` and the parent domains are fixed; this is not broad `*://*/*` access.

## Response scanning control

Response (AI output) scanning is **off by default** and is only performed when an
enterprise admin explicitly enables it per destination in the org policy; an admin can
disable response scanning per destination at any time. Unrelated browsing is never
monitored or scanned — the extension has no host access outside the list above.

## Remote code

The extension does not download or execute remote code. All logic is bundled in the
package; the only network calls are HTTPS scan/policy requests to the configured Soter
API. See `chrome-web-store-submission-pack.md` for the exact data-use answers.
