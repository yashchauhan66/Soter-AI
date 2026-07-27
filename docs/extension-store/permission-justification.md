# Browser Extension Permission Justification

This document explains why the SoterAI browser extension requests each permission and how those permissions are limited.

## Host Permissions

The extension uses host permissions only for configured AI, coding, and SoterAI service destinations. It does not request `<all_urls>` and does not monitor unrelated browsing.

Host permissions are needed to:

- Scan prompts before they are submitted to configured AI destinations.
- Perform optional response scanning when an admin enables it for a destination.
- Apply organization policy and emergency lockdown rules.
- Show local block, redaction, warning, or approval controls.

An admin can disable response scanning or disable it per destination through policy.

Exact host permissions:

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

Exact required extension permissions:

- `contextMenus`: adds user-visible right-click actions for safe prompt review and approval workflows.
- `sidePanel`: shows enrollment, latest scan, response scan, and privacy status without injecting extra UI into the page.
- `storage`: stores policy cache, enrollment status, hashes, scan metadata, and redacted previews.
- `alarms`: schedules policy sync, heartbeat, and lockdown refresh.

## Storage

Storage is used for enrollment state, policy cache, last heartbeat status, local scan metadata, hashes, and redacted previews. Raw prompt text, raw copied text, and raw file content are not stored by default.

## Context Menus And Side Panel

Context menus and the side panel provide user-visible controls for safe prompt review, approval requests, enrollment status, and privacy status. They do not grant access to unrelated browsing.

## Alarms

Alarms are used for policy sync, heartbeat scheduling, and lockdown refresh. This keeps protection available when the browser is offline or the SoterAI service is temporarily unreachable.

## Remote Calls

Remote calls send policy metadata, decisions, risk scores, detected data types, and redacted previews by default. Full prompt logging is off by default and requires explicit admin policy configuration.
