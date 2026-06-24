import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Next.js Integration Guide - Protect Your AI Chat Routes",
  description:
    "Complete Next.js integration guide for SoterAI. Learn to protect App Router route handlers, server actions, and AI chat endpoints with input/output guards, createGuardedRoute helper, and middleware.",
  alternates: { canonical: "/docs/nextjs" },
  openGraph: {
    title: "SoterAI Next.js Integration Guide",
    description: "Protect your Next.js App Router routes and server actions from prompt injection and PII leaks.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Next.js", item: "https://soterai.publicvm.com/docs/nextjs" },
  ],
};

const installCode = `npm install @soterai/core`;
const envCode = `# 📁 .env.local - server-side only!
SOTER_API_KEY=ck_live_your_key_here
SOTER_PROJECT_ID=                        # optional`;
const routeHandler = `// app/api/chat/route.ts
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
});

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. Guard user input before LLM
  const result = await soter.protect({
    input: body.message,
    context: { sessionId: body.sessionId },
  });

  if (!result.allowed) {
    // 🛑 Blocked before LLM is called
    return Response.json(
      { blocked: true, reason: result.reason },
      { status: 403 },
    );
  }

  // 2. Call LLM with safe text
  const safeMessage = result.safeText ?? body.message;
  const llmReply = await callYourLLM(safeMessage);
  
  // 3. Guard model output before user sees it
  const output = await soter.guardOutput({ text: llmReply });

  return Response.json({
    reply: output.safeText ?? output.redactedText ?? llmReply,
    blocked: !output.allowed,
  });
}`;
const oneLiner = `// app/api/chat/route.ts — one-line guarded route
import { createGuardedRoute } from "@soterai/core/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});

// The browser sends { message } and receives { reply, blocked }`;
const serverActionCode = `"use server";
import { Soter } from "@soterai/core";
import { revalidatePath } from "next/cache";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

export async function submitMessage(formData: FormData) {
  const message = formData.get("message") as string;
  
  // Guard the input inside the server action
  const result = await soter.protect({
    input: message,
    context: { sessionId: crypto.randomUUID() },
  });

  if (!result.allowed) {
    return { error: "Message blocked", reason: result.reason };
  }

  // Only call the LLM if the input is safe
  const reply = await callLLM(result.safeText ?? message);
  revalidatePath("/chat");
  return { reply };
}`;
const clientComponent = `// app/chat/page.tsx
"use client";
import { useState } from "react";

export default function ChatPage() {
  const [reply, setReply] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    
    // Send to YOUR server, not directly to SoterAI
    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ 
        message: form.get("message") 
      }),
      headers: { "Content-Type": "application/json" },
    });
    
    const data = await res.json();
    setReply(data.reply ?? data.reason);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input 
        name="message" 
        placeholder="Type your message..."
        className="input"
      />
      <button type="submit" className="button-primary">
        Send
      </button>
      {reply && <p className="text-slate-300">{reply}</p>}
    </form>
  );
}`;

export default function NextjsDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">Next.js Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your Next.js chatbot with route handler helpers, server actions, and the one-line 
          <InlineCode>createGuardedRoute</InlineCode> wrapper. Works with both App Router and Pages Router.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install</h2>
          <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Environment variables</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Add these to your <InlineCode>.env.local</InlineCode> file:
          </p>
          <CodeBlock language="bash" title=".env.local">{envCode}</CodeBlock>
          <WarnBox>
            <strong>Never use NEXT_PUBLIC_ prefix for SoterAI keys.</strong> API keys prefixed with 
            <InlineCode>NEXT_PUBLIC_</InlineCode> are exposed to the browser. Always keep SoterAI credentials 
            server-side only.
          </WarnBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Route Handler (manual control)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Full control over the guard flow in your API route:
          </p>
          <CodeBlock language="typescript" title="app/api/chat/route.ts" showLineNumbers>{routeHandler}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 4: One-line helper (recommended)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Use <InlineCode>createGuardedRoute</InlineCode> from <InlineCode>@soterai/core/next</InlineCode> 
            for a minimal setup:
          </p>
          <CodeBlock language="typescript" title="app/api/chat/route.ts">{oneLiner}</CodeBlock>
          <TipBox>
            The <InlineCode>createGuardedRoute</InlineCode> helper automatically handles input guard → LLM → 
            output guard flow. The browser sends <InlineCode>{`{ message }`}</InlineCode> and receives 
            <InlineCode>{`{ reply, blocked }`}</InlineCode>. The API key never leaves your server.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 5: Server Actions</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Guard inputs directly in server actions without exposing the API key:
          </p>
          <CodeBlock language="typescript" title="server action" showLineNumbers>{serverActionCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 6: Client component (safe pattern)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The client component only talks to <strong>your</strong> server, never to SoterAI directly:
          </p>
          <CodeBlock language="typescript" title="app/chat/page.tsx" showLineNumbers>{clientComponent}</CodeBlock>
          <TipBox>
            The API key stays server-side. The client browser only sends the message text to your own 
            route handler. Your server then calls SoterAI securely.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Key points for Next.js developers</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Don't use NEXT_PUBLIC_", "SoterAI API keys must never be exposed to the browser."],
              ["Always guard both ways", "Protect both input (before LLM) and output (after LLM)."],
              ["Use Route Handlers", "Route handlers run server-side and are perfect for SoterAI integration."],
              ["Server Actions work too", "Guard messages directly in server actions for form-based chat."],
              ["App Router recommended", "All examples use the App Router, but the basic pattern works with Pages Router too."],
              ["Example project", "See examples/nextjs-chatbot for a complete working Next.js example."],
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
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/js" className="button-primary gap-2">
                JavaScript SDK <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/express" className="button-secondary gap-2">
                Express.js Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/rest-api" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← REST API</Link>
          <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Express.js Guide →</Link>
        </div>
      </div>
    </main>
  );
}
