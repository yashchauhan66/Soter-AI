# Changelog

All notable changes to `n8n-nodes-soterai` will be documented in this file.

## [0.6.0] - 2026-08-22

Offline operation, fallback when the API cannot be reached, batch performance, and the defects a new in-package test suite found on the way there.

### Added

- **Local mode — the node runs with no network call and no credential.** A new **Detection Engine** option (Cloud / Local / Auto) puts a pattern-and-heuristic engine inside the n8n process: injection, jailbreak, exfiltration, code and SQL payloads, secrets, PII including Indian identifiers, RAG document trust scoring, tool-call risk, and egress comparison against sources whose text you supply inline. Nothing leaves the instance, which is the one blocker no amount of documentation could fix for an air-gapped or data-residency-bound deployment.
- **Local mode never claims to be cloud mode.** Every local item carries `engine: "local"`, `engineDegraded`, and `engineDetail.limitations` — the explicit list of what the offline engine cannot do (no ML classifier, no multi-turn correlation, no attacker reputation, no agent-passport enforcement, and no egress comparison against a source given as a bare ID). The disclosure is in the run output, not only in this file.
- **Auto mode falls back only when the cloud could not be *asked*.** A dropped connection, a 5xx, a timeout, an exhausted rate-limit window, or no credential selected all fall back to the local engine and mark the item `engineDegraded: true` with the reason in `engineDetail.fellBackFromCloud`. A 401, 403, or 400 is the cloud answering about *your request*, so it still fails the item — answering a rejected API key with a weaker engine would hide the misconfiguration behind something that reads like protection.
- **Per-layer fallback in the Universal AI Firewall.** A single dead optional layer is now answered locally instead of being left unchecked: the layer reports `engine: "local"`, `engineDegraded: true`, and appears in the new `locallyCheckedLayers`. In Auto mode this also covers the two configuration gaps that previously left a tool payload uninspected — no **Session ID**, and an agent with no passport enrolled.
- **Advanced Options** (collection, all optional, defaults unchanged): **Items in Parallel** (1–20, bounded and order-preserving), **Layers in Parallel** for the Universal firewall, **Reuse Identical Items** so a batch of duplicate texts costs one call, **Request Timeout**, and **Include Raw API Response**.
- **UI/UX:** the canvas subtitle names the engine (`Guard Input (block) · local`), the credential is now optional so a local-only install has nothing red on it, and two hints explain what local mode cannot resolve before you run the workflow.
- **An in-package test suite that gates publication.** 54 behavioural tests over the runtime, the local engine, and engine selection, wired into `npm test` and `prepublishOnly`, with the package validator extended to the new honesty invariants (limitations attached to every local result, degraded marking on fallback, no fallback on an authoritative refusal, unresolvable sources reported as unresolved).
- **A credential-free example workflow**, `examples/soterai-local-offline-engine.workflow.json`: a Local guard with no credential attached wired to its Safe and Flagged outputs, plus an Auto guard that prints which engine actually answered. The validator asserts the example keeps running without a credential, so the central local-mode claim stays checkable by import rather than by trust.

- **The limitation list now carries measured numbers, not adjectives.** `engineDetail.limitations` said novel phrasings "can pass here", which reads as a small gap. It now states what was measured on corpora the rules were not written for — roughly 18% of prompt-injection items, 39% of jailbreak items, 5% of system-prompt-leak items — alongside the precision figure that is the tier's actual strength (2 findings in 6,424 held-out benign items). A workflow author reading a clean LOCAL verdict can now see how much weight it carries.
- **Three measurement scripts, two of them wired into `npm test`.** `npm run test:redos` sweeps every regex literal in the local engine (99 of them) against 15 adversarial shapes; `npm run test:stress` times 22 worst-case paths against explicit budgets; `npm run measure` scores the engine on held-out corpora and reports finding recall separately from routed recall. The 54 behavioural tests measure self-consistency against inputs chosen by whoever wrote the rules — these measure cost and coverage, which is where every defect in this release's Security section was hiding.

### Changed

