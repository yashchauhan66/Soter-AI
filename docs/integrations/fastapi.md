# FastAPI Integration

Soter protects your FastAPI chatbot with input/output guarding in one route wrapper.

## Install

```bash
pip install "cyberrakshak-guard[fastapi]"
```

## Quickstart

Configure your credentials (server-side only):

```bash
export SOTER_API_KEY=ck_live_your_key_here
export SOTER_BASE_URL=https://your-soter-host.example
```

Use `create_chat_route` to register a guarded chat handler:

```python
from fastapi import FastAPI
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY / SOTER_BASE_URL from environment

# Stand-in for your LLM call (e.g., OpenAI, Anthropic, Gemini, etc.)
def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

# Mount the guarded chat route — input guard → LLM → output guard
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"],
)
```

> **Legacy imports:** `from cyberrakshak_guard import CyberRakshakGuard` and `from cyberrakshak_guard.fastapi import create_chat_route` also work.

## Payload Format

The mounted route expects a JSON POST body:

```json
{
  "message": "user message",
  "userId": "optional-user-id",
  "sessionId": "optional-session-id"
}
```

And returns the normalized protection response:

```json
{
  "allowed": true,
  "blocked": false,
  "inputAction": "ALLOW",
  "outputAction": "ALLOW",
  "llmCalled": true,
  "safeResponse": "Response to: user message",
  "latencyMs": 142
}
```

## Manual Guarding (Without `create_chat_route`)

For full control, guard input and output separately:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from soter import Soter

app = FastAPI()
guard = Soter()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    result = guard.protect_chat(
        message=req.message,
        call_llm=lambda safe_message: my_llm_call(safe_message),
    )
    return result.to_dict()
```

## Async Support

For `AsyncSoter` (requires `httpx`):

```bash
pip install "cyberrakshak-guard[async]"
```

```python
from soter import AsyncSoter  # lazy-loaded, requires httpx

guard = AsyncSoter()

@app.post("/chat")
async def chat(req: ChatRequest):
    result = await guard.protect_chat(
        message=req.message,
        call_llm=my_llm_call,
    )
    return result.to_dict()
```

## Error Handling

```python
from soter import SoterError, SoterAuthError, SoterRateLimitError

try:
    result = guard.protect_chat(message=msg, call_llm=my_llm)
except SoterRateLimitError as exc:
    print(f"Rate limited, retry after {exc.retry_after}s")
except SoterAuthError:
    print("Check your API key")
except SoterError:
    print("SDK error")
```

## Security Notes

- Read the API key from the environment. Keep it **server-side** only.
- The SDK never logs the API key or raw text.
- Always run the **output** guard (which `protect_chat` / `create_chat_route` does automatically).
- This reduces risk; it does not guarantee complete protection.
