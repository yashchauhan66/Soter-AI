import type { Metadata } from "next";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Botpress Integration: Chatbot AI Security",
  description:
    "Add SoterAI input and output guarding as pre/post-processing HTTP steps in Botpress workflows to protect against prompt injection and PII leaks.",
  alternates: { canonical: "/docs/botpress" },
};

const workflowCode = `// Your authenticated Node.js backend, called by a Botpress workflow.
async function guardedReply(message) {
  const hold = { reply: "This reply needs support review.", blocked: true };
  try {
    const baseUrl = process.env.SOTER_BASE_URL;
    const apiKey = process.env.SOTER_API_KEY;
    if (!baseUrl || !apiKey) return hold;

    async function checkedText(path, body, original) {
      const res = await fetch(baseUrl + path, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("Guard unavailable");
      const result = await res.json();
      if (result?.allowed !== true ||
          !["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"].includes(result.action)) {
        throw new Error("Hold for review"); // Includes BLOCK and HUMAN_REVIEW.
      }
      const text = result.safeText ?? result.redactedText ??
        (result.action === "ALLOW" ? original : null);
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Missing guarded text");
      }
      return text;
    }

    const input = await checkedText("/api/guard/input", { message }, message);
    const draft = await generateReply(input); // Your model adapter; no streaming.
    const reply = await checkedText("/api/guard/output", { aiResponse: draft }, draft);
    return { reply, blocked: false };
  } catch {
    return hold; // Never return the original message or the unchecked draft.
  }
}

// Your queue supplies userMessage from an authenticated workflow request.
// Only publish result.reply when result.blocked === false; otherwise hand off.
return await guardedReply(userMessage);`;

export default function BotpressDocsPage() {
  return (
    <DocsPageShell path="/docs/botpress">

        <section className="docs-section">
          <DocsHeading>How it works</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            This is a server-side integration pattern, not a native Botpress integration package.
            The example runs in your authenticated Node.js backend; it is not a universal action or hook
            you can paste into every Botpress runtime. Your workflow must delegate generation to that backend,
            or place equivalent checks before its model and send steps. Webchat must never receive the SoterAI key.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">1. Input step</span> — Call <InlineCode>POST /api/guard/input</InlineCode> before the user message reaches your AI agent
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">2. Output step</span> — Call <InlineCode>POST /api/guard/output</InlineCode> before the AI response goes to the user
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">3. Handle decisions</span> — Explicitly branch to a hold/review path for BLOCK, HUMAN_REVIEW, errors and unknown results; do not run later generation or send steps
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-slate-100">4. Audit logs</span> — Keep allowlisted decision metadata, not the full guard result; text and matched findings may still be sensitive
            </div>
          </div>
        </section>

        <section className="docs-section">
          <DocsHeading>Environment</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Set both values server-side. The example uses Node.js 18+ fetch and process.env, not a guaranteed
            Botpress secret-variable API. If you adapt it to a hosted action, verify that runtime&apos;s secret
            storage, HTTP support and execution limits first. Authenticate workflow requests to your backend;
            a public, unprotected adapter would expose your quota even if the key stays private.
          </p>
          <CodeBlock language="bash" title="backend environment">{`SOTER_BASE_URL=https://api.soterai.in
SOTER_API_KEY=replace_with_your_server_side_key
# Use an HTTPS origin without a trailing slash; never a Webchat variable.`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Botpress workflow example</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Put this inside an async backend handler. <InlineCode>generateReply</InlineCode> is your own
            model adapter. The caller must branch on <InlineCode>blocked</InlineCode>; returning an object
            does not automatically stop a Botpress flow. On an allowed result, send only the returned reply.
            On a hold, use your review queue or a fixed support message, never the original draft.
          </p>
          <CodeBlock language="javascript" title="botpress-backend.js" showLineNumbers>{workflowCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Verify the workflow boundary</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Exercise allowed text, redaction, review, denial, non-success HTTP responses and timeouts in your
            own test workflow. Confirm there is no alternate transition that calls the model or sends an
            unchecked reply after a hold. Buffer the complete draft before output guarding. Attachments,
            tools, other channels and provider webhook signatures need their own integration-specific checks.
          </p>
        </section>
    </DocsPageShell>
  );
}
