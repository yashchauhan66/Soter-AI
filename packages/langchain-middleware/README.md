# @soterai/langchain-middleware

LangChain integration for [Soter](https://soter.dev) — the AI safety layer.

Wrap any LangChain chain with `withSoterLangChain` to automatically guard both user input and model output against prompt injection, jailbreaks, PII leakage, and unsafe content.

## Install

```bash
npm install @soterai/langchain-middleware
```

Requires `@soterai/core` (peer dependency) and Node.js 18.18+.

## Usage

```ts
import { SoterClient } from "@soterai/core";
import { withSoterLangChain } from "@soterai/langchain-middleware";

// Create the Soter guard client (implements SoterGuardClient)
const guard = new SoterClient({
  apiKey: process.env.SOTER_API_KEY!,  // set SOTER_API_KEY in your .env
});

// Your existing LangChain chain
const chain = /* ... */;

// Wrap it with Soter
const protectedChain = withSoterLangChain(chain, guard);

// Use like a normal chain — Soter guards input + output automatically
const result = await protectedChain.invoke({ input: "Ignore previous instructions..." });
// → throws if blocked, or returns result with safe output
```

## How It Works

1. **Input guard** — `guard.guardInput({ message: input.input })` runs before your chain. If blocked, it throws an error.
2. **Chain runs** — only with the safe/redacted input text.
3. **Output guard** — `guard.guardOutput({ aiResponse: result.output })` runs after your chain. If blocked, it throws an error.
4. **Safe result** — the guarded output is returned.

## API

### `withSoterLangChain(chain, guard)`

| Param | Type | Description |
|-------|------|-------------|
| `chain` | `{ invoke(input: TInput): Promise<TOutput> }` | Any LangChain chain (`LLMChain`, `Chain`, etc.) with `invoke()` |
| `guard` | `SoterGuardClient` | A Soter client with `guardInput()` and `guardOutput()` methods |

Returns a wrapped chain with the same `invoke()` interface.

### `SoterGuardClient`

```ts
interface SoterGuardClient {
  guardInput(input: { message: string; metadata?: Record<string, unknown> }): Promise<GuardDecision>;
  guardOutput(input: { aiResponse: string; metadata?: Record<string, unknown> }): Promise<GuardDecision>;
}
```

Where `GuardDecision` contains:
- `action`: `"ALLOW"` | `"ALLOW_WITH_REDACTION"` | `"REWRITE"` | `"BLOCK"` | `"HUMAN_REVIEW"`
- `safeText?`: The safe/redacted text
- `redactedText?`: The redacted version (if applicable)
- `reason?`: Explanation of the decision

## TypeScript

```ts
import type { SoterGuardClient } from "@soterai/langchain-middleware";
```

## Backward Compatibility

`withCyberRakshakLangChain` is exported as an alias for existing integrations.

## Related Packages

| Package | Description |
|---------|-------------|
| `@soterai/core` | Core Soter client and agent firewall |
| `@soterai/llamaindex-middleware` | LlamaIndex integration |
| `@soterai/vercel-ai-sdk-middleware` | Vercel AI SDK integration |

## License

MIT
