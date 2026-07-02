# AI Data Security Privacy Model

Soter's enterprise AI controls are designed around data minimization.

## Default Protections

- No raw prompts stored by default.
- No raw source documents stored in the fingerprint vault.
- No raw file content sent to the backend by default.
- No raw clipboard text stored in lineage events.
- Source URLs should be hashed or redacted.
- Fingerprint bundles are organization-scoped.
- Extension APIs require device token/API key authentication.

## Monitoring Boundaries

Soter monitors configured AI destinations and configured enterprise source apps. It must not monitor unrelated personal browsing. Personal domains should remain excluded unless an admin explicitly configures a business reason and receives appropriate employee notice.

## Employee Notice

Employee notice should explain:

- Which AI destinations are monitored.
- Which enterprise source apps are configured.
- What metadata is logged.
- That raw file content and raw clipboard content are not stored by default.
- How approval, justification, redaction, and block actions work.

## Limitations

Semantic fingerprinting and rich PDF/Office parsing are planned but not implemented in this slice.
