# Python Integration

The `cyberrakshak-guard` package is a Python client for the CyberRakshak Guard
API. It is OWASP LLM Top 10 aligned and built for defense-in-depth: **detect,
block, redact, monitor, and report**. It does not guarantee complete protection.

## Install

```bash
pip install cyberrakshak-guard
# optional extras
pip install "cyberrakshak-guard[fastapi]"
pip install "cyberrakshak-guard[langchain]"
```

The core client uses only the standard library (`urllib`). No third-party HTTP
dependency is required.

## Environment

```bash
CYBERRAKSHAK_API_KEY=ck_live_your_key_here   # server-side only
CYBERRAKSHAK_BASE_URL=https://api.cyberrakshak.dev
CYBERRAKSHAK_PROJECT_ID=                      # optional
```

## Basic usage

```python
import os
from cyberrakshak_guard import CyberRakshakClient

guard = CyberRakshakClient(
    api_key=os.environ["CYBERRAKSHAK_API_KEY"],
    base_url=os.environ.get("CYBERRAKSHAK_BASE_URL", "https://api.cyberrakshak.dev"),
    project_id=os.environ.get("CYBERRAKSHAK_PROJECT_ID"),
    timeout=5,
)

input_result = guard.guard_input(user_message)
if guard.should_block(input_result):
    reply = "This request was blocked for safety."
else:
    llm_reply = call_llm(guard.get_safe_text(input_result, user_message))
    output_result = guard.guard_output(llm_reply)
    reply = guard.get_safe_text(output_result, llm_reply)
```

Or the one-call helper:

```python
result = guard.guard_conversation(user_message, call_llm)
# {"reply": str, "blocked": bool, "input_result": GuardResult, "output_result": GuardResult|None}
```

`GuardResult.decision` is normalized (`ALLOW`/`REDACT`/`BLOCK`/`HUMAN_REVIEW`);
`GuardResult.action` holds the raw API value, and `GuardResult.raw` the full
JSON.

## FastAPI usage

```python
from fastapi import FastAPI
from pydantic import BaseModel
from cyberrakshak_guard import CyberRakshakClient
from cyberrakshak_guard.fastapi import guard_output_response

app = FastAPI()
guard = CyberRakshakClient(api_key=os.environ["CYBERRAKSHAK_API_KEY"])

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    result = guard.guard_conversation(req.message, call_llm)
    return {"reply": result["reply"], "blocked": result["blocked"]}
```

`create_guard_dependency(client)` returns a FastAPI dependency that guards the
incoming body; `guard_output_response(client, text)` guards an outgoing reply.

## LangChain usage

```python
from cyberrakshak_guard.langchain import GuardedLLMWrapper

# Wrap any callable (prompt) -> str, including a LangChain LLM's `.invoke`.
safe_llm = GuardedLLMWrapper(my_llm.invoke, guard)
answer = safe_llm.invoke(prompt)   # guards prompt and completion
```

Manual guarding around an existing chain:

```python
from cyberrakshak_guard.langchain import (
    guard_langchain_input, guard_langchain_output, GuardBlocked,
)

try:
    safe_input = guard_langchain_input(guard, prompt)
except GuardBlocked as blocked:
    return str(blocked)
completion = my_chain.invoke(safe_input)
final = guard_langchain_output(guard, completion)
```

Monitoring-only callback (no blocking):

```python
from cyberrakshak_guard.langchain import CyberRakshakCallbackHandler

handler = CyberRakshakCallbackHandler(guard, on_finding=lambda r: log(r.risk_types))
llm.invoke(prompt, config={"callbacks": [handler]})
```

## RAG usage

Guard both the retrieved-context-grounded answer (output) and the user query
(input). For source-grounding verification specifically, the app exposes
`POST /api/guard/grounding`, which uses session/project auth rather than an API
key (see the API contract doc). For the standard input/output guards in a RAG
pipeline:

```python
q = guard.guard_input(user_query)
if guard.should_block(q):
    return "Blocked for safety."
answer = rag_chain.invoke(guard.get_safe_text(q, user_query))
out = guard.guard_output(answer)
return guard.get_safe_text(out, answer)
```

## Error handling

```python
from cyberrakshak_guard import (
    CyberRakshakAuthError, CyberRakshakRateLimitError,
    CyberRakshakValidationError, CyberRakshakNetworkError, CyberRakshakError,
)

try:
    guard.guard_input(text)
except CyberRakshakRateLimitError as exc:
    retry_after = exc.retry_after
except CyberRakshakAuthError:
    ...  # 401/403
```

Set `retries=2` to auto-retry transient 5xx/network failures with backoff.

## Security notes

- Read the API key from the environment. Keep it **server-side** only.
- The API key and raw prompt text are never logged (even with `debug=True`).
- Error messages never contain the API key.
- Always run the **output** guard, not just the input guard.
- This reduces risk; it does not guarantee complete protection.
