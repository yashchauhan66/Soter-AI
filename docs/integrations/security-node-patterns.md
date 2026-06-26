# Security Node Patterns

Best practices for using Soter Guard nodes in AI workflow platforms.

## The Sandwich Pattern

Always guard **both** input and output:

```
User → [Input Guard] → LLM → [Output Guard] → User
```

Input-only guarding misses unsafe AI outputs (hallucinations, system prompt leaks).
Output-only guarding lets prompt injection reach the LLM unchecked.

## RAG Pipeline Security

```
[Documents] → [RAG Scanner] → [Vector DB]
                                    ↓
User Query → [Input Guard] → [RAG Retrieval] → [LLM] → [Output Guard] → Reply
```

Scan documents **at ingestion time** to prevent poisoned context.
Guard user queries at runtime to prevent injection via search.

## Policy Mode Selection

| Use Case | Mode | Rationale |
|----------|------|-----------|
| Development / testing | MONITOR | See threats without blocking |
| Customer chatbot | BALANCED | Block real threats, allow edge cases |
| Financial / healthcare | STRICT | Zero tolerance for risk |
| Internal tools | BALANCED | Good default |

## On Threat Strategy

| Strategy | When to Use |
|----------|-------------|
| BLOCK | User-facing chatbots, high-risk flows |
| REDACT | When partial content is acceptable |
| WARN | Development, monitoring, human-in-loop |
| CONTINUE | Logging-only / shadow mode |

## Error Handling

- **401/403** — API key is invalid or expired. Check credentials.
- **429** — Rate limit hit. Back off and retry.
- **5xx** — Soter API is temporarily unavailable. Use CONTINUE or cache.
- **Network error** — Cannot reach Soter. Decide: fail-open or fail-closed.

For production, always have a fallback strategy when the Soter API is unreachable.
