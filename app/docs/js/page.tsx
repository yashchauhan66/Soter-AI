import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI JavaScript/TypeScript SDK Guide - Protect Your AI Chatbot",
  description:
    "Complete JavaScript/TypeScript SDK guide for SoterAI. Learn to install, configure, and use the @soterai/core package to protect Node.js, Deno, and Bun applications from prompt injection and PII leaks. Includes Next.js and Express.js examples.",
  alternates: { canonical: "/docs/js" },
  openGraph: {
    title: "SoterAI JavaScript/TypeScript SDK Guide",
    description: "Protect your Node.js, Deno, or Bun applications from AI security threats with the @soterai/core package.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "JavaScript/TypeScript SDK", item: "https://soterai.publicvm.com/docs/js" },
  ],
};

const installCode = `npm install @soterai/core`;
const envCode = `# 📁 .env file - server-side only!
SOTER_API_KEY=ck_live_your_key_here
SOTER_PROJECT_ID=                        # optional - for multi-project setups`;
const basicCode = `import { Soter } from "@soterai/core";

// Initialize once - reuse for all requests
const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,  // optional
  timeoutMs: 5000,  // 5 second timeout
});

// Protect a single user input before it reaches your LLM
const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  // 🛑 Input is dangerous! Don't call the LLM
  console.log("Blocked by Soter:", result.reason);
  return { blocked: true, reason: result.reason };
}

// ✅ Safe to proceed
return callYourLLM(result.safeText ?? userMessage);`;
const decisionHelpers = `soter.isAllowed(result);       // ✅ True = safe to forward
soter.shouldBlock(result);     // 🛑 True = stop (BLOCK or HUMAN_REVIEW)
soter.getSafeText(result, fallback);  // Returns safe/redacted text or fallback`;
const conversationCode = `// One-call helper: input guard → LLM → output guard
const { reply, blocked } = await soter.guardConversation({
  input: userMessage,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});

// reply = safe/redacted LLM response
// blocked = true if either guard blocked`;
const fullExampleCode = `import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
  timeoutMs: 5000,
  retries: 2,  // auto-retry on transient errors
});

async function handleChatMessage(userMessage: string) {
  try {
    // 1. Guard user input
    const inputResult = await soter.protect({
      input: userMessage,
      context: { sessionId: crypto.randomUUID() },
    });

    if (!inputResult.allowed) {
      return { reply: inputResult.safeText ?? "Message blocked.", blocked: true };
    }

    // 2. Call your LLM with safe text
    const safeInput = inputResult.safeText ?? userMessage;
    const llmReply = await callYourLLM(safeInput);

    // 3. Guard model output
    const outputResult = await soter.guardOutput({ text: llmReply });

    return {
      reply: outputResult.safeText ?? outputResult.redactedText ?? llmReply,
      blocked: !outputResult.allowed,
      riskScore: outputResult.riskScore,
    };
  } catch (error) {
    // Decide: fail open (allow) or fail closed (block)
    console.error("SoterAI error:", error);
    return { reply: "Service unavailable. Please try again.", blocked: false };
  }
}`;
const errorCode = `import {
  SoterError,
  SoterAuthError,
  SoterRateLimitError,
  SoterValidationError,
  SoterNetworkError,
} from "@soterai/core";

try {
  await soter.guardInput({ text });
} catch (caught) {
  if (caught instanceof SoterRateLimitError) {
    // Retry after caught.retryAfter seconds
    console.log(\`Rate limited. Retry after \${caught.retryAfter}s\`);
  } else if (caught instanceof SoterAuthError) {
    // 401/403 - check your API key
    console.error("Auth error - check your API key");
  } else if (caught instanceof SoterNetworkError) {
    // Network timeout or connection refused
    console.error("Network error - is your server reachable?");
  } else if (caught instanceof SoterValidationError) {
    // Bad request - check the payload shape
    console.error("Validation error - check payload fields");
  }
}`;

