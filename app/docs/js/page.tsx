import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, TipBox, WarnBox } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "JavaScript SDK Guide: Protect Your AI Chatbot",
  description:
    "Install and use the @soterai/core JavaScript SDK to protect Node.js, Deno and Bun apps from prompt injection and PII leaks. Next.js and Express examples.",
  alternates: { canonical: "/docs/js" },
  openGraph: {
    images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
    title: "SoterAI JavaScript/TypeScript SDK Guide",
    description: "Protect your Node.js, Deno, or Bun applications from AI security threats with the @soterai/core package.",
  },
};

const installCode = `npm install @soterai/core`;
const envCode = `# Server environment (load .env through your framework or environment loader)
SOTER_API_KEY=ck_test_replace_with_your_issued_key
SOTER_BASE_URL=https://api.soterai.in      # optional: SDK default
SOTER_PROJECT_ID=                        # optional: metadata only`;
const basicCode = `import { Soter } from "@soterai/core";

const soter = new Soter({ timeoutMs: 5000 }); // Reads server environment variables

export async function checkUserMessage(userMessage: string, sessionId: string) {
  const result = await soter.protect({
    input: userMessage,
    context: { sessionId }, // Use a stable, application-controlled conversation ID
  });
  if (result.allowed !== true || !soter.shouldCallLLM(result) || soter.shouldBlock(result)) {
    return { blocked: true as const };
  }
  const replacement = result.safeText ?? result.redactedText;
  const text = replacement ?? (result.action === "ALLOW" ? userMessage : undefined);
  if (typeof text !== "string") return { blocked: true as const };
  return { blocked: false as const, text };
}
// This checks input only. Guard model output as shown in the complete handler.
// SDK errors propagate to the caller; never resume with unchecked text.`;
const decisionHelpers = `soter.shouldCallLLM(result); // allowed + ALLOW / ALLOW_WITH_REDACTION / REWRITE
soter.shouldBlock(result);   // Stop for false allowed, BLOCK or HUMAN_REVIEW
soter.isAllowed(result);     // Convenience predicate, not a replacement for both checks
soter.getSafeText(result);   // Selects text; does not authorize forwarding
// getSafeInput/getSafeOutput/getSafeText can fall back to the original text.
// Use a fallback only after ALLOW, never after a block, review or missing rewrite.`;
const conversationCode = `import { Soter } from "@soterai/core";

const soter = new Soter({ timeoutMs: 5000 });

export async function handleConversation(
  userMessage: string,
  callYourLLM: (safeInput: string) => Promise<string>,
) {
  try {
    // The callback receives one string, not a context object.
    const { reply, blocked } = await soter.guardConversation({
      input: userMessage,
      callLLM: callYourLLM,
    });
    return { reply, blocked };
  } catch {
    return { reply: "Service unavailable. Please try again.", blocked: true };
  }
}`;
const fullExampleCode = `import { Soter, SoterError, type GuardResult } from "@soterai/core";

const soter = new Soter({ timeoutMs: 5000, retries: 2 });

function permittedText(result: GuardResult, original: string): string | null {
  if (result.allowed !== true || !soter.shouldCallLLM(result) || soter.shouldBlock(result)) {
    return null;
  }
  const replacement = result.safeText ?? result.redactedText;
  if (typeof replacement === "string") return replacement;
  return result.action === "ALLOW" ? original : null;
}

export async function handleChatMessage(
  userMessage: string,
  callYourLLM: (safeInput: string) => Promise<string>,
  sessionId?: string,
) {
  if (typeof userMessage !== "string" || !userMessage.trim()) {
    return { reply: "A non-empty message is required.", blocked: true };
  }
  try {
    const inputResult = await soter.protect({ input: userMessage, context: { sessionId } });
    const safeInput = permittedText(inputResult, userMessage);
    if (safeInput === null) return { reply: "Message withheld.", blocked: true };

    const llmReply = await callYourLLM(safeInput);
    const outputResult = await soter.guardOutput({ aiResponse: llmReply, sessionId });
    const reply = permittedText(outputResult, llmReply);
    if (reply === null) return { reply: "The model response was withheld.", blocked: true };

    return { reply, blocked: false, riskScore: outputResult.riskScore };
  } catch (error) {
    // Record codes/status only; upstream error details can contain sensitive text.
    if (error instanceof SoterError) console.error("Guard unavailable", error.code, error.status);
    return { reply: "Service unavailable. Please try again.", blocked: true };
  }
}`;
const errorCode = `import {
  Soter, SoterError, SoterAuthError, SoterRateLimitError,
  SoterValidationError, SoterNetworkError,
} from "@soterai/core";

const soter = new Soter();

export async function inspectInput(message: string) {
  try {
    return await soter.guardInput({ message });
  } catch (caught) {
    if (caught instanceof SoterRateLimitError) {
      // retryAfter is optional, in seconds. Schedule a bounded retry, not a bypass.
      console.error("Rate limited", caught.retryAfter);
    } else if (caught instanceof SoterAuthError) {
      // 401: key problem. 403 can also mean disabled project/org or governance.
      console.error("Access denied", caught.status);
    } else if (caught instanceof SoterNetworkError) {
      console.error("Guard transport unavailable");
    } else if (caught instanceof SoterValidationError) {
      console.error("Invalid guard request");
    } else if (caught instanceof SoterError) {
      console.error("Guard request failed", caught.status);
    }
    throw caught; // Caller must withhold the turn; do not treat an error as ALLOW.
  }
}`;
const nextCode = `import { resolveSoterConfig } from "@soterai/core";
import { createGuardedRoute } from "@soterai/core/next";
import { callYourLLM } from "./llm"; // Supply your server-side provider adapter

export const runtime = "nodejs";

// Validate raw responses before the factory can forward input or model output.
const strictGuardFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) {
    const payload: unknown = await response.clone().json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid guard response.");
    }
    const result = payload as Record<string, unknown>;
    const permits = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"];
    if (typeof result.allowed !== "boolean" || typeof result.action !== "string" ||
        ![...permits, "BLOCK", "HUMAN_REVIEW"].includes(result.action) ||
        result.allowed !== permits.includes(result.action)) {
      throw new Error("Invalid guard verdict.");
    }
    if (result.allowed) {
      const replacement = result.safeText ?? result.redactedText;
      if (replacement != null
          ? typeof replacement !== "string" || !replacement.trim()
          : result.action !== "ALLOW") {
        throw new Error("Missing usable guard replacement.");
      }
    }
  }
  return response; // Preserve HTTP failures for the SDK's error handling.
};

const guarded = createGuardedRoute({
  ...resolveSoterConfig({ timeoutMs: 5000, retries: 0 }),
  fetch: strictGuardFetch,
  callLLM: callYourLLM,
  withholdResponse: "The model response was withheld.",
});

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const response = await guarded(request);
    if (!response.ok) {
      // Preserve the failure status, never its potentially sensitive body.
      return Response.json({ blocked: true, reply: "Chat unavailable." },
        { status: response.status, headers });
    }
    const result = await response.json();
    if (result.blocked !== false || typeof result.reply !== "string" || !result.reply.trim()) {
      return Response.json({ blocked: true, reply: "Message or model response withheld." }, { headers });
    }
    // The factory also returns guard findings. Keep all diagnostics server-side.
    return Response.json({ blocked: false, reply: result.reply }, { headers });
  } catch {
    return Response.json({ blocked: true, reply: "Chat unavailable." }, { status: 503, headers });
  }
}`;
const expressCode = `import { resolveSoterConfig } from "@soterai/core";
import { soterInputMiddleware, soterOutputMiddleware } from "@soterai/core/express";
import { callYourLLM } from "./llm";

// Existing Express app: register express.json() before this route.
const options = resolveSoterConfig({ timeoutMs: 5000, retries: 0 });
app.post(
  "/chat",
  soterInputMiddleware(options),
  async (req, res, next) => {
    try {
      res.locals.aiResponse = await callYourLLM(req.body.message);
      next(); // Do not send raw model output here.
    } catch (error) { next(error); }
  },
  soterOutputMiddleware(options), // Reads and rewrites res.locals.aiResponse
  (_req, res) => res.json({ blocked: false, reply: res.locals.aiResponse }),
);

// Register after the route; never echo upstream errors or unchecked model text.
app.use((_error, _req, res, _next) => {
  res.status(503).json({ blocked: true, reply: "Service unavailable. Please try again." });
});`;

