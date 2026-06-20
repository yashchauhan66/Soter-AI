"""Flask chatbot protected by Soter.

Run:
    export SOTER_API_KEY=ck_...
    export SOTER_BASE_URL=http://localhost:3000
    flask --app flask_chatbot run

Then:
    curl -X POST localhost:5000/chat -H 'content-type: application/json' \\
         -d '{"message": "What is the weather today?"}'
"""

from __future__ import annotations

from flask import Flask, jsonify, request

from soter import Soter

app = Flask(__name__)
guard = Soter()  # reads SOTER_API_KEY / SOTER_BASE_URL


def my_llm_call(safe_message: str) -> str:
    return f"Safe demo response for: {safe_message}"


@app.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    result = guard.protect_chat(
        message=data.get("message", ""),
        call_llm=my_llm_call,
        user_id=data.get("userId"),
        session_id=data.get("sessionId"),
    )
    return jsonify(result.to_dict())


if __name__ == "__main__":
    app.run(port=5000)
