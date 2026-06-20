import os

from fastapi import FastAPI
from pydantic import BaseModel

from soter import Soter

app = FastAPI()
guard = Soter(
    api_key=os.environ.get("SOTER_API_KEY") or os.environ.get("CYBERRAKSHAK_API_KEY"),
    base_url=os.environ.get("SOTER_BASE_URL") or os.environ.get("CYBERRAKSHAK_BASE_URL"),
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
