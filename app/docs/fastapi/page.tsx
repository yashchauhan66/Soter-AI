import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "FastAPI Integration: AI Security for Python",
  description: "Configure Soter in FastAPI with validated requests, create_chat_route, synchronous and asynchronous guarding, and public responses that withhold blocked output.",
  alternates: { canonical: "/docs/fastapi" },
};

const installCode = `pip install "soter[fastapi]"
# For the async variant below, also install the async extra:
pip install "soter[fastapi,async]"`;
const envCode = `# Set in your server process or secret manager before starting the app.
SOTER_API_KEY=replace_with_your_project_key
# Optional; this is the SDK's default origin.
SOTER_BASE_URL=https://api.soterai.in`;
const quickstartCode = `# main.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictStr
from soter import Soter, SoterError
from soter.fastapi import create_chat_route
from your_app.llm import my_llm_call  # Your synchronous (str) -> str adapter

import json
import requests

# Application transport policy: inspect raw JSON before GuardResult coercion.
class StrictSession(requests.Session):
    def post(self, *args, **kwargs):
        response = super().post(*args, **kwargs)
        if response.status_code < 400:
            try:
                raw = json.loads(response.text)
            except ValueError as exc:
                raise SoterError("Invalid guard JSON") from exc
            permits = ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE")
            if (not isinstance(raw, dict) or type(raw.get("allowed")) is not bool
                    or raw.get("action") not in (*permits, "BLOCK", "HUMAN_REVIEW")
                    or raw["allowed"] is not (raw["action"] in permits)):
                raise SoterError("Invalid guard verdict")
            action = raw["action"]
            decision = "REDACT" if action in permits[1:] else action
            if raw.get("decision", decision) != decision:
                raise SoterError("Inconsistent guard decision")
            if action in permits[1:]:
                replacement = raw.get("safeText", raw.get("safe_text"))
                if replacement is None:
                    replacement = raw.get("redactedText", raw.get("redacted_text"))
                if not isinstance(replacement, str) or not replacement.strip():
                    raise SoterError("Missing usable guard replacement")
        return response

app = FastAPI()
guard = Soter(timeout=8.0, max_retries=0, session=StrictSession())
guarded_chat = create_chat_route(guard, call_llm=my_llm_call)

class ChatRequest(BaseModel):
    message: StrictStr = Field(min_length=1, max_length=8000)

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        return JSONResponse(status_code=422, content={"blocked": True, "reply": "Invalid message."})
    try:
        # The adapter's result is a camelCase dictionary, including diagnostics.
        result = guarded_chat({"message": req.message})
        if result["blocked"]:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result["safeResponse"]}
    except SoterError:
        return JSONResponse(status_code=503, content={"blocked": True, "reply": "Guard temporarily unavailable."})
    except Exception:
        return JSONResponse(status_code=502, content={"blocked": True, "reply": "Model request failed."})`;
const manualCode = `# Alternative main.py: call protect_chat directly.
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictStr
from soter import Soter, SoterError
from your_app.llm import my_llm_call

import json
import requests

# Application transport policy: inspect raw JSON before GuardResult coercion.
class StrictSession(requests.Session):
    def post(self, *args, **kwargs):
        response = super().post(*args, **kwargs)
        if response.status_code < 400:
            try:
                raw = json.loads(response.text)
            except ValueError as exc:
                raise SoterError("Invalid guard JSON") from exc
            permits = ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE")
            if (not isinstance(raw, dict) or type(raw.get("allowed")) is not bool
                    or raw.get("action") not in (*permits, "BLOCK", "HUMAN_REVIEW")
                    or raw["allowed"] is not (raw["action"] in permits)):
                raise SoterError("Invalid guard verdict")
            action = raw["action"]
            decision = "REDACT" if action in permits[1:] else action
            if raw.get("decision", decision) != decision:
                raise SoterError("Inconsistent guard decision")
            if action in permits[1:]:
                replacement = raw.get("safeText", raw.get("safe_text"))
                if replacement is None:
                    replacement = raw.get("redactedText", raw.get("redacted_text"))
                if not isinstance(replacement, str) or not replacement.strip():
                    raise SoterError("Missing usable guard replacement")
        return response

app = FastAPI()
guard = Soter(timeout=8.0, max_retries=0, session=StrictSession())

class ChatRequest(BaseModel):
    message: StrictStr = Field(min_length=1, max_length=8000)

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        return JSONResponse(status_code=422, content={"blocked": True, "reply": "Invalid message."})
    try:
        result = guard.protect_chat(message=req.message, call_llm=my_llm_call)
        if result.blocked:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result.safe_response}
    except SoterError:
        return JSONResponse(status_code=503, content={"blocked": True, "reply": "Guard temporarily unavailable."})
    except Exception:
        return JSONResponse(status_code=502, content={"blocked": True, "reply": "Model request failed."})`;