export default function JSDocsPage() {
  return (
    <DocsPageShell path="/docs/js">

        <section className="docs-section">
          <DocsHeading>Step 1: Install the package</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Use Node.js 18.18 or later, as declared by the package, and install on your backend:
          </p>
          <CodeBlock language="bash" title="npm install">{installCode}</CodeBlock>
          <TipBox>
            <strong>Using Deno or Bun?</strong> You can also install via 
            <InlineCode>deno add npm:@soterai/core</InlineCode> or 
            <InlineCode>bun add @soterai/core</InlineCode>. These are package-manager commands; validate your runtime and deployment separately. The examples below target Node.js.
          </TipBox>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 2: Configure environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Set these server environment variables. The SDK reads the process environment; it does not load a <InlineCode>.env</InlineCode> file itself:
          </p>
          <CodeBlock language="bash" title=".env">{envCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">Explicit constructor options override environment variables. <InlineCode>projectId</InlineCode> is metadata; it does not change the project authorized by the API key. The default base URL is <InlineCode>https://api.soterai.in</InlineCode>.</p>
          <WarnBox>
            <strong>Never expose the API key in browser code.</strong> Do not prefix with 
            <InlineCode>NEXT_PUBLIC_</InlineCode>. The SDK warns if it detects a browser environment. 
            Always call SoterAI from your backend server.
          </WarnBox>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 3: Basic usage (guarding user input)</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Check a single message before your model call. This function returns permitted text or a blocked state; SDK errors must be handled by the caller:
          </p>
          <CodeBlock language="typescript" title="basic input guard" showLineNumbers>{basicCode}</CodeBlock>
          
          <h3 className="mt-8 text-xl font-bold">Decision helpers</h3>
          <p className="mt-3 leading-7 text-slate-200">
            Use decision checks before selecting text. <InlineCode>getSafeText</InlineCode> does not authorize forwarding and may return its fallback even for a blocked result:
          </p>
          <CodeBlock language="typescript">{decisionHelpers}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200"><InlineCode>protect</InlineCode> accepts <InlineCode>input</InlineCode> and <InlineCode>context</InlineCode>. Lower-level <InlineCode>guardInput</InlineCode> accepts <InlineCode>message</InlineCode> or <InlineCode>text</InlineCode>; <InlineCode>guardOutput</InlineCode> accepts <InlineCode>aiResponse</InlineCode> or <InlineCode>text</InlineCode>. The SDK maps aliases to the REST field names. For newer REST-only source, governance and topical-scope fields, use the <Link href="/docs/rest-api" className="text-cyan underline">REST API</Link>; these SDK methods do not forward them.</p>

          <h3 className="mt-8 text-xl font-bold">One-call conversation helper</h3>
          <p className="mt-3 leading-7 text-slate-200">
            Runs <strong>input guard → LLM call → output guard</strong> and returns <InlineCode>reply</InlineCode>, <InlineCode>blocked</InlineCode>, <InlineCode>inputResult</InlineCode> and optional <InlineCode>outputResult</InlineCode>. Your callback must resolve to a string. Exceptions still require caller handling:
          </p>
          <CodeBlock language="typescript" title="conversation helper">{conversationCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">The helper expects the guard response to satisfy the SDK contract. The explicit handler below adds a stricter check: a redaction or rewrite without replacement text is withheld rather than falling back to the original.</p>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 4: Complete example with error handling</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This server-side pattern fails closed on errors and on missing transformation text. Pass your own model adapter and, when available, an application-controlled session ID reused across conversation turns. Add authentication, rate limits and deployment-specific tests before rollout:
          </p>
          <CodeBlock language="typescript" title="guarded chat handler" showLineNumbers>{fullExampleCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Framework integrations</DocsHeading>
          
          <h3 className="mt-8 text-xl font-bold">Next.js</h3>
          <p className="mt-3 leading-7 text-slate-200">
            Use <InlineCode>createGuardedRoute</InlineCode> from the exported <InlineCode>@soterai/core/next</InlineCode> entry with the raw-response check and public-response wrapper below. The factory includes nested guard findings; exporting it directly can expose sensitive excerpts even on blocked turns. The wrapper returns only <InlineCode>blocked</InlineCode> and <InlineCode>reply</InlineCode>, and preserves HTTP failures without their details. Provide <InlineCode>./llm</InlineCode> yourself. Treat non-2xx responses as failures; the adapter does not authenticate your application&apos;s users:
          </p>
          <CodeBlock language="typescript" title="app/api/chat/route.ts">{nextCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-200">
            See the <Link href="/docs/nextjs" className="text-cyan underline">Next.js guide</Link> for more details.
          </p>

          <h3 className="mt-8 text-xl font-bold">Express.js</h3>
          <p className="mt-3 leading-7 text-slate-200">
            In an existing Express app with JSON-body parsing, compose both middlewares. The output middleware reads <InlineCode>res.locals.aiResponse</InlineCode>; it does not intercept a reply you have already sent. Supply your own <InlineCode>./llm</InlineCode> adapter:
          </p>
          <CodeBlock language="typescript" title="Express middleware">{expressCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Error handling</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The SDK maps HTTP and transport failures to these error classes. A content <InlineCode>BLOCK</InlineCode> is normally an HTTP 200 guard result, not an exception:
          </p>
          <CodeBlock language="typescript" title="error handling">{errorCode}</CodeBlock>
          <TipBox>
            The default is no retries. <InlineCode>retries: 2</InlineCode> (or <InlineCode>maxRetries: 2</InlineCode>) retries 5xx/network failures with linear backoff: <InlineCode>retryBackoffMs × attempt</InlineCode>, with a default backoff base of 250 ms. HTTP 429 is not retried automatically. The default timeout is 8000 ms; the examples choose 5000 ms, not a response-time guarantee.
          </TipBox>
        </section>

        <section className="docs-section">
          <DocsHeading>Security best practices</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Keep diagnostics minimal", "The SDK debug logger records method and path, not request payloads. Keep your own logs free of keys and raw prompts."],
              ["Browser detection", "The constructor warns if it detects a browser environment."],
              ["Do not echo upstream errors", "Errors can retain server messages, details or transport causes. Log selected codes/status, not whole error objects."],
              ["Always guard output too", "The input guard is not enough. Always guard the model output as well."],
              ["Set a request budget", "Choose timeoutMs and bounded retries for your deployment. Also apply an application-level deadline."],
              ["Fail closed on unavailable checks", "Withhold the turn when either guard fails. Never forward unchecked text as an error fallback."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm italic text-slate-300">
            This reduces risk; it does not guarantee complete protection.
          </p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-slate-800 p-6">
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
    </DocsPageShell>
  );
}
