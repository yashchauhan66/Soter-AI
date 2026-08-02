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
- `declarativeNetRequestWithHostAccess`: after the extension has already decided to block a
  submission on a configured AI destination, it installs one short-lived rule that denies that
  one tab's own `POST`/`PUT`/`PATCH` requests to that same site for a few seconds. Without it, a
  page can re-issue the submission from its own script after the block is shown. The host-scoped
  variant is requested deliberately in place of the broad `declarativeNetRequest`, so the
  extension can only act on sites it already has a host permission for. No static rule list is
  shipped, no rule is created without a block decision, rules are removed when the short window
  ends, and `GET` requests are never affected, so page loading is unchanged.

## Network Request Blocking

The extension does not filter, redirect, or inspect general browsing traffic, and it declares no
static rule list. Rules are created only at the moment a scan on a configured AI destination
returns a block decision, and each rule is limited in five ways: it applies to the one tab the
submission came from, only to the site being submitted to, only to requests that send data
(`POST`, `PUT`, `PATCH`), only for a few seconds, and only up to a small fixed number of rules at
a time. Requests are denied, never modified or re-routed, and no request content is read — the
Chrome API cannot read request bodies. An administrator can turn this layer off entirely with the
`disableNetworkLayerEnforcement` managed policy for internal AI portals that are incompatible
with it.

## Storage

Storage is used for enrollment state, policy cache, last heartbeat status, local scan metadata, hashes, and redacted previews. Raw prompt text, raw copied text, and raw file content are not stored by default.

## Context Menus And Side Panel

Context menus and the side panel provide user-visible controls for safe prompt review, approval requests, enrollment status, and privacy status. They do not grant access to unrelated browsing.

## Alarms

Alarms are used for policy sync, heartbeat scheduling, and lockdown refresh. This keeps protection available when the browser is offline or the SoterAI service is temporarily unreachable.

## Remote Calls

Remote calls send policy metadata, decisions, risk scores, detected data types, and redacted previews by default. Full prompt logging is off by default and requires explicit admin policy configuration.
