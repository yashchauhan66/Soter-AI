"""FastAPI chatbot example guarded by cyberrakshak-guard.

Run:
    pip install fastapi uvicorn cyberrakshak-guard
    uvicorn app:app --reload --port 8000

The API key is read from the environment server-side and never returned to the
client. The browser POSTs {"message": "..."} and receives {"reply", "blocked"}.
"""
import os

from fastapi import FastAPI
from pydantic import BaseModel

from cyberrakshak_guard import CyberRakshakClient

app = FastAPI(title="CyberRakshak guarded chatbot")

guard = CyberRakshakClient(
    api_key=os.environ["CYBERRAKSHAK_API_KEY"],
    base_url=os.environ.get("CYBERRAKSHAK_BASE_URL", "https://api.cyberrakshak.dev"),
    project_id=os.environ.get("CYBERRAKSHAK_PROJECT_ID"),
    timeout=5,
)


class ChatRequest(BaseModel):
    message: str


def call_llm(prompt: str) -> str:
    # Replace with your real LLM call.
    return f"You said: {prompt}"


@app.post("/chat")
def chat(req: ChatRequest):
    # guard_conversation runs input guard -> LLM -> output guard.
    result = guard.guard_conversation(req.message, call_llm)
    return {"reply": result["reply"], "blocked": result["blocked"]}
