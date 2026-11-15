import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Next.js Integration: Protect AI Chat Routes",
  description:
    "Set up server-side input and output checks in Next.js routes and server actions, with explicit denial, error and public-response handling.",
  alternates: { canonical: "/docs/nextjs" },
  openGraph: {
    images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
    title: "SoterAI Next.js Integration Guide",
    description: "Server-side chat checks, safe continuation and integration boundaries for Next.js.",
  },
};

const installCode = `npm install @soterai/core`;
const envCode = `# .env.local: keep this file out of version control
SOTER_API_KEY=replace_with_your_project_key
# Optional: the SDK defaults to https://api.soterai.in
SOTER_BASE_URL=https://api.soterai.in
# Optional correlation metadata; this does not change the key's project
SOTER_PROJECT_ID=`;
const routeHandler = `// app/api/chat/route.ts
import { Soter } from "@soterai/core";
import { callYourLLM } from "@/lib/llm"; // Your adapter: (text) => Promise<string>

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

const soter = new Soter({
  fetch: strictGuardFetch,
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON", blocked: true }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !("message" in body) || typeof body.message !== "string" ||
      !body.message.trim() || body.message.length > 8000) {
    return Response.json({ error: "message must contain 1–8000 characters", blocked: true }, { status: 400 });
  }

  // Authenticate and rate-limit in your application before this flow.
  try {
    const input = await soter.protect({ input: body.message });
    if (!soter.shouldCallLLM(input)) {
      return Response.json({ reply: "Message withheld.", blocked: true }, { status: 403 });
    }
    const safeMessage = input.safeText ?? input.redactedText ??
      (input.action === "ALLOW" ? body.message : undefined);
    if (typeof safeMessage !== "string" || !safeMessage.trim()) {
      return Response.json({ reply: "Message withheld.", blocked: true }, { status: 503 });
    }

    const llmReply = await callYourLLM(safeMessage);
    const output = await soter.guardOutput({ text: llmReply });
    if (!soter.shouldCallLLM(output)) {
      return Response.json({ reply: "Response withheld.", blocked: true }, { status: 403 });
    }
    const reply = output.safeText ?? output.redactedText ??
      (output.action === "ALLOW" ? llmReply : undefined);
    if (typeof reply !== "string" || !reply.trim()) {
      return Response.json({ reply: "Response withheld.", blocked: true }, { status: 503 });
    }
    return Response.json({ reply, blocked: false });
  } catch {
    // Includes guard/network errors and model failures. Do not echo exceptions.
    return Response.json({ reply: "Chat temporarily unavailable.", blocked: true }, { status: 503 });
  }
}`;
const oneLiner = `// Alternative app/api/chat/route.ts; do not combine with the manual POST.
import { createGuardedRoute } from "@soterai/core/next";
import { myLLMCall } from "@/lib/llm"; // Your async string-returning model adapter

export const runtime = "nodejs";

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

const guarded = createGuardedRoute({
  fetch: strictGuardFetch,
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 8000,
  retries: 0,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});

// The SDK also returns diagnostics. Project only a minimal public response.
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ blocked: true, reply: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !("message" in body) || typeof body.message !== "string" ||
      !body.message.trim() || body.message.length > 8000) {
    return Response.json({ blocked: true, reply: "Invalid message." }, { status: 400 });
  }
  try {
    // Only forward validated fields; resolve identity in your application.
    const response = await guarded(new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body.message }),
    }));
    if (!response.ok) throw new Error("Guarded route failed");
    const data = await response.json();
    if (data.blocked !== false || typeof data.reply !== "string") {
      return Response.json({ blocked: true, reply: "Response withheld." });
    }
    return Response.json({ blocked: false, reply: data.reply });
  } catch {
    return Response.json({ blocked: true, reply: "Chat temporarily unavailable." }, { status: 503 });
  }
}`;
const serverActionCode = `"use server";
import { Soter } from "@soterai/core";
import { revalidatePath } from "next/cache";
import { callLLM } from "@/lib/llm"; // Your async string-returning model adapter

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

const soter = new Soter({
  fetch: strictGuardFetch,
  apiKey: process.env.SOTER_API_KEY,
});

export async function submitMessage(formData: FormData) {
  const message = formData.get("message");
  if (typeof message !== "string" || !message.trim() || message.length > 8000) {
    return { blocked: true, error: "Enter a message of 1–8000 characters." };
  }
  // Resolve the authenticated user and conversation before calling the SDK.
  try {
    const result = await soter.protectChat({ message, callLLM });
    if (result.blocked) {
      return { blocked: true, error: "Message or response withheld." };
    }
    revalidatePath("/chat");
    return { blocked: false, reply: result.safeResponse };
  } catch {
    return { blocked: true, error: "Chat temporarily unavailable." };
  }
}`;
const clientComponent = `// app/chat/page.tsx
"use client";
import { useState, type FormEvent } from "react";

export default function ChatPage() {
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      // Only your backend receives the message. Never put the API key here.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: form.get("message") }),
      });
      if (!res.ok) { setReply("Chat unavailable or message withheld."); return; }
      const data = await res.json();
      setReply(data.blocked === false && typeof data.reply === "string"
        ? data.reply : "Response withheld.");
    } catch {
      setReply("Chat temporarily unavailable. Try again later.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="message">Message</label>
      <input id="message" name="message" required maxLength={8000} />
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      <p role="status">{reply}</p>
    </form>
  );
}`;

