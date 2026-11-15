import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Python SDK Guide: Protect Your AI Chatbot",
  description:
    "Install the Python SDK to check FastAPI, Flask, LangChain and LlamaIndex apps for prompt injection and PII leaks. Async support included.",
  alternates: { canonical: "/docs/python" },
  openGraph: {
    images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
    title: "SoterAI Python SDK Guide",
    description: "Protect your Python AI applications from prompt injection, PII leaks, and unsafe outputs with SoterAI.",
  },
};

const installCode = `# Python 3.9 or later; use pip for the interpreter running your app
python -m pip install soter

# Optional framework and async dependencies
python -m pip install "soter[fastapi]"
python -m pip install "soter[async]"`;
const basicCode = `from typing import Optional
from soter import Soter, GuardResult
from llm import call_llm  # Your application-owned function: str -> str

guard = Soter()  # Reads SOTER_API_KEY and optional SOTER_BASE_URL

def permitted_text(result: GuardResult, original: str) -> Optional[str]:
    # GuardResult coerces allowed/action; authorize the untouched wire values.
    raw = result.raw
    if not isinstance(raw, dict) or raw.get("allowed") is not True:
        return None
    action = raw.get("action")
    if not isinstance(action, str) or action not in ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"):
        return None
    replacement = result.safe_text
    if replacement is None:
        replacement = result.redacted_text
    if replacement is not None:
        return replacement if isinstance(replacement, str) and replacement.strip() else None
    return original if action == "ALLOW" else None

def handle_chat_message(user_message: str) -> dict:
    input_result = guard.input(user_message)
    safe_message = permitted_text(input_result, user_message)
    if safe_message is None:
        return {"reply": "Message withheld.", "blocked": True}

    llm_reply = call_llm(safe_message)
    output_result = guard.output(llm_reply)
    safe_reply = permitted_text(output_result, llm_reply)
    if safe_reply is None:
        return {"reply": "The model response was withheld.", "blocked": True}
    return {"reply": safe_reply, "blocked": False}
# Exceptions propagate. The complete handler below adds fail-closed handling.`;
const protectChatCode = `from soter import Soter, ProtectChatResult
from llm import call_llm

guard = Soter()

def handle_chat_message(user_message: str) -> dict:
    result: ProtectChatResult = guard.protect_chat(
        message=user_message,
        call_llm=call_llm,
    )
    return {"reply": result.safe_response, "blocked": result.blocked}

# result attributes use snake_case (safe_response, llm_called).
# result.to_dict() uses camelCase (safeResponse, llmCalled) for serialization.
# Catch SoterError at your route boundary; an exception is not an allowed turn.`;
const fullExampleCode = `from typing import Optional
from soter import Soter, SoterError, GuardResult
from llm import call_llm  # Supply your server-side provider adapter

guard = Soter(timeout=10, max_retries=2)

def permitted_text(result: GuardResult, original: str) -> Optional[str]:
    # GuardResult coerces allowed/action; authorize the untouched wire values.
    raw = result.raw
    if not isinstance(raw, dict) or raw.get("allowed") is not True:
        return None
    action = raw.get("action")
    if not isinstance(action, str) or action not in ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"):
        return None
    replacement = result.safe_text
    if replacement is None:
        replacement = result.redacted_text
    if replacement is not None:
        return replacement if isinstance(replacement, str) and replacement.strip() else None
    # Missing transformation text is not permission to forward the original.
    return original if action == "ALLOW" else None

def handle_chat_message(user_message: str, session_id: Optional[str] = None) -> dict:
    if not isinstance(user_message, str) or not user_message.strip():
        return {"reply": "A non-empty message is required.", "blocked": True}
    try:
        input_result = guard.input(user_message, session_id=session_id)
        safe_input = permitted_text(input_result, user_message)
        if safe_input is None:
            return {"reply": "Message withheld.", "blocked": True}

        llm_reply = call_llm(safe_input)
        output_result = guard.output(llm_reply, session_id=session_id)
        safe_reply = permitted_text(output_result, llm_reply)
        if safe_reply is None:
            return {"reply": "The model response was withheld.", "blocked": True}
        return {"reply": safe_reply, "blocked": False}
    except SoterError:
        # Do not log or return the raw upstream error, prompt or model output.
        return {"reply": "Guard unavailable. Please try again.", "blocked": True}
    except Exception:
        # Provider or application errors must not bypass either guard.
        return {"reply": "Service unavailable. Please try again.", "blocked": True}`;
