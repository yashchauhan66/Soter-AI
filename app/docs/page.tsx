import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Code2, Globe2, Search, ShieldCheck, Terminal, Zap } from "lucide-react";
import { CodeBlock, TipBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Developer Docs - Integrate AI Security in 5 Minutes | JavaScript, Python, REST",
  description:
    "Step-by-step SoterAI documentation for developers of all skill levels. Protect your AI chatbot, RAG app, or agent from prompt injection, PII leaks, and unsafe outputs. Guides for JavaScript, Python, Next.js, Express, FastAPI, WordPress, WhatsApp, Intercom, Zendesk, Botpress, and REST API.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "SoterAI Developer Documentation - AI Security Integration Guides",
    description: "Protect your AI from prompt injection, PII leaks, and unsafe outputs. Beginner-friendly guides for all major languages and platforms.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Developer Documentation", item: "https://soterai.publicvm.com/docs" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I integrate SoterAI with my chatbot?",
      acceptedAnswer: { "@type": "Answer", text: "Create a project in the SoterAI dashboard, keep your API key on the server only, call the input guard before your LLM processes the message, and call the output guard before returning the response to the user. See the quickstart guide for a complete example." },
    },
    {
      "@type": "Question",
      name: "Can I use SoterAI without an SDK?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Use the REST API from any programming language that can make HTTPS requests, including Java, Go, PHP, C#, Ruby, Rust, Swift, Kotlin, and shell scripts. See the REST API guide for examples." },
    },
    {
      "@type": "Question",
      name: "Where should I put the API key?",
      acceptedAnswer: { "@type": "Answer", text: "Never put the SoterAI API key in frontend or browser code. Always keep it server-side in environment variables. Browser apps should call your own backend route, and that backend route calls SoterAI." },
    },
    {
      "@type": "Question",
      name: "What languages and frameworks does SoterAI support?",
      acceptedAnswer: { "@type": "Answer", text: "SoterAI provides SDKs for JavaScript/TypeScript (Node.js, Deno, Bun) and Python. Framework-specific integrations include Next.js, Express.js, FastAPI, LangChain, LlamaIndex, WordPress, Botpress, Intercom, Zendesk, and WhatsApp. You can also use the REST API from any language." },
    },
    {
      "@type": "Question",
      name: "How long does it take to integrate SoterAI?",
      acceptedAnswer: { "@type": "Answer", text: "Most developers complete the basic integration in under 5 minutes: install the SDK, add environment variables, wrap your chat route with input and output guards, and test with an attack prompt." },
    },
    {
      "@type": "Question",
      name: "Is SoterAI free to use?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. SoterAI offers a free tier that includes input and output guard, playground access, and basic logs. Paid plans add webhooks, monthly reports, higher limits, and enterprise features like SSO and self-hosting." },
    },
  ],
};

const quickstartCode = `// 1. Install the SoterAI SDK
npm install @soterai/core

// 2. Add your API key to .env (server-side only!)
SOTER_API_KEY=ck_live_your_key_here

// 3. Protect one message before your LLM sees it
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

const result = await soter.protect({ input: userMessage });

if (!result.allowed) {
  // 🛑 Blocked! Don't call the LLM
  return { blocked: true, reason: result.reason };
}

// ✅ Safe! Call your LLM with the sanitized input
return callYourLLM(result.safeText ?? userMessage);`;

const beginnerSteps = [
  ["1. Create", "Create a project in the SoterAI dashboard and copy your API key.", "/signup"],
  ["2. Install", "Install an SDK or use the REST API from any backend language.", "/docs/quickstart"],
  ["3. Guard input", "Check every user message before sending it to your model.", "/docs/js"],
  ["4. Guard output", "Check every model response before showing it to users.", "/docs/rest-api"],
];

const languageGuides = [
  { icon: "🟨", title: "JavaScript / TypeScript", href: "/docs/js", description: "Node.js, Deno, Bun, server routes, and backend services. Full SDK support with type safety.", tags: ["Node", "TypeScript", "SDK"] },
  { icon: "🐍", title: "Python", href: "/docs/python", description: "Python chatbot backends, FastAPI, LangChain, RAG apps, and LlamaIndex integrations.", tags: ["Python", "FastAPI", "LangChain"] },
  { icon: "🌐", title: "REST API", href: "/docs/rest-api", description: "Use SoterAI from Java, Go, PHP, C#, Ruby, Rust, Laravel, Spring, .NET, or any HTTP client.", tags: ["curl", "Java", "Go", "PHP", "C#"] },
  { icon: "▲", title: "Next.js", href: "/docs/nextjs", description: "Protect App Router route handlers, server actions, and AI chat endpoints with one-liner helpers.", tags: ["Next.js", "App Router"] },
  { icon: "⚡", title: "Express.js", href: "/docs/express", description: "Add input and output guard middleware to Express chatbot routes in minutes.", tags: ["Express", "Middleware"] },
  { icon: "🚀", title: "FastAPI", href: "/docs/fastapi", description: "Async Python routes with Pydantic models for AI chatbots and agents.", tags: ["FastAPI", "Pydantic"] },
];

