# VS Code Local Secret Privacy Proof

## User Promise

SoterAI does not receive or store raw user secrets by default. Sensitive values stay on the user's machine inside VS Code, local memory, VS Code SecretStorage, or user-approved local storage.

## What Stays Local

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

## What SoterAI Does Not Receive By Default

- Raw secrets
- Raw prompts
- Raw files
- Raw `.env` values
- Private keys
- Full database URLs
- PII values

## Product Behavior

Before AI sees sensitive context, SoterAI replaces raw values with redactions or scoped refs such as `[SECRET_REF:api_key:<id>]`. The model receives useful structure, not the secret value.

Users can open `SoterAI: What Stays Local?` inside VS Code to see this privacy model in-product. Users can also open `SoterAI: Preview What AI Will See` before sending context to AI.

Users can run `SoterAI: Build Safe Prompt for AI` to copy an AI-ready prompt that contains redacted context and allowed broker operations instead of raw sensitive values. The dashboard Local Secret Privacy card provides direct access to this flow, the local privacy status page, and a fake-secret broker demo.

## Reveal Once

Raw reveal is disabled by default. If a user or admin enables it, reveal requires an explicit warning and typed confirmation. Enterprise policy can disable reveal entirely.
