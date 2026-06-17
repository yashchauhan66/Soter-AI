# FastAPI Integration Guide

Integrate CyberRakshak Guard directly into your FastAPI application using our built-in route wrapper.

## Installation

```bash
pip install "cyberrakshak-guard[fastapi]"
```

## Quickstart

Configure your credentials:
```bash
export CYBERRAKSHAK_API_KEY="your-project-api-key"
export CYBERRAKSHAK_BASE_URL="http://localhost:3000"
```

Use `create_chat_route` to register a guarded chat handler:

```python
import os
from fastapi import FastAPI
from pydantic import BaseModel
from cyberrakshak_guard import CyberRakshakGuard
from cyberrakshak_guard.fastapi import create_chat_route

app = FastAPI()
guard = CyberRakshakGuard()

# Stand-in for your LLM call (e.g., OpenAI, Anthropic, Gemini, etc.)
def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

# Mount the guarded chat route
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"]
)
```

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
