# Browser Extension Privacy Practices Disclosure

Use this disclosure when filling the Chrome Web Store privacy practices form, Microsoft Edge Add-ons review notes, or customer security questionnaires.

## Single Purpose

SoterAI protects organization-approved AI usage by scanning prompts, supported file uploads, selected copy/paste context, and optional AI responses for secrets, PII, prompt injection, unsafe instructions, source code leakage, and sensitive business data.

## Data Categories Handled

| Category | Handled? | Why | Default transfer |
| --- | --- | --- | --- |
| Website content | Yes | Prompt, response, and supported file-content security scanning on configured AI destinations | Redacted preview and metadata only; raw prompt text is not sent by default |
| User-generated content | Yes | User prompts and pasted content must be scanned before AI submission | Redacted preview, hashes, decision metadata |
| Authentication information | Detected, not collected for account use | API keys/tokens/secrets are detected so they can be blocked or redacted | Secret values are not sent by default |
| Web browsing activity | Limited | Destination URL context is needed to apply policy to configured AI destinations | Destination metadata only; unrelated browsing is not monitored |
| Personal communications | Possible in prompts/responses | The extension may detect PII or sensitive text in user-entered prompts and AI responses | Redacted preview and metadata only |
| Financial/payment/health/government identifiers | Detected if present | These are sensitive data types the extension is designed to block or redact | Redacted preview and metadata only |

## Data Not Collected For Advertising

SoterAI does not sell extension data, use extension data for advertising, or transfer extension data for ad targeting, retargeting, or generalized market research.

## Human Access

Raw prompt text, raw copied text, and raw file content are not stored by default. SoterAI personnel do not read raw user content by default. Support review can use redacted metadata, logs, and customer-provided samples only.

## Storage

The extension stores enrollment state, policy cache, last heartbeat status, local scan metadata, SHA-256 hashes, redacted previews, and safe rewrites in browser local storage. Clean prompt scans are represented by hash, length, and marker rather than raw text.

## Transfer Security

Remote calls use HTTPS endpoints. Payloads are minimized and sanitized before transfer, and backend privacy guards reject disallowed raw-content fields.

## User-Facing Disclosure

The popup and side panel include a `What leaves browser?` section showing:

- Raw prompt to SoterAI: no by default.
- Stored locally: redacted preview, safe rewrite, hashes, and policy cache.
- Backend audit event: metadata, decision, risk score, and redacted preview.
- Response scanning: configured AI destinations only.