- **Instruction-override detection no longer requires a temporal adjective.** The rule matched a target like "previous instructions" or "the above rules", so it needed a word such as *previous*, *prior* or *above* to be present. The single most common injection phrasing in the corpus — "ignore all your instructions" — has no such word and passed, as did "ignore your hard-coded instructions" and "ignore literally all of your previous instructions" (the prefix group absorbs neither *literally* nor *of*). Ownership is now matched on the model rather than on time, which also catches "ignore the last few things you were told". A user revising their own request says *my*, so "ignore my previous message" stays clean.
- Further additions to persona, disclosure and restriction-removal detection from the same measurement pass. Measured effect across the whole set, on corpora the rules were not written for: prompt-injection recall 14.78% → 18.28%, jailbreak 32.78% → 38.59%, system-prompt-leak 3.83% → 4.86%, with the benign false-positive rate unchanged at 0.03% and over-defense on meta-instructional benign text still 0%. Every addition was scored against 6,424 benign items before it was kept, because on this tier precision is the asset.
- One pre-existing pattern was **narrowed**: bare `no` sat in the restriction-removal alternation beside imperative verbs like *remove* and *disable*, and fired on ordinary English — "there is no restriction on the number of queens", from a chess explainer, was a false positive. Deleting the branch outright cost four real attacks for that one benign row, so it was measured first and then split by grammatical shape: subject-owned ("Wrath has no restrictions"), hypothetical ("if there were no restrictions") and existential ("where no content policies exist") are kept; "no restriction *on* <thing>" is not.

### Fixed

- **A non-string n8n expression crashed the node with `text.trim is not a function`.** Every parameter read was `getNodeParameter(...) as string`, which is a compile-time cast and checks nothing at runtime — an expression returning a number, an object or `null` reached the engine as-is. Text fields now coerce scalars and **refuse** objects and arrays, naming the field and what it received. Refusing rather than stringifying is deliberate: scanning `[object Object]` or a JSON dump and reporting a clean pass is exactly the false assurance this package exists to avoid.
- **RAG document trust scoring failed open on a non-string source.** `source.toLowerCase()` on a non-string threw before the untrusted-source check could run, and `"unknown"` was not in the untrusted list — so a document whose provenance could not be established was treated as trusted. It is now treated as untrusted, which is the only safe default for provenance.
 Attribution compared each layer's `riskScore`, but the RAG layer reports a *trust* score, where higher is better — read as a risk score it was always 0, so a poisoned document could drive a block while the blame landed on another layer. All layers are now scored through the same conversion the verdict uses.
- Four defects in code added by this release, caught by the new suite before it shipped: identical items running concurrently each started their own API call (the in-flight request is now shared, not just the finished result); a message spaced out letter by letter defeated the local phrase rules because the whitespace collapse ran before the un-spacing and three-letter words were never rejoined; the local Aadhaar rule redacted a 12-digit window *inside* a longer order reference; and local tool-call risk could not see the verb in `send_email` or `delete_rows` (a word boundary does not exist at an underscore) and compared `EXTERNAL` case-sensitively against `external`, so no call from the node was ever treated as leaving the network.

### Security

Three availability defects in the local engine, all of them denial-of-service by way of a single ordinary-looking item, and one honesty defect of the same family. These matter more here than in most code: n8n runs a node synchronously inside the worker that owns the execution, so a slow item does not degrade this workflow — it stops every other workflow on that worker until it finishes.

- **A single pasted item could block a worker for 40 seconds.** The Indian UPI VPA rule used an unbounded `[\w.-]{3,}` before its `@`. `\b` puts a word boundary every couple of characters in text like `a-1a-1a-1…`, and at each one the class consumed to the end of the item and then gave every character back looking for an `@` that was not there — quadratic. At the node's own 200,000-character cap this measured **39,690 ms** of blocking CPU. The quantifier is bounded at 64, longer than any real VPA, and the same item now costs **101.6 ms** (390× faster). All four real VPA shapes still redact.
- **The e-mail rule had the same shape.** Overlapping character classes made each separator's placement ambiguous, so the engine explored the alternatives. Rewritten as unambiguous DNS labels — the label class excludes `.`, so every separator has exactly one possible position. Now linear: 158 ms at 200,000 characters, with recall pinned by test against eight real address shapes and four non-addresses.
- **Egress leak comparison was quadratic, and it silently gave up at 20,000 characters.** The verbatim-overlap check was an O(n·m) dynamic program, which is why it had been capped — and the cap meant a leak that began past offset 20,000 could not be detected at all, while the layer still reported a result. It is now a Rabin–Karp rolling hash over a chained hash table, with **every hash hit verified against the actual characters**, because a hash collision must never become a reported leak. Output of 25,000 characters against one source: **10,054 ms → 20.3 ms**. Against ten sources: **92,965 ms → 81.3 ms** (1143×). Coverage is raised from 20,000 to 200,000 characters, so a leak past the old cutoff is now found rather than missed quietly, and cost is measured linear in total source size (271/921/1360/4577/8062 ms for 1/5/10/25/50 sources of 200,000 characters).

- **An over-length protected source was compared in part and reported in full.** Protected source content does not pass through the node's 200,000-character item validation — only the item's own text fields do — so a source arriving from, say, a PDF-extract node can be far longer than the comparison bound. The verbatim stage was bounded and the shingle stage was not, which made both halves wrong at once: nothing capped the cost of the unbounded stage (measured **2,803 ms and 167 MB of heap** for one 8 MB source, against 173 ms for one at the limit), and no single statement about what had been examined was true. Every stage now shares one bound, and a source longer than it is named in **`partiallyComparedSourceIds`** with the verdict raised from `ALLOW` to `REVIEW` — a comparison that covered a prefix must not read the same as one that covered the whole document, which is the same failure as the 20,000-character truncation above. The 8 MB source now costs **239 ms**, and `npm run test:stress` fails if the bound is removed.

