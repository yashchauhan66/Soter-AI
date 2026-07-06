# Anthropic-Compatible Broker Setup

The MVP implements a non-streaming Anthropic-compatible messages route.

1. In a trusted workspace, run `SoterAI: Configure AI Broker`.
2. Set the upstream endpoint, usually `https://api.anthropic.com/v1/messages`, and store the provider key.
3. Start the broker and copy the Anthropic-compatible base URL:

```text
http://127.0.0.1:47321/v1/ai/anthropic-compatible
```

Requests go to `/v1/ai/anthropic-compatible/messages`. The broker scans the top-level system text and message text blocks, applies policy/redaction, forwards with `x-api-key` and `anthropic-version`, scans returned text blocks, and withholds blocked output.

Current limitations: streaming is rejected; non-text blocks are not forwarded as scanned text; tool schemas receive only their text-bearing message context; client tools must support both a custom base URL and local bearer authentication. These constraints are documented rather than hidden behind a compatibility claim.
