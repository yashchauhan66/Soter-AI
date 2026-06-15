# FastAPI chatbot example (CyberRakshak Guard)

FastAPI server that guards a chatbot turn with the `cyberrakshak-guard` Python SDK.

## Run

```bash
cp .env.example .env   # then export the vars, or use a dotenv loader
export $(grep -v '^#' .env | xargs)
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Call it

```bash
curl -s localhost:8000/chat -H 'Content-Type: application/json' \
  -d '{"message":"hello"}'
```

The client receives `{ "reply", "blocked" }` — never the API key.

## Security notes

- API key read from the environment server-side only.
- `guard_conversation` runs the input guard, your LLM, and the output guard.
- This reduces risk; it does not guarantee complete protection.
