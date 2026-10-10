# VS Code Local Handling Model and Limits

## Managed scope

Detector scans run locally by default. Local components process raw input, then managed context paths apply accepted exclusions and redact recognized sensitive values. Unmarked private information can remain. This is a handling model, not proof of complete confidentiality.

Other extensions and native processes can use original files, Git/history, buffers, clipboard and independent network paths. Selected-architecture G1–G6 remain **UNTESTED** and the full claim stays **BLOCKED**. The planned separate-account architecture remains deployment **DEFERRED**.

## Values local components may process

- API keys
- Tokens
- Passwords
- Database URLs
- Private keys
- Raw `.env` values
- PII and India PII
- Secret reference values

## What May Be Stored Locally

- Opaque secret references
- Secret type and sensitivity
- Source label
- TTL and revocation state
- Allowed broker operations
- Hashes
- Redacted evidence previews
- User decisions

## Automatic SoterAI cloud scanning in local mode

Automatic SoterAI cloud scanning is disabled in local privacy mode. This applies to that feature, not provider routing, explicitly submitted cloud actions, advisory lookups or another tool's network permissions. No OS allowlist is provided by this setting.

The disabled automatic scan path does not receive:

- Raw secrets
- Raw prompts
- Raw files
- Raw `.env` values
- Private keys
- Full database URLs
- PII values

## Product Behavior

SoterAI-built context replaces recognized values with redactions or scoped refs such as `[SECRET_REF:api_key:<id>]`, and applies accepted protected-source rules. Review unknown private text before sharing. A generated preview does not observe what a third-party client or model actually receives.

Users can open `SoterAI: What Stays Local?` inside VS Code to see this privacy model in-product. Users can also open `SoterAI: Preview Managed AI Context` before sending context to AI.

Users can run `SoterAI: Build Safe Prompt for AI` to copy a local candidate prompt with recognized-value redaction and allowed broker operations. The dashboard links to that workflow, a handling status report and a synthetic in-process demo. The demo uses simulated transport; passing it does not verify real agents, user presence, independent custody or egress.

## Reveal Once

Raw reveal is disabled by default. If a user or admin enables it, reveal requires an explicit warning and typed confirmation. Enterprise policy can disable reveal entirely.

Ordinary editor confirmation is **not agent-proof** against same-user code. Local ciphertext, credential APIs, signing-less policy and editor state are not independent authority boundaries. Turning off `hardening.coverageDisclosure` withdraws new managed setup; it does not suppress these limitations.

Sources: [managed redactor](../packages/vscode-extension/src/secret-broker/SensitiveContextRedactor.ts), [prompt and synthetic demo](../packages/vscode-extension/src/secret-broker/commands.ts), [scope disclosure](../packages/vscode-extension/src/security/CoverageDisclosure.ts), [original threat model](secretguard/guarantee-program-2026-10-09/phase0/guarantee-spec.md). Source review date: 2026-10-10; no new confidentiality measurement is asserted here.
