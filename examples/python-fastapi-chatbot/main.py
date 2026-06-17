import os

from fastapi import FastAPI
from pydantic import BaseModel

from cyberrakshak_guard import CyberRakshakGuard

app = FastAPI()
guard = CyberRakshakGuard(
    api_key=os.environ["CYBERRAKSHAK_API_KEY"],
    base_url=os.environ.get("CYBERRAKSHAK_BASE_URL", "https://api.cyberrakshak.com"),
)


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
def chat(request: ChatRequest):
    result = guard.protect_chat(
        message=request.message,
        call_llm=lambda safe_message: f"Safe demo response for: {safe_message}",
    )
    return result.to_dict()
