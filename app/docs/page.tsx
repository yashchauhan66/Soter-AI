import Link from "next/link";

const fetchExample = `// Fetch API (browser or server)
const response = await fetch("https://yourdomain.com/api/guard/input", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERRAKSHAK_API_KEY!,
  },
  body: JSON.stringify({ message: userMessage }),
});
const result = await response.json();
if (!result.allowed) return result.safeText ?? "Blocked.";`;

const nodeExample = `// Node.js (>=18) with the SDK
import { CyberRakshakGuard } from "@cyberrakshak/guard";

const guard = new CyberRakshakGuard({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  baseUrl: "https://yourdomain.com",
});

const result = await guard.guardInput({ message: userMessage });`;

const nextRouteExample = `// app/api/chat/route.ts
import { secureChatHandler } from "@cyberrakshak/guard/next";

export const POST = secureChatHandler({
  apiKey: process.env.CYBERRAKSHAK_API_KEY!,
  callLLM: async ({ safeInput }) => {
    return await myLLMCall(safeInput);
  },
});`;

const sdkSecureChat = `const result = await guard.secureChat({
  message: userMessage,
  sessionId: session.id,
  callLLM: async ({ safeInput }) => callLLM(safeInput),
});
return result.reply;`;

const webhookVerify = `import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhook(rawBody: string, header: string, secret: string) {
  const match = /t=(\\d+),v1=([0-9a-f]+)/.exec(header);
  if (!match) return false;
  const [, t, sig] = match;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}`;

