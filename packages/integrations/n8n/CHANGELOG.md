# Changelog

All notable changes to `n8n-nodes-soterai` will be documented in this file.

## [0.1.6] - 2026-06-26

### Changed

- Updated the default SoterAI API base URL to `https://soterai.publicvm.com`.
- Replaced broken `.dev` documentation and dashboard links with working public app links.

## [0.1.5] - 2026-06-26

### Changed

- Enlarged the n8n node icon artwork while preserving the original SoterAI logo.
- Removed the baked-in square background from the icon so it renders cleanly on n8n node cards.

## [0.1.4] - 2026-06-26

### Fixed

- Added fetch typings for the GitHub Actions TypeScript build environment.

## [0.1.3] - 2026-06-26

### Changed

- Aligned the npm publishing workflow with Node.js 22 and a more resilient dependency install step.

## [0.1.2] - 2026-06-26

### Changed

- Hardened the GitHub Actions npm publishing workflow with lint and package verification checks.
- Updated the n8n node user agent and display text polish for marketplace release.

## [0.1.1] - 2026-06-26

### Changed

- Updated package metadata for n8n Creator Portal review.
- Added explicit SoterAI privacy, terms, pricing, status, and support links to the README.
- Removed unsupported compliance wording from the README.

## [0.1.0] - 2026-06-26

### Added

- Initial release of the SoterAI community node for n8n.
- **Input Guard** action: scan user messages for prompt injection, jailbreaks, and other threats before they reach the LLM.
- **Output Guard** action: scan AI-generated responses for unsafe content before sending to users.
- **PII Redactor** action: detect and redact sensitive data (emails, phone numbers, secrets) with configurable redaction modes (partial, full, hash).
- **RAG Scanner** action: scan documents and chunks for embedded threats before adding to vector databases.
- **Incident Logger** action: log security incidents to the SoterAI ops dashboard with platform, workflow ID, risk score, and reason.
- Configurable **Policy Mode** (Monitor, Balanced, Strict) for input and output guards.
- Configurable **On Threat** behavior (Block, Redact, Warn, Continue).
- Optional per-node **Project ID** override and **Metadata JSON** for audit trails.
- Example workflow: Protected Chatbot with input guard, threat routing, and output guard.
- SoterAI API credential type with API key, base URL, and default project ID.