const platformGuides = [
  { label: "RAG / LangChain", href: "/docs/rag", desc: "Protect RAG retrieval flows, LangChain chains, and LlamaIndex query engines." },
  { label: "Generic Chatbot & Agent", href: "/docs/generic-chatbot", desc: "Universal pattern for any chatbot, agent, or tool-using AI system." },
  { label: "WhatsApp Chatbots", href: "/docs/whatsapp", desc: "India-specific PII redaction for WhatsApp deployments." },
  { label: "WordPress", href: "/docs/wordpress", desc: "WordPress plugin with settings UI, shortcodes, and local REST proxy." },
  { label: "Botpress", href: "/docs/botpress", desc: "Pre/post processing HTTP steps in Botpress workflows." },
  { label: "Intercom", href: "/docs/intercom", desc: "Guard AI support-chat messages in Intercom with PII redaction." },
  { label: "Zendesk", href: "/docs/zendesk", desc: "Protect ticket messages and AI drafts in Zendesk." },
  { label: "API Contract", href: "/docs/api-contract", desc: "Complete API reference with endpoints, errors, and webhook events." },
  { label: "Security Best Practices", href: "/docs/best-practices", desc: "OWASP LLM Top 10 alignment, key rotation, webhook verification, and more." },
  { label: "CLI", href: "/docs/cli", desc: "Scaffolding tool for framework detection and project setup." },
];

export default function DocsHubPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-page">
        {/* Hero Section */}
        <section className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="eyebrow">Developer documentation</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">
              Protect your AI in minutes, not days.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              New to AI security? <strong>Start here.</strong> SoterAI helps developers of all skill levels 
              protect chatbots, RAG apps, and AI agents from prompt injection, PII leaks, unsafe responses, 
              and tool abuse. Pick your language below and copy-paste the code.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/docs/quickstart" className="button-primary gap-2">
                <Zap size={18} aria-hidden="true" /> Start 5-minute quickstart <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                <Globe2 size={18} aria-hidden="true" /> Use any language
              </Link>
            </div>
          </div>
          <aside className="card p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-cyan" aria-hidden="true" />
              <h2 className="font-semibold">Your 4-step plan</h2>
            </div>
            <div className="mt-5 space-y-4">
              {beginnerSteps.map(([step, copy, href]) => (
                <Link key={step} href={href} className="flex gap-3 border-b border-slate-800 pb-4 last:border-0 last:pb-0 transition hover:opacity-80">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-medium">{step}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </section>

        {/* Copy-paste starter */}
        <section className="mt-14">
          <div className="flex items-center gap-3">
            <Code2 className="text-cyan" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Quick start - copy and paste</h2>
          </div>
          <p className="mt-3 max-w-3xl text-slate-400">
            This is the smallest useful integration. Put this code in a <strong>server route only</strong> — 
            never expose the API key to the browser.
          </p>
          <CodeBlock language="typescript" title="server-side integration">{quickstartCode}</CodeBlock>
          <TipBox>
            <strong>New to backend development?</strong> The code above goes in a server file (like 
            <code className="text-cyan"> app/api/chat/route.ts </code> for Next.js or 
            <code className="text-cyan"> server.js </code> for Node.js). The browser sends the message, 
            your server sends it to SoterAI, and only safe text reaches your AI model.
          </TipBox>
        </section>

        {/* Language guides */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Search className="text-cyan" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Choose your language</h2>
          </div>
          <p className="mt-3 text-slate-400">Each guide includes installation, environment setup, code examples, expected output, and common mistakes.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {languageGuides.map((guide) => (
              <Link key={guide.href} href={guide.href} className="card group p-5 transition-all hover:border-cyan/50 hover:shadow-lg hover:shadow-cyan/5">
                <span className="text-2xl">{guide.icon}</span>
                <h3 className="mt-3 font-semibold group-hover:text-cyan">{guide.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{guide.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {guide.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-400">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Platform guides */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <Terminal className="text-cyan" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Platform and framework guides</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platformGuides.map(({ label, href, desc }) => (
              <Link key={href} href={href} className="card group p-4 transition hover:border-cyan/50">
                <h3 className="font-semibold group-hover:text-cyan">{label}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Features cards */}
        <section className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="card p-6">
            <BookOpen className="text-cyan" size={24} aria-hidden="true" />
            <h3 className="mt-4 font-semibold">For beginners</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Every guide starts with install, env vars, a working request, expected result, and common mistakes. 
              No prior AI security knowledge needed.
            </p>
          </div>
          <div className="card p-6">
            <ShieldCheck className="text-cyan" size={24} aria-hidden="true" />
            <h3 className="mt-4 font-semibold">Security first</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Every example shows proper API key handling, fail-closed behavior, input + output guarding, 
              and security best practices.
            </p>
          </div>
          <div className="card p-6">
            <Globe2 className="text-cyan" size={24} aria-hidden="true" />
            <h3 className="mt-4 font-semibold">Any language, any stack</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Whether you use JavaScript, Python, Java, Go, PHP, C#, or any other language, 
              the REST API works everywhere.
            </p>
          </div>
        </section>

        {/* Search suggestion */}
        <section className="mt-16 rounded-lg border border-slate-800 bg-slate-950/40 p-6">
          <h2 className="text-lg font-semibold">Looking for something specific?</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/docs/quickstart" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Quickstart</Link>
            <Link href="/docs/js" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">JavaScript SDK</Link>
            <Link href="/docs/python" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Python SDK</Link>
            <Link href="/docs/rest-api" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">REST API</Link>
            <Link href="/docs/nextjs" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Next.js</Link>
            <Link href="/docs/fastapi" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">FastAPI</Link>
            <Link href="/docs/rag" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">RAG</Link>
            <Link href="/docs/wordpress" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">WordPress</Link>
            <Link href="/docs/api-contract" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">API Contract</Link>
            <Link href="/docs/best-practices" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Best Practices</Link>
            <Link href="/docs/generic-chatbot" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Generic Chatbot</Link>
          </div>
        </section>
      </div>
    </main>
  );
}