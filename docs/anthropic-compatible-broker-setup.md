# Anthropic-Compatible Broker Setup

## One-click

Use **SoterAI: Setup Broker Integration** when a config looks Anthropic-oriented; the adapter proposes:

```text
http://127.0.0.1:47321/v1/ai/anthropic-compatible
```

Review → approve → backup → apply. Restore with **SoterAI: Restore Broker Integration**. Setup is usability; STRONG only for brokered traffic.

## Manual

1. In a trusted workspace, run `SoterAI: Configure AI Broker`.
2. Set the upstream endpoint, usually `https://api.anthropic.com/v1/messages`, and store the provider key.
3. Start the broker and copy the Anthropic-compatible base URL:

```text
http://127.0.0.1:47321/v1/ai/anthropic-compatible
```

Requests go to `/v1/ai/anthropic-compatible/messages`. The broker scans top-level system text and message text blocks, applies policy/redaction, forwards with `x-api-key` and `anthropic-version`, scans returned text blocks, and withholds blocked output.

Streaming: SSE is scanned via the shared stream gate when `stream: true` is used. Non-text blocks are not fully treated as scanned text; tool schemas receive only text-bearing message context. Client tools must support a custom base URL and local bearer authentication.
