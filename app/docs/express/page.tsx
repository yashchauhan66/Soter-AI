import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Express.js Integration: AI Security Middleware",
  description: "Add input and output checks to an Express chat route. Correct middleware ordering, server configuration and safe error handling with the SoterAI SDK.",
  alternates: { canonical: "/docs/express" },
};

const installCode = `npm install @soterai/core express`;
const envCode = `# Inject into the server process; the SDK does not load .env files.
SOTER_API_KEY=replace_with_your_project_key
SOTER_BASE_URL=https://api.soterai.in
# Optional metadata; authentication still selects the API key's project.
SOTER_PROJECT_ID=`;
const basicCode = `// server.js (ES module); use your application's existing listener.
import express from "express";
import { Soter } from "@soterai/core";
import { callLLM } from "./llm.js"; // Your adapter: (text) => Promise<string>

// Application transport policy: validate raw JSON BEFORE SDK normalization.
const strictGuardFetch = async (url, init) => {
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

const app = express();
app.use(express.json({ limit: "32kb" }));
const soter = new Soter({ timeoutMs: 8000, retries: 0, fetch: strictGuardFetch });

app.post("/chat", async (req, res, next) => {
  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 8000) {
    return res.status(400).json({ blocked: true, reply: "Invalid message." });
  }
  try {
    const input = await soter.protect({ input: message });
    if (!soter.shouldCallLLM(input)) {
      return res.status(403).json({ blocked: true, reply: "Message withheld." });
    }
    const safeInput = input.safeText ?? input.redactedText ??
      (input.action === "ALLOW" ? message : undefined);
    if (typeof safeInput !== "string" || !safeInput.trim()) {
      throw new Error("No usable input after guarding");
    }
    const llmReply = await callLLM(safeInput);
    const output = await soter.guardOutput({ text: llmReply });
    if (!soter.shouldCallLLM(output)) {
      return res.status(403).json({ blocked: true, reply: "Response withheld." });
    }
    const reply = output.safeText ?? output.redactedText ??
      (output.action === "ALLOW" ? llmReply : undefined);
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("No usable output after guarding");
    }
    return res.json({ blocked: false, reply });
  } catch (error) {
    next(error); // Express 4 and 5: forward async failures explicitly.
  }
});

// Keep all four parameters: Express identifies error handlers by arity.
app.use((error, req, res, next) => {
  const status = error?.type === "entity.parse.failed" ? 400 :
    error?.type === "entity.too.large" ? 413 : 503;
  res.status(status).json({ blocked: true, reply: "Chat unavailable or invalid request." });
});
export default app;`;
const middlewareCode = `// Alternative server.js; do not register alongside the manual /chat route.
import express from "express";
import { soterInputMiddleware, soterOutputMiddleware } from "@soterai/core/express";
import { callLLM } from "./llm.js";

// Application transport policy: validate raw JSON BEFORE SDK normalization.
const strictGuardFetch = async (url, init) => {
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
    if (!raw.allowed) {
      // Middleware sends denials before later application handlers run.
      // Never let guard-supplied text or diagnostics become the refusal.
      return new Response(JSON.stringify({
        allowed: false, action: raw.action, decision,
        safeText: "Response withheld.",
      }), { status: response.status, headers: { "Content-Type": "application/json" } });
    }
  }
  return response; // Preserve permitted replies and normal SDK error handling.
};

const app = express();
app.use(express.json({ limit: "32kb" }));
const apiKey = process.env.SOTER_API_KEY;
if (!apiKey) throw new Error("Set SOTER_API_KEY on the server");
const options = {
  fetch: strictGuardFetch,
  apiKey,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 8000,
  retries: 0,
};

app.post(
  "/chat",
  (req, res, next) => {
    if (typeof req.body?.message !== "string" ||
        !req.body.message.trim() || req.body.message.length > 8000) {
      return res.status(400).json({ blocked: true, reply: "Invalid message." });
    }
    next();
  },
  soterInputMiddleware({ ...options, field: "message", rewriteBody: true }),
  async (req, res, next) => {
    try {
      // The input middleware has replaced message with safe/redacted text.
      res.locals.aiResponse = await callLLM(req.body.message);
      next(); // Do not send JSON yet: output inspection comes next.
    } catch (error) { next(error); }
  },
  soterOutputMiddleware({ ...options, field: "aiResponse", rewriteBody: true }),
  (req, res) => res.json({ blocked: false, reply: res.locals.aiResponse }),
);

app.use((error, req, res, next) => {
  const status = error?.type === "entity.parse.failed" ? 400 :
    error?.type === "entity.too.large" ? 413 : 503;
  res.status(status).json({ blocked: true, reply: "Chat unavailable or invalid request." });
});
export default app;`;