const asyncCode = `# Alternative main.py: install soter[fastapi,async].
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictStr
from soter import AsyncSoter, SoterError
from your_app.llm import my_async_llm_call  # Your async (str) -> str adapter

import json
import httpx

# Application transport policy: inspect raw JSON before GuardResult coercion.
class StrictAsyncClient(httpx.AsyncClient):
    async def post(self, *args, **kwargs):
        response = await super().post(*args, **kwargs)
        if response.status_code < 400:
            try:
                raw = json.loads(response.text)
            except ValueError as exc:
                raise SoterError("Invalid guard JSON") from exc
            permits = ("ALLOW", "ALLOW_WITH_REDACTION", "REWRITE")
            if (not isinstance(raw, dict) or type(raw.get("allowed")) is not bool
                    or raw.get("action") not in (*permits, "BLOCK", "HUMAN_REVIEW")
                    or raw["allowed"] is not (raw["action"] in permits)):
                raise SoterError("Invalid guard verdict")
            action = raw["action"]
            decision = "REDACT" if action in permits[1:] else action
            if raw.get("decision", decision) != decision:
                raise SoterError("Inconsistent guard decision")
            if action in permits[1:]:
                replacement = raw.get("safeText", raw.get("safe_text"))
                if replacement is None:
                    replacement = raw.get("redactedText", raw.get("redacted_text"))
                if not isinstance(replacement, str) or not replacement.strip():
                    raise SoterError("Missing usable guard replacement")
        return response

http_client = StrictAsyncClient()
guard = AsyncSoter(timeout=8.0, max_retries=0, client=http_client)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        await http_client.aclose()  # This application owns the injected client.

app = FastAPI(lifespan=lifespan)

class ChatRequest(BaseModel):
    message: StrictStr = Field(min_length=1, max_length=8000)

@app.post("/chat")
async def chat(req: ChatRequest):
    if not req.message.strip():
        return JSONResponse(status_code=422, content={"blocked": True, "reply": "Invalid message."})
    try:
        result = await guard.protect_chat(message=req.message, call_llm=my_async_llm_call)
        if result.blocked:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result.safe_response}
    except SoterError:
        return JSONResponse(status_code=503, content={"blocked": True, "reply": "Guard temporarily unavailable."})
    except Exception:
        return JSONResponse(status_code=502, content={"blocked": True, "reply": "Model request failed."})`;

