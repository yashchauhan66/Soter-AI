import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const installCode = `npm install @soter/core`;
const envCode = `SOTER_API_KEY=ck_live_your_key_here
SOTER_BASE_URL=https://api.your-soter-host.example
SOTER_PROJECT_ID=                        # optional`;
const routeHandler = `// app/api/chat/route.ts
import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
  baseUrl: process.env.SOTER_BASE_URL,
});

export async function POST(req: Request) {
  const body = await req.json();
  const result = await soter.protect({
    input: body.message,
  });

  if (!result.allowed) {
    return Response.json(
      { blocked: true, reason: result.reason },
      { status: 403 },
    );
  }

  // Continue with the model call here.
}`;
const oneLiner = `// app/api/chat/route.ts
import { createGuardedRoute } from "@soter/core/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});`;
const serverAction = `"use server";
import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

export async function submitMessage(formData: FormData) {
  const message = formData.get("message") as string;
  const result = await soter.protect({
    input: message,
    context: { sessionId: crypto.randomUUID() },
  });

  if (!result.allowed) {
    return { error: "Message blocked", reason: result.reason };
  }

  return callLLM(result.safeText ?? message);
}`;

export default function NextjsDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">Next.js Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your Next.js chatbot with route handler helpers, server actions, and the one-line <InlineCode>createGuardedRoute</InlineCode> wrapper.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install</h2>
          <CodeBlock language="bash">{installCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{envCode}</CodeBlock>
          <p className="mt-3 text-sm text-amber-200">
            Do <strong>not</strong> prefix API keys with <InlineCode>NEXT_PUBLIC_</InlineCode>. Server-side only.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Route Handler (Manual)</h2>
          <p className="mt-3 text-slate-400">Full control over the guard flow in your API route:</p>
          <CodeBlock language="typescript">{routeHandler}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">One-Line Helper</h2>
          <p className="mt-3 text-slate-400">Use <InlineCode>createGuardedRoute</InlineCode> from <InlineCode>@soter/core/next</InlineCode> for a minimal setup:</p>
          <CodeBlock language="typescript">{oneLiner}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            The browser only ever sends <InlineCode>{`{ message }`}</InlineCode> and receives <InlineCode>{`{ reply, blocked }`}</InlineCode>.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Server Actions</h2>
          <p className="mt-3 text-slate-400">Guard inputs directly in server actions:</p>
          <CodeBlock language="typescript">{serverAction}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Client-Side (Safe)</h2>
          <CodeBlock language="typescript">{`// app/chat/page.tsx (Client Component)
"use client";
import { useState } from "react";

export default function ChatPage() {
  const [reply, setReply] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: form.get("message") }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setReply(data.reply ?? data.reason);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="message" />
      <button type="submit">Send</button>
      <p>{reply}</p>
    </form>
  );
}`}</CodeBlock>
          <p className="mt-3 text-sm text-amber-200">
            The API key stays server-side. The client only sends the message text.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Example Project</h2>
          <p className="mt-3 text-slate-400">
            A complete working example is available at <InlineCode>examples/nextjs-chatbot</InlineCode>.
          </p>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/python" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Python Guide</Link>
          <Link href="/docs/express" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Express.js Guide →</Link>
        </div>
      </div>
    </main>
  );
}