Both regex defects were found by accident, one adversarial input at a time, which is not a method — so `npm run test:redos` now sweeps all 99 regex literals against 15 adversarial shapes on every `npm test`. The sweep carries a canary (the UPI rule exactly as it was before the fix) and **fails if its own thresholds do not flag it**, so the gate cannot be quietly loosened into uselessness.

### Note

Local mode is the pattern tier and only the pattern tier. It is a real second-best when the alternative is no check at all, and it is not a substitute for the cloud engine's classifier, session correlation, or identity enforcement.

## [0.5.2] - 2026-08-18

**Never published to npm.** 0.5.1 went out and 0.5.2 did not, so every fix below first reaches users in 0.6.0. If you are on 0.5.1 you are missing all of it, not one patch release — including three cases where a layer reported a clean result on data it had not examined.

Four bugs found by running the node against the live API, and the two extra defects that turned up while fixing the first one.

### Fixed

- **Universal AI Firewall failed with "Authentication required." while every other action worked on the same credential.** The root cause was server-side: `/api/semantic-egress/*` authenticates on `x-api-key` and has no cookie path at all, but it was still being session-gated by middleware, so a valid key got a 401 before the handler ran. The Universal AI Firewall was the only action that touched that route (the layer fires when **AI Output Text** is filled), which is why exactly one action failed. Fixed on the deployment; the node no longer depends on that fix:
  - One failed layer no longer discards the item. Each optional layer runs independently, and a layer that could not answer is reported as `unavailable` with the endpoint named — rather than taking the five layers that did run down with it.
  - A layer that never answered is never counted as a layer that passed. Only layers that returned a verdict feed the decision, the risk attribution, and the categories; the rest are listed in `degradedLayers`, and the item leaves through **Flagged** because part of it went uninspected. New fields: `degraded`, `degradedLayers`, `fullyChecked`.
  - 401 and 403 messages now name the path and say so plainly: if the other calls in the workflow succeed on the same credential, the key is not the problem.
- **Protected Sources were silently ignored.** The node sent them as `sources`, which is not a key the egress schema defines, so they were stripped and the leak check compared the AI output against an empty source list — reporting a clean result while doing no comparison. Sources are now fingerprinted first (`/api/semantic-egress/source/fingerprint`) and referenced by `sourceIds`, with `comparedSourceIds` on the layer so you can see what was actually compared. Anything skipped or past the 50-source API limit is named in `skippedSources` rather than dropped.
- **The Tool Call layer reported every item as a CRITICAL block when no agent passport existed.** `/api/agent/tool/check` enforces zero-trust identity before it looks at the tool call and fails closed, which is correct — but it is an answer about enrollment, not about your data. It is now labelled `configurationRequired` with the enrollment steps, and a Tool Call layer with no **Session ID** fails as a configuration error up front instead of being read as a threat.
- **RAG Risk Summary could report a poisoned document as `TRUSTED` / `INDEX`.** The trust verdict merged the detector's findings into its response but scored the document with its own, much narrower pattern, so a document carrying a HIGH-severity `PROMPT_INJECTION` finding came back recommended for the vector store. Fixed on the deployment (a detected document-borne attack can no longer be scored above the quarantine floor), and the node now refuses a contradictory verdict from any deployment: it reports `QUARANTINED` / `QUARANTINE` and keeps the server's original answer in `serverTrustLevel` / `serverRecommendedAction` with an `overrideReason`, so the override is auditable rather than silent. Remediable PII still gets `REDACT_AND_INDEX` — the override is scoped to attacks the document is carrying.
- **Redact Secrets or PII left US Social Security numbers in cleartext.** `123-45-6789` fell between two rules — the card rule wants 13+ digits, the phone rule wants a different grouping — so it survived redaction while email, phone, card, and Aadhaar were removed. Added to the server's detector (dashed form unqualified; unseparated form only when the text names it, with the SSA's never-issued ranges excluded so invoice and order numbers are untouched), and mirrored in the node as a client-side net for older deployments. Anything the node removes itself is reported as `clientSideRedaction` rather than folded into the server's entity list.
- **Redact Secrets or PII could return the original text as `safeText`.** When the server reported personal data but returned no redacted copy — including when the call was gated rather than analysed — the fallback chain ended at the input text, and no downstream node could tell the difference. The action now fails closed instead of presenting unredacted text as safe.
- **Adaptive abuse escalation gated calls that carried no attack signal.** Reputation is tracked per API key and IP across every endpoint, so a few blocked probes can turn the next, unrelated call into a block whose only finding is "Adaptive abuse escalation". Two changes: on the deployment, a redaction-only privacy turn is no longer escalated to a block at the ABUSIVE level (BANNED is unchanged); and in the node, reputation gating is now named for what it is via `throttled`, `throttleLevel`, and `throttleReason` on the input, output, PII, and Universal actions, so a workflow can tell "this item is a problem" from "this caller is rate limited". `throttled` is always present, so an expression can distinguish "not throttled" from an older node version.

