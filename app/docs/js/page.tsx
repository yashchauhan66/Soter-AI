import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const installCode = `npm install @soter/core`;
const envCode = `SOTER_API_KEY=ck_live_your_key_here   # server-side only
SOTER_BASE_URL=https://api.your-soter-host.example
SOTER_PROJECT_ID=                        # optional`;
const basicCode = `import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 5000,
});

const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  console.log("Blocked by Soter:", result.reason);
}

// Continue to the model only after Soter allows the input.`;
const decisionHelpers = `soter.isAllowed(result);    // safe to forward
soter.shouldBlock(result);  // stop (BLOCK or HUMAN_REVIEW or !allowed)
soter.getSafeText(result, fallback);  // safeText ?? redactedText ?? fallback`;
const conversationCode = `const { reply, blocked } = await soter.guardConversation({
  input: userMessage,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});`;
const errorCode = `import {
  SoterError,
  SoterAuthError,
  SoterRateLimitError,
  SoterValidationError,
  SoterNetworkError,
} from "@soter/core";

try {
  await soter.guardInput({ text });
} catch (caught) {
  if (caught instanceof SoterRateLimitError) {
    // caught.retryAfter (seconds) when provided
  } else if (caught instanceof SoterAuthError) {
    // 401/403 — check the key/project
  }
}`;

export default function JSDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Language guide</p>
        <h1 className="mt-3 text-4xl font-bold">JavaScript / TypeScript</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          The <InlineCode>@soter/core</InlineCode> package is the primary SDK for Node.js (≥18.18), Deno, Bun, and browser-based server routes.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install</h2>
          <CodeBlock language="bash">{installCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Environment</h2>
          <CodeBlock language="bash">{envCode}</CodeBlock>
          <p className="mt-3 text-sm text-amber-200">
            Never expose the API key in browser/client code. Do not prefix it with <InlineCode>NEXT_PUBLIC_</InlineCode>.
            Call Soter from a server route or proxy.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Basic Usage</h2>
          <p className="mt-3 text-slate-400">Protect a single user input before it reaches your LLM:</p>
          <CodeBlock language="typescript">{basicCode}</CodeBlock>

          <h3 className="mt-8 font-semibold">Decision Helpers</h3>
          <CodeBlock language="typescript">{decisionHelpers}</CodeBlock>

          <h3 className="mt-8 font-semibold">One-Call Conversation</h3>
          <p className="mt-2 text-sm text-slate-400">Runs input guard → LLM → output guard in a single call:</p>
          <CodeBlock language="typescript">{conversationCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Next.js</h2>
          <p className="mt-3 text-slate-400">
            Use the <InlineCode>createGuardedRoute</InlineCode> helper from <InlineCode>@soter/core/next</InlineCode>:
          </p>
          <CodeBlock language="typescript">{`// app/api/chat/route.ts
import { createGuardedRoute } from "@soter/core/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  baseUrl: process.env.SOTER_BASE_URL!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/nextjs" className="text-cyan underline">Next.js guide</Link> for details.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Express.js</h2>
          <p className="mt-3 text-slate-400">
            Use the <InlineCode>soterInputMiddleware</InlineCode> and <InlineCode>soterOutputMiddleware</InlineCode> from <InlineCode>@soter/core/express</InlineCode>:
          </p>
          <CodeBlock language="typescript">{`import { soterInputMiddleware, soterOutputMiddleware } from "@soter/core/express";

app.post(
  "/chat",
  soterInputMiddleware({ apiKey: process.env.SOTER_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted; blocked requests already responded.
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Error Handling</h2>
          <CodeBlock language="typescript">{errorCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            Set <InlineCode>retries: 2</InlineCode> in the constructor to auto-retry transient 5xx/network errors with backoff.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Security Notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>The API key and raw text are never logged, even with <InlineCode>debug: true</InlineCode>.</li>
            <li>The constructor warns if it detects a browser environment.</li>
            <li>Errors never include the API key.</li>
            <li>Always run the <strong>output</strong> guard, not just the input guard.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Docs Hub</Link>
          <Link href="/docs/python" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Python Guide →</Link>
        </div>
      </div>
    </main>
  );
}