export default function NextjsDocsPage() {
  return (
    <DocsPageShell path="/docs/nextjs">
      <section className="docs-section">
        <DocsHeading>Step 1: Install</DocsHeading>
        <p className="mt-3 leading-7">Use an existing App Router application with a Node.js server runtime. The SDK package declares Node.js 18.18 or newer; your Next.js version may require a newer runtime.</p>
        <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        <p className="mt-3 leading-7">Choose either the manual route or the helper route below. Both require your own model adapter returning a complete string, plus application authentication and abuse controls. The SDK does not call a model for you.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 2: Environment variables</DocsHeading>
        <p className="mt-3 leading-7">Set the project key in <InlineCode>.env.local</InlineCode> for local development and in your deployment&apos;s server secret store. <InlineCode>new Soter()</InlineCode> reads these variables; the route factory requires an explicit <InlineCode>apiKey</InlineCode>.</p>
        <CodeBlock language="bash" title=".env.local">{envCode}</CodeBlock>
        <TipBox>Never prefix a SoterAI key with <InlineCode>NEXT_PUBLIC_</InlineCode> or import the server client into a Client Component. A missing key is a configuration error, not a reason to bypass the guard.</TipBox>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 3: Route Handler (manual control)</DocsHeading>
        <p className="mt-3 leading-7">The route checks request JSON, guards input and waits for an output verdict before replying. Each server example includes an application-owned <InlineCode>strictGuardFetch</InlineCode>: it validates the raw boolean and action before SDK normalization and requires nonblank replacement text for redaction or rewrite. Only <InlineCode>allowed === true</InlineCode> with <InlineCode>ALLOW</InlineCode>, <InlineCode>ALLOW_WITH_REDACTION</InlineCode> or <InlineCode>REWRITE</InlineCode> permits continuation. Do not remove this adapter: the SDK helpers alone use permissive verdict handling and can fall back to original text.</p>
        <CodeBlock language="typescript" title="app/api/chat/route.ts" showLineNumbers>{routeHandler}</CodeBlock>
        <p className="mt-3 leading-7">Here, invalid input returns 400, a content denial returns 403, and a guard or model failure returns 503. These are application response choices, not the raw guard API&apos;s status contract. The 8,000-character cap matches the server&apos;s default text limit; align it with your deployment and also bound HTTP body size upstream.</p>
      </section>
      <section className="docs-section">
        <DocsHeading id="step-4-one-line-helper-recommended">Step 4: Guarded-route helper</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>createGuardedRoute</InlineCode> from <InlineCode>@soterai/core/next</InlineCode> runs input guard → model callback → output guard. Its default input field is <InlineCode>message</InlineCode>; change it with <InlineCode>inputField</InlineCode> when using the factory directly.</p>
        <CodeBlock language="typescript" title="app/api/chat/route.ts · alternative">{oneLiner}</CodeBlock>
        <p className="mt-3 leading-7">The unwrapped helper returns HTTP 200 for completed turns, including blocked turns, with <InlineCode>reply</InlineCode>, <InlineCode>blocked</InlineCode>, <InlineCode>inputResult</InlineCode> and optional <InlineCode>outputResult</InlineCode>. Invalid JSON or an empty message returns 400; caught errors use their status or 500. It does not sanitize every diagnostic field or exception message. The wrapper above deliberately omits those fields and withholds failed responses.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 5: Server Actions</DocsHeading>
        <p className="mt-3 leading-7"><InlineCode>protectChat</InlineCode> performs both guard calls. Return an application-owned result rather than the complete guard objects. Revalidation happens only after an allowed reply.</p>
        <CodeBlock language="typescript" title="app/chat/actions.ts" showLineNumbers>{serverActionCode}</CodeBlock>
        <p className="mt-3 leading-7">A server action still needs authorization. If you add <InlineCode>userId</InlineCode> or <InlineCode>sessionId</InlineCode>, derive them from a trusted session and reuse the conversation identifier across turns. Do not treat browser-supplied IDs as proof of identity.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 6: Client component (safe pattern)</DocsHeading>
        <p className="mt-3 leading-7">The browser calls your route and renders text. It does not need a SoterAI key or the SDK. A denial or transport error never becomes an unguarded reply.</p>
        <CodeBlock language="typescript" title="app/chat/page.tsx" showLineNumbers>{clientComponent}</CodeBlock>
      </section>
      <section className="docs-section">
        <DocsHeading>Key points for Next.js developers</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Keep credentials server-side and apply authentication, per-user limits and payload validation before guard/model work.</li>
          <li>Use route handlers or server actions for the checks. Pages Router needs its own request/response adaptation; these examples use App Router.</li>
          <li>Guard the full model output before returning it. These examples buffer strings; they do not inspect tokens already streamed to the browser.</li>
          <li>RAG retrieval and tool execution need separate checks. Input/output guarding does not authorize a database read or a tool action.</li>
          <li><InlineCode>examples/nextjs-chatbot</InlineCode> contains a repository example. It only proxies an input guard call; it does not implement the complete model/output flow shown here.</li>
        </ul>
        <DocsHeading level={3}>Verify before deployment</DocsHeading>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
          <li>Exercise allowed, redacted, blocked and human-review verdicts; confirm denied input never reaches the model.</li>
          <li>Force an output denial and a guard timeout. Confirm neither the original completion nor an exception body reaches the browser.</li>
          <li>Check malformed JSON, missing messages, long input, model errors and missing configuration. Test your real provider adapter separately.</li>
        </ul>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/js" className="button-primary gap-2">JavaScript SDK <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/express" className="button-secondary gap-2">Express.js Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/rest-api" className="button-secondary gap-2">REST API <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/rest-api" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← REST API</Link>
        <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Express.js Guide →</Link>
      </div>
    </DocsPageShell>
  );
}
