# Credential Broker

Date: 2026-07-22

## Implemented boundary

The local broker and existing capability code support the core credential invariant: the AI receives a scoped capability or redacted response, not the raw credential value.

Evidence:

- `packages/vscode-extension/src/secret-broker/*`
- `packages/guard-core/src/ApprovalToken.ts`
- `packages/guard-core/src/MCPCredentialBoundary.ts`
- `apps/local-ai-broker/src/BrokerServer.ts`
- Tests: `packages/vscode-extension/src/__tests__/enforced-capability.test.ts`, `packages/guard-core/src/__tests__/approval.test.ts`, `packages/guard-core/src/__tests__/coverage-mcp-boundary.test.ts`

Coverage: `STRONG_ENFORCEMENT` for brokered credential routes only.

## Required behavior

- Credentials are never displayed in model context.
- Capability grants bind to session, content hash, destination, action, expiry, and use count where supported.
- Broker failure must not expose the raw secret.
- Rotation, revocation, and emergency lockdown are auditable.

## Remaining gaps

- Raw CLI credentials such as `gh`, `aws`, `gcloud`, `kubectl`, Docker, SSH agent, and browser OAuth sessions remain outside SoterAI unless routed through a future credential-specific broker.
- SoterAI cannot revoke credentials it does not own.
- Other extensions and OS processes can still use credentials already present in plaintext files or ambient sessions.
