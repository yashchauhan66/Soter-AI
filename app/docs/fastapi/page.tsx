import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI FastAPI Integration Guide - AI Security for Python APIs",
  description:
    "Complete FastAPI integration guide for SoterAI. Protect your Python chatbot with create_chat_route, manual guarding, async support, and Pydantic models.",
  alternates: { canonical: "/docs/fastapi" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "FastAPI", item: "https://soterai.publicvm.com/docs/fastapi" },
  ],
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
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">FastAPI Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Guard your FastAPI chatbot with input/output protection in one route wrapper.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install</h2>
          <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Quickstart (one-line route)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The fastest way to add AI security to your FastAPI app:
          </p>
          <CodeBlock language="python" title="main.py" showLineNumbers>{quickstartCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Manual guarding (more control)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Use <InlineCode>protect_chat</InlineCode> for manual control:
          </p>
          <CodeBlock language="python" title="manual control" showLineNumbers>{manualCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 4: Async support</h2>
          <p className="mt-3 leading-7 text-slate-400">
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
      </div>
    </main>
  );
}
