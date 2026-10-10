# Broker Limitations

- SoterAI can inspect and enforce AI traffic routed through the Local AI Broker.
- SoterAI cannot guarantee inspection of AI traffic that bypasses the broker.
- A VS Code extension cannot fully block every other extension from reading ordinary workspace files or making its own network calls.
- The Memory Inspector proves only what SoterAI built, scanned, blocked, or brokered. It cannot prove what an unsupported third-party extension read internally.
- The configured broker supports named OpenAI/Anthropic-compatible routes and SSE handling. Supported response checks apply to traffic using those routes; arbitrary generic HTTP/process proxying is not provided. Already emitted bytes cannot be recalled, and a route smoke check does not verify third-party client content or compatibility.
- Rich multimodal payloads and every provider-specific extension are not fully normalized. Text is the enforced MVP surface.
- The broker event/memory/approval stores are bounded and process-local. Durable encrypted broker history is not implemented.
- Provider API use is still external egress unless the upstream is a local model. SoterAI Cloud is disabled/not connected in the broker prompt path.
- Loopback is not a security boundary by itself. SoterAI therefore requires a local bearer token, but malware running as the same user may still attack local credentials.

For stronger protection, combine Protected Vault, Safe Context Builder, Local AI Broker, canaries, least-privilege MCP policy, and enterprise policy controls. Future CLI wrappers, desktop controls, and OS-level enforcement can cover more workflows.

SoterAI does not claim “100% secure.”

Selected-architecture **G1–G6 remain UNTESTED; full claim BLOCKED**. A healthy
authenticated broker is an operational component, not mandatory mediation over
all agents. Separate-account deployment remains **DEFERRED**.
