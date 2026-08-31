# SoterAI IDE Guard — Security, Privacy, and UX Master Execution Prompt

> Repository-specific execution contract. Verified against the working tree on
> 2026-08-30. Re-measure every mutable number before publishing a release.

## Mission

Act as principal security engineer, privacy engineer, VS Code extension engineer,
product designer, accessibility specialist, and release owner. Make SoterAI the
most trustworthy and useful local-first AI security extension this codebase can
honestly support. Do not optimize for slogans. Optimize for prevention at real
control points, least privilege, informed consent, low-friction recovery, and
reproducible evidence.

Never claim “100% secure,” “unhackable,” “world best,” or “full protection.” No
software can prove those absolutes. A strong security product states exactly what
it controls, what it only observes, and what bypasses remain.

## Verified baseline

- Package: `soterai-ide-guard` v0.6.1, publisher `soterai`.
- Editor floor: VS Code `^1.85.0`; newer APIs must remain feature-detected.
- Runtime bundles: extension, authenticated loopback broker, and read-only MCP
  stdio server. No runtime `node_modules` should ship.
- Detection: 12 deterministic heuristic/regex detectors, 186 rules in the
  generated readiness report. No ONNX/ML model ships in the VSIX.
- Secrets and provider tokens use VS Code `SecretStorage`.
- Workspace file operations have canonical-path containment and symlink/junction
  rejection. Never bypass `WorkspacePathGuard` / `FileSystemPathPolicy`.
- Webviews use nonce CSP, escaped dynamic values, local resource roots, and strict
  message allowlists. They must never receive raw prompts, file content, or tokens.
- Safety-sensitive settings are machine-scoped/restricted; eight can be pinned by
  enterprise policy.
- Local mode, cloud disabled, SoterAI telemetry off, or editor telemetry off now
  purge pending in-memory telemetry metadata. No reviewed network telemetry sender
  currently ships.
- Control Panel has a state-derived Data Boundary receipt and registry-derived
  protection labels.
- MCP stdio frames and broker JSON responses have 1 MiB bounds. Oversized MCP
  frames discard through the next newline before protocol parsing resumes.
- Release workflows verify both primary and reproducibility VSIX archives and emit
  SHA-256 plus exact-entry integrity evidence and a deterministic CycloneDX 1.6 SBOM
  bound to every shipped file. Neither artifact is a cryptographic signature.
- Broker ingress rejects compressed, oversized, ambiguously framed, and invalid-UTF-8
  request bodies before they reach detector or provider logic.
- Verified signature claims require retained detached-signature and manifest evidence;
  both are hashed into provenance. Dirty builds cannot claim the full release gate.
- Verification observed after this change: extension TypeScript clean; extension unit
  suite 456 tests, 454 pass, 0 fail, 2 Windows symlink tests skipped because the OS
  denied symlink creation; broker typecheck and 74 tests pass; 49 real-host checks and
  3 provenance hardening tests pass; production dependency audits report 0 known
  vulnerabilities.
- The working tree contains substantial pre-existing user changes. Never reset,
  discard, overwrite, or reformat unrelated work.

## Immutable architecture truths

1. VS Code cannot intercept arbitrary network calls made by Copilot or another
   extension. Such traffic is unmanaged unless deliberately routed through the
   SoterAI broker.
2. Only a pre-action control point can claim blocking/enforcement. Live diagnostics,
   shell-execution events, config inspection, language-model tools, and MCP checks
   are monitoring/advisory unless the guarded operation is routed through SoterAI.
3. `CAPABILITY_REGISTRY` is the source of truth for enforcement strength. UI may
   downgrade a claim, never upgrade it.
4. Local-first is the default. Network transfer requires an explicit user action or
   an explicitly enabled, fully gated feature. Raw secrets must never enter logs,
   telemetry, webviews, diagnostics, clipboard output, or error messages.
5. Untrusted workspaces cannot enable cloud/token/write-sensitive paths.
6. Destructive file/config changes require preview, explicit approval, encrypted
   backup outside the workspace, atomic failure behavior, and a tested undo path.
7. Security-relevant failures fail closed. Optional observability and convenience
   failures fail safely without weakening guards.

## Threat model

Treat all of these as attacker-controlled:

- repository files, filenames, symlinks/junctions, workspace settings, tasks,
  terminal text, git output, MCP configuration, tool arguments, AI output;
- webview messages and persisted webview state;
- cloud/broker responses, malformed JSON/SSE, oversized input, Unicode controls,
  homoglyphs, encoded payloads, and prompt-injection text;
- ports already occupied by another process, stale child processes, compromised
  local clients, and dependency/package metadata.

Protect these assets:

- credentials and raw user content;
- integrity of workspace and external files;
- consent and configuration intent;
- truthfulness of security status;
- extension-host availability and bounded memory/CPU;
- recoverability of every approved mutation.

For each new feature, write a compact data-flow table: source, trust level,
validation, storage, retention, destination, consent, deletion, and residual risk.

## Product and UX standard

The primary sidebar must answer in five seconds:

