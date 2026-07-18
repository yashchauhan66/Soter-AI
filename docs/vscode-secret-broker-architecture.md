# VS Code Secret Broker Architecture

SoterAI now includes a Sensitive Capability Broker / Secret Reference Broker for VS Code.

## Core Modules

- `SecretClassifier` detects API keys, JWTs, database URLs, private keys, OAuth/cloud/GitHub/npm tokens, SSH keys, webhook URLs, passwords, `.env` values, config secrets, and India PII such as Aadhaar, PAN, and Indian phone numbers.
- `SecretReferenceManager` creates opaque `soterai://secret/<type>/<id>` references. References are random, workspace-scoped, operation-scoped, TTL-bound, revocable, and optionally one-time.
- `SensitiveContextRedactor` replaces sensitive values with either secret refs or PII redactions while preserving key names and surrounding structure.
- `CapabilityBroker` executes approved safe local operations against refs, returning only sanitized metadata/results.
- `SensitiveContextPolicyEngine` parses `.soterai-policy.json` style controls with conservative fallback defaults and enterprise lock handling.
- `buildSafeLLMContext` emits the LLM contract and redacted context without raw secret values.
- `OutputFilter` blocks model responses that ask for secrets or recommend unsafe commands, and redacts secret-like model output.
- `SecretStorageValueStore` provides a VS Code SecretStorage-backed value store adapter. The default test/runtime singleton uses memory, while extension credential patterns remain SecretStorage-compatible.

## Trust UX Layer

- `SoterAI: Build Safe Prompt for AI` turns selected sensitive context into a safe prompt with the LLM contract, redacted context, allowed broker operations, forbidden operations, and privacy proof.
- `SoterAI: Run Secret Broker Demo` uses fake secrets to show detection, reference creation, and sanitized broker output.
- `SoterAI: Local Privacy Status` reports local mode, telemetry, raw reveal, raw prompt audit, active refs, and ledger count without including raw content.
- The dashboard includes a Local Secret Privacy card so these controls are visible without command-palette hunting.

## Security Contract

Raw secret values are not embedded in refs, serialized metadata, preview webviews, ledger entries, telemetry, or broker responses. The ledger receives only hashes, event type, verdict, categories, and redacted evidence. Reveal-once is disabled by default and denied when policy or enterprise lock disallows it.

## UX Flow

When sensitive text is selected, `SoterAI: Use Sensitive Context Safely` offers:

- Use safely without revealing
- Send redacted version
- Block
- Explain risk
- Reveal once, dangerous

`SoterAI: Preview What AI Will See` shows raw-secret status, secret refs, allowed operations, blocked content, policy reason, and the exact redacted prompt.

## Brokered Operations

Implemented safe operations include metadata inspection, token/API-key format validation, URL scheme checks, JWT expiry checks without payload return, `.env.example` generation, env-key comparison, and a no-network database connection diagnostic result in local mode. Denied operations include reveal, print, send-to-LLM, arbitrary shell, and exfiltration.
