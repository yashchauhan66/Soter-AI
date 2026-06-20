import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const installCode = `pip install "cyberrakshak-guard[fastapi]"`;
const quickstartCode = `from fastapi import FastAPI
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY / SOTER_BASE_URL from environment

def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

# Mount the guarded chat route — input guard → LLM → output guard
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"],
)`;
const payloadCode = `// Request
{ "message": "user message", "userId": "optional", "sessionId": "optional" }

// Response
{
  "allowed": true,
  "blocked": false,
  "inputAction": "ALLOW",
  "outputAction": "ALLOW",
  "llmCalled": true,
  "safeResponse": "Response to: user message",
  "latencyMs": 142
}`;
const manualCode = `from fastapi import FastAPI
from pydantic import BaseModel
from soter import Soter

app = FastAPI()
guard = Soter()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    result = guard.protect_chat(
        message=req.message,
        call_llm=lambda safe_message: my_llm_call(safe_message),
    )
    return result.to_dict()`;
const asyncCode = `from soter import AsyncSoter  # lazy-loaded, requires httpx

guard = AsyncSoter()

@app.post("/chat")
async def chat(req: ChatRequest):
    result = await guard.protect_chat(
        message=req.message,
        call_llm=my_llm_call,
    )
    return result.to_dict()`;
const errorCode = `from soter import SoterError, SoterAuthError, SoterRateLimitError

try:
    result = guard.protect_chat(message=msg, call_llm=my_llm)
except SoterRateLimitError as exc:
    print(f"Rate limited, retry after {exc.retry_after}s")
except SoterAuthError:
    print("Check your API key")
except SoterError:
    print("SDK error")`;

export default function FastapiDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">FastAPI Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Guard your FastAPI chatbot with input/output protection in one route wrapper.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install</h2>
          <CodeBlock language="bash">{installCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Quickstart</h2>
          <CodeBlock language="python">{quickstartCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Payload Format</h2>
          <CodeBlock language="json">{payloadCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Manual Guarding</h2>
          <p className="mt-3 text-slate-400">For full control, guard input and output separately:</p>
          <CodeBlock language="python">{manualCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Async Support</h2>
          <p className="mt-3 text-slate-400">Use <InlineCode>AsyncSoter</InlineCode> for async endpoints (requires <InlineCode>httpx</InlineCode>):</p>
          <CodeBlock language="python">{asyncCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Error Handling</h2>
          <CodeBlock language="python">{errorCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Security Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Read the API key from the environment. Keep it <strong>server-side</strong> only.</li>
            <li>The SDK never logs the API key or raw text.</li>
            <li>Always run the <strong>output</strong> guard (which <InlineCode>protect_chat</InlineCode> does automatically).</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Express.js Guide</Link>
          <Link href="/docs/rest-api" className="text-sm text-cyan hover:text-cyan/80 transition-colors">REST API →</Link>
        </div>
      </div>
    </main>
  );
}
