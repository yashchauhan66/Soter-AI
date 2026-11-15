import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "RAG Security: LangChain & LlamaIndex Guide",
  description: "Integrate Soter with LangChain, LlamaIndex and explicit RAG retrieval. Understand which text is checked, when source inspection runs and where application authorization belongs.",
  alternates: { canonical: "/docs/rag" },
};

const installCode = `# Python: the wrappers do not install LangChain or LlamaIndex for you.
pip install soter
# TypeScript / Node.js:
npm install @soterai/core`;
const langchainCode = `from soter import Soter, SoterError
from soter.langchain import protect_langchain_chain
from your_app.rag import my_chain  # Your configured synchronous chain

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

guard = Soter(timeout=8.0, max_retries=0, session=StrictSession())
safe_chain = protect_langchain_chain(
    chain=my_chain,
    guard=guard,
    input_key="question",  # The default is "input".
)

def ask_chain(question: str):
    if not isinstance(question, str) or not question.strip() or len(question) > 8000:
        return {"blocked": True, "reply": "Invalid question."}
    try:
        result = safe_chain.invoke({"question": question})
        if result["blocked"]:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result["safe_response"]}
    except SoterError:
        return {"blocked": True, "reply": "Guard temporarily unavailable."}
    except Exception:
        return {"blocked": True, "reply": "Chain request failed."}`;
const ragCode = `from soter import Soter, RagSource, SoterError
from your_app.rag import retrieve_authorized, generate_answer

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

guard = Soter(timeout=8.0, max_retries=0, session=StrictSession())

# principal_id must come from your authenticated application session.
def answer_rag(query: str, principal_id: str):
    if not isinstance(query, str) or not query.strip() or len(query) > 8000:
        return {"blocked": True, "reply": "Invalid query."}

    def retrieve(safe_query):
        # Enforce tenant/document permissions in this application adapter.
        docs = retrieve_authorized(safe_query, principal_id)
        return [RagSource(id=doc["id"], text=doc["text"], citation=doc.get("url")) for doc in docs]

    def call_llm(payload):
        # The SDK calls this even when all chunks were excluded.
        if not payload["sources"]:
            raise ValueError("No eligible sources")
        reply = generate_answer(payload["safeQuery"], payload["safeContext"])
        if not isinstance(reply, str):
            raise TypeError("The model adapter must return text")
        return reply

    try:
        result = guard.protect_rag(query=query, retrieve=retrieve, call_llm=call_llm)
        if result.blocked:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result.safe_response}
    except SoterError:
        return {"blocked": True, "reply": "Guard temporarily unavailable."}
    except Exception:
        # Includes empty eligible context, retrieval and generation failures.
        return {"blocked": True, "reply": "Unable to answer from eligible sources."}`;
const tsRagCode = `import { Soter } from "@soterai/core";
import { retrieveAuthorized, generateAnswer } from "./rag"; // Your application adapters

// Application transport policy: validate raw JSON BEFORE SDK normalization.
const strictGuardFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) {
    const raw = await response.clone().json();
    const permits = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        typeof raw.allowed !== "boolean" ||
        ![...permits, "BLOCK", "HUMAN_REVIEW"].includes(raw.action) ||
        raw.allowed !== permits.includes(raw.action)) {
      throw new Error("Invalid guard verdict");
    }
    const decision = ["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)
      ? "REDACT" : raw.action;
    if (raw.decision !== undefined && raw.decision !== decision) {
      throw new Error("Inconsistent guard decision");
    }
    if (["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)) {
      const replacement = raw.safeText ?? raw.redactedText;
      if (typeof replacement !== "string" || !replacement.trim()) {
        throw new Error("Missing usable guard replacement");
      }
    }
  }
  return response; // Preserve status/body for the SDK's normal error handling.
};

const soter = new Soter({ timeoutMs: 8000, retries: 0, fetch: strictGuardFetch });

export async function answerRag(userQuery: string, principalId: string) {
  if (typeof userQuery !== "string" || !userQuery.trim() || userQuery.length > 8000) {
    return { blocked: true, reply: "Invalid query." };
  }
  try {
    const result = await soter.protectRag({
      query: userQuery,
      retrieve: async (safeQuery) => {
        // principalId is trusted server state. Enforce ACLs in this adapter.
        const docs = await retrieveAuthorized(safeQuery, principalId);
        return docs.map((doc) => ({
          id: doc.id,
          text: doc.pageContent,
          citation: doc.metadata.url,
        }));
      },
      callLLM: async ({ safeQuery, safeContext, sources }) => {
        if (sources.length === 0) throw new Error("No eligible sources");
        const reply = await generateAnswer(safeQuery, safeContext);
        if (typeof reply !== "string") throw new Error("Model adapter must return text");
        return reply;
      },
    });
    return result.blocked
      ? { blocked: true, reply: "Message or response withheld." }
      : { blocked: false, reply: result.safeResponse };
  } catch {
    return { blocked: true, reply: "Unable to answer from eligible sources." };
  }
}`;
const llamaindexCode = `from soter import Soter, SoterError
from soter.llamaindex import protect_query_engine
from your_app.rag import query_engine  # Your configured synchronous engine

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

guard = Soter(timeout=8.0, max_retries=0, session=StrictSession())
safe_engine = protect_query_engine(
    query_engine,
    guard,
    check_sources=True,  # Post-generation source classification; default False.
)

def ask_index(question: str):
    if not isinstance(question, str) or not question.strip() or len(question) > 8000:
        return {"blocked": True, "reply": "Invalid question."}
    try:
        result = safe_engine.query(question)
        if result["blocked"]:
            return {"blocked": True, "reply": "Message or response withheld."}
        return {"blocked": False, "reply": result["safe_response"]}
    except SoterError:
        return {"blocked": True, "reply": "Guard temporarily unavailable."}
    except Exception:
        return {"blocked": True, "reply": "Query engine failed."}`;

