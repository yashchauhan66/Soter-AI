# Python Integration

Soter provides a Python client for protecting AI chatbots, agents, RAG systems, and LLM applications.
It is OWASP LLM Top 10 aligned and built for defense-in-depth: **detect,
block, redact, monitor, and report**. It does not guarantee complete protection.

## Install

```bash
pip install soter
# optional extras
pip install "soter[fastapi]"
pip install "soter[async]"
```

> Note: The Python import is `from soter import Soter`.

The sync client depends on `requests`; the async client (`soter[async]`) uses
`httpx`.

## Environment

```bash
SOTER_API_KEY=ck_live_your_key_here     # server-side only
SOTER_PROJECT_ID=                        # optional
# SOTER_BASE_URL is optional — the SDK includes a default
```

## Basic usage

```python
from soter import Soter

# Reads SOTER_API_KEY / SOTER_BASE_URL from environment
guard = Soter()

input_result = guard.input(user_message)
if not guard.should_call_llm(input_result):
    reply = "This request was blocked for safety."
else:
    safe_message = guard.get_safe_input(input_result, user_message)
    llm_reply = call_llm(safe_message)
    output_result = guard.output(llm_reply)
    reply = guard.get_safe_output(output_result, llm_reply)
```

Or the one-call helper:

```python
result = guard.protect_chat(message=user_message, call_llm=call_llm)
# {"allowed": bool, "safe_response": str, "input_guard": GuardResult, ...}
```


`GuardResult` attributes use snake_case (`allowed`, `action`, `risk_score`).

## FastAPI usage

```python
from fastapi import FastAPI
from pydantic import BaseModel
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY from environment

# create_chat_route returns a route handler that guards input + output
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm),
    methods=["POST"],
)
```


## LangChain usage

```python
from soter import Soter
from soter.langchain import protect_langchain_chain

guard = Soter()
safe_chain = protect_langchain_chain(my_chain.invoke, guard)
result = safe_chain.invoke({"input": prompt})
# {"safe_response": str, "blocked": bool, ...}
```


## RAG usage

Guard both the user query (input) and the LLM response (output) in a RAG pipeline:

```python
from soter import Soter

guard = Soter()

result = guard.protect_rag(
    query=user_query,
    retrieve=vector_store.similarity_search,
    call_llm=lambda ctx: rag_chain.invoke({"query": ctx["safeQuery"], "context": ctx["safeContext"]}),
)
if not result.allowed:
    return {"reply": result.safe_response, "blocked": True}
return {"reply": result.safe_response, "sources": result.used_sources}
```


## Error handling

```python
from soter import SoterError, SoterAuthError, SoterRateLimitError

try:
    guard.input(text)
except SoterRateLimitError as exc:
    retry_after = exc.retry_after
except SoterAuthError:
    ...  # 401/403
except SoterError:
    ...  # catch all SDK errors
```


Set `max_retries=2` to auto-retry transient 5xx/network failures with backoff.

## Security notes

- Read the API key from the environment. Keep it **server-side** only.
- The API key and raw prompt text are never logged (even with `debug=True`).
- Error messages never contain the API key.
- Always run the **output** guard, not just the input guard.
- This reduces risk; it does not guarantee complete protection.
