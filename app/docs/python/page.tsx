import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Python SDK Guide - Protect Your AI Chatbot (FastAPI, LangChain)",
  description:
    "Complete Python SDK guide for SoterAI. Install, configure, and use the Python client to protect FastAPI, Flask, LangChain, and LlamaIndex applications from prompt injection, PII leaks, and unsafe outputs. Includes async support.",
  alternates: { canonical: "/docs/python" },
  openGraph: {
    title: "SoterAI Python SDK Guide",
    description: "Protect your Python AI applications from prompt injection, PII leaks, and unsafe outputs with SoterAI.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Python SDK", item: "https://soterai.publicvm.com/docs/python" },
  ],
};

const installCode = `# Install the Python client
pip install soter

# Optional extras
pip install "soter[fastapi]"    # FastAPI support
pip install "soter[langchain]"  # LangChain support
pip install "soter[async]"     # Async support (requires httpx)`;
const basicCode = `from soter import Soter

# Reads SOTER_API_KEY / SOTER_BASE_URL from environment
guard = Soter()

# Guard user input before LLM
input_result = guard.input(user_message)

if not guard.should_call_llm(input_result):
    # 🛑 Blocked! Don't call the LLM
    reply = "This request was blocked for safety."
else:
    # ✅ Safe to proceed - get redacted/safe text
    safe_message = guard.get_safe_input(input_result, user_message)
    llm_reply = call_llm(safe_message)
    
    # Guard model output before user sees it
    output_result = guard.output(llm_reply)
    reply = guard.get_safe_output(output_result, llm_reply)`;
const protectChatCode = `# One-call helper: input guard → LLM → output guard
result = guard.protect_chat(
    message=user_message,
    call_llm=call_llm
)
# Returns: { "allowed": bool, "safe_response": str, ... }`;
const fullExampleCode = `from soter import Soter, SoterError

# Initialize once - reuse for all requests
guard = Soter(timeout=10, retries=2)

def handle_chat_message(user_message: str) -> dict:
    try:
        # 1. Guard user input
        input_result = guard.input(user_message)
        
        if not guard.should_call_llm(input_result):
            return {
                "reply": input_result.get("safe_text") or "Message blocked.",
                "blocked": True
            }
        
        # 2. Call your LLM with safe text
        safe_input = guard.get_safe_input(input_result, user_message)
        llm_reply = call_llm(safe_input)
        
        # 3. Guard model output
        output_result = guard.output(llm_reply)
        safe_reply = guard.get_safe_output(output_result, llm_reply)
        
        return {
            "reply": safe_reply,
            "blocked": output_result.get("action") == "BLOCK"
        }
    except SoterError as e:
        # Decide: fail open or fail closed
        print(f"SoterAI error: {e}")
        return {"reply": "Service unavailable.", "blocked": False}`;
const errorCode = `from soter import SoterError, SoterAuthError, SoterRateLimitError

try:
    result = guard.input(text)
except SoterRateLimitError as exc:
    print(f"Rate limited. Retry after {exc.retry_after}s")
    time.sleep(exc.retry_after or 1)
except SoterAuthError:
    print("Auth error - check your API key")
except SoterError:
    print("SDK error occurred")`;

export default function PythonDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        
        <p className="eyebrow mt-6">Language guide</p>
        <h1 className="mt-3 text-4xl font-bold">Python SDK Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          SoterAI provides a Python client for protecting AI chatbots, agents, RAG systems, and LLM applications.
          The core client uses only the Python standard library (<InlineCode>urllib</InlineCode>) — no third-party HTTP dependency required.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install the package</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Install from PyPI:
          </p>
          <CodeBlock language="bash" title="pip install">{installCode}</CodeBlock>
          <TipBox>
            The Python package is published on PyPI as <InlineCode>soter</InlineCode>.
            Import it with <InlineCode>from soter import Soter</InlineCode>.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Configure environment</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Set these environment variables on your server:
          </p>
          <CodeBlock language="bash" title=".env">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://api.your-soter-host.example
SOTER_PROJECT_ID=                        # optional`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">

          </p>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Basic usage</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Guard user input and model output in a simple chat flow:
          </p>
          <CodeBlock language="python" title="basic input/output guard" showLineNumbers>{basicCode}</CodeBlock>
          
          <h3 className="mt-8 text-xl font-bold">One-call chat helper</h3>
          <p className="mt-3 leading-7 text-slate-400">
            Runs <strong>input guard → LLM call → output guard</strong> automatically:
          </p>
          <CodeBlock language="python" title="protect_chat">{protectChatCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 4: Production-ready example</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Here's a complete example with error handling and proper response formatting:
          </p>
          <CodeBlock language="python" title="production handler" showLineNumbers>{fullExampleCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Framework integrations</h2>
          
          <h3 className="mt-8 text-xl font-bold">FastAPI</h3>
          <p className="mt-3 leading-7 text-slate-400">
            Use the <InlineCode>create_chat_route</InlineCode> helper for a one-line guarded route:
          </p>
          <CodeBlock language="python" title="FastAPI example">{`from fastapi import FastAPI
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY from environment

def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

# Mount the guarded chat route
app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"],
)`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/fastapi" className="text-cyan underline">FastAPI guide</Link> for full details.
          </p>

          <h3 className="mt-8 text-xl font-bold">LangChain</h3>
          <CodeBlock language="python" title="LangChain wrapper">{`from soter import Soter
from soter.langchain import protect_langchain_chain

guard = Soter()
safe_chain = protect_langchain_chain(my_chain.invoke, guard)
result = safe_chain.invoke({"input": prompt})`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/rag" className="text-cyan underline">RAG/LangChain guide</Link> for full details.
          </p>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Error handling</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The SDK exports typed exception classes:
          </p>
          <CodeBlock language="python" title="error handling">{errorCode}</CodeBlock>
          <TipBox>
            Set <InlineCode>retries=2</InlineCode> in the constructor to auto-retry transient 
            5xx/network failures with exponential backoff.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Security best practices</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Read API key from environment", "Never hardcode your API key. Read it from environment variables only."],
              ["API key never logged", "The API key and raw prompt text are never logged, even with debug=True."],
              ["Safe error messages", "Error messages never contain the API key in their text."],
              ["Always guard output", "The soter.output() call is just as important as soter.input(). Always do both."],
              ["Set a timeout", "Use the timeout parameter to prevent hanging requests."],
              ["Fail open or fail closed", "Decide your failure mode: allow traffic through (open) or block traffic (closed) when SoterAI is unreachable."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm italic text-slate-500">
            This reduces risk; it does not guarantee complete protection.
          </p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What's next?</h2>
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
      </div>
    </main>
  );
}
