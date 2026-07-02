# Soter Local Agent and Proxy architecture

## Scope and trust boundary

The Local Agent protects explicitly configured local-LLM and workflow traffic that a browser extension cannot see. It is a transparent defensive service, installed with user or enterprise administrator consent. It does not hide itself, modify unrelated applications, bypass operating-system controls, or use malware-like persistence.

```text
IDE / CLI / desktop app / n8n
            |
            v
http://127.0.0.1:17321/{provider}/{path}
            |
            v
Soter request scan -> destination policy -> allow/redact/rewrite/block/approval
            |
            v
Ollama :11434 / LM Studio :1234 / configured OpenAI-compatible server
            |
            v
Soter response scan -> application
```

Example: `POST http://localhost:17321/ollama/api/generate` forwards, after policy enforcement, to `http://localhost:11434/api/generate`. Provider targets are selected from the signed organization destination bundle, never from an unrestricted request parameter, preventing the proxy from becoming an SSRF relay.

## Components

- **Loopback proxy:** binds to loopback by default, accepts only supported LLM paths, limits request sizes, streaming duration, and concurrency, and exposes `/healthz` and `/readyz`.
- **Request/response codecs:** understand Ollama, OpenAI-compatible chat/completions, LM Studio, and selected n8n payload shapes. Unknown bodies fail closed or pass only under an explicit monitor-only rule.
- **Policy engine:** uses the same action precedence as the browser extension: `block > require_approval > require_justification > rewrite > redact > warn > log_only > allow`.
- **Policy cache:** atomically stores the last verified, signed policy bundle with version, organization, expiry, and signature. Offline behavior is configured as fail-closed, cached enforcement, or monitor-only. Raw prompts and secrets are not placed in this cache.
- **Audit spool:** stores bounded metadata-only events while offline and retries with backoff. Raw secrets are excluded by default; redacted content is stored only when the destination logging mode explicitly permits it.
- **Device identity:** a rotatable device token identifies organization, employee/device, component type, and platform. Tokens are kept in Keychain, Windows Credential Manager/DPAPI, or Secret Service, not in plaintext config.
- **Status surface:** tray/CLI status shows listening address, policy version and age, backend reachability, active destination, recent decisions, and how to stop or uninstall the service.

## API contract

The existing control-plane endpoints are the initial contract:

- `GET /api/agent/policy`
- `POST /api/agent/scan`
- `POST /api/agent/heartbeat`
- `POST /api/agent/audit-log`

The agent sends `x-soter-device-token`. Heartbeats upsert the `DeviceAgent` record and report version, platform, policy version, status, and the active destination. Scan calls are authorized only when their URL matches an enabled destination and the employee department/role scope.

## Delivery phases

1. TypeScript/Rust loopback proxy proof of concept for non-streaming Ollama and OpenAI-compatible requests.
2. Streaming request and response transforms, bounded audit spool, cryptographically verified policy cache, and approval polling.
3. Signed Windows/macOS packages and Linux packages with explicit OS service registration and clean uninstall.
4. n8n credential/node integration, CLI wrapper, device posture reporting, and enterprise MDM deployment guides.
5. Adversarial review for SSRF, request smuggling, loop detection, decompression bombs, policy rollback, token theft, log leakage, and local privilege boundaries.

## Operational rules

- The agent never listens on LAN interfaces unless an administrator deliberately enables and secures that mode.
- A destination allowlist fixes scheme, host, port, and path prefix. Redirects to an unlisted target are rejected.
- Health responses contain no token, raw prompt, or sensitive finding match.
- Policy/cache and audit files are owner-only and bounded. Uninstall removes the service and local cache through normal OS mechanisms.
- Applications must opt into the protected endpoint or use an official Soter wrapper/plugin. Soter does not claim to intercept arbitrary native traffic invisibly.
