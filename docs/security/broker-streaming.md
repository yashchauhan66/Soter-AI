# Broker streaming security (Phase 6)

Date: 2026-07-23  
Protection level: **STRONG_ENFORCEMENT** (only for `stream: true` traffic routed through the local loopback broker)

## Runtime path

- `apps/local-ai-broker/src/BrokerServer.ts`
  - `proxyOpenAI` / `proxyAnthropic` branch on `body.stream === true`
  - `proxyStreaming(kind, …)`
  - `extractStreamDelta(ssePart)` (exported for unit tests)

## Behavior

1. Authenticated request is scanned with `scanBrokerRequest` before any provider call.
2. Upstream is requested with `stream: true` and `Accept: text/event-stream`.
3. Client response headers include `content-type: text/event-stream`, `x-soterai-streaming: 1`.
4. SSE frames are split on `\n\n`. For each complete event:
   - Extract assistant-visible deltas (OpenAI `choices[].delta.content`, tool-call `function.arguments`, Anthropic `content_block_delta`).
   - Append to an accumulated buffer.
   - **Scan before forward**: `scanBrokerResponse` + `findSurvivingSecrets`.
   - Block if decision is `block`, canary leaked, or any high-risk secret pattern still present (secrets often score `warn` in the base scanner; streaming still refuses to forward raw credentials).
   - Only then `res.write(part)`.
5. On block: write a terminal SSE error (`unsafe_provider_response` / Stream aborted) + `data: [DONE]`, cancel upstream reader. Do **not** call `setHeader` after body bytes have been written.

## Evidence

- `apps/local-ai-broker/src/__tests__/broker.test.ts` — suite **Phase 6 streaming proxy**
  - extractStreamDelta OpenAI / tool-call / Anthropic
  - safe SSE forward
  - canary split across events → abort, full token never in body
  - tool-call argument secret → abort, raw secret not in body
  - blocked request never starts provider stream

Commands:

```bash
npm --prefix apps/local-ai-broker run test
```

Result (2026-07-23): **30/30 pass**, including 5 Phase 6 tests.

## Residual risks / bypasses

| Risk | Level |
| --- | --- |
| Partial **safe** tokens already flushed before a later block cannot be recalled | Honest residual |
| Non-broker clients / direct provider calls | UNSUPPORTED |
| Binary / non-SSE streams | UNSUPPORTED |
| Provider that embeds secrets only in non-text frames not extracted by `extractStreamDelta` | Residual |

## Marketplace claim language

Supported: “Local AI Broker supports OpenAI-compatible SSE streaming with scan-before-forward secret/canary protection for routed traffic.”

Not supported: “All AI streaming is protected” / “Zero residual leak risk on streams.”
