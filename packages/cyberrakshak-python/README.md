# cyberrakshak-guard (Python SDK)

Python client and helpers for **CyberRakshak Guard**, an OWASP LLM Top 10
aligned AI security gateway for chatbots, RAG apps, and AI agents.

CyberRakshak Guard reduces risk through **detect, block, redact, monitor, and
report**. It is defense-in-depth — it does **not** guarantee complete protection.

## Install

```bash
pip install cyberrakshak-guard
# optional extras:
pip install "cyberrakshak-guard[fastapi]"     # FastAPI helpers
pip install "cyberrakshak-guard[langchain]"   # LangChain helpers
```

The core client uses only the Python standard library (`urllib`). No third-party
HTTP dependency is required.

## Quick start

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
    safe_input = guard.get_safe_text(input_result, user_message)
    llm_reply = call_llm(safe_input)
    output_result = guard.guard_output(llm_reply)
    reply = guard.get_safe_text(output_result, llm_reply)
```

Or run the whole turn in one call:

```python
result = guard.guard_conversation(user_message, call_llm)
print(result["reply"], result["blocked"])
```

## Methods

| Method | Description |
| --- | --- |
| `guard_input(text, user_id=None, session_id=None, metadata=None)` | Run input guard. |
| `guard_output(text, user_id=None, session_id=None, metadata=None)` | Run output guard. |
| `analyze(text, direction="INPUT")` | Public analyzer (no API key). |
| `guard_conversation(input_text, call_llm, ...)` | Combined input → LLM → output. |
| `is_allowed(result)` / `should_block(result)` | Decision helpers. |
| `get_safe_text(result, fallback=None)` | Redacted/safe text or fallback. |

`GuardResult` exposes `allowed`, `action`, `decision` (normalized:
`ALLOW`/`REDACT`/`BLOCK`/`HUMAN_REVIEW`), `risk_score`, `risk_types`,
`findings`, `reason`, `safe_text`, `redacted_text`, and `raw`.

## FastAPI

```python
from cyberrakshak_guard import CyberRakshakClient
from cyberrakshak_guard.fastapi import guard_output_response

guard = CyberRakshakClient(api_key=os.environ["CYBERRAKSHAK_API_KEY"])
out = guard_output_response(guard, ai_response)  # -> {"blocked": bool, "reply": str}
```

## LangChain

```python
from cyberrakshak_guard.langchain import GuardedLLMWrapper

safe_llm = GuardedLLMWrapper(my_llm_callable, guard)
answer = safe_llm.invoke(prompt)   # guards prompt and completion
```

`CyberRakshakCallbackHandler` is an observability hook (monitor-only); use
`GuardedLLMWrapper` or `guard_langchain_input` to block.

## Security notes

- Read the API key from the environment. Keep it **server-side** only.
- The API key and raw prompt text are never logged (even with `debug=True`).
- Error messages never contain the API key.
- Always run the **output** guard, not just the input guard.

## Run tests

```bash
pip install pytest
python -m pytest packages/cyberrakshak-python/tests
```

## Disclaimer

CyberRakshak Guard reduces risk through pattern detection and policy
enforcement. It does not guarantee complete protection, replace secure
development practices, or represent OWASP certification. False positives and
false negatives are possible.