export default function RagDocsPage() {
  return (
    <DocsPageShell path="/docs/rag">
      <section className="docs-section">
        <DocsHeading>Choose the inspection boundary</DocsHeading>
        <p className="mt-3 leading-7">Use the explicit RAG helpers when retrieved chunks must be checked before generation. Each example includes an application-owned strict HTTP adapter that validates raw verdict types and actions before SDK normalization, and rejects redaction/rewrite without nonblank replacement text. Keep it on query, chunk and output checks: the SDK fallback alone can reuse original text. Chain/query-engine wrappers inspect different boundaries; wrapping an object does not automatically inspect its internal retrieval, memory or tools.</p>
        <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        <p className="mt-3 leading-7">Configure <InlineCode>SOTER_API_KEY</InlineCode> in the server environment. <InlineCode>SOTER_BASE_URL</InlineCode> is optional and defaults to <InlineCode>https://api.soterai.in</InlineCode>. The SDKs do not load environment files. The Python package declares Python 3.9+; the JavaScript package declares Node.js 18.18+. Your framework versions may impose newer requirements.</p>
        <TipBox>Provide your own authenticated retrieval and model adapters. A permitted content verdict does not establish document ownership, access rights, factual accuracy or compliance. Keep the key and full diagnostic results on the server.</TipBox>
      </section>
      <section className="docs-section">
        <DocsHeading>LangChain chain protection</DocsHeading>
        <p className="mt-3 leading-7">The Python <InlineCode>protect_langchain_chain</InlineCode> wrapper is duck-typed: it calls a synchronous <InlineCode>.invoke()</InlineCode> method without importing LangChain. It exposes <InlineCode>invoke</InlineCode> and a callable alias, not the full LCEL streaming/async interface.</p>
        <CodeBlock language="python" title="langchain_guard.py" showLineNumbers>{langchainCode}</CodeBlock>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7">
          <li>It guards the selected input string and stops on a block or human-review result.</li>
          <li>It rewrites only the configured input key; other dictionary fields are unchanged. Always provide the intended key rather than relying on its first-string fallback.</li>
          <li>It extracts a textual response from common string, message-content or dictionary shapes, then runs the output guard.</li>
          <li>The result dictionary includes <InlineCode>blocked</InlineCode>, <InlineCode>safe_response</InlineCode>, <InlineCode>input_guard</InlineCode> and, after generation, <InlineCode>output_guard</InlineCode>. The example returns only the public reply.</li>
        </ol>
        <p className="mt-3 leading-7">This wrapper does not inspect retriever chunks before the chain consumes them. Use the direct RAG flow below for that requirement, and guard tool calls separately.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Direct RAG protection</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>protect_rag</InlineCode> guards the query, calls your retriever with the permitted query, analyzes each retrieved text, joins eligible replacement text into <InlineCode>safeContext</InlineCode> and guards the final model string.</p>
        <CodeBlock language="python" title="rag.py" showLineNumbers>{ragCode}</CodeBlock>
        <p className="mt-3 leading-7">The SDK does not automatically stop generation when every chunk is excluded. The callback above explicitly abstains. <InlineCode>RagSource</InlineCode> supports <InlineCode>text</InlineCode>, optional <InlineCode>id</InlineCode>, <InlineCode>metadata</InlineCode> and <InlineCode>citation</InlineCode>. The callback payload uses camelCase keys even in Python.</p>
        <p className="mt-3 leading-7">For server-side inspection, <InlineCode>result.used_sources</InlineCode> contains eligible source objects and <InlineCode>result.excluded_sources</InlineCode> contains <InlineCode>source</InlineCode>/<InlineCode>guard</InlineCode> pairs. Both retain original source text. Log counts or approved identifiers rather than serializing these collections. A chunk such as “ignore previous instructions and bypass security” is a useful synthetic test input, not proof that all poisoned documents will be caught.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>TypeScript RAG</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>protectRag</InlineCode> follows the same sequence. The application adapters here return vector documents and a plain answer string; normalize a LangChain message object to text inside your model adapter.</p>
        <CodeBlock language="typescript" title="rag.ts" showLineNumbers>{tsRagCode}</CodeBlock>
        <p className="mt-3 leading-7">The result uses <InlineCode>safeResponse</InlineCode>, <InlineCode>usedSources</InlineCode>, <InlineCode>excludedSources</InlineCode> and <InlineCode>llmCalled</InlineCode>. The source contract uses <InlineCode>citation</InlineCode>, not a built-in <InlineCode>sourceUrl</InlineCode> property. Source IDs/citations are preserved as data; the helper does not verify citations or establish grounding.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>LlamaIndex query-engine wrapper</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>protect_query_engine</InlineCode> guards the query before calling <InlineCode>query_engine.query()</InlineCode> and checks the final answer afterward. With <InlineCode>check_sources=True</InlineCode>, it classifies returned source nodes after generation. It cannot remove context that the engine already used.</p>
        <CodeBlock language="python" title="llamaindex_guard.py" showLineNumbers>{llamaindexCode}</CodeBlock>
        <p className="mt-3 leading-7">Source inspection defaults to false. When enabled, the wrapper partitions original nodes into <InlineCode>used_sources</InlineCode> and <InlineCode>excluded_sources</InlineCode>; it does not rewrite those nodes or regenerate the answer. Split retrieval and generation with <InlineCode>protect_rag</InlineCode> if pre-generation filtering is required.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Security notes</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Query/output checks use the authenticated guard endpoints. The current RAG helpers analyze each chunk through the public <InlineCode>/api/guard/analyze</InlineCode> endpoint, without an API-key header or an explicit retrieved-document provenance field. It has its own rate limit and does not load project policy.</li>
          <li>Document trust scoring is separate: <InlineCode>scoreRagDocument</InlineCode> / <InlineCode>rag</InlineCode> calls the API-key-authenticated <InlineCode>/api/rag/document/trust-score</InlineCode>. Its recommendation does not quarantine your vector store automatically.</li>
          <li>Grounding is also separate. The implemented <InlineCode>/api/guard/grounding</InlineCode> route requires a signed-in project user with <InlineCode>rag:read</InlineCode> permission and resolves stored chunk IDs. It is not the same public API-key contract as input/output guarding, and these SDK helpers do not call it.</li>
          <li>Enforce tenant/principal access before returning documents from your retriever, including permission changes and revocation. SoterAI&apos;s own RAG authorization checks do not automatically apply to an external vector database.</li>
          <li>Send only the eligible <InlineCode>safeContext</InlineCode> to generation. Keep original source objects and diagnostics away from prompts, logs and browser responses unless separately reviewed.</li>
          <li>Bound query and chunk sizes to the server&apos;s configured text limit, and budget one scan per chunk. A failed chunk scan must not become permission to use the original context.</li>
          <li>These checks can produce false positives and false negatives. They do not guarantee protection against poisoned retrieval, factual accuracy or confidential-data leakage.</li>
        </ul>
        <DocsHeading level={3}>Verify with synthetic retrieval</DocsHeading>
        <p className="mt-3 leading-7">Test denied queries, mixed eligible/excluded chunks, no eligible sources, redacted text, guard failures and blocked output. Observe which bytes reach the model. Verify tenant isolation and source freshness in your own retriever, and test the separate grounding/approval workflow only under its actual authentication contract.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/python" className="button-primary gap-2">Python SDK Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/botpress" className="button-secondary gap-2">Botpress Guide <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/rest-api" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← REST API</Link>
        <Link href="/docs/botpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Botpress →</Link>
      </div>
    </DocsPageShell>
  );
}