### Note

The escalation threshold itself is unchanged: three blocked requests still reach the ABUSIVE level. Only the consequence for a redaction-only turn was narrowed. High-volume workflows that legitimately trip detectors should use a separate API key.

## [0.5.0] - 2026-08-06

### Added

- **Safe and Flagged outputs.** The node now routes items itself instead of returning a verdict and leaving the wiring to you. Anything the node blocks — or, for the report-only actions, anything it flags — leaves through **Flagged**; everything else leaves through **Safe**. This closes the node's worst failure mode: previously you could configure a guard, watch it correctly detect an attack, and still pass that item straight to the model, because nothing downstream ever read `blocked`. No IF node needed.
- Choosing Redact, Warn, or Continue under **On Threat** keeps those items on **Safe** with their cleaned or annotated text — that is what those settings are for. Only genuinely stopped items go to Flagged.
- An item whose check could not complete (with **Continue On Fail** enabled) now leaves through **Flagged**. Nothing cleared it, so an API outage can no longer turn into a silent bypass.
- **Guided Security Context** for the Universal AI Firewall, replacing the hand-written JSON blob. Retrieved Context (RAG), Tool Call, Memory Operation, and Output Destination are now four optional sections with real fields, dropdowns, and hints. The Output Destination list is generated from the server's own destination types, so a typo can no longer silently downgrade the data-leak check to its default.
- **Session ID** is now its own field rather than a key you had to know to put inside Metadata JSON. It is what enables multi-turn attack detection, and the node warns when it is empty.
- Node hints in the editor: a warning when **On Threat** is set to Continue (nothing will ever be stopped), a reminder when Session ID is unset, and guidance on wiring the Flagged output.
- Canvas subtitles now read `Guard Input (block)` instead of the raw parameter value `inputGuard`, so a workflow's protection posture is legible without opening each node.
- Node search now matches "guardrail", "firewall", "prompt injection", "jailbreak", "moderation", "OWASP", and other aliases.

### Changed

- The node is now a versioned node type. **Existing workflows are untouched**: they keep loading version 1, with its single output and its Security Context JSON field, and behave exactly as before. Version 2 is used only for nodes you add from now on. To adopt the new outputs in an existing workflow, add a fresh SoterAI node.
- `Redact Secrets or PII` keeps a single output on version 2. It never rejects anything, so a Flagged branch there would always be empty.
- Package validation now enforces the versioning contract: version 1 must keep exactly one output, version 2 must expose both, and failed checks must route to Flagged.

### Fixed

- Corrected the `PACKAGE_VERSION` constant, which still read `0.3.3` and was misreporting the node's version in the API User-Agent on every request. Package validation covered this, but the check was failing rather than passing.

## [0.5.1] - 2026-08-13

### Fixed

- Removed the invalid `AI` codex category and the undocumented `subcategories` field, which together caused an n8n marketplace review rejection. The node is now categorised `Development` and `Utility`.

### Added

- Guard Input, Guard Output, and the Universal AI Firewall now return `primaryRiskType`, `categoryConfidence`, and `latencyMs`. Branch on `primaryRiskType` rather than `categories[0]`: that array is in detector-registration order, which is why a SQL payload could previously be labelled `PROMPT_INJECTION`.
- Universal AI Firewall also returns `drivingLayer`, so `primaryRiskType` is attributed to the layer that produced the highest risk score rather than to whichever layer happened to run first.
- Guard Input and the Universal AI Firewall gain optional **Allowed Topics** and **System Prompt Context** fields for the off-topic guard. Both are bounded client-side to the server limits (50 topics, 120 chars each) so a long list is trimmed instead of failing the item with a validation error.
- New node icon: the SoterAI emblem, with light and dark variants, replacing the previous generic shield.

### Changed

- Leaving Allowed Topics empty keeps the previous behaviour exactly. An empty topic list means no scope is defined, not that everything is off-topic, so the guard stays off rather than flagging every message.
- `OFF_TOPIC` is advisory and does not block on its own — it is a product-scope signal, not a security verdict.

### Parity

- The n8n node, the Make app, and the Zapier app now expose the same 12 operations and the same calibration fields.

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
