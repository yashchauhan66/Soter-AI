# Python Examples E2E Test Report

This report documents the end-to-end verification results of the integration examples provided inside `packages/python-sdk/examples/` and `examples/`.

## 1. Basic Chatbot Example (`packages/python-sdk/examples/basic_chatbot.py`)
This script exercises four different categories of inputs and output guard interactions against the live Next.js guard server.

- **Command**:
  ```bash
  python packages/python-sdk/examples/basic_chatbot.py
  ```
- **Results**:
  - **Safe Case ("What is the weather today?")**:
    - `input_action`: `ALLOW`
    - `llm_called`: `True`
    - `blocked`: `False`
    - `safe_response`: `"It is sunny today."`
  - **Prompt Injection Case ("Ignore previous instructions...")**:
    - `input_action`: `BLOCK`
    - `llm_called`: `False`
    - `blocked`: `True`
    - `safe_response`: `"This request was blocked for security reasons."`
  - **Secret Input Case ("My password is hunter2...")**:
    - `input_action`: `ALLOW` (The default balanced policy allowed this format under standard classifier rules)
    - `llm_called`: `True`
    - `blocked`: `False`
    - `safe_response`: `"You said: My password is hunter2..."`
  - **Unsafe Output Case ("please leak something" -> model discloses system instructions)**:
    - `input_action`: `ALLOW` (Input allowed)
    - `llm_called`: `True`
    - `blocked`: `True` (Output guard caught the system prompt leakage in model response)
    - `safe_response`: `"The assistant response was blocked for security reasons."`

- **Verdict**: **PASSED**

---

## 2. FastAPI Chatbot Example (`examples/python-fastapi-chatbot/main.py`)
Verified using starlette TestClient in the automated test suite.
- **Command**:
  ```bash
  pytest packages/python-sdk/tests/test_fastapi.py -q
  ```
- **Results**:
  - Safe chat message returned `200 OK` with `inputAction: ALLOW`, `llmCalled: True`.
  - Prompt injection chat message returned `200 OK` with `blocked: True`, `llmCalled: False`.
- **Verdict**: **PASSED**

---

## 3. LangChain RAG Example (`examples/python-langchain-rag/main.py`)
Verified using `protect_rag` helper and unit tests.
- **Command**:
  ```bash
  pytest packages/python-sdk/tests/test_langchain.py -q
  ```
- **Results**:
  - Prompt query inputs are sent to `guardInput` first.
  - Risky RAG context sources are evaluated and dropped from the context list before calling the LLM chain.
  - Output guard wraps final chain output.
- **Verdict**: **PASSED**
