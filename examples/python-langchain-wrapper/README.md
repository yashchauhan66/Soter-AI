# LangChain wrapper example (CyberRakshak Guard)

Guard a LangChain-style chain on both the input and output side with the
`cyberrakshak-guard` Python SDK.

## Run

```bash
cp .env.example .env
export $(grep -v '^#' .env | xargs)
pip install cyberrakshak-guard
python chain.py
```

## Two patterns

- `GuardedLLMWrapper(llm, guard)` — wraps any `(prompt) -> str` callable
  (including a LangChain LLM's `.invoke`) and guards input + output.
- `guard_langchain_input` / `guard_langchain_output` — guard manually around
  your existing chain steps.

For monitoring-only (no blocking), use `CyberRakshakCallbackHandler` and pass it
in your LangChain `callbacks=[...]`.

## Security notes

- API key from the environment, server-side only.
- Guard both directions. This reduces risk; it does not guarantee complete
  protection.
