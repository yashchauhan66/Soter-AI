"""LangChain-style guarded chain example using cyberrakshak-guard.

This example does not require LangChain to be installed: GuardedLLMWrapper wraps
any callable `(prompt) -> str`, which is the same shape as a LangChain LLM's
`invoke`. If you use a real LangChain LLM, pass its `.invoke` as the callable.

Run:
    pip install cyberrakshak-guard
    export $(grep -v '^#' .env | xargs)
    python chain.py
"""
import os

from cyberrakshak_guard import CyberRakshakClient
from cyberrakshak_guard.langchain import GuardedLLMWrapper, guard_langchain_input, guard_langchain_output

guard = CyberRakshakClient(
    api_key=os.environ["CYBERRAKSHAK_API_KEY"],
    base_url=os.environ.get("CYBERRAKSHAK_BASE_URL", "https://api.cyberrakshak.dev"),
    project_id=os.environ.get("CYBERRAKSHAK_PROJECT_ID"),
    timeout=5,
)


def my_llm(prompt: str) -> str:
    # Replace with a real LangChain LLM's `.invoke`, e.g.:
    #   from langchain_openai import ChatOpenAI
    #   llm = ChatOpenAI()
    #   return llm.invoke(prompt).content
    return f"Echo: {prompt}"


# Option A: wrap the whole chain. Input and output are both guarded.
guarded = GuardedLLMWrapper(my_llm, guard)


# Option B: guard manually around your existing chain.
def manual_chain(user_message: str) -> str:
    from cyberrakshak_guard.langchain import GuardBlocked

    try:
        safe_input = guard_langchain_input(guard, user_message)
    except GuardBlocked as blocked:
        return str(blocked)
    completion = my_llm(safe_input)
    return guard_langchain_output(guard, completion)


if __name__ == "__main__":
    print("Wrapper:", guarded.invoke("Hello there"))
    print("Manual :", manual_chain("Hello there"))
