# Changelog

All notable changes to `n8n-nodes-soterai` will be documented in this file.

## [0.3.3] - 2026-07-31

### Fixed

- Replaced the final raw `throw error` re-throw in the per-item `catch` block with `throw new NodeOperationError(node, error as Error, { itemIndex: i })`, satisfying the n8n `@n8n/community-nodes/require-node-api-error` ESLint rule (n8n scan no longer reports `362:9`).
- Confirmed there are no remaining raw error re-throws; all unexpected errors are now wrapped in `NodeOperationError`/`NodeApiError`.

## [0.3.2] - 2026-07-26

### Fixed

- Added the credential dark-mode SVG and pointed the credential icon at `soterai.dark.svg`.
- Reworked unexpected-error wrapping so n8n errors are re-thrown only after non-n8n errors are converted to `NodeOperationError`.

## [0.3.1] - 2026-07-21

### Changed

- Moved the node into a `SoterGuard/` directory to satisfy the n8n `node-dirname-against-convention` rule.
- Replaced the raster node icon with themed SVG variants (`{ light, dark }`) for both the node and the credential, per the n8n icon-validation rules.
- Marked the node `usableAsTool: true` so it can be attached to AI Agent tool inputs.
- Switched HTTP calls to the built-in `this.helpers.httpRequest` (native timeout) instead of `fetch` + `setTimeout`/`clearTimeout`, removing restricted global usage.
- Replaced raw `throw new Error(...)` with `NodeOperationError`/`NodeApiError` across the execute path and added `pairedItem` linking to every output item.
- Used `NodeConnectionTypes.Main` for `inputs`/`outputs` and alphabetized all `options` lists.

## 0.2.11

### Changed

- Wrap unexpected HTTP/runtime errors from the SoterAI API in `NodeApiError` so the n8n UI surfaces HTTP status and the failing item index. `NodeOperationError` (e.g. unknown action) is preserved as-is.

### Fixed

- Published via the GitHub Actions release workflow (`npm publish --provenance`) so the package carries an npm provenance statement, matching the tagged source.

## [0.3.0] - 2026-07-18

### Added

- Added **Universal AI Firewall (Best Protection)**, a single n8n action that orchestrates input guard, RAG risk scanning, agent tool-call checks, memory safety checks, output guard, semantic egress checks, and one clear `finalDecision`.
- Added advanced Universal Guard fields for protection profile, RAG context, tool risk context, memory operation, output destination, protected source snapshots, and fail-closed routing.
- Added **Audit n8n Workflow Security**, a local workflow posture scanner for AI Agent, webhook, Code node, tool, memory, RAG, secret, and output-egress risks with OWASP mapping and recommended SoterAI placement.
- Simplified the Universal AI Firewall parameter strategy: the default UI now focuses on essential fields, while RAG/tool/memory/egress details are consolidated into optional Security Context JSON.
- Added live-chat friendly Safe Rephrase handling for human-review decisions via `needsHumanReview`, `liveChatAction`, and `safeRephrasePrompt`.
- Added copy-paste Security Context JSON templates and an importable example workflow for RAG, tool, memory, and output/egress context.
- Added package validation for README/package/User-Agent version consistency and sanitized `rawResponse` output.

### Security

- Recursively sanitize `rawResponse` workflow output before returning it to downstream n8n nodes.
- Expanded error redaction for bearer tokens, common provider tokens, AWS access key IDs, database URLs, and sensitive key/value pairs.
- Clarified the privacy contract: n8n credentials store API keys, node output redacts secrets, and the node does not collect telemetry or write local files.
- Added Base URL validation to require HTTPS except `http://localhost` local development and reject embedded credentials, query strings, and fragments.
- Sanitized Metadata JSON before API calls by redacting sensitive keys/strings and truncating long metadata strings.
- Added consistent `operation` output fields for downstream routing across all node actions.

## [0.2.8] - 2026-07-14

### Added

- Added an explicit Analyze Text operation for risk-summary workflows.
- Added package-level workflow validation tests.
- Added final Creator Portal example workflows to the published npm package.

### Fixed

- Improved API timeout, rate-limit, authentication, payload-size, and sanitized error handling.
- Updated package keywords and README/support metadata for n8n submission review.

## [0.2.7] - 2026-07-03

### Changed

- Migrated the production API base URL, documentation, and marketplace links to `https://soterai.in`.

## [0.2.6] - 2026-07-02

### Fixed

- Add a repository-root credential compatibility mirror for n8n Creator Portal, whose automated source check does not resolve the package's monorepo `repository.directory` path.

## [0.2.5] - 2026-07-02

### Fixed

- Include generated n8n `dist` files in the GitHub repository so Creator Portal source checks can find the credential and node files referenced by package metadata.

## [0.2.4] - 2026-07-02

### Fixed

- Updated `n8n-workflow` peer dependency to `*` to satisfy n8n community package scanner requirements.

## [0.2.3] - 2026-07-02

### Fixed

- Aligned package repository metadata with the GitHub Actions provenance repository for npm provenance verification.

## [0.2.2] - 2026-07-02

### Changed

- Prepared a new npm release for GitHub Actions provenance publishing required by n8n Creator Portal review.

## [0.2.0] - 2026-07-02

### Changed

- Restored the marketplace README to the HTTPS production SoterAI base URL.
- Updated repository and issue links for npm and n8n Creator Portal review.
- Clarified that verified n8n marketplace submission should use GitHub Actions npm provenance.

## [0.1.7] - 2026-06-26

### Changed

- Temporarily changed the default n8n API Base URL to `http://13.200.123.232:3000` because `soterai.in` DNS is currently not resolving reliably from n8n runtimes.
- Added README guidance for updating existing n8n credentials that still point to `.dev` or `soterai.in`.

## [0.1.6] - 2026-06-26

### Changed

- Updated the default SoterAI API base URL to `https://soterai.in`.
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
- **PII Redactor** action: detect and redact sensitive data (emails, phone numbers, secrets) from any text.
- **RAG Scanner** action: scan documents and chunks for embedded threats before adding to vector databases.
- Configurable **On Threat** behavior (Block, Redact, Warn, Continue) for the input and output guards.
- Optional per-node **Project ID** override and **Metadata JSON** for audit trails.
- Example workflow: Protected Chatbot with input guard, threat routing, and output guard.
- SoterAI API credential type with API key, base URL, and default project ID.
