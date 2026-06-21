# @soterai/llamaindex-middleware

LlamaIndex integration for [Soter](https://soter.dev) — the AI safety layer.

Wrap any LlamaIndex query engine with `createSoterQueryWrapper` to automatically guard user queries against prompt injection, jailbreaks, and other AI safety risks before they reach your index.

## Install

```bash
npm install @soterai/llamaindex-middleware
```

Requires `@soterai/core` (peer dependency) and Node.js 18.18+.

## Usage

```ts
import { SoterClient } from "@soterai/core";
import { createSoterQueryWrapper } from "@soterai/llamaindex-middleware";

// Create the Soter guard client
const guard = new SoterClient({
  apiKey: process.env.SOTER_API_KEY!,
});

// Your existing LlamaIndex query engine
const queryEngine = /* ... */;

// Wrap it with Soter
const protectedEngine = createSoterQueryWrapper(queryEngine, guard);

// Use like a normal query engine — Soter guards every query
const result = await protectedEngine.query({ query: "What documents mention..." });
// → safe query is passed to your engine, or throws if blocked
```

## How It Works

1. **Input guard** — `guard.guardInput({ message: input.query })` runs before every query. If the action is `"BLOCK"`, it throws an error with the reason.
2. **Safe query** — Your query engine receives the safe or redacted query text.
3. **Result** — The query engine response is returned as-is (output guard can be added separately if needed).

## API

### `createSoterQueryWrapper(queryEngine, guard)`

| Param | Type | Description |
|-------|------|-------------|
| `queryEngine` | `{ query(input: { query: string }): Promise<TResponse> }` | Any LlamaIndex query engine with `query()` method |
| `guard` | `{ guardInput(input: { message: string }): Promise<GuardDecision> }` | A Soter client with `guardInput()` method |

Returns a wrapped query engine with the same `query()` interface.

Where `GuardDecision` contains:
- `action`: `"ALLOW"` | `"ALLOW_WITH_REDACTION"` | `"REWRITE"` | `"BLOCK"` | `"HUMAN_REVIEW"`
- `safeText?`: The safe/redacted text
- `redactedText?`: The redacted version (if applicable)
- `reason?`: Explanation of the decision

## TypeScript

```ts
// Generic type for typed responses
const protectedEngine = createSoterQueryWrapper<{ text: string }>(engine, guard);
```

## Backward Compatibility

`createCyberRakshakQueryWrapper` is exported as an alias for existing integrations.

## Related Packages

| Package | Description |
|---------|-------------|
| `@soterai/core` | Core Soter client and agent firewall |
| `@soterai/langchain-middleware` | LangChain integration |
| `@soterai/vercel-ai-sdk-middleware` | Vercel AI SDK integration |

## License

MIT
