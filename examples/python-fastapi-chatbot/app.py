"""FastAPI chatbot example guarded by Soter.

Run:
    pip install fastapi uvicorn cyberrakshak-guard
    uvicorn app:app --reload --port 8000

The API key is read from the environment server-side and never returned to the
client. The browser POSTs {"message": "..."} and receives {"reply", "blocked"}.
"""
import os

from fastapi import FastAPI
from pydantic import BaseModel

from soter import Soter

app = FastAPI(title="Soter guarded chatbot")

guard = Soter(
    api_key=os.environ.get("SOTER_API_KEY") or os.environ.get("CYBERRAKSHAK_API_KEY"),
    base_url=os.environ.get("SOTER_BASE_URL") or os.environ.get("CYBERRAKSHAK_BASE_URL"),
    project_id=os.environ.get("SOTER_PROJECT_ID") or os.environ.get("CYBERRAKSHAK_PROJECT_ID"),
    timeout=5,
)


class ChatRequest(BaseModel):
    message: str


def call_llm(prompt: str) -> str:
    # Replace with your real LLM call.
    return f"You said: {prompt}"


@app.post("/chat")
def chat(req: ChatRequest):
    # protect_chat runs input guard -> LLM -> output guard.
    result = guard.protect_chat(
        message=req.message,
        call_llm=call_llm,
    )
    return {"reply": result.safe_response, "blocked": result.blocked}
