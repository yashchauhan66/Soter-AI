# Permission Justification for Soter Enterprise AI Control Plane

This document matches the production browser-extension manifest at
`apps/extension/manifest.json` for version 0.1.2.

The store build does not request interactive tab access, programmatic script
injection, browser identity access, navigation history access,
`optional_permissions`, `optional_host_permissions`, `<all_urls>`, `*://*/*`,
`http://` hosts, localhost hosts, or retired backend/listing domains.

## Required Permissions

- `contextMenus`: Adds right-click actions that let a user scan selected text on supported AI tools.
- `sidePanel`: Displays policy status, scan results, and enrollment state in the browser side panel.
- `storage`: Stores local enrollment state, cached policy metadata, and user-visible extension settings.
- `alarms`: Schedules periodic policy sync and health heartbeat checks without persistent background execution.

## Host Permissions

The extension runs only on the supported AI tools, coding workspaces, and SoterAI production service listed below. These hosts are required so the content scripts can scan prompts and AI responses on declared AI destinations, and so the extension can communicate with the production SoterAI service. Unrelated browsing is not monitored or scanned.

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://www.perplexity.ai/*`
- `https://poe.com/*`
- `https://openrouter.ai/*`
- `https://replit.com/*`
- `https://*.replit.dev/*`
- `https://stackblitz.com/*`
- `https://*.stackblitz.io/*`
- `https://codesandbox.io/*`
- `https://*.csb.app/*`
- `https://github.dev/*`
- `https://*.github.dev/*`
- `https://bolt.new/*`
- `https://v0.dev/*`
- `https://lovable.dev/*`
- `https://openwebui.com/*`
- `https://soterai.in/*`

## Removed From Store Build

- No `<all_urls>` or `*://*/*` broad host access.
- No `http://`, localhost, `127.0.0.1`, or other development-only hosts.
- No optional wildcard host permission for enterprise custom sites.
- No deprecated `bard.google.com` host.
- No retired backend or listing URL.

Development-only local testing uses `apps/extension/manifest.dev.json`, which is not a store submission manifest.

## Response Scanning Controls

Response scanning (inspecting the AI tool's replies, not just the user's prompt) is
**off by default** and is governed per destination by organization policy. An org
admin can enable or disable response scanning independently for each supported AI
destination via `responseScanningEnabled` in the synced policy; when an admin
disables it for a destination, the extension does not inspect responses on that
destination at all. This admin-disable control means response scanning never runs
unless a customer explicitly turns it on. Unrelated browsing is never monitored or
scanned regardless of this setting.

## Privacy Boundary

Prompt and response scanning is limited to the declared host permissions above. The extension does not inject content scripts into unrelated websites, does not request browser history permissions, and does not request tab enumeration permissions.
