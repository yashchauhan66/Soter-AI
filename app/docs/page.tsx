import Link from "next/link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const quickstartCode = `import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

const result = await soter.protect({ input: message });

if (!result.allowed) {
  return { blocked: true, reason: result.reason };
}`;

const languages = [
  {
    title: "JavaScript / TypeScript",
    description: "@soter/core SDK — the primary client for Node.js, Deno, Bun, and browser-based server routes",
    href: "/docs/js",
    icon: "🟨",
    tags: ["Node.js", "Deno", "Bun", "TypeScript"],
  },
  {
    title: "Python",
    description: "Python client with sync/async support, FastAPI middleware, LangChain & LlamaIndex wrappers",
    href: "/docs/python",
    icon: "🐍",
    tags: ["FastAPI", "Flask", "LangChain", "LlamaIndex"],
  },
  {
    title: "Next.js",
    description: "Route handler helpers, secureChatHandler, and server action patterns for Next.js apps",
    href: "/docs/nextjs",
    icon: "▲",
    tags: ["App Router", "Route Handlers", "Server Actions"],
  },
  {
    title: "Express.js",
    description: "Express middleware for input/output guarding with session context support",
    href: "/docs/express",
    icon: "⚡",
    tags: ["Middleware", "REST API"],
  },
  {
    title: "FastAPI",
    description: "FastAPI integration with create_chat_route, async support, and Pydantic models",
    href: "/docs/fastapi",
    icon: "🚀",
    tags: ["Pydantic", "Async", "Python"],
  },
  {
    title: "REST API",
    description: "Raw HTTP endpoints — use from any language: curl, Java, Go, PHP, C#, and more",
    href: "/docs/rest-api",
    icon: "🌐",
    tags: ["curl", "Java", "Go", "PHP", "C#"],
  },
  {
    title: "RAG / LangChain",
    description: "RAG pipeline protection, LangChain chains, LlamaIndex query engines, source filtering",
    href: "/docs/rag",
    icon: "📚",
    tags: ["RAG", "LangChain", "LlamaIndex", "Retrieval"],
  },
  {
    title: "Botpress",
    description: "Pre/post processing HTTP steps in Botpress workflows with input + output guarding",
    href: "/docs/botpress",
    icon: "🤖",
    tags: ["Workflows", "HTTP"],
  },
  {
    title: "Intercom",
    description: "Guard AI support-chat messages in Intercom workflows with PII redaction",
    href: "/docs/intercom",
    icon: "💬",
    tags: ["Support", "CRM"],
  },
  {
    title: "WhatsApp Chatbots",
    description: "Protect WhatsApp chatbot deployments with India PII redaction support",
    href: "/docs/whatsapp",
    icon: "📱",
    tags: ["WhatsApp", "Meta", "India PII"],
  },
  {
    title: "Zendesk",
    description: "Guard ticket messages and AI drafts in Zendesk environments",
    href: "/docs/zendesk",
    icon: "🎫",
    tags: ["Support", "Tickets"],
  },
  {
    title: "WordPress",
    description: "WordPress plugin with settings UI, shortcodes, and local REST proxy for API key safety",
    href: "/docs/wordpress",
    icon: "🔌",
    tags: ["PHP", "Plugin", "Shortcodes"],
  },
  {
    title: "Generic Chatbot & Agent",
    description: "Universal pattern for any chatbot, agent, or tool-using AI system with tool firewall",
    href: "/docs/generic-chatbot",
    icon: "🧠",
    tags: ["Agent", "Tool Firewall", "Session"],
  },
  {
    title: "CLI",
    description: "npx soter init — planned CLI tool for framework detection and project scaffolding",
    href: "/docs/cli",
    icon: "⌨️",
    tags: ["CLI", "Scaffolding"],
  },
  {
    title: "Security Best Practices",
    description: "OWASP LLM Top 10 alignment, key rotation, webhook verification, fail-open vs fail-closed",
    href: "/docs/best-practices",
    icon: "🛡️",
    tags: ["OWASP", "Security", "Compliance"],
  },
  {
    title: "Quickstart",
    description: "Get a chatbot protected in 5 minutes — install, configure, and test with an attack prompt",
    href: "/docs/quickstart",
    icon: "⏱️",
    tags: ["5 min", "Setup", "Tutorial"],
  },
  {
    title: "API Contract",
    description: "Complete API reference: endpoints, request/response shapes, error codes, webhook events",
    href: "/docs/api-contract",
    icon: "📋",
    tags: ["Reference", "Endpoints", "Errors"],
  },
];

export default function DocsHubPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="eyebrow">Developer documentation v2</p>
          <h1 className="mt-3 text-4xl font-bold">Soter Documentation</h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Safety layer for intelligent conversations. Choose your language or platform below to get started.
          </p>
        </div>

        {/* Quickstart */}
        <div className="card mb-12 border-cyan-500/20 p-6">
          <h2 className="text-xl font-bold">Quickstart — 5 Minutes</h2>
          <p className="mt-2 text-sm text-slate-400">
            Create a project, install the SDK, and protect your first chatbot message.
          </p>
          <CodeBlock language="typescript">{quickstartCode}</CodeBlock>
          <Link
            href="/docs/quickstart"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90"
          >
            Full Quickstart Guide →
          </Link>
        </div>

        {/* Language Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((lang) => (
            <Link
              key={lang.href}
              href={lang.href}
              className="card group relative overflow-hidden border-slate-800 p-5 transition hover:border-cyan/50 hover:shadow-lg hover:shadow-cyan/5"
            >
              <div className="mb-3 text-2xl">{lang.icon}</div>
              <h3 className="font-semibold text-white group-hover:text-cyan transition-colors">
                {lang.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                {lang.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lang.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-800/50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="absolute right-4 top-4 text-slate-700 transition group-hover:text-cyan group-hover:translate-x-0.5">
                →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