const responseExample = `{
  "allowed": false,
  "action": "BLOCK",
  "riskScore": 85,
  "riskTypes": ["PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK_ATTEMPT"],
  "reason": "Blocked because high-risk patterns were detected...",
  "findings": []
}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-5 text-xs leading-6 text-slate-300">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  const sections = [
    ["quickstart", "Quickstart"],
    ["rest-api", "REST API"],
    ["sdk", "SDK"],
    ["nextjs", "Next.js integration"],
    ["webhooks", "Webhooks"],
    ["badge", "Security badge"],
    ["risk-types", "Risk types"],
    ["actions", "Actions"],
    ["error-codes", "Error codes"],
    ["best-practices", "Best practices"],
    ["limitations", "Limitations"],
  ];

  return (
    <main className="container-page py-16">
      <div className="grid gap-10 lg:grid-cols-[230px_1fr]">
        <aside className="card hidden h-fit p-5 text-sm lg:block">
          <p className="font-semibold">On this page</p>
          <nav className="mt-3 space-y-2">
            {sections.map(([id, label]) => (
              <a className="block text-slate-500 hover:text-cyan" href={`#${id}`} key={id}>{label}</a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-4xl">
          <section id="quickstart">
            <p className="eyebrow">Developer documentation v2</p>
            <h1 className="mt-3 text-4xl font-bold">Integrate CyberRakshak Guard</h1>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              CyberRakshak Guard is an OWASP LLM Top 10 aligned defensive gateway for chatbot input and output flows.
              The typical loop: user input → Input Guard → LLM → Output Guard → user.
            </p>
            <ol className="mt-6 list-decimal space-y-2 pl-5 text-slate-300">
              <li>Create a project and generate an API key in the dashboard.</li>
              <li>Install the SDK: <code className="text-cyan">npm install @cyberrakshak/guard</code></li>
              <li>Call <code>guardInput</code>, your LLM, then <code>guardOutput</code>.</li>
              <li>Optionally configure webhooks for blocked-risk and usage events.</li>
            </ol>
          </section>

          <section id="rest-api" className="mt-12">
            <h2 className="text-2xl font-bold">REST API</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Authenticate with <code className="text-cyan">x-api-key</code>. Responses are <code>no-store</code> and
              never echo <code>originalText</code>. HTTP 429 uses the same body shape with <code>RATE_LIMIT</code>.
            </p>
            <h3 className="mt-6 font-semibold">Endpoints</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li><code className="text-cyan">POST /api/guard/input</code> — message + optional userId / sessionId / metadata</li>
              <li><code className="text-cyan">POST /api/guard/output</code> — aiResponse + optional sessionId / metadata</li>
              <li><code className="text-cyan">POST /api/guard/analyze</code> — text + direction. Public, rate-limited per IP.</li>
              <li><code className="text-cyan">GET /api/badge/&lt;slug&gt;</code> — public badge status (no private data).</li>
            </ul>
            <h3 className="mt-6 font-semibold">Fetch example</h3>
            <Code>{fetchExample}</Code>
            <h3 className="mt-6 font-semibold">Response</h3>
            <Code>{responseExample}</Code>
          </section>

          <section id="sdk" className="mt-12">
            <h2 className="text-2xl font-bold">SDK</h2>
            <p className="mt-3 leading-7 text-slate-400">
              <code>@cyberrakshak/guard</code> ships ESM + CommonJS, typed errors, and a <code>secureChat</code> helper.
            </p>
            <Code>{nodeExample}</Code>
            <p className="mt-3 text-sm text-slate-500">
              <code>secureChat</code> runs the full input → LLM → output sequence and returns the safe reply:
            </p>
            <Code>{sdkSecureChat}</Code>
            <p className="mt-3 text-sm text-slate-500">
              Errors derive from <code>CyberRakshakError</code>: <code>CyberRakshakAuthError</code>,
              <code> CyberRakshakRateLimitError</code> (with <code>retryAfter</code>),
              <code> CyberRakshakValidationError</code>, <code>CyberRakshakNetworkError</code>.
            </p>
          </section>

          <section id="nextjs" className="mt-12">
            <h2 className="text-2xl font-bold">Next.js integration</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Mount <code>secureChatHandler</code> as a Route Handler. It validates JSON, runs both guards, and never
              echoes the original request text.
            </p>
            <Code>{nextRouteExample}</Code>
          </section>

          <section id="webhooks" className="mt-12">
            <h2 className="text-2xl font-bold">Webhooks</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Add an HTTPS endpoint under <Link className="text-cyan" href="/dashboard/webhooks">Dashboard → Webhooks</Link>,
              select events, and store the signing secret returned once at creation. The dashboard test button delivers
              a synthetic event and stores the result for audit.
            </p>
            <h3 className="mt-6 font-semibold">Events</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
              {[
                "guard.prompt_injection.blocked",
                "guard.jailbreak.detected",
                "guard.secret.detected",
                "guard.pii.redacted",
                "guard.system_prompt_leak.blocked",
                "guard.unsafe_output.blocked",
                "usage.limit.warning",
                "usage.limit.exceeded",
              ].map((name) => <code key={name} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1">{name}</code>)}
            </div>
            <h3 className="mt-6 font-semibold">Headers on every delivery</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-400">
              <li><code>x-cyberrakshak-event</code> — event name</li>
              <li><code>x-cyberrakshak-timestamp</code> — unix seconds at signing time</li>
              <li><code>x-cyberrakshak-signature</code> — <code>t=...,v1=&lt;hmac-sha256&gt;</code></li>
            </ul>
            <h3 className="mt-6 font-semibold">Verifying a delivery</h3>
            <Code>{webhookVerify}</Code>
            <p className="mt-3 text-sm text-amber-200">
              Webhook payloads never contain raw secrets or PII. Sensitive metadata is sanitised; raw findings are
              omitted; only redacted text is shared when the gateway captured any.
            </p>
          </section>

          <section id="badge" className="mt-12">
            <h2 className="text-2xl font-bold">Security badge</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Each project exposes a public status at <code>/security-status/&lt;slug&gt;</code> and JSON at
              <code> /api/badge/&lt;slug&gt;</code>. Embed the badge:
            </p>
            <Code>{`<script src="https://yourdomain.com/badge.js" data-project-id="PROJECT_BADGE_SLUG"></script>`}</Code>
            <p className="mt-3 text-sm text-slate-500">
              Badge statuses: <code>PROTECTED</code>, <code>MONITORING_ACTIVE</code>, <code>ISSUES_FOUND</code>,
              <code> INACTIVE</code>. The public page exposes monthly counts and last activity timestamp only.
            </p>
          </section>

          <section id="risk-types" className="mt-12">
            <h2 className="text-2xl font-bold">Risk types</h2>
            <p className="mt-2 text-sm text-slate-400">
              PROMPT_INJECTION, JAILBREAK, SYSTEM_PROMPT_LEAK_ATTEMPT, SYSTEM_PROMPT_LEAKAGE, PII_DETECTED,
              INDIA_PII_DETECTED, SECRET_DETECTED, UNSAFE_OUTPUT, RATE_LIMIT, TOKEN_ABUSE, LOW_RISK.
            </p>
          </section>

          <section id="actions" className="mt-12">
            <h2 className="text-2xl font-bold">Actions</h2>
            <p className="mt-2 text-sm text-slate-400">ALLOW, ALLOW_WITH_REDACTION, REWRITE, BLOCK, HUMAN_REVIEW.</p>
          </section>

          <section id="error-codes" className="mt-12">
            <h2 className="text-2xl font-bold">Error codes</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li><code>400</code> validation_error — payload failed Zod validation.</li>
              <li><code>401</code> auth_error — missing or invalid <code>x-api-key</code>.</li>
              <li><code>403</code> auth_error — API key inactive.</li>
              <li><code>404</code> not_found — project, webhook, or badge does not exist.</li>
              <li><code>409</code> conflict — signing secret no longer available; rotate to issue a new one.</li>
              <li><code>429</code> rate_limited — per-minute or monthly limit hit. See <code>Retry-After</code>.</li>
              <li><code>500</code> server_error — unexpected failure. Original details are not leaked.</li>
            </ul>
          </section>

          <section id="best-practices" className="mt-12">
            <h2 className="text-2xl font-bold">Best practices</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
              <li>Run both input and output guards every model turn.</li>
              <li>Use <code>safeText</code>, not the original text, after redaction or rewriting.</li>
              <li>Stop processing when <code>allowed</code> is false.</li>
              <li>Keep API keys in server environment variables and rotate them regularly.</li>
              <li>Use application authorization and tenant isolation in addition to guard checks.</li>
              <li>Verify webhook signatures and reject deliveries older than 5 minutes.</li>
            </ul>
          </section>

          <section id="limitations" className="card mt-12 border-amber-500/20 p-6">
            <h2 className="font-semibold text-amber-200">Security limitations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-slate-400">
              <li>Pattern detection produces false positives and negatives.</li>
              <li>Rate limits are per-process; use a shared Redis bucket in multi-instance deployments.</li>
              <li>Phase 2 ships a demo identity boundary; production needs full auth, RBAC, and tenant isolation.</li>
              <li>The badge reflects defensive activity, not certification or complete protection.</li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