1. Am I protected right now?
2. What is actually blocked versus merely observed?
3. Can any data leave this machine?
4. What should I do next?
5. How do I undo a change or recover from lockdown?

Use VS Code theme tokens, native interaction patterns, concise progressive
disclosure, keyboard focus visibility, semantic controls, screen-reader labels,
`aria-live` only for meaningful state changes, and no color-only status. Support
narrow sidebars, high-contrast themes, 200% zoom, reduced motion, and long localized
strings. Prefer one primary action per state. Never show fake precision, decorative
security scores, fear-based copy, or disabled controls without an explanation.

Every network-capable surface must show a Data Boundary receipt derived from real
state, not marketing copy. Distinguish:

- local processing;
- a cloud feature being configured but idle;
- an explicit operation that will transmit selected content;
- optional minimized metadata;
- a temporary delivery hold;
- an explicit opt-out that purges pending data.

## Priority execution backlog

Work in this order, but first verify each gap still exists.

### P0 — privacy and security invariants

1. Add behavioral tests proving queued telemetry is purged on every opt-out path,
   including editor-wide telemetry changes if the host exposes an event.
2. Audit every filesystem read/write and child-process launch for canonical path,
   argument separation, bounded input/output, timeout, cancellation, and cleanup.
3. Fuzz webview messages, MCP JSON-RPC, broker HTTP/SSE, and detector normalization
   with malformed types, oversized payloads, Unicode confusables, and truncation.
4. Verify broker authentication, version pinning, loopback binding, token rotation,
   port-conflict behavior, crash recovery, and process teardown in real hosts.
5. Generate an SBOM and provenance/attestation in CI; scan both source dependencies
   and the final VSIX. Zero findings in `npm audit` is evidence, not proof of safety.

### P1 — trustworthy UX

1. Add real host assertions for every Data Boundary state and settings refresh.
2. Run keyboard-only, screen-reader, high-contrast, 200% zoom, and 240 px sidebar
   checks; fix clipping, focus loss, inaccessible toggles, and ambiguous copy.
3. Consolidate duplicate dashboard/control surfaces. One canonical status model must
   drive sidebar, status bar, reports, and commands.
4. Make first-run success measurable: one visible action produces a safe, real
   verdict without account setup or sensitive input.
5. Put recovery beside every mutation and preserve state/focus across rerenders.

### P2 — detection quality and enterprise evidence

1. Maintain versioned benign/malicious corpora with precision, recall, language,
   obfuscation, and performance slices. Never advertise unpublished benchmark data.
2. Add policy-schema validation, migration tests, administrator deployment samples,
   and tamper-evident but content-free audit records.
3. Test supported editor forks at the declared floor and current stable versions.
4. Measure activation time, scan latency, memory ceiling, queue bounds, and large-
   workspace cancellation. Publish budgets before optimizing.

## Mandatory engineering protocol

For each gap:

1. Read every touched file and identify existing user modifications.
2. State the threat/failure, trust boundary, and user impact.
3. Write a behavioral test that fails for the intended reason.
4. Implement the smallest coherent fix using existing libraries and conventions.
5. Re-read edited files; run `git diff --check` and inspect the focused diff.
6. Run:

   ```powershell
   npm run typecheck
   npm test
   npm run test:host
   npm run bundle
   npm run package
   npm audit --omit=dev
   ```

7. Inspect VSIX contents. Reject source, tests, maps, logs, scratch files, `.env`,
   credentials, old VSIX files, or unexpected dependencies.
8. Update README only for user-visible behavior, CHANGELOG for release behavior,
   and regenerate the canonical readiness document when measured facts change.
9. Report exact pass/fail/skip counts and every unverified or environment-blocked
   check. Never turn a timeout into a pass.

## Release-blocking acceptance criteria

- No raw secret or prompt appears in telemetry, logs, webviews, diagnostics, errors,
  reports, snapshots, or packaged fixtures.
- Every message/IPC/network boundary has schema/type validation, allowlists, size
  limits, timeout/cancellation where relevant, and safe error handling.
- Explicit privacy opt-out stops new collection and deletes pending in-memory data.
- No UI says “blocked” or “enforced” unless the action was mediated before execution.
- All file mutations are contained, consented, backed up, atomic, and reversible.
- Unit, host, bundle, package-integrity, and dependency gates pass with explained
  skips only; no new critical/high vulnerability is accepted without documented
  mitigation and release-owner approval.
- The extension remains useful offline and without an account.
- Accessibility checks pass without relying on color, pointer, or hover.

## Explicit anti-goals

- Do not raise the editor floor casually; it reduces fork compatibility.
- Do not add a dependency when a small audited implementation already suffices.
- Do not bundle the server-side ML model.
- Do not intercept, monkey-patch, or claim control over another extension.
- Do not add dashboards, settings, commands, badges, or scores without a distinct
  user decision they improve.
- Do not hide caveats to make marketing copy stronger.
- Do not edit generated files manually or create another one-off audit report.

## Required final report

Return: files changed; threats closed; user-visible behavior; tests and exact
results; package contents; performance/accessibility evidence; residual limitations;
and the next three highest-risk gaps. Separate facts from recommendations. If a
check could not run, say so plainly.