export default function JSDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        
        <p className="eyebrow mt-6">Language guide</p>
        <h1 className="mt-3 text-4xl font-bold">JavaScript / TypeScript SDK</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          The <InlineCode>@soterai/core</InlineCode> package is the primary SDK for Node.js (≥18.18), 
          Deno, Bun, and any JavaScript backend. It provides input/output guarding, 
          conversation protection, and framework-specific helpers.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install the package</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Open your terminal and run:
          </p>
          <CodeBlock language="bash" title="npm install">{installCode}</CodeBlock>
          <TipBox>
            <strong>Using Deno or Bun?</strong> You can also install via 
            <InlineCode>deno add npm:@soterai/core</InlineCode> or 
            <InlineCode>bun add @soterai/core</InlineCode>.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Configure environment</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Add these to your <InlineCode>.env</InlineCode> file:
          </p>
          <CodeBlock language="bash" title=".env">{envCode}</CodeBlock>
          <WarnBox>
            <strong>Never expose the API key in browser code.</strong> Do not prefix with 
            <InlineCode>NEXT_PUBLIC_</InlineCode>. The SDK warns if it detects a browser environment. 
            Always call SoterAI from your backend server.
          </WarnBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Basic usage (guarding user input)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Protect a single user message before it reaches your AI model:
          </p>
          <CodeBlock language="typescript" title="basic input guard" showLineNumbers>{basicCode}</CodeBlock>
          
          <h3 className="mt-8 text-xl font-bold">Decision helpers</h3>
          <p className="mt-3 leading-7 text-slate-400">
            The SDK provides convenient helpers for common decision patterns:
          </p>
          <CodeBlock language="typescript">{decisionHelpers}</CodeBlock>

          <h3 className="mt-8 text-xl font-bold">One-call conversation helper</h3>
          <p className="mt-3 leading-7 text-slate-400">
            Runs <strong>input guard → LLM call → output guard</strong> in a single call:
          </p>
          <CodeBlock language="typescript" title="conversation helper">{conversationCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 4: Complete example with error handling</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Here&apos;s a production-ready example that guards both input and output, handles errors,
            and decides whether to fail open or fail closed:
          </p>
          <CodeBlock language="typescript" title="production-ready handler" showLineNumbers>{fullExampleCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Framework integrations</h2>
          
          <h3 className="mt-8 text-xl font-bold">Next.js</h3>
          <p className="mt-3 leading-7 text-slate-400">
            Use the <InlineCode>createGuardedRoute</InlineCode> helper from <InlineCode>@soterai/core/next</InlineCode>:
          </p>
          <CodeBlock language="typescript" title="app/api/chat/route.ts">{`// One-line route handler
import { createGuardedRoute } from "@soterai/core/next";

export const runtime = "nodejs";

export const POST = createGuardedRoute({
  apiKey: process.env.SOTER_API_KEY!,
  callLLM: async (safeInput) => myLLMCall(safeInput),
});`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            See the <Link href="/docs/nextjs" className="text-cyan underline">Next.js guide</Link> for more details.
          </p>

          <h3 className="mt-8 text-xl font-bold">Express.js</h3>
          <p className="mt-3 leading-7 text-slate-400">
            Use <InlineCode>soterInputMiddleware</InlineCode> and <InlineCode>soterOutputMiddleware</InlineCode>:
          </p>
          <CodeBlock language="typescript" title="Express middleware">{`import { soterInputMiddleware, soterOutputMiddleware } from "@soterai/core/express";

app.post(
  "/chat",
  soterInputMiddleware({ apiKey: process.env.SOTER_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Error handling</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The SDK exports typed error classes for each failure mode:
          </p>
          <CodeBlock language="typescript" title="error handling">{errorCode}</CodeBlock>
          <TipBox>
            Set <InlineCode>retries: 2</InlineCode> in the constructor to auto-retry transient 
            5xx/network errors with exponential backoff.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Security best practices</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["API key is never logged", "Even with debug: true, the SDK never logs the API key or raw text."],
              ["Browser detection", "The constructor warns if it detects a browser environment."],
              ["Safe error messages", "Errors never include the API key in their messages."],
              ["Always guard output too", "The input guard is not enough. Always guard the model output as well."],
              ["Set a timeout", "Use timeoutMs: 5000 to prevent hanging requests."],
              ["Handle failures gracefully", "Decide if your app should fail open (allow traffic) or fail closed (block traffic) when SoterAI is unreachable."],
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
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/python" className="button-primary gap-2">
                Python Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/nextjs" className="button-secondary gap-2">
                Next.js Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/express" className="button-secondary gap-2">
                Express.js Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/quickstart" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Quickstart</Link>
          <Link href="/docs/python" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Python Guide →</Link>
        </div>
      </div>
    </main>
  );
}
