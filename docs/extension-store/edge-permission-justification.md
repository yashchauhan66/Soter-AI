# Edge Add-ons — Permission Justification

**Extension:** Soter Enterprise AI Control Plane — v0.1.2
**Manifest:** MV3. This document reflects the hardened store manifest
(`apps/extension/manifest.json`). Every permission below is verified as *actually
used* in source; unused permissions were removed for certification.

## API permissions (4 — all used)

| Permission | Why it is required | Code that uses it |
|---|---|---|
| `contextMenus` | Adds the right-click "Scan with Soter" entry on supported AI pages | `src/background/context-menu.ts`, `src/background/service-worker.ts` |
| `sidePanel` | Renders the Soter side panel showing the latest scan result and enrollment status | `src/background/service-worker.ts`, `src/sidepanel/*` |
| `storage` | Caches the signed org policy and enrollment state locally; reads managed-storage config for zero-touch enrollment | `src/lib/storage.ts`, `src/lib/enrollment.ts`, `src/lib/lineage-context.ts` |
| `alarms` | Schedules periodic policy sync and heartbeat | `src/background/policy-sync.ts`, `src/background/service-worker.ts` |

## Permissions REMOVED during certification fix

| Removed | Reason |
|---|---|
| `activeTab` | No `chrome.tabs` / `activeTab` API call exists in source — content scripts are declared statically, so the permission was dead. |
| `scripting` | No `chrome.scripting.executeScript` dynamic injection exists — all content scripts are declared in the manifest. Dead permission. |
| `optional_permissions: identity, identity.email` | No `chrome.identity` usage anywhere in source. Employee attribution comes from enrollment/managed-storage config, not the identity API. Dead permission. |

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
| `https://replit.com/*`, `https://*.replit.dev/*` | Replit editor + hosted preview surfaces (`replit.ts`) |
| `https://stackblitz.com/*`, `https://*.stackblitz.io/*` | StackBlitz editor + hosted preview (`stackblitz.ts`) |
| `https://codesandbox.io/*`, `https://*.csb.app/*` | CodeSandbox editor + hosted preview (`codesandbox.ts`) |
| `https://github.dev/*`, `https://*.github.dev/*` | GitHub Codespaces / web editor (`github-codespaces.ts`) |
| `https://bolt.new/*` | Bolt (`bolt.ts`) |
| `https://v0.dev/*` | v0 (`v0.ts`) |
| `https://lovable.dev/*` | Lovable (`lovable.ts`) |
| `https://openwebui.com/*` | Open WebUI (`openwebui.ts`) |
| `https://soterai.in/*` | **API host only** — the org's Soter backend the extension calls to sync policy and post redacted metadata. No content script is injected here. |

### Why the wildcard-subdomain hosts are unavoidable

`*.replit.dev`, `*.stackblitz.io`, `*.csb.app`, and `*.github.dev` are the domains on
which those platforms serve **per-project generated subdomains** (e.g.
`abc123.csb.app`). The subdomain is unique per user project and cannot be enumerated
ahead of time, so a wildcard is the minimum viable match to scan code being sent into
those AI-assisted environments. The scheme is pinned to `https://` and the parent
domains are fixed; this is not broad `*://*/*` access.

**Reviewer fallback:** if Microsoft requires further reduction, the four
wildcard-subdomain code-sandbox hosts can be dropped, leaving the fixed
consumer-AI hosts (ChatGPT, Claude, Gemini, Perplexity, Poe, OpenRouter, Bolt, v0,
Lovable, Open WebUI) + `soterai.in`. This is a listing-only change, no code impact.

## What the extension deliberately does NOT request

- No `<all_urls>` / `*://*/*`.
- No `tabs`, `history`, `webNavigation`, `cookies`, `webRequest`, `downloads`,
  `clipboardRead` (clipboard lineage uses standard `paste` events on supported hosts).
- No optional permissions and no `optional_host_permissions`.
- No `http://` hosts in the store build (localhost lives only in `manifest.dev.json`).