const errorCode = `from soter import Soter, SoterError, SoterAuthError, SoterRateLimitError

guard = Soter()

def inspect_input(text: str):
    try:
        return guard.input(text)
    except SoterRateLimitError as exc:
        # retry_after is optional and measured in seconds. Schedule a bounded retry.
        print("Rate limited; retry delay:", exc.retry_after)
        raise
    except SoterAuthError as exc:
        # 403 can also represent disabled projects/orgs or governance restrictions.
        print("Access denied; status:", exc.status)
        raise
    except SoterError as exc:
        print("Guard request failed; code:", exc.code)
        raise  # Withhold the turn at the application boundary.`;

export default function PythonDocsPage() {
  return (
    <DocsPageShell path="/docs/python">

        <section className="docs-section">
          <DocsHeading>Step 1: Install the package</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use Python 3.9 or later. Install the package into the same interpreter environment as your application:
          </p>
          <CodeBlock language="bash" title="pip install">{installCode}</CodeBlock>
          <TipBox>
            The package name is <InlineCode>soter</InlineCode>.
            Import it with <InlineCode>from soter import Soter</InlineCode>. The async extra enables <InlineCode>from soter import AsyncSoter</InlineCode>; await its network methods and use <InlineCode>async with AsyncSoter()</InlineCode> to close an owned HTTP client.
          </TipBox>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 2: Configure environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Set these variables in the server process environment. A <InlineCode>.env</InlineCode> file must be loaded by your framework or environment loader; the SDK does not read that file automatically:
          </p>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_test_replace_with_your_issued_key
SOTER_BASE_URL=https://api.soterai.in      # optional: SDK default`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">Keep the key server-side. Constructor arguments override environment variables. Python does not read <InlineCode>SOTER_PROJECT_ID</InlineCode>; the issued API key determines the authorized project. Use <InlineCode>user_id</InlineCode>, <InlineCode>session_id</InlineCode> and bounded scalar <InlineCode>metadata</InlineCode> for request context, not authorization.</p>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 3: Basic usage</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Guard both directions and withhold <InlineCode>BLOCK</InlineCode> or <InlineCode>HUMAN_REVIEW</InlineCode> results. Supply an application-owned <InlineCode>llm.py</InlineCode> whose <InlineCode>call_llm</InlineCode> function accepts and returns a string; no provider integration is included in the SDK:
          </p>
          <CodeBlock language="python" title="basic input/output guard" showLineNumbers>{basicCode}</CodeBlock>
          
          <h3 className="mt-8 text-xl font-bold">One-call chat helper</h3>
          <p className="mt-3 leading-7 text-slate-200">
            Runs <strong>input guard → LLM call → output guard</strong> and returns a <InlineCode>ProtectChatResult</InlineCode> object, not a plain dictionary. Its attributes use snake_case; <InlineCode>to_dict()</InlineCode> serializes camelCase keys. Return only the fields your client needs:
          </p>
          <CodeBlock language="python" title="protect_chat">{protectChatCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200"><InlineCode>get_safe_input</InlineCode> and <InlineCode>get_safe_output</InlineCode> only select text; they do not check whether forwarding is allowed. The combined helper assumes a contract-conforming response. The explicit examples validate the untouched <InlineCode>GuardResult.raw</InlineCode> permission and action because the SDK coerces those attributes. They withhold a redaction or rewrite if replacement text is missing, non-string or blank.</p>
        </section>

        <section className="docs-section">
          <DocsHeading id="step-4-production-ready-example">Step 4: Complete example with error handling</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This synchronous server-side pattern fails closed on SDK, transport and provider errors. Reuse an application-controlled session ID across turns when conversation tracking is needed. Add your own authentication, rate limits and deployment tests:
          </p>
          <CodeBlock language="python" title="guarded chat handler" showLineNumbers>{fullExampleCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Framework integrations</DocsHeading>
          
          <h3 className="mt-8 text-xl font-bold">FastAPI</h3>
          <p className="mt-3 leading-7 text-slate-200">
            The <InlineCode>create_chat_route</InlineCode> factory creates a sync or async handler to match the client. It serializes <InlineCode>ProtectChatResult.to_dict()</InlineCode>, including nested findings that can contain sensitive excerpts. This synchronous example validates raw verdicts before SDK coercion, then returns only <InlineCode>blocked</InlineCode> and <InlineCode>reply</InlineCode>. Keep both the strict transport and the response wrapper. It preserves SDK HTTP failures with generic messages. Add your own authentication and deployment-specific request limits; the factory does not supply those application controls:
          </p>
          <CodeBlock language="python" title="FastAPI example">{`import json
import requests
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from soter import Soter, SoterError
from soter.fastapi import create_chat_route

# Validate raw responses before the factory can forward either direction.
class StrictSession(requests.Session):
    def post(self, *args, **kwargs):
        response = super().post(*args, **kwargs)
        if response.status_code < 400:
            try:
                raw = json.loads(response.text)
            except ValueError as exc:
                raise SoterError("Invalid guard JSON.") from exc
            permits = ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE")
            if (not isinstance(raw, dict) or type(raw.get("allowed")) is not bool
                    or not isinstance(raw.get("action"), str)
                    or raw["action"] not in (*permits, "BLOCK", "HUMAN_REVIEW")
                    or raw["allowed"] is not (raw["action"] in permits)):
                raise SoterError("Invalid guard verdict.")
            if raw["allowed"]:
                replacement = raw.get("safeText", raw.get("safe_text"))
                if replacement is None:
                    replacement = raw.get("redactedText", raw.get("redacted_text"))
                if replacement is None:
                    if raw["action"] != "ALLOW":
                        raise SoterError("Missing guard replacement.")
                elif not isinstance(replacement, str) or not replacement.strip():
                    raise SoterError("Invalid guard replacement.")
        return response  # Preserve HTTP failures for the SDK's error handling.

app = FastAPI()
guard = Soter(session=StrictSession())  # reads SOTER_API_KEY from environment

def my_llm_call(prompt: str) -> str:
    # Illustrative local stub for wiring only; replace with your provider adapter.
    return f"Response to: {prompt}"

guarded_chat = create_chat_route(guard, call_llm=my_llm_call)

@app.post("/chat")
def chat(payload: dict):
    if not isinstance(payload.get("message"), str) or not payload["message"].strip():
        return JSONResponse(status_code=400, content={"blocked": True, "reply": "Invalid message."})
    try:
        result = guarded_chat(payload)
        reply = result.get("safeResponse")
        if result.get("blocked") is not False or not isinstance(reply, str) or not reply.strip():
            return {"blocked": True, "reply": "Message or model response withheld."}
        # Never serialize inputGuard/outputGuard: findings can contain excerpts.
        return {"blocked": False, "reply": reply}
    except SoterError as exc:
        status = exc.status if isinstance(exc.status, int) and 400 <= exc.status <= 599 else 503
        return JSONResponse(status_code=status, content={"blocked": True, "reply": "Guard unavailable."})
    except Exception:
        return JSONResponse(status_code=503, content={"blocked": True, "reply": "Chat unavailable."})`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">
            See the <Link href="/docs/fastapi" className="text-cyan underline">FastAPI guide</Link> for full details.
          </p>

          <h3 className="mt-8 text-xl font-bold">LangChain</h3>
          <p className="mt-3 text-sm text-slate-200">Supply your own <InlineCode>my_chain</InlineCode> and <InlineCode>prompt</InlineCode>. This synchronous, duck-typed wrapper calls <InlineCode>.invoke()</InlineCode>; verify your chain&apos;s input/output shape. It guards the selected input and final text, not tool side effects or every intermediate retrieval step.</p>
          <CodeBlock language="python" title="LangChain wrapper">{`from soter import Soter
from soter.langchain import protect_langchain_chain

guard = Soter()
safe_chain = protect_langchain_chain(my_chain, guard)
result = safe_chain.invoke({"input": prompt})
reply = result["safe_response"]  # Never return the original chain response`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">
            See the <Link href="/docs/rag" className="text-cyan underline">RAG/LangChain guide</Link> for full details.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Error handling</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The SDK exports typed exception classes:
          </p>
          <CodeBlock language="python" title="error handling">{errorCode}</CodeBlock>
          <TipBox>
            The default is no retries. <InlineCode>max_retries=2</InlineCode> retries transport exceptions with linear backoff: <InlineCode>retry_backoff × attempt</InlineCode> (default 0.25 seconds). HTTP 5xx and 429 responses are not retried automatically. Both clients default to an 8-second timeout; the example chooses 10 seconds. Apply an application deadline as well.
          </TipBox>
        </section>

        <section className="docs-section">
          <DocsHeading>Security best practices</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Read API key from environment", "Never hardcode your API key. Read it from environment variables only."],
              ["Keep logs minimal", "Do not log keys, raw prompts, responses or complete exception objects. The client has no debug constructor option."],
              ["Handle upstream details carefully", "SDK exceptions can retain server messages, response details or transport causes. Log only selected codes and status."],
              ["Always guard output", "Call guard.output() before returning the model reply. Only permitted output may leave the server."],
              ["Set a timeout", "Use the timeout parameter to prevent hanging requests."],
              ["Fail closed", "Withhold the turn when a check fails. Never substitute an unchecked model response for an unavailable guard."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm italic text-slate-300">
            This reduces risk; it does not guarantee complete protection.
          </p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/fastapi" className="button-primary gap-2">
                FastAPI Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rag" className="button-secondary gap-2">
                RAG/LangChain Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/js" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← JavaScript SDK</Link>
          <Link href="/docs/fastapi" className="text-sm text-cyan hover:text-cyan/80 transition-colors">FastAPI Guide →</Link>
        </div>
    </DocsPageShell>
  );
}
