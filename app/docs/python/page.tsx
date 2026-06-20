import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const installCode = `pip install cyberrakshak-guard
# optional extras
pip install "cyberrakshak-guard[fastapi]"
pip install "cyberrakshak-guard[langchain]"
pip install "cyberrakshak-guard[async]"   # for AsyncSoter (requires httpx)`;
const basicCode = `from soter import Soter

# Reads SOTER_API_KEY / SOTER_BASE_URL from environment
# Falls back to CYBERRAKSHAK_API_KEY / CYBERRAKSHAK_BASE_URL
guard = Soter()

input_result = guard.input(user_message)
if not guard.should_call_llm(input_result):
    reply = "This request was blocked for safety."
else:
    safe_message = guard.get_safe_input(input_result, user_message)
    llm_reply = call_llm(safe_message)
    output_result = guard.output(llm_reply)
    reply = guard.get_safe_output(output_result, llm_reply)`;
const protectChatCode = `result = guard.protect_chat(message=user_message, call_llm=call_llm)
# {"allowed": bool, "safe_response": str, "input_guard": GuardResult, ...}`;
const fastapiCode = `from fastapi import FastAPI
from soter import Soter
from soter.fastapi import create_chat_route

app = FastAPI()
guard = Soter()  # reads SOTER_API_KEY from environment

def my_llm_call(prompt: str) -> str:
    return f"Response to: {prompt}"

app.add_api_route(
    "/chat",
    create_chat_route(guard, call_llm=my_llm_call),
    methods=["POST"],
)`;
const langchainCode = `from soter import Soter
from soter.langchain import protect_langchain_chain

guard = Soter()
safe_chain = protect_langchain_chain(my_chain.invoke, guard)
result = safe_chain.invoke({"input": prompt})`;
const ragCode = `from soter import Soter

guard = Soter()

result = guard.protect_rag(
    query=user_query,
    retrieve=vector_store.similarity_search,
    call_llm=lambda ctx: rag_chain.invoke({
        "query": ctx["safeQuery"],
        "context": ctx["safeContext"],
    }),
)
if not result.allowed:
    return {"reply": result.safe_response, "blocked": True}
return {"reply": result.safe_response, "sources": result.used_sources}`;
const errorCode = `from soter import SoterError, SoterAuthError, SoterRateLimitError

try:
    guard.input(text)
except SoterRateLimitError as exc:
    retry_after = exc.retry_after
except SoterAuthError:
    ...  # 401/403
except SoterError:
    ...  # catch all SDK errors`;

export default function PythonDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Language guide</p>
        <h1 className="mt-3 text-4xl font-bold">Python</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Soter provides a Python client for protecting AI chatbots, agents, RAG systems, and LLM applications.
          The core client uses only the standard library (<InlineCode>urllib</InlineCode>) — no third-party HTTP dependency required.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install</h2>
          <CodeBlock language="bash">{installCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            <strong>Note:</strong> The PyPI package is currently <InlineCode>cyberrakshak-guard</InlineCode>, but you import via <InlineCode>soter</InlineCode>.
            Legacy <InlineCode>from cyberrakshak_guard import CyberRakshakGuard</InlineCode> also works.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{`SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://api.your-soter-host.example
SOTER_PROJECT_ID=                        # optional`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            Legacy <InlineCode>CYBERRAKSHAK_*</InlineCode> environment variables are also supported as fallbacks.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Basic Usage</h2>
          <CodeBlock language="python">{basicCode}</CodeBlock>

          <h3 className="mt-8 font-semibold">One-Call Helper</h3>
          <CodeBlock language="python">{protectChatCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">FastAPI</h2>
          <CodeBlock language="python">{fastapiCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/fastapi" className="text-cyan underline">FastAPI guide</Link> for full details.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">LangChain</h2>
          <CodeBlock language="python">{langchainCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/rag" className="text-cyan underline">RAG / LangChain guide</Link> for full details.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">RAG Protection</h2>
          <CodeBlock language="python">{ragCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Error Handling</h2>
          <CodeBlock language="python">{errorCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            Set <InlineCode>retries=2</InlineCode> to auto-retry transient 5xx/network failures with backoff.
            Legacy names like <InlineCode>CyberRakshakError</InlineCode> are also exported.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Security Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Read the API key from the environment. Keep it <strong>server-side</strong> only.</li>
            <li>The API key and raw prompt text are never logged (even with <InlineCode>debug=True</InlineCode>).</li>
            <li>Error messages never contain the API key.</li>
            <li>Always run the <strong>output</strong> guard, not just the input guard.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/js" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← JS/TS Guide</Link>
          <Link href="/docs/nextjs" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Next.js Guide →</Link>
        </div>
      </div>
    </main>
  );
}