export default function ExpressDocsPage() {
  return (
    <DocsPageShell path="/docs/express">
      <section className="docs-section">
        <DocsHeading>Step 1: Install</DocsHeading>
        <p className="mt-3 leading-7">Use a server-side Express application and Node.js 18.18 or newer for the SDK. Check your Express version&apos;s runtime requirements separately. The examples use ES modules; keep your existing server bootstrap and supply a model adapter that returns a complete string.</p>
        <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        <CodeBlock language="bash" title="server environment">{envCode}</CodeBlock>
        <TipBox>Load local environment files through your application bootstrap or deployment tooling. Keep the key out of browser bundles, source control and logs. Neither middleware authenticates the people using your chat endpoint.</TipBox>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 2: Basic usage</DocsHeading>
        <p className="mt-3 leading-7">Validate the message, guard input, call the model with permitted text and guard its output before serialization. Both examples include an application-owned <InlineCode>strictGuardFetch</InlineCode> before SDK normalization: raw <InlineCode>allowed</InlineCode> must be boolean, the action and optional decision must agree, and redaction/rewrite must supply nonblank replacement text. Only an explicit true grant with an allowlisted action continues. Keep this adapter on both middleware calls; the SDK fallback alone can reuse original text.</p>
        <CodeBlock language="javascript" title="server.js · manual route" showLineNumbers>{basicCode}</CodeBlock>
        <p className="mt-3 leading-7">The manual route chooses 403 for a content denial and 503 for operational failure. The 8,000-character bound matches the guard server&apos;s default; the 32 KB parser limit is an independent application limit. Tune both for your deployment rather than removing validation.</p>
        <p className="mt-3 leading-7">If you pass <InlineCode>context.userId</InlineCode> or <InlineCode>context.sessionId</InlineCode> to <InlineCode>protect</InlineCode>, derive them from authenticated application state. Express does not create <InlineCode>req.user</InlineCode> or <InlineCode>req.session</InlineCode> automatically. Pass the same conversation ID to output checks when you need correlation.</p>
      </section>
      <section className="docs-section">
        <DocsHeading id="step-3-use-middleware-recommended">Step 3: Use input and output middleware</DocsHeading>
        <p className="mt-3 leading-7">Order matters: parse and validate → input middleware → model → output middleware → response. These middleware functions inspect specific text fields; they do not intercept every <InlineCode>res.json</InlineCode> call.</p>
        <CodeBlock language="javascript" title="server.js · middleware alternative" showLineNumbers>{middlewareCode}</CodeBlock>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li><InlineCode>soterInputMiddleware</InlineCode> reads <InlineCode>req.body.message</InlineCode> by default and rewrites that field when <InlineCode>rewriteBody</InlineCode> is true, the default.</li>
          <li><InlineCode>soterOutputMiddleware</InlineCode> reads <InlineCode>res.locals.aiResponse</InlineCode>, falling back to the same field on the request body. It rewrites <InlineCode>res.locals</InlineCode>; put model output there, not in a client-controlled field.</li>
          <li>Both expose results on <InlineCode>req.soter.inputResult</InlineCode> / <InlineCode>outputResult</InlineCode>, with legacy <InlineCode>req.cyberrakshak</InlineCode> aliases. Keep full diagnostics off the public response.</li>
          <li>A missing text field returns 400. A block or human-review verdict ends the middleware chain with HTTP 200 and <InlineCode>blocked: true</InlineCode>. Guard errors go to <InlineCode>next(error)</InlineCode>; the final handler above withholds the response.</li>
          <li>The input middleware forwards body metadata, not user/session IDs. For trusted identity context on both checks, use the manual flow.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>Example project</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>examples/express-chatbot</InlineCode> is a historical starter. Its named <InlineCode>createExpressMiddleware</InlineCode> import is not exported by the current <InlineCode>@soterai/core/express</InlineCode> entry point. Use the two current middleware exports shown above, or the <InlineCode>Soter.createExpressMiddleware</InlineCode> instance method documented in the JavaScript SDK guide.</p>
        <DocsHeading level={3}>Verify the application boundary</DocsHeading>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
          <li>Check allowed and redacted messages, blocked input, blocked output and human review. Assert that the model never runs on denied input.</li>
          <li>Simulate a timeout or non-2xx guard response. Confirm the error handler runs and does not echo the model text, request body or exception details.</li>
          <li>Add user authentication, per-user/IP abuse controls and output encoding. RAG authorization and tool permissions remain separate application responsibilities.</li>
          <li>These examples buffer complete strings. WebSocket and SSE paths need their own pre-release output gate; inspecting text after streaming cannot retract it.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/js" className="button-primary gap-2">JavaScript SDK <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/fastapi" className="button-secondary gap-2">FastAPI Guide <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/nextjs" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Next.js Guide</Link>
        <Link href="/docs/fastapi" className="text-sm text-cyan hover:text-cyan/80 transition-colors">FastAPI Guide →</Link>
      </div>
    </DocsPageShell>
  );
}