export default function FastapiDocsPage() {
  return (
    <DocsPageShell path="/docs/fastapi">
      <section className="docs-section">
        <DocsHeading>Step 1: Install</DocsHeading>
        <p className="mt-3 leading-7">The local Python distribution is <InlineCode>soter</InlineCode> and declares Python 3.9 or newer. Use your application&apos;s environment; the <InlineCode>fastapi</InlineCode> extra adds FastAPI, while <InlineCode>async</InlineCode> adds HTTPX. An ASGI server such as Uvicorn is a separate dependency.</p>
        <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        <CodeBlock language="bash" title="server environment">{envCode}</CodeBlock>
        <p className="mt-3 leading-7"><InlineCode>Soter()</InlineCode> reads <InlineCode>SOTER_API_KEY</InlineCode> and <InlineCode>SOTER_BASE_URL</InlineCode> from the process environment. It does not load a <InlineCode>.env</InlineCode> file. A missing key raises <InlineCode>SoterConfigError</InlineCode>. The Python constructor does not accept <InlineCode>project_id</InlineCode>; the API key selects its project.</p>
        <TipBox>Choose one of the three route implementations below and supply the named model adapter. Configure user authentication, authorization and request/body limits before exposing <InlineCode>/chat</InlineCode>. These examples do not provide those controls.</TipBox>
      </section>
      <section className="docs-section">
        <DocsHeading id="step-2-quickstart-one-line-route">Step 2: Quickstart with the route adapter</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>create_chat_route</InlineCode> wraps <InlineCode>protect_chat</InlineCode>, synchronously for <InlineCode>Soter</InlineCode> or asynchronously for <InlineCode>AsyncSoter</InlineCode>. Each example supplies an application-owned strict HTTP adapter before SDK normalization: raw <InlineCode>allowed</InlineCode> must be boolean and agree with an allowlisted action; redaction/rewrite requires nonblank replacement text. This prevents truthy strings and the SDK&apos;s original-text fallback from permitting continuation. Keep the adapter as well as Pydantic validation and the public-response wrapper.</p>
        <CodeBlock language="python" title="main.py · route adapter" showLineNumbers>{quickstartCode}</CodeBlock>
        <p className="mt-3 leading-7">You can mount the unwrapped handler with <InlineCode>app.add_api_route(&quot;/chat&quot;, create_chat_route(guard, call_llm=my_llm_call), methods=[&quot;POST&quot;])</InlineCode>. Its input is a dictionary with <InlineCode>message</InlineCode>, optional <InlineCode>userId</InlineCode> and <InlineCode>sessionId</InlineCode>; the field names are configurable. It does not enforce the schema or translate SDK exceptions shown above.</p>
        <p className="mt-3 leading-7">The unwrapped result uses camelCase: <InlineCode>safeResponse</InlineCode>, <InlineCode>inputGuard</InlineCode>, <InlineCode>outputGuard</InlineCode> and <InlineCode>llmCalled</InlineCode>. Full results are diagnostic data, not a sanitized public-response format.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 3: Manual guarding (more control)</DocsHeading>
        <p className="mt-3 leading-7">Calling <InlineCode>protect_chat</InlineCode> directly returns a <InlineCode>ProtectChatResult</InlineCode> object. Its Python attributes use snake_case. <InlineCode>to_dict()</InlineCode> produces camelCase keys and includes guard details; the example intentionally does not serialize that entire object.</p>
        <CodeBlock language="python" title="main.py · direct orchestration" showLineNumbers>{manualCode}</CodeBlock>
        <p className="mt-3 leading-7">The SDK skips the model on a denied or human-review input. It guards the completed model string before returning. To add trusted correlation, pass <InlineCode>user_id</InlineCode> and <InlineCode>session_id</InlineCode> resolved by your server, not copied from an unauthenticated browser payload.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 4: Async support</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>AsyncSoter</InlineCode> supports awaitable callbacks and exposes <InlineCode>aclose()</InlineCode> for its owned HTTP client. Use an async model adapter for network work; passing a blocking synchronous function does not move it into a worker thread.</p>
        <CodeBlock language="python" title="main.py · async alternative" showLineNumbers>{asyncCode}</CodeBlock>
        <p className="mt-3 leading-7">If you inject an <InlineCode>httpx.AsyncClient</InlineCode>, you own its cleanup. Keep the sync client in a synchronous FastAPI handler; do not run its blocking HTTP requests directly inside an async endpoint.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Response and failure policy</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>These wrappers return 200 for completed turns, including a fixed reply with <InlineCode>blocked: true</InlineCode>. Invalid fields return 422, SDK failures return 503, and model exceptions return 502.</li>
          <li>The guard API&apos;s 400, 401/403 and 429 become typed SDK exceptions; other HTTP failures raise <InlineCode>SoterError</InlineCode>. Python <InlineCode>max_retries</InlineCode> retries transport exceptions, not HTTP 429/5xx responses. Timeout values are seconds.</li>
          <li>Use <InlineCode>SoterRateLimitError.retry_after</InlineCode> when designing backoff. Keep unavailable requests withheld; do not fall back to the original model text.</li>
          <li>The 8,000-character validation follows the server default. The server can configure a different limit; align the application schema and bound HTTP body size at the ingress.</li>
          <li>These are complete-string examples. Background tasks and streaming need their own mechanism to prevent release before a verdict.</li>
        </ul>
        <DocsHeading level={3}>Verify the integration</DocsHeading>
        <p className="mt-3 leading-7">Use synthetic messages to test allow, redaction, block and human review. Count model calls to prove denied input stops early. Force a guard timeout and an output denial; inspect the HTTP response for leaked completion or diagnostic fields. Test the real model adapter separately from these control-flow checks.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/python" className="button-primary gap-2">Python SDK Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/rag" className="button-secondary gap-2">RAG/LangChain <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Express.js Guide</Link>
        <Link href="/docs/python" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Python SDK →</Link>
      </div>
    </DocsPageShell>
  );
}

