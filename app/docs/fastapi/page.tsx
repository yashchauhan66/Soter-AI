import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "FastAPI Integration: AI Security for Python",
  description:
    "Complete FastAPI integration guide for SoterAI. Protect your Python chatbot with create_chat_route, manual guarding, async support, and Pydantic models.",
  alternates: { canonical: "/docs/fastapi" },
};

const installCode = `pip install "soter[fastapi]"`;
const quickstartCode = `from fastapi import FastAPI
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY from environment

def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

# One-line guarded chat route — input guard → LLM → output guard
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"],
)`;
const manualCode = `from fastapi import FastAPI
from pydantic import BaseModel
from soter import Soter

app = FastAPI()
guard = Soter()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    # Manual: input guard → LLM → output guard
    result = guard.protect_chat(
        message=req.message,
        call_llm=lambda safe_message: my_llm_call(safe_message),
    )
    return result.to_dict()`;
const asyncCode = `from soter import AsyncSoter  # requires httpx

guard = AsyncSoter()

@app.post("/chat")
async def chat(req: ChatRequest):
    result = await guard.protect_chat(
        message=req.message,
        call_llm=my_llm_call,
    )
    return result.to_dict()`;

export default function FastapiDocsPage() {
  return (
    <DocsPageShell path="/docs/fastapi">

        <section className="docs-section">
          <DocsHeading>Step 1: Install</DocsHeading>
          <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 2: Quickstart (one-line route)</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The fastest way to add AI security to your FastAPI app:
          </p>
          <CodeBlock language="python" title="main.py" showLineNumbers>{quickstartCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 3: Manual guarding (more control)</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use <InlineCode>protect_chat</InlineCode> for manual control:
          </p>
          <CodeBlock language="python" title="manual control" showLineNumbers>{manualCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 4: Async support</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use <InlineCode>AsyncSoter</InlineCode> for async endpoints (requires <InlineCode>httpx</InlineCode>):
          </p>
          <CodeBlock language="python" title="async">{asyncCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/python" className="button-primary gap-2">
                Python SDK Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rag" className="button-secondary gap-2">
                RAG/LangChain <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Express.js Guide</Link>
          <Link href="/docs/python" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Python SDK →</Link>
        </div>
    </DocsPageShell>
  );
}
