# Permission Justification for Soter Enterprise AI Guard

## Required Permissions
- `activeTab`: Required to interact with the currently active AI tab when the user clicks the extension action.
- `contextMenus`: Required to add right-click options for quickly scanning selected text or images.
- `sidePanel`: Required to display the Soter Control Plane side panel for scan results and policy status.
- `storage`: Required to securely cache policies, rules, semantic thresholds, and the enrollment token locally.
- `scripting`: Required to inject content scripts programmatically into allowed AI domains to monitor input fields.
- `alarms`: Required to schedule background policy syncs and health heartbeats.

## Optional Permissions
- `identity` & `identity.email`: Required to attribute blocked events to the employee in the enterprise dashboard. This is optional and only used if the enterprise specifically configures user attribution.

## Host Permissions
The extension injects content scripts into these specific external AI tools and development environments to intercept and redact sensitive prompts, and to optionally perform response scanning to protect users from malicious AI outputs (if enabled by the admin). Admins can disable response scanning per destination. Unrelated browsing is not monitored or scanned.

- `*://chatgpt.com/*`
- `*://chat.openai.com/*`
- `*://claude.ai/*`
- `*://gemini.google.com/*`
- `*://bard.google.com/*`
- `*://perplexity.ai/*`
- `*://poe.com/*`
- `*://openrouter.ai/*`
- `*://replit.com/*`
- `*://*.replit.dev/*`
- `*://stackblitz.com/*`
- `*://*.stackblitz.io/*`
- `*://codesandbox.io/*`
- `*://*.csb.app/*`
- `*://github.dev/*`
- `*://*.github.dev/*`
- `*://bolt.new/*`
- `*://v0.dev/*`
- `*://lovable.dev/*`
- `*://openwebui.com/*`
- `*://localhost/*`
- `*://127.0.0.1/*`

## Optional Host Permissions
- `*://*/*`: Used for the Data Lineage feature to monitor copy events from internal corporate tools. This is only requested at runtime if the enterprise admin configures specific internal hostnames to monitor.

## Enterprise Justification
This extension is explicitly for enterprise deployments and managed devices. Broad permissions are required to provide comprehensive DLP coverage across an organization's varying workflows. Raw prompts, files, or copied text are not stored by default; only metadata and redacted previews are sent to the customer's dedicated enterprise dashboard.
